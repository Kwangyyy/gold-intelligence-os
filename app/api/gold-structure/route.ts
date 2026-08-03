import { NextResponse } from "next/server";
import { getGoldSpot, lastKnownGoldPrice, goldMonthlyFromDaily } from "@/lib/goldSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface StructureLevel {
  price: number;
  label: string;
  type: "all_time_high" | "major_resistance" | "major_support" | "psychological" | "yearly" | "decade";
  significance: "critical" | "high" | "moderate";
  distance: number;       // % from current
  direction: "above" | "below" | "at";
  yearAchieved?: number;
  description: string;
}

export interface PriceZone {
  from: number;
  to: number;
  type: "resistance_zone" | "support_zone" | "congestion";
  strength: "strong" | "moderate" | "weak";
  description: string;
}

export interface GoldStructurePayload {
  currentPrice: number;
  allTimeHigh: number;
  allTimeLow: number;       // in modern era
  pctFromATH: number;
  levels: StructureLevel[];
  zones: PriceZone[];
  nearestResistance: StructureLevel | null;
  nearestSupport: StructureLevel | null;
  nextMajorTarget: number;
  nextMajorSupport: number;
  structureBias: "bullish" | "neutral" | "bearish";
  structureBiasColor: string;
  structureNote: string;
  psychologicalNote: string;
  timestamp: string;
}

