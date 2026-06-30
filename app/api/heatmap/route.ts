import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// UTC offset for each session window
const SESSIONS = [
  { name: "Sydney",  start: 21, end: 6,  color: "#818cf8" }, // prev-day 21 – 06
  { name: "Tokyo",   start: 0,  end: 9,  color: "#34d399" },
  { name: "London",  start: 7,  end: 16, color: "#60a5fa" },
  { name: "New York",start: 12, end: 21, color: "#f97316" },
];

export interface HeatmapCell {
  dow: number;          // 1=Mon … 5=Fri
  hour: number;         // 0–23 UTC
  avgRange: number;     // avg (high-low) in price units
  count: number;
  z: number;            // 0–1 normalised
}

export interface HeatmapResponse {
  cells: HeatmapCell[];
  sessions: typeof SESSIONS;
  maxRange: number;
  minRange: number;
  symbol: string;
  dataFrom: number;     // earliest timestamp ms
  dataTo: number;
}

let CACHE: { data: HeatmapResponse; ts: number } | null = null;
const TTL = 4 * 60 * 60 * 1000; // 4 h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) {
    return NextResponse.json(CACHE.data, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1h&range=60d";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error("no result");

    const timestamps: number[] = result.timestamps ?? result.timestamp ?? [];
    const quotes = result.indicators?.quote?.[0] ?? {};
    const highs: number[] = quotes.high ?? [];
    const lows: number[]  = quotes.low  ?? [];

    // Accumulate sum/count per [dow][hour] bucket
    const buckets: Record<string, { sum: number; count: number }> = {};
    let dataFrom = Infinity, dataTo = 0;

    for (let i = 0; i < timestamps.length; i++) {
      const h = highs[i], l = lows[i];
      if (!h || !l || isNaN(h) || isNaN(l)) continue;
      const d  = new Date(timestamps[i] * 1000);
      const dow = d.getUTCDay(); // 0=Sun
      if (dow === 0 || dow === 6) continue; // skip weekend
      const hour = d.getUTCHours();
      const key  = `${dow}:${hour}`;
      if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
      buckets[key].sum   += h - l;
      buckets[key].count += 1;
      if (timestamps[i] * 1000 < dataFrom) dataFrom = timestamps[i] * 1000;
      if (timestamps[i] * 1000 > dataTo)   dataTo   = timestamps[i] * 1000;
    }

    const cells: HeatmapCell[] = [];
    let maxRange = 0, minRange = Infinity;
    for (let dow = 1; dow <= 5; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        const b = buckets[`${dow}:${hour}`];
        const avgRange = b ? b.sum / b.count : 0;
        cells.push({ dow, hour, avgRange, count: b?.count ?? 0, z: 0 });
        if (avgRange > maxRange) maxRange = avgRange;
        if (b && avgRange < minRange) minRange = avgRange;
      }
    }

    // Normalise
    const range = maxRange - (minRange === Infinity ? 0 : minRange);
    cells.forEach(c => {
      c.z = range > 0 ? (c.avgRange - (minRange === Infinity ? 0 : minRange)) / range : 0;
    });

    const data: HeatmapResponse = {
      cells, sessions: SESSIONS,
      maxRange: +maxRange.toFixed(2),
      minRange: minRange === Infinity ? 0 : +minRange.toFixed(2),
      symbol: "XAUUSD", dataFrom, dataTo,
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "heatmap failed" },
      { status: 500 },
    );
  }
}
