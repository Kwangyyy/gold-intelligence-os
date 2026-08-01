import { NextResponse } from "next/server";
import { getGoldCot, percentileOf, reportAgeDays } from "@/lib/cftcCot";

export const dynamic = "force-dynamic";

export interface COTSnapshot {
  reportDate: string;
  reportAgeDays: number;       // COT is always 3-7 days old by design; say so
  largeSpecLong: number;
  largeSpecShort: number;
  largeSpecNet: number;        // thousands contracts
  largeSpecNetPctile: number;  // 0-100 vs 52-week range
  commercialNet: number;
  openInterest: number;
  weeklyChange: number;        // net change vs prior week
  signal: "strongly bullish" | "bullish" | "neutral" | "bearish" | "strongly bearish";
  source: string;
}

export interface ETFFlowEntry {
  name: string;
  ticker: string;
  aumBn: number;          // assets under management $B
  heldOzMillion: number;  // gold held, million troy oz
  weekChange: number;     // oz million (+ = inflow, - = outflow)
  monthChange: number;
  signal: "inflow" | "outflow" | "neutral";
}

export interface CentralBankEntry {
  entity: string;
  flag: string;
  q1_2026Tonnes: number;   // positive = buying
  ytd2026Tonnes: number;
  trend: "buying" | "neutral" | "selling";
  totalReservesPct: number; // gold as % of total FX reserves
}

export interface SmartMoneySignal {
  source: string;
  signal: "bullish" | "neutral" | "bearish";
  detail: string;
  weight: number; // 0-1
}

export interface SmartMoneyPayload {
  cot: COTSnapshot;
  etfFlows: ETFFlowEntry[];
  centralBanks: CentralBankEntry[];
  signals: SmartMoneySignal[];
  smartMoneyScore: number;  // 0-100 (100 = max institutional bullish)
  smartMoneyBias: string;
  scoreTrend: "rising" | "falling" | "stable";
  interpretation: string;
  tier: "pro";
  timestamp: string;
}

// The last CFTC report, plus where its net spec position sits against the past
// year. Falls back to a clearly-labelled placeholder only if the CFTC is down.
async function buildCot(): Promise<COTSnapshot> {
  const weeks = await getGoldCot(104);
  const latest = weeks[weeks.length - 1];
  if (!latest) {
    return {
      reportDate: "unavailable", reportAgeDays: 0,
      largeSpecLong: 0, largeSpecShort: 0, largeSpecNet: 0, largeSpecNetPctile: 50,
      commercialNet: 0, openInterest: 0, weeklyChange: 0, signal: "neutral",
      source: "CFTC unreachable — no positioning data",
    };
  }
  const prev = weeks[weeks.length - 2];
  const year = weeks.slice(-52).map((w) => w.largeSpecNet);
  const pctile = percentileOf(year, latest.largeSpecNet);

  return {
    reportDate: latest.date,
    reportAgeDays: reportAgeDays(latest.date),
    largeSpecLong: latest.largeSpecLong,
    largeSpecShort: latest.largeSpecShort,
    largeSpecNet: latest.largeSpecNet,
    largeSpecNetPctile: pctile,
    commercialNet: latest.commercialNet,
    openInterest: latest.openInterest,
    weeklyChange: prev ? latest.largeSpecNet - prev.largeSpecNet : 0,
    signal:
      pctile >= 85 ? "strongly bullish" :
      pctile >= 60 ? "bullish" :
      pctile >= 35 ? "neutral" :
      pctile >= 15 ? "bearish" : "strongly bearish",
    source: "CFTC disaggregated futures-only · GOLD (088691) · positions as of Tuesday close",
  };
}

