import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface RocPeriod {
  period: number;       // bars
  label: string;        // "1W", "2W", "1M" etc.
  labelTh: string;
  roc: number;          // %
  signal: "strong_up" | "up" | "neutral" | "down" | "strong_down";
  signalTh: string;
  color: string;
  rank: number;         // 1=fastest momentum
}

export interface RocBar {
  date: string;
  price: number;
  roc20: number;        // 20-period ROC for chart
}

export interface AccelerationPhase {
  phase: "accelerating" | "decelerating" | "reversing" | "flat";
  phaseTh: string;
  color: string;
  description: string;
  descriptionTh: string;
}

export interface RocPayload {
  currentPrice: number;
  periods: RocPeriod[];
  history: RocBar[];        // last 60 bars
  acceleration: AccelerationPhase;
  momentumScore: number;    // 0-100
  momentumLabel: string;
  momentumLabelTh: string;
  overboughtOversold: "overbought" | "oversold" | "neutral";
  oobTh: string;
  goldImplication: string;
  goldImplicationTh: string;
  generatedAt: string;
}

function calcROC(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const current = closes.at(-1)!;
  const past    = closes.at(-1 - period)!;
  return ((current - past) / past) * 100;
}

function classifyROC(roc: number): { signal: RocPeriod["signal"]; signalTh: string; color: string } {
  if (roc > 5)  return { signal: "strong_up",   signalTh: "ขึ้นแรงมาก",   color: "#34d399" };
  if (roc > 1)  return { signal: "up",           signalTh: "ขึ้น",           color: "#6ee7b7" };
  if (roc > -1) return { signal: "neutral",      signalTh: "เป็นกลาง",      color: "#f5c451" };
  if (roc > -5) return { signal: "down",         signalTh: "ลง",             color: "#f97316" };
  return             { signal: "strong_down",  signalTh: "ลงแรงมาก",    color: "#f87171" };
}

