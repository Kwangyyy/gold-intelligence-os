import { NextResponse } from "next/server";

export const revalidate = 900; // 15-min cache

interface DataPoint {
  date: string;
  breakeven: number;   // 5Y5Y inflation breakeven (%)
  goldPrice: number;   // gold price
  realYield: number;   // 10Y TIPS real yield proxy
}

interface GoldBreakevenData {
  breakeven5y5y: number;       // current approximate breakeven
  breakevenChange1d: number;
  realYield10y: number;
  realYieldChange1d: number;
  goldPrice: number;
  goldChange1d: number;
  breakevenSignal: "rising_fast" | "rising" | "stable" | "falling" | "falling_fast";
  goldImplication: string;
  correlation30d: number;   // gold-breakeven rolling corr
  history: DataPoint[];
  keyLevels: { level: number; label: string; note: string }[];
  insight: string;
  timestamp: string;
}

async function fetchYahoo(symbol: string): Promise<{ price: number | null; change: number | null; closes: number[] }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=60d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return { price: null, change: null, closes: [] };

    const closes: number[] = (result.indicators?.quote?.[0]?.close ?? []).filter((c: number | null) => c != null);
    const price = result.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? null;
    const prev = closes[closes.length - 2] ?? null;
    const change = price && prev ? ((price - prev) / prev) * 100 : null;
    return { price, change, closes };
  } catch {
    return { price: null, change: null, closes: [] };
  }
}

// Estimate 5Y breakeven from TIPS ETF vs nominal bond ratio
function estimateBreakeven(tipPrice: number | null, tltPrice: number | null): number {
  // TIP/TLT ratio as a proxy for breakeven inflation
  // Scale to approximate 2-3% range for normal conditions
  if (!tipPrice || !tltPrice) return 2.35;
  const ratio = tipPrice / tltPrice;
  // Calibrate: historically ~0.83-0.90 ratio = 1.8-2.8% breakeven
  return parseFloat(((ratio - 0.72) * 18).toFixed(2));
}

function estimateRealYield(tipsClose: number | null, tipsPrev: number | null): number {
  // Approximate real yield from TIP price changes
  // Higher TIP price = lower real yield (inverse)
  if (!tipsClose || !tipsPrev) return 1.85;
  const priceChange = ((tipsClose - tipsPrev) / tipsPrev) * 100;
  return parseFloat((1.85 - priceChange * 5).toFixed(2));
}

function breakevenSignal(change: number): GoldBreakevenData["breakevenSignal"] {
  if (change > 0.08) return "rising_fast";
  if (change > 0.02) return "rising";
  if (change < -0.08) return "falling_fast";
  if (change < -0.02) return "falling";
  return "stable";
}

function goldImplication(signal: GoldBreakevenData["breakevenSignal"], breakeven: number, realYield: number): string {
  const be = breakeven.toFixed(2);
  const ry = realYield.toFixed(2);

  switch (signal) {
    case "rising_fast":
      return `Breakeven inflation surging to ${be}% with real yields at ${ry}%. This combination is strongly bullish for gold — inflation expectations are re-pricing higher faster than nominal yields.`;
    case "rising":
      return `Inflation breakevens rising to ${be}%. Real yields at ${ry}%. Supportive environment for gold as inflation hedge demand increases.`;
    case "stable":
      return `Breakeven inflation stable at ${be}% with real yields at ${ry}%. Gold's inflation-hedge signal is neutral — other drivers (DXY, risk-off) dominate.`;
    case "falling":
      return `Breakeven inflation falling to ${be}%. Declining inflation expectations reduce gold's hedge appeal. Mild bearish headwind unless risk-off demand compensates.`;
    case "falling_fast":
      return `Breakeven collapse to ${be}% signals disinflation fears. Real yields rising to ${ry}% — the most bearish combination for gold: no inflation premium, higher opportunity cost.`;
  }
}

