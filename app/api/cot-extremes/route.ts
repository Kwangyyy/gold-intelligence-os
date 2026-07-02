import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600; // 1 hour

interface COTRecord {
  date: string; // "MMM DD, YYYY"
  commercials: number; // net (longs - shorts), in contracts
  largeSpecs: number;
  smallSpecs: number;
  openInterest: number;
}

interface COTData {
  latest: COTRecord;
  history: COTRecord[]; // last 26 weeks
  largeSpecsNetPctile: number; // 0–100, percentile of current positioning vs 52w
  commercialsNetPctile: number;
  signal: "extreme_bullish" | "bullish" | "neutral" | "bearish" | "extreme_bearish";
  signalReason: string;
  crowdedLong: boolean;   // specs at 80th+ percentile = crowded
  crowdedShort: boolean;  // specs at 20th- percentile = potential squeeze
  openInterestChange: number; // wow change
  timestamp: string;
}

// Simulated COT data — representative of real CFTC patterns for gold
// Real data would be fetched from CFTC website or Quandl/Nasdaq Data Link
function generateCOTHistory(): COTRecord[] {
  const records: COTRecord[] = [];
  const now = new Date("2026-07-02");

  // Realistic baselines (in contracts × 100 oz = COMEX gold futures)
  // Net longs: large specs typically 100k-300k, commercials opposite
  let largeSpecsNet = 180000;
  let commercialsNet = -190000;
  let oi = 550000;

  for (let i = 25; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);

    // Random walk with realistic drift
    const weeklyChange = (Math.random() - 0.48) * 15000;
    largeSpecsNet = Math.max(-50000, Math.min(350000, largeSpecsNet + weeklyChange));
    commercialsNet = -largeSpecsNet * 1.05 + (Math.random() - 0.5) * 5000;
    const smallSpecs = -largeSpecsNet - commercialsNet;
    oi = Math.max(400000, Math.min(750000, oi + (Math.random() - 0.5) * 10000));

    records.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      commercials: Math.round(commercialsNet),
      largeSpecs: Math.round(largeSpecsNet),
      smallSpecs: Math.round(smallSpecs),
      openInterest: Math.round(oi),
    });
  }
  return records;
}

function percentile(arr: number[], value: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const below = sorted.filter(v => v <= value).length;
  return Math.round((below / sorted.length) * 100);
}

export async function GET() {
  const history = generateCOTHistory();
  const latest = history[history.length - 1];
  const prev = history[history.length - 2];

  const largeSpecsHistory = history.map(r => r.largeSpecs);
  const commercialsHistory = history.map(r => r.commercials);

  const largeSpecsNetPctile = percentile(largeSpecsHistory, latest.largeSpecs);
  const commercialsNetPctile = percentile(commercialsHistory, latest.commercials);

  const crowdedLong = largeSpecsNetPctile >= 80;
  const crowdedShort = largeSpecsNetPctile <= 20;
  const openInterestChange = latest.openInterest - prev.openInterest;

  let signal: COTData["signal"] = "neutral";
  let signalReason = "";

  if (largeSpecsNetPctile >= 85) {
    signal = "extreme_bearish";
    signalReason = `Large specs at ${largeSpecsNetPctile}th percentile — extreme crowded long; historically precedes pullbacks`;
  } else if (largeSpecsNetPctile >= 70) {
    signal = "bearish";
    signalReason = `Specs heavily long (${largeSpecsNetPctile}th pctile) — elevated reversal risk if price disappoints`;
  } else if (largeSpecsNetPctile <= 15) {
    signal = "extreme_bullish";
    signalReason = `Large specs near capitulation (${largeSpecsNetPctile}th pctile) — contrarian buy signal at spec extremes`;
  } else if (largeSpecsNetPctile <= 30) {
    signal = "bullish";
    signalReason = `Spec net positioning low (${largeSpecsNetPctile}th pctile) — room to rebuild longs; supportive of price`;
  } else {
    signal = "neutral";
    signalReason = `Spec positioning in neutral zone (${largeSpecsNetPctile}th pctile) — no strong contrarian signal`;
  }

  const data: COTData = {
    latest,
    history,
    largeSpecsNetPctile,
    commercialsNetPctile,
    signal,
    signalReason,
    crowdedLong,
    crowdedShort,
    openInterestChange,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
