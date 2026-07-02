import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface CentralBankEntry {
  country: string;
  countryTh: string;
  flag: string;
  totalTonnes: number;
  reservePct: number;         // gold as % of total FX reserves
  yoyChange: number;          // tonnes net bought/sold YoY (+ buy, - sell)
  trend: "buying" | "selling" | "stable";
  trendTh: string;
  trendColor: string;
  category: "western" | "emerging" | "asian" | "middle_east";
  lastUpdated: string;
}

export interface CBTrackerPayload {
  totalCBGold: number;        // sum of tracked countries, tonnes
  netBuyingYoY: number;       // net tonnes bought YoY across all CB
  buyingCountries: number;
  sellingCountries: number;
  topBuyer: string;
  topBuyerFlag: string;
  topBuyerTonnes: number;
  goldPrice: number;
  marketValueBn: number;      // total tracked CB gold in USD billion
  buyingPressureScore: number; // 0-100
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  entries: CentralBankEntry[];
  generatedAt: string;
}

// Static dataset — WGC data ~Q4 2024 / Q1 2025
const CB_DATA: CentralBankEntry[] = [
  {
    country: "United States", countryTh: "สหรัฐอเมริกา", flag: "🇺🇸",
    totalTonnes: 8133, reservePct: 73.3, yoyChange: 0,
    trend: "stable", trendTh: "คงที่", trendColor: "#9ca3af",
    category: "western", lastUpdated: "Q4 2024",
  },
  {
    country: "Germany", countryTh: "เยอรมนี", flag: "🇩🇪",
    totalTonnes: 3352, reservePct: 69.1, yoyChange: 0,
    trend: "stable", trendTh: "คงที่", trendColor: "#9ca3af",
    category: "western", lastUpdated: "Q4 2024",
  },
  {
    country: "Italy", countryTh: "อิตาลี", flag: "🇮🇹",
    totalTonnes: 2452, reservePct: 64.5, yoyChange: 0,
    trend: "stable", trendTh: "คงที่", trendColor: "#9ca3af",
    category: "western", lastUpdated: "Q4 2024",
  },
  {
    country: "France", countryTh: "ฝรั่งเศส", flag: "🇫🇷",
    totalTonnes: 2437, reservePct: 61.1, yoyChange: 0,
    trend: "stable", trendTh: "คงที่", trendColor: "#9ca3af",
    category: "western", lastUpdated: "Q4 2024",
  },
  {
    country: "Russia", countryTh: "รัสเซีย", flag: "🇷🇺",
    totalTonnes: 2335, reservePct: 28.6, yoyChange: 23,
    trend: "buying", trendTh: "ซื้อ", trendColor: "#34d399",
    category: "emerging", lastUpdated: "Q3 2024",
  },
  {
    country: "China", countryTh: "จีน", flag: "🇨🇳",
    totalTonnes: 2264, reservePct: 5.3, yoyChange: 44,
    trend: "buying", trendTh: "ซื้อ", trendColor: "#34d399",
    category: "asian", lastUpdated: "Q4 2024",
  },
  {
    country: "Switzerland", countryTh: "สวิตเซอร์แลนด์", flag: "🇨🇭",
    totalTonnes: 1040, reservePct: 6.9, yoyChange: 0,
    trend: "stable", trendTh: "คงที่", trendColor: "#9ca3af",
    category: "western", lastUpdated: "Q4 2024",
  },
  {
    country: "Japan", countryTh: "ญี่ปุ่น", flag: "🇯🇵",
    totalTonnes: 846, reservePct: 5.8, yoyChange: 0,
    trend: "stable", trendTh: "คงที่", trendColor: "#9ca3af",
    category: "asian", lastUpdated: "Q4 2024",
  },
  {
    country: "India", countryTh: "อินเดีย", flag: "🇮🇳",
    totalTonnes: 840, reservePct: 8.7, yoyChange: 72,
    trend: "buying", trendTh: "ซื้อ", trendColor: "#34d399",
    category: "asian", lastUpdated: "Q4 2024",
  },
  {
    country: "Netherlands", countryTh: "เนเธอร์แลนด์", flag: "🇳🇱",
    totalTonnes: 612, reservePct: 59.4, yoyChange: 0,
    trend: "stable", trendTh: "คงที่", trendColor: "#9ca3af",
    category: "western", lastUpdated: "Q4 2024",
  },
  {
    country: "Turkey", countryTh: "ตุรกี", flag: "🇹🇷",
    totalTonnes: 570, reservePct: 29.5, yoyChange: 82,
    trend: "buying", trendTh: "ซื้อ", trendColor: "#34d399",
    category: "middle_east", lastUpdated: "Q4 2024",
  },
  {
    country: "Poland", countryTh: "โปแลนด์", flag: "🇵🇱",
    totalTonnes: 377, reservePct: 13.4, yoyChange: 130,
    trend: "buying", trendTh: "ซื้อ", trendColor: "#34d399",
    category: "western", lastUpdated: "Q4 2024",
  },
  {
    country: "Kazakhstan", countryTh: "คาซัคสถาน", flag: "🇰🇿",
    totalTonnes: 287, reservePct: 55.4, yoyChange: 15,
    trend: "buying", trendTh: "ซื้อ", trendColor: "#34d399",
    category: "emerging", lastUpdated: "Q3 2024",
  },
  {
    country: "Singapore", countryTh: "สิงคโปร์", flag: "🇸🇬",
    totalTonnes: 230, reservePct: 4.3, yoyChange: 5,
    trend: "buying", trendTh: "ซื้อ", trendColor: "#34d399",
    category: "asian", lastUpdated: "Q2 2024",
  },
  {
    country: "Czech Republic", countryTh: "สาธารณรัฐเช็ก", flag: "🇨🇿",
    totalTonnes: 44, reservePct: 1.8, yoyChange: 20,
    trend: "buying", trendTh: "ซื้อ", trendColor: "#34d399",
    category: "western", lastUpdated: "Q3 2024",
  },
];

