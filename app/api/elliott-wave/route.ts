import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface WavePivot {
  index: number;
  price: number;
  date: string;
  type: "high" | "low";
  label: string;   // "0","1","2","3","4","5","A","B","C"
}

export interface WaveProjection {
  label: string;
  labelTh: string;
  price: number;
  fibRatio: number;
  type: "target" | "support";
}

export interface ElliottWavePayload {
  goldPrice: number;
  waveCount: string;          // "Wave 3 of 5" / "Wave C of ABC" etc.
  waveCountTh: string;
  wavePhase: "impulse" | "corrective" | "uncertain";
  wavePhaseTh: string;
  phaseColor: string;
  pivots: WavePivot[];
  projections: WaveProjection[];
  fibLevels: { ratio: string; price: number; label: string }[];
  implication: string;
  implicationTh: string;
  confidence: "high" | "medium" | "low";
  confidenceTh: string;
  confidenceColor: string;
  disclaimer: string;
  generatedAt: string;
}

async function fetchGoldDaily() {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=1y&interval=1d`;
    const r   = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

type YJ = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number|null)[]; high?: (number|null)[]; low?: (number|null)[] }> };
    }>;
  };
} | null;

// Zigzag pivot detection
function findPivots(hi: number[], lo: number[], ts: number[], lookback = 5): { idx: number; price: number; type: "high"|"low"; date: string }[] {
  const pivots: { idx: number; price: number; type: "high"|"low"; date: string }[] = [];
  for (let i = lookback; i < hi.length - lookback; i++) {
    const isHigh = hi.slice(i - lookback, i).every(h => h <= hi[i]) && hi.slice(i + 1, i + lookback + 1).every(h => h <= hi[i]);
    const isLow  = lo.slice(i - lookback, i).every(l => l >= lo[i]) && lo.slice(i + 1, i + lookback + 1).every(l => l >= lo[i]);
    if (isHigh) pivots.push({ idx: i, price: hi[i], type: "high", date: new Date(ts[i] * 1000).toISOString().slice(0, 10) });
    if (isLow)  pivots.push({ idx: i, price: lo[i], type: "low",  date: new Date(ts[i] * 1000).toISOString().slice(0, 10) });
  }
  // Deduplicate adjacent same-type pivots (keep strongest)
  const deduped: typeof pivots = [];
  for (const p of pivots) {
    const last = deduped.at(-1);
    if (!last || last.type !== p.type) {
      deduped.push(p);
    } else if (p.type === "high" && p.price > last.price) {
      deduped[deduped.length - 1] = p;
    } else if (p.type === "low" && p.price < last.price) {
      deduped[deduped.length - 1] = p;
    }
  }
  return deduped;
}

// Simple Elliott Wave counting heuristic
// Uses the last 5-6 pivots to guess the wave position
function countWaves(pivots: ReturnType<typeof findPivots>, spot: number): {
  waveCount: string; waveCountTh: string;
  wavePhase: "impulse"|"corrective"|"uncertain"; wavePhaseTh: string; phaseColor: string;
  wavePivots: WavePivot[];
  projections: WaveProjection[];
  fibLevels: { ratio: string; price: number; label: string }[];
  implication: string; implicationTh: string;
  confidence: "high"|"medium"|"low"; confidenceTh: string; confidenceColor: string;
} {
  const recent = pivots.slice(-8);

  // Need at least 5 pivots
  if (recent.length < 4) {
    return {
      waveCount: "Insufficient pivots", waveCountTh: "ข้อมูลไม่เพียงพอสำหรับ Wave count",
      wavePhase: "uncertain", wavePhaseTh: "ไม่แน่ชัด", phaseColor: "#f5c451",
      wavePivots: [], projections: [], fibLevels: [],
      implication: "Not enough pivot data",
      implicationTh: "ต้องการข้อมูลราคาเพิ่มเติม",
      confidence: "low", confidenceTh: "ต่ำ", confidenceColor: "#f87171",
    };
  }

  // Check direction of last move
  const last = recent.at(-1)!;
  const prev = recent.at(-2)!;
  const prev2 = recent.at(-3)!;
  const prev3 = recent.at(-4)!;

  const upTrend  = last.type === "high" && last.price > prev2.price && prev.price > prev3.price;
  const downTrend = last.type === "low"  && last.price < prev2.price && prev.price < prev3.price;

  // Fibonacci projections from last three pivots (wave 1-2-3 or A-B-C)
  const wave1Start = recent.at(-5)?.price ?? prev3.price;
  const wave1End   = prev3.price;
  const wave2End   = prev2.price;
  const wave3Start = wave2End;

  const move1 = Math.abs(wave1End - wave1Start);
  const wave3Target161 = wave3Start + move1 * 1.618;
  const wave3Target261 = wave3Start + move1 * 2.618;
  const wave4Support618 = wave3Start + (wave3Target161 - wave3Start) * 0.382;

  let waveCount: string;
  let waveCountTh: string;
  let wavePhase: "impulse"|"corrective"|"uncertain";
  let wavePhaseTh: string;
  let phaseColor: string;
  let implication: string;
  let implicationTh: string;
  let confidence: "high"|"medium"|"low";

  if (upTrend) {
    wavePhase = "impulse"; wavePhaseTh = "Impulse Wave — แนวโน้มขาขึ้น"; phaseColor = "#34d399";
    waveCount = "Potential Wave 3 (or 5) — Bullish Impulse";
    waveCountTh = "Wave 3 หรือ 5 — คลื่น Impulse ขาขึ้น";
    implication = "Impulse pattern suggests continuation of the bull trend. Wave 3 typically the strongest (1.618-2.618x W1).";
    implicationTh = "คลื่น Impulse แสดงว่าแนวโน้มขาขึ้นยังดำเนินต่อ Wave 3 มักแข็งแกร่งสุด";
    confidence = recent.length >= 6 ? "high" : "medium";
  } else if (downTrend) {
    wavePhase = "corrective"; wavePhaseTh = "Corrective Wave — ทองพักฐาน/ปรับตัว"; phaseColor = "#f87171";
    waveCount = "Potential Wave C (or 4) — Bearish Correction";
    waveCountTh = "Wave C หรือ 4 — คลื่น Corrective ขาลง";
    implication = "Corrective pattern — expect support at Fibonacci retracements. Wave C often equals Wave A in length.";
    implicationTh = "คลื่น Corrective — รอ support ที่ Fibonacci retracement Wave C มักเท่ากับ Wave A";
    confidence = "medium";
  } else {
    wavePhase = "uncertain"; wavePhaseTh = "ไม่แน่ชัด — กำลัง Consolidate"; phaseColor = "#f5c451";
    waveCount = "Consolidation / Sideways — Wave 4 or B";
    waveCountTh = "ทองอยู่ในกรอบ — น่าจะเป็น Wave 4 หรือ B";
    implication = "No clear impulse or corrective direction. Likely sideways Wave 4 or B consolidation before next move.";
    implicationTh = "ทิศทางไม่ชัด — น่าจะเป็นช่วงพัก Wave 4/B รอดู breakout";
    confidence = "low";
  }

  const wavePivots: WavePivot[] = recent.slice(-6).map((p, i) => ({
    index: p.idx, price: +p.price.toFixed(0), date: p.date, type: p.type,
    label: ["0","1","2","3","4","5"][i] ?? String(i),
  }));

  const projections: WaveProjection[] = upTrend ? [
    { label: "Wave 3 Target (1.618)", labelTh: "เป้า Wave 3 (1.618x)", price: +wave3Target161.toFixed(0), fibRatio: 1.618, type: "target" },
    { label: "Wave 3 Target (2.618)", labelTh: "เป้า Wave 3 (2.618x)", price: +wave3Target261.toFixed(0), fibRatio: 2.618, type: "target" },
    { label: "Wave 4 Support (0.382)", labelTh: "Wave 4 Support (38.2%)", price: +wave4Support618.toFixed(0), fibRatio: 0.382, type: "support" },
  ] : [
    { label: "Wave C Target (100%)", labelTh: "เป้า Wave C (= Wave A)", price: +prev3.price.toFixed(0), fibRatio: 1.0, type: "support" },
    { label: "Wave C Target (1.618)", labelTh: "เป้า Wave C (161.8%)", price: +(prev3.price + (prev2.price - prev3.price) * 0.618).toFixed(0), fibRatio: 0.618, type: "support" },
  ];

  // Fibonacci retracements from last major move
  const swingHigh = Math.max(prev2.price, last.price, spot);
  const swingLow  = Math.min(prev3.price, prev.price);
  const swingRange = swingHigh - swingLow;
  const fibLevels = [
    { ratio: "23.6%", price: +(swingHigh - swingRange * 0.236).toFixed(0), label: "Fib 23.6%" },
    { ratio: "38.2%", price: +(swingHigh - swingRange * 0.382).toFixed(0), label: "Fib 38.2%" },
    { ratio: "50.0%", price: +(swingHigh - swingRange * 0.500).toFixed(0), label: "Fib 50%" },
    { ratio: "61.8%", price: +(swingHigh - swingRange * 0.618).toFixed(0), label: "Fib 61.8%" },
    { ratio: "78.6%", price: +(swingHigh - swingRange * 0.786).toFixed(0), label: "Fib 78.6%" },
  ];

  const confMap = { high: "สูง — Pattern ชัดเจน", medium: "ปานกลาง — ตีความได้หลายแบบ", low: "ต่ำ — ต้องยืนยันเพิ่ม" };
  const confColorMap = { high: "#34d399", medium: "#f5c451", low: "#f87171" };

  return {
    waveCount, waveCountTh, wavePhase, wavePhaseTh, phaseColor,
    wavePivots, projections, fibLevels,
    implication, implicationTh,
    confidence, confidenceTh: confMap[confidence], confidenceColor: confColorMap[confidence],
  };
}

let CACHE: { data: ElliottWavePayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const j   = await fetchGoldDaily();
    const obj = j as YJ;
    const q   = obj?.chart?.result?.[0]?.indicators?.quote?.[0];
    const hi  = (q?.high  ?? []).filter((c): c is number => c != null);
    const lo  = (q?.low   ?? []).filter((c): c is number => c != null);
    const ts  = obj?.chart?.result?.[0]?.timestamp ?? [];
    const spot = obj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? lo.at(-1) ?? 3200;

    const pivots = findPivots(hi, lo, ts, 5);
    const waveAnalysis = countWaves(pivots, spot);

    const { wavePivots, ...rest } = waveAnalysis;
    const data: ElliottWavePayload = {
      goldPrice: +spot.toFixed(0),
      ...rest,
      pivots: wavePivots,
      disclaimer: "Elliott Wave analysis is subjective. Multiple wave counts are often valid simultaneously. This is an automated heuristic, not professional wave analysis.",
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
