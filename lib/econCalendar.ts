// The ForexFactory economic calendar, fetched once and shared.
//
// Seven files were fetching this feed independently — brief, calendar,
// calendar-live, econ-impact, forecast, trade-ideas and newsRisk — each with
// its own parsing and no cache between them. Loading a few pages together, or
// running the audit sweep, was enough to draw a 429 from the host, and
// econ-impact answered 500 because a rate-limited calendar is fatal to it.
//
// The calendar changes a few times a day at most. One cached fetch serves all
// seven, and a 429 no longer costs anything because the last good copy stands
// in.

import { cachedJson } from "./kvStore";

export interface EconEvent {
  title: string;
  country: string;
  impact: string;       // "High" | "Medium" | "Low" | "Holiday"
  date: string;         // ISO with offset, as the feed publishes it
  forecast?: string;
  previous?: string;
  actual?: string;
}

type Week = "thisweek" | "nextweek";

const TTL_MS = 30 * 60_000;

async function load(week: Week): Promise<EconEvent[]> {
  const r = await fetch(`https://nfs.faireconomy.media/ff_calendar_${week}.json`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    // Six seconds, not ten. A Vercel Hobby function gets ten seconds in total,
    // so a ten-second fetch timeout can never fire — the platform kills the
    // function first and the caller sees a 500 instead of the empty list this
    // module is designed to return.
    signal: AbortSignal.timeout(6_000),
  });
  if (!r.ok) throw new Error(`FF calendar ${r.status}`);
  const raw = (await r.json()) as EconEvent[];
  if (!Array.isArray(raw)) throw new Error("FF calendar: unexpected shape");
  return raw;
}

/**
 * Calendar events for the week. Never throws: on failure it serves the last
 * good copy, or an empty list. Callers treat "no events" as "nothing scheduled",
 * which is the safe reading — inventing events would be worse.
 *
 * Cached across instances, not just within one. Seven files read this feed, and
 * with a per-instance cache a handful of cold starts was enough to draw a 429
 * — which is how econ-impact came to return 500 in production.
 */
export async function getEconCalendar(week: Week = "thisweek"): Promise<EconEvent[]> {
  return cachedJson<EconEvent[]>(
    `gios:calendar:${week}`,
    TTL_MS / 1000,
    () => load(week),
  ).catch(() => [] as EconEvent[]);
}

/** Today's events, highest impact first. */
export async function getTodayEvents(): Promise<EconEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rank: Record<string, number> = { High: 0, Medium: 1, Low: 2, Holiday: 3 };
  return (await getEconCalendar("thisweek"))
    .filter((e) => e.date?.startsWith(today))
    .sort((a, b) => (rank[a.impact] ?? 9) - (rank[b.impact] ?? 9));
}
