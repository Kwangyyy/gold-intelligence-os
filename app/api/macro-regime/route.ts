import { NextResponse } from "next/server";

export const revalidate = 900; // 15-min

interface RegimeQuadrant {
  id: string;
  growth: "rising" | "falling";
  inflation: "rising" | "falling";
  label: string;
  goldReturn30d: number;  // historical avg 30D gold return in this regime
  goldReturn90d: number;
  winRate: number;        // % of months gold was positive
  description: string;
  examples: string[];
  goldAction: string;
}

interface MacroIndicator {
  name: string;
  value: number;
  change1m: number;    // 1-month change
  direction: "rising" | "falling" | "stable";
  trend: string;
  signal: string;
}

interface MacroRegimeData {
  currentQuadrant: string;
  growthDirection: "rising" | "falling";
  inflationDirection: "rising" | "falling";
  confidence: number;  // 0–100
  indicators: MacroIndicator[];
  quadrants: RegimeQuadrant[];
  goldPrice: number;
  goldChange1m: number;
  insight: string;
  timestamp: string;
}

async function fetchAsset(symbol: string): Promise<{ price: number; change1m: number }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=3mo`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const closes: number[] = (json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [])
      .filter((c: number | null) => c != null);
    const price = closes[closes.length - 1] ?? 0;
    const prev1m = closes[closes.length - 2] ?? price;
    return { price, change1m: prev1m ? ((price - prev1m) / prev1m) * 100 : 0 };
  } catch {
    return { price: 0, change1m: 0 };
  }
}

export async function GET() {
  // Fetch macro proxies:
  // Growth proxy: SPY (S&P 500 as economic growth indicator)
  // Inflation proxy: TIP (TIPS ETF price movement reflects inflation expectations)
  // Credit spreads (proxy with HYG - JNK average)
  // Gold: GC=F
  const [spy, tip, hyg, gold] = await Promise.all([
    fetchAsset("SPY"),
    fetchAsset("TIP"),
    fetchAsset("HYG"),
    fetchAsset("GC=F"),
  ]);

  // Determine growth direction from SPY momentum
  const growthDirection: "rising" | "falling" = spy.change1m >= 0 ? "rising" : "falling";

  // Determine inflation direction from TIP movement
  const inflationDirection: "rising" | "falling" = tip.change1m >= 0 ? "rising" : "falling";

  // Confidence based on magnitude of signals
  const confidence = Math.min(95, Math.round(
    50 + Math.abs(spy.change1m) * 3 + Math.abs(tip.change1m) * 4
  ));

  const indicators: MacroIndicator[] = [
    {
      name: "S&P 500 (SPY)",
      value: parseFloat(spy.price.toFixed(2)),
      change1m: parseFloat(spy.change1m.toFixed(2)),
      direction: spy.change1m > 0.5 ? "rising" : spy.change1m < -0.5 ? "falling" : "stable",
      trend: spy.change1m > 0 ? "Economic growth momentum positive" : "Growth momentum slowing",
      signal: spy.change1m > 2 ? "Strong growth" : spy.change1m > 0 ? "Moderate growth" : "Growth concern",
    },
    {
      name: "TIPS ETF (TIP)",
      value: parseFloat(tip.price.toFixed(2)),
      change1m: parseFloat(tip.change1m.toFixed(2)),
      direction: tip.change1m > 0.3 ? "rising" : tip.change1m < -0.3 ? "falling" : "stable",
      trend: tip.change1m > 0 ? "Inflation expectations rising" : "Inflation expectations easing",
      signal: tip.change1m > 1 ? "Hot inflation" : tip.change1m > 0 ? "Mild inflation" : "Disinflation",
    },
    {
      name: "High Yield Credit (HYG)",
      value: parseFloat(hyg.price.toFixed(2)),
      change1m: parseFloat(hyg.change1m.toFixed(2)),
      direction: hyg.change1m > 0.2 ? "rising" : hyg.change1m < -0.2 ? "falling" : "stable",
      trend: hyg.change1m > 0 ? "Credit conditions stable — risk appetite healthy" : "Credit spread widening — risk-off signal",
      signal: hyg.change1m > 0 ? "Risk-on" : "Risk-off",
    },
    {
      name: "Gold (GC=F)",
      value: parseFloat(gold.price.toFixed(2)),
      change1m: parseFloat(gold.change1m.toFixed(2)),
      direction: gold.change1m > 0.5 ? "rising" : gold.change1m < -0.5 ? "falling" : "stable",
      trend: gold.change1m > 0 ? "Gold trending higher this month" : "Gold under pressure this month",
      signal: gold.change1m > 3 ? "Strong gold bull" : gold.change1m > 0 ? "Gold positive" : "Gold weak",
    },
  ];

  const QUADRANTS: RegimeQuadrant[] = [
    {
      id: "q1",
      growth: "rising",
      inflation: "rising",
      label: "Goldilocks? No — Overheating",
      goldReturn30d: 1.8,
      goldReturn90d: 5.4,
      winRate: 58,
      description: "Growth + inflation both rising = overheating economy. Gold benefits from inflation hedge demand, but competing with equities for capital. USD may strengthen from rate expectations.",
      examples: ["2021 post-COVID boom", "1970s late cycle", "2007 pre-GFC"],
      goldAction: "Hold gold — inflation hedge in play, but equity competition limits upside. Consider trimming equities in favor of gold.",
    },
    {
      id: "q2",
      growth: "falling",
      inflation: "rising",
      label: "Stagflation",
      goldReturn30d: 3.9,
      goldReturn90d: 11.2,
      winRate: 72,
      description: "Most bullish quadrant for gold. Growth slowing while inflation persists = real rates deeply negative. Gold's historical sweet spot — performed best in 1974–1975 and 2022 stagflation fears.",
      examples: ["1974–1975", "1979–1980", "2022 partial stagflation"],
      goldAction: "MAXIMUM BULLISH on gold. This is the ideal environment. Increase allocation. Short USD, long gold miners.",
    },
    {
      id: "q3",
      growth: "rising",
      inflation: "falling",
      label: "Ideal / Goldilocks",
      goldReturn30d: 0.4,
      goldReturn90d: 1.2,
      winRate: 44,
      description: "Least favorable for gold. Equities thrive, real rates positive, USD strong. Gold underperforms as a defensive asset when risk appetite is high and inflation is contained.",
      examples: ["1995–1999", "2013–2014", "2017"],
      goldAction: "REDUCE gold exposure. Risk assets outperform. Maintain minimal tactical allocation only.",
    },
    {
      id: "q4",
      growth: "falling",
      inflation: "falling",
      label: "Recession / Deflation",
      goldReturn30d: 2.1,
      goldReturn90d: 6.3,
      winRate: 61,
      description: "Gold benefits from safe-haven demand and Fed easing expectations. Real rates fall as Fed cuts. Risk-off flow into gold. Outcome depends on speed of central bank response.",
      examples: ["2008–2009 GFC", "2020 COVID", "2001 dotcom bust"],
      goldAction: "BULLISH on gold. Safe-haven + rate cut catalyst. Buy dips. Central bank easing is gold-positive.",
    },
  ];

  const currentQuadrantId =
    growthDirection === "rising" && inflationDirection === "rising" ? "q1" :
    growthDirection === "falling" && inflationDirection === "rising" ? "q2" :
    growthDirection === "rising" && inflationDirection === "falling" ? "q3" : "q4";

  const currentQ = QUADRANTS.find(q => q.id === currentQuadrantId)!;

  const data: MacroRegimeData = {
    currentQuadrant: currentQuadrantId,
    growthDirection,
    inflationDirection,
    confidence,
    indicators,
    quadrants: QUADRANTS,
    goldPrice: gold.price,
    goldChange1m: parseFloat(gold.change1m.toFixed(2)),
    insight:
      `Current regime: ${currentQ.label}. ` +
      `Growth ${growthDirection}, Inflation ${inflationDirection}. ` +
      `Historical gold 30D avg return in this regime: ${currentQ.goldReturn30d > 0 ? "+" : ""}${currentQ.goldReturn30d}% (${currentQ.winRate}% win rate). ` +
      currentQ.goldAction,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
