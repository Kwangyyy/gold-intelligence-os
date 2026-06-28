// Signal Scanner engine — computes buy/sell/neutral for 12 indicators across
// 6 timeframes in parallel. Server-side only.

import { fetchCandlesForTf } from "./timeframes";
import {
  sma, emaSeries, rsi, macd, bollinger,
  stochastic, cci, momentum, roc,
  parabolicSar, superTrend, adxFull,
} from "./indicators";
import type { Candle } from "./indicators";
import type { TimeframeCode } from "./types";

export type SignalDir = "buy" | "sell" | "neutral";

export interface IndicatorScan {
  key: string;
  name: string;
  signal: SignalDir;
  value: string;       // short display string, e.g. "67.4"
}

export interface TfScan {
  tf: TimeframeCode;
  available: boolean;
  signals: IndicatorScan[];
  bias: SignalDir;
  score: number;       // 0-100 (50 = neutral)
  bullCount: number;
  bearCount: number;
  neutCount: number;
}

export interface ScanResult {
  price: number;
  timestamp: string;
  tfs: TfScan[];
  overallBias: SignalDir;
  overallScore: number;
  indicators: { key: string; name: string; category: string }[];
}

// ── Indicator list metadata ───────────────────────────────────────────────────

export const INDICATOR_META: { key: string; name: string; category: string }[] = [
  { key: "ema_cross",    name: "EMA 20/50",      category: "Trend"       },
  { key: "sma200",       name: "SMA 200",         category: "Trend"       },
  { key: "supertrend",   name: "SuperTrend",      category: "Trend"       },
  { key: "psar",         name: "Parabolic SAR",   category: "Trend"       },
  { key: "rsi",          name: "RSI 14",          category: "Oscillator"  },
  { key: "macd",         name: "MACD",            category: "Oscillator"  },
  { key: "stoch",        name: "Stochastic",      category: "Oscillator"  },
  { key: "cci",          name: "CCI 20",          category: "Oscillator"  },
  { key: "momentum",     name: "Momentum 10",     category: "Oscillator"  },
  { key: "roc",          name: "ROC 12",          category: "Oscillator"  },
  { key: "bb",           name: "Bollinger Bands", category: "Volatility"  },
  { key: "adx",          name: "ADX 14",          category: "Trend Str."  },
];

const SCAN_TFS: TimeframeCode[] = ["M15", "M30", "H1", "H4", "D1", "W1"];

// ── Per-indicator signal calculation ─────────────────────────────────────────

