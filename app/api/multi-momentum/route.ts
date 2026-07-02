import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 600; // 10 min

interface AssetMomentum {
  symbol: string;
  name: string;
  price: number | null;
  returns: {
    d1: number | null;  // 1-day %
    d5: number | null;  // 5-day %
    d20: number | null; // 20-day %
    d60: number | null; // 60-day %
  };
  momentum: number; // composite 0–100
  trend: "strong_up" | "up" | "neutral" | "down" | "strong_down";
  goldCorrelation: "positive" | "inverse" | "low";
}

interface MultiMomentumData {
  assets: AssetMomentum[];
  goldMomentum: number;
  leaderAsset: string;  // which asset leading gold up or down
  insight: string;
  timestamp: string;
}

const ASSETS = [
  { symbol: "GC=F",      name: "Gold",    goldCorr: "positive" as const },
  { symbol: "SI=F",      name: "Silver",  goldCorr: "positive" as const },
  { symbol: "PL=F",      name: "Platinum",goldCorr: "positive" as const },
  { symbol: "DX-Y.NYB",  name: "DXY",     goldCorr: "inverse" as const  },
  { symbol: "^TNX",      name: "10Y Yield",goldCorr: "inverse" as const },
  { symbol: "SPY",       name: "S&P 500", goldCorr: "inverse" as const  },
  { symbol: "BTC-USD",   name: "Bitcoin", goldCorr: "positive" as const },
  { symbol: "CL=F",      name: "Oil WTI", goldCorr: "positive" as const },
  { symbol: "^VIX",      name: "VIX",     goldCorr: "positive" as const },
  { symbol: "TLT",       name: "Bonds",   goldCorr: "positive" as const },
];

async function fetchOHLC(symbol: string): Promise<{ prices: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      chart?: {
        result?: Array<{
          indicators?: {
            quote?: Array<{ close?: (number | null)[] }>;
          };
        }>;
      };
    };
    const closes = (json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [])
      .filter((c): c is number => c !== null && !isNaN(c));
    return { prices: closes };
  } catch {
    return null;
  }
}

function pctReturn(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  const cur = prices[prices.length - 1];
  const prev = prices[prices.length - 1 - lookback];
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

function momentumScore(returns: AssetMomentum["returns"]): number {
  // Weighted: 1d(10%) 5d(20%) 20d(35%) 60d(35%)
  const weights = [
    { val: returns.d1,  w: 10 },
    { val: returns.d5,  w: 20 },
    { val: returns.d20, w: 35 },
    { val: returns.d60, w: 35 },
  ];
  let totalW = 0, weightedSum = 0;
  for (const { val, w } of weights) {
    if (val !== null) {
      // Normalize: ±10% maps to ±1, capped at ±1
      const normalized = Math.max(-1, Math.min(1, val / 10));
      weightedSum += normalized * w;
      totalW += w;
    }
  }
  if (totalW === 0) return 50;
  return Math.round(((weightedSum / totalW) + 1) * 50); // 0–100
}

function trendLabel(score: number): AssetMomentum["trend"] {
  if (score >= 75) return "strong_up";
  if (score >= 58) return "up";
  if (score <= 25) return "strong_down";
  if (score <= 42) return "down";
  return "neutral";
}

export async function GET() {
  const results = await Promise.allSettled(ASSETS.map(a => fetchOHLC(a.symbol)));

  const assets: AssetMomentum[] = ASSETS.map((asset, i) => {
    const result = results[i];
    const prices = result.status === "fulfilled" && result.value ? result.value.prices : [];

    const price = prices.length > 0 ? prices[prices.length - 1] : null;
    const returns = {
      d1:  pctReturn(prices, 1),
      d5:  pctReturn(prices, 5),
      d20: pctReturn(prices, 20),
      d60: pctReturn(prices, 60),
    };
    const momentum = prices.length > 5 ? momentumScore(returns) : 50;

    return {
      symbol: asset.symbol,
      name: asset.name,
      price,
      returns,
      momentum,
      trend: trendLabel(momentum),
      goldCorrelation: asset.goldCorr,
    };
  });

  const goldAsset = assets.find(a => a.symbol === "GC=F");
  const goldMomentum = goldAsset?.momentum ?? 50;

  // Find the asset most aligned with gold currently
  const goldAligned = assets
    .filter(a => a.symbol !== "GC=F")
    .map(a => {
      const aligned = a.goldCorrelation === "positive"
        ? a.momentum
        : (100 - a.momentum); // inverse assets: high score = bearish for gold
      return { name: a.name, aligned };
    })
    .sort((a, b) => b.aligned - a.aligned);

  const leaderAsset = goldAligned[0]?.name ?? "Silver";

  const insight = goldMomentum >= 65
    ? `Gold momentum is strong (${goldMomentum}/100). ${leaderAsset} is the strongest confirming asset — continuation signals are aligned.`
    : goldMomentum <= 35
    ? `Gold momentum is weak (${goldMomentum}/100). Risk-off signals from ${leaderAsset} may precede a recovery, but current trend is bearish.`
    : `Gold momentum is neutral (${goldMomentum}/100). Watch ${leaderAsset} for directional clues — cross-asset signals are mixed.`;

  const data: MultiMomentumData = {
    assets,
    goldMomentum,
    leaderAsset,
    insight,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