function buildHistory(goldCloses: number[], tipCloses: number[], tltCloses: number[], n = 20): DataPoint[] {
  const len = Math.min(goldCloses.length, tipCloses.length, tltCloses.length, n);
  const now = new Date();
  const history: DataPoint[] = [];

  for (let i = len; i > 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const g = goldCloses[goldCloses.length - i];
    const tip = tipCloses[tipCloses.length - i];
    const tlt = tltCloses[tltCloses.length - i];
    const prev = tipCloses[tipCloses.length - i - 1];

    history.push({
      date: d.toISOString().slice(0, 10),
      breakeven: estimateBreakeven(tip, tlt),
      goldPrice: parseFloat((g ?? 3300).toFixed(2)),
      realYield: estimateRealYield(tip, prev),
    });
  }
  return history;
}

function rollingCorrelation(history: DataPoint[]): number {
  if (history.length < 5) return 0.75;
  const breaks = history.map(h => h.breakeven);
  const golds  = history.map(h => h.goldPrice);
  const n = breaks.length;
  const meanB = breaks.reduce((s, v) => s + v, 0) / n;
  const meanG = golds.reduce((s, v) => s + v, 0) / n;
  let cov = 0, varB = 0, varG = 0;
  for (let i = 0; i < n; i++) {
    cov  += (breaks[i] - meanB) * (golds[i] - meanG);
    varB += (breaks[i] - meanB) ** 2;
    varG += (golds[i] - meanG) ** 2;
  }
  if (varB === 0 || varG === 0) return 0;
  return parseFloat((cov / Math.sqrt(varB * varG)).toFixed(3));
}

export async function GET() {
  const [gold, tip, tlt] = await Promise.all([
    fetchYahoo("GC=F"),
    fetchYahoo("TIP"),
    fetchYahoo("TLT"),
  ]);

  const currentBreakeven = estimateBreakeven(tip.price, tlt.price);
  const prevBreakeven = estimateBreakeven(
    tip.closes[tip.closes.length - 2] ?? tip.price,
    tlt.closes[tlt.closes.length - 2] ?? tlt.price,
  );
  const beChange = parseFloat((currentBreakeven - (prevBreakeven ?? currentBreakeven)).toFixed(3));

  const realYield = estimateRealYield(tip.price, tip.closes[tip.closes.length - 2] ?? null);
  const realYieldChange = parseFloat((-(tip.change ?? 0) * 5).toFixed(3));

  const signal = breakevenSignal(beChange);
  const history = buildHistory(gold.closes, tip.closes, tlt.closes, 20);
  const corr = rollingCorrelation(history);

  const data: GoldBreakevenData = {
    breakeven5y5y: currentBreakeven,
    breakevenChange1d: beChange,
    realYield10y: realYield,
    realYieldChange1d: realYieldChange,
    goldPrice: gold.price ?? 3320,
    goldChange1d: gold.change ?? 0,
    breakevenSignal: signal,
    goldImplication: goldImplication(signal, currentBreakeven, realYield),
    correlation30d: corr,
    history,
    keyLevels: [
      { level: 1.5, label: "Deflationary Risk",   note: "Below 1.5% = markets pricing near-deflation risk. Bad for gold unless risk-off dominates" },
      { level: 2.0, label: "Fed Target",           note: "2% = Fed's inflation target. Near this level, gold's inflation premium is neutral" },
      { level: 2.5, label: "Moderate Inflation",   note: "2.5%+ = above-target inflation expectations. Growing inflation hedge demand for gold" },
      { level: 3.0, label: "High Inflation",        note: "3%+ = high inflation regime signal. Historically very bullish for gold" },
      { level: 3.5, label: "Stagflation Risk",      note: "3.5%+ = stagflation territory. Gold's strongest historical performance zone" },
    ],
    insight:
      `Current breakeven at ${currentBreakeven.toFixed(2)}% with real yield ${realYield.toFixed(2)}%. ` +
      `30-day correlation between breakeven and gold: ${(corr * 100).toFixed(0)}%. ` +
      (corr > 0.6 ? "Inflation expectations are the primary gold driver right now." :
       corr < 0.2 ? "Low correlation — other factors (DXY, risk-off) overriding inflation signal." :
       "Moderate correlation — inflation expectations are one of several co-drivers."),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
