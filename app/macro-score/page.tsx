"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MacroScorePayload, MacroFactor } from "@/app/api/macro-score/route";

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 44, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" width="90" height="90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="16" fontWeight="900" fill={color}>{score}</text>
      </svg>
    </div>
  );
}

function FactorCard({ f }: { f: MacroFactor }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="panel px-4 py-3 cursor-pointer"
      style={{ borderLeft: `3px solid ${f.color}50` }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{f.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.8)" }}>{f.factorTh}</span>
            <span className="font-mono text-[11px] font-black shrink-0" style={{ color: f.color }}>{f.score}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${f.score}%`, background: f.color }} />
          </div>
        </div>
        <span
          className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
          style={{ background: `${f.color}18`, color: f.color }}
        >
          {f.bias === "bullish" ? "BULL" : f.bias === "bearish" ? "BEAR" : "NEU"}
        </span>
        <span className="text-[9px] opacity-30">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="mt-3 pt-2 border-t space-y-1.5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>
            ค่าปัจจุบัน: {f.value}
          </div>
          <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.7)" }}>{f.explanationTh}</p>
          <p className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>{f.explanation}</p>
          <div className="flex items-center justify-between mt-1 text-[8px]" style={{ color: "rgba(175,185,215,0.2)" }}>
            <span>น้ำหนัก {(f.weight * 100).toFixed(0)}%</span>
            <span>{f.lastUpdated}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MacroScorePage() {
  const [data, setData]       = useState<MacroScorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/macro-score", { cache: "no-store" });
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
        title="🏛️ Macro Score Card"
        subtitle="6 key macroeconomic factors — composite bullish/bearish verdict for gold"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🏛️ กำลังวิเคราะห์ปัจจัยมหภาค…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5 flex items-center gap-6">
            <ScoreRing score={data.compositeScore} color={data.compositeColor} />
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                Macro Score (ปัจจัยมหภาครวม)
              </div>
              <div className="text-xl font-black mb-1" style={{ color: data.compositeColor }}>
                {data.compositeLabelTh}
              </div>
              <div className="text-[9px] mb-3" style={{ color: "rgba(175,185,215,0.35)" }}>
                {data.compositeLabel}
              </div>
              {/* Gold price context */}
              <div className="flex gap-4 text-[10px]">
                <div>
                  <span style={{ color: "rgba(175,185,215,0.3)" }}>Gold </span>
                  <span className="font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</span>
                </div>
                <div style={{ color: data.goldChange30d >= 0 ? "#34d399" : "#f87171" }}>
                  {data.goldChange30d > 0 ? "+" : ""}{data.goldChange30d}% (30d)
                </div>
              </div>
            </div>
          </div>

          {/* Key takeaway */}
          <div className="panel px-5 py-4" style={{ background: `${data.compositeColor}07`, border: `1px solid ${data.compositeColor}22` }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: `${data.compositeColor}80` }}>
              📌 Key Takeaway
            </div>
            <p className="text-xs font-semibold leading-relaxed" style={{ color: data.compositeColor }}>
              {data.keyTakeawayTh}
            </p>
            <p className="text-[9px] mt-1.5 leading-relaxed" style={{ color: "rgba(175,185,215,0.3)" }}>
              {data.keyTakeawayEn}
            </p>
          </div>

          {/* Factor cards */}
          <div>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              ปัจจัยรายข้อ (คลิกเพื่อดูรายละเอียด)
            </div>
            <div className="space-y-2">
              {data.factors
                .slice()
                .sort((a, b) => b.score - a.score)
                .map(f => <FactorCard key={f.factor} f={f} />)
              }
            </div>
          </div>

          {/* Bull vs Bear tally */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              สรุปทิศทาง
            </div>
            <div className="flex gap-4">
              {[
                { label: "Bullish", color: "#34d399", count: data.factors.filter(f => f.bias === "bullish").length },
                { label: "Neutral", color: "#f5c451", count: data.factors.filter(f => f.bias === "neutral").length },
                { label: "Bearish", color: "#f87171", count: data.factors.filter(f => f.bias === "bearish").length },
              ].map(({ label, color, count }) => (
                <div key={label} className="flex-1 text-center panel py-3 px-2">
                  <div className="text-2xl font-black" style={{ color }}>{count}</div>
                  <div className="text-[8px] uppercase tracking-wider mt-0.5" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="panel px-5 py-3" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.08)" }}>
            <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.35)" }}>
              ⚠ คะแนน Macro เป็นการประมาณการจากข้อมูลตลาดแบบ real-time และ rule-based logic ไม่ใช่คำแนะนำการลงทุน
              ปัจจัยบางส่วน (Central Bank, Geopolitical) ใช้ค่า proxy หรือประมาณการ WGC
            </p>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              {data.factors.length} ปัจจัย · อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
