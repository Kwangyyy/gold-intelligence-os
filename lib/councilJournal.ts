// PRD Module K / Module 11 — Self-Learning Engine (persistence).
//
// Journals every council vote and matures each entry after a delay, locking in
// the later price so councilLearning.ts can score per-agent accuracy.
//
// Storage tiers (first available wins):
//   1. Postgres       — when POSTGRES_URL is set (Vercel Postgres / Neon).
//   2. Upstash Redis  — when UPSTASH_REDIS_REST_* is set (durable; works on
//      serverless / Vercel where the filesystem is ephemeral).
//   3. Local JSON file — .data/council-votes.json, for local / self-hosted dev.
//   4. In-memory      — last-resort fallback (resets on restart).

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { CouncilResult } from "./council";
import type { CouncilVoteEntry } from "./councilLearning";
import { pgEnabled, pgAppendVote, pgGetVotes, pgMatureAndEvaluate } from "./researchDb";

const KEY = "gios:council-votes";
const MAX_LOG = 500;

// Don't record more than one entry per throttle window (avoids one entry per
// page load). Evaluate an entry once it's at least MATURITY old, but skip
// entries too stale to judge fairly.
const THROTTLE_MS = 5 * 60_000; // 5 min
const MATURITY_MS = 60 * 60_000; // 1 h — the horizon each vote is judged over
const MAX_EVAL_AGE_MS = 6 * 60 * 60_000; // 6 h — older un-evaluated entries expire unscored

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "council-votes.json");

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// The file tier is available whenever we're on a normal Node runtime with a
// writable cwd (i.e. not Edge). Redis takes precedence when configured.
// NOTE: don't name this `use*` — ESLint's rules-of-hooks treats such names as
// React Hooks and fails the production build.
function fileTierReady(): boolean {
  return typeof process !== "undefined" && !!process.versions?.node;
}

declare global {
  // eslint-disable-next-line no-var
  var __councilVotes: CouncilVoteEntry[] | undefined;
}

function parse(item: unknown): CouncilVoteEntry | null {
  try {
    return typeof item === "string" ? (JSON.parse(item) as CouncilVoteEntry) : (item as CouncilVoteEntry);
  } catch {
    return null;
  }
}

// ── File tier helpers ────────────────────────────────────────────────────────
async function fileLoad(): Promise<CouncilVoteEntry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as CouncilVoteEntry[]) : [];
  } catch {
    return []; // missing/corrupt → empty
  }
}

async function fileSave(entries: CouncilVoteEntry[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(entries.slice(0, MAX_LOG)), "utf8");
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function getCouncilVotes(limit = MAX_LOG): Promise<CouncilVoteEntry[]> {
  if (pgEnabled()) {
    try { return await pgGetVotes(limit); } catch { return []; }
  }
  const r = getRedis();
  if (r) {
    const raw = await r.lrange<string>(KEY, 0, limit - 1);
    return raw.map(parse).filter(Boolean) as CouncilVoteEntry[];
  }
  if (fileTierReady()) return (await fileLoad()).slice(0, limit);
  return (globalThis.__councilVotes ?? []).slice(0, limit);
}

// Record a council vote. Throttled: no-op if the newest entry is fresher than
// THROTTLE_MS. Returns true if an entry was written.
export async function recordCouncilVote(result: CouncilResult, price: number): Promise<boolean> {
  const existing = await getCouncilVotes(1);
  if (existing[0] && Date.now() - existing[0].ts < THROTTLE_MS) return false;

  const entry: CouncilVoteEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    ts: Date.now(),
    symbol: result.symbol,
    price,
    decision: result.decision,
    confidence: result.confidence,
    agents: result.agents.map((a) => ({
      id: a.id,
      name: a.name,
      vote: a.vote,
      score: a.score,
      confidence: a.confidence,
    })),
  };

  if (pgEnabled()) {
    try { await pgAppendVote(entry); return true; } catch { return false; }
  }
  const r = getRedis();
  if (r) {
    await r.lpush(KEY, JSON.stringify(entry));
    await r.ltrim(KEY, 0, MAX_LOG - 1);
    return true;
  }
  if (fileTierReady()) {
    const all = await fileLoad();
    all.unshift(entry);
    await fileSave(all);
    return true;
  }
  globalThis.__councilVotes = [entry, ...(globalThis.__councilVotes ?? [])].slice(0, MAX_LOG);
  return true;
}

// Lock in the later price for entries that have matured, so their per-agent
// votes can be scored. Returns how many entries were newly evaluated.
export async function matureAndEvaluate(currentPrice: number): Promise<number> {
  const now = Date.now();
  const inWindow = (ts: number) => {
    const age = now - ts;
    return age >= MATURITY_MS && age <= MAX_EVAL_AGE_MS;
  };

  if (pgEnabled()) {
    try { return await pgMatureAndEvaluate(now, currentPrice, MATURITY_MS, MAX_EVAL_AGE_MS); } catch { return 0; }
  }
  const r = getRedis();
  if (r) {
    const raw = await r.lrange<string>(KEY, 0, MAX_LOG - 1);
    let matured = 0;
    for (let i = 0; i < raw.length; i++) {
      const entry = parse(raw[i]);
      if (!entry || entry.evalTs != null || !inWindow(entry.ts)) continue;
      entry.evalTs = now;
      entry.evalPrice = currentPrice;
      await r.lset(KEY, i, JSON.stringify(entry));
      matured++;
    }
    return matured;
  }

  if (fileTierReady()) {
    const all = await fileLoad();
    let matured = 0;
    for (const entry of all) {
      if (entry.evalTs != null || !inWindow(entry.ts)) continue;
      entry.evalTs = now;
      entry.evalPrice = currentPrice;
      matured++;
    }
    if (matured) await fileSave(all);
    return matured;
  }

  let matured = 0;
  for (const entry of globalThis.__councilVotes ?? []) {
    if (entry.evalTs != null || !inWindow(entry.ts)) continue;
    entry.evalTs = now;
    entry.evalPrice = currentPrice;
    matured++;
  }
  return matured;
}

export async function clearCouncilVotes(): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.del(KEY);
    return;
  }
  if (fileTierReady()) {
    await fileSave([]);
    return;
  }
  globalThis.__councilVotes = [];
}