let CACHE: { data: GoldStructurePayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

async function fetchYearlyOHLC(): Promise<{ price: number; yearlyHighs: number[]; yearlyLows: number[] }> {
  try {
    // Monthly bars assembled from Yahoo's daily series, not its monthly one.
    // The monthly endpoint silently drops months — four of twenty-four over the
    // last two years, including February and March 2026, whose highs of 5,280
    // and 5,405 simply did not exist as far as this page was concerned. On a
    // page whose entire job is mapping multi-year highs and lows, a missing
    // month is a missing level.
    const m = await goldMonthlyFromDaily(10);
    const price: number = lastKnownGoldPrice();
    const highs: number[] = m.h;
    const lows: number[] = m.l;
    const timestamps: number[] = m.t;

    // Group by year
    const yearlyHighs: { year: number; high: number }[] = [];
    const yearlyLows: { year: number; low: number }[] = [];
    const yearMap: Record<number, { highs: number[]; lows: number[] }> = {};

    timestamps.forEach((ts, i) => {
      const year = new Date(ts * 1000).getFullYear();
      if (!yearMap[year]) yearMap[year] = { highs: [], lows: [] };
      if (highs[i]) yearMap[year].highs.push(highs[i]);
      if (lows[i]) yearMap[year].lows.push(lows[i]);
    });

    const yHighs: number[] = [];
    const yLows: number[] = [];
    Object.entries(yearMap).sort(([a], [b]) => Number(a) - Number(b)).forEach(([, data]) => {
      if (data.highs.length > 0) yHighs.push(Math.max(...data.highs));
      if (data.lows.length > 0) yLows.push(Math.min(...data.lows));
    });

    return { price, yearlyHighs: yHighs, yearlyLows: yLows };
  } catch {
    return { price: lastKnownGoldPrice(), yearlyHighs: [], yearlyLows: [] };
  }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const { price, yearlyHighs, yearlyLows } = await fetchYearlyOHLC();
    // …but "where are we now" must be the price the user can trade. Reading it
    // off the futures history put this page $53 above every other page.
    const spot = await getGoldSpot().catch(() => null);
    const currentPrice = spot && spot.price > 0 ? spot.price : price;

    // ATH in data set
    const allTimeHighData = yearlyHighs.length > 0 ? Math.max(...yearlyHighs) : currentPrice;
    const allTimeLow = yearlyLows.length > 0 ? Math.min(...yearlyLows) : 1000;
    const pctFromATH = allTimeHighData > 0 ? ((currentPrice - allTimeHighData) / allTimeHighData) * 100 : 0;

    // Round numbers are generated around the live price, not typed in.
    //
    // The typed list stopped at $3,500, described as "the next century mark
    // above $3,000". Gold trades above $4,000. Every hardcoded level had fallen
    // below spot, so the nearest resistance this page could name was the
    // all-time high 38% away, and the entire $4,000-$5,500 range — where price
    // actually is — had no levels at all. A page whose whole job is mapping
    // structure was mapping the structure of two years ago.
    //
    // $250 apart above spot and below it: close enough that gold reaches them,
    // far enough apart that the list stays readable.
    const STEP = 250;
    const roundLevels: { price: number; label: string; year?: number; desc: string }[] = [];
    for (let p = Math.ceil(currentPrice / STEP) * STEP; p <= currentPrice * 1.45; p += STEP) {
      roundLevels.push({
        price: p,
        label: `Round Number $${p.toLocaleString()}`,
        desc: `Psychological resistance ${(((p - currentPrice) / currentPrice) * 100).toFixed(1)}% above spot — round numbers stall and reverse moves`,
      });
    }
    for (let p = Math.floor(currentPrice / STEP) * STEP; p >= Math.max(2000, currentPrice * 0.55); p -= STEP) {
      roundLevels.push({
        price: p,
        label: `Round Number $${p.toLocaleString()}`,
        desc: `Psychological support ${(((currentPrice - p) / currentPrice) * 100).toFixed(1)}% below spot — round numbers act as magnets`,
      });
    }

    // Levels that earned their name from what happened at them. These are
    // history and do not go stale; the round numbers above are the ones that
    // have to track the market.
    const historicalLevels: { price: number; label: string; year?: number; desc: string }[] = [
      ...roundLevels,
      // audit-allow-price-constant — a dated event, not a fallback for a live
      // price. The round numbers that did go stale are generated above now.
      { price: 3000, label: "$3,000 Breakout", desc: "Century mark — the level that confirmed this bull run when it broke", year: 2024 },
      { price: 2200, label: "2023 Major S/R", desc: "Strong resistance turned support during 2023-2024 base building", year: 2023 },
      { price: 2089, label: "2020 ATH (at time)", desc: "COVID-era record high; major long-term resistance level", year: 2020 },
      { price: 2000, label: "Round Number $2,000", desc: "Critical psychological level; major breakout confirmation above here", year: 2020 },
      { price: 1800, label: "2011 ATH Era", desc: "Previous cycle peak zone; converted to support in 2019-2022", year: 2011 },
      { price: 1680, label: "2013 Crash Low", desc: "Major 2013 bear market low; key historical S/R flip" },
      { price: 1500, label: "Round Number $1,500", desc: "Major psychological level; 2019 breakout above here started new bull run" },
      { price: 1000, label: "Round Number $1,000", desc: "The century mark broken in 2008; legendary long-term support" },
    ];

    // Add live ATH if known
    if (allTimeHighData > 3000) {
      historicalLevels.unshift({
        price: Math.round(allTimeHighData / 5) * 5,
        label: "All-Time High (10Y data)",
        desc: "Highest price recorded in available 10-year data set",
      });
    }

    // A generated round number and a named level can land on the same price —
    // $3,000 is both. The named one wins, since "the level that confirmed this
    // bull run" says more than "psychological support".
    const byPrice = new Map<number, (typeof historicalLevels)[number]>();
    for (const lv of historicalLevels) {
      const existing = byPrice.get(lv.price);
      if (!existing || (existing.label.startsWith("Round Number") && !lv.label.startsWith("Round Number"))) {
        byPrice.set(lv.price, lv);
      }
    }

    // Build StructureLevel array
    const levels: StructureLevel[] = [...byPrice.values()].map(lv => {
      const distance = ((lv.price - currentPrice) / currentPrice) * 100;
      const direction: StructureLevel["direction"] = Math.abs(distance) < 0.2 ? "at" : distance > 0 ? "above" : "below";
      let type: StructureLevel["type"] = lv.price > currentPrice ? "major_resistance" : "major_support";
      if (lv.label.includes("Round Number")) type = "psychological";
      if (lv.label.includes("ATH")) type = "all_time_high";
      if (lv.year) type = "yearly";
      const significance: StructureLevel["significance"] =
        lv.price === 2000 || lv.price === 3000 || lv.price === 1000 ? "critical"
        : Math.abs(distance) < 5 ? "critical"
        : Math.abs(distance) < 15 ? "high"
        : "moderate";

      return {
        price: lv.price,
        label: lv.label,
        type,
        significance,
        distance,
        direction,
        yearAchieved: lv.year,
        description: lv.desc,
      };
    }).sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));

    // Zones, drawn around the round numbers nearest spot rather than typed in.
    //
    // The typed zones were $2,380 to $3,520, and the filter below drops anything
    // more than 25% from spot — so at $4,000 every one of them was discarded and
    // the page returned no zones at all. Silent: the field was present and empty.
    const zoneWidth = Math.max(10, Math.round(currentPrice * 0.005));
    const zones: PriceZone[] = [...byPrice.values()]
      .filter((lv) => Math.abs(lv.price - currentPrice) < currentPrice * 0.2 && lv.price !== 0)
      .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
      .slice(0, 4)
      .map((lv) => {
        const above = lv.price > currentPrice;
        return {
          from: lv.price - zoneWidth,
          to: lv.price + zoneWidth,
          type: above ? ("resistance_zone" as const) : ("support_zone" as const),
          strength: Math.abs(lv.price - currentPrice) < currentPrice * 0.05
            ? ("strong" as const)
            : ("moderate" as const),
          description: `${lv.label} — ${above ? "resistance" : "support"} band around $${lv.price.toLocaleString()}`,
        };
      });

    const nearestResistance = levels.find(l => l.distance > 0.2) ?? null;
    const nearestSupport = levels.find(l => l.distance < -0.2) ?? null;

    const majorTargets = levels.filter(l => l.direction === "above" && l.significance !== "moderate");
    const majorSupports = levels.filter(l => l.direction === "below" && l.significance !== "moderate");
    const nextMajorTarget = majorTargets[0]?.price ?? currentPrice * 1.05;
    const nextMajorSupport = majorSupports[0]?.price ?? currentPrice * 0.95;

    // Structure bias: is price above most key levels?
    const keyLevels = [1500, 1800, 2000, 2500, 3000];
    const above = keyLevels.filter(l => currentPrice > l).length;
    const structureBias: "bullish" | "neutral" | "bearish" =
      above >= 4 ? "bullish" : above <= 1 ? "bearish" : "neutral";
    const structureBiasColor = structureBias === "bullish" ? "#34d399" : structureBias === "bearish" ? "#f87171" : "#f5c451";

    const structureNote = `Gold is currently trading ${pctFromATH >= 0 ? "AT or ABOVE" : `${Math.abs(pctFromATH).toFixed(1)}% below`} its all-time high in this dataset. Price is above ${above}/5 key structural levels ($1,500/$1,800/$2,000/$2,500/$3,000).`;

    const psychologicalNote = `Key psychological levels act as magnets and barriers. The nearest round-number resistance is $${nearestResistance?.price.toLocaleString() ?? "N/A"} and nearest support is $${nearestSupport?.price.toLocaleString() ?? "N/A"}. Markets frequently stall and reverse near century marks.`;

    const payload: GoldStructurePayload = {
      currentPrice, allTimeHigh: allTimeHighData, allTimeLow, pctFromATH,
      levels: levels.slice(0, 15), zones, nearestResistance, nearestSupport,
      nextMajorTarget, nextMajorSupport, structureBias, structureBiasColor,
      structureNote, psychologicalNote,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("gold-structure error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
