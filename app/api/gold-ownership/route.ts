import { NextResponse } from "next/server";

export const revalidate = 86400; // 24h — structural data changes slowly

interface OwnershipSegment {
  name: string;
  icon: string;
  totalTonnes: number;
  pctOfAll: number;
  trend: "increasing" | "stable" | "decreasing";
  trendNote: string;
  goldImplication: string;
  color: string;
}

interface TopHolder {
  rank: number;
  name: string;
  flag: string;
  tonnes: number;
  pctOfReserves: number;
  trend: "buying" | "stable" | "selling";
}

interface GoldOwnershipData {
  totalAboveGroundTonnes: number;
  totalInvestmentTonnes: number;
  segments: OwnershipSegment[];
  topCentralBanks: TopHolder[];
  topEtfs: { name: string; tonnes: number; change1y: number }[];
  demandSignal: "strong" | "moderate" | "neutral" | "weak";
  insight: string;
  timestamp: string;
}

export async function GET() {
  // WGC data as of 2024 — approximate allocations
  const totalAboveGround = 212_582; // tonnes

  const segments: OwnershipSegment[] = [
    {
      name: "Jewelry",
      icon: "💍",
      totalTonnes: 95_547,
      pctOfAll: 44.9,
      trend: "stable",
      trendNote: "Jewelry demand is the largest segment. Asian (India/China) demand is the primary driver.",
      goldImplication: "Stable jewelry demand provides a structural price floor. Rising Asian middle class expands this base over time.",
      color: "#f5c451",
    },
    {
      name: "Private Investment",
      icon: "🪙",
      totalTonnes: 44_642,
      pctOfAll: 21.0,
      trend: "increasing",
      trendNote: "Bars, coins, and private vaults growing fastest. Record retail demand in 2022-2024.",
      goldImplication: "Rising private investment demand is bullish — signals distrust in fiat currency and financial system.",
      color: "#34d399",
    },
    {
      name: "Central Banks",
      icon: "🏦",
      totalTonnes: 37_755,
      pctOfAll: 17.8,
      trend: "increasing",
      trendNote: "Central banks have been net buyers since 2010. 2022-2024 saw record purchase volumes.",
      goldImplication: "Central bank buying is structural, price-insensitive buying. Very bullish long-term. Key buyers: China, Poland, Turkey, India.",
      color: "#60a5fa",
    },
    {
      name: "Gold ETFs",
      icon: "📈",
      totalTonnes: 3_110,
      pctOfAll: 1.5,
      trend: "decreasing",
      trendNote: "ETF holdings declined from 2020 peak (~3,900t) as rates rose. Now stabilizing near 3,100t.",
      goldImplication: "ETF outflows have been a headwind since 2022. If rates fall, ETF inflows could be a powerful catalyst — small pct but very price-sensitive.",
      color: "#fb923c",
    },
    {
      name: "Industrial & Tech",
      icon: "⚙️",
      totalTonnes: 27_965,
      pctOfAll: 13.2,
      trend: "increasing",
      trendNote: "Electronics, medical, dental. Semiconductor and AI hardware driving industrial gold use higher.",
      goldImplication: "Tech demand (~330t/year) creates price-insensitive, steady demand baseline.",
      color: "#a78bfa",
    },
    {
      name: "Unaccounted",
      icon: "🌐",
      totalTonnes: 3_563,
      pctOfAll: 1.7,
      trend: "stable",
      trendNote: "Lost, destroyed, or undiscovered sources.",
      goldImplication: "Negligible investment implication.",
      color: "#94a3b8",
    },
  ];

  const topCentralBanks: TopHolder[] = [
    { rank: 1, name: "United States",  flag: "🇺🇸", tonnes: 8133,  pctOfReserves: 65.5, trend: "stable"   },
    { rank: 2, name: "Germany",        flag: "🇩🇪", tonnes: 3353,  pctOfReserves: 66.2, trend: "stable"   },
    { rank: 3, name: "Italy",          flag: "🇮🇹", tonnes: 2452,  pctOfReserves: 58.6, trend: "stable"   },
    { rank: 4, name: "France",         flag: "🇫🇷", tonnes: 2437,  pctOfReserves: 60.8, trend: "stable"   },
    { rank: 5, name: "Russia",         flag: "🇷🇺", tonnes: 2333,  pctOfReserves: 26.5, trend: "buying"   },
    { rank: 6, name: "China",          flag: "🇨🇳", tonnes: 2264,  pctOfReserves: 4.9,  trend: "buying"   },
    { rank: 7, name: "Switzerland",    flag: "🇨🇭", tonnes: 1040,  pctOfReserves: 7.0,  trend: "stable"   },
    { rank: 8, name: "India",          flag: "🇮🇳", tonnes: 840,   pctOfReserves: 9.5,  trend: "buying"   },
    { rank: 9, name: "Japan",          flag: "🇯🇵", tonnes: 846,   pctOfReserves: 4.5,  trend: "stable"   },
    { rank: 10, name: "Netherlands",   flag: "🇳🇱", tonnes: 612,   pctOfReserves: 54.4, trend: "stable"   },
  ];

  const topEtfs = [
    { name: "SPDR GLD",   tonnes: 862,  change1y: -58  },
    { name: "iShares IAU", tonnes: 459, change1y: -22  },
    { name: "SPDR GLDM",  tonnes: 116,  change1y: +12  },
    { name: "Invesco IAUM", tonnes: 65, change1y: +4   },
    { name: "WisdomTree",  tonnes: 215,  change1y: -18  },
  ];

  // Determine demand signal
  const buyingCBs = topCentralBanks.filter(c => c.trend === "buying").length;
  const etfChange = topEtfs.reduce((s, e) => s + e.change1y, 0);
  const privateTrend = segments.find(s => s.name === "Private Investment")?.trend;
  let demandSignal: GoldOwnershipData["demandSignal"] = "neutral";
  if (buyingCBs >= 3 && privateTrend === "increasing") demandSignal = "strong";
  else if (buyingCBs >= 2) demandSignal = "moderate";
  else if (etfChange < -100 && buyingCBs === 0) demandSignal = "weak";

  const data: GoldOwnershipData = {
    totalAboveGroundTonnes: totalAboveGround,
    totalInvestmentTonnes: segments.find(s => s.name === "Private Investment")!.totalTonnes +
                           segments.find(s => s.name === "Gold ETFs")!.totalTonnes +
                           segments.find(s => s.name === "Central Banks")!.totalTonnes,
    segments,
    topCentralBanks,
    topEtfs,
    demandSignal,
    insight:
      `Of the ~${(totalAboveGround / 1000).toFixed(0)},000 tonnes of gold ever mined, jewelry (${segments[0].pctOfAll}%) remains the largest holder. ` +
      `Investment demand (private + ETF + CB) totals ~40% of all above-ground gold. ` +
      `Central bank buying is the most bullish structural trend — ${topCentralBanks.filter(c => c.trend === "buying").map(c => c.name).join(", ")} are actively accumulating.`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
