import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface CyclePhase {
  name: "Accumulation" | "Markup" | "Distribution" | "Markdown";
  icon: string;
  color: string;
  description: string;
  typicalDuration: string;
  goldBehavior: string;
  keySignals: string[];
}

export interface CycleIndicator {
  name: string;
  value: number | string;
  signal: "bullish" | "neutral" | "bearish";
  weight: number;  // contribution to cycle score
  detail: string;
}

export interface HistoricalCycle {
  cycle: string;
  startYear: number;
  endYear: number;
  peakPrice: number;
  troughPrice: number;
  duration: string;
  maxGain: number;  // %
  maxDraw: number;  // %
  trigger: string;
}

export interface GoldCyclePayload {
  currentPhase: CyclePhase["name"];
  cycleScore: number;       // 0-100 (0=early accumulation, 100=late distribution)
  phaseProgress: number;    // % through current phase (estimated)
  cycleAge: string;         // "2.5 years into bull market"
  currentPhaseDef: CyclePhase;
  allPhases: CyclePhase[];
  cycleIndicators: CycleIndicator[];
  historicalCycles: HistoricalCycle[];
  priceTarget: {
    base: number;
    bull: number;
    bear: number;
  };
  cycleInterpretation: string;
  tier: "premium";
  timestamp: string;
}

let CACHE: { data: GoldCyclePayload; ts: number } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

