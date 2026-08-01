import { NextResponse } from "next/server";
import { goldFetch, lastKnownGoldPrice, getGoldSpot } from "@/lib/goldSource";
import { getOptionChain, chooseExpiry } from "@/lib/optionChain";

export const runtime = "nodejs";
export const revalidate = 1800; // 30 min

interface PriceLevel {
  price: number;
  oiEstimate: number;       // real OI at this strike, scaled 0–100 across the chain
  contracts: number;        // the open interest it came from
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
  source: string;
  timestamp: string;
}

async function fetchSpotData(): Promise<{ price: number; high: number; low: number }> {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d";
    const res = await goldFetch(url);
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
      price: meta?.regularMarketPrice ?? lastKnownGoldPrice(),
      high: meta?.regularMarketDayHigh ?? lastKnownGoldPrice(),
      low: meta?.regularMarketDayLow ?? lastKnownGoldPrice(),
    };
  } catch {
    return { price: lastKnownGoldPrice(), high: lastKnownGoldPrice(), low: lastKnownGoldPrice() };
  }
}

function roundToNearest(val: number, step: number): number {
  return Math.round(val / step) * step;
}

export async function GET() {
  const { price: fallbackSpot, high: dHigh, low: dLow } = await fetchSpotData();

  // Open interest per price level, from the real CBOE GLD chain rather than a
  // model. This used to score each level from roundness, distance from spot and
  // `Math.random() * 10`, then call the result "OI concentration" — a Pro
  // feature whose central number was invented and changed on every refresh.
  let chain, spot = fallbackSpot;
  try {
    const [c, live] = await Promise.all([getOptionChain(), getGoldSpot()]);
    chain = c;
    if (live.price > 0) spot = live.price;
  } catch {
    return NextResponse.json(
      { error: "Option chain unavailable — no open-interest data to map" },
      { status: 503 },
    );
  }

  const gld = chain.gldClose;
  const ratio = gld > 0 ? spot / gld : 0;
  const chosen = chooseExpiry(chain.rows);
  if (!ratio || !chosen) {
    return NextResponse.json({ error: "Option chain unusable" }, { status: 503 });
  }

  // Total OI per gold-equivalent strike for the chosen expiry.
  const byStrike = new Map<number, number>();
  for (const r of chain.rows) {
    if (r.expiry !== chosen.date || r.oi <= 0) continue;
    const gold = Math.round(r.strike * ratio);
    byStrike.set(gold, (byStrike.get(gold) ?? 0) + r.oi);
  }
  if (!byStrike.size) {
    return NextResponse.json({ error: "No open interest in the chain" }, { status: 503 });
  }

  // Take the readable window around spot FIRST, then scale within it. Scaling
  // against the whole chain's peak flattened everything near spot to 2 out of
  // 100, because the biggest open interest sits at far-OTM round strikes — and
  // picking "strongest support" from the full chain pointed at a level 8% away
  // that the chart never draws.
  const window = [...byStrike.entries()]
    .sort((a, b) => Math.abs(a[0] - spot) - Math.abs(b[0] - spot))
    .slice(0, 30);
  const peak = Math.max(...window.map(([, c]) => c));

  const levels: PriceLevel[] = window
    .map(([price, contracts]) => ({
      price,
      contracts: Math.round(contracts),
      // 0-100 against the busiest strike in view, so the heat map has contrast.
      oiEstimate: peak > 0 ? Math.round((contracts / peak) * 100) : 0,
      type: (price > spot ? "resistance" : price < spot ? "support" : "neutral") as PriceLevel["type"],
      isCurrentLevel: Math.abs(price - spot) < 5,
      isMajor: contracts >= peak * 0.5,
      label: `$${price.toLocaleString()}`,
    }))
    .sort((a, b) => a.price - b.price);

  const supports = levels.filter(l => l.type === "support").sort((a, b) => b.contracts - a.contracts);
  const resistances = levels.filter(l => l.type === "resistance").sort((a, b) => b.contracts - a.contracts);

  const strongestSupport = supports[0] ?? levels[0];
  const strongestResistance = resistances[0] ?? levels[levels.length - 1];

  // Find liquidity gaps (low OI zones = fast moves)
  const aboveLevels = levels.filter(l => l.price > spot).sort((a, b) => a.price - b.price);
  const belowLevels = levels.filter(l => l.price < spot).sort((a, b) => b.price - a.price);

  // A gap is the first strike where open interest thins out relative to this
  // chain's own peak — the threshold is relative because absolute contract
  // counts differ wildly between expiries.
  const gapAbove = aboveLevels.find(l => l.oiEstimate < 15);
  const gapBelow = belowLevels.find(l => l.oiEstimate < 15);

  const liquidityGapAbove = gapAbove?.price ?? spot + 80;
  const liquidityGapBelow = gapBelow?.price ?? spot - 80;

  const insight = `Heaviest put OI at $${strongestSupport.price.toLocaleString()} (${strongestSupport.contracts.toLocaleString()} contracts), heaviest call OI at $${strongestResistance.price.toLocaleString()} (${strongestResistance.contracts.toLocaleString()}). ` +
    `Thin liquidity above $${liquidityGapAbove} could accelerate moves if broken.`;

  const data: PositionHeatData = {
    spot,
    dailyHigh: dHigh,
    dailyLow: dLow,
    levels,
    strongestSupport,
    strongestResistance,
    liquidityGapAbove,
    liquidityGapBelow,
    insight,
    source: `CBOE GLD open interest, expiry ${chosen.date} · strikes converted to gold-equivalent at the live gold/GLD ratio`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
