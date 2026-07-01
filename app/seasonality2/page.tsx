"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { SeasonalityPayload, MonthStat, WeekOfYearStat } from "@/app/api/seasonality2/route";

/* ─── Monthly bar chart ─────────────────────────────────────── */
function MonthBars({ months, currentMonth }: { months: MonthStat[]; currentMonth: number }) {
  const maxAbs = Math.max(...months.map(m => Math.abs(m.avgReturn)), 0.1);
  return (
    <div className="flex items-end gap-1 h-28">
      {months.map(m => {
        const isNeg     = m.avgReturn < 0;
        const isCurrent = m.month === currentMonth;
        const barH      = Math.abs(m.avgReturn) / maxAbs * 100;
        const color     = isNeg ? "#f87171" : "#34d399";
        return (
          <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
            {/* positive bar grows from bottom, negative from bottom too but colored red */}
            <div className="w-full flex flex-col items-center justify-end" style={{ height: "100%" }}>
              <div className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${barH}%`,
                  background: color,
                  opacity: isCurrent ? 1 : 0.55,
                  outline: isCurrent ? `2px solid #f5c451` : undefined,
                  outlineOffset: "1px",
                  minHeight: 2,
                }}
                title={`${m.monthName}: ${m.avgReturn > 0 ? "+" : ""}${m.avgReturn.toFixed(2)}% avg · ${m.winRate.toFixed(0)}% win · ${m.sampleCount} yrs`}
              />
            </div>
            <span className="text-[8px] leading-none" style={{ color: isCurrent ? "#f5c451" : "rgba(175,185,215,0.35)" }}>
              {m.monthName.slice(0, 1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Week heatmap (52 cols) ────────────────────────────────── */
function WeekHeatmap({ weeks, currentWeek }: { weeks: WeekOfYearStat[]; currentWeek: number }) {
  const maxAbs = Math.max(...weeks.map(w => Math.abs(w.avgReturn)), 0.1);
  // Split into 4 rows of 13
  const rows: WeekOfYearStat[][] = [weeks.slice(0, 13), weeks.slice(13, 26), weeks.slice(26, 39), weeks.slice(39, 52)];
  const rowLabels = ["Q1 (Wk 1-13)", "Q2 (14-26)", "Q3 (27-39)", "Q4 (40-52)"];
  return (
    <div className="space-y-1.5">
      {rows.map((row, ri) => (
        <div key={ri} className="flex items-center gap-1.5">
          <span className="text-[8px] w-20 shrink-0" style={{ color: "rgba(175,185,215,0.3)" }}>{rowLabels[ri]}</span>
          <div className="flex gap-0.5 flex-1">
            {row.map(w => {
              const intensity = Math.abs(w.avgReturn) / maxAbs;
              const isCurrent = w.week === currentWeek;
              const color = w.avgReturn >= 0
                ? `rgba(52,211,153,${0.08 + intensity * 0.7})`
                : `rgba(248,113,113,${0.08 + intensity * 0.7})`;
              return (
                <div key={w.week}
                  className="flex-1 h-5 rounded-sm cursor-default"
                  style={{ background: color, outline: isCurrent ? "2px solid #f5c451" : undefined }}
                  title={`Wk ${w.week}: ${w.avgReturn > 0 ? "+" : ""}${w.avgReturn.toFixed(2)}% · ${w.winRate.toFixed(0)}% win`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>Bearish</span>
        <div className="flex gap-0.5 flex-1 max-w-[120px]">
          {[0.8, 0.5, 0.2, 0.2, 0.5, 0.8].map((v, i) => (
            <div key={i} className="h-2 flex-1 rounded-sm"
              style={{ background: i < 3 ? `rgba(248,113,113,${v})` : `rgba(52,211,153,${v})` }} />
          ))}
        </div>
        <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>Bullish</span>
      </div>
    </div>
  );
}

/* ─── Year table ────────────────────────────────────────────── */
function YearTable({ yearStats }: { yearStats: SeasonalityPayload["yearStats"] }) {
  const sorted = [...yearStats].sort((a, b) => b.year - a.year).slice(0, 10);
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-5 gap-2 text-[8px] uppercase tracking-widest pb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
        <span>Year</span><span className="text-right">Open</span><span className="text-right">Close</span>
        <span className="text-right">Return</span><span className="text-right">Range</span>
      </div>
      {sorted.map(y => {
        const isPos = y.annualReturn >= 0;
        return (
          <div key={y.year} className="grid grid-cols-5 gap-2 text-xs py-1.5 rounded-lg px-2 transition-colors hover:bg-white/[0.02]">
            <span className="font-bold" style={{ color: "rgba(175,185,215,0.7)" }}>{y.year}</span>
            <span className="text-right font-mono text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>${y.open.toLocaleString()}</span>
            <span className="text-right font-mono text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>${y.close.toLocaleString()}</span>
            <span className="text-right font-mono text-[11px] font-bold" style={{ color: isPos ? "#34d399" : "#f87171" }}>
              {isPos ? "+" : ""}{y.annualReturn.toFixed(1)}%
            </span>
            <span className="text-right font-mono text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>${y.range.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function Seasonality2Page() {
  const [data, setData]       = useState<SeasonalityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/seasonality2", { cache: "no-store" });
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
        title="📅 Gold Seasonality (10Y)"
        subtitle="Monthly & weekly seasonal patterns for XAUUSD — ข้อมูลย้อนหลัง 10 ปี"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>📅 กำลังโหลดข้อมูล Seasonality…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Current month highlight */}
          {data.currentMonthStat && (
            <div className="panel px-5 py-4 flex items-center gap-5"
              style={{ border: "1px solid rgba(245,196,81,0.2)", background: "rgba(245,196,81,0.04)" }}>
              <div className="text-3xl">📅</div>
              <div className="flex-1">
                <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>เดือนปัจจุบัน</div>
                <div className="text-sm font-black" style={{ color: "#f5c451" }}>{data.currentMonthStat.monthName}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(175,185,215,0.5)" }}>
                  avg {data.currentMonthStat.avgReturn > 0 ? "+" : ""}{data.currentMonthStat.avgReturn.toFixed(2)}% ·
                  win {data.currentMonthStat.winRate.toFixed(0)}% ·
                  {data.currentMonthStat.sampleCount} ปี
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black" style={{ color: data.currentMonthStat.avgReturn >= 0 ? "#34d399" : "#f87171" }}>
                  {data.currentMonthStat.avgReturn >= 0 ? "📈" : "📉"}
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Week {data.currentWeek}
                </div>
              </div>
            </div>
          )}

          {/* Best / worst months */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "🏆 Best Month",  stat: data.bestMonth,  color: "#34d399" },
              { label: "📉 Worst Month", stat: data.worstMonth, color: "#f87171" },
            ].map(({ label, stat, color }) => (
              <div key={label} className="panel px-4 py-4" style={{ borderColor: `${color}25` }}>
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>{label}</div>
                <div className="text-lg font-black mb-0.5" style={{ color }}>{stat.monthName}</div>
                <div className="text-[10px]" style={{ color }}>avg {stat.avgReturn > 0 ? "+" : ""}{stat.avgReturn.toFixed(2)}%</div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>win rate {stat.winRate.toFixed(0)}%</div>
              </div>
            ))}
          </div>

          {/* Monthly bar chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Avg Monthly Return — ย้อนหลัง 10 ปี (ขอบเหลือง = เดือนปัจจุบัน)
            </div>
            <MonthBars months={data.monthStats} currentMonth={data.currentMonth} />
            <div className="mt-2 flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.2)" }}>
              <span>Jan</span><span>Jun</span><span>Dec</span>
            </div>
          </div>

          {/* Monthly detail table */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Monthly Statistics Table
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-1 text-[8px] uppercase tracking-widest pb-1" style={{ color: "rgba(175,185,215,0.25)" }}>
                <span>Month</span><span className="text-right">Avg Ret</span><span className="text-right">Win %</span>
                <span className="text-right">Best</span><span className="text-right">Worst</span>
              </div>
              {data.monthStats.map(m => {
                const isPos = m.avgReturn >= 0;
                const isCur = m.month === data.currentMonth;
                return (
                  <div key={m.month}
                    className="grid grid-cols-5 gap-1 text-xs py-1 rounded px-1"
                    style={{ background: isCur ? "rgba(245,196,81,0.06)" : undefined }}>
                    <span className="font-bold text-[10px]" style={{ color: isCur ? "#f5c451" : "rgba(175,185,215,0.6)" }}>
                      {m.monthName}
                    </span>
                    <span className="text-right font-mono text-[10px] font-bold" style={{ color: isPos ? "#34d399" : "#f87171" }}>
                      {isPos ? "+" : ""}{m.avgReturn.toFixed(2)}%
                    </span>
                    <span className="text-right text-[10px]" style={{ color: m.winRate > 50 ? "#34d399" : "#f87171" }}>
                      {m.winRate.toFixed(0)}%
                    </span>
                    <span className="text-right text-[9px]" style={{ color: "#34d399" }}>
                      +{m.bestReturn.toFixed(1)}%
                    </span>
                    <span className="text-right text-[9px]" style={{ color: "#f87171" }}>
                      {m.worstReturn.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly heatmap */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Weekly Seasonality Heatmap — 5 ปี ย้อนหลัง (52 สัปดาห์)
            </div>
            <WeekHeatmap weeks={data.weekStats} currentWeek={data.currentWeek} />
          </div>

          {/* Annual performance */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Annual Performance (Last 10 Years)
            </div>
            <YearTable yearStats={data.yearStats} />
          </div>

          {/* Tips */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3 text-amber-400/60">💡 Seasonal Edge</div>
            <ul className="space-y-2 text-xs" style={{ color: "rgba(175,185,215,0.6)" }}>
              <li>→ Sep–Nov มักเป็น Bullish months สำหรับทองคำ — Risk-off + ปลายปี</li>
              <li>→ Mar–May มักอ่อนแอ — profit taking หลัง Q1 rally</li>
              <li>→ ใช้ Seasonality ร่วมกับ Technical Signal เพื่อเพิ่มความมั่นใจ</li>
              <li>→ Seasonal bias ไม่ใช่ guarantee — ใช้เป็น context เท่านั้น</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
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
