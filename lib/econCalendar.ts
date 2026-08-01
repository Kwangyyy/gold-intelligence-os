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
const cache = new Map<Week, { events: EconEvent[]; at: number }>();
const inflight = new Map<Week, Promise<EconEvent[]>>();

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
 */
export async function getEconCalendar(week: Week = "thisweek"): Promise<EconEvent[]> {
  const hit = cache.get(week);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.events;

  // Collapse concurrent callers onto one request; several routes fire together
  // when a dashboard page loads.
  let p = inflight.get(week);
  if (!p) {
    p = load(week)
      .then((events) => {
        cache.set(week, { events, at: Date.now() });
        return events;
      })
      .catch(() => cache.get(week)?.events ?? [])
      .finally(() => inflight.delete(week));
    inflight.set(week, p);
  }
  return p;
}

/** Today's events, highest impact first. */
export async function getTodayEvents(): Promise<EconEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rank: Record<string, number> = { High: 0, Medium: 1, Low: 2, Holiday: 3 };
  return (await getEconCalendar("thisweek"))
    .filter((e) => e.date?.startsWith(today))
    .sort((a, b) => (rank[a.impact] ?? 9) - (rank[b.impact] ?? 9));
}
