import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface BreakoutSignal {
  timeframe: string;
  timeframeTh: string;
  pattern: string;
  patternTh: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: number;         // 0-100
  breakoutLevel: number;    // key level to watch
  targetLevel: number;      // projected target
  stopLevel: number;        // suggested stop
  rr: number;               // R:R ratio
  description: string;
  descriptionTh: string;
  color: string;
}

export interface BreakoutScanPayload {
  goldPrice: number;
  scanTime: string;
  signals: BreakoutSignal[];
  overallBias: "bullish" | "bearish" | "neutral";
  overallBiasTh: string;
  overallBiasColor: string;
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  compositeStrength: number;   // 0-100 weighted average
  keyWatchLevel: number;       // most important breakout level now
  keyWatchTh: string;
  alertZone: string;           // "breakout_imminent" | "consolidating" | "trending"
  alertZoneTh: string;
  generatedAt: string;
}

async function fetchRange(symbol: string, range: string, interval: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

type YJ = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      indicators?: { quote?: Array<{ close?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; volume?: (number | null)[] }> };
    }>;
  };
} | null;

function parse(j: unknown) {
  const obj = j as YJ;
  const q    = obj?.chart?.result?.[0]?.indicators?.quote?.[0];
  const cls  = (q?.close  ?? []).filter((c): c is number => c != null);
  const hi   = (q?.high   ?? []).filter((c): c is number => c != null);
  const lo   = (q?.low    ?? []).filter((c): c is number => c != null);
  const spot = obj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? cls.at(-1) ?? 0;
  return { cls, hi, lo, spot };
}

function ema(arr: number[], p: number): number[] {
  if (arr.length < p) return arr.map(() => 0);
  const k = 2 / (p + 1);
  const out: number[] = [arr.slice(0, p).reduce((a, b) => a + b, 0) / p];
  for (let i = p; i < arr.length; i++) out.push(arr[i] * k + out.at(-1)! * (1 - k));
  return [...new Array(p - 1).fill(0), ...out];
}

function donchian(hi: number[], lo: number[], p: number) {
  const upper: number[] = [], lower: number[] = [];
  for (let i = 0; i < hi.length; i++) {
    const s = Math.max(0, i - p + 1);
    upper.push(Math.max(...hi.slice(s, i + 1)));
    lower.push(Math.min(...lo.slice(s, i + 1)));
  }
  return { upper, lower };
}

function atr(hi: number[], lo: number[], cls: number[], p = 14): number[] {
  const tr: number[] = hi.map((h, i) => {
    if (i === 0) return h - lo[i];
    return Math.max(h - lo[i], Math.abs(h - cls[i - 1]), Math.abs(lo[i] - cls[i - 1]));
  });
  const out: number[] = new Array(p).fill(tr.slice(0, p).reduce((a, b) => a + b, 0) / p);
  for (let i = p; i < tr.length; i++) out.push((out.at(-1)! * (p - 1) + tr[i]) / p);
  return out;
}

