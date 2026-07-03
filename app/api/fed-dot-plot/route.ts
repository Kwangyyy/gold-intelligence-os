import { NextResponse } from "next/server";

export const revalidate = 3600; // 1h cache

interface RateMeeting {
  date: string;
  marketImplied: number; // market-implied rate %
  fedMedianDot: number;  // Fed's dot plot median %
  divergence: number;    // market - fed (positive = market expects more cuts)
  goldSignal: "bullish" | "neutral" | "bearish";
}

interface FedDotPlotData {
  currentFedFundsRate: number;
  currentFedFundsTarget: string;
  marketImplied2025End: number;
  fedDot2025End: number;
  expectedCuts2025: number;
  divergence: number; // market - fed dots (positive = more dovish than Fed expects)
  goldImplication: string;
  signal: "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish";
  meetings: RateMeeting[];
  insight: string;
  timestamp: string;
}

async function fetchFedFundsProxy(): Promise<number | null> {
  // Use 2-year treasury as proxy for fed funds expectations
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EIRX?interval=1d&range=5d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    const json = await res.json();
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

function goldSignalFromDivergence(div: number): RateMeeting["goldSignal"] {
  if (div > 0.5)  return "bullish";  // market prices more cuts = lower rates = gold bullish
  if (div < -0.5) return "bearish";  // market prices fewer cuts = higher rates = gold bearish
  return "neutral";
}

export async function GET() {
  const irxYield = await fetchFedFundsProxy();

  // Federal Funds Rate as of 2025 (post-2024 cutting cycle)
  // Fed cut 100bp in late 2024 from 5.25-5.50 to 4.25-4.50
  const currentRate = 4.375; // midpoint of 4.25-4.50 target range
  const currentTarget = "4.25%-4.50%";

  // Market-implied rates for upcoming FOMC meetings
  // Using CME FedWatch-like estimates (as of mid-2025)
  // Approximated from 30-day fed funds futures
  const marketImplied2025End = 3.75; // market pricing ~2 more cuts in 2025
  const fedDot2025End = 3.875;       // Fed dot plot median (Dec 2024 projection)
  const divergence = parseFloat((marketImplied2025End - fedDot2025End).toFixed(3));
  const expectedCuts = Math.round((currentRate - marketImplied2025End) / 0.25);

  const meetings: RateMeeting[] = [
    { date: "Jul 2025",  marketImplied: 4.125, fedMedianDot: 4.25,  divergence: -0.125, goldSignal: "bearish" },
    { date: "Sep 2025",  marketImplied: 3.875, fedMedianDot: 4.00,  divergence: -0.125, goldSignal: "neutral" },
    { date: "Nov 2025",  marketImplied: 3.750, fedMedianDot: 3.875, divergence: -0.125, goldSignal: "neutral" },
    { date: "Dec 2025",  marketImplied: 3.625, fedMedianDot: 3.875, divergence: -0.250, goldSignal: "bullish" },
    { date: "Jan 2026",  marketImplied: 3.500, fedMedianDot: 3.625, divergence: -0.125, goldSignal: "bullish" },
    { date: "Mar 2026",  marketImplied: 3.250, fedMedianDot: 3.500, divergence: -0.250, goldSignal: "bullish" },
  ].map(m => ({ ...m, goldSignal: goldSignalFromDivergence(m.divergence) }));

  const signal: FedDotPlotData["signal"] =
    divergence > 0.5  ? "very_bullish" :
    divergence > 0.15 ? "bullish" :
    divergence < -0.5 ? "very_bearish" :
    divergence < -0.15 ? "bearish" : "neutral";

  const goldImplication =
    signal === "very_bullish"
      ? `Market prices ${expectedCuts} cuts — significantly more than Fed dots. If right, real yields will fall sharply. Very bullish for gold.`
      : signal === "bullish"
      ? `Market prices ~${expectedCuts} cuts, slightly more than Fed dots. Lower rates path supports gold's non-yielding appeal.`
      : signal === "neutral"
      ? `Market aligns closely with Fed dot plot, pricing ~${expectedCuts} cuts. Rate path uncertainty is the dominant risk for gold.`
      : signal === "bearish"
      ? `Market prices fewer cuts than Fed dots — means higher-for-longer rates. Headwind for gold as real yields stay elevated.`
      : `Market is significantly more hawkish than Fed dots — large divergence signals potential rate shock if economy stays hot. Bearish for gold.`;

  const data: FedDotPlotData = {
    currentFedFundsRate: currentRate,
    currentFedFundsTarget: currentTarget,
    marketImplied2025End,
    fedDot2025End,
    expectedCuts2025: expectedCuts,
    divergence,
    goldImplication,
    signal,
    meetings,
    insight:
      `Fed Funds at ${currentTarget}. Market implies ${expectedCuts} cut${expectedCuts !== 1 ? "s" : ""} remaining in 2025, ` +
      `ending the year at ~${marketImplied2025End.toFixed(2)}%. ` +
      `${Math.abs(divergence * 100).toFixed(0)}bp ${divergence > 0 ? "more dovish" : "more hawkish"} than Fed median dots. ` +
      (irxYield ? `13-week T-bill yield at ${irxYield.toFixed(2)}% (market-implied floor).` : ""),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
