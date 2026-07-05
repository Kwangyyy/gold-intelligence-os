import { NextResponse } from "next/server";
import type { OHLC } from "@/lib/backtest";
import { assessRobustness } from "@/lib/robustness";
import type { StrategyId } from "@/lib/eaOptimizer";

export const dynamic = "force-dynamic";

// PRD Module 5/6 — Walk-Forward + Monte Carlo robustness assessment.
// Concrete strategies the optimizer has a parameter grid for.
const VALID: StrategyId[] = ["ema_cross", "triple_ema", "rsi", "macd", "bb_bounce", "macd_rsi", "ema_rsi"];

const CACHE: Record<string, { data: OHLC[]; ts: number }> = {};
const TTL = 30 * 60 * 1000;

function aggregateH1toH4(h1: OHLC[]): OHLC[] {
  const h4: OHLC[] = [];
  for (let i = 0; i < h1.length; i += 4) {
    const slice = h1.slice(i, i + 4);
    if (slice.length === 0) continue;
    h4.push({
      time: slice[0].time,
      open: slice[0].open,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
      close: slice[slice.length - 1].close,
    });
  }
  return h4;
}

async function fetchOHLC(range: string, interval: string): Promise<OHLC[]> {
  const key = `${interval}-${range}`;
  if (CACHE[key] && Date.now() - CACHE[key].ts < TTL) return CACHE[key].data;

  const yfInterval = interval === "1h" || interval === "4h" ? "60m" : "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=${range}&interval=${yfInterval}&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No data");

  const timestamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  let ohlc: OHLC[] = timestamps
    .map((t, i) => ({ time: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i] }))
    .filter((b) => b.open != null && b.high != null && b.low != null && b.close != null);
  if (interval === "4h") ohlc = aggregateH1toH4(ohlc);

  CACHE[key] = { data: ohlc, ts: Date.now() };
  return ohlc;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stratParam = (searchParams.get("strategy") ?? "ema_cross") as StrategyId;
  const strategy = VALID.includes(stratParam) ? stratParam : "ema_cross";
  const interval = ["1d", "1h", "4h"].includes(searchParams.get("interval") ?? "") ? searchParams.get("interval")! : "1d";
  // More history = more meaningful walk-forward folds.
  const range = interval === "1d" ? "2y" : "6mo";

  try {
    const ohlc = await fetchOHLC(range, interval);
    if (ohlc.length < 200) {
      return NextResponse.json({ error: `Not enough history (${ohlc.length} bars)` }, { status: 400 });
    }
    const report = assessRobustness(ohlc, strategy, { folds: 4, trainRatio: 0.6, simulations: 1000 });
    return NextResponse.json({ ...report, interval, range }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
