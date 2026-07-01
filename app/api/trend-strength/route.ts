import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface TFTrendData {
  tf: string;
  tfLabel: string;
  adx: number;
  diPlus: number;
  diMinus: number;
  trend: "strong_up" | "up" | "flat" | "down" | "strong_down";
  trendLabel: string;
  trendLabelTh: string;
  quality: "excellent" | "good" | "fair" | "weak";
  qualityScore: number; // 0-100
}

export interface TrendStrengthPayload {
  price: number;
  overallTrend: "strong_up" | "up" | "flat" | "down" | "strong_down";
  overallScore: number;
  overallLabel: string;
  overallLabelTh: string;
  timeframes: TFTrendData[];
  alignedCount: number;       // how many TFs agree on direction
  alignedPct: number;
  dominantDirection: "up" | "down" | "flat";
  advice: string;
  adviceTh: string;
  generatedAt: string;
}

const TF_CONFIG = [
  { tf: "1d",  tfLabel: "Daily (1D)",     range: "180d", interval: "1d",  label: "สัปดาห์/เดือน" },
  { tf: "4h",  tfLabel: "4-Hour (4H)",    range: "45d",  interval: "4h",  label: "หลายวัน" },
  { tf: "1h",  tfLabel: "1-Hour (1H)",    range: "15d",  interval: "1h",  label: "ในวัน" },
  { tf: "15m", tfLabel: "15-Min (15M)",   range: "5d",   interval: "15m", label: "Intraday" },
];

function wilderSum(arr: number[], p: number): number[] {
  if (arr.length < p) return arr.map(() => 0);
  const out: number[] = [arr.slice(0, p).reduce((a, b) => a + b, 0)];
  for (let i = p; i < arr.length; i++) out.push(out.at(-1)! - out.at(-1)! / p + arr[i]);
  return out;
}

function wilderAvg(arr: number[], p: number): number[] {
  if (arr.length < p) return arr.map(() => 0);
  const out: number[] = [arr.slice(0, p).reduce((a, b) => a + b, 0) / p];
  for (let i = p; i < arr.length; i++) out.push((out.at(-1)! * (p - 1) + arr[i]) / p);
  return out;
}

function calcADXFull(highs: number[], lows: number[], closes: number[], period = 14): { adx: number; diPlus: number; diMinus: number } {
  if (highs.length < period * 2 + 1) return { adx: 20, diPlus: 20, diMinus: 20 };
  const tr: number[] = [], dmP: number[] = [], dmM: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const h = highs[i], l = lows[i], ph = highs[i-1], pl = lows[i-1], pc = closes[i-1];
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    const up = h - ph, dn = pl - l;
    dmP.push(up > dn && up > 0 ? up : 0);
    dmM.push(dn > up && dn > 0 ? dn : 0);
  }
  const atr14 = wilderSum(tr,  period);
  const dp14  = wilderSum(dmP, period);
  const dm14  = wilderSum(dmM, period);
  const dx: number[] = [];
  for (let i = 0; i < atr14.length; i++) {
    const piPlus  = atr14[i] > 0 ? (dp14[i] / atr14[i]) * 100 : 0;
    const piMinus = atr14[i] > 0 ? (dm14[i] / atr14[i]) * 100 : 0;
    const sum = piPlus + piMinus;
    dx.push(sum > 0 ? Math.abs(piPlus - piMinus) / sum * 100 : 0);
  }
  const adxArr = wilderAvg(dx, period);
  const adx    = Math.max(0, Math.min(100, adxArr.at(-1) ?? 20));
  const last   = atr14.length - 1;
  const diPlus  = atr14[last] > 0 ? (dp14[last] / atr14[last]) * 100 : 20;
  const diMinus = atr14[last] > 0 ? (dm14[last] / atr14[last]) * 100 : 20;
  return { adx: +adx.toFixed(1), diPlus: +diPlus.toFixed(1), diMinus: +diMinus.toFixed(1) };
}

function classifyTrend(adx: number, diPlus: number, diMinus: number): {
  trend: TFTrendData["trend"]; quality: TFTrendData["quality"]; score: number; label: string; labelTh: string;
} {
  const dir = diPlus > diMinus ? "up" : diPlus < diMinus ? "down" : "flat";
  const score = adx;
  let quality: TFTrendData["quality"] = "weak";
  if (adx >= 40) quality = "excellent";
  else if (adx >= 25) quality = "good";
  else if (adx >= 18) quality = "fair";

  if (adx < 18) return { trend: "flat",       quality, score, label: "Sideways",     labelTh: "เคลื่อนข้าง" };
  if (dir === "up") {
    if (adx >= 40) return { trend: "strong_up",   quality, score, label: "Strong Uptrend",  labelTh: "ขาขึ้นแข็งแกร่ง" };
    return          { trend: "up",           quality, score, label: "Uptrend",       labelTh: "ขาขึ้น" };
  }
  if (adx >= 40) return { trend: "strong_down", quality, score, label: "Strong Downtrend", labelTh: "ขาลงแข็งแกร่ง" };
  return               { trend: "down",         quality, score, label: "Downtrend",    labelTh: "ขาลง" };
}

