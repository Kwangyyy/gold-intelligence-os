import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface IntermarketAsset {
  id: string;
  label: string;
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  relationship: "inverse" | "positive" | "mixed";
  note: string;
}

const ASSETS = [
  { id:"XAUUSD",  label:"Gold (XAU/USD)",  ticker:"GC=F",    relationship:"positive" as const, note:"Reference" },
  { id:"DXY",     label:"US Dollar Index",  ticker:"DX-Y.NYB",relationship:"inverse"  as const, note:"DXY ↑ → Gold ↓ โดยทั่วไป" },
  { id:"US10Y",   label:"US 10Y Treasury",  ticker:"^TNX",    relationship:"inverse"  as const, note:"Yields ↑ → Gold ↓ (opportunity cost)" },
  { id:"US2Y",    label:"US 2Y Treasury",   ticker:"^IRX",    relationship:"inverse"  as const, note:"Short yields — Fed policy proxy" },
  { id:"VIX",     label:"VIX Fear Index",   ticker:"^VIX",    relationship:"positive" as const, note:"VIX ↑ → risk-off → Gold ↑" },
  { id:"SP500",   label:"S&P 500",          ticker:"^GSPC",   relationship:"mixed"    as const, note:"Risk-on ↓ Gold; crisis ↑ Gold" },
  { id:"OIL",     label:"WTI Crude Oil",    ticker:"CL=F",    relationship:"positive" as const, note:"Inflation proxy — tends to move with Gold" },
  { id:"SILVER",  label:"Silver (XAG/USD)", ticker:"SI=F",    relationship:"positive" as const, note:"High beta Gold — amplifies Gold moves" },
  { id:"COPPER",  label:"Copper",           ticker:"HG=F",    relationship:"mixed"    as const, note:"Econ growth proxy — weak correlation" },
  { id:"EURUSD",  label:"EUR/USD",          ticker:"EURUSD=X",relationship:"positive" as const, note:"EUR ↑ = USD ↓ → Gold ↑" },
];

let CACHE: { data: IntermarketAsset[]; ts: number } | null = null;
const TTL = 60_000; // 1 min

async function fetchYahoo(ticker: string): Promise<{ price: number; change: number; changePct: number }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6_000) });
  if (!r.ok) throw new Error(`${r.status}`);
  const json = await r.json();
  const res  = json?.chart?.result?.[0];
  if (!res) throw new Error("no result");
  const meta     = res.meta ?? {};
  const price    = meta.regularMarketPrice ?? 0;
  const prev     = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change   = +(price - prev).toFixed(4);
  const changePct = prev ? +((change / prev) * 100).toFixed(2) : 0;
  return { price, change, changePct };
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) {
    return NextResponse.json(CACHE.data, { headers: { "Cache-Control": "public, max-age=60" } });
  }

  const results = await Promise.allSettled(
    ASSETS.map(async a => {
      const q = await fetchYahoo(a.ticker);
      return { id: a.id, label: a.label, ticker: a.ticker, relationship: a.relationship, note: a.note, ...q };
    })
  );

  const data: IntermarketAsset[] = results
    .map((r, i) => r.status === "fulfilled"
      ? r.value
      : { ...ASSETS[i], price: 0, change: 0, changePct: 0 })
    .filter(Boolean);

  CACHE = { data, ts: Date.now() };
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60" } });
}
