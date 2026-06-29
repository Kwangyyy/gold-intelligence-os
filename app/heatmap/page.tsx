"use client";

import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { HeatmapResponse, HeatmapCell } from "@/app/api/heatmap/route";

const DOW_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS_UTC  = Array.from({ length: 24 }, (_, i) => i);

// Sessions shown as column bands
const SESSIONS = [
  { name: "Sydney",   start: 21, end: 6,  color: "rgba(129,140,248,0.12)", border: "rgba(129,140,248,0.3)" },
  { name: "Tokyo",    start: 0,  end: 9,  color: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.28)"  },
  { name: "London",   start: 7,  end: 16, color: "rgba(96,165,250,0.1)",   border: "rgba(96,165,250,0.28)"  },
  { name: "New York", start: 12, end: 21, color: "rgba(249,115,22,0.1)",   border: "rgba(249,115,22,0.28)"  },
];

function cellColor(z: number): string {
  if (z === 0) return "rgba(255,255,255,0.02)";
  // gradient: dark green → gold
  if (z < 0.25) return `rgba(52,211,153,${0.08 + z * 0.8})`;
  if (z < 0.6)  return `rgba(245,196,81,${0.12 + z * 0.7})`;
  return `rgba(248,113,113,${0.2 + z * 0.7})`;
}

function HeatCell({ cell, maxR }: { cell: HeatmapCell; maxR: number }) {
  const tip = `${DOW_LABELS[cell.dow]} ${String(cell.hour).padStart(2,"0")}:00 UTC\nAvg Range: $${cell.avgRange.toFixed(2)}\nSamples: ${cell.count}`;
  return (
    <div title={tip} className="relative overflow-hidden rounded-[3px] transition-transform hover:scale-[1.15] hover:z-10 cursor-default"
      style={{ background: cellColor(cell.z), border: "1px solid rgba(255,255,255,0.04)", aspectRatio: "1" }}>
      {cell.z > 0.82 && (
        <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white/60">
          {cell.avgRange.toFixed(0)}
        </span>
      )}
    </div>
  );
}

