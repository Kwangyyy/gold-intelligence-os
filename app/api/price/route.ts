import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let CACHE: { price: number; ts: number } | null = null;
const TTL = 4_000; // 4 seconds

export async function GET() {
  try {
    if (CACHE && Date.now() - CACHE.ts < TTL) {
      return NextResponse.json({ price: CACHE.price });
    }
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=1d&interval=1m";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    const json  = await res.json();
    const meta  = json?.chart?.result?.[0]?.meta ?? {};
    const price = (meta.regularMarketPrice ?? 0) as number;
    CACHE = { price, ts: Date.now() };
    return NextResponse.json({ price });
  } catch {
    return NextResponse.json({ price: 0 }, { status: 500 });
  }
}
