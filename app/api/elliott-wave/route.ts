import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export type ElliottTF = "1h" | "4h" | "1d" | "1w";

export interface WavePivot {
  index: number;        // index into the full source series
  seriesIndex: number;  // index into the returned (downsampled) chart series
  price: number;
  date: string;
  type: "high" | "low";
  label: string;   // "0","1","2","3","4","5","A","B","C"
  legPct: number;  // % move of this wave leg from the previous labeled pivot
}

export interface ZigzagPoint {
  i: number;            // index into returned chart series
  price: number;
  type: "high" | "low";
}

export interface WaveProjection {
  label: string;
  labelTh: string;
  price: number;
  fibRatio: number;
  type: "target" | "support";
}

export interface ElliottWavePayload {
  timeframe: ElliottTF;
  goldPrice: number;
  series: { t: number[]; o: number[]; h: number[]; l: number[]; c: number[] };  // OHLC candles
  zigzag: ZigzagPoint[];                   // full zigzag turning points (series indices)
  waveCount: string;
  waveCountTh: string;
  wavePhase: "impulse" | "corrective" | "uncertain";
  wavePhaseTh: string;
  phaseColor: string;
  pivots: WavePivot[];                     // labeled subset (wave count)
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

// Timeframe → Yahoo query + processing config.
// `deviation` = min % swing for the ZigZag to register a new wave pivot (bigger TF = bigger swings).
const TF_CONFIG: Record<ElliottTF, { range: string; interval: string; aggregate: number; deviation: number; maxBars: number }> = {
  "1h": { range: "1mo", interval: "60m", aggregate: 1, deviation: 1.2, maxBars: 120 },
  "4h": { range: "3mo", interval: "60m", aggregate: 4, deviation: 2.2, maxBars: 130 },
  "1d": { range: "1y",  interval: "1d",  aggregate: 1, deviation: 3.5, maxBars: 150 },
  "1w": { range: "5y",  interval: "1wk", aggregate: 1, deviation: 6.0, maxBars: 160 },
};

async function fetchGold(tf: ElliottTF) {
  const cfg = TF_CONFIG[tf];
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=${cfg.range}&interval=${cfg.interval}`;
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
      indicators?: { quote?: Array<{ open?: (number|null)[]; close?: (number|null)[]; high?: (number|null)[]; low?: (number|null)[] }> };
    }>;
  };
} | null;

// Aggregate 1h bars into Nh bars (e.g. 4h): group consecutive N bars into OHLC.
function aggregate(op: number[], hi: number[], lo: number[], cl: number[], ts: number[], n: number) {
  if (n <= 1) return { op, hi, lo, cl, ts };
  const O: number[] = [], H: number[] = [], L: number[] = [], C: number[] = [], T: number[] = [];
  for (let i = 0; i < cl.length; i += n) {
    const hSlice = hi.slice(i, i + n), lSlice = lo.slice(i, i + n), cSlice = cl.slice(i, i + n);
    if (!cSlice.length) break;
    O.push(op[i]);
    H.push(Math.max(...hSlice));
    L.push(Math.min(...lSlice));
    C.push(cSlice[cSlice.length - 1]);
    T.push(ts[i]);
  }
  return { op: O, hi: H, lo: L, cl: C, ts: T };
}

// Percentage-deviation ZigZag on candle highs/lows — the classic "wave measuring" indicator.
// Pivots sit on true swing extremes (candle wicks). Registers a new pivot only when price
// reverses from the running extreme by >= `pct`. Exactly one state branch runs per bar, so
// the % filter is respected (no spurious pivots).
function computeZigzag(hi: number[], lo: number[], ts: number[], pct: number) {
  const n = hi.length;
  const piv: { idx: number; price: number; type: "high"|"low"; date: string }[] = [];
  if (n < 3) return piv;
  const th = pct / 100;
  const dt = (i: number) => new Date((ts[i] ?? 0) * 1000).toISOString().slice(0, 10);
  const push = (idx: number, price: number, type: "high"|"low") =>
    piv.push({ idx, price: +price.toFixed(1), type, date: dt(idx) });

  let trend: 0 | 1 | -1 = 0;
  let extIdx = 0, extP = 0;                 // running extreme once trend is established
  let hiIdx = 0, hiP = hi[0];               // running high while seeking initial direction
  let loIdx = 0, loP = lo[0];               // running low while seeking initial direction

  for (let i = 1; i < n; i++) {
    if (trend === 0) {
      if (hi[i] > hiP) { hiP = hi[i]; hiIdx = i; }
      if (lo[i] < loP) { loP = lo[i]; loIdx = i; }
      if (lo[i] <= hiP * (1 - th)) {          // dropped off the peak → peak was a high
        push(hiIdx, hiP, "high"); trend = -1; extP = lo[i]; extIdx = i;
      } else if (hi[i] >= loP * (1 + th)) {   // rose off the trough → trough was a low
        push(loIdx, loP, "low"); trend = 1; extP = hi[i]; extIdx = i;
      }
    } else if (trend === 1) {                 // up: track running high
      if (hi[i] > extP) { extP = hi[i]; extIdx = i; }
      else if (lo[i] <= extP * (1 - th)) { push(extIdx, extP, "high"); trend = -1; extP = lo[i]; extIdx = i; }
    } else {                                  // down: track running low
      if (lo[i] < extP) { extP = lo[i]; extIdx = i; }
      else if (hi[i] >= extP * (1 + th)) { push(extIdx, extP, "low"); trend = 1; extP = hi[i]; extIdx = i; }
    }
  }
  // Commit the final running extreme so the zigzag reaches the latest swing
  push(extIdx, extP, trend >= 0 ? "high" : "low");

  // Drop a duplicate final pivot if the last two share an index
  if (piv.length >= 2 && piv[piv.length - 1].idx === piv[piv.length - 2].idx) piv.pop();
  return piv;
}

function countWaves(pivots: ReturnType<typeof computeZigzag>, spot: number) {
  const recent = pivots.slice(-8);

  if (recent.length < 4) {
    return {
      waveCount: "Insufficient pivots", waveCountTh: "ข้อมูลไม่เพียงพอสำหรับ Wave count",
      wavePhase: "uncertain" as const, wavePhaseTh: "ไม่แน่ชัด", phaseColor: "#f5c451",
      wavePivots: [] as WavePivot[], projections: [] as WaveProjection[], fibLevels: [] as { ratio: string; price: number; label: string }[],
      implication: "Not enough pivot data",
      implicationTh: "ต้องการข้อมูลราคาเพิ่มเติม (ลองเปลี่ยน Timeframe)",
      confidence: "low" as const, confidenceTh: "ต่ำ", confidenceColor: "#f87171",
    };
  }

  const last = recent.at(-1)!;
  const prev = recent.at(-2)!;
  const prev2 = recent.at(-3)!;
  const prev3 = recent.at(-4)!;

  const upTrend   = last.type === "high" && last.price > prev2.price && prev.price > prev3.price;
  const downTrend = last.type === "low"  && last.price < prev2.price && prev.price < prev3.price;

  const wave1Start = recent.at(-5)?.price ?? prev3.price;
  const wave1End   = prev3.price;
  const wave2End   = prev2.price;
  const wave3Start = wave2End;

  const move1 = Math.abs(wave1End - wave1Start);
  const wave3Target161 = wave3Start + move1 * 1.618;
  const wave3Target261 = wave3Start + move1 * 2.618;
  const wave4Support618 = wave3Start + (wave3Target161 - wave3Start) * 0.382;

  let waveCount: string, waveCountTh: string;
  let wavePhase: "impulse"|"corrective"|"uncertain", wavePhaseTh: string, phaseColor: string;
  let implication: string, implicationTh: string;
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

  // Label the last up-to-9 significant swings as an Elliott sequence (0-5, A-B-C)
  const LABELS = ["0","1","2","3","4","5","A","B","C"];
  const labeledPivots = pivots.slice(-LABELS.length);
  const wavePivots: WavePivot[] = labeledPivots.map((p, i) => {
    const prev = labeledPivots[i - 1];
    const legPct = prev ? ((p.price - prev.price) / prev.price) * 100 : 0;
    return {
      index: p.idx, seriesIndex: p.idx, price: +p.price.toFixed(0), date: p.date, type: p.type,
      label: LABELS[i] ?? String(i),
      legPct: +legPct.toFixed(1),
    };
  });

  const projections: WaveProjection[] = upTrend ? [
    { label: "Wave 3 Target (1.618)", labelTh: "เป้า Wave 3 (1.618x)", price: +wave3Target161.toFixed(0), fibRatio: 1.618, type: "target" },
    { label: "Wave 3 Target (2.618)", labelTh: "เป้า Wave 3 (2.618x)", price: +wave3Target261.toFixed(0), fibRatio: 2.618, type: "target" },
    { label: "Wave 4 Support (0.382)", labelTh: "Wave 4 Support (38.2%)", price: +wave4Support618.toFixed(0), fibRatio: 0.382, type: "support" },
  ] : [
    { label: "Wave C Target (100%)", labelTh: "เป้า Wave C (= Wave A)", price: +prev3.price.toFixed(0), fibRatio: 1.0, type: "support" },
    { label: "Wave C Target (1.618)", labelTh: "เป้า Wave C (161.8%)", price: +(prev3.price + (prev2.price - prev3.price) * 0.618).toFixed(0), fibRatio: 0.618, type: "support" },
  ];

  const swingHigh = Math.max(prev2.price, last.price, spot);
  const swingLow  = Math.min(prev3.price, prev.price);
  const swingRange = swingHigh - swingLow || 1;
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

const CACHE: Partial<Record<ElliottTF, { data: ElliottWavePayload; ts: number }>> = {};
const TTL = 30 * 60 * 1000; // 30 min

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tfParam = (url.searchParams.get("tf") ?? "1d") as ElliottTF;
  const tf: ElliottTF = ["1h","4h","1d","1w"].includes(tfParam) ? tfParam : "1d";

  const cached = CACHE[tf];
  if (cached && Date.now() - cached.ts < TTL) return NextResponse.json(cached.data);

  try {
    const cfg = TF_CONFIG[tf];
    const j   = await fetchGold(tf);
    const obj = j as YJ;
    const res = obj?.chart?.result?.[0];
    const q   = res?.indicators?.quote?.[0];

    // Align all OHLC arrays by dropping bars with any null field
    const rawO = q?.open  ?? [];
    const rawC = q?.close ?? [];
    const rawH = q?.high  ?? [];
    const rawL = q?.low   ?? [];
    const rawT = res?.timestamp ?? [];
    const op: number[] = [], hi: number[] = [], lo: number[] = [], cl: number[] = [], ts: number[] = [];
    for (let i = 0; i < rawC.length; i++) {
      if (rawO[i] == null || rawC[i] == null || rawH[i] == null || rawL[i] == null) continue;
      op.push(rawO[i] as number); cl.push(rawC[i] as number);
      hi.push(rawH[i] as number); lo.push(rawL[i] as number); ts.push(rawT[i] ?? 0);
    }

    // Aggregate (for 4h) then cap to maxBars
    const agg = aggregate(op, hi, lo, cl, ts, cfg.aggregate);
    const start = Math.max(0, agg.cl.length - cfg.maxBars);
    const sOp = agg.op.slice(start), sHi = agg.hi.slice(start), sLo = agg.lo.slice(start),
          sCl = agg.cl.slice(start), sTs = agg.ts.slice(start);

    const spot = res?.meta?.regularMarketPrice ?? sCl.at(-1) ?? 3200;

    const pivots = computeZigzag(sHi, sLo, sTs, cfg.deviation);
    const zigzag: ZigzagPoint[] = pivots.map(p => ({ i: p.idx, price: +p.price.toFixed(1), type: p.type }));
    const waveAnalysis = countWaves(pivots, spot);

    const { wavePivots, ...rest } = waveAnalysis;
    const data: ElliottWavePayload = {
      timeframe: tf,
      goldPrice: +spot.toFixed(0),
      series: {
        t: sTs,
        o: sOp.map(v => +v.toFixed(1)),
        h: sHi.map(v => +v.toFixed(1)),
        l: sLo.map(v => +v.toFixed(1)),
        c: sCl.map(v => +v.toFixed(1)),
      },
      zigzag,
      ...rest,
      pivots: wavePivots,
      disclaimer: "Elliott Wave analysis is subjective. Multiple wave counts are often valid simultaneously. This is an automated heuristic, not professional wave analysis.",
      generatedAt: new Date().toISOString(),
    };

    CACHE[tf] = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
