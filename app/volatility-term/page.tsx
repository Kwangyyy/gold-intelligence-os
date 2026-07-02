"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { VolatilityTermPayload, IVPoint, HVPoint } from "@/app/api/volatility-term/route";

function RegimeBadge({ regime }: { regime: string }) {
  const cfg =
    regime === "low vol"  ? { bg: "rgba(52,211,153,0.12)",  color: "#34d399", label: "Low Vol"    } :
    regime === "normal"   ? { bg: "rgba(245,196,81,0.12)",  color: "#f5c451", label: "Normal"     } :
    regime === "elevated" ? { bg: "rgba(251,146,60,0.12)",  color: "#fb923c", label: "Elevated"   } :
    regime === "high vol" ? { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "High Vol"   } :
                            { bg: "rgba(239,68,68,0.15)",   color: "#ef4444", label: "Extreme"    };
  return (
    <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      {cfg.label}
    </span>
  );
}

function SkewBadge({ skew }: { skew: string }) {
  const cfg =
    skew === "call skew" ? { bg: "rgba(52,211,153,0.12)",  color: "#34d399", label: "↑ Call Skew (Bullish)" } :
    skew === "put skew"  ? { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "↓ Put Skew (Bearish)"  } :
                           { bg: "rgba(245,196,81,0.12)",  color: "#f5c451", label: "→ Neutral Skew"        };
  return (
    <span className="text-[9px] font-black px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      {cfg.label}
    </span>
  );
}

