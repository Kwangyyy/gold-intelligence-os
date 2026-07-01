// EA Parameter Optimizer — runs grid search on BacktestConfig parameter space,
// scores each run by profit factor / drawdown / win rate / Sharpe, returns
// top N results for the user to pick and export as MQL5 EA code.

import { runBacktest, defaultBacktestConfig } from "./backtest";
import type { OHLC, BacktestConfig, BacktestResult, BacktestStrategyType } from "./backtest";

export interface OptimizedResult {
  rank:         number;
  strategyName: string;
  strategy:     BacktestStrategyType;
  params:       Partial<BacktestConfig>;
  result:       BacktestResult;
  score:        number;   // 0-100 composite
  label:        string;   // human-readable param summary
}

export type StrategyId =
  | "ema_cross" | "triple_ema" | "rsi" | "macd"
  | "bb_bounce" | "macd_rsi" | "ema_rsi" | "auto";

export const STRATEGY_META: Record<StrategyId, { name: string; nameTh: string; icon: string }> = {
  ema_cross:  { name: "EMA Crossover",   nameTh: "EMA Crossover",   icon: "📈" },
  triple_ema: { name: "Triple EMA",      nameTh: "Triple EMA",      icon: "📊" },
  rsi:        { name: "RSI Reversal",    nameTh: "RSI Reversal",    icon: "🔄" },
  macd:       { name: "MACD Signal",     nameTh: "MACD Signal",     icon: "⚡" },
  bb_bounce:  { name: "Bollinger Bounce",nameTh: "Bollinger Bounce",icon: "🎯" },
  macd_rsi:   { name: "MACD + RSI",      nameTh: "MACD + RSI",      icon: "🔬" },
  ema_rsi:    { name: "EMA + RSI Filter",nameTh: "EMA + RSI Filter",icon: "🧠" },
  auto:       { name: "AI Auto (All)",   nameTh: "AI Auto (ดีที่สุด)",icon: "🤖" },
};

// ── Parameter spaces ──────────────────────────────────────────────────────────

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v = +(v + step).toFixed(6)) out.push(v);
  return out;
}

function cartesian<T extends unknown[][]>(...arrays: T): unknown[][] {
  return arrays.reduce<unknown[][]>(
    (acc, arr) => acc.flatMap(a => arr.map(b => [...a, b])),
    [[]]
  );
}

