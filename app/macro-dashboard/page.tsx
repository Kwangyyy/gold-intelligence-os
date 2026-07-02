"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { MacroDashboardPayload, MacroCategoryScore, MacroFactor } from "@/app/api/macro-dashboard/route";

const SIGNAL_COLOR: Record<string, string> = {
  strong_bull: "#34d399", bull: "#86efac", neutral: "#94a3b8", bear: "#fbbf24", strong_bear: "#f87171",
};
const SIGNAL_LABEL: Record<string, string> = {
  strong_bull: "Strong Bull", bull: "Bullish", neutral: "Neutral", bear: "Bearish", strong_bear: "Strong Bear",
};

function ScoreBadge({ score, signal }: { score: number; signal: string }) {
  const c = SIGNAL_COLOR[signal] ?? "#94a3b8";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-full max-w-[120px] rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: c + "80" }} />
      </div>
      <span className="text-[9px] font-black" style={{ color: c }}>{score}</span>
    </div>
  );
}

export default function MacroDashboardPage() {
  const { tier } = useTier();
  const [data, setData] = useState<MacroDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/macro-dashboard", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/macro-dashboard")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Synthesizing macro inputs…</div>
    </div>
  );
  if (!data) return null;

  const compColor = data.compositeColor;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🌐 Macro Dashboard"
        subtitle="10-factor macro synthesis — currency, rates, inflation, risk appetite, momentum mapped to gold outlook"
      />

      {/* ── Composite Signal Banner ─── */}
      <div className="panel px-5 py-5" style={{ border: `1px solid ${compColor}30`, background: compColor + "06" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[7px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
              Macro Composite Signal
            </div>
            <div className="text-2xl font-black" style={{ color: compColor }}>{data.compositeLabel}</div>
            <div className="text-[8px] mt-1 leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.macroSummary}</div>
          </div>
          <div className="text-center shrink-0">
            <div className="text-5xl font-black" style={{ color: compColor }}>{data.compositeScore}</div>
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>/ 100</div>
            <div className="h-1.5 w-20 rounded-full mt-1" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-full" style={{ width: `${data.compositeScore}%`, background: compColor + "90" }} />
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/[0.04]">
          <div className="text-[8px] font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>Gold Outlook: </div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>{data.goldOutlook}</div>
        </div>
      </div>

      {/* ── Category Scores Grid ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.categories.map((cat: MacroCategoryScore) => {
          const c = SIGNAL_COLOR[cat.signal] ?? "#94a3b8";
          return (
            <button key={cat.category} onClick={() => setExpanded(expanded === cat.category ? null : cat.category)}
              className="panel px-3 py-3 text-left transition-all"
              style={{ border: expanded === cat.category ? `1px solid ${c}` : "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs">{cat.icon}</div>
                <div className="text-[7px] font-black" style={{ color: c }}>{cat.score}</div>
              </div>
              <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{cat.category}</div>
              <div className="h-1 rounded-full mt-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full" style={{ width: `${cat.score}%`, background: c + "70" }} />
              </div>
              <div className="text-[6px] mt-0.5" style={{ color: c }}>{SIGNAL_LABEL[cat.signal]}</div>
            </button>
          );
        })}
      </div>

      {/* ── Expanded Category Factors ─── */}
      {expanded && (() => {
        const cat = data.categories.find(c => c.category === expanded);
        if (!cat) return null;
        return (
          <div className="panel px-5 py-4 space-y-3">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
              {cat.icon} {cat.category} — Detail
            </div>
            {cat.factors.map((f: MacroFactor) => {
              const fc = SIGNAL_COLOR[f.signal] ?? "#94a3b8";
              return (
                <div key={f.name} className="border-b border-white/[0.03] pb-2 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[8px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{f.name}</div>
                      <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{f.value}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[7px] font-black" style={{ color: fc }}>{SIGNAL_LABEL[f.signal]}</div>
                      <div className="text-[6px]" style={{ color: "rgba(175,185,215,0.25)" }}>wt {f.weight}%</div>
                    </div>
                  </div>
                  <ScoreBadge score={f.bullScore} signal={f.signal} />
                  <div className="text-[7px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>{f.description}</div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── All Factors List ─── */}
      <div className="panel px-5 py-5 space-y-2">
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
          📋 All 10 Macro Factors
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[7px] uppercase tracking-wider pb-1.5"
          style={{ color: "rgba(175,185,215,0.25)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span>Factor</span>
          <span className="text-right">Bull Score</span>
          <span className="text-right">Signal</span>
        </div>
        {data.categories.flatMap(c => c.factors).map((f: MacroFactor) => {
          const fc = SIGNAL_COLOR[f.signal] ?? "#94a3b8";
          return (
            <div key={f.name} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-0.5">
              <div>
                <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.5)" }}>{f.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-12 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full" style={{ width: `${f.bullScore}%`, background: fc + "70" }} />
                </div>
                <span className="text-[8px] font-black" style={{ color: fc }}>{f.bullScore}</span>
              </div>
              <div className="text-[7px] text-right" style={{ color: fc }}>{SIGNAL_LABEL[f.signal]}</div>
            </div>
          );
        })}
      </div>

      {/* ── Bull/Bear Summary ─── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="panel px-4 py-4 space-y-2">
          <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "#34d399" }}>🟢 Top Bullish Factors</div>
          {data.topBullishFactors.map((f, i) => (
            <div key={i} className="flex gap-1.5 text-[7px]">
              <span style={{ color: "#34d399" }}>↑</span>
              <span style={{ color: "rgba(175,185,215,0.4)" }}>{f}</span>
            </div>
          ))}
        </div>
        <div className="panel px-4 py-4 space-y-2">
          <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "#f87171" }}>🔴 Top Bearish Factors</div>
          {data.topBearishFactors.map((f, i) => (
            <div key={i} className="flex gap-1.5 text-[7px]">
              <span style={{ color: "#f87171" }}>↓</span>
              <span style={{ color: "rgba(175,185,215,0.4)" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Rule-based macro synthesis · Not financial advice
      </div>
    </div>
  );
}