let CACHE: { data: CBTrackerPayload; ts: number } | null = null;
const TTL = 4 * 60 * 60 * 1000; // 4h (CB data is monthly, no need to refresh often)

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch live gold price only
    let goldPrice = 3200;
    try {
      const r = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=2d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
      );
      type YJ = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
      const j = await r.json() as YJ;
      goldPrice = j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3200;
    } catch { /* use default */ }

    const totalCBGold = CB_DATA.reduce((s, e) => s + e.totalTonnes, 0);
    const netBuyingYoY = CB_DATA.reduce((s, e) => s + e.yoyChange, 0);
    const buyingCountries = CB_DATA.filter(e => e.trend === "buying").length;
    const sellingCountries = CB_DATA.filter(e => e.trend === "selling").length;

    // Sort by YoY buying to find top buyer
    const sorted = [...CB_DATA].sort((a, b) => b.yoyChange - a.yoyChange);
    const topBuyer = sorted[0];

    // Market value in USD billion (1 tonne = 32,150.7 troy oz)
    const OZ_PER_TONNE = 32150.7;
    const marketValueBn = Math.round((totalCBGold * OZ_PER_TONNE * goldPrice) / 1e9);

    // Buying pressure score: 0-100
    // Factors: % countries buying, net tonnes YoY vs historical avg (~400-600t/year is strong)
    const buyPct = buyingCountries / CB_DATA.length;
    const netScore = Math.min(1, netBuyingYoY / 500); // 500t = max reference
    const buyingPressureScore = Math.round((buyPct * 60 + netScore * 40) * 100);
    const cappedScore = Math.min(100, buyingPressureScore);

    const goldBias: CBTrackerPayload["goldBias"] =
      cappedScore >= 60 ? "bullish" : cappedScore >= 35 ? "neutral" : "bearish";

    const data: CBTrackerPayload = {
      totalCBGold: Math.round(totalCBGold),
      netBuyingYoY: Math.round(netBuyingYoY),
      buyingCountries,
      sellingCountries,
      topBuyer: topBuyer.countryTh,
      topBuyerFlag: topBuyer.flag,
      topBuyerTonnes: topBuyer.yoyChange,
      goldPrice: Math.round(goldPrice),
      marketValueBn,
      buyingPressureScore: cappedScore,
      goldBias,
      goldBiasTh: goldBias === "bullish"
        ? "Bullish — ธนาคารกลางโลกซื้อทองสุทธิ หนุน demand ระยะยาว"
        : goldBias === "bearish"
        ? "Bearish — ธนาคารกลางขายทองสุทธิ กดดัน demand"
        : "Neutral — การซื้อขายทองของธนาคารกลางใกล้สมดุล",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      entries: CB_DATA.slice().sort((a, b) => b.totalTonnes - a.totalTonnes),
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
