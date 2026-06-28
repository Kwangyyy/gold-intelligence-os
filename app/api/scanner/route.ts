import { NextResponse } from "next/server";
import { runScan, type ScanResult } from "@/lib/scanner";

export const dynamic = "force-dynamic";

// Cache 3 minutes — scanner fetches 6 TFs in parallel, no need to hammer Yahoo
let CACHE: { data: ScanResult; ts: number } | null = null;
const TTL = 3 * 60 * 1000;

async function fetchPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=1d&interval=1m&includePrePost=false",
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    const j = await res.json();
    return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) {
    return NextResponse.json(CACHE.data);
  }
  try {
    const [scan, price] = await Promise.all([runScan(), fetchPrice()]);
    const data: ScanResult = { ...scan, price };
    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
