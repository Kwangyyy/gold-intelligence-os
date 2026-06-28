// Multi-Timeframe engine (Module 2). Fetches XAUUSD (GC=F) candles per timeframe
// from Yahoo, computes indicators, and aggregates an overall bias.
// Server-side only.

import {
  adx as calcAdx,
  atr as calcAtr,
  ema,
  macd as calcMacd,
  marketStructure,
  rsi as calcRsi,
  type Candle,
} from "./indicators";
import type {
  Bilingual,
  EmaStatus,
  MacdState,
  MultiTimeframe,
  RecommendationLabel,
  TfSignal,
  TfTrend,
  TimeframeCode,
  TimeframeRow,
} from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

// Yahoo interval + range per timeframe. H4 is derived by aggregating 60m candles
// (Yahoo has no native 4h), so H1 and H4 share a single 60m fetch.
interface TfConfig {
  interval: string;
  range: string;
  aggregate?: number; // group N source candles into one (for H4)
}
const TF_CONFIG: Record<TimeframeCode, TfConfig> = {
  M1: { interval: "1m", range: "5d" },
  M5: { interval: "5m", range: "1mo" },
  M15: { interval: "15m", range: "1mo" },
  M30: { interval: "30m", range: "1mo" },
  H1: { interval: "60m", range: "6mo" },
  H4: { interval: "60m", range: "6mo", aggregate: 4 },
  D1: { interval: "1d", range: "2y" },
  W1: { interval: "1wk", range: "5y" },
  MN: { interval: "1mo", range: "max" },
};

const WEIGHTS: Record<TimeframeCode, number> = {
  M1: 0.3,
  M5: 0.5,
  M15: 0.8,
  M30: 1,
  H1: 1.5,
  H4: 2,
  D1: 2.5,
  W1: 2,
  MN: 1.5,
};

const SIGNAL_NUM: Record<TfSignal, number> = {
  strong_buy: 2,
  buy: 1,
  wait: 0,
  sell: -1,
  strong_sell: -2,
};

// --- candle fetching with a small in-memory cache --------------------------
interface CacheEntry {
  candles: Candle[];
  at: number;
}
const candleCache = new Map<string, CacheEntry>();

function ttlFor(interval: string): number {
  if (interval.endsWith("m")) return 60_000; // intraday: 1 min
  if (interval === "60m") return 120_000; // hourly: 2 min
  return 60 * 60_000; // daily/weekly/monthly: 1 hour
}

