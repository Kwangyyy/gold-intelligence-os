"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { VolatilityPayload, DayVolStat, IntradayBar } from "@/app/api/volatility/route";

/* ─── Heatmap calendar ──────────────────────────────────────── */
function VolCalendar({ history }: { history: DayVolStat[] }) {
  if (!history.length) return null;
  const maxRange = Math.max(...history.map(d => d.range));
  const minRange = Math.min(...history.filter(d => d.range > 0).map(d => d.range));

  // Group into weeks
  const byWeek: DayVolStat[][] = [];
  let week: DayVolStat[] = [];
  const first = history[0];
  // Pad first week
  for (let i = 0; i < first.dayOfWeek; i++) week.push({ date: "", dayOfWeek: i } as DayVolStat);
  history.forEach(d => {
    week.push(d);
    if (d.dayOfWeek === 6 || d === history[history.length - 1]) { byWeek.push(week); week = []; }
  });
  if (week.length) byWeek.push(week);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5 mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map(d => (
          <div key={d} className="flex-1 text-center text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{d}</div>
        ))}
      </div>
      <div className="flex gap-0.5">
        {byWeek.map((wk, wi) => (
          <div key={wi} className="flex flex-col gap-0.5 flex-1">
            {/* Only show Mon-Fri (indices 1-5) */}
            {[1, 2, 3, 4, 5].map(dow => {
              const day = wk.find(d => d.dayOfWeek === dow && d.date);
              if (!day || !day.date) return <div key={dow} className="h-5 rounded-sm" style={{ background: "rgba(255,255,255,0.02)" }} />;
              const intensity = maxRange > minRange ? (day.range - minRange) / (maxRange - minRange) : 0.5;
              const color = day.isPositive ? `rgba(52,211,153,${0.08 + intensity * 0.7})` : `rgba(248,113,113,${0.08 + intensity * 0.7})`;
              return (
                <div key={dow} className="h-5 rounded-sm cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: color }}
                  title={`${day.date} · Range $${day.range.toFixed(0)} · ${day.rangePct.toFixed(2)}% · ${day.isPositive ? "▲" : "▼"}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>Low vol</span>
        <div className="flex gap-0.5 flex-1">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-2 flex-1 rounded-sm" style={{ background: `rgba(52,211,153,${0.08 + i * 0.115})` }} />
          ))}
        </div>
        <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>High vol</span>
      </div>
    </div>
  );
}

/* ─── Intraday range bars ───────────────────────────────────── */
function IntradayChart({ bars }: { bars: IntradayBar[] }) {
  if (!bars.length) return <div className="text-xs text-center py-4" style={{ color: "rgba(175,185,215,0.2)" }}>No intraday data</div>;
  const maxRange = Math.max(...bars.map(b => b.range), 1);
  return (
    <div className="flex items-end gap-0.5 h-20">
      {bars.map((b, i) => {
        const h = (b.range / maxRange) * 100;
        const pos = b.close >= b.open;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end"
            title={`${b.time} UTC · Range $${b.range.toFixed(1)}`}>
            <div className="w-full rounded-t-sm" style={{ height: `${Math.max(h, 2)}%`, background: pos ? "#34d399" : "#f87171", opacity: 0.7 }} />
          </div>
        );
      })}
    </div>
  );
}

/* ─── Day of week bar chart ─────────────────────────────────── */
function DowChart({ data }: { data: VolatilityPayload["dayOfWeekAvg"] }) {
  const max = Math.max(...data.map(d => d.avgRange), 1);
  const colors = ["#60a5fa", "#34d399", "#f5c451", "#f97316", "#c084fc"];
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.day} className="flex items-center gap-3">
          <span className="w-7 text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>{d.day}</span>
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.avgRange / max) * 100}%`, background: colors[i] }} />
          </div>
          <span className="w-16 text-right font-mono text-[11px]" style={{ color: colors[i] }}>${d.avgRange.toFixed(0)}</span>
          <span className="w-10 text-right text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>{d.avgRangePct.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function VolatilityPage() {
  const [data, setData]       = useState<VolatilityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/volatility", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const volLabel = (rv: number) =>
    rv < 8  ? { text: "ต่ำมาก",   color: "#60a5fa" } :
    rv < 12 ? { text: "ปกติ",     color: "#34d399" } :
    rv < 18 ? { text: "สูง",      color: "#f5c451" } :
              { text: "สูงมาก",   color: "#f87171" };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="📊 Volatility Dashboard"
        subtitle="Historical volatility, ATR, & intraday range analysis for XAUUSD"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>📊 กำลังคำนวณ Volatility…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Hero metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "ATR 14", value: `$${data.atr14.toFixed(0)}`, sub: `${data.atrPct.toFixed(2)}% of price`, color: "#f5c451" },
              { label: "30d Realized Vol",
                value: `${data.realizedVol30.toFixed(1)}%`,
                sub: volLabel(data.realizedVol30).text,
                color: volLabel(data.realizedVol30).color },
              { label: "7d Avg Range",  value: `$${data.weeklyAvgRange.toFixed(0)}`,  sub: "avg High-Low",  color: "#34d399" },
              { label: "30d Avg Range", value: `$${data.monthlyAvgRange.toFixed(0)}`, sub: "avg High-Low",  color: "#c084fc" },
            ].map(m => (
              <div key={m.label} className="panel px-4 py-4 text-center">
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>{m.label}</div>
                <div className="text-xl font-black" style={{ color: m.color }}>{m.value}</div>
                <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Calendar heatmap */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              90-Day Volatility Calendar — เข้มขึ้น = Range กว้างขึ้น
            </div>
            <VolCalendar history={data.history} />
          </div>

          {/* Day of week + Intraday side by side */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                Avg Range by Day of Week
              </div>
              <DowChart data={data.dayOfWeekAvg} />
              <div className="mt-3 text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                ข้อมูลย้อนหลัง 90 วัน
              </div>
            </div>

            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                Today's Intraday Range (1h bars)
              </div>
              <IntradayChart bars={data.intraday} />
              <div className="mt-1 flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.2)" }}>
                {data.intraday[0] && <span>{data.intraday[0].time}</span>}
                {data.intraday.at(-1) && <span>{data.intraday.at(-1)!.time} UTC</span>}
              </div>
            </div>
          </div>

          {/* Extremes */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "🔥 Highest Range Day", stat: data.highestRange, color: "#f87171" },
              { label: "😴 Lowest Range Day",  stat: data.lowestRange,  color: "#60a5fa" },
            ].map(({ label, stat, color }) => (
              <div key={label} className="panel px-5 py-4" style={{ borderColor: `${color}25` }}>
                <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>{label}</div>
                <div className="text-base font-black mb-1" style={{ color }}>{stat.date}</div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <span style={{ color: "rgba(175,185,215,0.5)" }}>Range: <b style={{ color }}>${stat.range?.toFixed(0)}</b></span>
                  <span style={{ color: "rgba(175,185,215,0.5)" }}>Pct: <b style={{ color }}>{stat.rangePct?.toFixed(2)}%</b></span>
                  <span style={{ color: "rgba(175,185,215,0.5)" }}>Close: <b style={{ color: "rgba(175,185,215,0.7)" }}>${stat.close?.toFixed(0)}</b></span>
                  <span style={{ color: "rgba(175,185,215,0.5)" }}>ATR: <b style={{ color: "rgba(175,185,215,0.7)" }}>${stat.atr?.toFixed(0)}</b></span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent vol table */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Recent 10 Sessions
            </div>
            <div className="space-y-1.5">
              {data.history.slice(-10).reverse().map(d => {
                const intensity = data.monthlyAvgRange > 0 ? Math.min(d.range / data.monthlyAvgRange, 2) / 2 : 0.5;
                const barColor = d.range > data.monthlyAvgRange ? "#f5c451" : "rgba(175,185,215,0.2)";
                return (
                  <div key={d.date} className="flex items-center gap-3 text-xs">
                    <span className="w-20 font-mono text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>{d.date}</span>
                    <span className="w-8 text-[9px] text-center" style={{ color: d.isPositive ? "#34d399" : "#f87171" }}>
                      {d.isPositive ? "▲" : "▼"}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-full rounded-full" style={{ width: `${intensity * 100}%`, background: barColor }} />
                    </div>
                    <span className="font-mono text-[11px] w-12 text-right" style={{ color: barColor }}>${d.range.toFixed(0)}</span>
                    <span className="text-[9px] w-14 text-right" style={{ color: "rgba(175,185,215,0.3)" }}>ATR ${d.atr.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tips */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3 text-amber-400/60">💡 วิธีใช้ Volatility</div>
            <ul className="space-y-2 text-xs" style={{ color: "rgba(175,185,215,0.6)" }}>
              <li>→ ATR 14 ใช้เป็น SL baseline — SL ควรมากกว่า 1× ATR เพื่อหลีกเลี่ยง noise</li>
              <li>→ Realized Vol &gt; 18% = ตลาดผันผวนสูง ลด position size ลง 30-50%</li>
              <li>→ วัน Wednesday–Thursday มักมี Range กว้างที่สุด = โอกาส Breakout สูง</li>
              <li>→ Intraday Range แคบ (หลัง Asian close) = รอ London open สำหรับ momentum</li>
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
