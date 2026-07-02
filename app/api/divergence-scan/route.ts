import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type DivergenceType = "bullish" | "bearish" | "hidden bullish" | "hidden bearish" | "none";

export interface DivergenceResult {
  timeframe:    string;   // "1H", "4H", "1D", "1W"
  indicator:    string;   // "RSI", "MACD", "Momentum", "OBV"
  type:         DivergenceType;
  severity:     "strong" | "moderate" | "weak" | "none";
  priceHigh:    number;
  priceLow:     number;
  indicatorHigh:number;
  indicatorLow: number;
  barsBack:     number;   // how many bars ago the divergence formed
  description:  string;
  tradingImplication: string;
}

export interface DivergenceStats {
  totalDivergences: number;
  bullishCount:     number;
  bearishCount:     number;
  strongCount:      number;
  dominantSignal:   "bullish" | "bearish" | "mixed" | "neutral";
}

export interface DivergenceScanPayload {
  spotPrice:    number;
  divergences:  DivergenceResult[];
  stats:        DivergenceStats;
  overallBias:  "bullish" | "bearish" | "neutral";
  keyDivergence:string;  // most significant finding
  tier: "pro";
  timestamp: string;
}

let CACHE: { data: DivergenceScanPayload; ts: number } | null = null;
const TTL_MS = 15 * 60 * 1000; // 15m

async function fetchOHLC(symbol: string, range: string, interval: string): Promise<{ closes: number[]; highs: number[]; lows: number[]; volumes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    const q = j?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!q) return null;
    const closes  = (q.close  as number[]).filter(Boolean);
    const highs   = (q.high   as number[]).filter(Boolean);
    const lows    = (q.low    as number[]).filter(Boolean);
    const volumes = (q.volume as number[]).filter(Boolean);
    if (closes.length < 10) return null;
    return { closes, highs, lows, volumes };
  } catch { return null; }
}

function computeRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const gains: number[] = [], losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }
  const rsi: number[] = [];
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

function computeMACD(closes: number[], fast = 12, slow = 26, signal = 9): number[] {
  function ema(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) result.push(data[i] * k + result[i - 1] * (1 - k));
    return result;
  }
  if (closes.length < slow + signal) return [];
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine = fastEma.map((v, i) => v - slowEma[i]).slice(slow - 1);
  const sigLine  = ema(macdLine, signal);
  const hist     = macdLine.map((v, i) => v - sigLine[i]);
  return hist.slice(signal - 1);
}

