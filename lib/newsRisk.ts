// Live economic-calendar news risk for the council's News Filter (Module 6).
// Fetches the free Forex Factory weekly JSON and derives the same NewsRisk shape
// the mock produced — so the council/UI are unchanged, just real. Falls back to
// the provided (mock) risk whenever the feed is unavailable.

import type { NewsRisk, NewsEventSnapshot, NewsImpact, RiskLevel } from "./types";
import { mapFF, type CalendarEvent } from "./calendar";

const FF_URLS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
];

let cache: { risk: NewsRisk; ts: number } | null = null;
const TTL = 30 * 60_000; // 30 min

interface FFItem {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string | null;
  previous?: string | null;
  actual?: string | null;
}

async function fetchFeed(url: string): Promise<CalendarEvent[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`FF ${res.status}`);
  const json = (await res.json()) as FFItem[];
  return json
    .filter((e) => e.title && e.date)
    .map((e) =>
      mapFF({
        title: e.title!,
        country: e.country ?? "",
        date: e.date!,
        impact: e.impact ?? "Low",
        forecast: e.forecast ?? null,
        previous: e.previous ?? null,
        actual: e.actual ?? null,
      })
    );
}

const impactOf = (i: CalendarEvent["impact"]): NewsImpact => (i === "High" ? "high" : i === "Medium" ? "medium" : "low");

function toSnapshot(e: CalendarEvent): NewsEventSnapshot {
  return {
    name: { th: e.title, en: e.title },
    country: e.country,
    impact: impactOf(e.impact),
    time: e.date,
    forecast: e.forecast,
    previous: e.previous,
  };
}

function buildRisk(events: CalendarEvent[]): NewsRisk {
  // Upcoming (not long past), gold-relevant events within the next week.
  const upcoming = events
    .filter((e) => e.minutesUntil > -5 && e.minutesUntil < 7 * 1440 && e.goldRelevance !== "low")
    .sort((a, b) => a.minutesUntil - b.minutesUntil);

  const nextHigh = upcoming.find((e) => e.goldRelevance === "high");
  const next = nextHigh ?? upcoming[0] ?? null;
  if (!next) return { level: "low", minutesToNext: null, nextEvent: null, warning: false };

  const mins = Math.max(0, next.minutesUntil);
  const isHigh = next.goldRelevance === "high";
  let level: RiskLevel;
  let warning = false;
  if (isHigh && mins <= 30) { level = "extreme"; warning = true; }
  else if (isHigh && mins <= 180) level = "high";
  else if (mins <= 60 || isHigh) level = "medium";
  else level = "low";

  return { level, minutesToNext: mins, nextEvent: toSnapshot(next), warning };
}

// Live news risk, cached; returns `fallback` (the mock) on any failure.
export async function getNewsRiskLive(fallback: NewsRisk): Promise<NewsRisk> {
  if (cache && Date.now() - cache.ts < TTL) return cache.risk;
  try {
    const weeks = await Promise.allSettled(FF_URLS.map(fetchFeed));
    const events = weeks.flatMap((w) => (w.status === "fulfilled" ? w.value : []));
    if (events.length === 0) throw new Error("no events");
    const risk = buildRisk(events);
    cache = { risk, ts: Date.now() };
    return risk;
  } catch {
    return fallback;
  }
}
