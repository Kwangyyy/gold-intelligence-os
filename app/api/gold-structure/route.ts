import { NextResponse } from "next/server";

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
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=10y&interval=1mo`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) throw new Error("Failed");
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) throw new Error("No result");

    const meta = r.meta ?? {};
    const price: number = meta.regularMarketPrice ?? 3350;
    const highs: number[] = (r.indicators?.quote?.[0]?.high ?? []).filter(Boolean);
    const lows: number[] = (r.indicators?.quote?.[0]?.low ?? []).filter(Boolean);
    const timestamps: number[] = r.timestamp ?? [];

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
    return { price: 3350, yearlyHighs: [], yearlyLows: [] };
  }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const { price, yearlyHighs, yearlyLows } = await fetchYearlyOHLC();
    const currentPrice = price;

    // ATH in data set
    const allTimeHighData = yearlyHighs.length > 0 ? Math.max(...yearlyHighs) : currentPrice;
    const allTimeLow = yearlyLows.length > 0 ? Math.min(...yearlyLows) : 1000;
    const pctFromATH = allTimeHighData > 0 ? ((currentPrice - allTimeHighData) / allTimeHighData) * 100 : 0;

    // Key historical structural levels (well-known from gold market history)
    const historicalLevels: { price: number; label: string; year?: number; desc: string }[] = [
      { price: 3500, label: "Round Number $3,500", desc: "Major psychological resistance — next century mark above $3,000" },
      { price: 3250, label: "Round Number $3,250", desc: "Key psychological level in current bull run" },
      { price: 3000, label: "Round Number $3,000", desc: "Century mark — major psychological breakout level (March 2024)" },
      { price: 2800, label: "Round Number $2,800", desc: "Key level; Dec 2024 all-time high zone" },
      { price: 2600, label: "Round Number $2,600", desc: "Mid 2024 breakout pivot" },
      { price: 2400, label: "Round Number $2,400", desc: "ATH for many years before 2024 breakout" },
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

    // Build StructureLevel array
    const levels: StructureLevel[] = historicalLevels.map(lv => {
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

    // Zones
    const allZones: PriceZone[] = [
      { from: 2980, to: 3020, type: "support_zone", strength: "strong", description: "$3,000 psychological zone — major battleground turned support" },
      { from: 3480, to: 3520, type: "resistance_zone", strength: "strong", description: "$3,500 round number resistance — major psychological target" },
      { from: 2750, to: 2810, type: "support_zone", strength: "moderate", description: "2024 ATH area converted to support after breakout" },
      { from: 2380, to: 2430, type: "support_zone", strength: "moderate", description: "Previous ATH zone — major long-term support" },
    ];
    const zones = allZones.filter(z => Math.abs(currentPrice - (z.from + z.to) / 2) < currentPrice * 0.25);

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
