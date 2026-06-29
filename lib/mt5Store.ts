// MT5 Bridge store.
// Production (Vercel): uses Upstash Redis — data persists across serverless invocations.
// Development (local): falls back to globalThis in-memory store.
//
// Required env vars for Redis (Vercel + Upstash):
//   UPSTASH_REDIS_REST_URL   — e.g. https://xxxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN — Upstash REST token

import { Redis } from "@upstash/redis";

export interface MT5Position {
  ticket: number;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  openTime: number; // unix seconds
  comment: string;
}

export interface MT5ClosedTrade {
  ticket: number;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  openPrice: number;
  closePrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: number;  // unix seconds
  closeTime: number; // unix seconds
  comment: string;
}

export interface MT5Account {
  balance: number;
  equity: number;
  floating: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
  positions: MT5Position[];
  closedTrades?: MT5ClosedTrade[]; // last 50 closed trades from EA
  server: string;
  account: string;
  lastUpdate: number; // Date.now()
}

const REDIS_KEY = "mt5:account";
const TTL_SEC   = 300; // 5 minutes
const MEM_TTL   = TTL_SEC * 1000;

// ── Redis client (production) ──────────────────────────────────────────────────

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// ── In-memory fallback (development) ──────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __mt5Data: MT5Account | null | undefined;
}

function memGet(): MT5Account | null {
  const d = globalThis.__mt5Data ?? null;
  if (!d) return null;
  if (Date.now() - d.lastUpdate > MEM_TTL) { globalThis.__mt5Data = null; return null; }
  return d;
}
function memSet(v: MT5Account | null): void { globalThis.__mt5Data = v; }

// ── Public API (all async) ────────────────────────────────────────────────────

export async function setMT5Data(raw: Omit<MT5Account, "lastUpdate">): Promise<void> {
  const data: MT5Account = { ...raw, lastUpdate: Date.now() };
  const redis = getRedis();
  if (redis) {
    await redis.set(REDIS_KEY, JSON.stringify(data), { ex: TTL_SEC });
  } else {
    memSet(data);
  }
}

export async function getMT5Data(): Promise<MT5Account | null> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string>(REDIS_KEY);
    if (!raw) return null;
    try {
      const data = (typeof raw === "string" ? JSON.parse(raw) : raw) as MT5Account;
      if (Date.now() - data.lastUpdate > MEM_TTL) {
        await redis.del(REDIS_KEY);
        return null;
      }
      return data;
    } catch { return null; }
  }
  return memGet();
}

export async function clearMT5Data(): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(REDIS_KEY);
  } else {
    memSet(null);
  }
}
