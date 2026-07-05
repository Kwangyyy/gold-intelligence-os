// PRD Module J — Portfolio Manager (EA allocation).
//
// Given several EA strategies (their full-period backtests), build a portfolio
// that DIVERSIFIES: bucket each strategy's realised P&L into monthly returns,
// measure how correlated the strategies are, and allocate capital by
// inverse-volatility so the combined equity is smoother (lower drawdown, higher
// Sharpe) than any single EA. Pure & deterministic.

import type { BacktestResult, BacktestTrade } from "./backtest";
import type { Bilingual } from "./types";

const INIT_BAL = 10_000;

export interface EaCandidate {
  id: string;
  name: string;
  result: BacktestResult; // full-period backtest
}

export interface EaAllocation {
  id: string;
  name: string;
  weight: number; // 0..1
  returnPct: number; // full-period return %
  volPct: number; // monthly return stdev
  maxDD: number;
  sharpe: number;
}

export interface EaPortfolioReport {
  months: string[];
  strategies: EaAllocation[];
  correlation: number[][]; // NxN Pearson of monthly returns
  avgCorrelation: number;
  portfolio: { returnPct: number; maxDD: number; sharpe: number; volPct: number; equity: number[] };
  equalWeight: { returnPct: number; maxDD: number; sharpe: number };
  bestSingle: { id: string; name: string; returnPct: number; maxDD: number };
  diversification: { ddReductionPct: number; sharpeGain: number };
  reasons: Bilingual[];
  timestamp: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function monthKey(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Realised P&L per calendar month → return as % of a fixed initial balance.
function monthlyMap(trades: BacktestTrade[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of trades) {
    const k = monthKey(t.exitTime || t.time);
    m.set(k, (m.get(k) ?? 0) + t.pnl);
  }
  return m;
}

function mean(a: number[]): number {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
}
function std(a: number[]): number {
  if (a.length < 2) return 0;
  const mu = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / a.length);
}
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den > 0 ? +(num / den).toFixed(2) : 0;
}

// Max drawdown (%) of an equity path built additively from monthly returns (% of base).
function maxDDFromMonthly(rets: number[]): { maxDD: number; equity: number[] } {
  const equity: number[] = [INIT_BAL];
  let cum = 0, peak = INIT_BAL, maxDD = 0;
  for (const r of rets) {
    cum += r; // % of base
    const eq = INIT_BAL * (1 + cum / 100);
    equity.push(+eq.toFixed(2));
    peak = Math.max(peak, eq);
    maxDD = Math.max(maxDD, ((peak - eq) / peak) * 100);
  }
  return { maxDD: +maxDD.toFixed(2), equity };
}

function sharpeOf(rets: number[]): number {
  const s = std(rets);
  return s > 0 ? +((mean(rets) / s) * Math.sqrt(12)).toFixed(2) : 0;
}

