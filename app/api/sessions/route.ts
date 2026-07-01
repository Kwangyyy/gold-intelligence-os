import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type SessionName = "Asian" | "London" | "New York" | "Overlap (London+NY)";

export interface HourStat {
  hour: number;            // 0-23 UTC
  avgReturn: number;       // % avg hourly return
  avgAbsReturn: number;    // % avg absolute move (volatility)
  winRate: number;         // % bullish closes
  avgRange: number;        // avg H-L in price units
  sampleCount: number;
}

export interface SessionStat {
  name: SessionName;
  nameTh: string;
  hours: string;
  color: string;
  avgReturn: number;
  avgVolatility: number;
  winRate: number;
  avgRange: number;
  bestHour: number;
  worstHour: number;
}

export interface SessionsPayload {
  hourStats: HourStat[];
  sessionStats: SessionStat[];
  currentSession: SessionName;
  currentHour: number;
  price: number;
  sampleDays: number;
  generatedAt: string;
}

const SESSION_HOURS: Record<SessionName, number[]> = {
  "Asian":               [23, 0, 1, 2, 3, 4, 5, 6, 7],
  "London":              [8, 9, 10, 11, 12, 13, 14, 15],
  "Overlap (London+NY)": [13, 14, 15, 16, 17],
  "New York":            [13, 14, 15, 16, 17, 18, 19, 20],
};

const SESSION_TH: Record<SessionName, string> = {
  "Asian":               "เซสชัน Asia (โตเกียว)",
  "London":              "เซสชัน London",
  "Overlap (London+NY)": "Overlap London + New York",
  "New York":            "เซสชัน New York",
};

const SESSION_COLOR: Record<SessionName, string> = {
  "Asian":               "#60a5fa",
  "London":              "#34d399",
  "Overlap (London+NY)": "#f5c451",
  "New York":            "#c084fc",
};

function currentSession(utcH: number): SessionName {
  if (utcH >= 23 || utcH < 8)  return "Asian";
  if (utcH >= 8  && utcH < 13) return "London";
  if (utcH >= 13 && utcH < 17) return "Overlap (London+NY)";
  return "New York";
}

let CACHE: { data: SessionsPayload; ts: number } | null = null;
const TTL = 6 * 60 * 60 * 1000; // 6 hours

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch 60 days hourly data from Yahoo Finance
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=60d&interval=1h&includePrePost=false";
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
    const rawO: (number|null)[] = q.open  ?? [];

    const price = result.meta?.regularMarketPrice ?? rawC.filter(Boolean).at(-1) ?? 0;

    // Aggregate by UTC hour
    const hourBuckets: Map<number, { returns: number[]; ranges: number[]; absReturns: number[] }> = new Map();
    for (let i = 0; i < timestamps.length; i++) {
      const o = rawO[i], h = rawH[i], l = rawL[i], c = rawC[i];
      if (o == null || h == null || l == null || c == null || o === 0) continue;
      const utcH = new Date(timestamps[i] * 1000).getUTCHours();
      if (!hourBuckets.has(utcH)) hourBuckets.set(utcH, { returns: [], ranges: [], absReturns: [] });
      const bucket = hourBuckets.get(utcH)!;
      const ret = ((c - o) / o) * 100;
      const rng = ((h - l) / l) * 100;
      bucket.returns.push(ret);
      bucket.ranges.push(rng);
      bucket.absReturns.push(Math.abs(ret));
    }

    const hourStats: HourStat[] = [];
    for (let h = 0; h < 24; h++) {
      const b = hourBuckets.get(h);
      if (!b || b.returns.length === 0) {
        hourStats.push({ hour: h, avgReturn: 0, avgAbsReturn: 0, winRate: 50, avgRange: 0, sampleCount: 0 });
        continue;
      }
      const avgRet   = b.returns.reduce((a, v) => a + v, 0) / b.returns.length;
      const avgAbs   = b.absReturns.reduce((a, v) => a + v, 0) / b.absReturns.length;
      const avgRng   = b.ranges.reduce((a, v) => a + v, 0) / b.ranges.length;
      const wins     = b.returns.filter(r => r > 0).length;
      const rangeAbs = (avgRng / 100) * (price || 3000);
      hourStats.push({
        hour: h,
        avgReturn: +avgRet.toFixed(4),
        avgAbsReturn: +avgAbs.toFixed(4),
        winRate: +(wins / b.returns.length * 100).toFixed(1),
        avgRange: +rangeAbs.toFixed(2),
        sampleCount: b.returns.length,
      });
    }

    // Build session stats
    const sessionStats: SessionStat[] = (Object.entries(SESSION_HOURS) as [SessionName, number[]][]).map(([name, hours]) => {
      const stats = hours.map(h => hourStats[h]).filter(s => s.sampleCount > 0);
      if (!stats.length) return {
        name, nameTh: SESSION_TH[name], hours: hours.map(h => `${h}:00`).join(", "),
        color: SESSION_COLOR[name], avgReturn: 0, avgVolatility: 0, winRate: 50, avgRange: 0, bestHour: hours[0], worstHour: hours[0],
      };
      const avgRet  = stats.reduce((a, s) => a + s.avgReturn, 0) / stats.length;
      const avgVol  = stats.reduce((a, s) => a + s.avgAbsReturn, 0) / stats.length;
      const avgWR   = stats.reduce((a, s) => a + s.winRate, 0) / stats.length;
      const avgRng  = stats.reduce((a, s) => a + s.avgRange, 0) / stats.length;
      const bestH   = stats.reduce((a, s) => s.avgAbsReturn > a.avgAbsReturn ? s : a).hour;
      const worstH  = stats.reduce((a, s) => s.avgAbsReturn < a.avgAbsReturn ? s : a).hour;
      return {
        name, nameTh: SESSION_TH[name],
        hours: `${hours[0]}:00–${hours[hours.length - 1]}:00 UTC`,
        color: SESSION_COLOR[name],
        avgReturn:    +avgRet.toFixed(4),
        avgVolatility:+avgVol.toFixed(4),
        winRate:      +avgWR.toFixed(1),
        avgRange:     +avgRng.toFixed(2),
        bestHour: bestH, worstHour: worstH,
      };
    });

    // Estimate sample days from total samples / 24
    const totalSamples = hourStats.reduce((a, s) => a + s.sampleCount, 0);
    const sampleDays = Math.round(totalSamples / 24);

    const data: SessionsPayload = {
      hourStats,
      sessionStats,
      currentSession: currentSession(new Date().getUTCHours()),
      currentHour: new Date().getUTCHours(),
      price: +price.toFixed(2),
      sampleDays,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
