"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { RocPayload, RocBar } from "@/app/api/roc/route";

function RocChart({ history }: { history: RocBar[] }) {
  if (history.length < 5) return null;
  const W = 560, H = 100;
  const vals  = history.map(b => b.roc20);
  const minV  = Math.min(...vals, -3);
  const maxV  = Math.max(...vals,  3);
  const range = maxV - minV || 1;
  const zeroY = H - ((0 - minV) / range) * H;

  function toPath(data: number[]): string {
    return data.map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - minV) / range) * H;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }

  // Color segments: positive = green, negative = red
  const segments: { path: string; color: string }[] = [];
  let segStart = 0;
  for (let i = 1; i <= vals.length; i++) {
    const wasPos = vals[i - 1] >= 0;
    const isPos  = i < vals.length ? vals[i] >= 0 : wasPos;
    if (isPos !== wasPos || i === vals.length) {
      const slice = vals.slice(segStart, i);
      const slicePath = slice.map((v, si) => {
        const x = ((segStart + si) / (vals.length - 1)) * W;
        const y = H - ((v - minV) / range) * H;
        return `${si === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(" ");
      segments.push({ path: slicePath, color: wasPos ? "#34d399" : "#f87171" });
      segStart = i - 1;
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      {/* Zero line */}
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeDasharray="4,3" />
      {/* Labels */}
      <text x="4" y={zeroY - 3} fontSize="8" fill="rgba(255,255,255,0.2)">0</text>
      {/* Full path (faint background) */}
      <path d={toPath(vals)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
      {/* Colored segments */}
      {segments.map((s, i) => (
        <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
      ))}
      {/* Last point dot */}
      {(() => {
        const last = vals.at(-1) ?? 0;
        const lx   = W;
        const ly   = H - ((last - minV) / range) * H;
        const col  = last >= 0 ? "#34d399" : "#f87171";
        return <circle cx={lx} cy={ly} r="3" fill={col} />;
      })()}
    </svg>
  );
}

function PeriodCard({ p }: { p: RocPayload["periods"][0] }) {
  const barW = Math.min(100, Math.abs(p.roc) * 6);
  return (
    <div className="panel px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(175,185,215,0.4)" }}>{p.labelTh}</span>
          <span className="text-[8px] ml-1" style={{ color: "rgba(175,185,215,0.2)" }}>({p.label})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${p.color}20`, color: p.color }}>
            {p.signalTh}
          </span>
          <span className="font-mono text-sm font-black" style={{ color: p.color }}>
            {p.roc > 0 ? "+" : ""}{p.roc.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.05)" }}>
        {p.roc >= 0 ? (
          <div style={{ width: `${barW}%`, background: p.color, marginLeft: "50%", borderRadius: "0 4px 4px 0" }} />
        ) : (
          <div style={{ width: `${barW}%`, background: p.color, marginLeft: `${50 - barW}%`, borderRadius: "4px 0 0 4px" }} />
        )}
      </div>
      <div className="absolute w-px h-2 top-0" style={{ left: "50%", background: "rgba(255,255,255,0.1)" }} />
    </div>
  );
}

export default function RocPage() {
  const [data, setData]       = useState<RocPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/roc", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const scoreColor = (s: number) => s > 60 ? "#34d399" : s < 40 ? "#f87171" : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="📉 Rate of Change (ROC)"
        subtitle="Multi-period momentum — acceleration, overbought/oversold, gold implication"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📉 กำลังคำนวณ ROC หลายช่วงเวลา…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="panel px-4 py-4 col-span-1">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>ราคาทอง</div>
              <div className="text-xl font-black" style={{ color: "#f5c451" }}>${data.currentPrice.toLocaleString()}</div>
            </div>
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Momentum Score</div>
              <div className="text-xl font-black" style={{ color: scoreColor(data.momentumScore) }}>{data.momentumScore}</div>
              <div className="text-[9px]" style={{ color: scoreColor(data.momentumScore) }}>{data.momentumLabelTh}</div>
            </div>
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>OB/OS</div>
              <div className="text-xs font-bold" style={{
                color: data.overboughtOversold === "overbought" ? "#f87171" : data.overboughtOversold === "oversold" ? "#34d399" : "#f5c451"
              }}>
                {data.overboughtOversold === "overbought" ? "Overbought 🔴" : data.overboughtOversold === "oversold" ? "Oversold 🟢" : "Normal 🟡"}
              </div>
            </div>
          </div>

          {/* Acceleration phase */}
          <div className="panel px-5 py-4" style={{ borderLeft: `3px solid ${data.acceleration.color}` }}>
            <div className="flex items-center gap-3">
              <div>
                <div className="text-xs font-bold" style={{ color: data.acceleration.color }}>
                  {data.acceleration.phaseTh}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
                  {data.acceleration.descriptionTh}
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.25)" }}>
                  {data.acceleration.description}
                </div>
              </div>
            </div>
          </div>

          {/* Gold implication */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2 text-amber-400/60">🪙 นัยสำหรับทองคำ</div>
            <p className="text-xs font-semibold" style={{ color: "#f5c451" }}>{data.goldImplicationTh}</p>
            <p className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.3)" }}>{data.goldImplication}</p>
            <p className="text-[9px] mt-1.5" style={{ color: "rgba(175,185,215,0.5)" }}>{data.oobTh}</p>
          </div>

          {/* ROC20 chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              ROC 20 วัน — เขียว = บวก · แดง = ลบ
            </div>
            <RocChart history={data.history} />
            <div className="flex justify-between mt-1 text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              <span>{data.history[0]?.date}</span>
              <span>{data.history.at(-1)?.date}</span>
            </div>
          </div>

          {/* Period cards */}
          <div>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              ROC รายช่วงเวลา (แท่งกึ่งกลาง = 0)
            </div>
            <div className="space-y-2">
              {data.periods.map(p => <PeriodCard key={p.label} p={p} />)}
            </div>
          </div>

          {/* Tips */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(168,85,247,0.4)" }}>💡 วิธีอ่าน ROC</div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ ROC = (ราคาปัจจุบัน − ราคา N วันก่อน) / ราคา N วันก่อน × 100</li>
              <li>→ ROC &gt; 0 = ทองแพงกว่า N วันก่อน → momentum บวก</li>
              <li>→ ROC &gt; +15% (3M) = Overbought — ระวัง pullback</li>
              <li>→ ROC &lt; -15% (3M) = Oversold — โอกาสสะสม</li>
              <li>→ ROC ระยะสั้น &gt; ระยะกลาง = momentum กำลังเร่ง (acceleration)</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              {data.history.length} วัน · อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
