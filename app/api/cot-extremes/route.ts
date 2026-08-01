import { NextResponse } from "next/server";
import { getGoldCot } from "@/lib/cftcCot";

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

// This used to be a Math.random() walk seeded at a fixed date — every request
// produced different "CFTC positioning", and the comment above it admitted real
// data "would be" fetched. It is fetched now: CFTC disaggregated futures-only,
// contract 088691.
function toRecord(w: { date: string; commercialNet: number; largeSpecNet: number; smallSpecNet: number; openInterest: number }): COTRecord {
  const d = new Date(`${w.date}T00:00:00Z`);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    commercials: w.commercialNet,
    largeSpecs: w.largeSpecNet,
    smallSpecs: w.smallSpecNet,
    openInterest: w.openInterest,
  };
}

function percentile(arr: number[], value: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const below = sorted.filter(v => v <= value).length;
  return Math.round((below / sorted.length) * 100);
}

export async function GET() {
  const weeks = await getGoldCot(52);
  if (weeks.length < 2) {
    return NextResponse.json(
      { error: "CFTC COT data unavailable — refusing to show positioning we do not have" },
      { status: 503 },
    );
  }
  // Percentiles are judged over the full year pulled; the table shows 26 weeks.
  const yearly = weeks.map(toRecord);
  const history = yearly.slice(-26);
  const latest = yearly[yearly.length - 1];
  const prev = yearly[yearly.length - 2];

  const largeSpecsHistory = yearly.map(r => r.largeSpecs);
  const commercialsHistory = yearly.map(r => r.commercials);

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
