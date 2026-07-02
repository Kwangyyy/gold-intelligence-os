"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { DivergenceScanPayload, DivergenceResult } from "@/app/api/divergence-scan/route";

const DIV_COLOR: Record<string, string> = {
  "bullish":         "#34d399",
  "hidden bullish":  "#86efac",
  "bearish":         "#f87171",
  "hidden bearish":  "#fb923c",
  "none":            "#9ca3af",
};
const SEVERITY_STARS: Record<string, string> = {
  "strong": "⭐⭐⭐",
  "moderate": "⭐⭐",
  "weak": "⭐",
  "none": "—",
};

export default function DivergenceScanPage() {
  const { tier } = useTier();
  const [data, setData] = useState<DivergenceScanPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/divergence-scan", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/divergence-scan")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Scanning for divergences…</div>
    </div>
  );
  if (!data) return null;

  const biasColor =
    data.overallBias === "bullish" ? "#34d399" :
    data.overallBias === "bearish" ? "#f87171" : "#f5c451";

  const activeDivs = data.divergences.filter(d => d.type !== "none");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🔍 Divergence Scanner"
        subtitle="RSI & MACD divergence detection across 4 timeframes"
      />

      {/* ── Summary Stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Active Divs",   value: data.stats.totalDivergences, color: "#f5c451"   },
          { label: "Bullish",       value: data.stats.bullishCount,      color: "#34d399"   },
          { label: "Bearish",       value: data.stats.bearishCount,      color: "#f87171"   },
          { label: "Strong",        value: data.stats.strongCount,        color: "#c084fc"   },
        ].map(item => (
          <div key={item.label} className="panel px-3 py-3 text-center">
            <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>{item.label}</div>
            <div className="text-2xl font-black" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* ── Overall Bias ─────────────────────────────────────── */}
      <div className="panel px-5 py-4">
        <div className="flex items-start gap-4">
          <div>
            <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Overall Bias</div>
            <div className="text-xl font-black capitalize" style={{ color: biasColor }}>
              {data.overallBias === "bullish" ? "🟢" : data.overallBias === "bearish" ? "🔴" : "🟡"} {data.overallBias}
            </div>
          </div>
          <div className="flex-1 text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
            {data.keyDivergence}
          </div>
        </div>
      </div>

      {/* ── Divergence List ───────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📋 Detected Divergences
        </div>

        {activeDivs.length === 0 ? (
          <div className="text-center py-8 text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            ✅ No divergences detected — price and momentum are aligned across all timeframes
          </div>
        ) : (
          activeDivs.map((div: DivergenceResult, idx: number) => {
            const color = DIV_COLOR[div.type] ?? "#9ca3af";
            return (
              <div key={idx} className="rounded-xl px-4 py-4 space-y-2"
                style={{ background: color + "08", border: `1px solid ${color}25` }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase"
                      style={{ background: color + "18", color }}>
                      {div.type}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.04)", color: "rgba(175,185,215,0.5)" }}>
                      {div.timeframe}
                    </span>
                    <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                      {div.indicator}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px]">{SEVERITY_STARS[div.severity]}</span>
                    <span className="text-[8px] capitalize px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.4)" }}>
                      {div.severity}
                    </span>
                  </div>
                </div>

                <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>
                  {div.description}
                </div>

                <div className="text-[8px] leading-relaxed px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.45)" }}>
                  💡 {div.tradingImplication}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[8px]">
                  <div style={{ color: "rgba(175,185,215,0.4)" }}>
                    Price: ${div.priceHigh.toFixed(0)} / ${div.priceLow.toFixed(0)}
                  </div>
                  <div style={{ color: "rgba(175,185,215,0.4)" }}>
                    {div.indicator}: {div.indicatorHigh.toFixed(1)} / {div.indicatorLow.toFixed(1)}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {activeDivs.length === 0 && (
          <div className="rounded-xl px-4 py-3 text-[9px]"
            style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)", color: "rgba(52,211,153,0.7)" }}>
            Price and momentum indicators are confirming each other — trend continuation likely. Monitor for divergences as price approaches key levels.
          </div>
        )}
      </div>

      {/* ── Education Box ─────────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
          💡 Divergence Types Explained
        </div>
        {[
          { type: "Bullish",         color: "#34d399", desc: "Price makes lower low, indicator makes higher low → momentum improving, potential reversal up" },
          { type: "Bearish",         color: "#f87171", desc: "Price makes higher high, indicator makes lower high → momentum weakening, potential reversal down" },
          { type: "Hidden Bullish",  color: "#86efac", desc: "Price makes higher low, indicator makes lower low → trend continuation up, buy the pullback" },
          { type: "Hidden Bearish",  color: "#fb923c", desc: "Price makes lower high, indicator makes higher high → trend continuation down, sell the bounce" },
        ].map(item => (
          <div key={item.type} className="flex items-start gap-3 text-[8px]">
            <span className="font-black shrink-0 w-24" style={{ color: item.color }}>{item.type}</span>
            <span style={{ color: "rgba(175,185,215,0.45)" }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · GC=F · RSI(14) + MACD(12,26,9) · 1H/4H/1D/1W
      </div>
    </div>
  );
}
