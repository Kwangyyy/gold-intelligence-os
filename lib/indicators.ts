// Pure technical-indicator math. Operates on plain number arrays (oldest first,
// newest last) and returns the latest value (or a small series where needed).
// Implementations follow standard definitions (Wilder smoothing for RSI/ATR/ADX).

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Simple moving average of the last `period` values.
export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const w = values.slice(-period);
  return w.reduce((a, b) => a + b, 0) / period;
}

// Exponential moving average — full series (same length as input, null until seeded).
export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  // Seed with SMA of the first `period` values.
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function ema(values: number[], period: number): number | null {
  const s = emaSeries(values, period);
  return s.length ? s[s.length - 1] : null;
}

// RSI (Wilder). Returns latest value 0-100.
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
}

// MACD(12,26,9). Returns latest line/signal/histogram.
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdResult | null {
  if (closes.length < slow + signalPeriod) return null;
  const fastE = emaSeries(closes, fast);
  const slowE = emaSeries(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastE[i] != null && slowE[i] != null) {
      macdLine.push((fastE[i] as number) - (slowE[i] as number));
    }
  }
  if (macdLine.length < signalPeriod) return null;
  const signalE = emaSeries(macdLine, signalPeriod);
  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signalE[signalE.length - 1];
  if (signalVal == null) return null;
  return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal };
}

// ATR (Wilder). Returns latest value.
export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  // Wilder smoothing.
  let prev = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period;
  }
  return prev;
}

// ADX (Wilder). Returns latest ADX value (trend strength, 0-100).
export function adx(candles: Candle[], period = 14): number | null {
  if (candles.length < period * 2 + 1) return null;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }

  // Wilder-smoothed sums.
  const smooth = (arr: number[]): number[] => {
    const out: number[] = [];
    let sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
    out.push(sum);
    for (let i = period; i < arr.length; i++) {
      sum = sum - sum / period + arr[i];
      out.push(sum);
    }
    return out;
  };

  const trS = smooth(tr);
  const plusS = smooth(plusDM);
  const minusS = smooth(minusDM);

  const dx: number[] = [];
  for (let i = 0; i < trS.length; i++) {
    if (trS[i] === 0) {
      dx.push(0);
      continue;
    }
    const plusDI = (plusS[i] / trS[i]) * 100;
    const minusDI = (minusS[i] / trS[i]) * 100;
    const denom = plusDI + minusDI;
    dx.push(denom === 0 ? 0 : (Math.abs(plusDI - minusDI) / denom) * 100);
  }

  if (dx.length < period) return null;
  // ADX = Wilder average of DX.
  let adxVal = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) {
    adxVal = (adxVal * (period - 1) + dx[i]) / period;
  }
  return adxVal;
}

export type StructureBias = "bullish" | "bearish" | "neutral";

// Market structure from swing points (fractal highs/lows over a small window).
// Compares the last two swing highs and lows: HH+HL = bullish, LH+LL = bearish.
export function marketStructure(candles: Candle[], lookback = 2): StructureBias {
  const n = candles.length;
  if (n < lookback * 2 + 3) return "neutral";
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = lookback; i < n - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) swingHighs.push(candles[i].high);
    if (isLow) swingLows.push(candles[i].low);
  }
  if (swingHighs.length < 2 || swingLows.length < 2) return "neutral";
  const hh = swingHighs[swingHighs.length - 1] > swingHighs[swingHighs.length - 2];
  const hl = swingLows[swingLows.length - 1] > swingLows[swingLows.length - 2];
  const lh = swingHighs[swingHighs.length - 1] < swingHighs[swingHighs.length - 2];
  const ll = swingLows[swingLows.length - 1] < swingLows[swingLows.length - 2];
  if (hh && hl) return "bullish";
  if (lh && ll) return "bearish";
  return "neutral";
}

// ===========================================================================
// Extended indicator suite (Module 3: Technical Intelligence)
// ===========================================================================

const lastN = <T,>(arr: T[], n: number) => arr.slice(Math.max(0, arr.length - n));

