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

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const DATA_DIR = path.join(process.cwd(), ".data");

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

function fileFor(key: string): string {
  // Keys are namespaced with ':' — not a legal path separator everywhere.
  return path.join(DATA_DIR, `${key.replace(/[^a-z0-9._-]+/gi, "_")}.json`);
}

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
      return JSON.parse(await fs.readFile(fileFor(key), "utf8")) as T;
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
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(fileFor(key), JSON.stringify(value), "utf8");
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
