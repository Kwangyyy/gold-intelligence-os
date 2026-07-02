import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface LiquiditySession {
  name: string;
  flag: string;
  openUTC: number;   // hour 0-23
  closeUTC: number;
  currentlyOpen: boolean;
  typicalSpread: number;    // typical bid-ask spread in $/oz during this session
  typicalVolume: number;    // relative volume index 0-100
  avgHourlyMove: number;    // avg abs price move per hour during session ($/oz)
  bestTradingHours: string; // UTC hours with highest activity
}

export interface SpreadEstimate {
  hour: number;        // 0-23 UTC
  spreadDollar: number; // estimated spot gold bid-ask spread $/oz
  volumeIndex: number;  // 0-100 relative volume
  session: string;
  quality: "excellent" | "good" | "fair" | "poor";
}

export interface LiquidityEvent {
  label: string;
  time: string;     // e.g. "08:20 UTC"
  description: string;
  impactOnLiquidity: "improves" | "reduces";
}

export interface LiquidityMapPayload {
  currentHourUTC: number;
  currentSpread: number;      // current estimated spread $/oz
  currentVolumeIndex: number; // 0-100
  currentQuality: string;
  activeSessions: string[];
  sessions: LiquiditySession[];
  hourlySpreadMap: SpreadEstimate[];
  scheduledEvents: LiquidityEvent[];
  bestEntryWindow: string;    // next best liquidity window
  goldBias: "bullish" | "neutral" | "bearish";
  tier: "free";
  timestamp: string;
}

let CACHE: { data: LiquidityMapPayload; ts: number } | null = null;
const TTL_MS = 5 * 60 * 1000; // 5m — changes with time of day

// Spread profile by UTC hour (from historical LBMA/CME data)
const HOURLY_SPREAD: Record<number, { spread: number; vol: number }> = {
  0:  { spread: 0.42, vol: 22 },   // Asian overlap quiet
  1:  { spread: 0.38, vol: 30 },   // Tokyo peak
  2:  { spread: 0.35, vol: 38 },
  3:  { spread: 0.33, vol: 42 },
  4:  { spread: 0.32, vol: 45 },
  5:  { spread: 0.31, vol: 48 },
  6:  { spread: 0.28, vol: 58 },   // Pre-London
  7:  { spread: 0.18, vol: 78 },   // London opens 08:00 UTC
  8:  { spread: 0.12, vol: 92 },   // LBMA AM fix 10:30 London = 09:30 UTC
  9:  { spread: 0.11, vol: 95 },   // Peak London
  10: { spread: 0.10, vol: 98 },   // LBMA PM fix 15:00 London = 14:00 UTC
  11: { spread: 0.11, vol: 95 },
  12: { spread: 0.10, vol: 97 },   // London+NY overlap
  13: { spread: 0.09, vol: 100 },  // NY opens, best liquidity
  14: { spread: 0.09, vol: 100 },  // COMEX peak
  15: { spread: 0.10, vol: 96 },
  16: { spread: 0.11, vol: 88 },
  17: { spread: 0.12, vol: 80 },
  18: { spread: 0.14, vol: 68 },   // London closes
  19: { spread: 0.18, vol: 55 },
  20: { spread: 0.22, vol: 45 },
  21: { spread: 0.28, vol: 38 },   // NY closes
  22: { spread: 0.35, vol: 28 },   // Overnight quiet
  23: { spread: 0.40, vol: 22 },
};

