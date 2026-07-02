"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { RiskSignalsPayload, SignalCategory, RiskSignal, SignalStrength } from "@/app/api/risk-signals/route";

const SIGNAL_COLOR: Record<SignalStrength, string> = {
  "strong buy":  "#34d399",
  "buy":         "#86efac",
  "neutral":     "#f5c451",
  "sell":        "#fb923c",
  "strong sell": "#f87171",
};
const SIGNAL_BG: Record<SignalStrength, string> = {
  "strong buy":  "rgba(52,211,153,0.12)",
  "buy":         "rgba(134,239,172,0.09)",
  "neutral":     "rgba(245,196,81,0.10)",
  "sell":        "rgba(251,146,60,0.10)",
  "strong sell": "rgba(248,113,113,0.12)",
};

function SignalBadge({ signal }: { signal: SignalStrength }) {
  return (
    <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap"
      style={{ background: SIGNAL_BG[signal], color: SIGNAL_COLOR[signal], border: `1px solid ${SIGNAL_COLOR[signal]}40` }}>
      {signal}
    </span>
  );
}

function ScoreDonut({ score, bullish, bearish, neutral }: { score: number; bullish: number; bearish: number; neutral: number }) {
  const total = bullish + bearish + neutral;
  const bPct = total > 0 ? (bullish / total) * 100 : 0;
  const rPct = total > 0 ? (bearish / total) * 100 : 0;
  const color = score >= 70 ? "#34d399" : score >= 50 ? "#f5c451" : "#f87171";
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle cx="40" cy="40" r="30" fill="none" stroke="#34d399" strokeWidth="8"
            strokeDasharray={`${bPct * 1.885} 188.5`} />
          <circle cx="40" cy="40" r="30" fill="none" stroke="#f87171" strokeWidth="8"
            strokeDasharray={`${rPct * 1.885} 188.5`}
            strokeDashoffset={`${-(bPct * 1.885)}`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-lg font-black" style={{ color }}>{score}</div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>score</div>
        </div>
      </div>
      <div className="space-y-1 text-[8px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span style={{ color: "#34d399" }}>{bullish} bullish</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#f5c451" }} />
          <span style={{ color: "#f5c451" }}>{neutral} neutral</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span style={{ color: "#f87171" }}>{bearish} bearish</span>
        </div>
      </div>
    </div>
  );
}

export default function RiskSignalsPage() {
  const { tier } = useTier();
  const [data, setData] = useState<RiskSignalsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/risk-signals", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/risk-signals")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Scanning risk signals…</div>
    </div>
  );
  if (!data) return null;

  const sentimentColor =
    data.overallSentiment.includes("Strongly Bullish") ? "#34d399" :
    data.overallSentiment.includes("Bullish") ? "#86efac" :
    data.overallSentiment.includes("Bearish") ? "#f87171" : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🎯 Risk Signal Aggregator"
        subtitle="Multi-factor gold signal dashboard — macro, technical, fundamental"
      />

      {/* ── Overall Score ─────────────────────────────────────── */}
      <div className="panel px-5 py-5">
        <div className="flex items-center gap-5 flex-wrap">
          <ScoreDonut
            score={data.overallScore}
            bullish={data.signalBullish}
            bearish={data.signalBearish}
            neutral={data.signalNeutral}
          />
          <div className="flex-1 space-y-2">
            <div className="text-xl font-black" style={{ color: sentimentColor }}>
              {data.overallSentiment}
            </div>
            <div className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>
              {data.summaryText}
            </div>
            <div className="flex flex-wrap gap-2">
              {data.topBullishSignals.map(s => (
                <span key={s} className="text-[8px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                  ↑ {s}
                </span>
              ))}
              {data.topBearishSignals.map(s => (
                <span key={s} className="text-[8px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                  ↓ {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Categories ────────────────────────────────────────── */}
      {data.categories.map((cat: SignalCategory) => {
        const isOpen = expanded === cat.name;
        const catColor =
          cat.categoryScore >= 70 ? "#34d399" :
          cat.categoryScore >= 50 ? "#f5c451" : "#f87171";
        return (
          <div key={cat.name} className="panel overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
              onClick={() => setExpanded(isOpen ? null : cat.name)}>
              <span className="text-xl">{cat.icon}</span>
              <div className="flex-1">
                <div className="text-[10px] font-black" style={{ color: "rgba(255,255,255,0.75)" }}>{cat.name}</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                  {cat.signals.length} signals · {cat.categorySentiment}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-lg font-black" style={{ color: catColor }}>{cat.categoryScore}</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{isOpen ? "▲" : "▼"}</div>
              </div>
            </button>

            {isOpen && (
              <div className="border-t space-y-2 px-5 pb-4 pt-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {cat.signals.map((sig: RiskSignal) => (
                  <div key={sig.name} className="rounded-xl px-4 py-3 space-y-1"
                    style={{ background: SIGNAL_BG[sig.signal], border: `1px solid ${SIGNAL_COLOR[sig.signal]}20` }}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{sig.icon}</span>
                        <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{sig.name}</span>
                      </div>
                      <SignalBadge signal={sig.signal} />
                    </div>
                    <div className="text-[10px] font-black" style={{ color: SIGNAL_COLOR[sig.signal] }}>
                      {typeof sig.value === "number" ? sig.value.toFixed(2) : sig.value}
                    </div>
                    <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
                      {sig.detail}
                    </div>
                    <div className="flex items-center justify-between text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>
                      <span>Source: {sig.source}</span>
                      <span>Confidence: {sig.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Live market data, updates every 15 min
      </div>
    </div>
  );
}
