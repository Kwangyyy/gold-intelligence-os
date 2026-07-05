import { NextResponse } from "next/server";
import { runBacktest, defaultBacktestConfig, type OHLC, type BacktestConfig } from "@/lib/backtest";
import { optimizeRobust } from "@/lib/robustness";
import { STRATEGY_META, type StrategyId } from "@/lib/eaOptimizer";
import { buildEaPortfolio, type EaCandidate } from "@/lib/eaPortfolio";

export const dynamic = "force-dynamic";

const FAMILIES: StrategyId[] = ["ema_cross", "triple_ema", "rsi", "macd", "bb_bounce", "macd_rsi", "ema_rsi"];

let CACHE: { data: OHLC[]; ts: number } | null = null;
const TTL = 30 * 60_000;

async function fetchOHLC(): Promise<OHLC[]> {
  if (CACHE && Date.now() - CACHE.ts < TTL) return CACHE.data;
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2y&interval=1d&includePrePost=false";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  const ohlc: OHLC[] = ts
    .map((t, i) => ({ time: t, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i] }))
    .filter((b) => b.open != null && b.close != null);
  CACHE = { data: ohlc, ts: Date.now() };
  return ohlc;
}

// PRD Module J — build an EA portfolio from the best OUT-OF-SAMPLE-VALID strategy
// of each family (overfit families are excluded), then diversify via inverse-vol.
export async function GET() {
  try {
    const ohlc = await fetchOHLC();
    if (ohlc.length < 200) return NextResponse.json({ error: `Not enough history (${ohlc.length})` }, { status: 400 });

    const base = defaultBacktestConfig();
    const candidates: EaCandidate[] = [];

    for (const fam of FAMILIES) {
      const top = optimizeRobust(ohlc, fam, { topN: 1 });
      const pick = top[0];
      if (!pick || pick.verdict === "overfit" || pick.verdict === "no_edge") continue;
      // Run the chosen params over the FULL period for the portfolio return series.
      const cfg: BacktestConfig = {
        ...base,
        ...pick.params,
        cond2: pick.params.cond2 ?? base.cond2,
        cond3: base.cond3,
      };
      const result = runBacktest(ohlc, cfg);
      candidates.push({ id: fam, name: `${STRATEGY_META[fam]?.name ?? fam} · ${pick.label}`, result });
    }

    const report = buildEaPortfolio(candidates);
    return NextResponse.json({ ...report, candidateCount: candidates.length, bars: ohlc.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
