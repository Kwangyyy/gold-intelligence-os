"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { TradeGradePayload, GradeFactor, TradingCondition, Grade } from "@/app/api/trade-grade/route";

const GRADE_COLOR: Record<Grade, string> = {
  "A+": "#34d399", "A": "#34d399", "B+": "#86efac",
  "B":  "#f5c451", "C": "#fb923c", "D": "#f87171", "F": "#ef4444",
};
const COND_COLOR: Record<string, string> = {
  optimal: "#34d399", good: "#86efac", fair: "#f5c451", poor: "#f87171", avoid: "#ef4444"
};

function GradeBadge({ grade }: { grade: Grade }) {
  const color = GRADE_COLOR[grade];
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-2xl text-3xl font-black"
      style={{ background: color + "18", border: `2px solid ${color}50`, color, boxShadow: `0 0 20px ${color}30` }}>
      {grade}
    </div>
  );
}

export default function TradeGradePage() {
  const { tier } = useTier();
  const [data, setData] = useState<TradeGradePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/trade-grade", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/trade-grade")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Pro tier required</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Grading trading conditions…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="📋 Trade Grade"
        subtitle="Real-time trading conditions scorecard — is now a good time to trade gold?"
      />

      {/* ── Overall Grade ─────────────────────────────────────── */}
      <div className="panel px-5 py-5 flex items-center gap-5">
        <GradeBadge grade={data.overallGrade} />
        <div className="flex-1 space-y-1.5">
          <div className="text-lg font-black" style={{ color: data.gradeColor }}>
            {data.tradeRecommendation}
          </div>
          <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>
            {data.gradeDescription}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="h-full rounded-full" style={{ width: `${data.overallScore}%`, background: data.gradeColor + "80" }} />
            </div>
            <span className="text-[9px] font-black" style={{ color: data.gradeColor }}>{data.overallScore}/100</span>
          </div>
        </div>
      </div>

      {/* ── Factor Breakdown ──────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Scoring Factors
        </div>
        {data.factors.map((f: GradeFactor) => {
          const fColor = GRADE_COLOR[f.grade];
          return (
            <div key={f.name} className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: fColor + "06", border: `1px solid ${fColor}20` }}>
              <span className="text-xl shrink-0">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{f.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black" style={{ color: fColor }}>{f.grade}</span>
                    <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>{f.score}/100</span>
                  </div>
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{f.detail}</div>
                <div className="mt-1.5 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full" style={{ width: `${f.score}%`, background: fColor + "60" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Trading Conditions ────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          ✅ Condition Checklist
        </div>
        {data.tradingConditions.map((c: TradingCondition) => {
          const color = COND_COLOR[c.status] ?? "#9ca3af";
          const icon = c.status === "optimal" ? "✅" : c.status === "good" ? "🟢" : c.status === "fair" ? "🟡" : c.status === "poor" ? "🔴" : "🚫";
          return (
            <div key={c.aspect} className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ background: color + "06", border: `1px solid ${color}20` }}>
              <span className="text-base shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{c.aspect}</span>
                  <span className="text-[8px] font-black capitalize px-1.5 py-0.5 rounded"
                    style={{ background: color + "15", color }}>{c.status}</span>
                </div>
                <div className="text-[8px] mt-0.5 font-bold" style={{ color }}>{c.value}</div>
                <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{c.recommendation}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Optimal Entry Setup ───────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🎯 Entry Setup (If Condition Warrants)
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Entry Zone",    value: data.optimalEntry.zone,              color: "#f5c451" },
            { label: "Position Size", value: data.optimalEntry.size,              color: "#c084fc" },
            { label: "Stop Loss",     value: data.optimalEntry.stopSuggestion,    color: "#f87171" },
            { label: "Target",        value: data.optimalEntry.targetSuggestion,  color: "#34d399" },
          ].map(item => (
            <div key={item.label} className="rounded-xl px-3 py-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>{item.label}</div>
              <div className="text-[9px] font-bold leading-snug" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg px-3 py-2 text-[9px] text-center"
          style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", color: "#34d399" }}>
          Min Risk:Reward Target — {data.optimalEntry.riskReward}
        </div>
      </div>

      {/* ── Avoid If ─────────────────────────────────────────── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
          ⚠️ Avoid Trading If...
        </div>
        {data.avoidIf.map((condition, i) => (
          <div key={i} className="flex items-start gap-2 text-[9px]" style={{ color: "rgba(175,185,215,0.5)" }}>
            <span className="shrink-0" style={{ color: "#f87171" }}>✗</span>
            <span>{condition}</span>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Not financial advice · Updates every 15 min
      </div>
    </div>
  );
}
