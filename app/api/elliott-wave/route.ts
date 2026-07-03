import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export type ElliottTF = "15m" | "1h" | "4h" | "1d" | "1w";

// A NeoWave (Glenn Neely) rule check — rule-based verification, the core of NeoWave rigor.
export interface NeelyRule {
  name: string;
  nameTh: string;
  status: "pass" | "fail" | "info";
  detail: string;
}

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
  method: "NeoWave";
  structure: "impulse" | "terminal" | "zigzag" | "flat" | "triangle" | "complex" | "unclear";
  structureLabel: string;
  structureLabelTh: string;
  currentWave: string;
  currentWaveTh: string;
  neelyRules: NeelyRule[];
  extension: string;         // which wave extended (impulse) or ""
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
  "15m":{ range: "5d",  interval: "15m", aggregate: 1, deviation: 0.6, maxBars: 200 },
  "1h": { range: "1mo", interval: "60m", aggregate: 1, deviation: 1.2, maxBars: 200 },
  "4h": { range: "3mo", interval: "60m", aggregate: 4, deviation: 2.2, maxBars: 200 },
  "1d": { range: "1y",  interval: "1d",  aggregate: 1, deviation: 3.5, maxBars: 260 },
  "1w": { range: "5y",  interval: "1wk", aggregate: 1, deviation: 6.0, maxBars: 260 },
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

// ── NeoWave (Glenn Neely) analysis ────────────────────────────────────────────
// Unlike the classic Elliott Wave Principle (which starts by assuming a 5-3 shape),
// NeoWave builds up from monowaves and *verifies* structure with strict rules:
// the Rule of Retracement, non-overlap, "wave 3 never shortest", extension (only one
// wave extends), and the Rule of Similarity & Balance (adjacent waves alike in price/time).
type Zig = ReturnType<typeof computeZigzag>[number];
interface Monowave { from: Zig; to: Zig; move: number; abs: number; absPct: number; bars: number; up: boolean; }

function buildMonowaves(pivots: Zig[]): Monowave[] {
  const m: Monowave[] = [];
  for (let i = 0; i < pivots.length - 1; i++) {
    const from = pivots[i], to = pivots[i + 1];
    const move = to.price - from.price;
    m.push({ from, to, move, abs: Math.abs(move), absPct: Math.abs(move / from.price * 100), bars: Math.max(1, to.idx - from.idx), up: move > 0 });
  }
  return m;
}

