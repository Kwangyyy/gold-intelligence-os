// Batch price fetch for all symbols via Yahoo Finance v8 chart API.
// Fetches in parallel with 6s timeout per symbol; failed symbols return null.

import { NextResponse } from "next/server";
import { SYMBOLS } from "@/lib/symbolConfig";

export const dynamic = "force-dynamic";

export interface SymbolPrice {
  id: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  ts: number;
}

async function fetchOne(yahooTicker: string): Promise<{ price: number; prevClose: number; high: number; low: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&range=2d`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta ?? {};
    const price     = meta.regularMarketPrice ?? null;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const high      = meta.regularMarketDayHigh ?? price;
    const low       = meta.regularMarketDayLow  ?? price;
    if (!price) return null;
    return { price, prevClose: prevClose ?? price, high: high ?? price, low: low ?? price };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function GET() {
  const results = await Promise.allSettled(
    SYMBOLS.map(s => fetchOne(s.yahooTicker))
  );

  const prices: SymbolPrice[] = [];
  for (let i = 0; i < SYMBOLS.length; i++) {
    const s = SYMBOLS[i];
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      const { price, prevClose, high, low } = r.value;
      const change    = parseFloat((price - prevClose).toFixed(s.decimals));
      const changePct = parseFloat(((change / prevClose) * 100).toFixed(2));
      prices.push({ id: s.id, price, prevClose, change, changePct, high, low, ts: Date.now() });
    }
  }

  return NextResponse.json(prices, {
    headers: { "Cache-Control": "public, max-age=10, stale-while-revalidate=30" },
  });
}
