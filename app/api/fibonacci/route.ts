import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface FibLevel {
  ratio: number;       // e.g. 0.382
  label: string;       // "38.2%"
  price: number;
  type: "retracement" | "extension";
  significance: "major" | "minor";
  isCurrentZone: boolean;  // price within ±0.5% of level
}

export interface SwingPoint {
  index: number;
  price: number;
  date: string;
  type: "high" | "low";
}

export interface FibPayload {
  price: number;
  swing: {
    high: SwingPoint;
    low: SwingPoint;
    trend: "up" | "down";   // direction of the last leg
    legPct: number;          // size of the swing leg in %
  };
  retracements: FibLevel[];
  extensions: FibLevel[];
  nearestSupport: FibLevel | null;
  nearestResistance: FibLevel | null;
  currentZones: FibLevel[];
  context: string;
  contextTh: string;
  generatedAt: string;
}

const RET_RATIOS  = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const EXT_RATIOS  = [1.272, 1.414, 1.618, 2.0, 2.618];
const MAJOR_LEVELS = new Set([0.382, 0.5, 0.618, 1.618]);

function findSwings(highs: number[], lows: number[], lookback: number): { high: SwingPoint; low: SwingPoint } | null {
  if (highs.length < lookback) return null;
  const n = highs.length;
  const window = Math.min(lookback, n);

  // Find the highest high and lowest low within lookback, then determine which came last
  let swingHighIdx = -1, swingHighPrice = -Infinity;
  let swingLowIdx  = -1, swingLowPrice  =  Infinity;

  for (let i = n - window; i < n; i++) {
    if (highs[i] > swingHighPrice) { swingHighPrice = highs[i]; swingHighIdx = i; }
    if (lows[i]  < swingLowPrice)  { swingLowPrice  = lows[i];  swingLowIdx  = i; }
  }
  if (swingHighIdx === -1 || swingLowIdx === -1) return null;
  return {
    high: { index: swingHighIdx, price: swingHighPrice, date: "", type: "high" },
    low:  { index: swingLowIdx,  price: swingLowPrice,  date: "", type: "low"  },
  };
}

let CACHE: { data: FibPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch 100 4h bars (≈17 trading days)
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=20d&interval=4h&includePrePost=false";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error("No data");

    const q = result.indicators?.quote?.[0] ?? {};
    const timestamps: number[] = result.timestamp ?? [];
    const rawH: (number|null)[] = q.high  ?? [];
    const rawL: (number|null)[] = q.low   ?? [];
    const rawC: (number|null)[] = q.close ?? [];

    const price = result.meta?.regularMarketPrice ?? rawC.filter(Boolean).at(-1) ?? 3000;

    // Filter nulls
    const bars: { ts: number; h: number; l: number; c: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const h = rawH[i], l = rawL[i], c = rawC[i];
      if (h == null || l == null || c == null) continue;
      bars.push({ ts: timestamps[i], h, l, c });
    }

    const highs = bars.map(b => b.h);
    const lows  = bars.map(b => b.l);

    const swings = findSwings(highs, lows, Math.min(bars.length, 80));
    if (!swings) throw new Error("Not enough data");

    const { high, low } = swings;
    high.date = new Date(bars[high.index].ts * 1000).toISOString().slice(0, 10);
    low.date  = new Date(bars[low.index].ts * 1000).toISOString().slice(0, 10);

    // Determine trend direction from which swing came last
    const trend = high.index > low.index ? "down" : "up";
    const legPct = Math.abs((high.price - low.price) / low.price * 100);

    // Retracement levels (measure from the last leg)
    const [fromPrice, toPrice] = trend === "up"
      ? [low.price, high.price]   // retracing from high downward
      : [high.price, low.price];  // retracing from low upward

    const range = Math.abs(high.price - low.price);

    const retracements: FibLevel[] = RET_RATIOS.map(r => {
      const lvPrice = trend === "up"
        ? high.price - r * range
        : low.price  + r * range;
      const diff = Math.abs(price - lvPrice);
      return {
        ratio: r,
        label: r === 0 ? "0% (Origin)" : r === 1 ? "100% (End)" : `${(r * 100).toFixed(1)}%`,
        price: +lvPrice.toFixed(2),
        type: "retracement",
        significance: MAJOR_LEVELS.has(r) ? "major" : "minor",
        isCurrentZone: diff / price < 0.005,
      };
    });

    const extensions: FibLevel[] = EXT_RATIOS.map(r => {
      const lvPrice = trend === "up"
        ? high.price + (r - 1) * range
        : low.price  - (r - 1) * range;
      const diff = Math.abs(price - lvPrice);
      return {
        ratio: r,
        label: `${(r * 100).toFixed(1)}% Ext`,
        price: +lvPrice.toFixed(2),
        type: "extension",
        significance: r === 1.618 ? "major" : "minor",
        isCurrentZone: diff / price < 0.005,
      };
    });

    const allLevels = [...retracements, ...extensions];
    const currentZones = allLevels.filter(l => l.isCurrentZone);

    const levelsBelow = allLevels.filter(l => l.price < price).sort((a, b) => b.price - a.price);
    const levelsAbove = allLevels.filter(l => l.price > price).sort((a, b) => a.price - b.price);

    const nearestSupport    = levelsBelow[0] ?? null;
    const nearestResistance = levelsAbove[0] ?? null;

    // Context text
    const retLevel = retracements.find(r => r.isCurrentZone);
    const retrPct  = retLevel ? retLevel.label : `${(((price - (trend === "up" ? high.price : low.price)) / range) * -100).toFixed(1)}%`;

    const contextEn = trend === "up"
      ? `Price is in an uptrend leg (+${legPct.toFixed(1)}% from low). Currently retracing at ${retrPct}. Watch ${nearestSupport?.label ?? ""} ($${nearestSupport?.price.toFixed(0) ?? ""}) as support.`
      : `Price is in a downtrend leg (-${legPct.toFixed(1)}% from high). Currently retracing at ${retrPct}. Watch ${nearestResistance?.label ?? ""} ($${nearestResistance?.price.toFixed(0) ?? ""}) as resistance.`;

    const contextTh = trend === "up"
      ? `ราคาอยู่ในแนวโน้มขาขึ้น (+${legPct.toFixed(1)}% จากจุดต่ำสุด) กำลัง retrace ที่ ${retrPct} จับตา support ${nearestSupport?.label ?? ""} ที่ $${nearestSupport?.price.toFixed(0) ?? ""}`
      : `ราคาอยู่ในแนวโน้มขาลง (-${legPct.toFixed(1)}% จากจุดสูงสุด) กำลัง retrace ที่ ${retrPct} จับตา resistance ${nearestResistance?.label ?? ""} ที่ $${nearestResistance?.price.toFixed(0) ?? ""}`;

    const data: FibPayload = {
      price: +price.toFixed(2),
      swing: { high, low, trend, legPct: +legPct.toFixed(2) },
      retracements,
      extensions,
      nearestSupport,
      nearestResistance,
      currentZones,
      context: contextEn,
      contextTh,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
