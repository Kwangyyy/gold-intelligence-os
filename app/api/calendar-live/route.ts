// Fetches Forex Factory public calendar JSON (no API key required).
// Returns this week + next week events, filtered and enriched.
import { NextResponse } from "next/server";
import { getEconCalendar } from "@/lib/econCalendar";

export const dynamic = "force-dynamic";

export type EventImpact = "high" | "medium" | "low" | "holiday";

export interface EconEvent {
  id: string;
  date: string;        // ISO date "2025-01-20"
  time: string;        // "08:30" local ET or "All Day"
  currency: string;    // "USD", "EUR", etc.
  impact: EventImpact;
  title: string;
  forecast: string;
  previous: string;
  actual: string;
  affectsGold: boolean;
}

const GOLD_CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "CNY", "AUD"]);
const GOLD_KEYWORDS   = [
  "cpi","inflation","fed","fomc","nfp","payroll","gdp","pce","ppi",
  "rate decision","interest rate","unemployment","retail sales","ism",
  "jobs","consumer price","producer price","core","durable goods",
  "treasury","yield","debt","dollar","gold","silver","oil",
];

function affectsGold(currency: string, title: string): boolean {
  if (currency === "USD") return true;
  const lc = title.toLowerCase();
  return GOLD_KEYWORDS.some(kw => lc.includes(kw));
}

function mapImpact(raw: string): EventImpact {
  const r = (raw ?? "").toLowerCase();
  if (r.includes("high") || r === "3") return "high";
  if (r.includes("medium") || r === "2") return "medium";
  if (r.includes("holiday")) return "holiday";
  return "low";
}

let CACHE: { events: EconEvent[]; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30 min

// Pure mapper: the fetching moved to lib/econCalendar so all seven consumers
// share one cached request.
function normalise(json: Array<{
  date?: string; time?: string; country?: string; currency?: string;
  impact?: string; title?: string; forecast?: string; previous?: string;
  actual?: string;
}>): EconEvent[] {
  return json.map((ev, i) => ({
    id: `${ev.date}-${i}`,
    date: ev.date ?? "",
    time: ev.time ?? "All Day",
    currency: ev.currency ?? ev.country ?? "—",
    impact: mapImpact(ev.impact ?? ""),
    title: ev.title ?? "",
    forecast: ev.forecast ?? "",
    previous: ev.previous ?? "",
    actual: ev.actual ?? "",
    affectsGold: affectsGold(ev.currency ?? "", ev.title ?? ""),
  }));
}

export async function GET(req: Request) {
  const gold = new URL(req.url).searchParams.get("gold") === "1";

  if (CACHE && Date.now() - CACHE.ts < TTL) {
    const events = gold ? CACHE.events.filter(e => e.affectsGold) : CACHE.events;
    return NextResponse.json(events, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    // Both weeks through the shared cache. Fetching this feed directly from
    // seven different files drew a 429 as soon as a couple of pages loaded
    // together, and this route turned an empty result into a 500.
    const [thisWeek, nextWeek] = await Promise.all([
      getEconCalendar("thisweek"),
      getEconCalendar("nextweek"),
    ]);

    const events: EconEvent[] = normalise([...thisWeek, ...nextWeek]);

    // An empty calendar is not a server error. This used to throw, so a
    // rate-limited upstream — or simply a quiet week — turned into a 500 and
    // took the page down instead of showing "no events scheduled". Only cache
    // a non-empty result, so the next request retries rather than serving the
    // gap for half an hour.
    if (events.length) CACHE = { events, ts: Date.now() };
    const out = gold ? events.filter(e => e.affectsGold) : events;
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "calendar fetch failed" },
      { status: 500 },
    );
  }
}
