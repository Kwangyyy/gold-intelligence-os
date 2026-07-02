"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { CopperGoldPayload } from "@/app/api/copper-gold/route";

const TREND_ICON = { rising: "▲", flat: "→", falling: "▼" };
const TREND_COLOR = { rising: "#34d399", flat: "#f5c451", falling: "#f87171" };

export default function CopperGoldPage() {
  const { tier } = useTier();
  const [data, setData] = useState<CopperGoldPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/copper-gold", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/copper-gold")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Computing copper/gold ratio…</div>
    </div>
  );
  if (!data) return null;

  const maxRatio = Math.max(...data.ratioHistory.map(h => h.ratio));
  const minRatio = Math.min(...data.ratioHistory.map(h => h.ratio));
  const ratioRange = maxRatio - minRatio || 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🔴 Copper / Gold Ratio"
        subtitle="Leading economic indicator — rising ratio = growth, falling ratio = recession risk & gold bullish"
      />

      {/* ── Signal Banner ─── */}
      <div className="panel px-5 py-4 flex items-center gap-4"
        style={{ border: `1px solid ${data.signalColor}30`, background: data.signalColor + "06" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black"
          style={{ background: data.signalColor + "18", border: `2px solid ${data.signalColor}40`, color: data.signalColor }}>
          {data.economicSignal === "growth" ? "📈" : data.economicSignal === "recession_risk" ? "📉" : "📊"}
        </div>
        <div className="flex-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Economic Signal</div>
          <div className="text-base font-black" style={{ color: data.signalColor }}>{data.signalLabel}</div>
          <div className="text-[8px] mt-0.5 leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.signalDescription}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Ratio Trend</div>
          <div className="text-xl font-black" style={{ color: TREND_COLOR[data.ratioTrend] }}>
            {TREND_ICON[data.ratioTrend]}
          </div>
          <div className="text-[7px] capitalize" style={{ color: "rgba(175,185,215,0.35)" }}>{data.ratioTrend}</div>
        </div>
      </div>

      {/* ── Key Metrics ─── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Copper", value: `$${data.copperPrice.toFixed(3)}`, sub: `${data.copperChange1DPct >= 0 ? "+" : ""}${data.copperChange1DPct.toFixed(2)}% today`, color: "#ef4444" },
          { label: "Gold", value: `$${data.goldPrice.toFixed(0)}`, sub: `${data.goldChange1DPct >= 0 ? "+" : ""}${data.goldChange1DPct.toFixed(2)}% today`, color: "#f5c451" },
          { label: "Ratio ×10⁴", value: data.ratio.toFixed(2), sub: `vs avg ${data.ratioMean90D.toFixed(2)}`, color: data.signalColor },
          { label: "vs 90D Avg", value: `${data.ratioPct90D >= 0 ? "+" : ""}${data.ratioPct90D.toFixed(1)}%`, sub: data.ratioPct90D > 0 ? "above avg" : "below avg", color: data.ratioPct90D > 0 ? "#34d399" : "#f87171" },
        ].map(m => (
          <div key={m.label} className="panel px-3 py-3 space-y-0.5">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{m.label}</div>
            <div className="text-lg font-black" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Ratio Sparkline ─── */}
      <div className="panel px-5 py-5 space-y-2">
        <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
          📈 Copper/Gold Ratio — Last 30 Days
        </div>
        <div className="flex items-end gap-0.5 h-24">
          {data.ratioHistory.map((h, i) => {
            const hPct = ((h.ratio - minRatio) / ratioRange) * 100;
            const isLast = i === data.ratioHistory.length - 1;
            const col = h.ratio > data.ratioMean90D ? data.signalColor : "#f87171";
            return (
              <div key={i} className="flex-1 flex flex-col justify-end h-full">
                <div className="w-full rounded-sm" style={{ height: `${Math.max(4, hPct)}%`, background: isLast ? col : col + "60" }} />
              </div>
            );
          })}
        </div>
        {/* 90D mean line indicator */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 rounded" style={{ background: "#f5c451" }} />
          <span className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>90D avg: {data.ratioMean90D.toFixed(2)}</span>
          <div className="w-6 h-0.5 rounded ml-2" style={{ background: data.signalColor }} />
          <span className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Current: {data.ratio.toFixed(2)}</span>
        </div>
      </div>

      {/* ── YTD Comparison ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 6M Performance Comparison
        </div>
        {[
          { name: "Copper", icon: "🔴", pct: data.copperYTDPct, color: "#ef4444" },
          { name: "Gold",   icon: "🟡", pct: data.goldYTDPct,   color: "#f5c451" },
          { name: "S&P 500 (today)", icon: "📈", pct: data.spxChange1DPct, color: "#c084fc" },
        ].map(item => {
          const col = item.pct >= 0 ? item.color : "#f87171";
          const barW = Math.min(Math.abs(item.pct) * 3, 100);
          return (
            <div key={item.name} className="flex items-center gap-3">
              <span className="text-sm w-4">{item.icon}</span>
              <span className="text-[8px] w-24 shrink-0" style={{ color: "rgba(175,185,215,0.5)" }}>{item.name}</span>
              <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full" style={{ width: `${barW}%`, background: col + "70" }} />
              </div>
              <span className="text-[9px] font-black w-14 text-right" style={{ color: col }}>
                {item.pct >= 0 ? "+" : ""}{item.pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
        <div className="text-[7px] mt-1 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.04)", color: "rgba(175,185,215,0.3)" }}>
          SPX correlation to ratio: {data.spxCorr30D.toFixed(2)} (30D) — {Math.abs(data.spxCorr30D) > 0.5 ? "strong" : "moderate"} relationship
        </div>
      </div>

      {/* ── Context ─── */}
      <div className="panel px-5 py-4 space-y-3">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>📚 Historical Context</div>
        <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.historicalContext}</p>
        <div className="rounded-xl px-4 py-3" style={{ background: data.signalColor + "08", border: `1px solid ${data.signalColor}20` }}>
          <div className="text-[7px] uppercase tracking-widest mb-1" style={{ color: data.signalColor + "99" }}>Trading Implication</div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.tradingImplication}</div>
        </div>
        <div className="space-y-1.5">
          {[
            { rule: "Ratio rising sharply", implication: "Growth optimism rising → risk assets favored, gold may underperform vs stocks" },
            { rule: "Ratio falling sharply", implication: "Growth fears rising → gold shines, watch yield curve for confirmation" },
            { rule: "Ratio at 12-month low", implication: "Historically associated with major gold bottoms / outperformance starts" },
            { rule: "Ratio at 12-month high", implication: "Late cycle / growth peak → caution on industrial metals" },
          ].map(item => (
            <div key={item.rule} className="flex gap-2 text-[8px]">
              <span className="font-bold shrink-0" style={{ color: "#ef4444" }}>Cu/Au</span>
              <span className="font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>{item.rule}: </span>
              <span style={{ color: "rgba(175,185,215,0.4)" }}>{item.implication}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Copper: HG=F (COMEX, $/lb) · Not financial advice
      </div>
    </div>
  );
}
