import { NextResponse } from "next/server";

export const revalidate = 3600; // 1h

interface SupplyRisk {
  id: string;
  country: string;
  flag: string;
  category: "mine_strike" | "country_risk" | "refinery" | "export_ban" | "natural_disaster";
  severity: "critical" | "high" | "moderate" | "low";
  status: "active" | "resolved" | "monitoring";
  title: string;
  description: string;
  miningShareOfWorld: number; // % of world gold production
  estimatedImpactTonnes: number; // potential annual disruption in tonnes
  startDate: string;
  goldImpact: "very_bullish" | "bullish" | "neutral" | "bearish";
}

interface CountryConcentration {
  country: string;
  flag: string;
  productionTonnes: number;
  pctOfWorld: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  notes: string;
}

interface SupplyShockData {
  goldPrice: number;
  totalWorldProduction: number; // tonnes/year
  activeDisruptions: number;
  estimatedSupplyAtRiskTonnes: number;
  supplyAtRiskPct: number;
  overallSignal: "very_bullish" | "bullish" | "neutral" | "bearish";
  risks: SupplyRisk[];
  topProducers: CountryConcentration[];
  concentrationRisk: string;
  insight: string;
  timestamp: string;
}

async function fetchGoldSpot(): Promise<number> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=2d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    const json = await res.json();
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3320;
  } catch {
    return 3320;
  }
}

