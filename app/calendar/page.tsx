"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { CalendarEvent, CalendarPayload } from "@/lib/calendar";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";

const IMPACT_COLOR: Record<string, string> = {
  High: "text-red-400 border-red-400/40 bg-red-400/10",
  Medium: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  Low: "text-silver/50 border-base-border bg-base-panel/40",
};

const GOLD_DOT: Record<string, string> = {
  high: "bg-gold shadow-goldglow",
  medium: "bg-gold/50",
  low: "bg-silver/20",
};

const COUNTRY_FLAG: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  AUD: "🇦🇺", CAD: "🇨🇦", CHF: "🇨🇭", NZD: "🇳🇿",
};

const TZ_OPTIONS = [
  { value: "Asia/Bangkok",     label: "Bangkok (ICT, UTC+7)" },
  { value: "UTC",              label: "UTC (GMT+0)" },
  { value: "Europe/London",    label: "London (GMT/BST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "Asia/Tokyo",       label: "Tokyo (JST, UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

function formatTime(dateStr: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
    }).format(new Date(dateStr));
  } catch {
    return "--:--";
  }
}

function tzAbbr(tz: string): string {
  const map: Record<string, string> = {
    "Asia/Bangkok": "ICT", "UTC": "UTC", "Europe/London": "LON",
    "America/New_York": "ET", "Asia/Tokyo": "JST", "Australia/Sydney": "AEST",
  };
  return map[tz] ?? tz.split("/").pop() ?? tz;
}

function formatDate(dateStr: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      weekday: "short", day: "numeric", month: "short", timeZone: tz,
    }).format(new Date(dateStr));
  } catch {
    return dateStr.slice(0, 10);
  }
}

function groupByDay(events: CalendarEvent[], tz: string): [string, CalendarEvent[]][] {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date(e.date));
    if (!map.has(localDate)) map.set(localDate, []);
    map.get(localDate)!.push(e);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function Countdown({ mins }: { mins: number }) {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const label = h > 0 ? `${h}ชม. ${m}น.` : `${m}น.`;
  if (mins < 0) return <span className="text-silver/40 text-xs">ผ่านแล้ว {label}</span>;
  if (mins < 30) return <span className="text-red-400 text-xs font-semibold animate-pulse">อีก {label}</span>;
  if (mins < 120) return <span className="text-amber-400 text-xs">อีก {label}</span>;
  return <span className="text-silver/60 text-xs">อีก {label}</span>;
}

