"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { PivotPayload, PivotSet, PivotLevel } from "@/app/api/pivots/route";

const TYPE_COLOR: Record<PivotLevel["type"], string> = {
  resistance: "#f87171",
  pivot:      "#f5c451",
  support:    "#34d399",
};

function PivotTable({ set, price }: { set: PivotSet; price: number }) {
  const sorted = [...set.levels].sort((a, b) => b.price - a.price);
  return (
    <div className="space-y-1">
      {sorted.map(lv => {
        const color  = TYPE_COLOR[lv.type];
        const diff   = ((lv.price - price) / price * 100).toFixed(2);
        const isAbove = lv.price > price;
        return (
          <div key={lv.label}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg ${lv.isCurrentZone ? "ring-1 ring-amber-400/50" : ""}`}
            style={{ background: lv.isCurrentZone ? "rgba(245,196,81,0.06)" : "rgba(255,255,255,0.02)" }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color, opacity: lv.strength === "strong" ? 1 : 0.5 }} />
            <span className="w-14 text-[10px] font-mono font-bold" style={{ color }}>{lv.label}</span>
            <span className="flex-1 text-[11px] font-mono font-black" style={{ color: lv.isCurrentZone ? "#f5c451" : "rgba(175,185,215,0.8)" }}>
              ${lv.price.toFixed(1)}
            </span>
            <span className="text-[9px] w-14 text-right" style={{ color: isAbove ? "#f87171" : "#34d399" }}>
              {isAbove ? "+" : ""}{diff}%
            </span>
            {lv.strength === "strong" && (
              <span className="text-[7px] px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>KEY</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MethodTab({ methods, active, onChange }: { methods: string[]; active: string; onChange: (m: string) => void }) {
  return (
    <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
      {methods.map(m => (
        <button key={m} onClick={() => onChange(m)}
          className="flex-1 rounded-lg py-1.5 text-[9px] font-bold transition-all"
          style={{ background: active === m ? "rgba(245,196,81,0.15)" : undefined, color: active === m ? "#f5c451" : "rgba(175,185,215,0.4)" }}>
          {m}
        </button>
      ))}
    </div>
  );
}

export default function PivotsPage() {
  const [data, setData]       = useState<PivotPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [activeDaily,  setActiveDaily]  = useState("Classical (PP)");
  const [activeWeekly, setActiveWeekly] = useState("Classical (PP)");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/pivots", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeDS = data?.dailyPivots.find(p => p.methodLabel === activeDaily)  ?? data?.dailyPivots[0];
  const activeWS = data?.weeklyPivots.find(p => p.methodLabel === activeWeekly) ?? data?.weeklyPivots[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🎯 Pivot Points"
        subtitle="Classical · Fibonacci · Camarilla · Woodie — Daily & Weekly pivots for XAUUSD"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>🎯 กำลังคำนวณ Pivot Points…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Current price + prev OHLC */}
          <div className="grid grid-cols-2 gap-3">
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Current Price</div>
              <div className="text-xl font-black text-amber-400">${data.price.toFixed(1)}</div>
            </div>
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Prev Day ({data.daily.date})</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <span style={{ color: "#f87171" }}>H: ${data.daily.high.toFixed(0)}</span>
                <span style={{ color: "#34d399" }}>L: ${data.daily.low.toFixed(0)}</span>
                <span style={{ color: "rgba(175,185,215,0.5)" }}>O: ${data.daily.open.toFixed(0)}</span>
                <span style={{ color: "rgba(175,185,215,0.5)" }}>C: ${data.daily.close.toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Nearest S/R */}
          <div className="grid grid-cols-2 gap-3">
            {data.nearestResistance && (
              <div className="panel px-4 py-4" style={{ borderColor: "rgba(248,113,113,0.25)" }}>
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>🔴 Nearest Resistance</div>
                <div className="text-lg font-black text-red-400">${data.nearestResistance.price.toFixed(1)}</div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{data.nearestResistance.label}</div>
              </div>
            )}
            {data.nearestSupport && (
              <div className="panel px-4 py-4" style={{ borderColor: "rgba(52,211,153,0.25)" }}>
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>🟢 Nearest Support</div>
                <div className="text-lg font-black text-emerald-400">${data.nearestSupport.price.toFixed(1)}</div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{data.nearestSupport.label}</div>
              </div>
            )}
          </div>

          {/* Daily pivots */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Daily Pivot Points (based on {data.daily.date})
            </div>
            <MethodTab
              methods={data.dailyPivots.map(p => p.methodLabel)}
              active={activeDaily}
              onChange={setActiveDaily}
            />
            {activeDS && (
              <div className="mt-3">
                <div className="text-[8px] mb-2" style={{ color: "rgba(175,185,215,0.25)" }}>
                  PP = ${activeDS.pivot.toFixed(1)} · ขอบทองเหลือง = current zone (±0.3%)
                </div>
                <PivotTable set={activeDS} price={data.price} />
              </div>
            )}
          </div>

          {/* Weekly pivots */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Weekly Pivot Points (based on week of {data.weekly.date})
            </div>
            <div className="text-[8px] mb-2" style={{ color: "rgba(175,185,215,0.2)" }}>
              Prev week: H ${data.weekly.high.toFixed(0)} · L ${data.weekly.low.toFixed(0)} · C ${data.weekly.close.toFixed(0)}
            </div>
            <MethodTab
              methods={data.weeklyPivots.map(p => p.methodLabel)}
              active={activeWeekly}
              onChange={setActiveWeekly}
            />
            {activeWS && (
              <div className="mt-3">
                <PivotTable set={activeWS} price={data.price} />
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3 text-amber-400/60">📖 วิธีอ่าน Pivot Points</div>
            <div className="grid sm:grid-cols-2 gap-3 text-[10px]" style={{ color: "rgba(175,185,215,0.6)" }}>
              <div className="space-y-1.5">
                <div><span className="font-bold text-amber-400">Classical</span> — (H+L+C)/3 = Pivot, ใช้กันอย่างแพร่หลาย</div>
                <div><span className="font-bold text-purple-400">Fibonacci</span> — Pivot + 38.2%/61.8%/100% ของ range</div>
              </div>
              <div className="space-y-1.5">
                <div><span className="font-bold text-blue-400">Camarilla</span> — ใช้ Close เป็นฐาน ดีสำหรับ Intraday</div>
                <div><span className="font-bold text-orange-400">Woodie</span> — ให้น้ำหนัก Close 2× เหมาะ scalper</div>
              </div>
            </div>
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
