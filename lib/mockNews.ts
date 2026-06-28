// Mock economic calendar for the News Risk card (Module 6 / §12 preview).
// In production this is replaced by a real economic-calendar API. The shape and
// the risk logic stay identical so the UI never changes.

import type { Bilingual, NewsEventSnapshot, NewsImpact, NewsRisk, RiskLevel } from "./types";

interface RecurringEvent {
  name: Bilingual;
  country: string;
  impact: NewsImpact;
  // 0 = Sunday ... 6 = Saturday (UTC)
  weekday: number;
  // UTC hour / minute of the release
  hourUtc: number;
  minuteUtc: number;
  forecast?: string;
  previous?: string;
}

// A representative set of high-impact USD events that move gold.
// Times are typical US release times in UTC (≈ 8:30am ET = 13:30 UTC during DST).
const SCHEDULE: RecurringEvent[] = [
  {
    name: { th: "ดัชนีราคาผู้บริโภค (CPI)", en: "Consumer Price Index (CPI)" },
    country: "US",
    impact: "high",
    weekday: 2, // Tuesday
    hourUtc: 13,
    minuteUtc: 30,
    forecast: "3.1%",
    previous: "3.0%",
  },
  {
    name: { th: "การจ้างงานนอกภาคเกษตร (NFP)", en: "Non-Farm Payrolls (NFP)" },
    country: "US",
    impact: "high",
    weekday: 5, // Friday
    hourUtc: 13,
    minuteUtc: 30,
    forecast: "175K",
    previous: "187K",
  },
  {
    name: { th: "ยอดค้าปลีก", en: "Retail Sales" },
    country: "US",
    impact: "medium",
    weekday: 4, // Thursday
    hourUtc: 13,
    minuteUtc: 30,
    forecast: "0.4%",
    previous: "0.6%",
  },
  {
    name: { th: "มติอัตราดอกเบี้ย Fed (FOMC)", en: "Fed Rate Decision (FOMC)" },
    country: "US",
    impact: "high",
    weekday: 3, // Wednesday
    hourUtc: 19,
    minuteUtc: 0,
    forecast: "5.50%",
    previous: "5.50%",
  },
  {
    name: { th: "ผู้ขอรับสวัสดิการว่างงาน", en: "Initial Jobless Claims" },
    country: "US",
    impact: "medium",
    weekday: 4, // Thursday
    hourUtc: 13,
    minuteUtc: 30,
    forecast: "220K",
    previous: "218K",
  },
];

// Returns the next future occurrence (as ISO) of a recurring weekly event.
function nextOccurrence(ev: RecurringEvent, now: Date): Date {
  const result = new Date(now);
  const dayDiff = (ev.weekday - now.getUTCDay() + 7) % 7;
  result.setUTCDate(now.getUTCDate() + dayDiff);
  result.setUTCHours(ev.hourUtc, ev.minuteUtc, 0, 0);
  // If that computed time is already in the past today, push a full week.
  if (result.getTime() <= now.getTime()) {
    result.setUTCDate(result.getUTCDate() + 7);
  }
  return result;
}

function impactToRisk(impact: NewsImpact, minutesToNext: number): RiskLevel {
  if (impact === "high") {
    if (minutesToNext <= 30) return "extreme";
    if (minutesToNext <= 120) return "high";
    if (minutesToNext <= 720) return "medium";
    return "low";
  }
  if (impact === "medium") {
    if (minutesToNext <= 60) return "high";
    if (minutesToNext <= 360) return "medium";
    return "low";
  }
  return "low";
}

// Computes the News Risk block for the dashboard given the current time.
export function getNewsRisk(now: Date = new Date()): NewsRisk {
  // Find the single soonest upcoming event across the schedule.
  let soonest: { ev: RecurringEvent; at: Date } | null = null;
  for (const ev of SCHEDULE) {
    const at = nextOccurrence(ev, now);
    if (!soonest || at.getTime() < soonest.at.getTime()) {
      soonest = { ev, at };
    }
  }

  if (!soonest) {
    return { level: "low", minutesToNext: null, nextEvent: null, warning: false };
  }

  const minutesToNext = Math.round((soonest.at.getTime() - now.getTime()) / 60000);
  const level = impactToRisk(soonest.ev.impact, minutesToNext);

  const nextEvent: NewsEventSnapshot = {
    name: soonest.ev.name,
    country: soonest.ev.country,
    impact: soonest.ev.impact,
    time: soonest.at.toISOString(),
    forecast: soonest.ev.forecast,
    previous: soonest.ev.previous,
  };

  return {
    level,
    minutesToNext,
    nextEvent,
    // PRD §12: warn when a high-impact event is within 30 minutes.
    warning: soonest.ev.impact === "high" && minutesToNext <= 30,
  };
}