export default function HeatmapPage() {
  const [data, setData]     = useState<HeatmapResponse | null>(null);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/heatmap")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Build lookup grid[dow][hour]
  const grid = useMemo(() => {
    if (!data) return null;
    const g: Record<number, Record<number, HeatmapCell>> = {};
    for (const c of data.cells) {
      if (!g[c.dow]) g[c.dow] = {};
      g[c.dow][c.hour] = c;
    }
    return g;
  }, [data]);

  // Top-5 hottest hours (avg across all days)
  const hotHours = useMemo(() => {
    if (!data) return [];
    const byHour: Record<number, { sum: number; n: number }> = {};
    for (const c of data.cells) {
      if (!byHour[c.hour]) byHour[c.hour] = { sum: 0, n: 0 };
      if (c.count > 0) { byHour[c.hour].sum += c.avgRange; byHour[c.hour].n += 1; }
    }
    return Object.entries(byHour)
      .map(([h, v]) => ({ hour: Number(h), avg: v.n ? v.sum / v.n : 0 }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [data]);

  // Best day
  const hotDay = useMemo(() => {
    if (!data) return null;
    const byDay: Record<number, { sum: number; n: number }> = {};
    for (const c of data.cells) {
      if (!byDay[c.dow]) byDay[c.dow] = { sum: 0, n: 0 };
      if (c.count > 0) { byDay[c.dow].sum += c.avgRange; byDay[c.dow].n += 1; }
    }
    return Object.entries(byDay)
      .map(([d, v]) => ({ dow: Number(d), avg: v.n ? v.sum / v.n : 0 }))
      .sort((a, b) => b.avg - a.avg)[0];
  }, [data]);

  const dateRange = data
    ? `${new Date(data.dataFrom).toLocaleDateString("th-TH")} – ${new Date(data.dataTo).toLocaleDateString("th-TH")}`
    : "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Session Volatility Heatmap 🌡️"
        subtitle="ความ volatile ของทองคำแต่ละชั่วโมง (UTC) เฉลี่ยจาก 60 วันล่าสุด" />

      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3 text-silver/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <span className="text-sm">กำลังดึงข้อมูล 60 วัน…</span>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {data && grid && (
        <>
          {/* ── Summary chips ──────────────────────────────────── */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="panel p-4">
              <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">Max Hour Range</div>
              <div className="font-mono text-xl font-black text-red-400">${data.maxRange.toFixed(2)}</div>
            </div>
            <div className="panel p-4">
              <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">Min Hour Range</div>
              <div className="font-mono text-xl font-black text-emerald-400">${data.minRange.toFixed(2)}</div>
            </div>
            <div className="panel p-4">
              <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">Hottest Day</div>
              <div className="font-mono text-xl font-black text-gold">
                {hotDay ? DOW_LABELS[hotDay.dow] : "—"}
              </div>
            </div>
            <div className="panel p-4">
              <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">Data Period</div>
              <div className="text-xs font-medium text-silver/60 leading-snug">{dateRange}</div>
            </div>
          </div>

          {/* ── Session legend ─────────────────────────────────── */}
          <div className="mb-4 flex flex-wrap gap-3">
            {[
              { label: "Sydney",    color: "#818cf8" },
              { label: "Tokyo",     color: "#34d399" },
              { label: "London",    color: "#60a5fa" },
              { label: "New York",  color: "#f97316" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 text-[11px] text-silver/50">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color, opacity: 0.7 }} />
                {s.label}
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2 text-[10px] text-silver/30">
              <span className="h-3 w-3 rounded-sm" style={{ background: "rgba(52,211,153,0.25)" }} /> Low
              <span className="h-3 w-3 rounded-sm" style={{ background: "rgba(245,196,81,0.65)" }} /> Mid
              <span className="h-3 w-3 rounded-sm" style={{ background: "rgba(248,113,113,0.85)" }} /> High
            </div>
          </div>

          {/* ── Heatmap grid ───────────────────────────────────── */}
          <div className="panel p-4 overflow-x-auto">
            {/* Hour header */}
            <div className="grid mb-1" style={{ gridTemplateColumns: "44px repeat(24, 1fr)" }}>
              <div />
              {HOURS_UTC.map(h => (
                <div key={h} className="text-center text-[9px] text-silver/25"
                  style={{ fontVariantNumeric: "tabular-nums" }}>
                  {h.toString().padStart(2,"0")}
                </div>
              ))}
            </div>

            {/* Session band overlay + rows */}
            <div className="relative">
              {/* Session colour bands */}
              <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: "44px repeat(24, 1fr)" }}>
                <div /> {/* day label spacer */}
                {HOURS_UTC.map(h => {
                  const sessions = SESSIONS.filter(s =>
                    s.start <= s.end
                      ? h >= s.start && h < s.end
                      : h >= s.start || h < s.end
                  );
                  const bg = sessions.length > 0 ? sessions[sessions.length - 1].color : "transparent";
                  return <div key={h} className="rounded-sm" style={{ background: bg }} />;
                })}
              </div>

              {/* Rows */}
              {[1,2,3,4,5].map(dow => (
                <div key={dow} className="grid mb-[3px] relative z-10" style={{ gridTemplateColumns: "44px repeat(24, 1fr)", gap: "2px" }}>
                  <div className="flex items-center text-[11px] font-bold text-silver/40">{DOW_LABELS[dow]}</div>
                  {HOURS_UTC.map(h => {
                    const cell = grid[dow]?.[h] ?? { dow, hour: h, avgRange: 0, count: 0, z: 0 };
                    return <HeatCell key={h} cell={cell} maxR={data.maxRange} />;
                  })}
                </div>
              ))}
            </div>

            {/* UTC hour markers */}
            <div className="mt-2 grid text-[8px] text-silver/20" style={{ gridTemplateColumns: "44px repeat(24, 1fr)" }}>
              <div className="text-[8px] text-silver/25">UTC</div>
              {HOURS_UTC.map(h => (
                <div key={h} className="text-center"
                  style={[0,7,12,21].includes(h) ? { color: "rgba(245,196,81,0.5)" } : undefined}>
                  {[0,7,12,21].includes(h) ? ["🗼","🇬🇧","🗽","🌙"][([0,7,12,21].indexOf(h))] : ""}
                </div>
              ))}
            </div>
          </div>

          {/* ── Hottest hours bar ──────────────────────────────── */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Top 5 ชั่วโมง Volatile (UTC)</div>
              <div className="space-y-2">
                {hotHours.map((h, i) => {
                  const pct = hotHours[0].avg > 0 ? (h.avg / hotHours[0].avg) * 100 : 0;
                  const rankColor = i === 0 ? "#f5c451" : i === 1 ? "#a78bfa" : i === 2 ? "#60a5fa" : "#475569";
                  return (
                    <div key={h.hour} className="flex items-center gap-3">
                      <span className="font-mono text-xs w-5 font-black" style={{ color: rankColor }}>#{i+1}</span>
                      <span className="font-mono text-xs text-silver/60 w-12">{String(h.hour).padStart(2,"0")}:00</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: rankColor }} />
                      </div>
                      <span className="font-mono text-xs text-silver/40 w-12 text-right">${h.avg.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Session Summary</div>
              <div className="space-y-2.5">
                {[
                  { name:"Tokyo (00-09)",    hours:[0,1,2,3,4,5,6,7,8],     color:"#34d399" },
                  { name:"London (07-16)",   hours:[7,8,9,10,11,12,13,14,15],color:"#60a5fa" },
                  { name:"NY (12-21)",       hours:[12,13,14,15,16,17,18,19,20],color:"#f97316" },
                  { name:"London/NY Overlap",hours:[12,13,14,15],             color:"#f5c451" },
                ].map(s => {
                  const cells = data.cells.filter(c => s.hours.includes(c.hour) && c.count > 0);
                  const avg   = cells.length ? cells.reduce((a,b) => a + b.avgRange, 0) / cells.length : 0;
                  return (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-xs text-silver/50">{s.name}</span>
                      </div>
                      <span className="font-mono text-xs font-bold" style={{ color: s.color }}>${avg.toFixed(2)}/h</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 rounded-lg bg-gold/5 border border-gold/15 p-2.5 text-[11px] text-gold/70">
                💡 London/NY Overlap (12–16 UTC) มักเป็นช่วง volatile สูงสุดของวัน
              </div>
            </div>
          </div>

          <div className="mt-3 text-center text-[10px] text-silver/20">
            ข้อมูล {data.symbol} · อิงจาก Yahoo Finance GC=F 1h candles · ชั่วโมงเป็น UTC
          </div>
        </>
      )}
    </div>
  );
}
