"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { FibPayload, FibLevel } from "@/app/api/fibonacci/route";

/* ─── Visual price ladder ───────────────────────────────────── */
function FibLadder({ data }: { data: FibPayload }) {
  const allLevels = [...data.retracements, ...data.extensions].sort((a, b) => b.price - a.price);
  const minP = Math.min(...allLevels.map(l => l.price));
  const maxP = Math.max(...allLevels.map(l => l.price));
  const range = maxP - minP || 1;
  const pricePos = ((data.price - minP) / range) * 100;

  return (
    <div className="relative h-[420px] select-none">
      {/* Price levels */}
      {allLevels.map(level => {
        const top = 100 - ((level.price - minP) / range) * 100;
        const isRet = level.type === "retracement";
        const isMajor = level.significance === "major";
        const baseColor = isRet
          ? (level.ratio <= 0.5 ? "#34d399" : "#f87171")
          : "#c084fc";
        const opacity = isMajor ? 1 : 0.5;

        return (
          <div key={`${level.type}-${level.ratio}`}
            className="absolute left-0 right-0 flex items-center gap-2"
            style={{ top: `${top}%`, transform: "translateY(-50%)" }}>
            <div className="w-16 text-right text-[10px] font-mono font-bold shrink-0"
              style={{ color: baseColor, opacity }}>
              ${level.price.toFixed(0)}
            </div>
            <div className="flex-1 h-px" style={{ background: `${baseColor}${isMajor ? "60" : "25"}` }} />
            <div className="w-24 text-[9px] shrink-0"
              style={{ color: baseColor, opacity }}>
              {level.label}
              {level.isCurrentZone && <span className="ml-1 text-amber-400">← HERE</span>}
            </div>
            {isMajor && (
              <div className="absolute right-28 w-1.5 h-1.5 rounded-full" style={{ background: baseColor }} />
            )}
          </div>
        );
      })}

      {/* Current price line */}
      <div className="absolute left-0 right-0 flex items-center gap-2 z-10"
        style={{ top: `${100 - pricePos}%`, transform: "translateY(-50%)" }}>
        <div className="w-16 text-right shrink-0" />
        <div className="flex-1 border-t-2 border-dashed border-amber-400/80" />
        <div className="w-24 text-[9px] font-bold text-amber-400 shrink-0">
          ${data.price.toFixed(0)} ←
        </div>
      </div>

      {/* Legend on the left column */}
      <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between pointer-events-none">
        <div className="text-[8px] font-mono" style={{ color: "rgba(175,185,215,0.2)" }}>High</div>
        <div className="text-[8px] font-mono" style={{ color: "rgba(175,185,215,0.2)" }}>Low</div>
      </div>
    </div>
  );
}

