import { Redis } from "@upstash/redis";

export type SignalOutcome = "tp1" | "tp2" | "sl" | "be" | "pending";

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
  outcome: SignalOutcome;   // result after signal
  outcomeTs?: number;       // when outcome was set
  pnlPips?: number;         // actual pips gained/lost
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

export async function logSignal(entry: Omit<SignalEntry, "id" | "ts" | "outcome">): Promise<void> {
  const full: SignalEntry = { ...entry, outcome: "pending", id: Date.now().toString(36), ts: Date.now() };
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

export async function updateOutcome(
  id: string,
  outcome: SignalOutcome,
  pnlPips?: number,
): Promise<boolean> {
  const r = getRedis();
  if (r) {
    const raw = await r.lrange<string>(KEY, 0, MAX_LOG - 1);
    const idx = raw.findIndex(item => {
      try {
        const parsed = typeof item === "string" ? JSON.parse(item) : item;
        return parsed.id === id;
      } catch { return false; }
    });
    if (idx === -1) return false;
    const entry: SignalEntry = typeof raw[idx] === "string"
      ? JSON.parse(raw[idx] as string)
      : (raw[idx] as unknown as SignalEntry);
    entry.outcome  = outcome;
    entry.outcomeTs = Date.now();
    if (pnlPips !== undefined) entry.pnlPips = pnlPips;
    await r.lset(KEY, idx, JSON.stringify(entry));
    return true;
  } else {
    const list = globalThis.__signalLog ?? [];
    const item = list.find(s => s.id === id);
    if (!item) return false;
    item.outcome   = outcome;
    item.outcomeTs = Date.now();
    if (pnlPips !== undefined) item.pnlPips = pnlPips;
    return true;
  }
}

export async function clearSignals(): Promise<void> {
  const r = getRedis();
  if (r) await r.del(KEY);
  else globalThis.__signalLog = [];
}
