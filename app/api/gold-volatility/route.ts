import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface VolatilityPoint {
  period: string;
  days: number;
  rv: number;          // realized volatility annualized (%)
  pctile: number;      // percentile vs 1Y history
  signal: "low" | "normal" | "elevated" | "extreme";
  signalColor: string;
}

export interface GoldVolatilityPayload {
  currentPrice: number;
  atr14: number;         // ATR(14)
  atrPct: number;        // ATR as % of price
  atrPctile: number;     // vs 1Y percentile

  rv10: number;          // 10D realized vol (annualized %)
  rv20: number;
  rv30: number;
  rv60: number;
  rv1Y: number;          // Full year baseline

  volPoints: VolatilityPoint[];

  volRegime: "low_vol" | "normal_vol" | "high_vol" | "extreme_vol";
  volRegimeColor: string;
  volRegimeLabel: string;
  volRegimeDescription: string;

  volTrend: "expanding" | "contracting" | "stable";  // is vol increasing or decreasing?
  volTrendColor: string;

  tradingImplication: string;
  expectedDailyMove: number;   // in $ (1 std dev daily)
  expectedWeeklyMove: number;  // in $ (1 std dev weekly = daily × √5)
  expectedMonthlyMove: number; // in $ (1 std dev monthly = daily × √21)

  historicalHighVol: number;   // 1Y max 30D vol
  historicalLowVol: number;    // 1Y min 30D vol
  volConeHigh: number;         // 95th pctile 30D vol in 1Y
  volConeLow: number;          // 5th pctile 30D vol in 1Y

  dailyRanges: number[];       // last 30 daily high-low ranges
  timestamp: string;
}

let CACHE: { data: GoldVolatilityPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

async function fetchGold(): Promise<{ price: number; closes: number[]; highs: number[]; lows: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1y&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const highs: number[] = (r.indicators?.quote?.[0]?.high ?? []).filter(Boolean);
    const lows: number[] = (r.indicators?.quote?.[0]?.low ?? []).filter(Boolean);
    const price: number = r.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    return { price, closes, highs, lows };
  } catch { return null; }
}

function realizedVol(closes: number[], period: number): number {
  if (closes.length < period + 1) return 0;
  const returns: number[] = [];
  const slice = closes.slice(-period - 1);
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] > 0) returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function computeATR(closes: number[], highs: number[], lows: number[], period = 14): number {
  if (closes.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = closes.length - period - 1; i < closes.length - 1; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1] || 0);
    const lc = Math.abs(lows[i] - (closes[i - 1] || closes[i]));
    trs.push(Math.max(hl, hc, lc));
  }
  return trs.reduce((a, b) => a + b) / trs.length;
}

function rollingRV(closes: number[], windowSize: number, step = 1): number[] {
  const results: number[] = [];
  for (let end = windowSize + 1; end <= closes.length; end += step) {
    results.push(realizedVol(closes.slice(0, end), windowSize));
  }
  return results;
}

function percentile(arr: number[], val: number): number {
  if (arr.length === 0) return 50;
  const sorted = [...arr].sort((a, b) => a - b);
  const rank = sorted.filter(v => v <= val).length;
  return Math.round((rank / arr.length) * 100);
}

function toSignal(pctile: number): VolatilityPoint["signal"] {
  if (pctile >= 80) return "extreme";
  if (pctile >= 60) return "elevated";
  if (pctile >= 30) return "normal";
  return "low";
}