// ADX with directional indicators.
export interface AdxFull {
  adx: number;
  plusDI: number;
  minusDI: number;
}
export function adxFull(candles: Candle[], period = 14): AdxFull | null {
  if (candles.length < period * 2 + 1) return null;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const smooth = (arr: number[]): number[] => {
    const out: number[] = [];
    let sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
    out.push(sum);
    for (let i = period; i < arr.length; i++) {
      sum = sum - sum / period + arr[i];
      out.push(sum);
    }
    return out;
  };
  const trS = smooth(tr);
  const plusS = smooth(plusDM);
  const minusS = smooth(minusDM);
  const dx: number[] = [];
  let lastPlusDI = 0;
  let lastMinusDI = 0;
  for (let i = 0; i < trS.length; i++) {
    const plusDI = trS[i] === 0 ? 0 : (plusS[i] / trS[i]) * 100;
    const minusDI = trS[i] === 0 ? 0 : (minusS[i] / trS[i]) * 100;
    lastPlusDI = plusDI;
    lastMinusDI = minusDI;
    const denom = plusDI + minusDI;
    dx.push(denom === 0 ? 0 : (Math.abs(plusDI - minusDI) / denom) * 100);
  }
  if (dx.length < period) return null;
  let adxVal = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) adxVal = (adxVal * (period - 1) + dx[i]) / period;
  return { adx: adxVal, plusDI: lastPlusDI, minusDI: lastMinusDI };
}

// Bollinger Bands.
export interface Bollinger {
  mid: number;
  upper: number;
  lower: number;
  width: number; // (upper-lower)/mid
}
export function bollinger(closes: number[], period = 20, k = 2): Bollinger | null {
  if (closes.length < period) return null;
  const w = lastN(closes, period);
  const mid = w.reduce((a, b) => a + b, 0) / period;
  const variance = w.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mid + k * sd;
  const lower = mid - k * sd;
  return { mid, upper, lower, width: mid ? (upper - lower) / mid : 0 };
}

// Stochastic oscillator (%K, %D).
export interface Stochastic {
  k: number;
  d: number;
}
export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): Stochastic | null {
  if (candles.length < kPeriod + dPeriod) return null;
  const ks: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const win = candles.slice(i - kPeriod + 1, i + 1);
    const hh = Math.max(...win.map((c) => c.high));
    const ll = Math.min(...win.map((c) => c.low));
    const close = candles[i].close;
    ks.push(hh === ll ? 50 : ((close - ll) / (hh - ll)) * 100);
  }
  const k = ks[ks.length - 1];
  const d = lastN(ks, dPeriod).reduce((a, b) => a + b, 0) / Math.min(dPeriod, ks.length);
  return { k, d };
}

// Commodity Channel Index.
export function cci(candles: Candle[], period = 20): number | null {
  if (candles.length < period) return null;
  const tps = candles.map((c) => (c.high + c.low + c.close) / 3);
  const w = lastN(tps, period);
  const mean = w.reduce((a, b) => a + b, 0) / period;
  const meanDev = w.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
  const tp = tps[tps.length - 1];
  return meanDev === 0 ? 0 : (tp - mean) / (0.015 * meanDev);
}

// Momentum (price change) and Rate of Change (%).
export function momentum(closes: number[], period = 10): number | null {
  if (closes.length < period + 1) return null;
  return closes[closes.length - 1] - closes[closes.length - 1 - period];
}
export function roc(closes: number[], period = 12): number | null {
  if (closes.length < period + 1) return null;
  const prev = closes[closes.length - 1 - period];
  return prev === 0 ? 0 : (closes[closes.length - 1] / prev - 1) * 100;
}

// Donchian Channel.
export interface Channel {
  upper: number;
  lower: number;
  mid: number;
}
export function donchian(candles: Candle[], period = 20): Channel | null {
  if (candles.length < period) return null;
  const w = lastN(candles, period);
  const upper = Math.max(...w.map((c) => c.high));
  const lower = Math.min(...w.map((c) => c.low));
  return { upper, lower, mid: (upper + lower) / 2 };
}

// Keltner Channel (EMA mid ± mult*ATR).
export function keltner(candles: Candle[], emaPeriod = 20, atrPeriod = 10, mult = 2): Channel | null {
  const closes = candles.map((c) => c.close);
  const mid = ema(closes, emaPeriod);
  const a = atr(candles, atrPeriod);
  if (mid == null || a == null) return null;
  return { upper: mid + mult * a, lower: mid - mult * a, mid };
}

