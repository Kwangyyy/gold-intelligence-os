"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { EconImpactPayload, EconEvent } from "@/app/api/econ-impact/route";

const BIAS_COLOR: Record<string, string> = {
  bullish: "#34d399", bearish: "#f87171", mixed: "#f5c451", neutral: "rgba(175,185,215,0.5)",
};
const IMPACT_COLOR: Record<string, string> = {
  High: "#f87171", Medium: "#f5c451", Low: "rgba(175,185,215,0.3)",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 8 ? "#f87171" : score >= 6 ? "#f5c451" : score >= 4 ? "#34d399" : "rgba(175,185,215,0.3)";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full" style={{ width: `${score * 10}%`, background: color }} />
      </div>
      <span className="text-[9px] font-bold w-5" style={{ color }}>{score.toFixed(0)}</span>
    </div>
  );
}

function EventCard({ e }: { e: EconEvent }) {
  const [open, setOpen] = useState(false);
  const biasColor  = BIAS_COLOR[e.goldBias];
  const impColor   = IMPACT_COLOR[e.impact];

  const hoursStr = e.hoursUntil !== null
    ? e.hoursUntil < 0 ? "Passed" : e.hoursUntil < 1 ? `${Math.round(e.hoursUntil * 60)}m` : `${e.hoursUntil.toFixed(1)}h`
    : "";

  return (
    <div className="panel px-4 py-3 cursor-pointer select-none transition-all"
      style={{ borderColor: e.isToday ? `${impColor}40` : undefined, background: e.isToday ? `${impColor}04` : undefined }}
      onClick={() => setOpen(o => !o)}>
      <div className="flex items-start gap-3">
        {/* Impact dot */}
        <div className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: impColor }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.85)" }}>{e.title}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${impColor}15`, color: impColor }}>{e.impact}</span>
            {e.isToday && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400">TODAY</span>}
          </div>
          <div className="text-[9px] mt-0.5 flex items-center gap-2" style={{ color: "rgba(175,185,215,0.4)" }}>
            <span>{e.date} {e.time}</span>
            <span>·</span><span>{e.currency}</span>
            {hoursStr && <span className="text-amber-400/70">{hoursStr}</span>}
          </div>
          <div className="mt-1.5">
            <ScoreBar score={e.goldImpactScore} />
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.2)" }}>Gold</div>
          <div className="text-[10px] font-bold" style={{ color: biasColor }}>
            {e.goldBias === "bullish" ? "↑" : e.goldBias === "bearish" ? "↓" : "↕"}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-[10px] mb-1.5" style={{ color: "rgba(175,185,215,0.7)" }}>{e.explanationTh}</p>
          <p className="text-[9px] mb-2" style={{ color: "rgba(175,185,215,0.4)" }}>{e.explanation}</p>
          {(e.forecast || e.previous || e.actual) && (
            <div className="flex gap-3 mt-1.5 text-[9px]">
              {e.actual   && <span>Actual: <b style={{ color: biasColor }}>{e.actual}</b></span>}
              {e.forecast && <span>Forecast: <b style={{ color: "rgba(175,185,215,0.6)" }}>{e.forecast}</b></span>}
              {e.previous && <span>Previous: <b style={{ color: "rgba(175,185,215,0.4)" }}>{e.previous}</b></span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EconImpactPage() {
  const [data, setData]       = useState<EconImpactPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/econ-impact", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const riskColor = (score: number) =>
    score >= 8 ? "#f87171" : score >= 6 ? "#f5c451" : score >= 4 ? "#34d399" : "rgba(175,185,215,0.4)";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="⚡ Economic Impact Score"
        subtitle="Gold impact analysis for this week's macro events — คลิกที่ event เพื่อดูรายละเอียด"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>⚡ กำลังวิเคราะห์ economic events…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Weekly risk overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="panel px-4 py-4 text-center">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Weekly Risk</div>
              <div className="text-2xl font-black" style={{ color: riskColor(data.weeklyRiskScore) }}>{data.weeklyRiskScore}</div>
              <div className="text-[9px] mt-0.5 font-bold" style={{ color: riskColor(data.weeklyRiskScore) }}>
                {data.weeklyRiskLabelTh}
              </div>
            </div>
            <div className="panel px-4 py-4 text-center">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>High Impact Events</div>
              <div className="text-2xl font-black text-red-400">{data.highImpactCount}</div>
              <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>this week</div>
            </div>
            <div className="panel px-4 py-4 text-center">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Bias</div>
              <div className="text-xl font-black" style={{ color: BIAS_COLOR[data.goldBiasFromEvents] }}>
                {data.goldBiasFromEvents === "bullish" ? "↑ Bullish" : data.goldBiasFromEvents === "bearish" ? "↓ Bearish" : "↕ Mixed"}
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>from events</div>
            </div>
          </div>

          {/* Next high impact alert */}
          {data.nextHighImpact && (
            <div className="panel px-5 py-4 flex items-center gap-4"
              style={{ border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.04)" }}>
              <div className="text-2xl">🚨</div>
              <div className="flex-1">
                <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Next High Impact Event
                </div>
                <div className="text-sm font-bold text-red-400">{data.nextHighImpact.title}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
                  {data.nextHighImpact.date} {data.nextHighImpact.time}
                  {data.nextHighImpact.hoursUntil !== null && data.nextHighImpact.hoursUntil > 0
                    ? ` · in ${data.nextHighImpact.hoursUntil.toFixed(1)} hours`
                    : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold" style={{ color: BIAS_COLOR[data.nextHighImpact.goldBias] }}>
                  Gold: {data.nextHighImpact.goldBias}
                </div>
                <div className="text-[9px] text-amber-400">Impact {data.nextHighImpact.goldImpactScore}/10</div>
              </div>
            </div>
          )}

          {/* Today's events */}
          {data.events.filter(e => e.isToday).length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
                Today's Events
              </div>
              <div className="space-y-2">
                {data.events.filter(e => e.isToday).map((e, i) => (
                  <EventCard key={`today-${i}`} e={e} />
                ))}
              </div>
            </div>
          )}

          {/* All week events */}
          <div>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              All This Week — คลิกที่ event เพื่อดู Gold Impact Analysis
            </div>
            {data.events.length === 0 && (
              <div className="panel px-5 py-8 text-center text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
                No USD events this week found
              </div>
            )}
            <div className="space-y-2">
              {data.events.filter(e => !e.isToday).map((e, i) => (
                <EventCard key={`week-${i}`} e={e} />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3 text-amber-400/60">📖 คำอธิบาย Gold Impact Score</div>
            <div className="grid sm:grid-cols-2 gap-3 text-[10px]" style={{ color: "rgba(175,185,215,0.6)" }}>
              <div className="space-y-1">
                {[["8-10", "#f87171", "ผลกระทบสูงมาก — อาจทำให้ทองเคลื่อน $20+ ในไม่กี่นาที"],
                  ["5-7",  "#f5c451", "ผลกระทบปานกลาง — ควรระวัง range กว้างขึ้น"],
                  ["1-4",  "#34d399", "ผลกระทบน้อย — ตลาดมักไม่ react มาก"]].map(([range, color, desc]) => (
                  <div key={range} className="flex gap-2">
                    <span className="font-mono font-bold w-8" style={{ color: color as string }}>{range}</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="font-bold mb-1" style={{ color: "rgba(175,185,215,0.5)" }}>Gold Bias</div>
                {[["↑ Bullish", "#34d399", "เหตุการณ์มักเป็นบวกต่อทองคำ"],
                  ["↓ Bearish", "#f87171", "เหตุการณ์มักกดดันทองคำ"],
                  ["↕ Mixed",   "#f5c451", "ทิศทางขึ้นกับตัวเลขจริง vs คาด"]].map(([label, color, desc]) => (
                  <div key={label} className="flex gap-2">
                    <span className="font-bold w-16" style={{ color: color as string }}>{label}</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              Source: ForexFactory · อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
