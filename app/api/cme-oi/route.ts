import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

export interface CmeOiData {
  symbol:       string;
  name:         string;
  icon:         string;
  date:         string;
  openInterest: number;
  oiPrev:       number;
  oiChange:     number;
  oiChangePct:  number;
  volume:       number;
  settle:       number;
}

const INSTRUMENTS = [
  { symbol: "GC", name: "Gold",    icon: "🥇", productId: "437" },
  { symbol: "SI", name: "Silver",  icon: "🥈", productId: "438" },
  { symbol: "PL", name: "Platinum",icon: "⚪", productId: "445" },
  { symbol: "HG", name: "Copper",  icon: "🔶", productId: "438" },
];

let CACHE: { data: CmeOiData[]; ts: number } | null = null;
const TTL = 60 * 60_000; // 1 hour

// CME Group public volume/OI endpoint
async function fetchCmeOI(symbol: string): Promise<{ oi: number; oiPrev: number; volume: number; settle: number; date: string }> {
  const url = `https://www.cmegroup.com/CmeWS/mvc/Volume/ProductAndDate/${symbol}/0/CC`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.cmegroup.com/" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!r.ok) throw new Error(`CME ${symbol}: ${r.status}`);
  const json = await r.json();

  // CME returns array of sessions
  const items = json?.items ?? json?.rows ?? [];
  if (!items.length) throw new Error("no data");

  const cur  = items[0];
  const prev = items[1] ?? cur;

  const oi       = +(cur.openInterest   ?? cur.oi ?? 0);
  const oiPrev   = +(prev.openInterest  ?? prev.oi ?? 0);
  const volume   = +(cur.volume ?? 0);
  const settle   = +(cur.settle ?? cur.settlementPrice ?? 0);
  const date     = cur.tradeDate ?? cur.date ?? new Date().toISOString().slice(0, 10);

  return { oi, oiPrev, volume, settle, date };
}

async function fetchWithFallback(symbol: string, productId: string): Promise<{ oi: number; oiPrev: number; volume: number; settle: number; date: string }> {
  try {
    return await fetchCmeOI(symbol);
  } catch {
    // Fallback: try product-specific endpoint
    const url2 = `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/${productId}/G`;
    const r2 = await fetch(url2, {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.cmegroup.com/" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r2.ok) throw new Error(`CME fallback ${symbol}: ${r2.status}`);
    const json = await r2.json();
    const quotes = json?.quotes ?? [];
    if (!quotes.length) throw new Error("no quotes");
    const q = quotes[0];
    return {
      oi:     +(q.openInterest ?? 0),
      oiPrev: +(q.openInterest ?? 0),
      volume: +(q.volume ?? 0),
      settle: +(q.last ?? q.settle ?? 0),
      date:   new Date().toISOString().slice(0, 10),
    };
  }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) {
    return NextResponse.json(CACHE.data, { headers: { "Cache-Control": "no-store" } });
  }

  const results = await Promise.allSettled(
    INSTRUMENTS.map(async inst => {
      const d = await fetchWithFallback(inst.symbol, inst.productId);
      const oiChange    = d.oi - d.oiPrev;
      const oiChangePct = d.oiPrev > 0 ? (oiChange / d.oiPrev) * 100 : 0;
      return {
        symbol:       inst.symbol,
        name:         inst.name,
        icon:         inst.icon,
        date:         d.date,
        openInterest: d.oi,
        oiPrev:       d.oiPrev,
        oiChange,
        oiChangePct: +oiChangePct.toFixed(2),
        volume:       d.volume,
        settle:       d.settle,
      } satisfies CmeOiData;
    })
  );

  const data: CmeOiData[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      symbol: INSTRUMENTS[i].symbol, name: INSTRUMENTS[i].name, icon: INSTRUMENTS[i].icon,
      date: "—", openInterest: 0, oiPrev: 0, oiChange: 0, oiChangePct: 0, volume: 0, settle: 0,
    };
  });

  CACHE = { data, ts: Date.now() };
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
