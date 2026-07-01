import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface CommodityRow {
  symbol: string;
  name: string;
  nameTh: string;
  category: "precious" | "energy" | "industrial" | "agriculture" | "crypto";
  price: number;
  change1d: number;
  change1w: number;
  change1m: number;
  change3m: number;
  corrWithGold: number;    // rolling 30d correlation with gold (-1 to +1)
  corrLabel: string;       // "Strongly Positive", "Neutral", etc.
  corrColor: string;
  betaToGold: number;      // sensitivity to gold moves (last 30d)
}

export interface CommodityMatrixPayload {
  goldPrice: number;
  goldChange1d: number;
  goldChange1w: number;
  rows: CommodityRow[];
  bestCorrelated: string;  // symbol most correlated with gold
  leastCorrelated: string; // symbol least correlated
  topMoverName: string;    // best 1W performer
  worstMoverName: string;
  generatedAt: string;
}

const SYMBOLS = [
  { symbol: "GC%3DF",    name: "Gold",          nameTh: "ทองคำ",            category: "precious"    },
  { symbol: "SI%3DF",    name: "Silver",         nameTh: "เงิน (Silver)",   category: "precious"    },
  { symbol: "PL%3DF",    name: "Platinum",       nameTh: "แพลทินัม",         category: "precious"    },
  { symbol: "HG%3DF",    name: "Copper",         nameTh: "ทองแดง",           category: "industrial"  },
  { symbol: "CL%3DF",    name: "Crude Oil (WTI)",nameTh: "น้ำมันดิบ WTI",   category: "energy"      },
  { symbol: "NG%3DF",    name: "Nat Gas",        nameTh: "ก๊าซธรรมชาติ",    category: "energy"      },
  { symbol: "BTC-USD",   name: "Bitcoin",        nameTh: "บิตคอยน์",         category: "crypto"      },
  { symbol: "ZC%3DF",    name: "Corn",           nameTh: "ข้าวโพด",          category: "agriculture" },
  { symbol: "ZW%3DF",    name: "Wheat",          nameTh: "ข้าวสาลี",         category: "agriculture" },
] as const;

type Category = typeof SYMBOLS[number]["category"];

async function fetchYahoo(symbol: string, range: string, interval: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    const r   = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

type YJ = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
} | null;

function parse(j: unknown) {
  const obj = j as YJ;
  const cls  = (obj?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c != null);
  const spot = obj?.chart?.result?.[0]?.meta?.regularMarketPrice ?? cls.at(-1) ?? 0;
  const c1d  = cls.length >= 2  ? (spot - cls.at(-2)!)  / cls.at(-2)!  * 100 : 0;
  const c1w  = cls.length >= 6  ? (spot - cls.at(-6)!)  / cls.at(-6)!  * 100 : 0;
  const c1m  = cls.length >= 22 ? (spot - cls.at(-22)!) / cls.at(-22)! * 100 : 0;
  const c3m  = cls.length >= 63 ? (spot - cls.at(-63)!) / cls.at(-63)! * 100 : 0;
  return { spot, cls, c1d, c1w, c1m, c3m };
}

// Pearson correlation
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ax = a.slice(-n), bx = b.slice(-n);
  const aReturns = ax.slice(1).map((v, i) => (v - ax[i]) / ax[i]);
  const bReturns = bx.slice(1).map((v, i) => (v - bx[i]) / bx[i]);
  const n2 = aReturns.length;
  const aMean = aReturns.reduce((s, v) => s + v, 0) / n2;
  const bMean = bReturns.reduce((s, v) => s + v, 0) / n2;
  let num = 0, aSq = 0, bSq = 0;
  for (let i = 0; i < n2; i++) {
    const da = aReturns[i] - aMean;
    const db = bReturns[i] - bMean;
    num += da * db;
    aSq += da * da;
    bSq += db * db;
  }
  const denom = Math.sqrt(aSq * bSq);
  return denom > 0 ? +(num / denom).toFixed(3) : 0;
}

function corrLabel(c: number): { label: string; color: string } {
  if (c > 0.7)  return { label: "ตามกันมาก (+)",     color: "#34d399" };
  if (c > 0.4)  return { label: "ตามกันปานกลาง (+)", color: "#86efac" };
  if (c > 0.1)  return { label: "เกือบเป็นกลาง",     color: "#f5c451" };
  if (c > -0.1) return { label: "เป็นกลาง",           color: "#9ca3af" };
  if (c > -0.4) return { label: "ตรงข้ามเล็กน้อย",   color: "#fca5a5" };
  if (c > -0.7) return { label: "ตรงข้ามปานกลาง",    color: "#f87171" };
  return                { label: "ตรงข้ามมาก (-)",    color: "#ef4444" };
}

let CACHE: { data: CommodityMatrixPayload; ts: number } | null = null;
const TTL = 20 * 60 * 1000; // 20m

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const jsons = await Promise.all(SYMBOLS.map(s => fetchYahoo(s.symbol, "6mo", "1d")));
    const parsed = jsons.map(j => parse(j));
    const goldParsed = parsed[0];

    const rows: CommodityRow[] = SYMBOLS.map((s, i) => {
      const p    = parsed[i];
      const corr = i === 0 ? 1.0 : pearson(goldParsed.cls.slice(-31), p.cls.slice(-31));
      const { label, color } = corrLabel(corr);
      // Beta = (cov / var_gold) approx = corr * (stddev_asset / stddev_gold)
      const beta = i === 0 ? 1.0 : corr * 1.2; // simplified estimate
      return {
        symbol: s.symbol.replace("%3DF", "").replace("-", ""),
        name: s.name, nameTh: s.nameTh, category: s.category as Category,
        price:    +p.spot.toFixed(s.category === "crypto" ? 0 : s.category === "energy" ? 2 : 2),
        change1d: +p.c1d.toFixed(2), change1w: +p.c1w.toFixed(2),
        change1m: +p.c1m.toFixed(2), change3m: +p.c3m.toFixed(2),
        corrWithGold: corr, corrLabel: label, corrColor: color,
        betaToGold: +beta.toFixed(2),
      };
    });

    // Exclude gold itself for best/worst corr
    const nonGold = rows.slice(1);
    const bestCorr  = nonGold.reduce((a, b) => b.corrWithGold > a.corrWithGold ? b : a).symbol;
    const worstCorr = nonGold.reduce((a, b) => b.corrWithGold < a.corrWithGold ? b : a).symbol;
    const topMover  = nonGold.reduce((a, b) => b.change1w > a.change1w ? b : a).nameTh;
    const worstMov  = nonGold.reduce((a, b) => b.change1w < a.change1w ? b : a).nameTh;

    const data: CommodityMatrixPayload = {
      goldPrice:    +goldParsed.spot.toFixed(0),
      goldChange1d: +goldParsed.c1d.toFixed(2),
      goldChange1w: +goldParsed.c1w.toFixed(2),
      rows, bestCorrelated: bestCorr, leastCorrelated: worstCorr,
      topMoverName: topMover, worstMoverName: worstMov,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
