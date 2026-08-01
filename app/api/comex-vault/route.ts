import { NextResponse } from "next/server";

export const revalidate = 3600; // 1h cache

interface VaultEntry {
  week: string;
  registered: number; // tonnes registered (deliverable)
  eligible: number;   // tonnes eligible (can be registered, not yet)
  total: number;
  coverage: number;   // registered / open interest estimate
}

interface ComexVaultData {
  dataCaveat: string;
  registeredTonnes: number;
  eligibleTonnes: number;
  totalTonnes: number;
  coverageRatio: number;       // registered vs estimated OI
  weeklyChange: number;        // tonne change in registered
  trend: "draining" | "stable" | "building";
  signal: "bullish" | "neutral" | "bearish";
  goldImplication: string;
  history: VaultEntry[];
  keyLevels: { level: number; label: string; note: string }[];
  insight: string;
  timestamp: string;
}

// COMEX vault stocks cannot be fetched: CME's daily metal stocks report answers
// 403 to server-side requests, the same wall that blocks QuikStrike. So this is
// a representative pattern, not measured inventory, and the payload says so
// instead of leaving the reader to assume.
//
// What did change: the ±20t of Math.random() per week is gone. It made a fixed
// pattern look like a live series — every refresh moved the numbers, which is
// the one thing a static model should never do.
function generateVaultHistory(): VaultEntry[] {
  // Registered typically 200-800 tonnes, eligible 8000-12000 tonnes
  const baseRegistered = 420;
  const baseEligible = 9200;
  const weeks: VaultEntry[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const label = `W${d.toLocaleString("en", { month: "short" })}${Math.ceil(d.getDate() / 7)}`;

    // Drain trend: gold flowing into COMEX from London on tariff/arb concerns.
    const trendAdj = i > 6 ? -i * 15 : i * 8;
    const registered = Math.max(180, baseRegistered + trendAdj);
    const eligible = Math.max(7000, baseEligible + trendAdj * 3);

    // Coverage ratio: registered vs approximate open interest (300k contracts × 100oz / 32150 = ~930t)
    const estimatedOITonnes = 930;
    const coverage = parseFloat((registered / estimatedOITonnes).toFixed(3));

    weeks.push({
      week: label,
      registered: Math.round(registered),
      eligible: Math.round(eligible),
      total: Math.round(registered + eligible),
      coverage,
    });
  }
  return weeks;
}

export async function GET() {
  const history = generateVaultHistory();
  const current = history[history.length - 1];
  const prev = history[history.length - 2];
  const weeklyChange = current.registered - prev.registered;

  const trend: ComexVaultData["trend"] =
    weeklyChange < -15 ? "draining" :
    weeklyChange > 15  ? "building" : "stable";

  const signal: ComexVaultData["signal"] =
    trend === "draining" ? "bullish" :
    trend === "building" ? "bearish" : "neutral";

  const goldImplication =
    trend === "draining"
      ? `COMEX registered inventory declining (${weeklyChange < 0 ? "" : "+"}${weeklyChange}t this week). When deliverable gold drains, short sellers face squeeze risk — bullish. Coverage ratio at ${(current.coverage * 100).toFixed(1)}% of estimated OI.`
      : trend === "building"
      ? `COMEX registered inventory building (+${weeklyChange}t). Physical gold increasing in vaults reduces squeeze risk — mild bearish pressure as leverage concerns ease.`
      : `COMEX registered inventory stable at ${current.registered.toLocaleString()}t. Coverage ratio ${(current.coverage * 100).toFixed(1)}% — neutral signal for gold price.`;

  const data: ComexVaultData = {
    dataCaveat: "Representative pattern, not measured inventory. CME's daily metal stocks report blocks server-side requests, so no live COMEX vault figure is available to this app. Verify against cmegroup.com before acting on it.",
    registeredTonnes: current.registered,
    eligibleTonnes: current.eligible,
    totalTonnes: current.total,
    coverageRatio: current.coverage,
    weeklyChange,
    trend,
    signal,
    goldImplication,
    history,
    keyLevels: [
      { level: 800, label: "High Coverage",    note: ">800t registered = ample supply, squeeze risk low" },
      { level: 400, label: "Moderate",          note: "400-800t = normal operating range" },
      { level: 200, label: "Low Coverage",      note: "<200t registered = elevated squeeze risk for shorts" },
      { level: 100, label: "Critical Low",       note: "<100t registered = potential delivery failure risk, very bullish" },
    ],
    insight:
      `COMEX warehouse holds ${current.total.toLocaleString()}t total gold (${current.registered}t registered + ${current.eligible}t eligible). ` +
      `Coverage ratio at ${(current.coverage * 100).toFixed(0)}% of estimated open interest. ` +
      (weeklyChange < -20 ? "Accelerating drain — watch for short squeeze catalyst." :
       weeklyChange > 20 ? "Inventory build — physical supply increasing, reducing near-term squeeze pressure." :
       "Inventory near equilibrium."),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
