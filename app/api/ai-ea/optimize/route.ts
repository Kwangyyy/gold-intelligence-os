import { NextResponse } from "next/server";
import { optimizeStrategy, optimizeAll, type StrategyId } from "@/lib/eaOptimizer";
import { optimizeRobust, optimizeRobustAll } from "@/lib/robustness";
import type { OHLC } from "@/lib/backtest";

export const dynamic = "force-dynamic";

let OHLC_CACHE: { data: OHLC[]; ts: number } | null = null;
const CACHE_TTL = 30 * 60_000;

async function fetchOHLC(): Promise<OHLC[]> {
  if (OHLC_CACHE && Date.now() - OHLC_CACHE.ts < CACHE_TTL) return OHLC_CACHE.data;

  const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2y&interval=1d&includePrePost=false";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const q  = result?.indicators?.quote?.[0] ?? {};
  const ohlc: OHLC[] = ts.map((t, i) => ({
    time: t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
  })).filter(b => b.open != null && b.close != null);

  OHLC_CACHE = { data: ohlc, ts: Date.now() };
  return ohlc;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const strategyId = (searchParams.get("strategy") ?? "auto") as StrategyId;
  const direction  = (searchParams.get("direction") ?? "both") as "both" | "buy_only" | "sell_only";
  // Robust mode: optimise on a train split, validate on an untouched holdout, and
  // re-rank by out-of-sample quality so overfit params don't reach the top.
  const robust = searchParams.get("robust") === "1";
  const filterOverfit = searchParams.get("filterOverfit") === "1";

  try {
    const ohlc = await fetchOHLC();
    const results = robust
      ? (strategyId === "auto"
          ? optimizeRobustAll(ohlc, { topN: 5, direction, filterOverfit })
          : optimizeRobust(ohlc, strategyId, { topN: 5, direction, filterOverfit }))
      : (strategyId === "auto"
          ? optimizeAll(ohlc, { topN: 5, direction })
          : optimizeStrategy(ohlc, strategyId, { topN: 5, direction }));

    // Strip full trade list to reduce payload size (keep equity curve + summary)
    const slim = results.map(r => ({
      ...r,
      result: {
        ...r.result,
        trades: r.result.trades.slice(0, 5), // sample only
        balanceCurve: r.result.balanceCurve.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 100)) === 0),
      },
    }));

    return NextResponse.json({ ok: true, robust, results: slim, ohlcLen: ohlc.length },
      { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