// ── main ─────────────────────────────────────────────────────────────────────
export function buildEaPortfolio(candidates: EaCandidate[]): EaPortfolioReport {
  const now = new Date().toISOString();
  const usable = candidates.filter((c) => c.result.trades.length > 0);

  if (usable.length < 2) {
    return {
      months: [],
      strategies: [],
      correlation: [],
      avgCorrelation: 0,
      portfolio: { returnPct: 0, maxDD: 0, sharpe: 0, volPct: 0, equity: [INIT_BAL] },
      equalWeight: { returnPct: 0, maxDD: 0, sharpe: 0 },
      bestSingle: { id: "", name: "", returnPct: 0, maxDD: 0 },
      diversification: { ddReductionPct: 0, sharpeGain: 0 },
      reasons: [
        { th: "ต้องมีกลยุทธ์ที่มีเทรดอย่างน้อย 2 ตัวเพื่อสร้างพอร์ต", en: "Need at least 2 strategies with trades to build a portfolio" },
      ],
      timestamp: now,
    };
  }

  // Align all strategies onto the union of months (missing month = 0 return).
  const maps = usable.map((c) => monthlyMap(c.result.trades));
  const months = [...new Set(maps.flatMap((m) => [...m.keys()]))].sort();
  const matrix = maps.map((m) => months.map((k) => +(((m.get(k) ?? 0) / INIT_BAL) * 100).toFixed(3)));

  // Per-strategy stats.
  const vols = matrix.map((r) => std(r));
  const invVol = vols.map((v) => (v > 0 ? 1 / v : 0));
  const invVolSum = invVol.reduce((s, v) => s + v, 0) || 1;
  const weights = invVol.map((v) => +(v / invVolSum).toFixed(3));

  const strategies: EaAllocation[] = usable.map((c, i) => {
    const rets = matrix[i];
    const dd = maxDDFromMonthly(rets);
    return {
      id: c.id,
      name: c.name,
      weight: weights[i],
      returnPct: +rets.reduce((s, v) => s + v, 0).toFixed(2),
      volPct: +vols[i].toFixed(2),
      maxDD: dd.maxDD,
      sharpe: sharpeOf(rets),
    };
  });

  // Correlation matrix.
  const n = usable.length;
  const correlation: number[][] = matrix.map((a) => matrix.map((b) => pearson(a, b)));
  let corrSum = 0, corrCnt = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { corrSum += correlation[i][j]; corrCnt++; }
  const avgCorrelation = corrCnt ? +(corrSum / corrCnt).toFixed(2) : 0;

  // Inverse-vol portfolio monthly returns.
  const portMonthly = months.map((_, mi) => matrix.reduce((s, r, i) => s + r[mi] * weights[i], 0));
  const portDD = maxDDFromMonthly(portMonthly);
  const portfolio = {
    returnPct: +portMonthly.reduce((s, v) => s + v, 0).toFixed(2),
    maxDD: portDD.maxDD,
    sharpe: sharpeOf(portMonthly),
    volPct: +std(portMonthly).toFixed(2),
    equity: portDD.equity,
  };

  // Equal-weight portfolio for comparison.
  const eqMonthly = months.map((_, mi) => mean(matrix.map((r) => r[mi])));
  const eqDD = maxDDFromMonthly(eqMonthly);
  const equalWeight = {
    returnPct: +eqMonthly.reduce((s, v) => s + v, 0).toFixed(2),
    maxDD: eqDD.maxDD,
    sharpe: sharpeOf(eqMonthly),
  };

  // Best single strategy (by return).
  const best = [...strategies].sort((a, b) => b.returnPct - a.returnPct)[0];
  const bestSingle = { id: best.id, name: best.name, returnPct: best.returnPct, maxDD: best.maxDD };

  const ddReductionPct = best.maxDD > 0 ? +(((best.maxDD - portfolio.maxDD) / best.maxDD) * 100).toFixed(1) : 0;
  const sharpeGain = +(portfolio.sharpe - best.sharpe).toFixed(2);

  const reasons: Bilingual[] = [
    {
      th: `จัดสรรแบบ inverse-volatility · ค่า correlation เฉลี่ย ${avgCorrelation} (ยิ่งต่ำยิ่งกระจายความเสี่ยงดี)`,
      en: `Inverse-volatility allocation · average correlation ${avgCorrelation} (lower = better diversification)`,
    },
    {
      th: ddReductionPct > 0
        ? `Drawdown ของพอร์ตต่ำกว่ากลยุทธ์เดี่ยวที่ดีที่สุด ${ddReductionPct}% (${best.maxDD}% → ${portfolio.maxDD}%)`
        : `การกระจายยังไม่ลด drawdown อย่างมีนัยสำคัญ (กลยุทธ์อาจสัมพันธ์กันสูง)`,
      en: ddReductionPct > 0
        ? `Portfolio drawdown ${ddReductionPct}% lower than the best single EA (${best.maxDD}% → ${portfolio.maxDD}%)`
        : `Diversification did not materially cut drawdown (strategies may be highly correlated)`,
    },
  ];

  return {
    months,
    strategies,
    correlation,
    avgCorrelation,
    portfolio,
    equalWeight,
    bestSingle,
    diversification: { ddReductionPct, sharpeGain },
    reasons,
    timestamp: now,
  };
}