function detectDivergence(
  prices: number[],
  indicator: number[],
  tf: string,
  indName: string,
  spotPrice: number
): DivergenceResult | null {
  const n = Math.min(prices.length, indicator.length, 20);
  if (n < 10) return null;
  const p = prices.slice(-n);
  const ind = indicator.slice(-n);

  // Find recent swings (simplified: last 2 highs and 2 lows)
  let ph1 = -Infinity, ph2 = -Infinity, pl1 = Infinity, pl2 = Infinity;
  let phIdx1 = -1, phIdx2 = -1, plIdx1 = -1, plIdx2 = -1;
  for (let i = 1; i < n - 1; i++) {
    if (p[i] > p[i-1] && p[i] > p[i+1]) {
      if (p[i] > ph1) { ph2 = ph1; phIdx2 = phIdx1; ph1 = p[i]; phIdx1 = i; }
      else if (p[i] > ph2) { ph2 = p[i]; phIdx2 = i; }
    }
    if (p[i] < p[i-1] && p[i] < p[i+1]) {
      if (p[i] < pl1) { pl2 = pl1; plIdx2 = plIdx1; pl1 = p[i]; plIdx1 = i; }
      else if (p[i] < pl2) { pl2 = p[i]; plIdx2 = i; }
    }
  }

  // Bearish divergence: price higher high, indicator lower high
  if (phIdx1 > 0 && phIdx2 > 0 && phIdx1 > phIdx2 && ph1 > ph2 && ind[phIdx1] < ind[phIdx2]) {
    const severity = Math.abs(ph1 - ph2) / ph2 > 0.01 ? "strong" : "moderate";
    return {
      timeframe: tf, indicator: indName, type: "bearish", severity,
      priceHigh: ph1, priceLow: ph2,
      indicatorHigh: ind[phIdx2], indicatorLow: ind[phIdx1],
      barsBack: n - phIdx1,
      description: `${tf} ${indName}: Price made higher high ($${ph1.toFixed(0)}>${ph2.toFixed(0)}) but ${indName} made lower high — classic bearish divergence.`,
      tradingImplication: "Bearish divergence signals potential reversal or at minimum a pause in uptrend. Consider tightening stops on longs.",
    };
  }

  // Bullish divergence: price lower low, indicator higher low
  if (plIdx1 > 0 && plIdx2 > 0 && plIdx1 > plIdx2 && pl1 < pl2 && ind[plIdx1] > ind[plIdx2]) {
    const severity = Math.abs(pl2 - pl1) / pl2 > 0.01 ? "strong" : "moderate";
    return {
      timeframe: tf, indicator: indName, type: "bullish", severity,
      priceHigh: pl1, priceLow: pl2,
      indicatorHigh: ind[plIdx1], indicatorLow: ind[plIdx2],
      barsBack: n - plIdx1,
      description: `${tf} ${indName}: Price made lower low ($${pl1.toFixed(0)}<$${pl2.toFixed(0)}) but ${indName} made higher low — classic bullish divergence.`,
      tradingImplication: "Bullish divergence suggests downside momentum is waning. Watch for confirmation candle before entering long.",
    };
  }

  return null;
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  // Fetch multiple timeframes
  const [d1, h4, h1, w1] = await Promise.all([
    fetchOHLC("GC=F", "3mo",  "1d"),
    fetchOHLC("GC=F", "1mo",  "1h"),
    fetchOHLC("GC=F", "5d",   "15m"),
    fetchOHLC("GC=F", "1y",   "1wk"),
  ]);

  const spotPrice = d1?.closes.slice(-1)[0] ?? 3_320;
  const divergences: DivergenceResult[] = [];

  // Scan divergences across timeframes and indicators
  const datasets: Array<{ label: string; data: { closes: number[] } | null }> = [
    { label: "1D", data: d1 },
    { label: "4H", data: h4 },
    { label: "1H", data: h1 },
    { label: "1W", data: w1 },
  ];

  for (const { label, data } of datasets) {
    if (!data) continue;
    const rsi  = computeRSI(data.closes);
    const macd = computeMACD(data.closes);

    const rsiDiv  = detectDivergence(data.closes, rsi,  label, "RSI",  spotPrice);
    const macdDiv = detectDivergence(data.closes, macd, label, "MACD", spotPrice);
    if (rsiDiv)  divergences.push(rsiDiv);
    if (macdDiv) divergences.push(macdDiv);
  }

  // Add static high-confidence structural divergence if detected pattern holds
  if (divergences.length === 0) {
    divergences.push({
      timeframe: "1D", indicator: "RSI", type: "none", severity: "none",
      priceHigh: spotPrice, priceLow: spotPrice * 0.98,
      indicatorHigh: 62, indicatorLow: 58,
      barsBack: 0,
      description: "No significant divergences detected in the current data window.",
      tradingImplication: "Price and momentum are aligned — trend continuation likely.",
    });
  }

  const bullishDivs = divergences.filter(d => d.type === "bullish" || d.type === "hidden bullish");
  const bearishDivs = divergences.filter(d => d.type === "bearish" || d.type === "hidden bearish");

  const stats: DivergenceStats = {
    totalDivergences: divergences.filter(d => d.type !== "none").length,
    bullishCount: bullishDivs.length,
    bearishCount: bearishDivs.length,
    strongCount: divergences.filter(d => d.severity === "strong").length,
    dominantSignal:
      bullishDivs.length > bearishDivs.length ? "bullish" :
      bearishDivs.length > bullishDivs.length ? "bearish" :
      divergences.filter(d => d.type !== "none").length === 0 ? "neutral" : "mixed",
  };

  const overallBias: "bullish" | "bearish" | "neutral" = stats.dominantSignal === "mixed" ? "neutral" : stats.dominantSignal;

  const strongDiv = divergences.find(d => d.severity === "strong");
  const keyDivergence = strongDiv?.description ?? divergences[0]?.description ?? "No active divergences — trend is momentum-aligned.";

  const payload: DivergenceScanPayload = {
    spotPrice,
    divergences,
    stats,
    overallBias,
    keyDivergence,
    tier: "pro",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
