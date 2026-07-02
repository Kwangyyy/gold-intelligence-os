import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface M2Entry {
  country: string;
  countryTh: string;
  currency: string;
  m2Trillions: number;      // USD equivalent
  yoyGrowthPct: number;     // year-over-year % change
  momGrowthPct: number;     // month-over-month % change
  trend: "expanding" | "stable" | "contracting";
  trendColor: string;
  goldImpact: "bullish" | "neutral" | "bearish";
  goldImpactTh: string;
  note: string;
  lastUpdated: string;      // YYYY-MM
}

export interface MoneySupplyPayload {
  totalM2Usd: number;        // global M2 in USD trillions
  globalYoyGrowth: number;   // weighted avg YoY %
  liquiditySignal: "expanding" | "stable" | "contracting";
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasColor: string;
  goldBiasTh: string;
  liquidityScore: number;    // 0-100 (100 = max liquidity expansion)
  entries: M2Entry[];
  goldPrice: number;
  generatedAt: string;
}

// Static M2 data — updated quarterly from central bank reports (as of May 2026)
// USD amounts converted at approximate exchange rates
const STATIC_M2: Omit<M2Entry, "trend" | "trendColor" | "goldImpact" | "goldImpactTh">[] = [
  {
    country: "United States",
    countryTh: "สหรัฐอเมริกา",
    currency: "USD",
    m2Trillions: 21.2,
    yoyGrowthPct: 3.8,
    momGrowthPct: 0.4,
    note: "Fed tightening ended; M2 recovering from 2023 contraction",
    lastUpdated: "2026-05",
  },
  {
    country: "Eurozone",
    countryTh: "ยูโรโซน",
    currency: "EUR",
    m2Trillions: 16.4,
    yoyGrowthPct: 4.2,
    momGrowthPct: 0.5,
    note: "ECB rate cuts boosting broad money growth",
    lastUpdated: "2026-05",
  },
  {
    country: "China",
    countryTh: "จีน",
    currency: "CNY",
    m2Trillions: 39.1,
    yoyGrowthPct: 7.1,
    momGrowthPct: 0.6,
    note: "PBOC stimulus driving M2 expansion; largest global M2",
    lastUpdated: "2026-05",
  },
  {
    country: "Japan",
    countryTh: "ญี่ปุ่น",
    currency: "JPY",
    m2Trillions: 10.8,
    yoyGrowthPct: 1.2,
    momGrowthPct: 0.1,
    note: "BOJ normalizing policy; M2 growth slowing",
    lastUpdated: "2026-05",
  },
  {
    country: "United Kingdom",
    countryTh: "อังกฤษ",
    currency: "GBP",
    m2Trillions: 3.9,
    yoyGrowthPct: 2.8,
    momGrowthPct: 0.3,
    note: "BOE cutting rates; credit growth recovering",
    lastUpdated: "2026-05",
  },
  {
    country: "India",
    countryTh: "อินเดีย",
    currency: "INR",
    m2Trillions: 2.8,
    yoyGrowthPct: 10.4,
    momGrowthPct: 0.9,
    note: "Fastest growing major economy; M2 expansion robust",
    lastUpdated: "2026-05",
  },
];

function classifyTrend(yoy: number): { trend: M2Entry["trend"]; trendColor: string } {
  if (yoy > 6)  return { trend: "expanding",   trendColor: "#34d399" };
  if (yoy > 2)  return { trend: "stable",       trendColor: "#f5c451" };
  return           { trend: "contracting",  trendColor: "#f87171" };
}

function goldImpactFromM2(yoy: number): { goldImpact: M2Entry["goldImpact"]; goldImpactTh: string } {
  if (yoy > 7)  return { goldImpact: "bullish",  goldImpactTh: "เพิ่มสภาพคล่องสูง → หนุนทอง" };
  if (yoy > 4)  return { goldImpact: "bullish",  goldImpactTh: "สภาพคล่องขยายตัว → ดีต่อทอง" };
  if (yoy > 1)  return { goldImpact: "neutral",  goldImpactTh: "สภาพคล่องปกติ → neutral" };
  return           { goldImpact: "bearish",  goldImpactTh: "สภาพคล่องตึงตัว → กดดันทอง" };
}

// Liquidity score: higher M2 growth = higher score
function liquidityScore(entries: M2Entry[], weights: number[]): number {
  let score = 0;
  entries.forEach((e, i) => {
    const w = weights[i] ?? 1;
    // Scale: -3% → 0 pts, 0% → 20, 4% → 50, 8% → 80, 12%+ → 100
    const s = Math.min(100, Math.max(0, (e.yoyGrowthPct + 3) / 15 * 100));
    score += s * w;
  });
  return Math.round(score / weights.reduce((a, b) => a + b, 0));
}

// Weights by economic size (rough GDP proxy)
const WEIGHTS = [4.0, 2.8, 5.0, 1.5, 0.8, 0.9];

let CACHE: { data: MoneySupplyPayload; ts: number } | null = null;
const TTL = 4 * 60 * 60 * 1000; // 4h — static data

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch live gold price
    let goldPrice = 3200;
    try {
      const r  = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
      );
      const j  = await r.json();
      goldPrice = j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? goldPrice;
    } catch { /* keep fallback */ }

    // Enrich static data
    const entries: M2Entry[] = STATIC_M2.map(m => {
      const { trend, trendColor } = classifyTrend(m.yoyGrowthPct);
      const { goldImpact, goldImpactTh } = goldImpactFromM2(m.yoyGrowthPct);
      return { ...m, trend, trendColor, goldImpact, goldImpactTh };
    });

    const totalM2Usd = entries.reduce((s, e) => s + e.m2Trillions, 0);
    const weightedYoy = entries.reduce((s, e, i) => s + e.yoyGrowthPct * (WEIGHTS[i] ?? 1), 0)
                      / WEIGHTS.reduce((a, b) => a + b, 0);
    const globalYoyGrowth = parseFloat(weightedYoy.toFixed(2));

    const score = liquidityScore(entries, WEIGHTS);

    const liquiditySignal: M2Entry["trend"] =
      globalYoyGrowth > 5 ? "expanding" : globalYoyGrowth > 2 ? "stable" : "contracting";

    const goldBias: MoneySupplyPayload["goldBias"] =
      score >= 60 ? "bullish" : score >= 35 ? "neutral" : "bearish";

    const data: MoneySupplyPayload = {
      totalM2Usd:     parseFloat(totalM2Usd.toFixed(1)),
      globalYoyGrowth,
      liquiditySignal,
      goldBias,
      goldBiasColor:  goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      goldBiasTh:
        goldBias === "bullish" ? "Bullish — สภาพคล่องโลกขยายตัว หนุนราคาทอง"
        : goldBias === "bearish" ? "Bearish — สภาพคล่องตึงตัว กดดันสินทรัพย์เสี่ยง"
        : "Neutral — สภาพคล่องอยู่ในระดับปกติ",
      liquidityScore: score,
      entries,
      goldPrice:      Math.round(goldPrice),
      generatedAt:    new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
