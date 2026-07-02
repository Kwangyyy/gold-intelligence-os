"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { GoldOilPayload, RatioBar } from "@/app/api/gold-oil-ratio/route";

function RatioChart({ bars, current, histAvg }: { bars: RatioBar[]; current: number; histAvg: number }) {
  if (!bars.length) return null;
  const W = 500, H = 80, PAD = 8;
  const ratios = bars.map(b => b.ratio);
  const minR   = Math.min(...ratios) * 0.9;
  const maxR   = Math.max(...ratios, current) * 1.05;
  const rangeR = maxR - minR;
  const toX = (i: number) => PAD + (i / (bars.length - 1)) * (W - 2 * PAD);
  const toY = (v: number) => H - PAD - ((v - minR) / rangeR) * (H - 2 * PAD);

  const pts = bars.map((b, i) => `${toX(i)},${toY(b.ratio)}`).join(" ");
  const avgY = toY(histAvg);
  const curY = toY(current);
  const fill = `${pts} ${toX(bars.length - 1)},${H} ${PAD},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: H }}>
      {/* Fill under curve */}
      <polygon points={fill} fill="rgba(245,196,81,0.06)" />
      {/* Avg line */}
      <line x1={PAD} y1={avgY} x2={W - PAD} y2={avgY}
        stroke="rgba(175,185,215,0.2)" strokeDasharray="4 3" strokeWidth={0.8} />
      <text x={W - PAD - 2} y={avgY - 2} textAnchor="end" fontSize="6" fill="rgba(175,185,215,0.3)">
        Avg {histAvg}x
      </text>
      {/* Line */}
      <polyline points={pts} fill="none" stroke="#f5c451" strokeWidth={1.5} strokeLinejoin="round" />
      {/* Current dot */}
      <circle cx={toX(bars.length - 1)} cy={curY} r={3} fill="#f5c451" />
    </svg>
  );
}

function RetRow({ label, gold, oil }: { label: string; gold: number; oil: number }) {
  const gc = gold >= 0 ? "#34d399" : "#f87171";
  const oc = oil  >= 0 ? "#34d399" : "#f87171";
  return (
    <div className="flex items-center gap-3 text-[9px]">
      <span className="w-6 shrink-0" style={{ color: "rgba(175,185,215,0.35)" }}>{label}</span>
      <span className="flex-1" style={{ color: gc }}>🪙 {gold >= 0 ? "+" : ""}{gold.toFixed(2)}%</span>
      <span className="flex-1" style={{ color: oc }}>🛢️ {oil  >= 0 ? "+" : ""}{oil.toFixed(2)}%</span>
    </div>
  );
}

function RatioGauge({ current, min, max, avg }: { current: number; min: number; max: number; avg: number }) {
  const pct = Math.max(0, Math.min(100, ((current - min) / (max - min)) * 100));
  const avgPct = Math.max(0, Math.min(100, ((avg - min) / (max - min)) * 100));
  const color = pct > 60 ? "#f87171" : pct > 40 ? "#f97316" : pct > 20 ? "#9ca3af" : "#34d399";
  return (
    <div className="space-y-1">
      <div className="relative h-5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: color, opacity: 0.8 }} />
        {/* Average marker */}
        <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${avgPct}%`, background: "rgba(255,255,255,0.3)" }} />
      </div>
      <div className="flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
        <span>{min}x (Low)</span>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>Avg {avg}x</span>
        <span>{max}x (High)</span>
      </div>
    </div>
  );
}

export default function GoldOilRatioPage() {
  const [data, setData]       = useState<GoldOilPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/gold-oil-ratio", { cache: "no-store" });
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
        title="⚡ Gold/Oil Ratio"
        subtitle="อัตราส่วนทองต่อน้ำมัน — ดัชนี energy-gold relationship สำหรับ macro analysis"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            ⚡ กำลังโหลดข้อมูลราคา…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero ratio */}
          <div className="panel px-5 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Gold / Oil Ratio (GOX)
                </div>
                <div className="text-4xl font-black" style={{ color: data.zoneColor }}>
                  {data.currentRatio}x
                </div>
                <div className="text-xs mt-1 font-bold" style={{ color: data.zoneColor }}>
                  {data.zoneTh}
                </div>
              </div>
              <div className="text-right space-y-2">
                <div>
                  <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>🪙 Gold</div>
                  <div className="text-lg font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>🛢️ WTI Oil</div>
                  <div className="text-lg font-black" style={{ color: "#818cf8" }}>${data.oilPrice.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <RatioGauge current={data.currentRatio} min={data.histLow} max={data.histHigh} avg={data.histAvg} />

            <div className="space-y-1 text-[9px]">
              <div style={{ color: "rgba(175,185,215,0.5)" }}>{data.goldSignalTh}</div>
              <div className="font-bold" style={{ color: data.goldBiasColor }}>🪙 {data.goldBiasTh}</div>
            </div>
          </div>

          {/* Chart */}
          {data.bars.length > 0 && (
            <div className="panel px-4 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
                Gold/Oil Ratio (52 สัปดาห์)
              </div>
              <RatioChart bars={data.bars} current={data.currentRatio} histAvg={data.histAvg} />
            </div>
          )}

          {/* Returns comparison */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              ผลตอบแทน: ทองคำ vs น้ำมัน
            </div>
            <div className="space-y-2">
              <RetRow label="1D" gold={data.ret1d.gold} oil={data.ret1d.oil} />
              <RetRow label="1W" gold={data.ret1w.gold} oil={data.ret1w.oil} />
              <RetRow label="1M" gold={data.ret1m.gold} oil={data.ret1m.oil} />
            </div>
          </div>

          {/* Context */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              Historical Reference
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "All-Time High", val: data.histHigh, note: "COVID 2020", color: "#f87171" },
                { label: "20Y Average",   val: data.histAvg,  note: "2005-2025",  color: "#9ca3af" },
                { label: "All-Time Low",  val: data.histLow,  note: "2005",       color: "#34d399" },
              ].map(h => (
                <div key={h.label} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>{h.label}</div>
                  <div className="text-base font-black" style={{ color: h.color }}>{h.val}x</div>
                  <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{h.note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Interpretation */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 วิธีใช้ Gold/Oil Ratio
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ Ratio สูง = ทองแพงเทียบน้ำมัน → น้ำมันอาจ mean-revert ขึ้น → energy inflation risk</li>
              <li>→ Ratio ต่ำ = น้ำมันแพงเทียบทอง → demand destruction ทำให้ inflation ลง</li>
              <li>→ ทองมักขึ้นก่อน rebound น้ำมัน (financial asset vs commodity cycle)</li>
              <li>→ Ratio สูงมาก (&gt;50x) → historically oil catches up → watch energy stocks</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ GC=F / CL=F จาก Yahoo Finance | {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
