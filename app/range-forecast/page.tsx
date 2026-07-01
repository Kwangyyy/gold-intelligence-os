"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { RangeForecastPayload, ForecastHorizon, HistoricalVolBar } from "@/app/api/range-forecast/route";

function VolChart({ history }: { history: HistoricalVolBar[] }) {
  if (history.length < 5) return null;
  const W = 560, H = 80;
  const vals  = history.map(b => b.rv20);
  const minV  = Math.min(...vals) - 1;
  const maxV  = Math.max(...vals) + 1;
  const range = maxV - minV || 1;

  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - minV) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const lastVal = vals.at(-1) ?? 0;
  const lastX   = W;
  const lastY   = H - ((lastVal - minV) / range) * H;
  const volColor = lastVal < 10 ? "#34d399" : lastVal < 18 ? "#f5c451" : lastVal < 28 ? "#f97316" : "#f87171";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
      <polyline points={points} fill="none" stroke="rgba(245,196,81,0.3)" strokeWidth="1.5" />
      <polyline points={points} fill="none" stroke={volColor} strokeWidth="1.5" opacity="0.8" />
      <circle cx={lastX} cy={lastY} r="3" fill={volColor} />
      <text x={lastX - 4} y={lastY - 6} fontSize="8" fill={volColor} textAnchor="end">{lastVal}%</text>
    </svg>
  );
}

function HorizonCard({ h, currentPrice }: { h: ForecastHorizon; currentPrice: number }) {
  const rangeW  = h.high95 - h.low95 || 1;
  const cur68Lo = ((h.low68  - h.low95) / rangeW) * 100;
  const cur68Hi = ((h.high68 - h.low95) / rangeW) * 100;
  const curPos  = ((currentPrice - h.low95) / rangeW) * 100;
  const biasColor = h.bias > 0 ? "#34d399" : h.bias < 0 ? "#f87171" : "#f5c451";

  return (
    <div className="panel px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-black" style={{ color: "#f5c451" }}>{h.labelTh}</span>
          <span className="text-[9px] ml-2" style={{ color: "rgba(175,185,215,0.3)" }}>{h.label}</span>
        </div>
        <div className="text-right">
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>±{h.expectedMove}% (1σ)</div>
          <div className="text-[9px] font-bold" style={{ color: biasColor }}>
            Drift {h.bias > 0 ? "+" : ""}{h.bias}%
          </div>
        </div>
      </div>

      {/* Range bar */}
      <div className="relative h-8 rounded-lg overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.03)" }}>
        {/* 95% band */}
        <div className="absolute inset-y-0 rounded-lg" style={{
          left: "0%", right: "0%",
          background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)",
        }} />
        {/* 68% band */}
        <div className="absolute inset-y-1 rounded" style={{
          left: `${cur68Lo}%`, width: `${cur68Hi - cur68Lo}%`,
          background: "rgba(245,196,81,0.15)", border: "1px solid rgba(245,196,81,0.3)",
        }} />
        {/* Current price marker */}
        <div className="absolute inset-y-0 w-0.5 bg-amber-400" style={{ left: `${Math.max(0, Math.min(100, curPos))}%` }} />
      </div>

      {/* Labels */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: "Low 95%", value: h.low95,  color: "#f87171" },
          { label: "Low 68%", value: h.low68,  color: "#f97316" },
          { label: "Hi 68%",  value: h.high68, color: "#6ee7b7" },
          { label: "Hi 95%",  value: h.high95, color: "#34d399" },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{label}</div>
            <div className="font-mono text-[10px] font-black" style={{ color }}>
              {value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RangeForecastPage() {
  const [data, setData]       = useState<RangeForecastPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/range-forecast", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const volColor = (v: string) =>
    v === "low" ? "#34d399" : v === "normal" ? "#f5c451" : v === "high" ? "#f97316" : "#f87171";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🎯 Statistical Range Forecast"
        subtitle="Probability-based price range for 1D/1W/2W/1M — based on realized volatility"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🎯 กำลังคำนวณช่วงราคาตามความน่าจะเป็น…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Vol stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>ราคาทอง</div>
              <div className="text-xl font-black" style={{ color: "#f5c451" }}>${data.currentPrice.toLocaleString()}</div>
            </div>
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Daily Vol (1σ)</div>
              <div className="text-lg font-black" style={{ color: "#c084fc" }}>${data.dailyVol}</div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>±/วัน</div>
            </div>
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Ann. Vol (20d RV)</div>
              <div className="text-lg font-black" style={{ color: volColor(data.volRegime) }}>
                {data.annualizedVol}%
              </div>
              <div className="text-[8px]" style={{ color: volColor(data.volRegime) }}>{data.volRegimeTh}</div>
            </div>
          </div>

          {/* Vol implication */}
          <div className="panel px-5 py-3" style={{ borderLeft: `3px solid ${volColor(data.volRegime)}` }}>
            <p className="text-xs font-semibold" style={{ color: volColor(data.volRegime) }}>{data.volImplicationTh}</p>
          </div>

          {/* Horizon cards */}
          <div>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              ช่วงราคาตามความน่าจะเป็น
            </div>
            <div className="space-y-3">
              {data.horizons.map(h => <HorizonCard key={h.label} h={h} currentPrice={data.currentPrice} />)}
            </div>
          </div>

          {/* Vol history chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              ประวัติ Realized Vol 20 วัน (annualized)
            </div>
            <VolChart history={data.volHistory} />
            <div className="flex justify-between mt-1 text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              <span>{data.volHistory[0]?.date}</span>
              <span>{data.volHistory.at(-1)?.date}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>💡 การอ่านค่า</div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ <strong style={{ color: "#f5c451" }}>Band สีทอง (68%)</strong> — ราคามีโอกาส 68% อยู่ในช่วงนี้ (±1σ)</li>
              <li>→ <strong style={{ color: "#c084fc" }}>Band สีม่วง (95%)</strong> — ราคามีโอกาส 95% อยู่ในช่วงนี้ (±2σ)</li>
              <li>→ <strong style={{ color: "#f5c451" }}>เส้นแนวตั้ง</strong> — ราคาปัจจุบัน</li>
              <li>→ Drift = ทิศทางที่คาดหวังตาม momentum 20 วัน (+ = up bias)</li>
              <li>→ ใช้ฝั่ง 68% สำหรับตั้ง TP / ฝั่ง 95% สำหรับ worst-case SL</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              อิงจาก 20-day realized vol · อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
