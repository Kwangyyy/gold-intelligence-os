// Support & Resistance engine (Module 5). Collects candidate levels from many
// sources, clusters nearby ones into confluence zones, and ranks them. Server-side.

import {
  atr as calcAtr,
  donchian,
  ema,
  fibRetracement,
  pivotPoints,
  type Candle,
} from "./indicators";
import { fetchCandles } from "./timeframes";
import type { Bilingual, SRLevel, SupportResistance } from "./types";

interface Candidate {
  price: number;
  source: string; // i18n key
  weight: number;
}

// Fractal swing highs/lows (a high/low that exceeds its `lb` neighbours each side).
function swings(candles: Candle[], lb = 3): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = lb; i < candles.length - lb; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lb; j <= i + lb; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) highs.push(candles[i].high);
    if (isLow) lows.push(candles[i].low);
  }
  return { highs, lows };
}

// Volume Point of Control: price bin (across the window) holding the most volume.
function volumePoc(candles: Candle[], bins = 50): number | null {
  const withVol = candles.filter((c) => c.volume != null && c.volume > 0);
  if (withVol.length < 20) return null;
  const prices = withVol.map((c) => (c.high + c.low + c.close) / 3);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max <= min) return null;
  const step = (max - min) / bins;
  const buckets = new Array(bins).fill(0);
  for (const c of withVol) {
    const tp = (c.high + c.low + c.close) / 3;
    const idx = Math.min(bins - 1, Math.floor((tp - min) / step));
    buckets[idx] += c.volume as number;
  }
  let best = 0;
  for (let i = 1; i < bins; i++) if (buckets[i] > buckets[best]) best = i;
  return min + (best + 0.5) * step;
}

// Clusters sorted candidates within `radius` into confluence zones.
function cluster(candidates: Candidate[], radius: number): { price: number; sources: string[]; weight: number }[] {
  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  const zones: { members: Candidate[] }[] = [];
  for (const c of sorted) {
    const last = zones[zones.length - 1];
    if (last) {
      const mean = last.members.reduce((s, m) => s + m.price, 0) / last.members.length;
      if (Math.abs(c.price - mean) <= radius) {
        last.members.push(c);
        continue;
      }
    }
    zones.push({ members: [c] });
  }
  return zones.map((z) => {
    const totalW = z.members.reduce((s, m) => s + m.weight, 0);
    const price = z.members.reduce((s, m) => s + m.price * m.weight, 0) / totalW;
    const sources = Array.from(new Set(z.members.map((m) => m.source)));
    return { price, sources, weight: totalW };
  });
}

