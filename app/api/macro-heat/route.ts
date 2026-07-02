import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface MacroCell {
  symbol: string;
  name: string;
  nameTh: string;
  price: number;
  change1d: number;       // % change 1 day
  change1w: number;       // % change 1 week
  change1m: number;       // % change 1 month
  heatColor: string;      // bg color for heat cell
  goldRelation: "positive" | "negative" | "neutral";  // when this moves up, gold...
  goldImpact: "bullish" | "neutral" | "bearish";       // current impact on gold
  goldImpactTh: string;
  category: "currency" | "rate" | "equity" | "commodity" | "crypto" | "volatility";
}

export interface MacroHeatPayload {
  cells: MacroCell[];
  compositeScore: number;   // 0-100 bullish for gold
  compositeSignal: "bullish" | "neutral" | "bearish";
  compositeTh: string;
  compositeColor: string;
  goldPrice: number;
  generatedAt: string;
}

const SYMBOLS: Array<{
  sym: string; name: string; nameTh: string;
  category: MacroCell["category"];
  goldRelation: MacroCell["goldRelation"];
}> = [
  { sym: "DX-Y.NYB", name: "DXY (Dollar Index)", nameTh: "ดัชนีดอลลาร์", category: "currency",   goldRelation: "negative" },
  { sym: "^TNX",     name: "10Y Yield",          nameTh: "ผลตอบแทน 10Y",  category: "rate",       goldRelation: "negative" },
  { sym: "^IRX",     name: "3M Yield",            nameTh: "ผลตอบแทน 3M",   category: "rate",       goldRelation: "negative" },
  { sym: "^VIX",     name: "VIX (Fear)",          nameTh: "ความกลัว VIX",  category: "volatility", goldRelation: "positive" },
  { sym: "^GSPC",    name: "S&P 500",             nameTh: "S&P 500",        category: "equity",     goldRelation: "negative" },
  { sym: "^IXIC",    name: "NASDAQ",              nameTh: "NASDAQ",         category: "equity",     goldRelation: "negative" },
  { sym: "CL=F",     name: "WTI Oil",             nameTh: "น้ำมัน WTI",    category: "commodity",  goldRelation: "positive" },
  { sym: "SI=F",     name: "Silver",              nameTh: "เงิน",           category: "commodity",  goldRelation: "positive" },
  { sym: "BTC-USD",  name: "Bitcoin",             nameTh: "Bitcoin",        category: "crypto",     goldRelation: "neutral"  },
  { sym: "GC=F",     name: "Gold",                nameTh: "ทองคำ",          category: "commodity",  goldRelation: "positive" },
];

type YChart = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: {
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
        quote?: Array<{ close?: (number | null)[] }>;
      };
    }>;
  };
};

async function fetchOHLC(sym: string): Promise<{ price: number; closes: number[] }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    const j = await r.json() as YChart;
    const res = j?.chart?.result?.[0];
    if (!res) return { price: 0, closes: [] };
    const price = res.meta?.regularMarketPrice ?? 0;
    const raw = res.indicators?.adjclose?.[0]?.adjclose ?? res.indicators?.quote?.[0]?.close ?? [];
    const closes = raw.filter((c): c is number => c !== null && c !== undefined && !isNaN(c));
    return { price, closes };
  } catch { return { price: 0, closes: [] }; }
}

function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return parseFloat(((to - from) / from * 100).toFixed(2));
}

function heatColor(chgPct: number, isInverse: boolean): string {
  const adj = isInverse ? -chgPct : chgPct;
  if (adj >  4) return "rgba(52,211,153,0.25)";
  if (adj >  2) return "rgba(52,211,153,0.14)";
  if (adj >  0.5) return "rgba(52,211,153,0.07)";
  if (adj > -0.5) return "rgba(255,255,255,0.03)";
  if (adj > -2) return "rgba(248,113,113,0.07)";
  if (adj > -4) return "rgba(248,113,113,0.14)";
  return "rgba(248,113,113,0.25)";
}

// Determine current gold impact from 1d move of this asset
function goldImpactNow(chg1d: number, relation: MacroCell["goldRelation"]): MacroCell["goldImpact"] {
  if (relation === "neutral") return "neutral";
  const aligned = relation === "positive" ? chg1d : -chg1d;
  if (aligned >  1)   return "bullish";
  if (aligned < -1)   return "bearish";
  return "neutral";
}

function goldImpactLabel(impact: MacroCell["goldImpact"], nameTh: string, chg1d: number): string {
  const dir = chg1d >= 0 ? "ขึ้น" : "ลง";
  if (impact === "bullish") return `${nameTh} ${dir} → หนุนทอง`;
  if (impact === "bearish") return `${nameTh} ${dir} → กดดันทอง`;
  return `${nameTh} → neutral ต่อทอง`;
}

let CACHE: { data: MacroHeatPayload; ts: number } | null = null;
const TTL = 10 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const results = await Promise.all(SYMBOLS.map(s => fetchOHLC(s.sym)));

    let goldPrice = 3200;
    const goldIdx = SYMBOLS.findIndex(s => s.sym === "GC=F");
    if (goldIdx >= 0 && results[goldIdx].price) goldPrice = results[goldIdx].price;

    const cells: MacroCell[] = SYMBOLS.map((s, i) => {
      const { price, closes } = results[i];
      const n = closes.length;
      const prev1d = closes[n - 2] ?? price;
      const prev1w = closes[Math.max(0, n - 6)] ?? price;
      const prev1m = closes[0] ?? price;

      const change1d = pctChange(prev1d, price);
      const change1w = pctChange(prev1w, price);
      const change1m = pctChange(prev1m, price);

      // For DXY and yields: "negative" means up is bad for gold
      const isInverse = s.goldRelation === "negative";
      const impact    = goldImpactNow(change1d, s.goldRelation);

      return {
        symbol: s.sym,
        name:   s.name,
        nameTh: s.nameTh,
        price:  parseFloat(price.toFixed(s.category === "rate" ? 3 : 2)),
        change1d, change1w, change1m,
        heatColor:    heatColor(change1d, isInverse),
        goldRelation: s.goldRelation,
        goldImpact:   impact,
        goldImpactTh: goldImpactLabel(impact, s.nameTh, change1d),
        category:     s.category,
      };
    });

    // Composite score: bullish cells contribute; bearish cells detract
    const nonGold = cells.filter(c => c.symbol !== "GC=F");
    let bullPoints = 0;
    nonGold.forEach(c => {
      if (c.goldImpact === "bullish") bullPoints += 15;
      else if (c.goldImpact === "neutral") bullPoints += 7;
    });
    const compositeScore = Math.min(100, Math.round(bullPoints / nonGold.length * 6.67));

    const compositeSignal: MacroHeatPayload["compositeSignal"] =
      compositeScore >= 60 ? "bullish" : compositeScore >= 35 ? "neutral" : "bearish";

    const data: MacroHeatPayload = {
      cells,
      compositeScore,
      compositeSignal,
      compositeTh:
        compositeSignal === "bullish" ? "สภาพแวดล้อม Macro เอื้อต่อทอง"
        : compositeSignal === "bearish" ? "สภาพแวดล้อม Macro กดดันทอง"
        : "สภาพแวดล้อม Macro Mixed",
      compositeColor: compositeSignal === "bullish" ? "#34d399" : compositeSignal === "bearish" ? "#f87171" : "#f5c451",
      goldPrice: Math.round(goldPrice),
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
