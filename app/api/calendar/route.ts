import { NextResponse } from "next/server";
import { buildFallback, mapFF, minutesUntil, type CalendarEvent, type CalendarPayload } from "@/lib/calendar";
import { geminiEnabled, generateCalendarGoldImpact } from "@/lib/gemini";

export const dynamic = "force-dynamic";

const FF_THIS_WEEK = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const FF_NEXT_WEEK = "https://nfs.faireconomy.media/ff_calendar_nextweek.json";

// ---------------------------------------------------------------------------
// AI analysis cache — one entry per event id, refreshed after 4 hours.
// ---------------------------------------------------------------------------
const AI_TTL = 4 * 60 * 60_000;
const aiCache = new Map<string, { analysis: { th: string; en: string }; at: number }>();

async function getAiAnalysis(event: CalendarEvent): Promise<{ th: string; en: string } | undefined> {
  if (!geminiEnabled() || event.goldRelevance === "low") return undefined;
  const cached = aiCache.get(event.id);
  if (cached && Date.now() - cached.at < AI_TTL) return cached.analysis;
  try {
    const analysis = await generateCalendarGoldImpact(
      { title: event.title, country: event.country, impact: event.impact, forecast: event.forecast, previous: event.previous },
      AbortSignal.timeout(10_000)
    );
    aiCache.set(event.id, { analysis, at: Date.now() });
    return analysis;
  } catch {
    return undefined;
  }
}

async function fetchWeek(url: string, fallbackOffset: 0 | 1): Promise<CalendarEvent[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 Gold-Intelligence-OS/1.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`FF responded ${res.status}`);
    const raw = (await res.json()) as Parameters<typeof mapFF>[0][];
    if (!Array.isArray(raw) || raw.length === 0) throw new Error("Empty response");
    return raw
      .filter((e) => typeof e.title === "string" && typeof e.country === "string")
      .map(mapFF)
      // Only USD events + high-impact EUR/GBP — most relevant for gold
      .filter((e) => e.country === "USD" || (e.impact === "High" && ["EUR", "GBP", "JPY"].includes(e.country)));
  } catch {
    return buildFallback(fallbackOffset);
  }
}

export async function GET() {
  const [thisWeekRaw, nextWeekRaw] = await Promise.all([
    fetchWeek(FF_THIS_WEEK, 0),
    fetchWeek(FF_NEXT_WEEK, 1),
  ]);

  // Refresh minutesUntil (it's computed at map time, so re-compute now)
  const refresh = (e: CalendarEvent): CalendarEvent => ({
    ...e,
    minutesUntil: minutesUntil(e.date),
    isPast: minutesUntil(e.date) < -60,
  });

  const thisWeek = thisWeekRaw.map(refresh);
  const nextWeek = nextWeekRaw.map(refresh);

  // Find next upcoming high-impact USD event
  const upcoming = [...thisWeek, ...nextWeek]
    .filter((e) => !e.isPast && e.impact === "High" && e.country === "USD")
    .sort((a, b) => a.minutesUntil - b.minutesUntil);
  const nextEvent = upcoming[0] ?? null;

  // Apply AI analysis to high/medium gold-relevance events (background, best-effort)
  const applyAi = async (events: CalendarEvent[]): Promise<CalendarEvent[]> => {
    return Promise.all(
      events.map(async (e) => {
        if (e.goldRelevance === "low" || e.isPast) return e;
        const analysis = await getAiAnalysis(e);
        return analysis ? { ...e, aiAnalysis: analysis } : e;
      })
    );
  };

  const [tw, nw] = await Promise.all([applyAi(thisWeek), applyAi(nextWeek)]);

  const payload: CalendarPayload = {
    thisWeek: tw,
    nextWeek: nw,
    nextEvent: tw.find((e) => e.id === nextEvent?.id) ?? nextEvent,
    source: "ForexFactory · USD & major currencies",
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
