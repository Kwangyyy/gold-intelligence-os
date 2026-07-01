"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { PriceHeatmapPayload, HeatCell, MonthSummary } from "@/app/api/price-heatmap/route";

function CalendarHeatmap({ cells }: { cells: HeatCell[] }) {
  if (cells.length === 0) return null;

  // Group into weeks
  const minWeek = Math.min(...cells.map(c => c.weekOfYear));
  const maxWeek = Math.max(...cells.map(c => c.weekOfYear));

  const byWeek: Record<number, Record<number, HeatCell>> = {};
  cells.forEach(c => {
    if (!byWeek[c.weekOfYear]) byWeek[c.weekOfYear] = {};
    byWeek[c.weekOfYear][c.dayOfWeek] = c;
  });

  const days = ["S","M","T","W","T","F","S"];

  return (
    <div>
      {/* Day labels */}
      <div className="flex gap-0.5 mb-0.5">
        <div className="w-3" />
        {days.map((d, i) => (
          <div key={i} className="w-3 text-center text-[6px]"
            style={{ color: "rgba(175,185,215,0.3)" }}>{d}</div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: maxWeek - minWeek + 1 }, (_, wi) => {
          const week = minWeek + wi;
          const weekCells = byWeek[week] ?? {};
          return (
            <div key={week} className="flex gap-0.5 items-center">
              <div className="w-3 text-[6px] text-right pr-0.5"
                style={{ color: "rgba(175,185,215,0.2)" }}>
                {week % 4 === 0 ? week : ""}
              </div>
              {days.map((_, di) => {
                const cell = weekCells[di];
                return (
                  <div key={di}
                    title={cell?.tooltip ?? ""}
                    className="w-3 h-3 rounded-[2px]"
                    style={{ background: cell ? cell.color : "rgba(255,255,255,0.03)" }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthCard({ m }: { m: MonthSummary }) {
  return (
    <div className="panel px-3 py-2.5">
      <div className="text-[9px] font-bold mb-0.5" style={{ color: "rgba(175,185,215,0.7)" }}>{m.label}</div>
      <div className="text-sm font-black"
        style={{ color: m.totalReturn >= 0 ? "#34d399" : "#f87171" }}>
        {m.totalReturn >= 0 ? "+" : ""}{m.totalReturn}%
      </div>
      <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
        {m.winDays}/{m.totalDays} วัน +
      </div>
      <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full"
          style={{ width: `${(m.winDays / m.totalDays) * 100}%`, background: m.color }} />
      </div>
    </div>
  );
}

export default function PriceHeatmapPage() {
  const [data, setData]       = useState<PriceHeatmapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/price-heatmap", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🌡️ Price Heatmap"
        subtitle="Calendar heatmap ผลตอบแทนรายวันของ XAUUSD ย้อนหลัง 1 ปี"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🌡️ กำลังสร้าง Heatmap…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Stats hero */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold ปัจจุบัน</div>
              <div className="text-sm font-mono font-black" style={{ color: "#f5c451" }}>
                ${data.goldPrice.toLocaleString()}
              </div>
            </div>
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>YTD Return</div>
              <div className="text-sm font-black" style={{ color: data.ytdReturn >= 0 ? "#34d399" : "#f87171" }}>
                {data.ytdReturn >= 0 ? "+" : ""}{data.ytdReturn}%
              </div>
            </div>
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Win Rate (วัน)</div>
              <div className="text-sm font-black" style={{ color: data.winRate >= 50 ? "#34d399" : "#f87171" }}>
                {data.winRate}%
              </div>
            </div>
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Streak</div>
              <div className="text-sm font-black"
                style={{ color: data.streak > 0 ? "#34d399" : data.streak < 0 ? "#f87171" : "#f5c451" }}>
                {data.streakTh}
              </div>
            </div>
          </div>

          {/* Best/Worst */}
          <div className="grid grid-cols-2 gap-3">
            <div className="panel px-4 py-3" style={{ borderLeft: "3px solid #34d399" }}>
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>วันดีสุด (1 ปี)</div>
              <div className="text-sm font-black" style={{ color: "#34d399" }}>+{data.bestDay.ret}%</div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{data.bestDay.date}</div>
            </div>
            <div className="panel px-4 py-3" style={{ borderLeft: "3px solid #f87171" }}>
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>วันแย่สุด (1 ปี)</div>
              <div className="text-sm font-black" style={{ color: "#f87171" }}>{data.worstDay.ret}%</div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{data.worstDay.date}</div>
            </div>
          </div>

          {/* Calendar Heatmap */}
          <div className="panel px-5 py-5 overflow-x-auto">
            <div className="text-[9px] uppercase tracking-widest mb-4" style={{ color: "rgba(175,185,215,0.3)" }}>
              Daily Return Heatmap — ย้อนหลัง 1 ปี
            </div>
            <CalendarHeatmap cells={data.cells} />
            {/* Legend */}
            <div className="flex items-center gap-1.5 mt-4">
              <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>ลง</span>
              {["#7f1d1d","#991b1b","#ef4444","#fca5a5","#374151","#4ade80","#16a34a","#166534","#14532d"].map(c => (
                <div key={c} className="w-3 h-3 rounded-[2px]" style={{ background: c }} />
              ))}
              <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>ขึ้น</span>
            </div>
          </div>

          {/* Monthly summary grid */}
          {data.monthSummaries.length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-widest mb-2 px-1"
                style={{ color: "rgba(175,185,215,0.3)" }}>
                สรุปผลรายเดือน
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {data.monthSummaries.map((m, i) => <MonthCard key={i} m={m} />)}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              avg daily: {data.avgDailyRet > 0 ? "+" : ""}{data.avgDailyRet}% |
              อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