function analyzeBreakout(
  cls: number[], hi: number[], lo: number[], spot: number,
  tf: string, tfTh: string
): BreakoutSignal {
  if (cls.length < 20) {
    return {
      timeframe: tf, timeframeTh: tfTh,
      pattern: "Insufficient data", patternTh: "ข้อมูลไม่เพียงพอ",
      direction: "neutral", strength: 0,
      breakoutLevel: spot, targetLevel: spot, stopLevel: spot, rr: 0,
      description: "Need more data", descriptionTh: "ต้องการข้อมูลเพิ่ม",
      color: "#f5c451",
    };
  }

  const ema20 = ema(cls, 20);
  const ema50 = ema(cls, Math.min(50, cls.length - 1));
  const dc20  = donchian(hi, lo, 20);
  const atr14 = atr(hi, lo, cls, 14);

  const lastClose = cls.at(-1)!;
  const lastEma20 = ema20.at(-1)!;
  const lastEma50 = ema50.at(-1)!;
  const dcHigh    = dc20.upper.at(-1)!;
  const dcLow     = dc20.lower.at(-1)!;
  const lastAtr   = atr14.at(-1)!;
  const range     = dcHigh - dcLow;

  // Proximity to Donchian channel
  const distToHigh = (dcHigh - lastClose) / range;
  const distToLow  = (lastClose - dcLow)  / range;

  // Momentum: closes above EMA
  const recentAbove = cls.slice(-5).filter(c => c > lastEma20).length;
  const emaTrend    = lastEma20 > lastEma50 ? 1 : -1;

  let pattern: string, patternTh: string, direction: BreakoutSignal["direction"];
  let strength = 50;
  let breakoutLevel: number, targetLevel: number, stopLevel: number;

  if (distToHigh < 0.05) {
    // Near upper Donchian = potential upside breakout
    pattern   = "Donchian Channel Breakout (Upper)";
    patternTh = "ใกล้ทดสอบ High สุดสัปดาห์/เดือน — Breakout ขาขึ้น";
    direction = "bullish";
    strength  = 55 + recentAbove * 5 + (emaTrend > 0 ? 15 : -10);
    breakoutLevel = +dcHigh.toFixed(1);
    targetLevel   = +(dcHigh + range * 0.5).toFixed(1);
    stopLevel     = +(lastClose - lastAtr).toFixed(1);
  } else if (distToLow < 0.05) {
    pattern   = "Donchian Channel Breakdown (Lower)";
    patternTh = "ใกล้ทดสอบ Low สุดสัปดาห์/เดือน — ความเสี่ยง Breakdown";
    direction = "bearish";
    strength  = 55 + (5 - recentAbove) * 5 + (emaTrend < 0 ? 15 : -10);
    breakoutLevel = +dcLow.toFixed(1);
    targetLevel   = +(dcLow - range * 0.5).toFixed(1);
    stopLevel     = +(lastClose + lastAtr).toFixed(1);
  } else if (emaTrend > 0 && recentAbove >= 4) {
    pattern   = "EMA Trend Continuation";
    patternTh = "Trend ขาขึ้น — EMA20 > EMA50, ราคาเหนือ EMA20";
    direction = "bullish";
    strength  = 45 + recentAbove * 5;
    breakoutLevel = +lastEma20.toFixed(1);
    targetLevel   = +(dcHigh).toFixed(1);
    stopLevel     = +(lastEma20 - lastAtr).toFixed(1);
  } else if (emaTrend < 0 && recentAbove <= 1) {
    pattern   = "EMA Bearish Continuation";
    patternTh = "Trend ขาลง — EMA20 < EMA50, ราคาใต้ EMA20";
    direction = "bearish";
    strength  = 45 + (5 - recentAbove) * 5;
    breakoutLevel = +lastEma20.toFixed(1);
    targetLevel   = +(dcLow).toFixed(1);
    stopLevel     = +(lastEma20 + lastAtr).toFixed(1);
  } else {
    pattern   = "Consolidation — No Clear Breakout";
    patternTh = "ราคาอยู่ในกรอบ — รอสัญญาณชัดเจน";
    direction = "neutral";
    strength  = 30 + Math.floor(Math.random() * 15);
    breakoutLevel = +(dcHigh * 0.5 + dcLow * 0.5).toFixed(1);
    targetLevel   = breakoutLevel;
    stopLevel     = breakoutLevel;
  }

  strength = Math.min(100, Math.max(0, strength));
  const risk = Math.abs(spot - stopLevel);
  const reward = Math.abs(targetLevel - spot);
  const rr = risk > 0 ? +(reward / risk).toFixed(2) : 0;

  const color = direction === "bullish" ? "#34d399" : direction === "bearish" ? "#f87171" : "#f5c451";

  const descEn = `${pattern}. Price at $${lastClose.toFixed(1)}, EMA20=$${lastEma20.toFixed(1)}, ATR=$${lastAtr.toFixed(1)}. Breakout level: $${breakoutLevel}.`;
  const descTh = `${patternTh} ราคา $${lastClose.toFixed(1)}, EMA20 $${lastEma20.toFixed(1)}, ATR $${lastAtr.toFixed(1)}. ระดับ Breakout: $${breakoutLevel}`;

  return {
    timeframe: tf, timeframeTh: tfTh, pattern, patternTh,
    direction, strength, breakoutLevel, targetLevel, stopLevel, rr,
    description: descEn, descriptionTh: descTh, color,
  };
}