function scanIndicators(candles: Candle[]): IndicatorScan[] {
  const closes = candles.map(c => c.close);
  const highs  = candles.map(c => c.high);
  const lows   = candles.map(c => c.low);
  const price  = closes[closes.length - 1];

  const out: IndicatorScan[] = [];

  // 1. EMA 20/50 cross
  {
    const e20 = emaSeries(closes, 20);
    const e50 = emaSeries(closes, 50);
    const n = closes.length - 1;
    const v20 = e20[n]; const v50 = e50[n];
    const p20 = e20[n - 1]; const p50 = e50[n - 1];
    if (v20 != null && v50 != null && p20 != null && p50 != null) {
      const cur = v20 - v50; const prv = p20 - p50;
      const cross = (cur > 0 && prv <= 0) || (cur < 0 && prv >= 0);
      out.push({
        key: "ema_cross", name: "EMA 20/50",
        signal: cur > 0 ? "buy" : cur < 0 ? "sell" : "neutral",
        value: `${v20.toFixed(0)}/${v50.toFixed(0)}${cross ? " ✦" : ""}`,
      });
    } else {
      out.push({ key: "ema_cross", name: "EMA 20/50", signal: "neutral", value: "—" });
    }
  }

  // 2. SMA 200
  {
    const s200 = sma(closes, 200);
    if (s200 != null) {
      out.push({
        key: "sma200", name: "SMA 200",
        signal: price > s200 ? "buy" : price < s200 ? "sell" : "neutral",
        value: s200.toFixed(0),
      });
    } else {
      out.push({ key: "sma200", name: "SMA 200", signal: "neutral", value: "n/a" });
    }
  }

  // 3. SuperTrend
  {
    const st = superTrend(candles, 10, 3);
    if (st != null) {
      out.push({
        key: "supertrend", name: "SuperTrend",
        signal: st.rising ? "buy" : "sell",
        value: st.value.toFixed(0),
      });
    } else {
      out.push({ key: "supertrend", name: "SuperTrend", signal: "neutral", value: "—" });
    }
  }

  // 4. Parabolic SAR
  {
    const ps = parabolicSar(candles);
    if (ps != null) {
      out.push({
        key: "psar", name: "PSAR",
        signal: ps.rising ? "buy" : "sell",
        value: ps.value.toFixed(0),
      });
    } else {
      out.push({ key: "psar", name: "PSAR", signal: "neutral", value: "—" });
    }
  }

  // 5. RSI 14
  {
    const r = rsi(closes, 14);
    if (r != null) {
      const sig: SignalDir = r < 30 ? "buy" : r > 70 ? "sell" : r > 50 ? "buy" : r < 50 ? "sell" : "neutral";
      out.push({ key: "rsi", name: "RSI 14", signal: sig, value: r.toFixed(1) });
    } else {
      out.push({ key: "rsi", name: "RSI 14", signal: "neutral", value: "—" });
    }
  }

  // 6. MACD
  {
    const m = macd(closes, 12, 26, 9);
    if (m != null) {
      const { histogram } = m;
      const sig: SignalDir = histogram > 0 ? "buy" : histogram < 0 ? "sell" : "neutral";
      out.push({ key: "macd", name: "MACD", signal: sig, value: `${histogram.toFixed(1)}` });
    } else {
      out.push({ key: "macd", name: "MACD", signal: "neutral", value: "—" });
    }
  }

  // 7. Stochastic 14,3
  {
    const st = stochastic(candles, 14, 3);
    if (st != null) {
      const { k, d } = st;
      const sig: SignalDir = k < 20 ? "buy" : k > 80 ? "sell" : k > d ? "buy" : k < d ? "sell" : "neutral";
      out.push({ key: "stoch", name: "Stoch", signal: sig, value: `${k.toFixed(0)}/${d.toFixed(0)}` });
    } else {
      out.push({ key: "stoch", name: "Stoch", signal: "neutral", value: "—" });
    }
  }

  // 8. CCI 20
  {
    const c = cci(candles, 20);
    if (c != null) {
      const sig: SignalDir = c > 100 ? "buy" : c < -100 ? "sell" : c > 0 ? "buy" : "sell";
      out.push({ key: "cci", name: "CCI 20", signal: sig, value: c.toFixed(0) });
    } else {
      out.push({ key: "cci", name: "CCI 20", signal: "neutral", value: "—" });
    }
  }

  // 9. Momentum 10
  {
    const m = momentum(closes, 10);
    if (m != null) {
      out.push({ key: "momentum", name: "Mom 10", signal: m > 0 ? "buy" : m < 0 ? "sell" : "neutral", value: m.toFixed(1) });
    } else {
      out.push({ key: "momentum", name: "Mom 10", signal: "neutral", value: "—" });
    }
  }

  // 10. ROC 12
  {
    const r = roc(closes, 12);
    if (r != null) {
      out.push({ key: "roc", name: "ROC 12", signal: r > 0 ? "buy" : r < 0 ? "sell" : "neutral", value: `${r.toFixed(2)}%` });
    } else {
      out.push({ key: "roc", name: "ROC 12", signal: "neutral", value: "—" });
    }
  }

  // 11. Bollinger Bands
  {
    const bb = bollinger(closes, 20, 2);
    if (bb != null) {
      const { upper, mid: middle, lower } = bb;
      const bw = upper - lower;
      const pos = bw > 0 ? ((price - lower) / bw) * 100 : 50;
      const sig: SignalDir = pos < 20 ? "buy" : pos > 80 ? "sell" : pos > 50 ? "buy" : "sell";
      out.push({ key: "bb", name: "BB", signal: sig, value: `${pos.toFixed(0)}%` });
    } else {
      out.push({ key: "bb", name: "BB", signal: "neutral", value: "—" });
    }
  }

  // 12. ADX 14 (trend direction from +DI/-DI)
  {
    const af = adxFull(candles, 14);
    if (af != null) {
      const { adx: adxVal, plusDI, minusDI } = af;
      // ADX itself shows strength; +DI/-DI shows direction
      const trending = adxVal > 25;
      let sig: SignalDir = "neutral";
      if (trending) sig = plusDI > minusDI ? "buy" : "sell";
      out.push({
        key: "adx", name: "ADX 14",
        signal: sig,
        value: `${adxVal.toFixed(0)}${trending ? "" : " (rng)"}`,
      });
    } else {
      out.push({ key: "adx", name: "ADX 14", signal: "neutral", value: "—" });
    }
  }

  return out;
}

// ── Per-TF scan ───────────────────────────────────────────────────────────────

async function scanTf(tf: TimeframeCode): Promise<TfScan> {
  try {
    const candles = await fetchCandlesForTf(tf);
    if (candles.length < 60) throw new Error("insufficient");

    const signals = scanIndicators(candles);
    const bullCount = signals.filter(s => s.signal === "buy").length;
    const bearCount = signals.filter(s => s.signal === "sell").length;
    const neutCount = signals.filter(s => s.signal === "neutral").length;
    const total = bullCount + bearCount + neutCount || 1;

    // Score: 50 = neutral, 0 = all sell, 100 = all buy
    const score = Math.round(((bullCount - bearCount) / total) * 50 + 50);
    const bias: SignalDir = score > 55 ? "buy" : score < 45 ? "sell" : "neutral";

    return { tf, available: true, signals, bias, score, bullCount, bearCount, neutCount };
  } catch {
    return {
      tf, available: false,
      signals: INDICATOR_META.map(m => ({ key: m.key, name: m.name, signal: "neutral", value: "—" })),
      bias: "neutral", score: 50, bullCount: 0, bearCount: 0, neutCount: INDICATOR_META.length,
    };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runScan(): Promise<ScanResult> {
  // Fetch all TFs in parallel
  const tfScans = await Promise.all(SCAN_TFS.map(tf => scanTf(tf)));

  // Price from H1 (most available)
  const h1 = tfScans.find(t => t.tf === "H1" && t.available);
  const price = 0; // filled by route handler from Yahoo

  // Overall score = average of available TF scores weighted by TF importance
  const WEIGHTS: Record<string, number> = { M15: 0.8, M30: 1, H1: 1.5, H4: 2, D1: 2.5, W1: 3 };
  let weightedSum = 0; let weightTotal = 0;
  for (const t of tfScans) {
    if (!t.available) continue;
    const w = WEIGHTS[t.tf] ?? 1;
    weightedSum += t.score * w;
    weightTotal += w;
  }
  const overallScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 50;
  const overallBias: SignalDir = overallScore > 55 ? "buy" : overallScore < 45 ? "sell" : "neutral";

  return {
    price,
    timestamp: new Date().toISOString(),
    tfs: tfScans,
    overallBias,
    overallScore,
    indicators: INDICATOR_META,
  };
}
