import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import type { OptimizedResult } from "@/lib/eaOptimizer";

export const dynamic = "force-dynamic";

const KEY = "gios:ea-optimizer-history";
const MAX = 50;

interface SavedRun {
  id:        string;
  savedAt:   number;
  strategy:  string;
  direction: string;
  topResult: Pick<OptimizedResult, "rank"|"strategyName"|"label"|"score"> & {
    profitFactor: number; winRate: number; maxDrawdown: number; sharpeRatio: number;
    totalTrades: number; totalPnl: number;
  };
  allResults: Array<{ rank: number; label: string; score: number; profitFactor: number; winRate: number; maxDrawdown: number; }>;
}

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

declare global { var __eaHistory: SavedRun[] | undefined; }
function memHistory(): SavedRun[] {
  if (!globalThis.__eaHistory) globalThis.__eaHistory = [];
  return globalThis.__eaHistory;
}

export async function POST(req: Request) {
  try {
    const { results, strategy, direction } = await req.json() as {
      results: OptimizedResult[]; strategy: string; direction: string;
    };
    if (!results?.length) return NextResponse.json({ ok: false, error: "no results" }, { status: 400 });

    const top = results[0];
    const run: SavedRun = {
      id:       `ea-${Date.now()}`,
      savedAt:  Date.now(),
      strategy,
      direction,
      topResult: {
        rank: top.rank, strategyName: top.strategyName, label: top.label, score: top.score,
        profitFactor: top.result.profitFactor, winRate: top.result.winRate,
        maxDrawdown: top.result.maxDrawdown, sharpeRatio: top.result.sharpeRatio,
        totalTrades: top.result.totalTrades, totalPnl: top.result.totalPnl,
      },
      allResults: results.map(r => ({
        rank: r.rank, label: r.label, score: r.score,
        profitFactor: r.result.profitFactor, winRate: r.result.winRate, maxDrawdown: r.result.maxDrawdown,
      })),
    };

    const redis = getRedis();
    if (redis) {
      await redis.lpush(KEY, JSON.stringify(run));
      await redis.ltrim(KEY, 0, MAX - 1);
    } else {
      const h = memHistory();
      h.unshift(run);
      if (h.length > MAX) h.pop();
    }

    return NextResponse.json({ ok: true, id: run.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const redis = getRedis();
    let runs: SavedRun[] = [];
    if (redis) {
      const raw = await redis.lrange(KEY, 0, MAX - 1);
      runs = (raw as string[]).map(r => (typeof r === "string" ? JSON.parse(r) : r));
    } else {
      runs = memHistory();
    }
    return NextResponse.json({ ok: true, runs }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const redis = getRedis();
    if (redis) await redis.del(KEY);
    else globalThis.__eaHistory = [];
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
