import { NextResponse } from "next/server";
import type { OHLC } from "@/lib/backtest";

export const dynamic = "force-dynamic";

const CACHE: Record<string, { data: OHLC[]; ts: number }> = {};
// H1 data changes every hour; daily data every day.
const TTL_H1 = 30 * 60 * 1000;  // 30 min
const TTL_D1 = 30 * 60 * 1000;  // 30 min

function aggregateH1toH4(h1: OHLC[]): OHLC[] {
  const h4: OHLC[] = [];
  for (let i = 0; i < h1.length; i += 4) {
    const slice = h1.slice(i, i + 4);
    if (slice.length === 0) continue;
    h4.push({
      time:  slice[0].time,
      open:  slice[0].open,
      high:  Math.max(...slice.map((c) => c.high)),
      low:   Math.min(...slice.map((c) => c.low)),
      close: slice[slice.length - 1].close,
    });
  }
  return h4;
}

async function fetchOHLC(range: string, interval: string): Promise<OHLC[]> {
  const key = `${interval}-${range}`;
  const ttl = interval === "1d" ? TTL_D1 : TTL_H1;
  if (CACHE[key] && Date.now() - CACHE[key].ts < ttl) return CACHE[key].data;

  // Yahoo Finance interval mapping
  const yf_interval = interval === "1h" || interval === "4h" ? "60m" : "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=${range}&interval=${yf_interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No data");

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens:  number[] = quote.open  ?? [];
  const highs:  number[] = quote.high  ?? [];
  const lows:   number[] = quote.low   ?? [];
  const closes: number[] = quote.close ?? [];

  let ohlc: OHLC[] = timestamps
    .map((t, i) => ({ time: t, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }))
    .filter((b) => b.open != null && b.high != null && b.low != null && b.close != null);

  if (interval === "4h") {
    ohlc = aggregateH1toH4(ohlc);
  }

  CACHE[key] = { data: ohlc, ts: Date.now() };
  return ohlc;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const interval = searchParams.get("interval") ?? "1d";
  const raw_range = searchParams.get("range") ?? "1y";

  // Validate interval
  const ALLOWED_INTERVALS = ["1d", "1h", "4h"];
  if (!ALLOWED_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  // Intraday: cap range (Yahoo 60m max 730 days)
  let range = raw_range;
  if (interval !== "1d") {
    const INTRADAY_RANGES = ["1mo", "3mo", "6mo"];
    if (!INTRADAY_RANGES.includes(range)) range = "3mo";
  } else {
    const DAILY_RANGES = ["6mo", "1y", "2y"];
    if (!DAILY_RANGES.includes(range)) range = "1y";
  }

  try {
    const ohlc = await fetchOHLC(range, interval);
    return NextResponse.json({ ohlc, interval, range });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
