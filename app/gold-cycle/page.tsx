"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { GoldCyclePayload, CycleIndicator, HistoricalCycle } from "@/app/api/gold-cycle/route";

function CycleOrb({ phase, progress }: { phase: string; progress: number }) {
  const phases = ["Accumulation", "Markup", "Distribution", "Markdown"];
  const phaseIdx = phases.indexOf(phase);
  const phaseColors = ["#60a5fa", "#34d399", "#f5c451", "#f87171"];
  const activeColor = phaseColors[phaseIdx] ?? "#f5c451";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {phases.map((p, i) => {
        const isActive = p === phase;
        const color = phaseColors[i];
        return (
          <div key={p} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full"
              style={{
                background: isActive ? color : "rgba(255,255,255,0.08)",
                boxShadow: isActive ? `0 0 8px ${color}80` : "none",
              }} />
            <span className="text-[9px]" style={{ color: isActive ? color : "rgba(175,185,215,0.3)", fontWeight: isActive ? 900 : 400 }}>
              {p}
            </span>
            {i < phases.length - 1 && (
              <div className="w-6 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 70 ? "#34d399" :
    score >= 50 ? "#f5c451" :
    score >= 30 ? "#fb923c" : "#f87171";
  const r = 52, cx = 70, cy = 68;
  const circ = Math.PI * r;
  const fill = circ * (score / 100);
  return (
    <svg viewBox="0 0 140 80" className="w-full max-w-[180px]">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        style={{ filter: `drop-shadow(0 0 5px ${color}80)` }} />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="22" fontWeight="900">{score}</text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="6">CYCLE SCORE</text>
    </svg>
  );
}

export default function GoldCyclePage() {
  const { tier } = useTier();
  const [data, setData] = useState<GoldCyclePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/gold-cycle", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/gold-cycle")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Premium tier required</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Analyzing gold cycle…</div>
    </div>
  );
  if (!data) return null;

  const phaseColor =
    data.currentPhase === "Markup"       ? "#34d399" :
    data.currentPhase === "Distribution" ? "#f5c451" :
    data.currentPhase === "Markdown"     ? "#f87171" : "#60a5fa";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🔄 Gold Market Cycle"
        subtitle="Bull/bear cycle phase analysis — where are we now?"
      />

      {/* ── Current Phase Overview ────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-4">
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <ScoreGauge score={data.cycleScore} />
            <div className="text-center">
              <div className="text-[9px] font-black uppercase" style={{ color: phaseColor }}>
                {data.currentPhase}
              </div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                ~{data.phaseProgress}% through phase
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <CycleOrb phase={data.currentPhase} progress={data.phaseProgress} />
            <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>
              {data.currentPhaseDef.description}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[8px]">
              <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ color: "rgba(175,185,215,0.35)" }}>Cycle age</div>
                <div className="font-bold mt-0.5" style={{ color: "#f5c451" }}>{data.cycleAge}</div>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ color: "rgba(175,185,215,0.35)" }}>Typical duration</div>
                <div className="font-bold mt-0.5" style={{ color: phaseColor }}>{data.currentPhaseDef.typicalDuration}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Phase progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            <span>Phase start</span>
            <span style={{ color: phaseColor }}>{data.phaseProgress}% through {data.currentPhase}</span>
            <span>Phase end</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full rounded-full" style={{ width: `${data.phaseProgress}%`, background: phaseColor + "80" }} />
          </div>
        </div>

        <div className="text-[9px] leading-relaxed px-3 py-3 rounded-xl"
          style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.12)", color: "rgba(175,185,215,0.5)" }}>
          {data.cycleInterpretation}
        </div>
      </div>

      {/* ── Cycle Indicators ──────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Cycle Indicator Dashboard
        </div>
        {data.cycleIndicators.map((ci: CycleIndicator) => {
          const sigColor = ci.signal === "bullish" ? "#34d399" : ci.signal === "bearish" ? "#f87171" : "#f5c451";
          return (
            <div key={ci.name} className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: sigColor }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{ci.name}</span>
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded capitalize"
                    style={{ background: sigColor + "18", color: sigColor }}>{ci.signal}</span>
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: sigColor }}>{ci.value}</div>
                <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{ci.detail}</div>
                <div className="mt-1.5 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full" style={{ width: `${ci.weight * 100}%`, background: "rgba(192,132,252,0.4)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Price Targets ─────────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
          🎯 Cycle Price Targets (12–18 Month)
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Bear Case",  value: data.priceTarget.bear, color: "#f87171" },
            { label: "Base Case",  value: data.priceTarget.base, color: "#f5c451" },
            { label: "Bull Case",  value: data.priceTarget.bull, color: "#34d399" },
          ].map(item => (
            <div key={item.label} className="rounded-xl px-3 py-3"
              style={{ background: item.color + "08", border: `1px solid ${item.color}25` }}>
              <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>{item.label}</div>
              <div className="text-lg font-black" style={{ color: item.color }}>
                ${item.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
          Targets based on historical cycle amplitude and current macro backdrop — not financial advice
        </div>
      </div>

      {/* ── Historical Cycles ─────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📅 Historical Gold Cycles
        </div>
        {data.historicalCycles.map((hc: HistoricalCycle) => (
          <div key={hc.cycle} className="rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-[10px] font-black" style={{ color: "rgba(255,255,255,0.7)" }}>{hc.cycle}</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                  {hc.startYear}–{hc.endYear} · {hc.duration}
                </div>
              </div>
              <div className="flex gap-3">
                {hc.maxGain > 0 && (
                  <div className="text-right">
                    <div className="text-[9px] font-black" style={{ color: "#34d399" }}>+{hc.maxGain.toFixed(0)}%</div>
                    <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>peak gain</div>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-[9px] font-black" style={{ color: "#f87171" }}>{hc.maxDraw.toFixed(0)}%</div>
                  <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>max draw</div>
                </div>
              </div>
            </div>
            <div className="text-[8px] mt-1.5" style={{ color: "rgba(175,185,215,0.4)" }}>
              Trigger: {hc.trigger}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Cycle analysis based on Wyckoff methodology
      </div>
    </div>
  );
}
