import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

export interface AiModelSignalEntry {
  id:         string;
  ts:         number;
  decision:   "BUY" | "SELL" | "HOLD";
  confidence: number;
  testAcc:    number;
  valAcc:     number;
  epochs:     number;
}

const KEY = "ai_model_signal_log";
const MAX = 200;

function redis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

declare global { var __aiSigLog: AiModelSignalEntry[] | undefined; }

export async function POST(req: Request) {
  const body = await req.json() as Omit<AiModelSignalEntry, "id" | "ts">;
  const entry: AiModelSignalEntry = { ...body, id: Date.now().toString(36), ts: Date.now() };
  const r = redis();
  if (r) {
    await r.lpush(KEY, JSON.stringify(entry));
    await r.ltrim(KEY, 0, MAX - 1);
  } else {
    globalThis.__aiSigLog = [entry, ...(globalThis.__aiSigLog ?? [])].slice(0, MAX);
  }
  return NextResponse.json({ ok: true, id: entry.id });
}

export async function GET(req: Request) {
  const limit = Math.min(parseInt(new URL(req.url).searchParams.get("limit") ?? "50"), 200);
  const r = redis();
  if (r) {
    const raw = await r.lrange<string>(KEY, 0, limit - 1);
    const entries = raw.map(item => {
      try { return typeof item === "string" ? JSON.parse(item) : item; } catch { return null; }
    }).filter(Boolean) as AiModelSignalEntry[];
    return NextResponse.json(entries);
  }
  return NextResponse.json((globalThis.__aiSigLog ?? []).slice(0, limit));
}