function sigColor(sig: VolatilityPoint["signal"]): string {
  const c = { low: "#34d399", normal: "#f5c451", elevated: "#fb923c", extreme: "#f87171" };
  return c[sig];
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const goldData = await fetchGold();
    if (!goldData || goldData.closes.length < 60) {
      return NextResponse.json({ error: "Insufficient data" }, { status: 500 });
    }

    const { price: currentPrice, closes, highs, lows } = goldData;

    const rv10 = realizedVol(closes, 10);
    const rv20 = realizedVol(closes, 20);
    const rv30 = realizedVol(closes, 30);
    const rv60 = realizedVol(closes, 60);
    const rv1Y = realizedVol(closes, Math.min(252, closes.length));

    // ATR
    const atr14 = computeATR(closes, highs, lows, 14);
    const atrPct = currentPrice > 0 ? (atr14 / currentPrice) * 100 : 0;

    // Rolling 30D RV for percentile computation (every 5 days, last 1Y)
    const rolling30D = rollingRV(closes, 30, 5);
    const rolling10D = rollingRV(closes, 10, 5);
    const rolling60D = rollingRV(closes, 60, 5);

    const rv30Pctile = percentile(rolling30D, rv30);
    const rv10Pctile = percentile(rolling10D, rv10);
    const rv60Pctile = percentile(rolling60D, rv60);
    const atrPctile = percentile(rolling30D.map(r => r / Math.sqrt(252) * atrPct / (rv30 || 1) * 100 || atrPct), atrPct);

    const historicalHighVol = rolling30D.length > 0 ? Math.max(...rolling30D) : rv30;
    const historicalLowVol = rolling30D.length > 0 ? Math.min(...rolling30D) : rv30;
    const sorted30D = [...rolling30D].sort((a, b) => a - b);
    const volConeLow = sorted30D[Math.floor(sorted30D.length * 0.05)] ?? historicalLowVol;
    const volConeHigh = sorted30D[Math.floor(sorted30D.length * 0.95)] ?? historicalHighVol;

    const volPoints: VolatilityPoint[] = [
      { period: "10D", days: 10, rv: Math.round(rv10 * 10) / 10, pctile: rv10Pctile, signal: toSignal(rv10Pctile), signalColor: sigColor(toSignal(rv10Pctile)) },
      { period: "20D", days: 20, rv: Math.round(rv20 * 10) / 10, pctile: percentile(rolling30D, rv20), signal: toSignal(percentile(rolling30D, rv20)), signalColor: sigColor(toSignal(percentile(rolling30D, rv20))) },
      { period: "30D", days: 30, rv: Math.round(rv30 * 10) / 10, pctile: rv30Pctile, signal: toSignal(rv30Pctile), signalColor: sigColor(toSignal(rv30Pctile)) },
      { period: "60D", days: 60, rv: Math.round(rv60 * 10) / 10, pctile: rv60Pctile, signal: toSignal(rv60Pctile), signalColor: sigColor(toSignal(rv60Pctile)) },
    ];

    // Regime based on 30D percentile
    let volRegime: GoldVolatilityPayload["volRegime"] = "normal_vol";
    let volRegimeColor = "#f5c451";
    let volRegimeLabel = "Normal Volatility";
    let volRegimeDescription = "";

    if (rv30Pctile >= 80) {
      volRegime = "extreme_vol";
      volRegimeColor = "#f87171";
      volRegimeLabel = "Extreme Volatility";
      volRegimeDescription = `30D vol at ${rv30.toFixed(1)}% (${rv30Pctile}th pctile) — extreme readings typically mark major market events or turning points.`;
    } else if (rv30Pctile >= 60) {
      volRegime = "high_vol";
      volRegimeColor = "#fb923c";
      volRegimeLabel = "Elevated Volatility";
      volRegimeDescription = `30D vol at ${rv30.toFixed(1)}% (${rv30Pctile}th pctile) — above-average volatility. Wider stops required. Good for premium sellers.`;
    } else if (rv30Pctile < 30) {
      volRegime = "low_vol";
      volRegimeColor = "#34d399";
      volRegimeLabel = "Low Volatility";
      volRegimeDescription = `30D vol at ${rv30.toFixed(1)}% (${rv30Pctile}th pctile) — compressed volatility often precedes breakout. Options cheap for directional plays.`;
    } else {
      volRegimeDescription = `30D vol at ${rv30.toFixed(1)}% (${rv30Pctile}th pctile) — near historical average. Standard position sizing appropriate.`;
    }

    // Vol trend: expanding vs contracting
    const volTrend: GoldVolatilityPayload["volTrend"] = rv10 > rv30 * 1.15 ? "expanding" : rv10 < rv30 * 0.85 ? "contracting" : "stable";
    const volTrendColor = volTrend === "expanding" ? "#f87171" : volTrend === "contracting" ? "#34d399" : "#f5c451";

    // Expected moves
    const dailyVolPct = rv30 / Math.sqrt(252) / 100;
    const expectedDailyMove = Math.round(currentPrice * dailyVolPct);
    const expectedWeeklyMove = Math.round(currentPrice * dailyVolPct * Math.sqrt(5));
    const expectedMonthlyMove = Math.round(currentPrice * dailyVolPct * Math.sqrt(21));

    const tradingImplication = volRegime === "extreme_vol"
      ? `High volatility: use 1.5-2× normal stops. Daily expected range ±$${expectedDailyMove}. Buy options instead of spot. Wait for vol contraction before holding larger positions.`
      : volRegime === "high_vol"
      ? `Elevated vol: widen stops by 20-30%. Expect ±$${expectedDailyMove}/day. Premium selling (covered calls, cash-secured puts) advantageous.`
      : volRegime === "low_vol"
      ? `Quiet market: narrow stops viable. Expected ±$${expectedDailyMove}/day. Options cheap — ideal for directional long calls ahead of catalyst. Watch for breakout.`
      : `Normal vol environment: standard risk sizing. Expected ±$${expectedDailyMove}/day, ±$${expectedWeeklyMove}/week. Trade setups with 1:2+ R/R.`;

    // Daily ranges (H-L) last 30 days
    const rangeLen = Math.min(30, highs.length, lows.length);
    const dailyRanges = highs.slice(-rangeLen).map((h, i) => Math.round(h - lows[lows.length - rangeLen + i]));

    const payload: GoldVolatilityPayload = {
      currentPrice, atr14: Math.round(atr14 * 10) / 10, atrPct: Math.round(atrPct * 10) / 10, atrPctile,
      rv10, rv20, rv30, rv60, rv1Y, volPoints,
      volRegime, volRegimeColor, volRegimeLabel, volRegimeDescription,
      volTrend, volTrendColor, tradingImplication,
      expectedDailyMove, expectedWeeklyMove, expectedMonthlyMove,
      historicalHighVol: Math.round(historicalHighVol * 10) / 10,
      historicalLowVol: Math.round(historicalLowVol * 10) / 10,
      volConeHigh: Math.round(volConeHigh * 10) / 10,
      volConeLow: Math.round(volConeLow * 10) / 10,
      dailyRanges,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("gold-volatility error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
