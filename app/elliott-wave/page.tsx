"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { ElliottWavePayload } from "@/app/api/elliott-wave/route";

function WaveChart({ pivots, projections, spot }: {
  pivots: ElliottWavePayload["pivots"];
  projections: ElliottWavePayload["projections"];
  spot: number;
}) {
  if (pivots.length < 2) return null;
  const allPrices = [...pivots.map(p => p.price), ...projections.map(p => p.price), spot];
  const min = Math.min(...allPrices) * 0.998;
  const max = Math.max(...allPrices) * 1.002;
  const range = max - min || 1;
  const W = 500, H = 120;
  const xStep = W / Math.max(pivots.length + 1, 2);

  const toX = (i: number) => (i + 1) * xStep;
  const toY = (p: number) => H - ((p - min) / range) * H;

  const pts = pivots.map((p, i) => `${toX(i).toFixed(1)},${toY(p.price).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%" height="110" preserveAspectRatio="none">
      {/* Wave path */}
      <polyline points={pts} fill="none" stroke="#c084fc" strokeWidth="2" strokeLinejoin="round" />
      {/* Pivot labels */}
      {pivots.map((p, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(p.price)} r="4"
            fill={p.type === "high" ? "#f5c451" : "#34d399"} />
          <text x={toX(i)} y={toY(p.price) - 6} textAnchor="middle" fontSize="9"
            fill={p.type === "high" ? "#f5c451" : "#34d399"} fontWeight="bold">{p.label}</text>
          <text x={toX(i)} y={H + 15} textAnchor="middle" fontSize="7"
            fill="rgba(175,185,215,0.3)">${p.price.toLocaleString()}</text>
        </g>
      ))}
      {/* Current price line */}
      <line x1="0" y1={toY(spot)} x2={W} y2={toY(spot)}
        stroke="rgba(245,196,81,0.3)" strokeDasharray="3,3" strokeWidth="1" />
      <text x={W - 4} y={toY(spot) - 3} textAnchor="end" fontSize="7" fill="rgba(245,196,81,0.5)">
        ${spot}
      </text>
    </svg>
  );
}

export default function ElliottWavePage() {
  const [data, setData]       = useState<ElliottWavePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/elliott-wave", { cache: "no-store" });
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
        title="〰️ Elliott Wave Analyzer"
        subtitle="วิเคราะห์ Elliott Wave count อัตโนมัติ — Pivot detection, Fibonacci targets, wave implication"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            〰️ กำลังวิเคราะห์ Wave Count…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5" style={{ borderLeft: `4px solid ${data.phaseColor}` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Wave Count (Heuristic)
                </div>
                <div className="text-sm font-black mb-1" style={{ color: data.phaseColor }}>
                  {data.waveCountTh}
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.5)" }}>{data.waveCount}</div>
              </div>
              <div className="text-right">
                <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
                <div className="text-xl font-black" style={{ color: "#f5c451" }}>
                  ${data.goldPrice.toLocaleString()}
                </div>
                <div className="mt-1 text-[9px] px-2 py-1 rounded-lg font-bold"
                  style={{ background: data.confidenceColor + "22", color: data.confidenceColor }}>
                  Confidence: {data.confidence}
                </div>
              </div>
            </div>
          </div>

          {/* Phase */}
          <div className="panel px-5 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full" style={{ background: data.phaseColor }} />
            <div>
              <div className="text-xs font-bold" style={{ color: data.phaseColor }}>{data.wavePhaseTh}</div>
              <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{data.confidenceTh}</div>
            </div>
          </div>

          {/* Wave chart */}
          {data.pivots.length >= 2 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                Wave Pivot Chart — สีทอง = High | สีเขียว = Low
              </div>
              <WaveChart pivots={data.pivots} projections={data.projections} spot={data.goldPrice} />
            </div>
          )}

          {/* Implication */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              นัยสำคัญ
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(175,185,215,0.8)" }}>
              {data.implicationTh}
            </p>
            <p className="text-[9px] mt-2 leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>
              {data.implication}
            </p>
          </div>

          {/* Projections */}
          {data.projections.length > 0 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                เป้าหมายราคา (Fibonacci Projection)
              </div>
              <div className="space-y-2">
                {data.projections.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-medium" style={{ color: p.type === "target" ? "#34d399" : "#60a5fa" }}>
                        {p.labelTh}
                      </div>
                      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{p.label}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                        ×{p.fibRatio}
                      </span>
                      <span className="font-mono font-black text-sm"
                        style={{ color: p.type === "target" ? "#34d399" : "#60a5fa" }}>
                        ${p.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fibonacci retracements */}
          {data.fibLevels.length > 0 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                Fibonacci Retracements
              </div>
              <div className="space-y-1.5">
                {data.fibLevels.map((f, i) => {
                  const isNearSpot = Math.abs(f.price - data.goldPrice) / data.goldPrice < 0.01;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-10 text-[9px] font-bold" style={{ color: "#c084fc" }}>{f.ratio}</span>
                      <div className="flex-1 h-0.5 rounded-full" style={{
                        background: isNearSpot ? "#f5c451" : "rgba(192,132,252,0.15)"
                      }} />
                      <span className="font-mono text-[9px] font-bold"
                        style={{ color: isNearSpot ? "#f5c451" : "rgba(175,185,215,0.6)" }}>
                        ${f.price.toLocaleString()}
                        {isNearSpot && " ◀ Now"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              ⚠️ ข้อจำกัด Elliott Wave
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ Elliott Wave เป็นการตีความ — นักวิเคราะห์ที่ต่างกันอาจนับ wave ต่างกัน</li>
              <li>→ ระบบนี้ใช้ heuristic อัตโนมัติ ไม่ใช่การวิเคราะห์ระดับผู้เชี่ยวชาญ</li>
              <li>→ ใช้ร่วมกับ technical indicators และ price action เสมอ</li>
              <li>→ {data.disclaimer}</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              วิเคราะห์ {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>
              🔄 วิเคราะห์ใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
