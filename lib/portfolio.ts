// Portfolio / EA Monitor (Modules 13 & 14). SIMULATED account data — there is no
// live MT5 connection in this build. Structure is seeded by the day (stable within
// a day), while open XAUUSD positions float against the REAL gold price so the
// equity/floating P/L moves realistically. Clearly labelled as demo in the UI.

import type { EaStat, HealthLabel, OpenPosition, PortfolioSnapshot } from "./types";

// Deterministic PRNG (mulberry32) so the demo account is stable per seed.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

const r2 = (n: number) => +n.toFixed(2);

const EA_NAMES = ["Gold Grid EA", "Trend Rider EA", "London Breakout EA"];

export function buildPortfolio(price: number): PortfolioSnapshot {
  const rand = rng(daySeed());
  const balance = 10000;

  // Build 2-3 open XAUUSD positions with seeded entries near the live price.
  const count = 2 + Math.floor(rand() * 2); // 2 or 3
  const positions: OpenPosition[] = [];
  for (let i = 0; i < count; i++) {
    const direction: "buy" | "sell" = rand() > 0.5 ? "buy" : "sell";
    const lots = r2(0.05 + rand() * 0.25);
    // Entry within ~1.5% of current price.
    const entry = r2(price * (1 + (rand() - 0.5) * 0.03));
    const floating =
      direction === "buy" ? r2((price - entry) * 100 * lots) : r2((entry - price) * 100 * lots);
    positions.push({ ea: EA_NAMES[i % EA_NAMES.length], direction, lots, entry, current: price, floating });
  }

  const floatingPL = r2(positions.reduce((s, p) => s + p.floating, 0));
  const equity = r2(balance + floatingPL);
  const lotExposure = r2(positions.reduce((s, p) => s + p.lots, 0));
  const netLots = positions.reduce((s, p) => s + (p.direction === "buy" ? p.lots : -p.lots), 0);
  const netDirection = netLots > 0.001 ? "long" : netLots < -0.001 ? "short" : "flat";

  // Margin at 1:100 leverage.
  const notional = positions.reduce((s, p) => s + p.lots * 100 * price, 0);
  const marginUsed = r2(notional / 100);
  const freeMargin = r2(equity - marginUsed);
  const marginLevel = marginUsed > 0 ? r2((equity / marginUsed) * 100) : 0;

  // Seeded period P/L.
  const todayProfit = r2((rand() - 0.4) * 250);
  const weeklyProfit = r2(todayProfit + (rand() - 0.35) * 600);
  const monthlyProfit = r2(weeklyProfit + (rand() - 0.3) * 1500);

  // Equity curve: 60 daily points trending to current equity.
  const points = 60;
  const start = balance - monthlyProfit * 0.8;
  const equityCurve: number[] = [];
  let peak = start;
  let maxDd = 0;
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const trend = start + (equity - start) * t;
    const noise = (rand() - 0.5) * 120;
    const v = r2(trend + noise);
    equityCurve.push(v);
    peak = Math.max(peak, v);
    maxDd = Math.max(maxDd, (peak - v) / peak);
  }
  equityCurve[equityCurve.length - 1] = equity;
  const drawdownPct = r2(Math.max(maxDd * 100, peak > 0 ? ((peak - equity) / peak) * 100 : 0));

  // EA stats.
  const eas: EaStat[] = EA_NAMES.slice(0, count).map((name, i) => ({
    name,
    status: rand() > 0.2 ? "running" : "paused",
    currentGrid: 1 + Math.floor(rand() * 5),
    winRate: r2(55 + rand() * 25),
    profitFactor: r2(1.1 + rand() * 1.2),
    recoveryFactor: r2(1 + rand() * 3),
    todayProfit: r2((rand() - 0.4) * 120),
  }));

  // Health score from drawdown, margin level, and floating state.
  let score = 100;
  score -= drawdownPct * 3;
  if (marginLevel > 0 && marginLevel < 200) score -= (200 - marginLevel) / 8;
  if (floatingPL < 0) score -= Math.min(20, Math.abs(floatingPL) / 25);
  score = Math.round(Math.max(0, Math.min(100, score)));
  const healthLabel: HealthLabel = score >= 75 ? "healthy" : score >= 55 ? "watch" : score >= 35 ? "risky" : "critical";

  return {
    simulated: true,
    symbol: "XAUUSD",
    balance,
    equity,
    floatingPL,
    marginUsed,
    freeMargin,
    marginLevel,
    drawdownPct,
    todayProfit,
    weeklyProfit,
    monthlyProfit,
    lotExposure,
    netDirection,
    positions,
    eas,
    equityCurve,
    healthScore: score,
    healthLabel,
    timestamp: new Date().toISOString(),
  };
}
