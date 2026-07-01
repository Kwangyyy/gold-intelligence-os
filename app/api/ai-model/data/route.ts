// Feature engineering for the TF.js AI model.
// Returns a feature matrix (N × 14) + labels (N) ready for training.
// All indicator values are already available from lib/backtest.ts.

import { NextResponse } from "next/server";
import {
  calcEMA, calcRSI, calcMACD, calcBB, calcStoch, calcMomentum,
} from "@/lib/backtest";
import type { OHLC } from "@/lib/backtest";

export const dynamic = "force-dynamic";

let CACHE: { payload: ModelDataPayload; ts: number } | null = null;
const TTL = 60 * 60_000; // 1 hour

export interface ModelDataPayload {
  features:     number[][];    // N × FEATURE_NAMES.length
  labels:       number[];      // N: 0=HOLD, 1=BUY, 2=SELL
  featureNames: string[];
  labelCounts:  { buy: number; sell: number; hold: number };
  n:            number;
  dates:        string[];
  lastFeature:  number[];      // latest bar for prediction
  priceRange:   { min: number; max: number };
  closes:       number[];      // for backtest replay
}

export const FEATURE_NAMES = [
  "RSI14", "MACD_hist", "EMA_diff%", "BB_pctB",
  "ATR%", "Momentum%", "Stoch_K", "Stoch_D",
  "Body%", "Return_1", "Return_2", "Return_3",
  "DayOfWeek", "VolRatio",
];

const LABEL_HORIZON = 5;   // bars ahead to look for label
const LABEL_THRESH  = 0.5; // % move to classify as BUY/SELL

async function fetchOHLC(): Promise<OHLC[]> {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2y&interval=1d&includePrePost=false";
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12_000) });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const json = await r.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const q  = result?.indicators?.quote?.[0] ?? {};
  const volumes: number[] = result?.indicators?.quote?.[0]?.volume ?? [];

  return ts.map((t, i) => ({
    time: t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
    volume: volumes[i] ?? undefined,
  })).filter(b => b.open != null && b.close != null);
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map(v => (v - min) / range);
}

