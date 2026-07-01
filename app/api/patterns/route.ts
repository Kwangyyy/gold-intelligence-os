import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type PatternSignal = "bullish" | "bearish" | "neutral";
export type PatternStrength = "strong" | "moderate" | "weak";

export interface CandlePattern {
  name: string;
  nameTh: string;
  type: "single" | "double" | "triple";
  signal: PatternSignal;
  strength: PatternStrength;
  description: string;
  descriptionTh: string;
  reliability: number;   // 0-100
  candles: number[];     // indices (from end) of candles involved
  price: number;         // reference price for display
}

export interface PatternCandle {
  date: string;
  o: number;
  h: number;
  l: number;
  c: number;
  body: number;
  bodyPct: number;
  range: number;
  upperWick: number;
  lowerWick: number;
  bullish: boolean;
}

export interface PatternsPayload {
  price: number;
  candles: PatternCandle[];
  patterns: CandlePattern[];
  overallSignal: PatternSignal;
  bullCount: number;
  bearCount: number;
  generatedAt: string;
}

type Candle = { o: number; h: number; l: number; c: number };

function body(c: Candle) { return Math.abs(c.c - c.o); }
function range(c: Candle) { return c.h - c.l; }
function upperWick(c: Candle) { return c.h - Math.max(c.o, c.c); }
function lowerWick(c: Candle) { return Math.min(c.o, c.c) - c.l; }
function bullish(c: Candle) { return c.c > c.o; }
function doji(c: Candle) { return body(c) < range(c) * 0.1; }
function marubozu(c: Candle) { return body(c) > range(c) * 0.85; }