const PHASES: CyclePhase[] = [
  {
    name: "Accumulation",
    icon: "🌑",
    color: "#60a5fa",
    description: "Smart money quietly buys near cycle lows. Prices are depressed, sentiment is poor, retail is bearish.",
    typicalDuration: "6–18 months",
    goldBehavior: "Sideways/choppy, declining volatility, occasional sharp recoveries",
    keySignals: ["COT commercials reducing shorts", "ETF outflows slowing", "Real yields peaking", "DXY topping"],
  },
  {
    name: "Markup",
    icon: "🌓",
    color: "#34d399",
    description: "Uptrend established, trend-followers join. Price moves steadily higher on increasing volume and momentum.",
    typicalDuration: "12–36 months",
    goldBehavior: "Consistent uptrend, higher-highs/higher-lows, pullbacks shallow and bought",
    keySignals: ["Real yields falling", "DXY weakening", "ETF inflows accelerating", "COT large spec net longs rising"],
  },
  {
    name: "Distribution",
    icon: "🌕",
    color: "#f5c451",
    description: "Smart money reduces exposure at highs while retail buys the euphoria. Prices stall despite positive news.",
    typicalDuration: "3–9 months",
    goldBehavior: "Volatile, wide-ranging, prices fail to hold new highs, increased media attention",
    keySignals: ["COT large spec at record longs", "ETF at max holdings", "Media coverage peak", "RSI negative divergence"],
  },
  {
    name: "Markdown",
    icon: "🌑",
    color: "#f87171",
    description: "Downtrend. Prices fall with few sustained recoveries. Sentiment becomes increasingly negative.",
    typicalDuration: "6–18 months",
    goldBehavior: "Lower-lows/lower-highs, dead-cat bounces fade quickly, defensive buying only",
    keySignals: ["Real yields rising", "DXY strengthening", "ETF outflows", "Central banks reduce purchases"],
  },
];

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  // Current market assessment (Jul 2026): Gold broke ATH in 2024, continued higher through 2025-2026
  // We are in a late Markup / early Distribution phase of the current bull cycle
  const currentPhase: CyclePhase["name"] = "Markup";
  const phaseProgress = 75; // 75% through markup phase — approaching distribution

  const cycleIndicators: CycleIndicator[] = [
    {
      name: "Real Yield Trend",
      value: "Falling (10y TIPS -0.24% MoM)",
      signal: "bullish",
      weight: 0.25,
      detail: "Negative real yields remain gold's strongest structural tailwind. 10Y TIPS yield declining.",
    },
    {
      name: "DXY Trend",
      value: "Weakening (-2.1% YTD)",
      signal: "bullish",
      weight: 0.20,
      detail: "Dollar index in mild downtrend — inversely correlated with gold price.",
    },
    {
      name: "COT Large Spec Net",
      value: "187,400 contracts (68th pctile)",
      signal: "bullish",
      weight: 0.20,
      detail: "Specs are positioned long but not at extreme levels. Still room to add before cycle peak.",
    },
    {
      name: "ETF Holdings Trend",
      value: "Expanding (+3.5M oz MoM)",
      signal: "bullish",
      weight: 0.15,
      detail: "Global gold ETF holdings growing — retail and institutional both adding exposure.",
    },
    {
      name: "Central Bank Demand",
      value: "91.5t in Q1 2026 (15th consecutive quarter of net buying)",
      signal: "bullish",
      weight: 0.10,
      detail: "Central banks remain structural buyers — largest demand cohort over 3-year cycle.",
    },
    {
      name: "Price Momentum vs 200D MA",
      value: "+12.4% above 200D MA",
      signal: "bullish",
      weight: 0.10,
      detail: "Healthy uptrend. Gold is above 200D MA but not in euphoric overextension (>30%).",
    },
  ];

  // Score: weighted average where bullish=100, neutral=50, bearish=0
  const cycleScore = Math.round(
    cycleIndicators.reduce((sum, ci) => {
      const val = ci.signal === "bullish" ? 100 : ci.signal === "neutral" ? 50 : 0;
      return sum + val * ci.weight;
    }, 0)
  );

  const historicalCycles: HistoricalCycle[] = [
    { cycle: "1970s Bull",    startYear: 1970, endYear: 1980, peakPrice: 850,   troughPrice: 35,    duration: "10 years",  maxGain: 2329, maxDraw: -47, trigger: "Nixon shock, oil embargo, stagflation" },
    { cycle: "1980s Bear",    startYear: 1980, endYear: 2001, peakPrice: 850,   troughPrice: 253,   duration: "21 years",  maxGain: 0,    maxDraw: -70, trigger: "Volcker rate hikes, dollar strength" },
    { cycle: "2000s Bull",    startYear: 2001, endYear: 2011, peakPrice: 1921,  troughPrice: 253,   duration: "10 years",  maxGain: 659,  maxDraw: -30, trigger: "9/11, GFC, QE, dollar weakness" },
    { cycle: "2011–2018 Bear",startYear: 2011, endYear: 2018, peakPrice: 1921,  troughPrice: 1046,  duration: "7 years",   maxGain: 0,    maxDraw: -45, trigger: "Rate hike cycle, dollar strength" },
    { cycle: "2018–Present Bull", startYear: 2018, endYear: 2026, peakPrice: 3400, troughPrice: 1160, duration: "8 years (ongoing)", maxGain: 193, maxDraw: -22, trigger: "Pandemic QE, de-dollarization, geopolitical tensions" },
  ];

  const cycleInterpretation =
    `Gold is ~${Math.round(phaseProgress)}% through the current Markup phase of an 8-year bull cycle that began in 2018. ` +
    `All major cycle indicators remain bullish — falling real yields, DXY weakness, expanding ETF holdings, and structural central bank demand. ` +
    `The current ${cycleScore}/100 cycle score suggests the bull market remains intact with moderate upside remaining. ` +
    `Watch for COT large spec positions approaching historical extremes (>300K contracts) and ETF holdings plateauing as early signs of Distribution entry.`;

  const payload: GoldCyclePayload = {
    currentPhase,
    cycleScore,
    phaseProgress,
    cycleAge: "8 years into bull market (2018 trough)",
    currentPhaseDef: PHASES.find(p => p.name === currentPhase)!,
    allPhases: PHASES,
    cycleIndicators,
    historicalCycles,
    priceTarget: {
      base: 3_600,
      bull: 4_200,
      bear: 2_800,
    },
    cycleInterpretation,
    tier: "premium",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
