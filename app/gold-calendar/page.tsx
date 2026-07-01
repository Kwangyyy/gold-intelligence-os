"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { GoldCalendarPayload, MonthStat } from "@/app/api/gold-calendar/route";

function SeasonalBar({ months }: { months: MonthStat[] }) {
  const max = Math.max(...months.map(m => Math.abs(m.avgReturn)));
  return (
    <div className="grid grid-cols-12 gap-0.5 items-end h-24">
      {months.map((m) => {
        const pct = (Math.abs(m.avgReturn) / max) * 100;
        return (
          <div key={m.month} className="flex flex-col items-center gap-0.5">
            {/* Bar */}
            <div className="w-full flex flex-col justify-end" style={{ height: "72px" }}>
              <div className="w-full rounded-t-sm relative"
                style={{
                  height: `${pct}%`,
                  background: m.isCurrent
                    ? "linear-gradient(180deg, #f5c451 0%, rgba(245,196,81,0.6) 100%)"
                    : m.avgReturn >= 0 ? `${m.barColor}99` : "#f8717155",
                  border: m.isCurrent ? "1px solid #f5c451" : undefined,
                  boxShadow: m.isCurrent ? "0 0 8px rgba(245,196,81,0.4)" : undefined,
                }}>
                {/* Current year overlay dot */}
                {m.currentYearReturn != null && (
                  <div
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ background: m.currentYearReturn >= 0 ? "#34d399" : "#f87171" }}
                  />
                )}
              </div>
            </div>
            {/* Label */}
            <div className="text-[7px] text-center leading-tight"
              style={{ color: m.isCurrent ? "#f5c451" : "rgba(175,185,215,0.35)" }}>
              {m.monthLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthCard({ m }: { m: MonthStat }) {
  const hasActual = m.currentYearReturn != null;
  return (
    <div className="panel px-3 py-2.5 relative overflow-hidden"
      style={{
        borderLeft: m.isCurrent ? "3px solid #f5c451" : undefined,
        background: m.isCurrent ? "rgba(245,196,81,0.04)" : undefined,
      }}>
      {m.isCurrent && (
        <div className="absolute top-1 right-1.5 text-[7px] font-bold" style={{ color: "#f5c451" }}>NOW</div>
      )}
      <div className="text-xs font-black mb-1" style={{ color: m.isCurrent ? "#f5c451" : "rgba(175,185,215,0.8)" }}>
        {m.monthLabelTh}
      </div>
      {/* Avg return */}
      <div className="text-[9px] font-mono font-bold" style={{ color: m.barColor }}>
        avg {m.avgReturn > 0 ? "+" : ""}{m.avgReturn}%
      </div>
      {/* Win rate */}
      <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
        ชนะ {m.winRate}%
      </div>
      {/* This year actual */}
      {hasActual && (
        <div className="mt-1 text-[9px] font-mono font-bold"
          style={{ color: m.currentYearReturn! >= 0 ? "#34d399" : "#f87171" }}>
          {m.currentYearReturn! >= 0 ? "+" : ""}{m.currentYearReturn}% ปีนี้
        </div>
      )}
      {/* Win rate bar */}
      <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full" style={{ width: `${m.winRate}%`, background: m.barColor + "88" }} />
      </div>
    </div>
  );
}

export default function GoldCalendarPage() {
  const [data, setData]       = useState<GoldCalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/gold-calendar", { cache: "no-store" });
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
        title="📅 Gold Seasonal Calendar"
        subtitle="ผลตอบแทนเฉลี่ยรายเดือนของทองในอดีต (20 ปี) เทียบกับปีปัจจุบัน"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📅 กำลังโหลดข้อมูล Seasonality…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-4" style={{ borderLeft: `4px solid ${data.currentSeasonBias === "bullish" ? "#34d399" : data.currentSeasonBias === "bearish" ? "#f87171" : "#f5c451"}` }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  {data.currentYear} — YTD Performance
                </div>
                <div className="text-2xl font-black mb-1" style={{ color: data.ytdReturn >= 0 ? "#34d399" : "#f87171" }}>
                  {data.ytdReturn >= 0 ? "+" : ""}{data.ytdReturn}%
                </div>
                <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.5)" }}>
                  {data.currentSeasonBiasTh}
                </div>
              </div>
              <div className="text-right text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                <div>Best month (avg)</div>
                <div className="font-bold text-xs" style={{ color: "#34d399" }}>{data.avgBestLabelTh}</div>
                <div className="mt-1">Worst avg</div>
                <div className="font-bold text-xs" style={{ color: "#f87171" }}>
                  {data.months.find(m => m.month === data.worstMonth)?.monthLabelTh}
                </div>
              </div>
            </div>
          </div>

          {/* Main chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              ผลตอบแทนเฉลี่ยรายเดือน 20 ปี — แท่งทอง = เดือนปัจจุบัน, จุดสี = ปีนี้จริง
            </div>
            <SeasonalBar months={data.months} />
            <div className="mt-2 flex items-center gap-4 text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>
              <span><span style={{ color: "#34d399" }}>■</span> avg บวก</span>
              <span><span style={{ color: "#f87171" }}>■</span> avg ลบ</span>
              <span><span style={{ color: "#f5c451" }}>■</span> เดือนนี้</span>
              <span><span style={{ color: "#34d399" }}>●</span> ปีนี้จริง(บวก) / <span style={{ color: "#f87171" }}>●</span>(ลบ)</span>
            </div>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {data.months.map(m => <MonthCard key={m.month} m={m} />)}
          </div>

          {/* Seasonal events */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              ปัจจัยฤดูกาลสำคัญ
            </div>
            <div className="space-y-2">
              {data.seasonalEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[9px] font-bold w-8 shrink-0 mt-0.5"
                    style={{ color: "rgba(175,185,215,0.4)" }}>
                    {data.months.find(m => m.month === ev.month)?.monthLabelTh}
                  </span>
                  <div className="flex-1">
                    <div className="text-[10px] font-medium" style={{ color: ev.impactColor }}>{ev.eventTh}</div>
                    <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{ev.event}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Education */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 วิธีใช้ Seasonality
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ ฤดูกาลไม่ใช่ตัวบ่งชี้เดียว — ใช้ร่วมกับ trend, momentum, และ fundamental</li>
              <li>→ เดือนที่ win rate สูง (&gt;60%) คือโอกาสที่ทองมักปิดบวก ไม่ใช่การันตี</li>
              <li>→ Aug-Oct คือ "Gold Season" — อินเดีย + ตะวันออกกลางซื้อทองสูงสุด</li>
              <li>→ May-Jun มักอ่อน — hedge fund rebalancing ช่วงครึ่งปี</li>
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