export default function VolatilityTermPage() {
  const { tier } = useTier();
  const [data, setData] = useState<VolatilityTermPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/volatility-term", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/volatility-term")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Pro tier required</div>
          <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>Upgrade to access Volatility Term Structure</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Computing volatility surface…</div>
    </div>
  );
  if (error || !data) return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-xs" style={{ color: "#f87171" }}>{error || "No data"}</div>
    </div>
  );

  const maxIV = Math.max(...data.ivTermStructure.map(p => p.atmIV), 20);
  const maxHV = Math.max(...data.hvHistory.map(h => h.hv), 20);
  const maxChart = Math.max(maxIV, maxHV) * 1.1;

  const signalColor =
    data.volSignalForGold === "bullish"  ? "#34d399" :
    data.volSignalForGold === "bearish"  ? "#f87171" : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="📊 Volatility Term Structure"
        subtitle="Gold implied vs realized volatility — IV surface, skew, regime analysis"
      />

      {/* ── Header Metrics ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "1M ATM IV",        value: `${data.currentIV1M.toFixed(1)}%`,   color: "#f5c451" },
          { label: "Vol Regime",        value: data.volRegime.regime,               badge: true },
          { label: "IV-HV Spread",      value: `+${data.volRegime.ivHvSpread.toFixed(1)}%`, color: data.volRegime.ivHvSpread > 2 ? "#fb923c" : "#34d399" },
          { label: "IV Percentile",     value: `${data.volRegime.ivPercentile}th`,  color: "rgba(192,132,252,0.9)" },
        ].map(item => (
          <div key={item.label} className="panel px-3 py-3 text-center">
            <div className="text-[8px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(175,185,215,0.3)" }}>{item.label}</div>
            {item.badge
              ? <RegimeBadge regime={item.value} />
              : <div className="text-lg font-black" style={{ color: item.color }}>{item.value}</div>
            }
          </div>
        ))}
      </div>

      {/* ── Vol Signal ────────────────────────────────────────── */}
      <div className="panel px-5 py-4 flex items-start gap-4">
        <div className="shrink-0">
          <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Vol Signal</div>
          <div className="text-xl font-black capitalize" style={{ color: signalColor }}>
            {data.volSignalForGold === "bullish" ? "🟢" : data.volSignalForGold === "bearish" ? "🔴" : "🟡"} {data.volSignalForGold}
          </div>
        </div>
        <div className="flex-1 text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>
          {data.volInterpretation}
        </div>
      </div>

      {/* ── IV Term Structure Chart ───────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📈 ATM Implied Volatility Term Structure
        </div>
        <div className="space-y-2">
          {data.ivTermStructure.map((pt: IVPoint) => {
            const barPct = (pt.atmIV / maxChart) * 100;
            return (
              <div key={pt.tenor} className="flex items-center gap-3">
                <div className="w-10 text-right text-[9px] font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>{pt.tenor}</div>
                <div className="flex-1 relative h-8 rounded-lg overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="absolute left-0 top-0 h-full rounded-lg"
                    style={{ width: `${barPct}%`, background: "linear-gradient(90deg, rgba(245,196,81,0.25), rgba(245,196,81,0.08))" }} />
                  <div className="absolute inset-0 flex items-center justify-between px-3">
                    <span className="text-[9px] font-black" style={{ color: "#f5c451" }}>{pt.atmIV.toFixed(1)}%</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[8px]"
                        style={{ color: pt.riskReversal25d > 0 ? "#34d399" : "#f87171" }}>
                        RR25δ: {pt.riskReversal25d > 0 ? "+" : ""}{pt.riskReversal25d.toFixed(1)}
                      </span>
                      <span className="text-[8px]" style={{ color: "rgba(192,132,252,0.6)" }}>
                        BF: {pt.butterfly25d.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[8px] pt-1" style={{ color: "rgba(175,185,215,0.25)" }}>
          RR25δ = 25-delta risk reversal (positive = calls pricier = bullish skew) · BF = 25-delta butterfly (smile width)
        </div>
      </div>

      {/* ── HV vs IV Comparison ───────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📉 Realized Volatility (Historical)
        </div>
        <div className="space-y-2">
          {data.hvHistory.map((h: HVPoint) => {
            const barPct = (h.hv / maxChart) * 100;
            const iv1M = data.currentIV1M;
            const spread = iv1M - h.hv;
            return (
              <div key={h.window} className="flex items-center gap-3">
                <div className="w-10 text-right text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{h.window}</div>
                <div className="flex-1 relative h-8 rounded-lg overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="absolute left-0 top-0 h-full rounded-lg"
                    style={{ width: `${barPct}%`, background: "linear-gradient(90deg, rgba(96,165,250,0.25), rgba(96,165,250,0.06))" }} />
                  <div className="absolute inset-0 flex items-center justify-between px-3">
                    <span className="text-[9px] font-black" style={{ color: "#60a5fa" }}>{h.hv.toFixed(1)}%</span>
                    <span className="text-[8px]" style={{ color: spread > 0 ? "#f5c451" : "#34d399" }}>
                      IV spread: {spread > 0 ? "+" : ""}{spread.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          IV−HV spread (vol premium): positive → options expensive → consider selling premium · negative → options cheap → buy straddles
        </div>
      </div>

      {/* ── Options Skew Interpretation ───────────────────────── */}
      <div className="panel px-5 py-5 space-y-4">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🎯 Skew & Regime Analysis
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>25-Delta Skew:</div>
          <SkewBadge skew={data.skewSignal} />
        </div>
        <div className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
          {data.volRegime.implication}
        </div>

        {/* IV Percentile gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>
            <span>Low (0)</span>
            <span style={{ color: "#c084fc" }}>1M IV Percentile vs 1Y range: {data.volRegime.ivPercentile}th</span>
            <span>High (100)</span>
          </div>
          <div className="h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full rounded-full"
              style={{
                width: `${data.volRegime.ivPercentile}%`,
                background: "linear-gradient(90deg, #34d399, #f5c451, #f87171)",
              }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-[8px]">
          {[
            { label: "Low Vol",  range: "10–13%", action: "Long straddles, call spreads" },
            { label: "Normal",   range: "13–16%", action: "Directional strategies" },
            { label: "Elevated", range: "16–20%", action: "Premium selling (iron condor)" },
          ].map(item => (
            <div key={item.label} className="rounded-lg px-2 py-2"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="font-bold mb-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{item.label}</div>
              <div style={{ color: "rgba(175,185,215,0.4)" }}>{item.range}</div>
              <div className="mt-1" style={{ color: "rgba(175,185,215,0.3)" }}>{item.action}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · HV computed from live COMEX GC=F · IV estimated from OTC market quotes
      </div>
    </div>
  );
}
