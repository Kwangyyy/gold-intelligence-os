import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface AssetMomentum {
  symbol: string;
  name: string;
  nameTh: string;
  price: number;
  change1d: number;   // % 1-day
  change5d: number;   // % 5-day
  change20d: number;  // % 20-day
  change60d: number;  // % 60-day
  rsi14: number;
  momentumScore: number; // composite 0-100
  trend: "strong_up" | "up" | "flat" | "down" | "strong_down";
  color: string;
  goldRelation: "positive" | "negative" | "mixed";
}

export interface MomentumPayload {
  assets: AssetMomentum[];
  goldRank: number;      // rank by momentum score (1 = strongest)
  goldSignal: string;
  goldSignalTh: string;
  updatedAt: string;
}

const ASSETS = [
  { symbol: "GC%3DF",  name: "Gold (XAUUSD)",    nameTh: "ทองคำ (XAUUSD)", color: "#f5c451", goldRelation: "positive" as const },
  { symbol: "DX-Y.NYB", name: "USD Index (DXY)",  nameTh: "ดัชนี USD (DXY)",color: "#60a5fa", goldRelation: "negative" as const },
  { symbol: "%5EGSPC",  name: "S&P 500",          nameTh: "S&P 500",          color: "#34d399", goldRelation: "mixed" as const },
  { symbol: "TLT",      name: "20Y Treasury (TLT)",nameTh: "พันธบัตร 20Y",   color: "#c084fc", goldRelation: "positive" as const },
  { symbol: "CL%3DF",   name: "Oil (WTI)",         nameTh: "น้ำมัน WTI",      color: "#f97316", goldRelation: "mixed" as const },
  { symbol: "SI%3DF",   name: "Silver",            nameTh: "เงิน (Silver)",   color: "#94a3b8", goldRelation: "positive" as const },
];

async function fetchReturns(symbol: string): Promise<{ prices: number[]; ts: number[] } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=90d&interval=1d&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const closes: (number|null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const timestamps: number[] = result.timestamp ?? [];
  const prices: number[] = [];
  const ts: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] != null) { prices.push(closes[i]!); ts.push(timestamps[i]); }
  }
  return prices.length >= 5 ? { prices, ts } : null;
}

function pctChange(prices: number[], n: number): number {
  const len = prices.length;
  if (len <= n) return 0;
  return ((prices[len - 1] - prices[len - 1 - n]) / prices[len - 1 - n]) * 100;
}

function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const avgG = gains / period;
  const avgL = losses / period;
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + avgG / avgL);
}

function momentumScore(c1: number, c5: number, c20: number, c60: number, rsi: number): number {
  const norm = (v: number, max: number) => Math.max(-1, Math.min(1, v / max));
  const score =
    norm(c1,  3)  * 15 +
    norm(c5,  5)  * 20 +
    norm(c20, 10) * 30 +
    norm(c60, 20) * 25 +
    ((rsi - 50) / 50) * 10;
  return Math.max(0, Math.min(100, Math.round(50 + score * 0.5)));
}

function trend(score: number): AssetMomentum["trend"] {
  if (score >= 75) return "strong_up";
  if (score >= 58) return "up";
  if (score >= 43) return "flat";
  if (score >= 28) return "down";
  return "strong_down";
}

let CACHE: { data: MomentumPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const results = await Promise.allSettled(ASSETS.map(a => fetchReturns(a.symbol)));
    const assets: AssetMomentum[] = [];

    for (let i = 0; i < ASSETS.length; i++) {
      const a = ASSETS[i];
      const r = results[i];
      if (r.status === "rejected" || !r.value) continue;
      const { prices } = r.value;
      const c1  = pctChange(prices, 1);
      const c5  = pctChange(prices, 5);
      const c20 = pctChange(prices, 20);
      const c60 = pctChange(prices, 60);
      const rsi = calcRSI(prices);
      const ms  = momentumScore(c1, c5, c20, c60, rsi);
      assets.push({
        symbol:         a.symbol,
        name:           a.name,
        nameTh:         a.nameTh,
        price:          +prices[prices.length - 1].toFixed(2),
        change1d:       +c1.toFixed(3),
        change5d:       +c5.toFixed(3),
        change20d:      +c20.toFixed(3),
        change60d:      +c60.toFixed(3),
        rsi14:          +rsi.toFixed(1),
        momentumScore:  ms,
        trend:          trend(ms),
        color:          a.color,
        goldRelation:   a.goldRelation,
      });
    }

    // Sort by momentum score descending
    assets.sort((a, b) => b.momentumScore - a.momentumScore);
    const goldIdx = assets.findIndex(a => a.symbol === "GC%3DF");
    const goldRank = goldIdx + 1;
    const gold = assets.find(a => a.symbol === "GC%3DF");

    // Gold signal based on DXY vs Gold divergence
    const dxy = assets.find(a => a.symbol === "DX-Y.NYB");
    let goldSignal = "Neutral momentum — monitor for breakout.";
    let goldSignalTh = "Momentum เป็นกลาง — รอดู breakout";
    if (gold && dxy) {
      if (gold.change5d > 1 && dxy.change5d < -0.5)
        { goldSignal = "Bullish: Gold rising while USD weakening — strong positive setup."; goldSignalTh = "Bullish: ทองขึ้น USD ลง — setup บวกแข็งแกร่ง"; }
      else if (gold.change5d < -1 && dxy.change5d > 0.5)
        { goldSignal = "Bearish: Gold falling while USD strengthening — negative pressure."; goldSignalTh = "Bearish: ทองลง USD ขึ้น — แรงกดดันลบ"; }
      else if (gold.change5d > 0 && dxy.change5d > 0)
        { goldSignal = "Mixed: Both Gold and USD rising — safe-haven demand with strong dollar."; goldSignalTh = "Mixed: ทองและ USD ขึ้นพร้อมกัน — demand safe-haven สูง"; }
      else if (gold.momentumScore >= 65)
        { goldSignal = `Gold momentum is strong (${gold.momentumScore}/100) — trend following favored.`; goldSignalTh = `Momentum ทองแข็งแกร่ง (${gold.momentumScore}/100) — เอื้อต่อการ trend follow`; }
    }

    const data: MomentumPayload = {
      assets,
      goldRank,
      goldSignal,
      goldSignalTh,
      updatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
