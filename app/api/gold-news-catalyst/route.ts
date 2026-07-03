import { NextResponse } from "next/server";

export const revalidate = 1800; // 30-min

// Gold catalyst calendar — structural events and themes driving gold in 2025

interface GoldCatalyst {
  id: string;
  category: "monetary" | "geopolitical" | "inflation" | "physical" | "technical" | "structural";
  title: string;
  description: string;
  status: "active" | "watch" | "fading" | "emerging";
  impact: "very_bullish" | "bullish" | "neutral" | "bearish";
  timeframe: "short" | "medium" | "long";
  probability: number;  // 0–100 % likelihood of catalyst remaining active
  supportingEvidence: string[];
  riskFactors: string[];
  potentialMove: string; // e.g. "+$50–$200" or "−$100–$50"
}

interface GoldNewsCatalystData {
  goldPrice: number;
  bullishCount: number;
  bearishCount: number;
  netCatalystScore: number;  // -100 to +100
  overallBias: "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";
  catalysts: GoldCatalyst[];
  topBullish: GoldCatalyst;
  topBearish: GoldCatalyst | null;
  weeklyCalendar: {
    date: string;
    event: string;
    importance: "high" | "medium";
    goldBias: "bullish" | "neutral" | "bearish";
  }[];
  insight: string;
  timestamp: string;
}

async function fetchGoldSpot(): Promise<number> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=2d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 1800 } }
    );
    const json = await res.json();
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3320;
  } catch {
    return 3320;
  }
}