export async function fetchCandles(interval: string, range: string): Promise<Candle[]> {
  const key = `${interval}:${range}`;
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.at < ttlFor(interval)) return cached.candles;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Yahoo ${interval}/${range} -> ${res.status}`);
  const json = await res.json();
  const q = json?.chart?.result?.[0]?.indicators?.quote?.[0];
  if (!q) throw new Error("no quote");

  const candles: Candle[] = [];
  const len = q.close?.length ?? 0;
  for (let i = 0; i < len; i++) {
    const o = q.open[i];
    const h = q.high[i];
    const l = q.low[i];
    const c = q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    const v = q.volume?.[i];
    candles.push({ open: o, high: h, low: l, close: c, volume: v ?? undefined });
  }
  candleCache.set(key, { candles, at: Date.now() });
  return candles;
}

// Aggregate consecutive candles into groups of `n` (used for H4 from 60m).
function aggregate(candles: Candle[], n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += n) {
    const group = candles.slice(i, i + n);
    if (!group.length) break;
    const vols = group.map((c) => c.volume).filter((v): v is number => v != null);
    out.push({
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: vols.length ? vols.reduce((a, b) => a + b, 0) : undefined,
    });
  }
  return out;
}

// Fetch candles for a single timeframe, applying H4 aggregation when configured.
export async function fetchCandlesForTf(tf: TimeframeCode): Promise<Candle[]> {
  const cfg = TF_CONFIG[tf];
  const raw = await fetchCandles(cfg.interval, cfg.range);
  return cfg.aggregate ? aggregate(raw, cfg.aggregate) : raw;
}

// --- per-timeframe analysis -------------------------------------------------
function deriveEmaStatus(
  price: number,
  e20: number | null,
  e50: number | null,
  e200: number | null
): EmaStatus {
  if (e50 == null && e200 == null) return "na";
  if (e20 != null && e50 != null && e200 != null) {
    if (price > e20 && e20 > e50 && e50 > e200) return "strong_up";
    if (price < e20 && e20 < e50 && e50 < e200) return "strong_down";
    if (price > e50 && price > e200) return "up";
    if (price < e50 && price < e200) return "down";
    return "mixed";
  }
  const ref = e50 ?? e200;
  if (ref == null) return "na";
  return price > ref ? "up" : "down";
}

function trendFromEma(s: EmaStatus): TfTrend {
  if (s === "strong_up" || s === "up") return "bullish";
  if (s === "strong_down" || s === "down") return "bearish";
  return "neutral";
}

function emaScoreOf(s: EmaStatus): number {
  switch (s) {
    case "strong_up":
      return 2;
    case "up":
      return 1;
    case "down":
      return -1;
    case "strong_down":
      return -2;
    default:
      return 0;
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function computeRow(tf: TimeframeCode, candlesRaw: Candle[]): TimeframeRow {
  const cfg = TF_CONFIG[tf];
  const candles = cfg.aggregate ? aggregate(candlesRaw, cfg.aggregate) : candlesRaw;

  // Not enough data → mark unavailable but don't crash.
  if (candles.length < 30) {
    return {
      tf,
      available: false,
      trend: "neutral",
      emaStatus: "na",
      ema20: null,
      ema50: null,
      ema200: null,
      rsi: null,
      macdHistogram: null,
      macdState: "neutral",
      adx: null,
      atr: null,
      structure: "neutral",
      signal: "wait",
      confidence: 0,
    };
  }

  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const emaStatus = deriveEmaStatus(price, e20, e50, e200);
  const trend = trendFromEma(emaStatus);

  const rsiVal = calcRsi(closes, 14);
  const macdRes = calcMacd(closes);
  const macdHistogram = macdRes ? macdRes.histogram : null;
  const macdState: MacdState = macdRes
    ? macdRes.histogram > 0
      ? "bull"
      : macdRes.histogram < 0
        ? "bear"
        : "neutral"
    : "neutral";
  const adxVal = calcAdx(candles, 14);
  const atrVal = calcAtr(candles, 14);
  const structure = marketStructure(candles);

  // --- per-TF score ---
  let base = emaScoreOf(emaStatus);
  if (rsiVal != null) {
    if (rsiVal >= 55) base += 1;
    else if (rsiVal <= 45) base -= 1;
    if (rsiVal >= 75) base -= 0.5; // overbought caution
    if (rsiVal <= 25) base += 0.5; // oversold
  }
  if (macdState === "bull") base += 1;
  else if (macdState === "bear") base -= 1;
  if (structure === "bullish") base += 1;
  else if (structure === "bearish") base -= 1;

  // ADX scales conviction: strong trend amplifies, weak trend dampens.
  if (adxVal != null) {
    if (adxVal >= 25) base *= 1.2;
    else if (adxVal < 20) base *= 0.6;
  }

  let signal: TfSignal;
  if (base >= 3.5) signal = "strong_buy";
  else if (base >= 1.5) signal = "buy";
  else if (base <= -3.5) signal = "strong_sell";
  else if (base <= -1.5) signal = "sell";
  else signal = "wait";

  const confidence = Math.round(
    clamp(45 + Math.abs(base) * 10 + (adxVal != null && adxVal >= 25 ? 10 : adxVal != null && adxVal >= 20 ? 5 : 0), 30, 95)
  );

  return {
    tf,
    available: true,
    trend,
    emaStatus,
    ema20: e20,
    ema50: e50,
    ema200: e200,
    rsi: rsiVal,
    macdHistogram,
    macdState,
    adx: adxVal,
    atr: atrVal,
    structure,
    signal,
    confidence,
  };
}

// --- overall bias -----------------------------------------------------------
function biasFromNorm(norm: number): RecommendationLabel {
  if (norm >= 1.0) return "strong_buy";
  if (norm >= 0.45) return "buy";
  if (norm >= 0.15) return "buy_on_pullback";
  if (norm <= -1.0) return "strong_sell";
  if (norm <= -0.45) return "sell";
  if (norm <= -0.15) return "sell_on_rally";
  return "wait";
}

const ORDER: TimeframeCode[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"];

export async function buildMultiTimeframe(): Promise<MultiTimeframe> {
  // One 60m fetch feeds both H1 and H4; fetch the rest in parallel.
  const intraday60 = fetchCandles("60m", "6mo");
  const tasks: Partial<Record<TimeframeCode, Promise<Candle[]>>> = {
    M1: fetchCandles(TF_CONFIG.M1.interval, TF_CONFIG.M1.range),
    M5: fetchCandles(TF_CONFIG.M5.interval, TF_CONFIG.M5.range),
    M15: fetchCandles(TF_CONFIG.M15.interval, TF_CONFIG.M15.range),
    M30: fetchCandles(TF_CONFIG.M30.interval, TF_CONFIG.M30.range),
    H1: intraday60,
    H4: intraday60,
    D1: fetchCandles(TF_CONFIG.D1.interval, TF_CONFIG.D1.range),
    W1: fetchCandles(TF_CONFIG.W1.interval, TF_CONFIG.W1.range),
    MN: fetchCandles(TF_CONFIG.MN.interval, TF_CONFIG.MN.range),
  };

  const rows: TimeframeRow[] = await Promise.all(
    ORDER.map(async (tf) => {
      try {
        const candles = await tasks[tf]!;
        return computeRow(tf, candles);
      } catch {
        return computeRow(tf, []); // unavailable row
      }
    })
  );

  // Weighted aggregate over available rows.
  let weighted = 0;
  let totalW = 0;
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  for (const r of rows) {
    if (!r.available) continue;
    weighted += SIGNAL_NUM[r.signal] * WEIGHTS[r.tf];
    totalW += WEIGHTS[r.tf];
    if (r.signal === "buy" || r.signal === "strong_buy") bullishCount++;
    else if (r.signal === "sell" || r.signal === "strong_sell") bearishCount++;
    else neutralCount++;
  }
  const norm = totalW > 0 ? weighted / totalW : 0;
  const bias = biasFromNorm(norm);

  const htf = rows.filter((r) => ["H4", "D1", "W1"].includes(r.tf) && r.available);
  const htfBull = htf.filter((r) => r.trend === "bullish").length;
  const htfBear = htf.filter((r) => r.trend === "bearish").length;
  const htfWord =
    htfBull > htfBear
      ? { th: "เป็นขาขึ้น", en: "lean bullish" }
      : htfBear > htfBull
        ? { th: "เป็นขาลง", en: "lean bearish" }
        : { th: "ยังไม่ชัดเจน", en: "are mixed" };

  const explanation: Bilingual = {
    th: `จาก ${rows.filter((r) => r.available).length} ไทม์เฟรม: ขาขึ้น ${bullishCount} / ขาลง ${bearishCount} / เป็นกลาง ${neutralCount} โดยไทม์เฟรมใหญ่ (H4/D1/W1) ${htfWord.th}`,
    en: `Across ${rows.filter((r) => r.available).length} timeframes: ${bullishCount} bullish / ${bearishCount} bearish / ${neutralCount} neutral. Higher timeframes (H4/D1/W1) ${htfWord.en}.`,
  };

  return {
    symbol: "XAUUSD",
    source: "Yahoo Finance · COMEX GC=F",
    rows,
    overall: { bias, bullishCount, bearishCount, neutralCount, explanation },
    timestamp: new Date().toISOString(),
  };
}
