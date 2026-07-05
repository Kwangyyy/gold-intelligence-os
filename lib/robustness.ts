// PRD Module 5/6 — Robustness: Walk-Forward Analysis + Monte Carlo.
//
// The EA optimizer (eaOptimizer.ts) grid-searches parameters and keeps the best
// IN-SAMPLE result — which is a machine for producing OVERFIT strategies. This
// module adds the out-of-sample checks that separate a real edge from a curve
// fit, reusing the existing runBacktest engine and optimizer:
//
//   • Walk-Forward: re-optimise on a rolling TRAIN window, then measure the
//     chosen params on the untouched TEST window that follows. Walk-Forward
//     Efficiency (WFE) = out-of-sample return-per-bar / in-sample
//     return-per-bar. PRD target: WFE > 60%.
//   • Monte Carlo: bootstrap-resample the trade sequence thousands of times to
//     get a distribution of outcomes — worst-case drawdown, return percentiles,
//     and the probability the strategy is actually profitable.
//
// Pure & deterministic (seeded RNG) so it's testable and cache-friendly.

import { runBacktest, defaultBacktestConfig } from "./backtest";
import type { OHLC, BacktestConfig, BacktestResult } from "./backtest";
import { optimizeStrategy, STRATEGY_META, type StrategyId } from "./eaOptimizer";
import type { Bilingual } from "./types";

// ── Seeded RNG (mulberry32) — deterministic Monte Carlo ──────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.round((p / 100) * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

const INIT_BAL = defaultBacktestConfig().initialBalance;

function returnPct(pnl: number, initBal = INIT_BAL): number {
  return +((pnl / initBal) * 100).toFixed(2);
}

// Return-per-bar (used for WFE so train/test windows of different length compare fairly).
function retPerBar(r: BacktestResult, bars: number): number {
  if (bars <= 0) return 0;
  return r.totalPnl / INIT_BAL / bars;
}

// Combine a set of trade PnLs into aggregate profit factor + max drawdown.
function aggregate(pnls: number[]): { profitFactor: number; maxDD: number; totalPnl: number } {
  let gp = 0, gl = 0, bal = INIT_BAL, peak = INIT_BAL, maxDD = 0, total = 0;
  for (const p of pnls) {
    if (p > 0) gp += p; else gl += -p;
    total += p;
    bal += p;
    peak = Math.max(peak, bal);
    maxDD = Math.max(maxDD, ((peak - bal) / peak) * 100);
  }
  const profitFactor = gl > 0 ? gp / gl : gp > 0 ? 999 : 0;
  return { profitFactor: +profitFactor.toFixed(2), maxDD: +maxDD.toFixed(2), totalPnl: +total.toFixed(2) };
}

// ── Walk-Forward ─────────────────────────────────────────────────────────────
export interface WalkForwardFold {
  fold: number;
  paramsLabel: string;
  trainBars: number;
  testBars: number;
  isReturnPct: number;
  oosReturnPct: number;
  oosProfitFactor: number;
  oosMaxDD: number;
  oosTrades: number;
  wfe: number; // fold WFE %
}

export interface WalkForwardResult {
  folds: WalkForwardFold[];
  wfe: number; // overall WFE %
  wfeTarget: number; // PRD target (60)
  oosReturnPct: number;
  oosProfitFactor: number;
  oosMaxDD: number;
  oosTrades: number;
  foldsPositive: number;
  pass: boolean;
}

export interface WalkForwardOptions {
  folds?: number; // OOS windows (default 4)
  trainRatio?: number; // train window as a fraction of the series (default 0.6)
  wfeTarget?: number; // pass threshold, default 60 (PRD)
  direction?: "both" | "buy_only" | "sell_only";
}

