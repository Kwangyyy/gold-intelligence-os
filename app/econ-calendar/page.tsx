"use client";

import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { EconEvent, EventImpact } from "@/app/api/calendar-live/route";

const IMPACT_CFG: Record<EventImpact, { label: string; color: string; bg: string; dot: string }> = {
  high:    { label: "High",    color: "#f87171", bg: "rgba(248,113,113,0.12)", dot: "#f87171" },
  medium:  { label: "Medium",  color: "#f5c451", bg: "rgba(245,196,81,0.10)", dot: "#f5c451" },
  low:     { label: "Low",     color: "#475569", bg: "rgba(71,85,105,0.10)",  dot: "#475569" },
  holiday: { label: "Holiday", color: "#a78bfa", bg: "rgba(167,139,250,0.10)",dot: "#a78bfa" },
};

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function groupByDate(events: EconEvent[]): [string, EconEvent[]][] {
  const map = new Map<string, EconEvent[]>();
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function dateLabel(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const dow = DAY_NAMES[d.getDay()];
  return `${dow} ${d.getDate()}/${d.getMonth() + 1}`;
}

function isToday(iso: string): boolean {
  return iso === new Date().toISOString().slice(0, 10);
}

function ActualCell({ actual, forecast, impact }: { actual: string; forecast: string; impact: EventImpact }) {
  if (!actual) return <span className="text-silver/25">—</span>;
  const fNum = parseFloat(forecast), aNum = parseFloat(actual);
  const better = !isNaN(fNum) && !isNaN(aNum) && impact !== "low"
    ? aNum > fNum : null;
  return (
    <span className="font-bold" style={{ color: better === true ? "#34d399" : better === false ? "#f87171" : "#e2e8f0" }}>
      {actual}
    </span>
  );
}

export default function EconCalendarPage() {
  const [events, setEvents]     = useState<EconEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [goldOnly, setGoldOnly] = useState(true);
  const [impactFilter, setImpactFilter] = useState<EventImpact | "all">("all");
  const [search, setSearch]     = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/calendar-live?gold=${goldOnly ? "1" : "0"}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else { setEvents(Array.isArray(d) ? d : []); setError(""); }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [goldOnly]);

  const filtered = useMemo(() => {
    let list = events;
    if (impactFilter !== "all") list = list.filter(e => e.impact === impactFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || e.currency.toLowerCase().includes(q));
    }
    return list;
  }, [events, impactFilter, search]);

  const grouped    = groupByDate(filtered);
  const highCount  = events.filter(e => e.impact === "high").length;
  const goldCount  = events.filter(e => e.affectsGold && e.impact === "high").length;

  // Next upcoming high-impact event
  const nowISO = new Date().toISOString().slice(0, 10);
  const nextHigh = events.find(e => e.impact === "high" && e.date >= nowISO && !e.actual);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Economic Calendar 📅"
        subtitle="Forex Factory — this week + next week · auto-refresh ทุก 30 นาที" />

      {/* ── Summary ────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="panel p-4">
          <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">High Impact</div>
          <div className="font-mono text-2xl font-black text-red-400">{highCount}</div>
          <div className="text-[10px] text-silver/30">events this/next week</div>
        </div>
        <div className="panel p-4">
          <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">Affects Gold</div>
          <div className="font-mono text-2xl font-black text-gold">{goldCount}</div>
          <div className="text-[10px] text-silver/30">high-impact gold-related</div>
        </div>
        <div className="panel p-4 col-span-2">
          <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">Next High-Impact</div>
          {nextHigh ? (
            <>
              <div className="text-sm font-bold text-red-400 truncate">{nextHigh.title}</div>
              <div className="text-[10px] text-silver/40 mt-0.5">
                {dateLabel(nextHigh.date)} · {nextHigh.time} ET · {nextHigh.currency}
              </div>
            </>
          ) : (
            <div className="text-sm text-silver/30">ไม่มีในช่วงนี้</div>
          )}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setGoldOnly(v => !v)}
          className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
          style={goldOnly
            ? { background: "rgba(245,196,81,0.15)", border: "1px solid rgba(245,196,81,0.4)", color: "#f5c451" }
            : { background: "rgba(71,85,105,0.1)", border: "1px solid rgba(71,85,105,0.2)", color: "#475569" }}>
          🥇 Gold-related only
        </button>

        {(["all","high","medium","low"] as const).map(f => (
          <button key={f} onClick={() => setImpactFilter(f)}
            className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all capitalize"
            style={impactFilter === f
              ? { background: f === "high" ? "rgba(248,113,113,0.15)" : f === "medium" ? "rgba(245,196,81,0.12)" : f === "all" ? "rgba(168,85,247,0.15)" : "rgba(71,85,105,0.12)", border: `1px solid ${f === "high" ? "rgba(248,113,113,0.4)" : f === "medium" ? "rgba(245,196,81,0.35)" : f === "all" ? "rgba(168,85,247,0.4)" : "rgba(71,85,105,0.3)"}`, color: f === "high" ? "#f87171" : f === "medium" ? "#f5c451" : f === "all" ? "#a78bfa" : "#64748b" }
              : { background: "rgba(71,85,105,0.08)", border: "1px solid rgba(71,85,105,0.15)", color: "#475569" }}>
            {f === "all" ? "All" : f}
          </button>
        ))}

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา event…"
          className="ml-auto rounded-lg border border-base-border/30 bg-white/[0.03] px-3 py-1.5 text-xs text-silver/70 placeholder-silver/25 outline-none focus:border-gold/40 transition-colors w-40" />
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3 text-silver/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <span className="text-sm">กำลังโหลด Forex Factory…</span>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {!loading && !error && grouped.length === 0 && (
        <div className="mt-12 text-center text-sm text-silver/30">ไม่พบ events ที่ตรงกับ filter</div>
      )}

      <div className="space-y-6">
        {grouped.map(([date, evs]) => (
          <div key={date}>
            {/* Day header */}
            <div className="mb-2 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: isToday(date) ? "#f5c451" : "#94a3b8" }}>
                  {dateLabel(date)}
                </span>
                {isToday(date) && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-black"
                    style={{ background: "rgba(245,196,81,0.15)", border: "1px solid rgba(245,196,81,0.4)", color: "#f5c451" }}>
                    TODAY
                  </span>
                )}
              </div>
              <div className="flex-1 h-px bg-base-border/20" />
              <span className="text-[10px] text-silver/25">{evs.length} events</span>
            </div>

            {/* Events */}
            <div className="panel overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {evs.map((e, i) => {
                    const ic = IMPACT_CFG[e.impact];
                    return (
                      <tr key={e.id}
                        className="border-b border-base-border/10 transition-colors hover:bg-white/[0.015]"
                        style={i === 0 ? undefined : undefined}>
                        {/* Time */}
                        <td className="px-3 py-2.5 whitespace-nowrap text-silver/40 w-16">
                          {e.time === "All Day" ? <span className="text-silver/20">All Day</span> : e.time}
                        </td>
                        {/* Impact dot */}
                        <td className="px-2 py-2.5 w-6">
                          <span className="block h-2 w-2 rounded-full" style={{ background: ic.dot }} />
                        </td>
                        {/* Currency */}
                        <td className="px-2 py-2.5 w-10">
                          <span className="font-bold text-[11px]" style={{ color: e.currency === "USD" ? "#60a5fa" : "#94a3b8" }}>
                            {e.currency}
                          </span>
                        </td>
                        {/* Title */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-silver/75">{e.title}</span>
                            {e.affectsGold && (
                              <span className="text-[9px] text-gold/50">🥇</span>
                            )}
                          </div>
                        </td>
                        {/* Impact badge */}
                        <td className="px-2 py-2.5 hidden sm:table-cell">
                          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                            style={{ background: ic.bg, color: ic.color }}>
                            {ic.label}
                          </span>
                        </td>
                        {/* Forecast */}
                        <td className="px-3 py-2.5 font-mono text-silver/40 hidden sm:table-cell whitespace-nowrap">
                          {e.forecast || "—"}
                        </td>
                        {/* Previous */}
                        <td className="px-3 py-2.5 font-mono text-silver/30 hidden md:table-cell whitespace-nowrap">
                          {e.previous || "—"}
                        </td>
                        {/* Actual */}
                        <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                          <ActualCell actual={e.actual} forecast={e.forecast} impact={e.impact} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="mt-4 text-center text-[10px] text-silver/20">
          {filtered.length} events · ข้อมูลจาก Forex Factory · 🥇 = ส่งผลต่อทองคำ
        </div>
      )}
    </div>
  );
}