let CACHE: { data: SmartMoneyPayload; ts: number } | null = null;
const TTL_MS = 4 * 60 * 60 * 1000; // 4h — WGC/CFTC data updates weekly

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  // Was a snapshot hardcoded at 2026-06-24 and left to rot — five weeks stale
  // while the page presented it as current positioning. Real CFTC report now.
  const cot = await buildCot();

  // Major gold ETFs (AUM & flow data — typical institutional reporting lag 1-2 days)
  const etfFlows: ETFFlowEntry[] = [
    { name: "SPDR Gold Shares",          ticker: "GLD",  aumBn: 68.4, heldOzMillion: 27.82, weekChange: +0.42, monthChange: +1.84, signal: "inflow"  },
    { name: "iShares Gold Trust",        ticker: "IAU",  aumBn: 33.9, heldOzMillion: 14.31, weekChange: +0.18, monthChange: +0.63, signal: "inflow"  },
    { name: "Sprott Physical Gold Trust",ticker: "PHYS", aumBn: 16.8, heldOzMillion:  7.09, weekChange: -0.06, monthChange: +0.21, signal: "neutral" },
    { name: "Aberdeen Standard Gold ETF",ticker: "SGOL", aumBn: 10.9, heldOzMillion:  4.61, weekChange: +0.09, monthChange: +0.35, signal: "inflow"  },
    { name: "VanEck Merk Gold Trust",    ticker: "OUNZ", aumBn:  4.2, heldOzMillion:  1.78, weekChange: +0.04, monthChange: +0.11, signal: "inflow"  },
  ];

  // Central bank gold purchases — WGC Q1 2026 data
  const centralBanks: CentralBankEntry[] = [
    { entity: "People's Bank of China",         flag: "🇨🇳", q1_2026Tonnes: 27.1, ytd2026Tonnes: 27.1, trend: "buying",  totalReservesPct: 5.3  },
    { entity: "Reserve Bank of India",          flag: "🇮🇳", q1_2026Tonnes: 18.5, ytd2026Tonnes: 18.5, trend: "buying",  totalReservesPct: 9.9  },
    { entity: "National Bank of Poland",        flag: "🇵🇱", q1_2026Tonnes: 14.2, ytd2026Tonnes: 14.2, trend: "buying",  totalReservesPct: 17.4 },
    { entity: "Central Bank of Turkey",         flag: "🇹🇷", q1_2026Tonnes:  8.6, ytd2026Tonnes:  8.6, trend: "buying",  totalReservesPct: 33.1 },
    { entity: "Magyar Nemzeti Bank (Hungary)",  flag: "🇭🇺", q1_2026Tonnes:  6.0, ytd2026Tonnes:  6.0, trend: "buying",  totalReservesPct: 9.1  },
    { entity: "Monetary Auth. of Singapore",    flag: "🇸🇬", q1_2026Tonnes:  4.5, ytd2026Tonnes:  4.5, trend: "buying",  totalReservesPct: 3.0  },
    { entity: "Czech National Bank",            flag: "🇨🇿", q1_2026Tonnes:  2.8, ytd2026Tonnes:  2.8, trend: "buying",  totalReservesPct: 1.2  },
    { entity: "Deutsche Bundesbank",            flag: "🇩🇪", q1_2026Tonnes:  0.0, ytd2026Tonnes:  0.0, trend: "neutral", totalReservesPct: 72.4 },
    { entity: "Banque de France",               flag: "🇫🇷", q1_2026Tonnes:  0.0, ytd2026Tonnes:  0.0, trend: "neutral", totalReservesPct: 67.5 },
  ];

  // Composite signal components
  const cotBullish  = cot.largeSpecNetPctile >= 60;
  const cotNeutral  = cot.largeSpecNetPctile >= 35 && cot.largeSpecNetPctile < 60;
  const etfNetFlow  = etfFlows.reduce((s, e) => s + e.weekChange, 0);
  const cbBuyers    = centralBanks.filter(c => c.trend === "buying").length;

  const signals: SmartMoneySignal[] = [
    {
      source: "CFTC COT (Large Specs)",
      signal: cotBullish ? "bullish" : cotNeutral ? "neutral" : "bearish",
      detail: `Net ${cot.largeSpecNet.toLocaleString()} contracts (${cot.largeSpecNetPctile}th pctile 52w), +${cot.weeklyChange.toLocaleString()} WoW`,
      weight: 0.40,
    },
    {
      source: "Gold ETF Flows",
      signal: etfNetFlow > 0.3 ? "bullish" : etfNetFlow > -0.3 ? "neutral" : "bearish",
      detail: `Weekly net ${etfNetFlow >= 0 ? "+" : ""}${etfNetFlow.toFixed(2)}M oz across ${etfFlows.length} major ETFs`,
      weight: 0.35,
    },
    {
      source: "Central Bank Demand",
      signal: cbBuyers >= 6 ? "bullish" : cbBuyers >= 3 ? "neutral" : "bearish",
      detail: `${cbBuyers}/${centralBanks.length} central banks actively buying gold in Q1 2026`,
      weight: 0.25,
    },
  ];

  // Score: weighted average where bullish=100, neutral=50, bearish=0
  const signalValue = (s: "bullish" | "neutral" | "bearish") => s === "bullish" ? 100 : s === "neutral" ? 50 : 0;
  const smartMoneyScore = Math.round(
    signals.reduce((sum, s) => sum + signalValue(s.signal) * s.weight, 0)
  );

  const smartMoneyBias =
    smartMoneyScore >= 80 ? "Strongly Bullish" :
    smartMoneyScore >= 62 ? "Bullish" :
    smartMoneyScore >= 40 ? "Neutral" :
    smartMoneyScore >= 22 ? "Bearish" : "Strongly Bearish";

  const interpretation =
    smartMoneyScore >= 62
      ? "Institutional positioning is collectively bullish. Large speculators are adding net longs near the upper quartile, ETF holdings are expanding, and central banks continue accumulating. These signals historically precede sustained price appreciation."
      : smartMoneyScore >= 40
      ? "Smart money positioning is mixed. Watch for COT net position direction and ETF weekly flow to determine the next leg."
      : "Institutional investors are reducing gold exposure. COT positions are below median, ETF outflows are accelerating — caution warranted.";

  const payload: SmartMoneyPayload = {
    cot,
    etfFlows,
    centralBanks,
    signals,
    smartMoneyScore,
    smartMoneyBias,
    scoreTrend: "rising",
    interpretation,
    tier: "pro",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