export async function buildSupportResistance(): Promise<SupportResistance> {
  // Daily for most levels, weekly/monthly for prior H/L, 60m for price + volume.
  const [daily, weekly, monthly, intraday] = await Promise.all([
    fetchCandles("1d", "2y"),
    fetchCandles("1wk", "5y"),
    fetchCandles("1mo", "max"),
    fetchCandles("60m", "6mo"),
  ]);

  if (daily.length < 60 || intraday.length < 30) throw new Error("insufficient data");

  const price = intraday[intraday.length - 1].close;
  const dAtr = calcAtr(daily, 14) ?? price * 0.01;
  const radius = Math.max(price * 0.0015, dAtr * 0.3);

  const cand: Candidate[] = [];
  const add = (p: number | null | undefined, source: string, weight: number) => {
    if (p != null && Number.isFinite(p) && p > 0) cand.push({ price: p, source, weight });
  };

  // Pivot points from the previous completed day.
  const pd = daily[daily.length - 2];
  if (pd) {
    const piv = pivotPoints(pd.high, pd.low, pd.close);
    add(piv.pivot, "src_pivot", 2);
    add(piv.r1, "src_pivot", 2);
    add(piv.s1, "src_pivot", 2);
    add(piv.r2, "src_pivot", 1);
    add(piv.s2, "src_pivot", 1);
    add(piv.r3, "src_pivot", 1);
    add(piv.s3, "src_pivot", 1);
  }

  // Prior period highs/lows (higher timeframe = stronger).
  if (pd) {
    add(pd.high, "src_daily", 2);
    add(pd.low, "src_daily", 2);
  }
  const pw = weekly[weekly.length - 2];
  if (pw) {
    add(pw.high, "src_weekly", 3);
    add(pw.low, "src_weekly", 3);
  }
  const pm = monthly[monthly.length - 2];
  if (pm) {
    add(pm.high, "src_monthly", 4);
    add(pm.low, "src_monthly", 4);
  }

  // Fibonacci retracement of the recent daily swing.
  const fib = fibRetracement(daily, 120);
  if (fib) {
    add(fib.levels[2].price, "src_fib", 1); // 0.382
    add(fib.levels[3].price, "src_fib", 2); // 0.5
    add(fib.levels[4].price, "src_fib", 2); // 0.618
    add(fib.high, "src_fib", 1);
    add(fib.low, "src_fib", 1);
  }

  // EMA dynamic support/resistance (daily).
  const closes = daily.map((c) => c.close);
  add(ema(closes, 50), "src_ema", 2);
  add(ema(closes, 200), "src_ema", 3);

  // Donchian extremes (daily, 20).
  const don = donchian(daily, 20);
  if (don) {
    add(don.upper, "src_donchian", 2);
    add(don.lower, "src_donchian", 2);
  }

  // Recent swing highs/lows (daily) — proxy for order blocks / structure.
  const sw = swings(daily.slice(-80), 3);
  sw.highs.slice(-4).forEach((h) => add(h, "src_swing", 2));
  sw.lows.slice(-4).forEach((l) => add(l, "src_swing", 2));

  // Volume Point of Control (recent 60m volume).
  add(volumePoc(intraday.slice(-600)), "src_poc", 3);

  // Cluster into zones and split by side of current price.
  const zones = cluster(cand, radius);
  const maxW = Math.max(...zones.map((z) => z.weight), 1);

  const toLevel = (z: { price: number; sources: string[]; weight: number }, side: "support" | "resistance"): SRLevel => ({
    price: +z.price.toFixed(2),
    side,
    sources: z.sources,
    strength: Math.round((z.weight / maxW) * 100),
    distancePct: +(((z.price - price) / price) * 100).toFixed(2),
  });

  const resistances = zones
    .filter((z) => z.price > price)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map((z) => toLevel(z, "resistance"));

  const supports = zones
    .filter((z) => z.price <= price)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)
    .map((z) => toLevel(z, "support"));

  // Key level = strongest confluence among the nearest levels each side.
  const nearby = [...resistances, ...supports];
  let keyLevel: SupportResistance["keyLevel"] = null;
  if (nearby.length) {
    const top = nearby.reduce((a, b) => (b.strength > a.strength ? b : a));
    keyLevel = {
      price: top.price,
      side: top.side,
      sources: top.sources,
      reason: keyReason(top),
    };
  }

  return {
    symbol: "XAUUSD",
    source: "Yahoo Finance · COMEX GC=F",
    price: +price.toFixed(2),
    resistances,
    supports,
    keyLevel,
    timestamp: new Date().toISOString(),
  };
}

function keyReason(level: SRLevel): Bilingual {
  const n = level.sources.length;
  const sideTh = level.side === "resistance" ? "แนวต้าน" : "แนวรับ";
  const sideEn = level.side === "resistance" ? "resistance" : "support";
  return {
    th: `${level.price.toLocaleString()} เป็น${sideTh}ที่สำคัญที่สุด เพราะมีจุดบรรจบกันถึง ${n} แหล่ง ทำให้เป็นโซนที่ราคามักตอบสนอง`,
    en: `${level.price.toLocaleString()} is the most important ${sideEn} — it has confluence from ${n} sources, so price tends to react there.`,
  };
}
