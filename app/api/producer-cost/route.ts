import { NextResponse } from "next/server";

export const revalidate = 86400; // 24h — cost data changes slowly

interface MinerData {
  name: string;
  country: string;
  flag: string;
  ticker: string;
  aisc: number;          // All-In Sustaining Cost per oz
  productionKoz: number; // annual production in koz
  margin: number;        // gold price - AISC
  marginPct: number;
  region: string;
  status: "profitable" | "breakeven" | "loss";
}

interface CostTierData {
  tier: string;
  aiscRange: string;
  miners: string[];
  pctOfProduction: number;
  status: "profitable" | "breakeven" | "loss";
  goldPrice: number;
}

interface ProducerCostData {
  goldPrice: number;
  industryAvgAISC: number;
  marginalCost: number;       // 90th percentile cost = support floor
  totalProduction: number;    // Moz/year global
  profitableMiners: number;   // % of production profitable
  miners: MinerData[];
  costTiers: CostTierData[];
  insight: string;
  timestamp: string;
}

async function fetchGoldSpot(): Promise<number> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=2d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 86400 } }
    );
    const json = await res.json();
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3320;
  } catch {
    return 3320;
  }
}

export async function GET() {
  const goldPrice = await fetchGoldSpot();

  // WGC 2024 data — AISC from publicly reported Q4 2024 results
  const miners: Omit<MinerData, "margin" | "marginPct" | "status">[] = [
    { name: "Coeur Mining",        country: "USA",       flag: "🇺🇸", ticker: "CDE",  aisc: 1820, productionKoz: 320,  region: "Americas" },
    { name: "Pan American Silver", country: "Canada",    flag: "🇨🇦", ticker: "PAAS", aisc: 1650, productionKoz: 540,  region: "Americas" },
    { name: "Kinross Gold",        country: "Canada",    flag: "🇨🇦", ticker: "KGC",  aisc: 1420, productionKoz: 2070, region: "Americas" },
    { name: "Gold Fields",         country: "S. Africa", flag: "🇿🇦", ticker: "GFI",  aisc: 1390, productionKoz: 2230, region: "Africa"   },
    { name: "Newmont",             country: "USA",       flag: "🇺🇸", ticker: "NEM",  aisc: 1370, productionKoz: 6900, region: "Global"   },
    { name: "AngloGold Ashanti",   country: "S. Africa", flag: "🇿🇦", ticker: "AU",   aisc: 1340, productionKoz: 2630, region: "Africa"   },
    { name: "Agnico Eagle",        country: "Canada",    flag: "🇨🇦", ticker: "AEM",  aisc: 1320, productionKoz: 3360, region: "Americas" },
    { name: "Barrick Gold",        country: "Canada",    flag: "🇨🇦", ticker: "GOLD", aisc: 1290, productionKoz: 4100, region: "Global"   },
    { name: "Wheaton Precious",    country: "Canada",    flag: "🇨🇦", ticker: "WPM",  aisc: 1250, productionKoz: 2380, region: "Global"   },
    { name: "Polyus",              country: "Russia",    flag: "🇷🇺", ticker: "PLZL", aisc: 840,  productionKoz: 2900, region: "Russia"   },
    { name: "Endeavour Mining",    country: "Canada",    flag: "🇨🇦", ticker: "EDV",  aisc: 1120, productionKoz: 1410, region: "Africa"   },
    { name: "Royal Gold",          country: "USA",       flag: "🇺🇸", ticker: "RGLD", aisc: 590,  productionKoz: 430,  region: "Americas" },
    { name: "Franco-Nevada",       country: "Canada",    flag: "🇨🇦", ticker: "FNV",  aisc: 490,  productionKoz: 860,  region: "Global"   },
  ].sort((a, b) => b.aisc - a.aisc);

  const fullMiners: MinerData[] = miners.map(m => {
    const margin = goldPrice - m.aisc;
    const marginPct = (margin / goldPrice) * 100;
    const status: MinerData["status"] =
      margin > 100 ? "profitable" :
      margin > -50 ? "breakeven" : "loss";
    return { ...m, margin: Math.round(margin), marginPct: parseFloat(marginPct.toFixed(1)), status };
  });

  const totalProduction = fullMiners.reduce((s, m) => s + m.productionKoz, 0);
  const profitableKoz   = fullMiners.filter(m => m.status === "profitable").reduce((s, m) => s + m.productionKoz, 0);
  const industryAvgAISC = Math.round(
    fullMiners.reduce((s, m) => s + m.aisc * m.productionKoz, 0) / totalProduction
  );

  // 90th percentile cost = marginal cost floor for gold
  const sorted = [...fullMiners].sort((a, b) => a.aisc - b.aisc);
  const idx90 = Math.floor(sorted.length * 0.9);
  const marginalCost = sorted[idx90]?.aisc ?? 1600;

  const costTiers: CostTierData[] = [
    {
      tier: "Royalty / Streaming",
      aiscRange: "< $700",
      miners: fullMiners.filter(m => m.aisc < 700).map(m => m.name),
      pctOfProduction: Math.round((fullMiners.filter(m => m.aisc < 700).reduce((s, m) => s + m.productionKoz, 0) / totalProduction) * 100),
      status: "profitable",
      goldPrice,
    },
    {
      tier: "Tier 1 Low Cost",
      aiscRange: "$700–$1,100",
      miners: fullMiners.filter(m => m.aisc >= 700 && m.aisc < 1100).map(m => m.name),
      pctOfProduction: Math.round((fullMiners.filter(m => m.aisc >= 700 && m.aisc < 1100).reduce((s, m) => s + m.productionKoz, 0) / totalProduction) * 100),
      status: "profitable",
      goldPrice,
    },
    {
      tier: "Tier 2 Mid Cost",
      aiscRange: "$1,100–$1,400",
      miners: fullMiners.filter(m => m.aisc >= 1100 && m.aisc < 1400).map(m => m.name),
      pctOfProduction: Math.round((fullMiners.filter(m => m.aisc >= 1100 && m.aisc < 1400).reduce((s, m) => s + m.productionKoz, 0) / totalProduction) * 100),
      status: goldPrice > 1400 ? "profitable" : "breakeven",
      goldPrice,
    },
    {
      tier: "Tier 3 High Cost",
      aiscRange: "$1,400–$1,800",
      miners: fullMiners.filter(m => m.aisc >= 1400 && m.aisc < 1800).map(m => m.name),
      pctOfProduction: Math.round((fullMiners.filter(m => m.aisc >= 1400 && m.aisc < 1800).reduce((s, m) => s + m.productionKoz, 0) / totalProduction) * 100),
      status: goldPrice > 1800 ? "profitable" : "loss",
      goldPrice,
    },
    {
      tier: "Marginal Producers",
      aiscRange: "> $1,800",
      miners: fullMiners.filter(m => m.aisc >= 1800).map(m => m.name),
      pctOfProduction: Math.round((fullMiners.filter(m => m.aisc >= 1800).reduce((s, m) => s + m.productionKoz, 0) / totalProduction) * 100),
      status: goldPrice > 1800 ? "breakeven" : "loss",
      goldPrice,
    },
  ];

  const data: ProducerCostData = {
    goldPrice,
    industryAvgAISC,
    marginalCost,
    totalProduction: Math.round(totalProduction / 1000),
    profitableMiners: Math.round((profitableKoz / totalProduction) * 100),
    miners: fullMiners,
    costTiers,
    insight:
      `At $${goldPrice.toLocaleString()}/oz, ${Math.round((profitableKoz / totalProduction) * 100)}% of sampled production is profitable. ` +
      `Industry avg AISC ~$${industryAvgAISC}/oz, margin = $${goldPrice - industryAvgAISC}/oz (+${((goldPrice - industryAvgAISC) / goldPrice * 100).toFixed(0)}%). ` +
      `Marginal cost (90th %ile) at $${marginalCost}/oz provides structural price support.`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
