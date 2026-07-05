// PRD Module K / Module 11 — Self-Learning Engine (persistence).
//
// Journals every council vote and matures each entry after a delay, locking in
// the later price so councilLearning.ts can score per-agent accuracy. Uses
// Upstash Redis when configured, else an in-memory dev fallback — same pattern
// as signalLog.ts.

import { Redis } from "@upstash/redis";
import type { CouncilResult } from "./council";
import type { CouncilVoteEntry } from "./councilLearning";

const KEY = "gios:council-votes";
const MAX_LOG = 500;

// Don't record more than one entry per throttle window (avoids one entry per
// page load). Evaluate an entry once it's at least MATURITY old, but skip
// entries too stale to judge fairly.
const THROTTLE_MS = 5 * 60_000; // 5 min
const MATURITY_MS = 60 * 60_000; // 1 h — the horizon each vote is judged over
const MAX_EVAL_AGE_MS = 6 * 60 * 60_000; // 6 h — older un-evaluated entries expire unscored

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
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

export async function getCouncilVotes(limit = MAX_LOG): Promise<CouncilVoteEntry[]> {
  const r = getRedis();
  if (r) {
    const raw = await r.lrange<string>(KEY, 0, limit - 1);
    return raw.map(parse).filter(Boolean) as CouncilVoteEntry[];
  }
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

  const r = getRedis();
  if (r) {
    await r.lpush(KEY, JSON.stringify(entry));
    await r.ltrim(KEY, 0, MAX_LOG - 1);
  } else {
    globalThis.__councilVotes = [entry, ...(globalThis.__councilVotes ?? [])].slice(0, MAX_LOG);
  }
  return true;
}

// Lock in the later price for entries that have matured, so their per-agent
// votes can be scored. Returns how many entries were newly evaluated.
export async function matureAndEvaluate(currentPrice: number): Promise<number> {
  const now = Date.now();
  const r = getRedis();
  let matured = 0;

  if (r) {
    const raw = await r.lrange<string>(KEY, 0, MAX_LOG - 1);
    for (let i = 0; i < raw.length; i++) {
      const entry = parse(raw[i]);
      if (!entry || entry.evalTs != null) continue;
      const age = now - entry.ts;
      if (age >= MATURITY_MS && age <= MAX_EVAL_AGE_MS) {
        entry.evalTs = now;
        entry.evalPrice = currentPrice;
        await r.lset(KEY, i, JSON.stringify(entry));
        matured++;
      }
    }
  } else {
    for (const entry of globalThis.__councilVotes ?? []) {
      if (entry.evalTs != null) continue;
      const age = now - entry.ts;
      if (age >= MATURITY_MS && age <= MAX_EVAL_AGE_MS) {
        entry.evalTs = now;
        entry.evalPrice = currentPrice;
        matured++;
      }
    }
  }
  return matured;
}

export async function clearCouncilVotes(): Promise<void> {
  const r = getRedis();
  if (r) await r.del(KEY);
  else globalThis.__councilVotes = [];
}