function qualityFromSpread(spread: number): SpreadEstimate["quality"] {
  if (spread <= 0.12) return "excellent";
  if (spread <= 0.20) return "good";
  if (spread <= 0.35) return "fair";
  return "poor";
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  const now = new Date();
  const hourUTC = now.getUTCHours();

  const sessions: LiquiditySession[] = [
    {
      name: "Asian (Tokyo/Shanghai)",
      flag: "🌏",
      openUTC: 23,  // 08:00 Tokyo = 23:00 prev UTC
      closeUTC: 8,
      currentlyOpen: hourUTC >= 23 || hourUTC < 8,
      typicalSpread: 0.36,
      typicalVolume: 35,
      avgHourlyMove: 1.8,
      bestTradingHours: "00:00–04:00 UTC",
    },
    {
      name: "London (LBMA/OTC)",
      flag: "🇬🇧",
      openUTC: 7,
      closeUTC: 17,
      currentlyOpen: hourUTC >= 7 && hourUTC < 17,
      typicalSpread: 0.12,
      typicalVolume: 88,
      avgHourlyMove: 3.4,
      bestTradingHours: "08:00–12:00 UTC (LBMA fix windows)",
    },
    {
      name: "New York (COMEX)",
      flag: "🇺🇸",
      openUTC: 13,
      closeUTC: 20,
      currentlyOpen: hourUTC >= 13 && hourUTC < 20,
      typicalSpread: 0.10,
      typicalVolume: 95,
      avgHourlyMove: 4.1,
      bestTradingHours: "13:00–17:00 UTC (COMEX peak)",
    },
    {
      name: "London+NY Overlap",
      flag: "⚡",
      openUTC: 13,
      closeUTC: 17,
      currentlyOpen: hourUTC >= 13 && hourUTC < 17,
      typicalSpread: 0.09,
      typicalVolume: 100,
      avgHourlyMove: 5.2,
      bestTradingHours: "13:00–17:00 UTC",
    },
  ];

  const hourlySpreadMap: SpreadEstimate[] = Array.from({ length: 24 }, (_, h) => {
    const { spread, vol } = HOURLY_SPREAD[h] ?? { spread: 0.40, vol: 20 };
    const sessionName =
      (h >= 13 && h < 17) ? "London+NY Overlap" :
      (h >= 7  && h < 17) ? "London" :
      (h >= 13 && h < 20) ? "New York" :
      (h >= 23 || h < 8)  ? "Asian" : "Off-Hours";
    return {
      hour: h,
      spreadDollar: spread,
      volumeIndex: vol,
      session: sessionName,
      quality: qualityFromSpread(spread),
    };
  });

  const current = HOURLY_SPREAD[hourUTC] ?? { spread: 0.35, vol: 25 };
  const activeSessions = sessions.filter(s => s.currentlyOpen).map(s => s.name);

  // Scheduled liquidity events (static for today Jul 2 2026)
  const scheduledEvents: LiquidityEvent[] = [
    { label: "LBMA AM Fix",     time: "10:30 London (09:30 UTC)",  description: "Gold price discovery — institutional orders concentrated",  impactOnLiquidity: "improves" },
    { label: "LBMA PM Fix",     time: "15:00 London (14:00 UTC)",  description: "Largest daily fix — benchmarks for OTC contracts set here",  impactOnLiquidity: "improves" },
    { label: "COMEX Open",      time: "08:20 NY (13:20 UTC)",      description: "COMEX futures market opens — highest volume of the day",      impactOnLiquidity: "improves" },
    { label: "COMEX Close",     time: "13:30 NY (18:30 UTC)",      description: "Main COMEX session closes — spreads widen",                  impactOnLiquidity: "reduces"  },
    { label: "NFP Release",     time: "08:30 NY (13:30 UTC) on 1st Fri", description: "Spreads spike 3-5× wider during NFP minute",          impactOnLiquidity: "reduces"  },
    { label: "FOMC Statement",  time: "14:00 NY (19:00 UTC)",      description: "Liquidity dries up in 30 min pre-FOMC; spikes post",         impactOnLiquidity: "reduces"  },
  ];

  // Next best entry window
  const nextBestHour = hourlySpreadMap
    .slice(hourUTC + 1)
    .concat(hourlySpreadMap.slice(0, hourUTC + 1))
    .find(h => h.quality === "excellent");
  const bestEntryWindow = nextBestHour
    ? `${String(nextBestHour.hour).padStart(2, "0")}:00 UTC — ${nextBestHour.session} (spread ~$${nextBestHour.spreadDollar}/oz)`
    : "13:00–17:00 UTC (London/NY overlap)";

  const payload: LiquidityMapPayload = {
    currentHourUTC: hourUTC,
    currentSpread: current.spread,
    currentVolumeIndex: current.vol,
    currentQuality: qualityFromSpread(current.spread),
    activeSessions,
    sessions,
    hourlySpreadMap,
    scheduledEvents,
    bestEntryWindow,
    goldBias: "neutral",
    tier: "free",
    timestamp: now.toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