function detectPatterns(candles: Candle[]): CandlePattern[] {
  const patterns: CandlePattern[] = [];
  const n = candles.length;
  if (n < 3) return patterns;

  const c = candles.at(-1)!;
  const p = candles.at(-2)!;
  const pp = candles.at(-3)!;
  const avgRange = candles.slice(-10).reduce((a, x) => a + range(x), 0) / 10;

  // 1. Doji
  if (doji(c)) {
    patterns.push({
      name: "Doji", nameTh: "Doji (ดอจิ)",
      type: "single", signal: "neutral",
      strength: body(c) < range(c) * 0.05 ? "strong" : "moderate",
      description: "Open and close nearly equal — market indecision. Next candle direction is key.",
      descriptionTh: "ราคาเปิดและปิดเกือบเท่ากัน แสดงความลังเลของตลาด ต้องรอทิศทางแท่งถัดไป",
      reliability: 55,
      candles: [n - 1],
      price: c.c,
    });
  }

  // 2. Hammer
  const hammerCondition =
    lowerWick(c) > body(c) * 2 &&
    upperWick(c) < body(c) * 0.5 &&
    range(c) > avgRange * 0.6;
  if (hammerCondition && !doji(c)) {
    const isBullPrev = bullish(p) ? false : true;
    patterns.push({
      name: "Hammer", nameTh: "Hammer (ค้อน)",
      type: "single", signal: "bullish",
      strength: lowerWick(c) > body(c) * 3 ? "strong" : "moderate",
      description: "Long lower wick shows buyers rejected lower prices — potential reversal to upside.",
      descriptionTh: "ไส้เทียนด้านล่างยาว แสดงว่าแรงซื้อปฏิเสธราคาต่ำ — อาจกลับตัวขึ้น",
      reliability: isBullPrev ? 65 : 72,
      candles: [n - 1],
      price: c.c,
    });
  }

  // 3. Shooting Star
  const shootingStarCondition =
    upperWick(c) > body(c) * 2 &&
    lowerWick(c) < body(c) * 0.5 &&
    range(c) > avgRange * 0.6;
  if (shootingStarCondition && !doji(c)) {
    patterns.push({
      name: "Shooting Star", nameTh: "Shooting Star (ดาวตก)",
      type: "single", signal: "bearish",
      strength: upperWick(c) > body(c) * 3 ? "strong" : "moderate",
      description: "Long upper wick shows sellers rejected higher prices — potential reversal to downside.",
      descriptionTh: "ไส้เทียนด้านบนยาว แสดงว่าแรงขายปฏิเสธราคาสูง — อาจกลับตัวลง",
      reliability: 68,
      candles: [n - 1],
      price: c.c,
    });
  }

  // 4. Bullish Engulfing
  if (!bullish(p) && bullish(c) && c.o < p.c && c.c > p.o && body(c) > body(p) * 1.2) {
    patterns.push({
      name: "Bullish Engulfing", nameTh: "Bullish Engulfing (กลืนกินขาขึ้น)",
      type: "double", signal: "bullish",
      strength: body(c) > body(p) * 1.8 ? "strong" : "moderate",
      description: "Current bullish candle fully engulfs prior bearish candle — strong reversal signal.",
      descriptionTh: "แท่งบวกกลืนกินแท่งลบก่อนหน้าทั้งหมด — สัญญาณกลับตัวขึ้นที่แข็งแกร่ง",
      reliability: 75,
      candles: [n - 2, n - 1],
      price: c.c,
    });
  }

  // 5. Bearish Engulfing
  if (bullish(p) && !bullish(c) && c.o > p.c && c.c < p.o && body(c) > body(p) * 1.2) {
    patterns.push({
      name: "Bearish Engulfing", nameTh: "Bearish Engulfing (กลืนกินขาลง)",
      type: "double", signal: "bearish",
      strength: body(c) > body(p) * 1.8 ? "strong" : "moderate",
      description: "Current bearish candle fully engulfs prior bullish candle — strong reversal signal.",
      descriptionTh: "แท่งลบกลืนกินแท่งบวกก่อนหน้าทั้งหมด — สัญญาณกลับตัวลงที่แข็งแกร่ง",
      reliability: 75,
      candles: [n - 2, n - 1],
      price: c.c,
    });
  }

  // 6. Inside Bar
  if (c.h < p.h && c.l > p.l) {
    patterns.push({
      name: "Inside Bar", nameTh: "Inside Bar (แท่งในเทียน)",
      type: "double", signal: "neutral",
      strength: range(c) < range(p) * 0.5 ? "strong" : "weak",
      description: "Price consolidates inside prior candle — breakout expected; direction depends on trend.",
      descriptionTh: "ราคาอยู่ในกรอบของแท่งก่อนหน้า — รอ Breakout ทิศทางขึ้นอยู่กับ Trend หลัก",
      reliability: 60,
      candles: [n - 2, n - 1],
      price: c.c,
    });
  }

  // 7. Pin Bar (bullish — long lower wick)
  const pinBarBull =
    !doji(c) &&
    lowerWick(c) > range(c) * 0.6 &&
    body(c) < range(c) * 0.3 &&
    !hammerCondition;
  if (pinBarBull) {
    patterns.push({
      name: "Bullish Pin Bar", nameTh: "Bullish Pin Bar",
      type: "single", signal: "bullish",
      strength: lowerWick(c) > range(c) * 0.75 ? "strong" : "moderate",
      description: "Long lower tail with small body — buyers strongly rejected lower prices.",
      descriptionTh: "ไส้เทียนล่างยาวมาก Body เล็ก แสดงว่าแรงซื้อปฏิเสธราคาต่ำอย่างหนัก",
      reliability: 70,
      candles: [n - 1],
      price: c.c,
    });
  }

  // 8. Pin Bar (bearish — long upper wick)
  const pinBarBear =
    !doji(c) &&
    upperWick(c) > range(c) * 0.6 &&
    body(c) < range(c) * 0.3 &&
    !shootingStarCondition;
  if (pinBarBear) {
    patterns.push({
      name: "Bearish Pin Bar", nameTh: "Bearish Pin Bar",
      type: "single", signal: "bearish",
      strength: upperWick(c) > range(c) * 0.75 ? "strong" : "moderate",
      description: "Long upper tail with small body — sellers strongly rejected higher prices.",
      descriptionTh: "ไส้เทียนบนยาวมาก Body เล็ก แสดงว่าแรงขายปฏิเสธราคาสูงอย่างหนัก",
      reliability: 70,
      candles: [n - 1],
      price: c.c,
    });
  }

  // 9. Morning Star (3-candle bullish reversal)
  if (!bullish(pp) && body(pp) > avgRange * 0.4 &&
      body(p) < avgRange * 0.25 &&
      bullish(c) && body(c) > avgRange * 0.4 &&
      c.c > (pp.o + pp.c) / 2) {
    patterns.push({
      name: "Morning Star", nameTh: "Morning Star (ดาวรุ่ง)",
      type: "triple", signal: "bullish",
      strength: "strong",
      description: "3-candle reversal: bearish candle → small body gap → strong bullish candle.",
      descriptionTh: "3 แท่ง: แท่งลงใหญ่ → แท่งเล็ก Gap → แท่งขึ้นใหญ่ — สัญญาณกลับตัวขึ้นที่แข็งแกร่ง",
      reliability: 80,
      candles: [n - 3, n - 2, n - 1],
      price: c.c,
    });
  }

  // 10. Evening Star (3-candle bearish reversal)
  if (bullish(pp) && body(pp) > avgRange * 0.4 &&
      body(p) < avgRange * 0.25 &&
      !bullish(c) && body(c) > avgRange * 0.4 &&
      c.c < (pp.o + pp.c) / 2) {
    patterns.push({
      name: "Evening Star", nameTh: "Evening Star (ดาวค่ำ)",
      type: "triple", signal: "bearish",
      strength: "strong",
      description: "3-candle reversal: bullish candle → small body gap → strong bearish candle.",
      descriptionTh: "3 แท่ง: แท่งขึ้นใหญ่ → แท่งเล็ก Gap → แท่งลงใหญ่ — สัญญาณกลับตัวลงที่แข็งแกร่ง",
      reliability: 80,
      candles: [n - 3, n - 2, n - 1],
      price: c.c,
    });
  }

  // 11. Marubozu (strong trend candle)
  if (marubozu(c)) {
    patterns.push({
      name: bullish(c) ? "Bullish Marubozu" : "Bearish Marubozu",
      nameTh: bullish(c) ? "Bullish Marubozu (แท่งขึ้นไม่มีไส้)" : "Bearish Marubozu (แท่งลงไม่มีไส้)",
      type: "single", signal: bullish(c) ? "bullish" : "bearish",
      strength: "strong",
      description: `Strong ${bullish(c) ? "buying" : "selling"} pressure with almost no wicks — momentum continuation likely.`,
      descriptionTh: `แรง${bullish(c) ? "ซื้อ" : "ขาย"}แข็งแกร่ง แทบไม่มีไส้เทียน — Momentum มีโอกาสต่อเนื่อง`,
      reliability: 65,
      candles: [n - 1],
      price: c.c,
    });
  }

  return patterns;
}