let CACHE: { data: RocPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=200d&interval=1d";
    const r   = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) throw new Error(`Yahoo ${r.status}`);
    const j = await r.json();
    const result = j?.chart?.result?.[0];
    if (!result) throw new Error("No chart result");

    const timestamps: number[] = result.timestamp ?? [];
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const closes: number[] = [];
    const dates: string[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (rawCloses[i] != null) {
        closes.push(rawCloses[i]!);
        dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10));
      }
    }

    const currentPrice = closes.at(-1) ?? 0;

    // ROC for multiple periods
    const PERIOD_DEFS = [
      { period: 5,   label: "1W",  labelTh: "1 สัปดาห์" },
      { period: 10,  label: "2W",  labelTh: "2 สัปดาห์" },
      { period: 21,  label: "1M",  labelTh: "1 เดือน"    },
      { period: 42,  label: "2M",  labelTh: "2 เดือน"    },
      { period: 63,  label: "3M",  labelTh: "3 เดือน"    },
      { period: 126, label: "6M",  labelTh: "6 เดือน"    },
    ];

    const periods: RocPeriod[] = PERIOD_DEFS
      .map((def, idx) => {
        const roc = calcROC(closes, def.period);
        if (roc === null) return null;
        const cls = classifyROC(roc);
        return { ...def, roc: +roc.toFixed(2), ...cls, rank: idx + 1 };
      })
      .filter((p): p is RocPeriod => p !== null);

    // ROC20 history for chart (last 60 data points)
    const history: RocBar[] = [];
    const start = Math.max(20, closes.length - 80);
    for (let i = start; i < closes.length; i++) {
      const roc20 = calcROC(closes.slice(0, i + 1), 20);
      if (roc20 !== null) {
        history.push({ date: dates[i], price: +closes[i].toFixed(0), roc20: +roc20.toFixed(2) });
      }
    }
    const last60 = history.slice(-60);

    // Acceleration: compare short ROC vs medium ROC
    const roc5  = periods.find(p => p.period === 5)?.roc  ?? 0;
    const roc21 = periods.find(p => p.period === 21)?.roc ?? 0;
    const roc63 = periods.find(p => p.period === 63)?.roc ?? 0;
    let acceleration: AccelerationPhase;
    if (roc5 > roc21 && roc21 > 0) {
      acceleration = { phase: "accelerating", phaseTh: "โมเมนตัมเร่งขึ้น", color: "#34d399",
        description: "Short-term ROC exceeds medium-term — momentum accelerating.",
        descriptionTh: "ROC ระยะสั้นสูงกว่าระยะกลาง — โมเมนตัมกำลังเร่งตัว" };
    } else if (roc5 < roc21 && roc21 > 0) {
      acceleration = { phase: "decelerating", phaseTh: "โมเมนตัมชะลอตัว", color: "#f5c451",
        description: "Short-term ROC below medium-term — uptrend slowing.",
        descriptionTh: "ROC ระยะสั้นต่ำกว่าระยะกลาง — แนวโน้มขาขึ้นชะลอตัว" };
    } else if (roc5 < 0 && roc21 > 0) {
      acceleration = { phase: "reversing", phaseTh: "อาจกลับทิศ", color: "#f87171",
        description: "Short-term turned negative while medium still positive — potential reversal.",
        descriptionTh: "ROC ระยะสั้นติดลบ ขณะที่ระยะกลางยังบวก — อาจกำลังกลับทิศ" };
    } else {
      acceleration = { phase: "flat", phaseTh: "เคลื่อนที่ราบ", color: "rgba(175,185,215,0.4)",
        description: "No clear acceleration or deceleration signal.",
        descriptionTh: "ไม่มีสัญญาณเร่ง/ชะลอที่ชัดเจน" };
    }

    // Momentum score: weighted average of all ROC scores
    const weights = [0.3, 0.2, 0.2, 0.1, 0.1, 0.1];
    const totalW  = periods.reduce((a, _, i) => a + (weights[i] ?? 0.05), 0);
    const wSum    = periods.reduce((a, p, i) => {
      const normalized = Math.max(0, Math.min(100, 50 + p.roc * 3));
      return a + normalized * (weights[i] ?? 0.05);
    }, 0);
    const momentumScore = Math.round(wSum / totalW);
    const momentumLabel = momentumScore > 65 ? "Strong Bullish" : momentumScore > 55 ? "Bullish" : momentumScore > 45 ? "Neutral" : momentumScore > 35 ? "Bearish" : "Strong Bearish";
    const momentumLabelTh = momentumScore > 65 ? "ขาขึ้นแรง" : momentumScore > 55 ? "ขาขึ้น" : momentumScore > 45 ? "เป็นกลาง" : momentumScore > 35 ? "ขาลง" : "ขาลงแรง";

    // Overbought/oversold via 3-month ROC extremes
    const oob: RocPayload["overboughtOversold"] = roc63 > 15 ? "overbought" : roc63 < -15 ? "oversold" : "neutral";
    const oobTh = oob === "overbought" ? "Overbought (ROC 3M สูงเกินไป — ระวัง pullback)" : oob === "oversold" ? "Oversold (ROC 3M ต่ำมาก — โอกาสสะสม)" : "ระดับปกติ";

    const goldImplication = oob === "overbought"
      ? "Gold up >15% in 3M — historically prone to consolidation or pullback near-term."
      : oob === "oversold"
      ? "Gold down >15% in 3M — historically a buying zone; watch for reversal signal."
      : `3M ROC ${roc63 > 0 ? "+" : ""}${roc63.toFixed(1)}% — within normal range. Trend: ${momentumLabel.toLowerCase()}.`;
    const goldImplicationTh = oob === "overbought"
      ? "ทองขึ้น >15% ใน 3 เดือน — มักเกิด consolidation หรือ pullback ในระยะสั้น"
      : oob === "oversold"
      ? "ทองลง >15% ใน 3 เดือน — ประวัติศาสตร์เป็น Zone สะสม รอสัญญาณกลับ"
      : `ROC 3M ${roc63 > 0 ? "+" : ""}${roc63.toFixed(1)}% — อยู่ในระดับปกติ เทรนด์: ${momentumLabelTh}`;

    const data: RocPayload = {
      currentPrice, periods, history: last60, acceleration,
      momentumScore, momentumLabel, momentumLabelTh,
      overboughtOversold: oob, oobTh,
      goldImplication, goldImplicationTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
