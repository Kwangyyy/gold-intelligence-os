"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { SessionsPayload, HourStat, SessionStat, SessionName } from "@/app/api/sessions/route";

const SESSION_ICONS: Record<SessionName, string> = {
  "Asian":               "🌙",
  "London":              "☀️",
  "Overlap (London+NY)": "⚡",
  "New York":            "🗽",
};

function HeatmapRow({ stats, maxAbs, currentHour }: { stats: HourStat[]; maxAbs: number; currentHour: number }) {
  return (
    <div className="flex gap-px">
      {stats.map(s => {
        const isCurrent = s.hour === currentHour;
        const intensity = maxAbs > 0 ? s.avgAbsReturn / maxAbs : 0;
        const isPositive = s.avgReturn >= 0;
        const bg = s.sampleCount === 0
          ? "rgba(255,255,255,0.03)"
          : `rgba(${isPositive ? "52,211,153" : "248,113,113"}, ${0.1 + intensity * 0.75})`;
        return (
          <div key={s.hour}
            title={`${s.hour}:00 UTC · ${isPositive ? "+" : ""}${s.avgReturn.toFixed(3)}% avg · ${s.winRate.toFixed(0)}% win · ${s.sampleCount} bars`}
            className="flex-1 h-10 rounded-sm flex items-end justify-center pb-0.5 cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: bg, outline: isCurrent ? "2px solid #f5c451" : undefined }}>
            {isCurrent && <div className="w-1 h-1 rounded-full bg-amber-400" />}
          </div>
        );
      })}
    </div>
  );
}