// Parabolic SAR.
export interface Psar {
  value: number;
  rising: boolean;
}
export function parabolicSar(candles: Candle[], step = 0.02, maxStep = 0.2): Psar | null {
  if (candles.length < 5) return null;
  let rising = candles[1].close > candles[0].close;
  let af = step;
  let ep = rising ? candles[0].high : candles[0].low;
  let sar = rising ? candles[0].low : candles[0].high;
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    sar = sar + af * (ep - sar);
    if (rising) {
      if (c.low < sar) {
        rising = false;
        sar = ep;
        ep = c.low;
        af = step;
      } else {
        if (c.high > ep) {
          ep = c.high;
          af = Math.min(af + step, maxStep);
        }
      }
    } else {
      if (c.high > sar) {
        rising = true;
        sar = ep;
        ep = c.high;
        af = step;
      } else {
        if (c.low < ep) {
          ep = c.low;
          af = Math.min(af + step, maxStep);
        }
      }
    }
  }
  return { value: sar, rising };
}

// SuperTrend.
export interface SuperTrend {
  value: number;
  rising: boolean;
}
export function superTrend(candles: Candle[], period = 10, mult = 3): SuperTrend | null {
  if (candles.length < period + 1) return null;
  let finalUpper = 0;
  let finalLower = 0;
  let trend = true; // rising
  let prevUpper = Infinity;
  let prevLower = -Infinity;
  // recompute ATR progressively (Wilder) for stability
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const slice = candles.slice(0, i + 1);
    const a = atr(slice, Math.min(period, slice.length - 1)) ?? 0;
    const mid = (c.high + c.low) / 2;
    const basicUpper = mid + mult * a;
    const basicLower = mid - mult * a;
    finalUpper =
      basicUpper < prevUpper || candles[i - 1].close > prevUpper ? basicUpper : prevUpper;
    finalLower =
      basicLower > prevLower || candles[i - 1].close < prevLower ? basicLower : prevLower;
    if (c.close > finalUpper) trend = true;
    else if (c.close < finalLower) trend = false;
    prevUpper = finalUpper;
    prevLower = finalLower;
  }
  return { value: trend ? finalLower : finalUpper, rising: trend };
}

// Ichimoku (current values; cloud read).
export interface Ichimoku {
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  priceAboveCloud: boolean;
  priceBelowCloud: boolean;
}
export function ichimoku(candles: Candle[]): Ichimoku | null {
  if (candles.length < 52) return null;
  const hl = (n: number) => {
    const w = lastN(candles, n);
    return (Math.max(...w.map((c) => c.high)) + Math.min(...w.map((c) => c.low))) / 2;
  };
  const tenkan = hl(9);
  const kijun = hl(26);
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = hl(52);
  const price = candles[candles.length - 1].close;
  const top = Math.max(senkouA, senkouB);
  const bot = Math.min(senkouA, senkouB);
  return {
    tenkan,
    kijun,
    senkouA,
    senkouB,
    priceAboveCloud: price > top,
    priceBelowCloud: price < bot,
  };
}

// VWAP over the available window (requires volume).
export function vwap(candles: Candle[]): number | null {
  let pv = 0;
  let vol = 0;
  for (const c of candles) {
    if (c.volume == null || c.volume <= 0) continue;
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    vol += c.volume;
  }
  return vol > 0 ? pv / vol : null;
}

// Classic floor-trader pivot points from a prior period's H/L/C.
export interface Pivots {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}
export function pivotPoints(high: number, low: number, close: number): Pivots {
  const p = (high + low + close) / 3;
  return {
    pivot: p,
    r1: 2 * p - low,
    s1: 2 * p - high,
    r2: p + (high - low),
    s2: p - (high - low),
    r3: high + 2 * (p - low),
    s3: low - 2 * (high - p),
  };
}

// Fibonacci retracement over a recent swing range.
export interface Fib {
  high: number;
  low: number;
  levels: { ratio: number; price: number }[];
}
export function fibRetracement(candles: Candle[], lookback = 100): Fib | null {
  if (candles.length < 10) return null;
  const w = lastN(candles, lookback);
  const high = Math.max(...w.map((c) => c.high));
  const low = Math.min(...w.map((c) => c.low));
  const range = high - low;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  return { high, low, levels: ratios.map((r) => ({ ratio: r, price: high - range * r })) };
}

export function stddevOf(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const w = lastN(values, period);
  const mean = w.reduce((a, b) => a + b, 0) / period;
  return Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
}