let CACHE: { data: BreakoutScanPayload; ts: number } | null = null;
const TTL = 10 * 60 * 1000; // 10m

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [j1h, j4h, j1d, j1w] = await Promise.all([
      fetchRange("GC%3DF", "5d",  "1h"),
      fetchRange("GC%3DF", "60d", "1d"),  // proxy 4h with 1d data
      fetchRange("GC%3DF", "90d", "1d"),
      fetchRange("GC%3DF", "2y",  "1wk"),
    ]);

    const p1h = parse(j1h);
    const p4h = parse(j4h);
    const p1d = parse(j1d);
    const p1w = parse(j1w);

    const spot = p1d.spot || p1h.spot || 3200;

    const signals: BreakoutSignal[] = [
      analyzeBreakout(p1h.cls, p1h.hi, p1h.lo, spot, "1H",      "1 ชั่วโมง"),
      analyzeBreakout(p4h.cls.slice(-40), p4h.hi.slice(-40), p4h.lo.slice(-40), spot, "4H",      "4 ชั่วโมง (proxy)"),
      analyzeBreakout(p1d.cls, p1d.hi, p1d.lo, spot, "Daily",   "รายวัน"),
      analyzeBreakout(p1w.cls, p1w.hi, p1w.lo, spot, "Weekly",  "รายสัปดาห์"),
    ];

    const bullCount    = signals.filter(s => s.direction === "bullish").length;
    const bearCount    = signals.filter(s => s.direction === "bearish").length;
    const neutralCount = signals.filter(s => s.direction === "neutral").length;

    const overallBias  = bullCount > bearCount ? "bullish" : bearCount > bullCount ? "bearish" : "neutral";
    const compositeStr = Math.round(signals.reduce((a, s) => a + s.strength, 0) / signals.length);

    // Find the most imminent breakout level
    const urgentSignal = signals
      .filter(s => s.direction !== "neutral")
      .sort((a, b) => b.strength - a.strength)[0];
    const keyWatchLevel = urgentSignal?.breakoutLevel ?? spot;
    const keyWatchTh    = urgentSignal
      ? `$${keyWatchLevel} — ${urgentSignal.timeframeTh} Breakout Level`
      : `$${spot.toFixed(0)} — ราคาปัจจุบัน`;

    const nearBreakout = signals.some(s => s.strength > 70 && s.direction !== "neutral");
    const trending     = signals.filter(s => s.direction !== "neutral").length >= 3;
    const alertZone    = nearBreakout ? "breakout_imminent" : trending ? "trending" : "consolidating";
    const alertZoneTh  = alertZone === "breakout_imminent"
      ? "Breakout ใกล้เกิดขึ้น — ระวัง!"
      : alertZone === "trending"
      ? "อยู่ใน Trend ชัดเจน"
      : "ทองอยู่ในกรอบ Consolidation";

    const data: BreakoutScanPayload = {
      goldPrice: +spot.toFixed(0),
      scanTime: new Date().toISOString(),
      signals,
      overallBias, overallBiasTh: overallBias === "bullish" ? "Bullish — สัญญาณขาขึ้น" : overallBias === "bearish" ? "Bearish — สัญญาณขาลง" : "Neutral — Mixed",
      overallBiasColor: overallBias === "bullish" ? "#34d399" : overallBias === "bearish" ? "#f87171" : "#f5c451",
      bullCount, bearCount, neutralCount, compositeStrength: compositeStr,
      keyWatchLevel, keyWatchTh, alertZone, alertZoneTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
