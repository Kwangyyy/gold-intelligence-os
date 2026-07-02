"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { GoldSP500Payload, RelativePerformance } from "@/app/api/gold-sp500/route";

const CORR_COLOR = { positive: "#c084fc", negative: "#34d399", uncorrelated: "#f5c451" };

export default function GoldSP500Page() {
  const { tier } = useTier();
  const [data, setData] = useState<GoldSP500Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/gold-sp500", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/gold-sp500")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Computing gold vs equities…</div>
    </div>
  );
  if (!data) return null;

  const corrColor = CORR_COLOR[data.corrRegime];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="⚡ Gold vs S&P 500"
        subtitle="Gold/SPX ratio, rolling correlation, relative performance — when to favor gold over equities"
      />

      {/* ── Header Prices ─── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="panel px-4 py-4 space-y-1">
          <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold (GC=F)</div>
          <div className="text-xl font-black" style={{ color: "#f5c451" }}>
            ${data.goldPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[8px]" style={{ color: data.goldChangeToday >= 0 ? "#34d399" : "#f87171" }}>
            {data.goldChangeToday >= 0 ? "+" : ""}{data.goldChangeToday.toFixed(2)}% today
          </div>
        </div>
        <div className="panel px-4 py-4 space-y-1">
          <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>S&P 500</div>
          <div className="text-xl font-black" style={{ color: "#c084fc" }}>
            {data.spxPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[8px]" style={{ color: data.spxChangeToday >= 0 ? "#34d399" : "#f87171" }}>
            {data.spxChangeToday >= 0 ? "+" : ""}{data.spxChangeToday.toFixed(2)}% today
          </div>
        </div>
        <div className="panel px-4 py-4 space-y-1">
          <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold/SPX Ratio</div>
          <div className="text-xl font-black" style={{ color: data.ratioTrendColor }}>
            {data.goldSpxRatio.toFixed(3)}%
          </div>
          <div className="text-[8px] capitalize" style={{ color: data.ratioTrendColor }}>
            {data.ratioTrend.replace("_", " ")} (30D)
          </div>
        </div>
      </div>

      {/* ── Favor Gold Signal ─── */}
      {data.favorGold && (
        <div className="panel px-5 py-3 rounded-xl"
          style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.25)" }}>
          <div className="text-[9px] font-bold mb-2" style={{ color: "#34d399" }}>⭐ Gold Favorable Environment</div>
          <div className="space-y-1">
            {data.favorGoldReasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-[8px]" style={{ color: "rgba(52,211,153,0.7)" }}>
                <span className="shrink-0">✓</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Correlation Panel ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🔗 Pearson Correlation vs S&P 500
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "30D Rolling", val: data.pearsonCorr30D, label2: "most current" },
            { label: "90D Rolling", val: data.pearsonCorr90D, label2: "longer term" },
          ].map(c => {
            const col = c.val > 0.4 ? "#c084fc" : c.val < -0.2 ? "#34d399" : "#f5c451";
            return (
              <div key={c.label} className="rounded-xl px-4 py-3 text-center"
                style={{ background: col + "08", border: `1px solid ${col}25` }}>
                <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>{c.label} ({c.label2})</div>
                <div className="text-2xl font-black mt-1" style={{ color: col }}>{c.val.toFixed(2)}</div>
                <div className="text-[7px] mt-0.5" style={{ color: col + "99" }}>
                  {Math.abs(c.val) > 0.6 ? "Strong" : Math.abs(c.val) > 0.3 ? "Moderate" : "Weak"} {c.val > 0 ? "positive" : "negative"} corr
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: corrColor + "08", border: `1px solid ${corrColor}25` }}>
          <div className="text-[8px] font-bold mb-1 capitalize" style={{ color: corrColor }}>{data.corrRegime} correlation</div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.corrDescription}</div>
        </div>
      </div>

      {/* ── Relative Performance ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Relative Performance
        </div>
        <div className="grid grid-cols-12 gap-1 px-1 text-[7px] uppercase tracking-widest"
          style={{ color: "rgba(175,185,215,0.25)" }}>
          <div className="col-span-3">Period</div>
          <div className="col-span-2 text-right">Gold</div>
          <div className="col-span-2 text-right">S&P 500</div>
          <div className="col-span-2 text-right">Ratio Δ</div>
          <div className="col-span-3 text-center">Winner</div>
        </div>
        {data.relativePerformance.map((p: RelativePerformance) => {
          const winColor = p.winner === "gold" ? "#f5c451" : p.winner === "equities" ? "#c084fc" : "#9ca3af";
          return (
            <div key={p.label} className="grid grid-cols-12 gap-1 items-center px-1 py-1 rounded-lg"
              style={{ background: "rgba(255,255,255,0.015)" }}>
              <div className="col-span-3 text-[8px]" style={{ color: "rgba(175,185,215,0.5)" }}>{p.label}</div>
              <div className="col-span-2 text-[8px] font-bold text-right"
                style={{ color: p.goldPct >= 0 ? "#34d399" : "#f87171" }}>
                {p.goldPct >= 0 ? "+" : ""}{p.goldPct.toFixed(2)}%
              </div>
              <div className="col-span-2 text-[8px] font-bold text-right"
                style={{ color: p.spxPct >= 0 ? "#34d399" : "#f87171" }}>
                {p.spxPct >= 0 ? "+" : ""}{p.spxPct.toFixed(2)}%
              </div>
              <div className="col-span-2 text-[8px] text-right"
                style={{ color: p.ratioPct >= 0 ? "#f5c451" : "#c084fc" }}>
                {p.ratioPct >= 0 ? "+" : ""}{p.ratioPct.toFixed(1)}%
              </div>
              <div className="col-span-3 text-center">
                <span className="text-[7px] px-1.5 py-0.5 rounded capitalize"
                  style={{ background: winColor + "18", color: winColor }}>
                  {p.winner === "tied" ? "Tied" : p.winner}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Defensive Score ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🛡️ Gold Defensive Score
        </div>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-black" style={{ color: data.goldDefensiveScore > 60 ? "#34d399" : data.goldDefensiveScore < 40 ? "#f87171" : "#f5c451" }}>
            {data.goldDefensiveScore}
          </div>
          <div>
            <div className="text-[9px] font-bold" style={{ color: data.goldDefensiveScore > 60 ? "#34d399" : data.goldDefensiveScore < 40 ? "#f87171" : "#f5c451" }}>
              {data.goldDefensiveScore > 65 ? "Favor Gold" : data.goldDefensiveScore > 55 ? "Slightly Gold" : data.goldDefensiveScore < 35 ? "Favor Equities" : "Balanced"}
            </div>
            <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
              Score 0-100 based on VIX, correlation, ratio trend, relative performance
            </div>
          </div>
        </div>
        <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-full rounded-full" style={{ width: `${data.goldDefensiveScore}%`, background: data.goldDefensiveScore > 60 ? "#34d399aa" : data.goldDefensiveScore < 40 ? "#c084fcaa" : "#f5c451aa" }} />
        </div>
        <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>
          {data.historicalContext}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Not financial advice · Updates every 15 min
      </div>
    </div>
  );
}
