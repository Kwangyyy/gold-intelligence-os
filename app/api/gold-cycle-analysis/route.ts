import { NextResponse } from "next/server";

export const revalidate = 86400; // 24h — cycle data is structural

interface CyclePhase {
  name: string;
  start: number;    // year
  end: number | null;
  durationYears: number | null;
  peakPrice: number;
  troughPrice: number;
  gainPct: number;
  peakYear: number | null;
}

interface CurrentCycleData {
  cycleStart: number;
  currentPrice: number;
  cycleLow: number;
  cycleLowYear: number;
  gainFromLow: number;
  yearInCycle: number;
  projectedPeak: number | null;
  projectedPeakYear: number | null;
  phase: "early" | "mid" | "late" | "peak" | "correction";
  phaseDescription: string;
}

interface GoldCycleData {
  currentPrice: number;
  historicalCycles: CyclePhase[];
  currentCycle: CurrentCycleData;
  avgBullDuration: number;
  avgBullGain: number;
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
  const currentPrice = await fetchGoldSpot();
  const currentYear = 2025;

  // Historical gold bull/bear cycles (inflation-adjusted and nominal)
  const historicalCycles: CyclePhase[] = [
    {
      name: "Post-Nixon Bull",
      start: 1970,
      end: 1980,
      durationYears: 10,
      troughPrice: 35,
      peakPrice: 850,
      gainPct: 2329,
      peakYear: 1980,
    },
    {
      name: "1980s–90s Bear",
      start: 1980,
      end: 2001,
      durationYears: 21,
      troughPrice: 850,
      peakPrice: 253,
      gainPct: -70,
      peakYear: 2001,
    },
    {
      name: "2001–2011 Bull",
      start: 2001,
      end: 2011,
      durationYears: 10,
      troughPrice: 253,
      peakPrice: 1921,
      gainPct: 659,
      peakYear: 2011,
    },
    {
      name: "2011–2015 Correction",
      start: 2011,
      end: 2015,
      durationYears: 4,
      troughPrice: 1921,
      peakPrice: 1046,
      gainPct: -46,
      peakYear: 2015,
    },
    {
      name: "2015–2020 Recovery",
      start: 2015,
      end: 2020,
      durationYears: 5,
      troughPrice: 1046,
      peakPrice: 2089,
      gainPct: 100,
      peakYear: 2020,
    },
    {
      name: "2020–2022 Correction",
      start: 2020,
      end: 2022,
      durationYears: 2,
      troughPrice: 2089,
      peakPrice: 1618,
      gainPct: -23,
      peakYear: 2022,
    },
    {
      name: "2022– Bull Cycle",
      start: 2022,
      end: null,
      durationYears: null,
      troughPrice: 1618,
      peakPrice: currentPrice,
      gainPct: parseFloat(((currentPrice - 1618) / 1618 * 100).toFixed(1)),
      peakYear: null,
    },
  ];

  const bullCycles = historicalCycles.filter(c => c.gainPct > 0 && c.durationYears !== null);
  const avgBullDuration = bullCycles.reduce((s, c) => s + (c.durationYears ?? 0), 0) / bullCycles.length;
  const avgBullGain = bullCycles.slice(0, -1).reduce((s, c) => s + c.gainPct, 0) / (bullCycles.length - 1);

  const cycleLow = 1618;
  const cycleLowYear = 2022;
  const yearInCycle = currentYear - cycleLowYear;
  const gainFromLow = ((currentPrice - cycleLow) / cycleLow) * 100;

  // Cycle phase classification based on % gain and duration vs avg
  let phase: CurrentCycleData["phase"];
  let phaseDescription: string;

  if (gainFromLow < 30) {
    phase = "early";
    phaseDescription = "Early bull phase — price has only recovered partial losses. Institutional accumulation typically dominates. Upside potential remains large if the cycle follows historical patterns.";
  } else if (gainFromLow < 80) {
    phase = "mid";
    phaseDescription = "Mid-cycle bull market — retail participation is increasing. Price trend is well-established. Pullbacks are typically shallow and bought. Historical mid-cycles can last 3–6 more years.";
  } else if (gainFromLow < 150) {
    phase = "late";
    phaseDescription = "Late-cycle bull phase — momentum is strong but risk of blow-off is rising. Fed policy pivots and geopolitical drivers accelerating the final leg. Risk management critical here.";
  } else {
    phase = "peak";
    phaseDescription = "Potential peak territory — gains exceed historical mid-cycle norms. Watch for sentiment extremes, high futures positioning, and ETF inflows for distribution signals.";
  }

  // Project peak using avg bull gain from cycle low
  const projectedPeakMultiple = avgBullGain / 100 + 1;
  const projectedPeak = Math.round(cycleLow * projectedPeakMultiple / 10) * 10;
  const pctGainNeeded = ((projectedPeak - currentPrice) / currentPrice) * 100;

  const currentCycle: CurrentCycleData = {
    cycleStart: cycleLowYear,
    currentPrice,
    cycleLow,
    cycleLowYear,
    gainFromLow: parseFloat(gainFromLow.toFixed(1)),
    yearInCycle,
    projectedPeak: pctGainNeeded > 0 ? projectedPeak : null,
    projectedPeakYear: pctGainNeeded > 0 ? cycleLowYear + Math.round(avgBullDuration) : null,
    phase,
    phaseDescription,
  };

  const data: GoldCycleData = {
    currentPrice,
    historicalCycles,
    currentCycle,
    avgBullDuration: parseFloat(avgBullDuration.toFixed(1)),
    avgBullGain: parseFloat(avgBullGain.toFixed(0)),
    insight:
      `Current bull cycle: +${gainFromLow.toFixed(0)}% from $${cycleLow} (${cycleLowYear} low). ` +
      `Avg historical bull = +${avgBullGain.toFixed(0)}% over ${avgBullDuration.toFixed(1)} years. ` +
      `Current cycle is ${yearInCycle} year(s) old. Phase: ${phase.toUpperCase()}.`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