function NextEventBanner({ event, tz }: { event: CalendarEvent; tz: string }) {
  const mins = event.minutesUntil;
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const timeLabel = h > 0 ? `${h} ชม. ${m} น.` : `${m} น.`;

  return (
    <div className="hero-surface mb-6 rounded-2xl border border-gold/20 p-4 shadow-royalglow">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⏰</span>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-silver/40">ข่าวถัดไปที่ส่งผลต่อทอง</div>
            <div className="text-lg font-bold text-gradient-royal">{event.title}</div>
            <div className="flex items-center gap-2 text-xs text-silver/60">
              <span>{COUNTRY_FLAG[event.country] ?? "🌐"} {event.country}</span>
              <span>·</span>
              <span>{formatDate(event.date, tz)} {formatTime(event.date, tz)} ({tzAbbr(tz)})</span>
              {event.forecast && <span>· คาด {event.forecast}</span>}
              {event.previous && <span>· ก่อน {event.previous}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          {mins < 30 ? (
            <div className="text-2xl font-black text-red-400 animate-pulse">อีก {timeLabel}</div>
          ) : (
            <div className="text-2xl font-black text-gold">อีก {timeLabel}</div>
          )}
          {mins < 30 && (
            <div className="text-xs text-red-400 mt-1">⚠ ระวังความผันผวน</div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, lang, tz }: { event: CalendarEvent; lang: "th" | "en"; tz: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`panel flex flex-col gap-2 p-4 transition-all ${event.isPast ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap items-start gap-2">
        {/* Time */}
        <div className="w-14 shrink-0 text-center">
          <div className="text-sm font-bold text-silver">{formatTime(event.date, tz)}</div>
          <div className="text-[10px] text-silver/40">{tzAbbr(tz)}</div>
        </div>

        {/* Flag + title */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base">{COUNTRY_FLAG[event.country] ?? "🌐"}</span>
            <span className="text-sm font-semibold text-silver">{event.title}</span>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${IMPACT_COLOR[event.impact]}`}>
              {event.impact}
            </span>
            <div className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${GOLD_DOT[event.goldRelevance]}`} />
              <span className="text-[10px] text-silver/40">ผลต่อทอง {event.goldRelevance}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-silver/50">
            {event.forecast && <span>คาด <span className="text-silver">{event.forecast}</span></span>}
            {event.previous && <span>ก่อน <span className="text-silver">{event.previous}</span></span>}
            {event.actual && <span>จริง <span className="text-neon font-semibold">{event.actual}</span></span>}
          </div>
        </div>

        {/* Countdown */}
        <div className="shrink-0">
          <Countdown mins={event.minutesUntil} />
        </div>
      </div>

      {/* AI Analysis */}
      {event.aiAnalysis && event.goldRelevance !== "low" && (
        <div>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-[11px] text-gold/70 hover:text-gold transition-colors"
          >
            <span>{open ? "▲" : "▼"}</span>
            <span>AI วิเคราะห์ผลต่อทอง</span>
          </button>
          {open && (
            <div className="mt-2 rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-xs leading-relaxed text-silver/80">
              {lang === "th" ? event.aiAnalysis.th : event.aiAnalysis.en}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState<"this" | "next">("this");
  const [highOnly, setHighOnly] = useState(false);
  const [tz, setTz] = useState("Asia/Bangkok");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const events = data ? (week === "this" ? data.thisWeek : data.nextWeek) : [];
  const filtered = highOnly ? events.filter((e) => e.impact === "High") : events;
  const groups = groupByDay(filtered, tz);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("calendarTitle")}
        subtitle={t("calendarSubtitle")}
      />

      {loading && (
        <div className="py-16 text-center text-silver/50">{t("loadingCalendar")}</div>
      )}

      {!loading && data?.nextEvent && week === "this" && (
        <NextEventBanner event={data.nextEvent} tz={tz} />
      )}

      {/* Controls */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-2">
          {(["this", "next"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                week === w
                  ? "bg-gold/20 text-gold border border-gold/40"
                  : "text-silver/50 border border-base-border hover:text-silver hover:border-silver/30"
              }`}
            >
              {w === "this" ? t("calThisWeek") : t("calNextWeek")}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {/* Timezone selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-silver/40">{t("calTimezone")}:</span>
              <select
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                className="rounded-lg border border-base-border bg-base-panel px-2 py-1.5 text-xs text-silver outline-none focus:border-neon/50"
              >
                {TZ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setHighOnly((h) => !h)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                highOnly
                  ? "bg-red-400/20 text-red-400 border-red-400/40"
                  : "text-silver/50 border-base-border hover:text-silver"
              }`}
            >
              {highOnly ? t("calHighOnly") : t("calAllEvents")}
            </button>
            <button onClick={load} className="rounded-lg border border-base-border px-3 py-1.5 text-xs text-silver/50 hover:text-silver transition-colors">
              ↻
            </button>
          </div>
        </div>
      )}

      {/* Calendar groups */}
      {!loading && groups.length === 0 && (
        <div className="py-16 text-center text-silver/40">{t("calNoEvents")}</div>
      )}

      {!loading && groups.map(([day, evts]) => (
        <div key={day}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-gold/60">{formatDate(evts[0].date, tz)}</span>
            <span className="h-px flex-1 bg-base-border/60" />
            <span className="text-[10px] text-silver/30">{evts.length} รายการ</span>
          </div>
          <div className="space-y-2">
            {evts.map((e) => (
              <EventCard key={e.id} event={e} lang={lang} tz={tz} />
            ))}
          </div>
        </div>
      ))}

      {!loading && data && (
        <p className="text-center text-[10px] text-silver/25">
          {data.source}
        </p>
      )}

      <Disclaimer />
    </div>
  );
}