export function walkForward(ohlc: OHLC[], strategyId: StrategyId, opts: WalkForwardOptions = {}): WalkForwardResult {
  const folds = opts.folds ?? 4;
  const trainRatio = opts.trainRatio ?? 0.6;
  const wfeTarget = opts.wfeTarget ?? 60;
  const n = ohlc.length;
  const base = defaultBacktestConfig();

  const trainLen = Math.floor(n * trainRatio);
  const testLen = Math.floor((n * (1 - trainRatio)) / folds);

  const foldResults: WalkForwardFold[] = [];
  const oosPnls: number[] = [];
  let sumOosRetPerBar = 0, sumIsRetPerBar = 0, foldsCounted = 0;

  if (trainLen >= 120 && testLen >= 20) {
    for (let i = 0; i < folds; i++) {
      const trainStart = i * testLen;
      const trainEnd = trainStart + trainLen;
      const testStart = trainEnd;
      const testEnd = testStart + testLen;
      if (testEnd > n) break;

      const trainSlice = ohlc.slice(trainStart, trainEnd);
      const testSlice = ohlc.slice(testStart, testEnd);

      // Re-optimise on the TRAIN window only, then apply the winner to TEST.
      const top = optimizeStrategy(trainSlice, strategyId, { topN: 1, direction: opts.direction });
      if (top.length === 0) continue;
      const cfg: BacktestConfig = {
        ...base,
        ...top[0].params,
        direction: opts.direction ?? "both",
        cond2: top[0].params.cond2 ?? base.cond2,
        cond3: base.cond3,
      };

      const isResult = runBacktest(trainSlice, cfg);
      const oosResult = runBacktest(testSlice, cfg);
      for (const t of oosResult.trades) oosPnls.push(t.pnl);

      const isRpb = retPerBar(isResult, trainSlice.length);
      const oosRpb = retPerBar(oosResult, testSlice.length);
      const foldWfe = isRpb > 0 ? +((oosRpb / isRpb) * 100).toFixed(1) : oosRpb > 0 ? 100 : 0;
      sumOosRetPerBar += oosRpb;
      sumIsRetPerBar += isRpb;
      foldsCounted++;

      foldResults.push({
        fold: i + 1,
        paramsLabel: top[0].label,
        trainBars: trainSlice.length,
        testBars: testSlice.length,
        isReturnPct: returnPct(isResult.totalPnl),
        oosReturnPct: returnPct(oosResult.totalPnl),
        oosProfitFactor: +oosResult.profitFactor.toFixed(2),
        oosMaxDD: +oosResult.maxDrawdown.toFixed(2),
        oosTrades: oosResult.totalTrades,
        wfe: foldWfe,
      });
    }
  }

  const agg = aggregate(oosPnls);
  const overallWfe =
    sumIsRetPerBar > 0 ? +((sumOosRetPerBar / sumIsRetPerBar) * 100).toFixed(1) : sumOosRetPerBar > 0 ? 100 : 0;
  const foldsPositive = foldResults.filter((f) => f.oosReturnPct > 0).length;
  const pass =
    foldResults.length > 0 &&
    overallWfe >= wfeTarget &&
    agg.totalPnl > 0 &&
    foldsPositive >= Math.ceil(foldResults.length / 2);

  return {
    folds: foldResults,
    wfe: overallWfe,
    wfeTarget,
    oosReturnPct: returnPct(agg.totalPnl),
    oosProfitFactor: agg.profitFactor,
    oosMaxDD: agg.maxDD,
    oosTrades: oosPnls.length,
    foldsPositive,
    pass,
  };
}

// ── Monte Carlo ──────────────────────────────────────────────────────────────
export interface MonteCarloResult {
  simulations: number;
  tradesPerSim: number;
  returnPctP5: number;
  returnPctP50: number;
  returnPctP95: number;
  maxDDP50: number;
  maxDDP95: number; // worst-case drawdown at 95% confidence
  probProfit: number; // 0..1
  probDDover20: number; // 0..1
}

export interface MonteCarloOptions {
  simulations?: number; // default 1000
  seed?: number;
  slippagePerTrade?: number; // $ cost subtracted per trade (default 0)
}

// Bootstrap-resample the realised trade PnLs to build an outcome distribution.
export function monteCarlo(tradePnls: number[], opts: MonteCarloOptions = {}): MonteCarloResult {
  const sims = opts.simulations ?? 1000;
  const rng = mulberry32(opts.seed ?? 0x1234abcd);
  const slip = opts.slippagePerTrade ?? 0;
  const m = tradePnls.length;

  const finals: number[] = [];
  const dds: number[] = [];

  if (m > 0) {
    for (let s = 0; s < sims; s++) {
      let bal = INIT_BAL, peak = INIT_BAL, maxDD = 0;
      for (let k = 0; k < m; k++) {
        const pnl = tradePnls[Math.floor(rng() * m)] - slip; // sample with replacement
        bal += pnl;
        peak = Math.max(peak, bal);
        maxDD = Math.max(maxDD, ((peak - bal) / peak) * 100);
      }
      finals.push(((bal - INIT_BAL) / INIT_BAL) * 100);
      dds.push(maxDD);
    }
  }

  finals.sort((a, b) => a - b);
  dds.sort((a, b) => a - b);

  return {
    simulations: sims,
    tradesPerSim: m,
    returnPctP5: +percentile(finals, 5).toFixed(2),
    returnPctP50: +percentile(finals, 50).toFixed(2),
    returnPctP95: +percentile(finals, 95).toFixed(2),
    maxDDP50: +percentile(dds, 50).toFixed(2),
    maxDDP95: +percentile(dds, 95).toFixed(2),
    probProfit: m ? +(finals.filter((v) => v > 0).length / sims).toFixed(3) : 0,
    probDDover20: m ? +(dds.filter((v) => v > 20).length / sims).toFixed(3) : 0,
  };
}

// ── Combined robustness report ───────────────────────────────────────────────
export type Verdict = "robust" | "fragile" | "overfit" | "no_edge";

export interface RobustnessReport {
  strategyId: StrategyId;
  strategyName: string;
  bars: number;
  baseline: {
    paramsLabel: string;
    returnPct: number;
    profitFactor: number;
    maxDD: number;
    sharpe: number;
    winRate: number;
    trades: number;
  };
  walkForward: WalkForwardResult;
  monteCarlo: MonteCarloResult;
  verdict: Verdict;
  verdictReasons: Bilingual[];
  timestamp: string;
}