function SessionCard({ s, isActive }: { s: SessionStat; isActive: boolean }) {
  const color = s.color;
  return (
    <div className="rounded-2xl px-5 py-4 transition-all"
      style={{
        border: isActive ? `2px solid ${color}` : `1px solid ${color}25`,
        background: isActive ? `${color}08` : `${color}04`,
        boxShadow: isActive ? `0 0 30px ${color}15` : undefined,
      }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{SESSION_ICONS[s.name]}</span>
        <div>
          <div className="text-xs font-black" style={{ color }}>{s.name}</div>
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{s.hours}</div>
        </div>
        {isActive && (
          <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold animate-pulse"
            style={{ background: `${color}20`, color }}>LIVE</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        {[
          { label: "Avg Move", value: `${(s.avgVolatility * 60).toFixed(2)}%`, color: s.color },
          { label: "Win Rate", value: `${s.winRate.toFixed(0)}%`, color: s.winRate > 52 ? "#34d399" : s.winRate < 48 ? "#f87171" : "#f5c451" },
          { label: "Avg Range", value: `$${s.avgRange.toFixed(1)}`, color: "rgba(175,185,215,0.7)" },
          { label: "Best Hour", value: `${s.bestHour}:00 UTC`, color: s.color },
        ].map(({ label, value, color: c }) => (
          <div key={label} className="rounded-lg px-2 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>{label}</div>
            <div className="text-xs font-bold" style={{ color: c }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HourBarChart({ stats }: { stats: HourStat[] }) {
  const maxRange = Math.max(...stats.map(s => s.avgRange), 1);
  return (
    <div className="flex items-end gap-px h-24">
      {stats.map(s => {
        const h = (s.avgRange / maxRange) * 100;
        const isPositive = s.avgReturn >= 0;
        const color = s.sampleCount === 0 ? "rgba(255,255,255,0.05)" : isPositive ? "#34d399" : "#f87171";
        return (
          <div key={s.hour} className="flex-1 flex flex-col items-center justify-end"
            title={`${s.hour}:00 UTC · Range $${s.avgRange.toFixed(1)}`}>
            <div className="w-full rounded-t-sm transition-all" style={{ height: `${h}%`, background: color, minHeight: 1, opacity: 0.7 }} />
          </div>
        );
      })}
    </div>
  );
}

export default function SessionsPage() {
  const [data, setData]       = useState<SessionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxAbs = data ? Math.max(...data.hourStats.map(s => s.avgAbsReturn), 0.01) : 0.01;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🕐 Session Analysis"
        subtitle="วิเคราะห์ XAUUSD ตามช่วงเวลาซื้อขาย · ข้อมูลย้อนหลัง 60 วัน ทุก 1 ชั่วโมง"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>⏳ กำลังวิเคราะห์ข้อมูล…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm mb-4" style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}>{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Current session + stats */}
          <div className="panel px-5 py-4 flex items-center gap-4"
            style={{ border: "1px solid rgba(245,196,81,0.2)", background: "rgba(245,196,81,0.04)" }}>
            <div className="text-3xl">{SESSION_ICONS[data.currentSession]}</div>
            <div>
              <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
                ตอนนี้: {data.currentHour}:00 UTC
              </div>
              <div className="text-base font-black" style={{ color: "#f5c451" }}>{data.currentSession} Session</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-mono text-sm font-bold" style={{ color: "#f5c451" }}>${data.price.toFixed(2)}</div>
              <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>{data.sampleDays} วัน ข้อมูล</div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
              Volatility Heatmap by Hour (UTC) — สีเข้ม = ผันผวนสูง
            </div>
            <div className="text-[8px] mb-2" style={{ color: "rgba(175,185,215,0.25)" }}>
              เขียว = avg return บวก · แดง = avg return ลบ · ขอบเหลือง = ตอนนี้
            </div>
            <HeatmapRow stats={data.hourStats} maxAbs={maxAbs} currentHour={data.currentHour} />
            {/* Hour labels */}
            <div className="mt-1 flex">
              {[0, 4, 8, 12, 16, 20, 23].map(h => (
                <div key={h} className="text-[8px] font-mono"
                  style={{ color: "rgba(175,185,215,0.25)", position: "relative", left: `${(h / 24) * 100}%`, transform: "translateX(-50%)" }}>
                  {h}
                </div>
              ))}
            </div>
          </div>

          {/* Bar chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Avg Hourly Range ($ per bar) — ช่วงเวลาที่ Range กว้างที่สุด
            </div>
            <HourBarChart stats={data.hourStats} />
            <div className="mt-1 flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.2)" }}>
              <span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00 UTC</span>
            </div>
            {/* Session blocks */}
            <div className="mt-2 flex gap-2 flex-wrap">
              {data.sessionStats.map(s => (
                <div key={s.name} className="flex items-center gap-1.5 text-[9px]">
                  <div className="h-2 w-4 rounded-sm" style={{ background: s.color, opacity: 0.6 }} />
                  <span style={{ color: "rgba(175,185,215,0.5)" }}>{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Session cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.sessionStats.map(s => (
              <SessionCard key={s.name} s={s} isActive={s.name === data.currentSession} />
            ))}
          </div>

          {/* Best hours table */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Top 5 Hours by Volatility (Avg Range)
            </div>
            <div className="space-y-2">
              {[...data.hourStats]
                .filter(s => s.sampleCount > 5)
                .sort((a, b) => b.avgRange - a.avgRange)
                .slice(0, 5)
                .map((s, i) => {
                  const color = s.avgReturn >= 0 ? "#34d399" : "#f87171";
                  return (
                    <div key={s.hour} className="flex items-center gap-3 text-xs">
                      <span className="text-[10px] w-4 font-bold" style={{ color: "rgba(175,185,215,0.3)" }}>{i + 1}</span>
                      <span className="w-16 font-mono font-bold" style={{ color: "#f5c451" }}>{s.hour}:00 UTC</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(s.avgRange / data.hourStats.reduce((a, x) => Math.max(a, x.avgRange), 1)) * 100}%`, background: color }} />
                      </div>
                      <span className="font-mono text-[11px]" style={{ color }}>${s.avgRange.toFixed(1)}</span>
                      <span className="text-[10px] w-14 text-right" style={{ color: "rgba(175,185,215,0.35)" }}>{s.winRate.toFixed(0)}% win</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Tips */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3 text-amber-400/60">💡 คำแนะนำการใช้งาน</div>
            <ul className="space-y-2 text-xs" style={{ color: "rgba(175,185,215,0.6)" }}>
              <li>→ ชั่วโมงที่ Range กว้าง = มีโอกาสทำกำไรสูง แต่ Risk ก็สูงด้วย</li>
              <li>→ London Overlap กับ New York (13:00-17:00 UTC) มักมี Volume และ Momentum สูงสุด</li>
              <li>→ Asian Session (23:00-08:00 UTC) มักเงียบและ Range แคบ เหมาะกับ Scalping</li>
              <li>→ หลีกเลี่ยง Trade ใน Low-Volume Hours (22:00-23:00 UTC) เพราะ Spread กว้าง</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ข้อมูล {data.sampleDays} วัน ·
              อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour:"2-digit", minute:"2-digit" })} ·
              <a href="/calendar" className="ml-1 underline opacity-60">Economic Calendar</a>
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
