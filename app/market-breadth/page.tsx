"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { MarketBreadthPayload, BreadthIndicator, SectorReading } from "@/app/api/market-breadth/route";

const SIG_COLOR: Record<string, string> = {
  bullish: "#34d399", neutral: "#f5c451", bearish: "#f87171",
};

export default function MarketBreadthPage() {
  const { tier } = useTier();
  const [data, setData] = useState<MarketBreadthPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/market-breadth", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/market-breadth")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Scanning market breadth…</div>
    </div>
  );
  if (!data) return null;

  const signalColor =
    data.goldBreadthSignal === "risk-off bullish" ? "#34d399" :
    data.goldBreadthSignal === "risk-on bearish"  ? "#f87171" : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🌐 Market Breadth"
        subtitle="Cross-market risk signals and gold implications"
      />

      {/* ── Breadth Score ─────────────────────────────────────── */}
      <div className="panel px-5 py-5 flex items-center gap-5">
        <div className="text-center shrink-0">
          <div className="text-4xl font-black" style={{ color: signalColor }}>{data.breadthScore}</div>
          <div className="text-[7px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
            Breadth Score
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="text-[10px] font-black capitalize" style={{ color: signalColor }}>
            {data.goldBreadthSignal === "risk-off bullish" ? "🟢 Risk-Off — Bullish for Gold" :
             data.goldBreadthSignal === "risk-on bearish"  ? "🔴 Risk-On — Headwind for Gold" :
             "🟡 Mixed Signals — Neutral"}
          </div>
          <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
            {data.narrative}
          </div>
          <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full rounded-full" style={{ width: `${data.breadthScore}%`, background: signalColor + "70" }} />
          </div>
        </div>
      </div>

      {/* ── Breadth Indicators ────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Breadth Indicators
        </div>
        {data.breadthIndicators.map((bi: BreadthIndicator) => {
          const color = SIG_COLOR[bi.signal];
          return (
            <div key={bi.name} className="rounded-xl px-4 py-3 space-y-1.5"
              style={{ background: color + "06", border: `1px solid ${color}20` }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-base">{bi.icon}</span>
                  <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{bi.name}</span>
                </div>
                <span className="text-[8px] font-black px-2 py-0.5 rounded-full capitalize"
                  style={{ background: color + "18", color, border: `1px solid ${color}40` }}>
                  {bi.signal}
                </span>
              </div>
              <div className="text-[9px] font-bold" style={{ color }}>{typeof bi.value === "string" ? bi.value : bi.value}</div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.5)" }}>{bi.goldImplication}</div>
            </div>
          );
        })}
      </div>

      {/* ── Sector Readings ───────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🏭 Sector Performance (Gold Lens)
        </div>
        {data.sectorReadings.map((s: SectorReading) => {
          const chgColor = s.change1D >= 0 ? "#34d399" : "#f87171";
          const corrColor = s.goldCorrelation === "positive" ? "#34d399" : s.goldCorrelation === "negative" ? "#f87171" : "#9ca3af";
          return (
            <div key={s.sector} className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-xl shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>{s.sector}</div>
                <div className="text-[7px]" style={{ color: corrColor }}>
                  {s.goldCorrelation === "positive" ? "↑ Confirms gold move" : s.goldCorrelation === "negative" ? "↓ Counter-signal to gold" : "Uncorrelated"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black" style={{ color: chgColor }}>
                  {s.change1D >= 0 ? "+" : ""}{s.change1D.toFixed(2)}%
                </div>
                <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>today</div>
              </div>
              <div className="text-lg">
                {s.trend === "up" ? "↗" : s.trend === "down" ? "↘" : "→"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Live Yahoo Finance data · Updates every 15 min
      </div>
    </div>
  );
}
