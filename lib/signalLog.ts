import { Redis } from "@upstash/redis";

export interface SignalEntry {
  id: string;
  ts: number;               // unix ms
  symbol: string;
  direction: "buy" | "sell" | "wait";
  confidence: number;
  setupType: string;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number | null;
  rr1: number;
  source: "gemini" | "rule";
}

const KEY     = "gios:signal-log";
const MAX_LOG = 200;

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// In-memory fallback for local dev
declare global { var __signalLog: SignalEntry[] | undefined; }

export async function logSignal(entry: Omit<SignalEntry, "id" | "ts">): Promise<void> {
  const full: SignalEntry = { ...entry, id: Date.now().toString(36), ts: Date.now() };
  const r = getRedis();
  if (r) {
    await r.lpush(KEY, JSON.stringify(full));
    await r.ltrim(KEY, 0, MAX_LOG - 1);
  } else {
    globalThis.__signalLog = [full, ...(globalThis.__signalLog ?? [])].slice(0, MAX_LOG);
  }
}

export async function getSignals(limit = 100): Promise<SignalEntry[]> {
  const r = getRedis();
  if (r) {
    const raw = await r.lrange<string>(KEY, 0, limit - 1);
    return raw.map(item => {
      try { return typeof item === "string" ? JSON.parse(item) : item; } catch { return null; }
    }).filter(Boolean) as SignalEntry[];
  }
  return (globalThis.__signalLog ?? []).slice(0, limit);
}

export async function clearSignals(): Promise<void> {
  const r = getRedis();
  if (r) await r.del(KEY);
  else globalThis.__signalLog = [];
}