async function fetchBars(range: string, interval: string): Promise<{ h: number[]; l: number[]; c: number[]; last: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const q = result.indicators?.quote?.[0] ?? {};
  const rawH: (number|null)[] = q.high  ?? [];
  const rawL: (number|null)[] = q.low   ?? [];
  const rawC: (number|null)[] = q.close ?? [];
  const h: number[] = [], l: number[] = [], c: number[] = [];
  for (let i = 0; i < rawH.length; i++) {
    if (rawH[i] != null && rawL[i] != null && rawC[i] != null) {
      h.push(rawH[i]!); l.push(rawL[i]!); c.push(rawC[i]!);
    }
  }
  const last = result.meta?.regularMarketPrice ?? c.at(-1) ?? 0;
  return h.length >= 30 ? { h, l, c, last } : null;
}

let CACHE: { data: TrendStrengthPayload; ts: number } | null = null;
const TTL = 10 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const results = await Promise.allSettled(TF_CONFIG.map(c => fetchBars(c.range, c.interval)));
    const timeframes: TFTrendData[] = [];
    let price = 0;

    for (let i = 0; i < TF_CONFIG.length; i++) {
      const cfg = TF_CONFIG[i];
      const r = results[i];
      if (r.status === "rejected" || !r.value) continue;
      const { h, l, c, last } = r.value;
      if (i === 0) price = last;
      const { adx, diPlus, diMinus } = calcADXFull(h, l, c);
      const cls = classifyTrend(adx, diPlus, diMinus);
      timeframes.push({
        tf: cfg.tf, tfLabel: cfg.tfLabel,
        adx, diPlus, diMinus,
        trend:        cls.trend,
        trendLabel:   cls.label,
        trendLabelTh: cls.labelTh,
        quality:      cls.quality,
        qualityScore: cls.score,
      });
    }

    // Overall: weighted average score (daily × 3, 4h × 2, 1h × 1, 15m × 0.5)
    const weights = [3, 2, 1, 0.5];
    let totalWeight = 0, totalScore = 0;
    let upCount = 0, downCount = 0, flatCount = 0;
    timeframes.forEach((tf, i) => {
      const w = weights[i] ?? 0.5;
      totalWeight += w;
      totalScore  += tf.qualityScore * w;
      if (tf.trend.includes("up"))    upCount   += w;
      else if (tf.trend.includes("down")) downCount += w;
      else flatCount += w;
    });
    const overallScore = totalWeight > 0 ? +(totalScore / totalWeight).toFixed(1) : 20;
    const dir: "up" | "down" | "flat" = upCount > downCount && upCount > flatCount ? "up" : downCount > upCount && downCount > flatCount ? "down" : "flat";

    const overallMap: Record<string, TFTrendData["trend"]> = {
      up:   overallScore >= 35 ? "strong_up" : "up",
      down: overallScore >= 35 ? "strong_down" : "down",
      flat: "flat",
    };
    const overallTrend = overallMap[dir];

    const labelMap: Record<string, string> = {
      strong_up: "Strong Uptrend", up: "Uptrend", flat: "Sideways", down: "Downtrend", strong_down: "Strong Downtrend",
    };
    const labelThMap: Record<string, string> = {
      strong_up: "ขาขึ้นแข็งแกร่ง", up: "ขาขึ้น", flat: "เคลื่อนข้าง", down: "ขาลง", strong_down: "ขาลงแข็งแกร่ง",
    };

    const aligned = timeframes.filter(tf => tf.trend.includes(dir)).length;
    const alignedPct = timeframes.length > 0 ? +(aligned / timeframes.length * 100).toFixed(0) : 0;

    let advice = "", adviceTh = "";
    if (alignedPct >= 75 && dir === "up")   { advice = "Strong multi-timeframe bullish alignment — trend-following entries favored."; adviceTh = "ทุก Timeframe ขึ้นพร้อมกัน — เหมาะ trend follow Long"; }
    else if (alignedPct >= 75 && dir === "down") { advice = "Strong multi-timeframe bearish alignment — trend-following sell setups favored."; adviceTh = "ทุก Timeframe ลงพร้อมกัน — เหมาะ trend follow Short"; }
    else if (overallScore < 20) { advice = "Low ADX across timeframes — market is ranging. Avoid trend strategies."; adviceTh = "ADX ต่ำหลาย Timeframe — ตลาดเคลื่อนข้าง หลีกเลี่ยง trend strategy"; }
    else { advice = "Mixed timeframe alignment — higher timeframes take precedence for bias."; adviceTh = "Timeframe ยังไม่สอดคล้องกัน — ใช้ Daily/4H เป็น higher timeframe bias"; }

    const data: TrendStrengthPayload = {
      price: +price.toFixed(2),
      overallTrend,
      overallScore,
      overallLabel:   labelMap[overallTrend],
      overallLabelTh: labelThMap[overallTrend],
      timeframes,
      alignedCount:    aligned,
      alignedPct,
      dominantDirection: dir,
      advice, adviceTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
