"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { GoldVolatilityPayload, VolatilityPoint } from "@/app/api/gold-volatility/route";

const VOL_TREND_LABEL = { expanding: "↑ Expanding", contracting: "↓ Contracting", stable: "→ Stable" };

export default function GoldVolatilityPage() {
  const { tier } = useTier();
  const [data, setData] = useState<GoldVolatilityPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/gold-volatility", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/gold-volatility")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Computing volatility model…</div>
    </div>
  );
  if (!data) return null;

  const maxRange = Math.max(...data.dailyRanges, 1);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🌊 Gold Volatility Analysis"
        subtitle="Realized volatility, ATR, volatility cone, and expected move sizing for gold traders"
      />

      {/* ── Regime Header ─── */}
      <div className="panel px-5 py-4 flex items-center gap-4"
        style={{ border: `1px solid ${data.volRegimeColor}30`, background: data.volRegimeColor + "06" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: data.volRegimeColor + "18", border: `2px solid ${data.volRegimeColor}40` }}>
          {data.volRegime === "extreme_vol" ? "🔥" : data.volRegime === "high_vol" ? "⚡" : data.volRegime === "low_vol" ? "😴" : "📊"}
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Volatility Regime</div>
          <div className="text-base font-black" style={{ color: data.volRegimeColor }}>{data.volRegimeLabel}</div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.volRegimeDescription}</div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Vol Trend</div>
          <div className="text-[9px] font-black" style={{ color: data.volTrendColor }}>{VOL_TREND_LABEL[data.volTrend]}</div>
        </div>
      </div>

      {/* ── Expected Moves ─── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Expected Daily ±", value: `$${data.expectedDailyMove}`, sub: "1 std dev (68% probability)" },
          { label: "Expected Weekly ±", value: `$${data.expectedWeeklyMove}`, sub: "1 std dev (√5 scaling)" },
          { label: "Expected Monthly ±", value: `$${data.expectedMonthlyMove}`, sub: "1 std dev (√21 scaling)" },
        ].map(m => (
          <div key={m.label} className="panel px-4 py-4 text-center space-y-1">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{m.label}</div>
            <div className="text-xl font-black" style={{ color: "#f5c451" }}>{m.value}</div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ATR Card ─── */}
      <div className="panel px-5 py-4 flex items-center gap-4">
        <div className="space-y-0.5">
          <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>ATR(14)</div>
          <div className="text-2xl font-black" style={{ color: "#c084fc" }}>${data.atr14}</div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{data.atrPct.toFixed(2)}% of price · {data.atrPctile}th percentile</div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>ATR percentile vs 1Y</div>
          <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full rounded-full" style={{ width: `${data.atrPctile}%`, background: "#c084fc80" }} />
          </div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>
            Average true daily range — use as stop-loss guide. Minimum stop: 1× ATR (${data.atr14}).
          </div>
        </div>
      </div>

      {/* ── Vol Cone ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Realized Volatility Across Periods
        </div>
        {data.volPoints.map((vp: VolatilityPoint) => (
          <div key={vp.period} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: vp.signalColor + "06", border: `1px solid ${vp.signalColor}15` }}>
            <div className="w-10 text-center shrink-0">
              <div className="text-[8px] font-black" style={{ color: vp.signalColor }}>{vp.period}</div>
              <div className="text-[6px]" style={{ color: "rgba(175,185,215,0.25)" }}>{vp.days}D</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-black" style={{ color: vp.signalColor }}>{vp.rv.toFixed(1)}%</span>
                <span className="text-[7px] px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0"
                  style={{ color: vp.signalColor, background: vp.signalColor + "18", border: `1px solid ${vp.signalColor}25` }}>
                  {vp.signal.replace("_", " ")}
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(vp.rv / (data.historicalHighVol || vp.rv) * 100, 100)}%`, background: vp.signalColor + "70" }} />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[6px]" style={{ color: "rgba(175,185,215,0.25)" }}>1Y low: {data.historicalLowVol.toFixed(1)}%</span>
                <span className="text-[6px]" style={{ color: "rgba(175,185,215,0.25)" }}>{vp.pctile}th pctile</span>
                <span className="text-[6px]" style={{ color: "rgba(175,185,215,0.25)" }}>1Y high: {data.historicalHighVol.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 mt-1 px-3 text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>
          <span>Vol cone: 5th pctile {data.volConeLow.toFixed(1)}%</span>
          <span>·</span>
          <span>95th pctile {data.volConeHigh.toFixed(1)}%</span>
          <span>·</span>
          <span>1Y baseline: {data.rv1Y.toFixed(1)}%</span>
        </div>
      </div>

      {/* ── Daily Range Chart ─── */}
      <div className="panel px-5 py-5 space-y-2">
        <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
          📈 Daily High-Low Range — Last 30 Days
        </div>
        <div className="flex items-end gap-0.5 h-20">
          {data.dailyRanges.map((r, i) => {
            const hPct = (r / maxRange) * 100;
            const isLast = i === data.dailyRanges.length - 1;
            const col = r > data.atr14 * 1.2 ? "#fb923c" : r < data.atr14 * 0.7 ? "#34d399" : "#c084fc";
            return (
              <div key={i} className="flex-1 flex flex-col justify-end h-full">
                <div className="w-full rounded-sm" style={{ height: `${Math.max(4, hPct)}%`, background: isLast ? col : col + "60" }} />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded" style={{ background: "#c084fc" }} /><span>Normal (&lt;1.2× ATR)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded" style={{ background: "#fb923c" }} /><span>Wide (&gt;1.2× ATR)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded" style={{ background: "#34d399" }} /><span>Narrow (&lt;0.7× ATR)</span></div>
        </div>
      </div>

      {/* ── Trading Implication ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>🎯 Volatility-Adjusted Trading Guidance</div>
        <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.tradingImplication}</div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[
            { case: "Vol in bottom 30%", action: "Buy options (cheap premium). Set tight stops — low vol means smaller ranges. Watch for volatility explosion" },
            { case: "Vol in top 20%", action: "Sell premium strategies (strangles). Widen stops by 30-50%. Reduce position size vs normal market" },
            { case: "Vol expanding (short > long)", action: "Market becoming more uncertain — reduce position size, wait for vol to peak before sizing up" },
            { case: "Vol contracting (short < long)", action: "Market calming down — good entry environment if trend confirmed; stops can be tightened" },
          ].map(item => (
            <div key={item.case} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[7px] font-bold mb-0.5" style={{ color: "#c084fc" }}>{item.case}</div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.4)" }}>{item.action}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · GC=F 1Y daily · Realized volatility (annualized) · Not financial advice
      </div>
    </div>
  );
}
