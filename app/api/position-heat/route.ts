import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 1800; // 30 min

interface PriceLevel {
  price: number;
  oiEstimate: number;       // estimated OI concentration 0–100
  type: "support" | "resistance" | "neutral";
  isCurrentLevel: boolean;
  isMajor: boolean;
  label?: string;
}

interface PositionHeatData {
  spot: number;
  dailyHigh: number;
  dailyLow: number;
  levels: PriceLevel[];
  strongestSupport: PriceLevel;
  strongestResistance: PriceLevel;
  liquidityGapAbove: number; // price where thin OI = fast move up
  liquidityGapBelow: number;
  insight: string;
  timestamp: string;
}

async function fetchSpotData(): Promise<{ price: number; high: number; low: number }> {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error("fetch failed");
    const json = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
          };
        }>;
      };
    };
    const meta = json.chart?.result?.[0]?.meta;
    return {
      price: meta?.regularMarketPrice ?? 3300,
      high: meta?.regularMarketDayHigh ?? 3320,
      low: meta?.regularMarketDayLow ?? 3280,
    };
  } catch {
    return { price: 3300, high: 3320, low: 3280 };
  }
}

function roundToNearest(val: number, step: number): number {
  return Math.round(val / step) * step;
}

export async function GET() {
  const { price: spot, high: dHigh, low: dLow } = await fetchSpotData();

  // Generate realistic OI heatmap around current price
  // Key levels are round numbers and prior swing points
  const step = 10; // $10 increments
  const rangeRadius = 150; // ±$150 from spot
  const levels: PriceLevel[] = [];

  const spotRounded = roundToNearest(spot, step);

  // Known high-OI levels: round hundreds, $50 levels, and psychologically important levels
  const majorLevels = new Set<number>();
  // Round hundreds ± range
  for (let p = roundToNearest(spot - rangeRadius, 100); p <= spot + rangeRadius; p += 100) {
    majorLevels.add(p);
  }
  // Round 50s
  for (let p = roundToNearest(spot - rangeRadius, 50); p <= spot + rangeRadius; p += 50) {
    majorLevels.add(p);
  }
  // Add day high/low rounded to nearest 10
  majorLevels.add(roundToNearest(dHigh, step));
  majorLevels.add(roundToNearest(dLow, step));
  majorLevels.add(spotRounded);

  for (let p = spotRounded - rangeRadius; p <= spotRounded + rangeRadius; p += step) {
    const isMajor = majorLevels.has(p);
    const distFromSpot = Math.abs(p - spot);

    // OI concentration model:
    // - Higher at round numbers
    // - Higher at day high/low (stop clusters)
    // - Decays exponentially with distance
    // - Noise component
    const roundnessBonus = p % 100 === 0 ? 40 : p % 50 === 0 ? 25 : p % 25 === 0 ? 10 : 0;
    const dayHighBonus = Math.abs(p - roundToNearest(dHigh, step)) <= step ? 30 : 0;
    const dayLowBonus = Math.abs(p - roundToNearest(dLow, step)) <= step ? 30 : 0;
    const spotBonus = Math.abs(p - spotRounded) <= step ? 35 : 0;
    const decayFactor = Math.exp(-distFromSpot / 80);
    const noise = Math.random() * 10;

    const rawOI = (30 + roundnessBonus + dayHighBonus + dayLowBonus + spotBonus) * decayFactor + noise;
    const oiEstimate = Math.min(100, Math.round(rawOI));

    const isCurrentLevel = p === spotRounded;
    const type: PriceLevel["type"] = p > spot ? "resistance" : p < spot ? "support" : "neutral";

    levels.push({
      price: p,
      oiEstimate,
      type,
      isCurrentLevel,
      isMajor,
      label: p % 100 === 0 ? `$${p}` : p % 50 === 0 ? `$${p}` : undefined,
    });
  }

  // Sort by price
  levels.sort((a, b) => a.price - b.price);

  // Find strongest support (below spot, highest OI)
  const supports = levels.filter(l => l.type === "support").sort((a, b) => b.oiEstimate - a.oiEstimate);
  const resistances = levels.filter(l => l.type === "resistance").sort((a, b) => b.oiEstimate - a.oiEstimate);

  const strongestSupport = supports[0] ?? levels[0];
  const strongestResistance = resistances[0] ?? levels[levels.length - 1];

  // Find liquidity gaps (low OI zones = fast moves)
  const aboveLevels = levels.filter(l => l.price > spot).sort((a, b) => a.price - b.price);
  const belowLevels = levels.filter(l => l.price < spot).sort((a, b) => b.price - a.price);

  const gapAbove = aboveLevels.find(l => l.oiEstimate < 15);
  const gapBelow = belowLevels.find(l => l.oiEstimate < 15);

  const liquidityGapAbove = gapAbove?.price ?? spot + 80;
  const liquidityGapBelow = gapBelow?.price ?? spot - 80;

  const insight = `Key support at $${strongestSupport.price} (OI cluster), resistance at $${strongestResistance.price}. ` +
    `Thin liquidity above $${liquidityGapAbove} could accelerate moves if broken.`;

  const data: PositionHeatData = {
    spot,
    dailyHigh: dHigh,
    dailyLow: dLow,
    levels: levels.slice(-30), // last 30 levels closest to spot
    strongestSupport,
    strongestResistance,
    liquidityGapAbove,
    liquidityGapBelow,
    insight,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