function buildFeatures(ohlc: OHLC[]): ModelDataPayload {
  const closes  = ohlc.map(b => b.close);
  const highs   = ohlc.map(b => b.high);
  const lows    = ohlc.map(b => b.low);
  const volumes = ohlc.map(b => (b as OHLC & { volume?: number }).volume ?? 0);
  const N       = ohlc.length;

  // ── Indicators ──────────────────────────────────────────────────────────────
  const rsiArr   = calcRSI(closes, 14);
  const macdRes  = calcMACD(closes, 12, 26, 9);
  // histogram = MACD line minus signal line
  const macdHist = macdRes.macd.map((m, i) => isNaN(m) || isNaN(macdRes.signal[i]) ? 0 : m - macdRes.signal[i]);
  const ema9     = calcEMA(closes, 9);
  const ema50    = calcEMA(closes, 50);
  // calcBB returns { upper: number[], mid: number[], lower: number[] }
  const bbRes    = calcBB(closes, 20, 2);
  // calcStoch returns { k: number[], d: number[] }
  const stochRes = calcStoch(highs, lows, closes, 14, 3);
  const momArr   = calcMomentum(closes, 10);

  // ATR
  const atr14: number[] = new Array(N).fill(0);
  for (let i = 1; i < N; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
    atr14[i] = i >= 14
      ? (atr14[i-1] * 13 + tr) / 14
      : tr;
  }

  // Volume MA
  const volMA20: number[] = new Array(N).fill(0);
  for (let i = 19; i < N; i++) {
    volMA20[i] = volumes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20;
  }

  // ── Compute per-bar feature vector ──────────────────────────────────────────
  const WARMUP = 50; // skip first 50 bars (indicators need history)
  const features: number[][] = [];
  const dates:    string[]   = [];
  const labels:   number[]   = [];
  const rawCloses: number[]  = [];

  for (let i = WARMUP; i < N - LABEL_HORIZON; i++) {
    const price = closes[i];
    if (!price) continue;

    const ema9v  = ema9[i]  ?? price;
    const ema50v = ema50[i] ?? price;

    const bbUpper = bbRes.upper[i] ?? price;
    const bbLower = bbRes.lower[i] ?? price;
    const bbRange = bbUpper - bbLower || 1;
    const bbPctB  = (price - bbLower) / bbRange;

    const stochK = stochRes.k[i] ?? 50;
    const stochD = stochRes.d[i] ?? 50;

    const body    = ohlc[i].high - ohlc[i].low > 0
      ? Math.abs(ohlc[i].close - ohlc[i].open) / (ohlc[i].high - ohlc[i].low) * 100
      : 0;
    const ret1 = i > 0 ? (closes[i] - closes[i-1]) / closes[i-1] * 100 : 0;
    const ret2 = i > 1 ? (closes[i] - closes[i-2]) / closes[i-2] * 100 : 0;
    const ret3 = i > 2 ? (closes[i] - closes[i-3]) / closes[i-3] * 100 : 0;
    const dow  = new Date(ohlc[i].time * 1000).getDay() / 6; // 0-1
    const volR = volMA20[i] > 0 ? volumes[i] / volMA20[i] : 1;

    features.push([
      (rsiArr[i] ?? 50) / 100,           // RSI14 normalized
      macdHist[i] / (atr14[i] || 1), // MACD hist / ATR
      (ema9v - ema50v) / price * 100 / 5, // EMA diff %
      Math.max(0, Math.min(1, bbPctB)),   // BB %B clipped [0,1]
      (atr14[i] / price) * 100 / 2,      // ATR%
      (momArr[i] ?? 0) / 5, // Momentum%
      stochK / 100,                        // Stoch %K
      stochD / 100,                        // Stoch %D
      Math.min(body / 100, 1),            // body%
      Math.max(-3, Math.min(3, ret1)) / 3,// ret1 clipped
      Math.max(-3, Math.min(3, ret2)) / 3,// ret2
      Math.max(-3, Math.min(3, ret3)) / 3,// ret3
      dow,                                 // day of week
      Math.min(volR / 3, 1),              // vol ratio
    ]);

    // Label: look LABEL_HORIZON bars ahead
    const futureClose = closes[i + LABEL_HORIZON];
    const futureRet   = (futureClose - price) / price * 100;
    const label = futureRet > LABEL_THRESH ? 1 : futureRet < -LABEL_THRESH ? 2 : 0;
    labels.push(label);
    rawCloses.push(price);
    dates.push(new Date(ohlc[i].time * 1000).toISOString().slice(0, 10));
  }

  const buy  = labels.filter(l => l === 1).length;
  const sell = labels.filter(l => l === 2).length;
  const hold = labels.filter(l => l === 0).length;

  // Last bar feature (for real-time prediction — no label needed)
  const lastI   = N - 1;
  const lastEma9  = ema9[lastI]  ?? closes[lastI];
  const lastEma50 = ema50[lastI] ?? closes[lastI];
  const lastPrice = closes[lastI];
  const lastBbU   = bbRes.upper[lastI] ?? lastPrice;
  const lastBbL   = bbRes.lower[lastI] ?? lastPrice;
  const lastBbR   = lastBbU - lastBbL || 1;
  const lastStochK = stochRes.k[lastI] ?? 50;
  const lastStochD = stochRes.d[lastI] ?? 50;
  const lastBody   = ohlc[lastI].high - ohlc[lastI].low > 0
    ? Math.abs(ohlc[lastI].close - ohlc[lastI].open) / (ohlc[lastI].high - ohlc[lastI].low) * 100 : 0;
  const lastRet1 = N > 1 ? (closes[lastI] - closes[lastI-1]) / closes[lastI-1] * 100 : 0;
  const lastRet2 = N > 2 ? (closes[lastI] - closes[lastI-2]) / closes[lastI-2] * 100 : 0;
  const lastRet3 = N > 3 ? (closes[lastI] - closes[lastI-3]) / closes[lastI-3] * 100 : 0;
  const lastDow  = new Date(ohlc[lastI].time * 1000).getDay() / 6;
  const lastVolR = volMA20[lastI] > 0 ? volumes[lastI] / volMA20[lastI] : 1;

  const lastFeature = [
    (rsiArr[lastI] ?? 50) / 100,
    macdHist[lastI] / (atr14[lastI] || 1),
    (lastEma9 - lastEma50) / lastPrice * 100 / 5,
    Math.max(0, Math.min(1, (lastPrice - lastBbL) / lastBbR)),
    (atr14[lastI] / lastPrice) * 100 / 2,
    (momArr[lastI] ?? 0) / 5,
    lastStochK / 100, lastStochD / 100,
    Math.min(lastBody / 100, 1),
    Math.max(-3, Math.min(3, lastRet1)) / 3,
    Math.max(-3, Math.min(3, lastRet2)) / 3,
    Math.max(-3, Math.min(3, lastRet3)) / 3,
    lastDow, Math.min(lastVolR / 3, 1),
  ];

  return {
    features, labels, featureNames: FEATURE_NAMES,
    labelCounts: { buy, sell, hold },
    n: features.length,
    dates,
    lastFeature,
    priceRange: { min: Math.min(...closes), max: Math.max(...closes) },
    closes: rawCloses,
  };
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) {
    return NextResponse.json(CACHE.payload, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const ohlc    = await fetchOHLC();
    const payload = buildFeatures(ohlc);
    CACHE = { payload, ts: Date.now() };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