// Build parameter grid for a strategy — deliberately compact (< 100 combos)
function buildGrid(strategyId: StrategyId): Partial<BacktestConfig>[] {
  const slValues = [10, 20, 35, 50];
  const tpRatios = [1.5, 2.0, 2.5, 3.0]; // TP = SL × ratio

  function withSlTp(base: Partial<BacktestConfig>): Partial<BacktestConfig>[] {
    const out: Partial<BacktestConfig>[] = [];
    for (const sl of slValues) {
      for (const tpR of tpRatios) {
        out.push({ ...base, slPoints: sl, tpPoints: +(sl * tpR).toFixed(1) });
      }
    }
    return out;
  }

  switch (strategyId) {
    case "ema_cross": {
      const pairs: [number, number][] = [
        [9,21],[9,50],[14,50],[21,50],[21,100],[9,100],[14,100],[34,100],[50,200]
      ];
      return pairs.flatMap(([f, s]) => withSlTp({ strategy: "ema_cross", fastPeriod: f, slowPeriod: s }));
    }
    case "triple_ema": {
      const sets: [number,number,number][] = [
        [9,21,50],[9,21,100],[14,34,100],[21,50,200],[5,21,50],[9,50,200]
      ];
      return sets.flatMap(([f,m,s]) => withSlTp({ strategy: "triple_ema", fastPeriod: f, midPeriod: m, slowPeriod: s }));
    }
    case "rsi": {
      const periods = [7, 9, 14, 21];
      const os = [25, 30, 35];
      const ob = [65, 70, 75];
      return cartesian(periods, os, ob).flatMap(([p, o, ov]) =>
        withSlTp({ strategy: "rsi", rsiPeriod: p as number, rsiOS: o as number, rsiOB: ov as number })
      );
    }
    case "macd": {
      const configs: [number,number,number][] = [
        [8,17,9],[12,26,9],[5,34,9],[8,21,5],[12,26,5],[8,26,9]
      ];
      return configs.flatMap(([f,s,sig]) => withSlTp({ strategy: "macd", macdFast: f, macdSlow: s, macdSignal: sig }));
    }
    case "bb_bounce": {
      const periods = [10, 15, 20, 25];
      const devs    = [1.5, 2.0, 2.5];
      return cartesian(periods, devs).flatMap(([p, d]) =>
        withSlTp({ strategy: "bb_bounce", bbPeriod: p as number, bbDev: d as number })
      );
    }
    case "macd_rsi": {
      const pairs: [number,number,number,number][] = [
        [12,26,9,14],[8,21,9,14],[12,26,5,14],[12,26,9,7],[8,21,5,7]
      ];
      return pairs.flatMap(([mf,ms,ms2,rp]) => withSlTp({
        strategy: "macd",
        macdFast: mf, macdSlow: ms, macdSignal: ms2,
        cond2: { ...defaultBacktestConfig().cond2, enabled: true, logic: "AND", strategy: "rsi", rsiPeriod: rp, rsiOS: 40, rsiOB: 60 },
      }));
    }
    case "ema_rsi": {
      const emaPairs: [number,number][] = [[9,50],[21,100],[14,50],[9,100]];
      const rsiParams: [number,number,number][] = [[14,35,65],[14,30,70],[7,30,70],[14,40,60]];
      return cartesian(emaPairs, rsiParams).slice(0, 64).flatMap(([ep, rp]) =>
        withSlTp({
          strategy: "ema_cross",
          fastPeriod: (ep as [number,number])[0], slowPeriod: (ep as [number,number])[1],
          cond2: { ...defaultBacktestConfig().cond2, enabled: true, logic: "AND", strategy: "rsi",
            rsiPeriod: (rp as [number,number,number])[0], rsiOS: (rp as [number,number,number])[1], rsiOB: (rp as [number,number,number])[2] },
        })
      );
    }
    default:
      return [];
  }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function score(r: BacktestResult): number {
  if (r.totalTrades < 10 || r.profitFactor <= 1.0) return 0;
  const pfScore  = Math.min(r.profitFactor / 3.0, 1.0)  * 35;
  const wrScore  = (r.winRate / 100)                     * 25;
  const ddScore  = (1 - Math.min(r.maxDrawdown / 50, 1)) * 25;
  const shScore  = Math.min(Math.max(r.sharpeRatio, 0) / 3.0, 1.0) * 15;
  return +(pfScore + wrScore + ddScore + shScore).toFixed(1);
}

function labelFor(strategy: StrategyId, cfg: Partial<BacktestConfig>): string {
  const sl = cfg.slPoints ?? 0;
  const tp = cfg.tpPoints ?? 0;
  switch (strategy) {
    case "ema_cross":
    case "ema_rsi":
      return `EMA(${cfg.fastPeriod}/${cfg.slowPeriod}) SL${sl} TP${tp}`;
    case "triple_ema":
      return `3EMA(${cfg.fastPeriod}/${cfg.midPeriod}/${cfg.slowPeriod}) SL${sl} TP${tp}`;
    case "rsi":
      return `RSI(${cfg.rsiPeriod}) ${cfg.rsiOS}/${cfg.rsiOB} SL${sl} TP${tp}`;
    case "macd":
    case "macd_rsi":
      return `MACD(${cfg.macdFast}/${cfg.macdSlow}/${cfg.macdSignal}) SL${sl} TP${tp}`;
    case "bb_bounce":
      return `BB(${cfg.bbPeriod},${cfg.bbDev}) SL${sl} TP${tp}`;
    default:
      return `SL${sl} TP${tp}`;
  }
}

// ── Main optimizer ────────────────────────────────────────────────────────────

export interface OptimizerOptions {
  topN?:      number;   // how many results to return (default 5)
  direction?: "both" | "buy_only" | "sell_only";
}

export function optimizeStrategy(
  ohlc: OHLC[],
  strategyId: StrategyId,
  opts: OptimizerOptions = {}
): OptimizedResult[] {
  const topN     = opts.topN ?? 5;
  const base     = defaultBacktestConfig();
  const grid     = buildGrid(strategyId);
  const results: { cfg: Partial<BacktestConfig>; r: BacktestResult; sc: number }[] = [];

  for (const overrides of grid) {
    const cfg: BacktestConfig = {
      ...base,
      ...overrides,
      direction: opts.direction ?? "both",
      cond2: overrides.cond2 ?? base.cond2,
      cond3: base.cond3,
    };
    try {
      const r  = runBacktest(ohlc, cfg);
      const sc = score(r);
      if (sc > 0) results.push({ cfg: overrides, r, sc });
    } catch { /* skip invalid combos */ }
  }

  results.sort((a, b) => b.sc - a.sc);

  return results.slice(0, topN).map((item, i) => ({
    rank:         i + 1,
    strategyName: STRATEGY_META[strategyId]?.name ?? strategyId,
    strategy:     (item.cfg.strategy ?? strategyId) as BacktestStrategyType,
    params:       item.cfg,
    result:       item.r,
    score:        item.sc,
    label:        labelFor(strategyId, item.cfg),
  }));
}

export function optimizeAll(ohlc: OHLC[], opts: OptimizerOptions = {}): OptimizedResult[] {
  const strategies: StrategyId[] = ["ema_cross","triple_ema","rsi","macd","bb_bounce","macd_rsi","ema_rsi"];
  const all: OptimizedResult[] = [];
  for (const s of strategies) {
    const res = optimizeStrategy(ohlc, s, { ...opts, topN: 2 });
    all.push(...res);
  }
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, opts.topN ?? 5).map((r, i) => ({ ...r, rank: i + 1 }));
}