export interface RobustnessOptions extends WalkForwardOptions, MonteCarloOptions {}

export function assessRobustness(ohlc: OHLC[], strategyId: StrategyId, opts: RobustnessOptions = {}): RobustnessReport {
  const base = defaultBacktestConfig();

  // Baseline: best in-sample params over ALL data (what a naive optimizer keeps).
  const top = optimizeStrategy(ohlc, strategyId, { topN: 1, direction: opts.direction });
  let baseResult: BacktestResult;
  let paramsLabel = "—";
  if (top.length > 0) {
    const cfg: BacktestConfig = {
      ...base,
      ...top[0].params,
      direction: opts.direction ?? "both",
      cond2: top[0].params.cond2 ?? base.cond2,
      cond3: base.cond3,
    };
    baseResult = runBacktest(ohlc, cfg);
    paramsLabel = top[0].label;
  } else {
    baseResult = runBacktest(ohlc, base);
  }

  const wf = walkForward(ohlc, strategyId, opts);
  const mc = monteCarlo(baseResult.trades.map((t) => t.pnl), opts);

  // Verdict.
  const baselineGood = baseResult.totalPnl > 0 && baseResult.profitFactor >= 1.2 && baseResult.totalTrades >= 15;
  let verdict: Verdict;
  const reasons: Bilingual[] = [];

  if (!baselineGood) {
    verdict = "no_edge";
    reasons.push({
      th: `ผลในอดีตยังไม่มีเอดจ์ (PF ${baseResult.profitFactor.toFixed(2)}, เทรด ${baseResult.totalTrades} ครั้ง)`,
      en: `No in-sample edge (PF ${baseResult.profitFactor.toFixed(2)}, ${baseResult.totalTrades} trades)`,
    });
  } else if (wf.oosReturnPct <= 0 || wf.wfe < 40) {
    // Clear out-of-sample failure: in-sample profit does not carry forward.
    verdict = "overfit";
    reasons.push({
      th: `ดีเฉพาะ in-sample แต่ล้มเหลว OOS: WFE ${wf.wfe}% (เป้า ${wf.wfeTarget}%), ผลตอบแทน OOS ${wf.oosReturnPct}%`,
      en: `Good in-sample but fails out-of-sample: WFE ${wf.wfe}% (target ${wf.wfeTarget}%), OOS return ${wf.oosReturnPct}%`,
    });
  } else if (wf.pass && mc.probProfit >= 0.65 && mc.maxDDP95 < 40) {
    verdict = "robust";
    reasons.push({
      th: `ผ่าน walk-forward (WFE ${wf.wfe}%) และ Monte Carlo (โอกาสกำไร ${(mc.probProfit * 100).toFixed(0)}%, DD 95% ≤ ${mc.maxDDP95}%)`,
      en: `Passes walk-forward (WFE ${wf.wfe}%) and Monte Carlo (prob-profit ${(mc.probProfit * 100).toFixed(0)}%, DD@95% ${mc.maxDDP95}%)`,
    });
  } else {
    // OOS net-positive but not consistently (folds/MC) — a real but shaky edge.
    verdict = "fragile";
    reasons.push({
      th: `OOS เป็นบวกแต่เปราะ: OOS บวก ${wf.foldsPositive}/${wf.folds.length} รอบ, โอกาสกำไร ${(mc.probProfit * 100).toFixed(0)}%, DD แย่สุด 95% = ${mc.maxDDP95}%`,
      en: `OOS positive but inconsistent: ${wf.foldsPositive}/${wf.folds.length} folds positive, prob-profit ${(mc.probProfit * 100).toFixed(0)}%, worst-case DD@95% ${mc.maxDDP95}%`,
    });
  }
  reasons.push({
    th: `Walk-forward: ${wf.foldsPositive}/${wf.folds.length} รอบ OOS เป็นบวก · Monte Carlo ${mc.simulations} รอบ`,
    en: `Walk-forward: ${wf.foldsPositive}/${wf.folds.length} folds OOS-positive · Monte Carlo ${mc.simulations} sims`,
  });

  return {
    strategyId,
    strategyName: STRATEGY_META[strategyId]?.name ?? strategyId,
    bars: ohlc.length,
    baseline: {
      paramsLabel,
      returnPct: returnPct(baseResult.totalPnl),
      profitFactor: +baseResult.profitFactor.toFixed(2),
      maxDD: +baseResult.maxDrawdown.toFixed(2),
      sharpe: +baseResult.sharpeRatio.toFixed(2),
      winRate: +(baseResult.winRate * 100).toFixed(1),
      trades: baseResult.totalTrades,
    },
    walkForward: wf,
    monteCarlo: mc,
    verdict,
    verdictReasons: reasons,
    timestamp: new Date().toISOString(),
  };
}
