// A single small durable key — the shape several routes need for a rate limit,
// a dedup marker, or a cursor.
//
// Why this exists: routes were writing these markers to `.data/*.json`. On
// Vercel that directory is per-lambda and wiped between invocations, so on a
// serverless deploy the marker was almost always absent — a dedup window that
// never suppressed anything and a rate limit that never limited. The failure is
// silent and only shows up as duplicate Telegram alerts.
//
// Tiers, first available wins:
//   1. Upstash Redis  — durable and shared across instances. The real answer.
//   2. Local JSON file — for local / self-hosted dev where Redis isn't set up.
//   3. In-memory      — last resort; correct within one process, resets on restart.

import { Redis } from "@upstash/redis";

// node:fs and node:path are loaded on demand rather than imported at the top.
// goldSource pulls this module in, and goldSource is reachable from client
// components — a static import of a node scheme makes webpack try to bundle it
// for the browser and the build fails outright. The file tier is a local-dev
// convenience anyway; in production the Redis branch returns first.
async function nodeFs() {
  const [fs, path] = await Promise.all([import("node:fs"), import("node:path")]);
  return { fs: fs.promises, path: path.default };
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function fileTierReady(): boolean {
  return typeof process !== "undefined" && !!process.versions?.node;
}

declare global {
  // eslint-disable-next-line no-var
  var __kvStore: Record<string, unknown> | undefined;
}

// Keys are namespaced with ':' — not a legal path separator everywhere.
const safeName = (key: string) => `${key.replace(/[^a-z0-9._-]+/gi, "_")}.json`;

/** Read a key. Returns null when absent, unreadable, or unparseable. */
export async function kvGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (r) {
    try {
      const raw = await r.get<T | string>(key);
      if (raw == null) return null;
      return typeof raw === "string" ? (JSON.parse(raw) as T) : (raw as T);
    } catch {
      return null;
    }
  }
  if (fileTierReady()) {
    try {
      const { fs, path } = await nodeFs();
      const dir = path.join(process.cwd(), ".data");
      return JSON.parse(await fs.readFile(path.join(dir, safeName(key)), "utf8")) as T;
    } catch {
      return null;
    }
  }
  return (globalThis.__kvStore?.[key] as T) ?? null;
}

/** Write a key. `ttlSec` expires it on the Redis tier; ignored elsewhere. */
export async function kvSet<T>(key: string, value: T, ttlSec?: number): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await (ttlSec ? r.set(key, JSON.stringify(value), { ex: ttlSec }) : r.set(key, JSON.stringify(value)));
    } catch {
      /* best effort — a lost marker costs a duplicate alert, not a crash */
    }
    return;
  }
  if (fileTierReady()) {
    try {
      const { fs, path } = await nodeFs();
      const dir = path.join(process.cwd(), ".data");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, safeName(key)), JSON.stringify(value), "utf8");
    } catch {
      /* best effort */
    }
    return;
  }
  globalThis.__kvStore = { ...(globalThis.__kvStore ?? {}), [key]: value };
}

/** True when the durable tier is available, i.e. markers survive across instances. */
export function kvDurable(): boolean {
  return getRedis() !== null;
}

/**
 * Read-through cache: memory, then the shared tier, then the loader.
 *
 * Serverless gives every instance its own memory, so a module-level cache is
 * refetched on each cold start. That is how econ-impact came to 500 — several
 * routes each pulling the same calendar, drawing a 429. A shared tier means the
 * first instance to fetch pays for all of them.
 *
 * The in-memory layer stays in front because it costs nothing and saves a Redis
 * round-trip within one instance's life.
 *
 * Size matters here: Upstash rejects values over 1 MB. Use this for the small
 * stuff — a COT history is ~30 KB, a week of calendar ~50 KB. The CBOE option
 * chain is 875 KB and growing, close enough to the limit that a silent failure
 * is likely, so it deliberately stays memory-only.
 */
const mem = new Map<string, { value: unknown; at: number }>();
const inflightJson = new Map<string, Promise<unknown>>();

export async function cachedJson<T>(
  key: string,
  ttlSec: number,
  load: () => Promise<T>,
): Promise<T> {
  const ttlMs = ttlSec * 1000;
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  // Collapse concurrent callers in this instance onto one attempt.
  const existing = inflightJson.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    const shared = await kvGet<{ value: T; at: number }>(key);
    if (shared && Date.now() - shared.at < ttlMs) {
      mem.set(key, { value: shared.value, at: shared.at });
      return shared.value;
    }
    try {
      const value = await load();
      const at = Date.now();
      mem.set(key, { value, at });
      await kvSet(key, { value, at }, ttlSec);
      return value;
    } catch (e) {
      // Stale beats absent: prefer whatever either tier last held.
      if (hit) return hit.value as T;
      if (shared) { mem.set(key, shared); return shared.value; }
      throw e;
    }
  })().finally(() => inflightJson.delete(key));

  inflightJson.set(key, p);
  return p;
}