function analyzeNeoWave(pivots: Zig[], spot: number) {
  const confMap = { high: "สูง — โครงสร้างผ่านกฎ NeoWave ชัดเจน", medium: "ปานกลาง — เข้ากฎบางส่วน", low: "ต่ำ — ยังไม่ครบเงื่อนไข" };
  const confColorMap = { high: "#34d399", medium: "#f5c451", low: "#f87171" };
  const pct = (x: number) => `${Math.round(x)}%`;

  const empty = {
    method: "NeoWave" as const, structure: "unclear" as const,
    structureLabel: "Insufficient data", structureLabelTh: "ข้อมูลไม่พอวิเคราะห์ NeoWave",
    currentWave: "-", currentWaveTh: "ต้องการข้อมูลเพิ่ม (ลองเปลี่ยน Timeframe)",
    neelyRules: [] as NeelyRule[], extension: "",
    waveCount: "Insufficient pivots", waveCountTh: "ข้อมูลไม่เพียงพอ",
    wavePhase: "uncertain" as const, wavePhaseTh: "ไม่แน่ชัด", phaseColor: "#f5c451",
    wavePivots: [] as WavePivot[], projections: [] as WaveProjection[],
    fibLevels: [] as { ratio: string; price: number; label: string }[],
    implication: "Not enough monowaves for NeoWave analysis.",
    implicationTh: "monowave ไม่พอสำหรับวิเคราะห์ NeoWave",
    confidence: "low" as const, confidenceTh: confMap.low, confidenceColor: confColorMap.low,
  };

  const mono = buildMonowaves(pivots);
  if (mono.length < 3) return empty;

  const rules: NeelyRule[] = [];
  let structure: ElliottWavePayload["structure"] = "unclear";
  let structureLabel = "", structureLabelTh = "";
  let phaseColor = "#f5c451", extension = "";
  let confidence: "high" | "medium" | "low" = "low";
  let labels: string[] = [];        // labels for the trailing pivots (oldest→newest)
  let projections: WaveProjection[] = [];
  let implication = "", implicationTh = "", currentWave = "", currentWaveTh = "";

  // Candidate impulse: last 5 monowaves = 1,2,3,4,5
  let impulseScore = -1, imp: (Monowave[]) | null = null, terminal = false, impExt = "";
  if (mono.length >= 5) {
    const w = mono.slice(-5);
    const [w1, w2, w3, w4, w5] = w;
    const dirOK = w1.up === w3.up && w3.up === w5.up && w2.up !== w1.up && w4.up !== w3.up;
    const r2 = w2.abs / (w1.abs || 1);            // Rule of Retracement (wave 2 of wave 1)
    const r4 = w4.abs / (w3.abs || 1);
    const up = w1.up;
    const overlap = up ? (w4.to.price <= w1.to.price) : (w4.to.price >= w1.to.price);
    const w3Shortest = w3.abs < w1.abs && w3.abs < w5.abs;
    const r2ok = r2 > 0 && r2 < 1;
    if (dirOK && r2ok && !w3Shortest) {
      terminal = overlap;
      // score: base + retrace-in-band + clear extension + alternation
      const extended = Math.max(w1.abs, w3.abs, w5.abs);
      const extLabel = extended === w3.abs ? "3" : extended === w1.abs ? "1" : "5";
      const oneExtends = extended >= 1.5 * [w1.abs, w3.abs, w5.abs].filter(x => x !== extended).reduce((a, b) => Math.max(a, b), 0);
      impulseScore = 2 + (r2 >= 0.382 && r2 <= 0.618 ? 1 : 0) + (oneExtends ? 1 : 0) + (Math.abs(r2 - r4) > 0.15 ? 0.5 : 0) - (overlap ? 1 : 0);
      imp = w; impExt = extLabel;
    }
  }

  // Candidate correction: last 3 monowaves = a,b,c
  let corrScore = -1, corr: (Monowave[]) | null = null, corrType: ElliottWavePayload["structure"] = "zigzag";
  if (mono.length >= 3) {
    const w = mono.slice(-3);
    const [a, b, c] = w;
    const dirOK = a.up !== b.up && b.up !== c.up;
    if (dirOK) {
      const rb = b.abs / (a.abs || 1);            // b retraces a
      const rc = c.abs / (a.abs || 1);            // c vs a
      if (rb >= 0.8 && rb <= 1.20 && rc >= 0.9 && rc <= 1.4) { corrType = "flat"; corrScore = 2.2; }
      else if (rb <= 0.7 && rc >= 0.9) { corrType = "zigzag"; corrScore = 2; }
      else { corrType = "complex"; corrScore = 1; }
      corr = w;
    }
    // Triangle: last 5 legs each smaller than the one two-before (converging)
    if (mono.length >= 5) {
      const t = mono.slice(-5);
      if (t[0].abs > t[2].abs && t[2].abs > t[4].abs && t[1].abs > t[3].abs) { corrType = "triangle"; corrScore = Math.max(corrScore, 2.4); corr = t; }
    }
  }

  const useImpulse = imp && impulseScore >= corrScore;

  if (useImpulse && imp) {
    const [w1, w2, w3, w4, w5] = imp;
    const up = w1.up;
    extension = impExt;
    structure = terminal ? "terminal" : "impulse";
    phaseColor = up ? "#34d399" : "#f87171";
    structureLabel = terminal ? `Terminal / Diagonal (5-wave, wave ${extension} extended)` : `Impulse (5-wave, wave ${extension} extended)`;
    structureLabelTh = terminal
      ? `Terminal/Diagonal — impulse ที่คลื่น 4 ทับคลื่น 1 (${up ? "ขาขึ้น" : "ขาลง"})`
      : `Impulse 5 คลื่น — คลื่น ${extension} ยืดตัว (${up ? "ขาขึ้น" : "ขาลง"})`;
    labels = ["0", "1", "2", "3", "4", "5"];

    const r2 = w2.abs / (w1.abs || 1);
    const r4 = w4.abs / (w3.abs || 1);
    rules.push({
      name: "Rule of Retracement", nameTh: "กฎการรีเทรซ (คลื่น 2 ต่อคลื่น 1)",
      status: r2 > 0 && r2 < 1 ? "pass" : "fail",
      detail: `Wave 2 retraced ${pct(r2 * 100)} of Wave 1 — ${r2 < 0.382 ? "shallow → strong trend, expect extension" : r2 <= 0.618 ? "healthy impulse (38-62%)" : "deep → weaker impulse / possible correction"}`,
    });
    rules.push({
      name: "Wave 3 never the shortest", nameTh: "คลื่น 3 ต้องไม่สั้นที่สุด",
      status: (w3.abs >= w1.abs || w3.abs >= w5.abs) ? "pass" : "fail",
      detail: `W1 ${w1.absPct.toFixed(1)}% · W3 ${w3.absPct.toFixed(1)}% · W5 ${w5.absPct.toFixed(1)}%`,
    });
    rules.push({
      name: "Wave 4 non-overlap with Wave 1", nameTh: "คลื่น 4 ต้องไม่ทับเขตคลื่น 1",
      status: terminal ? "fail" : "pass",
      detail: terminal ? "Wave 4 entered Wave 1 territory → Terminal/Diagonal (not a normal impulse)" : "Wave 4 stayed clear of Wave 1 → valid impulse",
    });
    rules.push({
      name: "Rule of Alternation", nameTh: "กฎการสลับ (คลื่น 2 vs 4)",
      status: "info",
      detail: `Wave 2 depth ${pct(r2 * 100)} vs Wave 4 depth ${pct(r4 * 100)} — ${Math.abs(r2 - r4) > 0.15 ? "different (healthy alternation)" : "similar (weak alternation)"}`,
    });
    rules.push({
      name: "Extension (only one wave)", nameTh: "การยืดตัว (ยืดเพียงคลื่นเดียว)",
      status: "info", detail: `Wave ${extension} is the extended wave`,
    });

    // Current position + NeoWave targets
    const w3Start = w2.to.price, w1len = w1.abs;
    const t1 = up ? w3Start + w1len * 1.618 : w3Start - w1len * 1.618;
    const t2 = up ? w3Start + w1len * 2.618 : w3Start - w1len * 2.618;
    const w5t = up ? w4.to.price + w1len : w4.to.price - w1len;   // W5 often ≈ W1
    if (spot >= Math.min(w4.from.price, w4.to.price) && spot <= Math.max(w4.from.price, w4.to.price)) {
      currentWave = "In Wave 4 (correction) → Wave 5 next"; currentWaveTh = "อยู่ในคลื่น 4 (พักตัว) → รอคลื่น 5";
    } else {
      currentWave = "Wave 5 complete → expect A-B-C correction"; currentWaveTh = "คลื่น 5 ใกล้จบ → เตรียมรับ correction A-B-C";
    }
    projections = [
      { label: "Wave 3 ext (1.618×W1)", labelTh: "เป้าคลื่น 3 (1.618×W1)", price: +t1.toFixed(0), fibRatio: 1.618, type: "target" },
      { label: "Wave 3 ext (2.618×W1)", labelTh: "เป้าคลื่น 3 (2.618×W1)", price: +t2.toFixed(0), fibRatio: 2.618, type: "target" },
      { label: "Wave 5 ≈ Wave 1", labelTh: "เป้าคลื่น 5 (≈ คลื่น 1)", price: +w5t.toFixed(0), fibRatio: 1.0, type: "target" },
    ];
    implication = terminal
      ? "Terminal/diagonal implies the trend is exhausting — a sharp reversal usually follows the 5th wave."
      : `Valid NeoWave impulse. Wave ${extension} extension confirms trend strength; watch for a completing 5th wave then reversal.`;
    implicationTh = terminal
      ? "Terminal/Diagonal = เทรนด์กำลังหมดแรง มักตามด้วยการกลับตัวแรงหลังจบคลื่น 5"
      : `Impulse ตามกฎ NeoWave สมบูรณ์ · คลื่น ${extension} ยืดตัวยืนยันความแข็งแรงของเทรนด์ · ระวังจบคลื่น 5 แล้วกลับตัว`;
    confidence = impulseScore >= 3.5 ? "high" : impulseScore >= 2.5 ? "medium" : "low";
  } else if (corr) {
    const isTriangle = corrType === "triangle";
    const a = corr[0], last = corr[corr.length - 1];
    const up = last.up;
    structure = corrType;
    phaseColor = "#f5c451";
    const names: Record<string, [string, string]> = {
      zigzag:  ["Zigzag correction (5-3-5, A-B-C)", "Zigzag correction (A-B-C, ชัน)"],
      flat:    ["Flat correction (3-3-5, A-B-C)", "Flat correction (A-B-C, แนวราบ)"],
      triangle:["Triangle (A-B-C-D-E, contracting)", "Triangle 5 ขา (A-B-C-D-E, หดตัว)"],
      complex: ["Complex correction (combination)", "Complex correction (แบบผสม)"],
    };
    [structureLabel, structureLabelTh] = names[corrType] ?? names.complex;
    labels = isTriangle ? ["0", "A", "B", "C", "D", "E"] : ["0", "A", "B", "C"];

    if (!isTriangle) {
      const [wa, wb, wc] = corr;
      const rb = wb.abs / (wa.abs || 1), rc = wc.abs / (wa.abs || 1);
      rules.push({ name: "Rule of Retracement", nameTh: "กฎการรีเทรซ (B ต่อ A)", status: "info",
        detail: `Wave B retraced ${pct(rb * 100)} of Wave A — ${corrType === "flat" ? "deep (>80%) → Flat" : "shallow (<70%) → Zigzag"}` });
      rules.push({ name: "C vs A relationship", nameTh: "ความสัมพันธ์ C ต่อ A", status: "info",
        detail: `Wave C is ${pct(rc * 100)} of Wave A` });
      rules.push({ name: "Similarity & Balance", nameTh: "กฎความคล้าย & สมดุล", status: Math.abs(wa.bars - wc.bars) <= Math.max(wa.bars, wc.bars) * 0.5 ? "pass" : "info",
        detail: `Time A ${wa.bars} bars vs C ${wc.bars} bars` });
      const cTarget = corrType === "flat" ? wb.to.price + (up ? wa.abs : -wa.abs) : wb.to.price + (up ? wa.abs * 1.618 : -wa.abs * 1.618);
      projections = [
        { label: corrType === "flat" ? "Wave C ≈ Wave A" : "Wave C = 1.618×A", labelTh: corrType === "flat" ? "เป้า C ≈ A" : "เป้า C (1.618×A)", price: +cTarget.toFixed(0), fibRatio: corrType === "flat" ? 1.0 : 1.618, type: "support" },
      ];
      currentWave = "Wave C forming → correction ending"; currentWaveTh = "กำลังก่อคลื่น C → correction ใกล้จบ";
      implication = "Corrective structure — the larger trend should resume once C completes.";
      implicationTh = "โครงสร้าง corrective — เทรนด์ใหญ่มักกลับมาเดินต่อเมื่อคลื่น C จบ";
    } else {
      rules.push({ name: "Contracting legs", nameTh: "แต่ละขาหดตัวลง", status: "pass", detail: `A > C > E — converging (triangle = continuation pattern)` });
      rules.push({ name: "5-leg structure (A-B-C-D-E)", nameTh: "โครงสร้าง 5 ขา", status: "info", detail: "Each leg is a 3 (corrective) sub-structure" });
      currentWave = "Wave E / thrust out of triangle"; currentWaveTh = "คลื่น E / กำลังจะทะลุออกจาก triangle";
      implication = "Triangles are continuation patterns — expect a thrust in the pre-triangle trend direction.";
      implicationTh = "Triangle เป็นรูปแบบต่อเนื่อง — มักทะลุออกไปตามเทรนด์ก่อนหน้า";
      projections = [{ label: "Triangle thrust ≈ widest leg", labelTh: "เป้า thrust ≈ ขากว้างสุด", price: +(last.to.price + (up ? a.abs : -a.abs)).toFixed(0), fibRatio: 1.0, type: "target" }];
    }
    confidence = corrScore >= 2.2 ? "medium" : "low";
  } else {
    structure = "unclear";
    structureLabel = "Unclear / consolidation"; structureLabelTh = "โครงสร้างยังไม่ชัด — กำลังสะสม";
    labels = ["0", "A", "B", "C"];
    currentWave = "Await a clean monowave series"; currentWaveTh = "รอโครงสร้าง monowave ที่ชัดเจน";
    implication = "No NeoWave rule set is satisfied yet — treat as consolidation.";
    implicationTh = "ยังไม่เข้ากฎ NeoWave ชุดใด — ถือเป็นช่วงสะสม";
    confidence = "low";
    rules.push({ name: "Pattern recognition", nameTh: "การจับรูปแบบ", status: "info", detail: "Monowaves do not yet form a valid impulse or correction" });
  }

  // Label the trailing pivots with the chosen sequence
  const need = labels.length;
  const tail = pivots.slice(-need);
  const wavePivots: WavePivot[] = tail.map((p, i) => {
    const prev = tail[i - 1];
    const legPct = prev ? ((p.price - prev.price) / prev.price) * 100 : 0;
    return {
      index: p.idx, seriesIndex: p.idx, price: +p.price.toFixed(0), date: p.date, type: p.type,
      label: labels[i] ?? String(i), legPct: +legPct.toFixed(1),
    };
  });

  // Fib retracements of the last major swing (for the levels list)
  const lastTwo = pivots.slice(-2);
  const swingHigh = Math.max(lastTwo[0]?.price ?? spot, lastTwo[1]?.price ?? spot, spot);
  const swingLow  = Math.min(lastTwo[0]?.price ?? spot, lastTwo[1]?.price ?? spot);
  const swingRange = (swingHigh - swingLow) || 1;
  const fibLevels = [
    { ratio: "23.6%", price: +(swingHigh - swingRange * 0.236).toFixed(0), label: "Fib 23.6%" },
    { ratio: "38.2%", price: +(swingHigh - swingRange * 0.382).toFixed(0), label: "Fib 38.2%" },
    { ratio: "50.0%", price: +(swingHigh - swingRange * 0.500).toFixed(0), label: "Fib 50%" },
    { ratio: "61.8%", price: +(swingHigh - swingRange * 0.618).toFixed(0), label: "Fib 61.8%" },
    { ratio: "78.6%", price: +(swingHigh - swingRange * 0.786).toFixed(0), label: "Fib 78.6%" },
  ];

  const wavePhase: "impulse" | "corrective" | "uncertain" =
    structure === "impulse" || structure === "terminal" ? "impulse" :
    structure === "unclear" ? "uncertain" : "corrective";

  return {
    method: "NeoWave" as const, structure, structureLabel, structureLabelTh,
    currentWave, currentWaveTh, neelyRules: rules, extension,
    waveCount: structureLabel, waveCountTh: structureLabelTh,
    wavePhase, wavePhaseTh: structureLabelTh, phaseColor,
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
  const tf: ElliottTF = ["15m","1h","4h","1d","1w"].includes(tfParam) ? tfParam : "1d";

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
    const waveAnalysis = analyzeNeoWave(pivots, spot);

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
      disclaimer: "NeoWave analysis is rule-based but still probabilistic — alternate counts can be valid. Automated heuristic, not a substitute for a certified NeoWave analyst.",
      generatedAt: new Date().toISOString(),
    };

    CACHE[tf] = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