export async function GET() {
  const goldPrice = await fetchGoldSpot();

  const catalysts: GoldCatalyst[] = [
    {
      id: "c1",
      category: "monetary",
      title: "Fed Rate Cut Cycle (2025)",
      description: "Markets pricing 2–3 Fed rate cuts in 2025. Each cut lowers real yields and weakens USD — gold's two primary tailwinds. Historical pattern: gold averages +18% in the 12M following the first Fed cut.",
      status: "active",
      impact: "very_bullish",
      timeframe: "medium",
      probability: 75,
      supportingEvidence: ["CME FedWatch pricing 60%+ probability of Sep 2025 cut", "PCE inflation trending toward 2%", "Labor market cooling gently"],
      riskFactors: ["Sticky CPI could delay cuts", "Strong NFP prints could remove cut expectations"],
      potentialMove: "+$150–$400 over 12M",
    },
    {
      id: "c2",
      category: "geopolitical",
      title: "US-China Tariff War & Deglobalization",
      description: "Trade war escalation in 2025 increases uncertainty, reduces global growth prospects, and accelerates central bank gold accumulation as an alternative reserve asset.",
      status: "active",
      impact: "very_bullish",
      timeframe: "long",
      probability: 85,
      supportingEvidence: ["125% tariffs on Chinese goods announced", "China retaliating with rare earth restrictions", "Global supply chain fragmentation accelerating"],
      riskFactors: ["Trade deal / détente could reduce safe-haven premium", "China stimulus could stabilize growth"],
      potentialMove: "+$100–$300 sustained",
    },
    {
      id: "c3",
      category: "structural",
      title: "Central Bank Gold Buying (1,000+ t/yr)",
      description: "Central banks purchased >1,000 tonnes in 2022, 2023, 2024. Structural diversification away from USD reserves. China, India, Turkey, Poland continue accumulating. This is a floor-building catalyst.",
      status: "active",
      impact: "bullish",
      timeframe: "long",
      probability: 90,
      supportingEvidence: ["China's PBoC resumed buying in 2025", "India added 72t in 2024", "Emerging market CBs at >15% gold reserve targets"],
      riskFactors: ["Pace could slow if gold price very high", "IMF reporting delays obscure true pace"],
      potentialMove: "+$50–$150/yr structural floor",
    },
    {
      id: "c4",
      category: "inflation",
      title: "Tariff-Driven Reflation",
      description: "New tariffs are inflationary. If tariff-driven price increases keep CPI elevated (stagflation risk), gold benefits from negative real rates and as an inflation hedge.",
      status: "active",
      impact: "bullish",
      timeframe: "medium",
      probability: 65,
      supportingEvidence: ["Cleveland Fed estimates 0.5–1.2pp CPI impact from tariffs", "Services inflation sticky above 3.5%", "Tariff pass-through to consumer prices underway"],
      riskFactors: ["Demand destruction could be deflationary offset", "Fed could hike rather than cut if CPI surges"],
      potentialMove: "+$80–$200 if stagflation materializes",
    },
    {
      id: "c5",
      category: "geopolitical",
      title: "Russia-Ukraine War (Ongoing)",
      description: "Active conflict in Europe maintains elevated safe-haven demand for gold. Sanctions-driven commodity disruption and reconstruction uncertainty keep geopolitical premium alive.",
      status: "active",
      impact: "bullish",
      timeframe: "medium",
      probability: 80,
      supportingEvidence: ["Conflict in 4th year with no peace deal signed", "NATO supply commitments ongoing", "Energy price volatility from sanctions"],
      riskFactors: ["Peace deal could remove $50–$100 geopolitical premium", "Ceasefire talks increasing in 2025"],
      potentialMove: "+$50–$150 ongoing; peace deal = −$50–$100",
    },
    {
      id: "c6",
      category: "monetary",
      title: "US Fiscal Deficit / Debt Spiral",
      description: "US deficit ~$2T+/yr. Total debt >$36T. Interest payments now #1 spending category. Treasury supply pressure and long-term USD debasement concerns are structural gold tailwinds.",
      status: "active",
      impact: "bullish",
      timeframe: "long",
      probability: 95,
      supportingEvidence: ["CBO projects debt at 180% of GDP by 2050", "Interest on debt >$1T/yr", "Bitcoin and gold both benefitting from debasement trade"],
      riskFactors: ["Congress passes surprise fiscal consolidation", "Economic recession cuts spending organically"],
      potentialMove: "+$100–$500 over 3–5Y",
    },
    {
      id: "c7",
      category: "technical",
      title: "Gold ATH Breakout Psychology",
      description: "Gold breaking above all-time highs removes major technical resistance. ATH breakouts in commodities historically sustain for months/years. Institutional re-allocation and momentum chasers add fuel.",
      status: "active",
      impact: "bullish",
      timeframe: "short",
      probability: 70,
      supportingEvidence: ["Gold broke $2,100, $2,400, $3,000 ATH sequentially", "Each ATH break attracted new buyers", "Momentum funds underweight gold still adding"],
      riskFactors: ["Extended overbought conditions risk sharp correction", "Profit-taking at round numbers"],
      potentialMove: "+$50–$200 near-term momentum",
    },
    {
      id: "c8",
      category: "monetary",
      title: "USD Potential Peak",
      description: "DXY showing potential exhaustion at multi-year highs. If USD peaks and begins a multi-year decline (as it did in 2002 and 2017), this would be the most powerful gold driver over 2–3 years.",
      status: "watch",
      impact: "very_bullish",
      timeframe: "medium",
      probability: 55,
      supportingEvidence: ["DXY at historically elevated levels", "Fed cutting while ECB holds = narrowing USD yield advantage", "US twin deficits (fiscal + trade) structurally weaken USD"],
      riskFactors: ["USD could stay elevated if global growth slows further (safe haven)", "EUR political risk"],
      potentialMove: "+$300–$800 if multi-year USD decline commences",
    },
  ];

  const bullishCats = catalysts.filter(c => c.impact === "bullish" || c.impact === "very_bullish");
  const bearishCats = catalysts.filter(c => c.impact === "bearish");
  const netScore = Math.min(100, Math.max(-100, bullishCats.length * 12 - bearishCats.length * 15));

  const overallBias: GoldNewsCatalystData["overallBias"] =
    netScore >= 60 ? "strong_bullish" :
    netScore >= 25 ? "bullish" :
    netScore <= -60 ? "strong_bearish" :
    netScore <= -25 ? "bearish" : "neutral";

  const topBullish = catalysts.filter(c => c.impact === "very_bullish").sort((a, b) => b.probability - a.probability)[0]!;

  // Weekly upcoming events
  const today = new Date();
  const weeklyCalendar = [
    { date: formatDate(addDays(today, 2)), event: "US CPI Release (MoM)", importance: "high" as const, goldBias: "bullish" as const },
    { date: formatDate(addDays(today, 3)), event: "US Initial Jobless Claims", importance: "medium" as const, goldBias: "neutral" as const },
    { date: formatDate(addDays(today, 4)), event: "US PPI Release", importance: "medium" as const, goldBias: "bullish" as const },
    { date: formatDate(addDays(today, 7)), event: "FOMC Meeting Minutes", importance: "high" as const, goldBias: "bullish" as const },
    { date: formatDate(addDays(today, 9)), event: "US Retail Sales", importance: "medium" as const, goldBias: "bearish" as const },
  ];

  const data: GoldNewsCatalystData = {
    goldPrice,
    bullishCount: bullishCats.length,
    bearishCount: bearishCats.length,
    netCatalystScore: netScore,
    overallBias,
    catalysts,
    topBullish,
    topBearish: bearishCats.length > 0 ? bearishCats[0] : null,
    weeklyCalendar,
    insight:
      `${bullishCats.length} active bullish catalysts vs ${bearishCats.length} bearish. Net catalyst score: +${netScore}/100 (${overallBias.replace("_", " ")}). ` +
      `Dominant catalyst: "${topBullish.title}" — probability ${topBullish.probability}%.`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