let CACHE: { data: PatternsPayload; ts: number } | null = null;
const TTL = 10 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2mo&interval=1d&includePrePost=false";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error("No data");

    const q = result.indicators?.quote?.[0] ?? {};
    const timestamps: number[] = result.timestamp ?? [];
    const rawO: (number|null)[] = q.open  ?? [];
    const rawH: (number|null)[] = q.high  ?? [];
    const rawL: (number|null)[] = q.low   ?? [];
    const rawC: (number|null)[] = q.close ?? [];

    // Zip and filter nulls
    type Row = { date: string; o: number; h: number; l: number; c: number };
    const rows: Row[] = [];
    for (let i = 0; i < rawC.length; i++) {
      const o = rawO[i], h = rawH[i], l = rawL[i], c = rawC[i], ts = timestamps[i];
      if (o != null && h != null && l != null && c != null) {
        rows.push({ date: ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "", o, h, l, c });
      }
    }

    const last20 = rows.slice(-20);
    const price = result.meta?.regularMarketPrice ?? last20.at(-1)?.c ?? 0;
    const patterns = detectPatterns(last20);

    const bullCount = patterns.filter(p => p.signal === "bullish").length;
    const bearCount = patterns.filter(p => p.signal === "bearish").length;
    const overallSignal: PatternSignal = bullCount > bearCount ? "bullish" : bearCount > bullCount ? "bearish" : "neutral";

    const candles: PatternCandle[] = last20.slice(-12).map(r => ({
      date: r.date,
      o: r.o, h: r.h, l: r.l, c: r.c,
      body:      Math.abs(r.c - r.o),
      bodyPct:   (r.h - r.l) > 0 ? (Math.abs(r.c - r.o) / (r.h - r.l)) * 100 : 0,
      range:     r.h - r.l,
      upperWick: r.h - Math.max(r.o, r.c),
      lowerWick: Math.min(r.o, r.c) - r.l,
      bullish:   r.c > r.o,
    }));

    const data: PatternsPayload = {
      price, candles, patterns, overallSignal, bullCount, bearCount,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
