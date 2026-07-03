"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { ElliottWavePayload, ElliottTF } from "@/app/api/elliott-wave/route";

const TFS: { id: ElliottTF; label: string }[] = [
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
];

// Real price chart with zigzag wave overlay drawn from the actual series
function WaveChart({ data }: { data: ElliottWavePayload }) {
  const { series, zigzag, pivots, goldPrice } = data;
  const closes = series.c;
  if (closes.length < 3) return (
    <div className="text-[10px] py-8 text-center" style={{ color: "rgba(175,185,215,0.3)" }}>
      ข้อมูลราคาไม่พอสำหรับ Timeframe นี้ — ลองเปลี่ยน TF
    </div>
  );

  const W = 700, H = 200, padR = 40, padTop = 14, padBot = 18;
  const plotW = W - padR;
  const allPrices = [...closes, ...data.projections.map(p => p.price), goldPrice];
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = (max - min) || 1;

  const toX = (i: number) => (i / Math.max(closes.length - 1, 1)) * plotW;
  const toY = (p: number) => padTop + (1 - (p - min) / range) * (H - padTop - padBot);

  // Price line
  const linePts = closes.map((c, i) => `${toX(i).toFixed(1)},${toY(c).toFixed(1)}`).join(" ");
  // Area under price line
  const areaPts = `${toX(0)},${H - padBot} ${linePts} ${toX(closes.length - 1)},${H - padBot}`;

  // Zigzag polyline through detected pivots (clamp indices to series bounds)
  const zz = zigzag.filter(z => z.i >= 0 && z.i < closes.length);
  const zzPts = zz.map(z => `${toX(z.i).toFixed(1)},${toY(z.price).toFixed(1)}`).join(" ");

  // Labeled wave pivots (0-5) — use seriesIndex
  const labeled = pivots.filter(p => p.seriesIndex >= 0 && p.seriesIndex < closes.length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <defs>
        <linearGradient id="ewArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(245,196,81,0.18)" />
          <stop offset="100%" stopColor="rgba(245,196,81,0)" />
        </linearGradient>
      </defs>

      {/* Gridlines + price axis */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const price = max - f * range;
        const y = toY(price);
        return (
          <g key={i}>
            <line x1="0" y1={y} x2={plotW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={W - 4} y={y + 3} textAnchor="end" fontSize="8" fill="rgba(175,185,215,0.35)">
              ${Math.round(price).toLocaleString()}
            </text>
          </g>
        );
      })}

      {/* Price area + line */}
      <polygon points={areaPts} fill="url(#ewArea)" />
      <polyline points={linePts} fill="none" stroke="rgba(245,196,81,0.55)" strokeWidth="1.2" strokeLinejoin="round" />

      {/* Zigzag wave path */}
      {zz.length >= 2 && (
        <polyline points={zzPts} fill="none" stroke="#c084fc" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Zigzag pivot dots */}
      {zz.map((z, i) => (
        <circle key={`z${i}`} cx={toX(z.i)} cy={toY(z.price)} r="2.4"
          fill={z.type === "high" ? "#f5c451" : "#34d399"} opacity="0.7" />
      ))}

      {/* Emphasized path through the labeled (counted) wave pivots */}
      {labeled.length >= 2 && (
        <polyline
          points={labeled.map(p => `${toX(p.seriesIndex).toFixed(1)},${toY(p.price).toFixed(1)}`).join(" ")}
          fill="none" stroke="#c084fc" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
        />
      )}

      {/* Per-leg % measurement at the midpoint of each labeled wave */}
      {labeled.map((p, i) => {
        if (i === 0 || !p.legPct) return null;
        const prev = labeled[i - 1];
        const mx = (toX(prev.seriesIndex) + toX(p.seriesIndex)) / 2;
        const my = (toY(prev.price) + toY(p.price)) / 2;
        const up = p.legPct >= 0;
        return (
          <text key={`m${i}`} x={mx} y={my} textAnchor="middle" fontSize="8" fontWeight="bold"
            fill={up ? "rgba(52,211,153,0.85)" : "rgba(248,113,113,0.85)"}
            style={{ paintOrder: "stroke", stroke: "#0a0f1e", strokeWidth: 2.5 }}>
            {up ? "+" : ""}{p.legPct}%
          </text>
        );
      })}

      {/* Labeled wave points (0-5, A-B-C) with badges */}
      {labeled.map((p, i) => {
        const x = toX(p.seriesIndex), y = toY(p.price);
        const above = p.type === "high";
        return (
          <g key={`l${i}`}>
            <circle cx={x} cy={y} r="5" fill={above ? "#f5c451" : "#34d399"} stroke="#0a0f1e" strokeWidth="1.5" />
            <text x={x} y={above ? y - 9 : y + 15} textAnchor="middle" fontSize="12" fontWeight="bold"
              fill={above ? "#f5c451" : "#34d399"}
              style={{ paintOrder: "stroke", stroke: "#0a0f1e", strokeWidth: 3 }}>{p.label}</text>
          </g>
        );
      })}

      {/* Current price marker */}
      <line x1="0" y1={toY(goldPrice)} x2={plotW} y2={toY(goldPrice)}
        stroke="rgba(96,165,250,0.4)" strokeDasharray="4,3" strokeWidth="1" />
      <circle cx={toX(closes.length - 1)} cy={toY(goldPrice)} r="3" fill="#60a5fa" />
    </svg>
  );
}

export default function ElliottWavePage() {
  const [data, setData]       = useState<ElliottWavePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [tf, setTf]           = useState<ElliottTF>("1d");

  const load = useCallback(async (timeframe: ElliottTF) => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch(`/api/elliott-wave?tf=${timeframe}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(tf); }, [load, tf]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="〰️ Elliott Wave Analyzer"
        subtitle="ตีเส้นซิกแซกวัดคลื่นจากกราฟจริง — Pivot detection, Fibonacci targets, wave implication"
      />

      {/* Timeframe selector */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          Timeframe
        </span>
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {TFS.map(item => {
            const active = tf === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTf(item.id)}
                disabled={loading && active}
                className="rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all"
                style={active
                  ? { background: "linear-gradient(90deg, rgba(168,85,247,0.3), rgba(245,196,81,0.12))", color: "#f5c451", boxShadow: "inset 0 0 0 1px rgba(245,196,81,0.3)" }
                  : { color: "rgba(175,185,215,0.5)" }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

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

          {/* Wave chart — real price series + zigzag overlay */}
          <div className="panel px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
                Wave Chart ({tf.toUpperCase()}) — เส้นทอง = ราคาจริง | เส้นม่วง = Zigzag คลื่น
              </div>
              <div className="flex items-center gap-3 text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                <span>🟡 High</span><span>🟢 Low</span>
              </div>
            </div>
            <WaveChart data={data} />
          </div>

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
            <button onClick={() => load(tf)}
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