/* ─── Level table ───────────────────────────────────────────── */
function LevelRow({ level, price }: { level: FibLevel; price: number }) {
  const diff   = level.price - price;
  const diffPct = (diff / price * 100).toFixed(2);
  const isAbove = diff > 0;
  const color = level.type === "retracement"
    ? (level.ratio <= 0.5 ? "#34d399" : "#f87171")
    : "#c084fc";

  return (
    <div className={`flex items-center gap-3 text-xs py-1.5 px-2 rounded-lg transition-colors ${level.isCurrentZone ? "ring-1 ring-amber-400/40" : ""}`}
      style={{ background: level.isCurrentZone ? "rgba(245,196,81,0.05)" : undefined }}>
      <div className="w-5 h-5 flex items-center justify-center rounded"
        style={{ background: `${color}15` }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, opacity: level.significance === "major" ? 1 : 0.4 }} />
      </div>
      <span className="w-20 font-mono text-[11px] font-bold" style={{ color }}>${level.price.toFixed(1)}</span>
      <span className="flex-1 text-[10px]" style={{ color: "rgba(175,185,215,0.6)" }}>{level.label}</span>
      <span className="text-[10px]" style={{ color: isAbove ? "#34d399" : "#f87171" }}>
        {isAbove ? "+" : ""}{diffPct}%
      </span>
      {level.significance === "major" && (
        <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>KEY</span>
      )}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function FibonacciPage() {
  const [data, setData]       = useState<FibPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/fibonacci", { cache: "no-store" });
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
        title="🌀 Fibonacci Auto-Draw"
        subtitle="Auto-detected swing high/low → Fib retracements + extensions for XAUUSD (4H)"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>🌀 กำลังคำนวณ Fibonacci…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Swing summary */}
          <div className="panel px-5 py-4 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Swing High</div>
              <div className="text-sm font-black text-red-400">${data.swing.high.price.toFixed(0)}</div>
              <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>{data.swing.high.date}</div>
            </div>
            <div className="text-center">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Current</div>
              <div className="text-sm font-black text-amber-400">${data.price.toFixed(0)}</div>
              <div className="text-[9px] px-2 py-0.5 rounded-full inline-block mt-0.5"
                style={{ background: data.swing.trend === "up" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", color: data.swing.trend === "up" ? "#34d399" : "#f87171" }}>
                {data.swing.trend === "up" ? "↑ Uptrend" : "↓ Downtrend"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Swing Low</div>
              <div className="text-sm font-black text-green-400">${data.swing.low.price.toFixed(0)}</div>
              <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>{data.swing.low.date}</div>
            </div>
          </div>

          {/* Context */}
          <div className="panel px-5 py-4" style={{ border: "1px solid rgba(245,196,81,0.15)", background: "rgba(245,196,81,0.03)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>AI Context</div>
            <p className="text-sm" style={{ color: "rgba(175,185,215,0.8)" }}>{data.contextTh}</p>
            <p className="text-[10px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>{data.context}</p>
          </div>

          {/* Current zone alert */}
          {data.currentZones.length > 0 && (
            <div className="panel px-5 py-3 flex items-center gap-3"
              style={{ border: "1px solid rgba(245,196,81,0.4)", background: "rgba(245,196,81,0.06)" }}>
              <span className="text-lg">⚡</span>
              <div>
                <div className="text-xs font-bold text-amber-400">ราคาอยู่ในโซน Fibonacci!</div>
                <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.5)" }}>
                  {data.currentZones.map(z => `${z.label} ($${z.price.toFixed(0)})`).join(" · ")}
                </div>
              </div>
            </div>
          )}

          {/* Visual ladder */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-4" style={{ color: "rgba(175,185,215,0.3)" }}>
              Price Ladder — เส้นประเหลือง = ราคาปัจจุบัน
            </div>
            <FibLadder data={data} />
          </div>

          {/* Nearest levels */}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.nearestResistance && (
              <div className="panel px-4 py-4" style={{ borderColor: "rgba(248,113,113,0.25)" }}>
                <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>🔴 Nearest Resistance</div>
                <div className="text-lg font-black text-red-400">${data.nearestResistance.price.toFixed(0)}</div>
                <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.5)" }}>{data.nearestResistance.label}</div>
                <div className="text-[9px] mt-1 text-red-400/60">
                  +{((data.nearestResistance.price - data.price) / data.price * 100).toFixed(2)}% above
                </div>
              </div>
            )}
            {data.nearestSupport && (
              <div className="panel px-4 py-4" style={{ borderColor: "rgba(52,211,153,0.25)" }}>
                <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>🟢 Nearest Support</div>
                <div className="text-lg font-black text-emerald-400">${data.nearestSupport.price.toFixed(0)}</div>
                <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.5)" }}>{data.nearestSupport.label}</div>
                <div className="text-[9px] mt-1 text-emerald-400/60">
                  {((data.nearestSupport.price - data.price) / data.price * 100).toFixed(2)}% below
                </div>
              </div>
            )}
          </div>

          {/* Full level tables */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Retracement Levels — เขียว = support zone · แดง = resistance zone
            </div>
            <div className="space-y-1">
              {[...data.retracements].reverse().map(l => (
                <LevelRow key={`r-${l.ratio}`} level={l} price={data.price} />
              ))}
            </div>
          </div>

          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Extension Levels (Targets) — ม่วง = profit target zones
            </div>
            <div className="space-y-1">
              {data.extensions.map(l => (
                <LevelRow key={`e-${l.ratio}`} level={l} price={data.price} />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3 text-amber-400/60">📖 คำอธิบาย Fibonacci</div>
            <div className="grid sm:grid-cols-2 gap-3 text-[10px]" style={{ color: "rgba(175,185,215,0.6)" }}>
              <div>
                <div className="font-bold text-emerald-400/80 mb-1">Retracements (ย้อนกลับ)</div>
                <p>23.6%, 38.2%, 50%, 61.8%, 78.6% — ระดับที่ราคามักหยุดพัก ก่อนไปต่อในทิศทางเดิม</p>
              </div>
              <div>
                <div className="font-bold text-purple-400/80 mb-1">Extensions (เป้าหมาย)</div>
                <p>127.2%, 161.8%, 200%, 261.8% — เป้าหมายกำไรหลังจากราคา breakout จาก retracement</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              4H bars · Swing {data.swing.legPct.toFixed(1)}% leg ·
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