export async function GET() {
  const goldPrice = await fetchGoldSpot();

  // WGC 2024 world production ~3,661 tonnes/year
  const totalWorldProduction = 3661;

  // Representative supply risks (research-based, indicative of real patterns)
  const risks: SupplyRisk[] = [
    {
      id: "r1",
      country: "Russia",
      flag: "🇷🇺",
      category: "country_risk",
      severity: "high",
      status: "active",
      title: "Russia Sanctions & G7 Trade Restrictions",
      description: "G7 banned import of Russian gold (Polyus: 2.9Moz/yr). Russian gold diverted to China, India, UAE. Creates dual market pricing and supply chain fragmentation.",
      miningShareOfWorld: 9.3,
      estimatedImpactTonnes: 340,
      startDate: "2022-06",
      goldImpact: "bullish",
    },
    {
      id: "r2",
      country: "Mali",
      flag: "🇲🇱",
      category: "country_risk",
      severity: "high",
      status: "active",
      title: "Mali Junta Mining Seizures",
      description: "Military junta seized Barrick Gold's Loulo-Gounkoto mine (600koz/yr) in early 2025. Ongoing dispute over mining royalties. ~17% of sub-Saharan Africa production at risk.",
      miningShareOfWorld: 2.8,
      estimatedImpactTonnes: 105,
      startDate: "2025-01",
      goldImpact: "bullish",
    },
    {
      id: "r3",
      country: "Panama",
      flag: "🇵🇦",
      category: "country_risk",
      severity: "moderate",
      status: "monitoring",
      title: "First Quantum / Cobre Panama Precedent",
      description: "Copper mine closure in 2023 set precedent for political mining risk in Central America. Gold operations in region on heightened watch.",
      miningShareOfWorld: 0.3,
      estimatedImpactTonnes: 11,
      startDate: "2023-11",
      goldImpact: "neutral",
    },
    {
      id: "r4",
      country: "South Africa",
      flag: "🇿🇦",
      category: "mine_strike",
      severity: "moderate",
      status: "monitoring",
      title: "South African Labor Union Tensions",
      description: "AMCU & NUM labor disputes at Harmony Gold and Sibanye. Annual wage negotiations risk seasonal strikes Q3-Q4.",
      miningShareOfWorld: 3.6,
      estimatedImpactTonnes: 44,
      startDate: "2024-08",
      goldImpact: "neutral",
    },
    {
      id: "r5",
      country: "Ghana",
      flag: "🇬🇭",
      category: "country_risk",
      severity: "low",
      status: "resolved",
      title: "Ghana Mining Regulatory Uncertainty",
      description: "Ghana passed new royalty framework increasing gold royalties from 5% to 10% for mines >$1,500/oz. Operational impact absorbed, production continuing.",
      miningShareOfWorld: 3.7,
      estimatedImpactTonnes: 18,
      startDate: "2024-03",
      goldImpact: "neutral",
    },
    {
      id: "r6",
      country: "China",
      flag: "🇨🇳",
      category: "export_ban",
      severity: "low",
      status: "monitoring",
      title: "China Gold Refinery Export Capacity",
      description: "China retains ~30% of LBMA-accredited refinery capacity. Any political escalation could restrict refined gold exports used in global settlement.",
      miningShareOfWorld: 11.0,
      estimatedImpactTonnes: 0,
      startDate: "2025-01",
      goldImpact: "neutral",
    },
  ];

  const topProducers: CountryConcentration[] = [
    { country: "China",       flag: "🇨🇳", productionTonnes: 374, pctOfWorld: 10.2, riskLevel: "moderate", notes: "Largest producer; minimal export; geopolitical risk if China-West tensions escalate" },
    { country: "Russia",      flag: "🇷🇺", productionTonnes: 310, pctOfWorld:  8.5, riskLevel: "high",     notes: "Sanctioned since 2022; production diverted to China/India; bifurcated market" },
    { country: "Australia",   flag: "🇦🇺", productionTonnes: 314, pctOfWorld:  8.6, riskLevel: "low",      notes: "Stable democracy; Newcrest/Evolution; supply reliable" },
    { country: "Canada",      flag: "🇨🇦", productionTonnes: 201, pctOfWorld:  5.5, riskLevel: "low",      notes: "Stable; Agnico/Barrick HQ; ESG-compliant production" },
    { country: "USA",         flag: "🇺🇸", productionTonnes: 173, pctOfWorld:  4.7, riskLevel: "low",      notes: "Permitting delays a slow drag; Nevada operations stable" },
    { country: "Ghana",       flag: "🇬🇭", productionTonnes: 135, pctOfWorld:  3.7, riskLevel: "moderate", notes: "Rising royalties; political stability moderate" },
    { country: "South Africa", flag: "🇿🇦", productionTonnes: 105, pctOfWorld: 2.9, riskLevel: "moderate", notes: "Aging deep mines; electricity outages (load-shedding) disrupt output" },
    { country: "Mali",        flag: "🇲🇱", productionTonnes:  70, pctOfWorld:  1.9, riskLevel: "critical", notes: "Junta seized Barrick's Loulo-Gounkoto; operational freeze 2025" },
  ];

  const activeRisks = risks.filter(r => r.status === "active");
  const estimatedSupplyAtRiskTonnes = activeRisks.reduce((s, r) => s + r.estimatedImpactTonnes, 0);
  const supplyAtRiskPct = parseFloat(((estimatedSupplyAtRiskTonnes / totalWorldProduction) * 100).toFixed(1));

  const bullishRisks = risks.filter(r => r.goldImpact === "bullish" || r.goldImpact === "very_bullish");
  const overallSignal: SupplyShockData["overallSignal"] =
    bullishRisks.length >= 3 ? "bullish" :
    bullishRisks.length >= 1 ? "neutral" : "neutral";

  const concentrationRisk =
    `Top 3 producers (China, Russia, Australia) = ${(10.2 + 8.5 + 8.6).toFixed(0)}% of world output. ` +
    `Russia (sanctioned) + Mali (seized) = ${(8.5 + 1.9).toFixed(0)}% at elevated risk.`;

  const data: SupplyShockData = {
    goldPrice,
    totalWorldProduction,
    activeDisruptions: activeRisks.length,
    estimatedSupplyAtRiskTonnes,
    supplyAtRiskPct,
    overallSignal,
    risks,
    topProducers,
    concentrationRisk,
    insight:
      `${activeRisks.length} active supply disruption(s) affecting ~${estimatedSupplyAtRiskTonnes}t/yr (${supplyAtRiskPct}% of world production). ` +
      `Russia sanctions + Mali mine seizure are the dominant structural risks. ` +
      `Supply concentration in politically sensitive regions provides persistent price support.`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
