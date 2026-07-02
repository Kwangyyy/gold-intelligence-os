"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface RegimePlaybook {
  regime: string;
  vixRange: string;
  icon: string;
  goldBias: "strong_bullish" | "bullish" | "neutral" | "bearish";
  historicalReturn30d: number;
  winRate30d: number;
  description: string;
  tradingStrategy: string;
}

interface VixRegimeData {
  vixCurrent: number;
  vixChange1d: number;
  vixChange5d: number;
  vixTrend: "spiking" | "rising" | "stable" | "falling" | "collapsing";
  currentRegime: string;
  goldImplication: string;
  historicalReturn30d: number;
  winRate30d: number;
  playbooks: RegimePlaybook[];
  compositeScore: number;
  insight: string;
  timestamp: string;
}

const BIAS_META = {
  strong_bullish: { color: "#34d399", label: "Strong Bullish" },
  bullish:        { color: "#86efac", label: "Bullish"        },
  neutral:        { color: "#f5c451", label: "Neutral"        },
  bearish:        { color: "#f87171", label: "Bearish"        },
};

const TREND_META: Record<string, { label: string; color: string; icon: string }> = {
  spiking:    { label: "Spiking",    color: "#f87171", icon: "🚨" },
  rising:     { label: "Rising",     color: "#fb923c", icon: "↗"  },
  stable:     { label: "Stable",     color: "#f5c451", icon: "→"  },
  falling:    { label: "Falling",    color: "#86efac", icon: "↘"  },
  collapsing: { label: "Collapsing", color: "#34d399", icon: "⬇⬇" },
};

export default function VixRegimePage() {
  const { t } = useI18n();
  const [data, setData] = useState<VixRegimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vix-regime")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Reading VIX regime…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const trend = TREND_META[data.vixTrend];
  const scoreColor = data.compositeScore >= 65 ? "#34d399" : data.compositeScore <= 35 ? "#f87171" : "#f5c451";
  const vixColor = data.vixCurrent > 30 ? "#f87171" : data.vixCurrent > 20 ? "#fb923c" : data.vixCurrent > 15 ? "#f5c451" : "#34d399";

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navVixRegime")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          VIX Regime Analysis · Historical Gold Playbooks by Volatility Environment
        </p>
      </div>

      {/* VIX current */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>VIX NOW</div>
          <div className="text-3xl font-black" style={{ color: vixColor }}>{data.vixCurrent.toFixed(1)}</div>
          <div className="text-[10px] mt-1" style={{ color: data.vixChange1d >= 0 ? "#f87171" : "#34d399" }}>
            {data.vixChange1d >= 0 ? "+" : ""}{data.vixChange1d.toFixed(1)}% today
          </div>
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
            {data.vixChange5d >= 0 ? "+" : ""}{data.vixChange5d.toFixed(1)}% (5D)
          </div>
        </div>

        <div className="col-span-1 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>VIX TREND</div>
          <div className="text-2xl">{trend.icon}</div>
          <div className="text-xs font-bold mt-1" style={{ color: trend.color }}>{trend.label}</div>
          <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>{data.currentRegime}</div>
        </div>

        <div className="col-span-1 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>GOLD SCORE</div>
          <div className="text-3xl font-black" style={{ color: scoreColor }}>{data.compositeScore}</div>
          <div className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>VIX-derived gold signal</div>
          <div className="text-[9px]" style={{ color: scoreColor }}>
            {data.historicalReturn30d >= 0 ? "+" : ""}{data.historicalReturn30d.toFixed(2)}% avg 30D
          </div>
        </div>
      </div>

      {/* Current regime panel */}
      <div className="rounded-xl p-5" style={{ background: `rgba(${vixColor === "#f87171" ? "248,113,113" : vixColor === "#fb923c" ? "251,146,60" : vixColor === "#f5c451" ? "245,196,81" : "52,211,153"},0.06)`, border: `1px solid ${vixColor}30` }}>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "rgba(175,185,215,0.4)" }}>CURRENT REGIME: {data.currentRegime.toUpperCase()}</div>
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: "rgba(175,185,215,0.6)" }}>{data.goldImplication}</p>
        <div className="rounded-lg p-3" style={{ background: "rgba(245,196,81,0.05)", border: "1px solid rgba(245,196,81,0.1)" }}>
          <div className="text-[9px] font-bold mb-1" style={{ color: "#f5c451" }}>TRADING PLAYBOOK</div>
          <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.insight}</p>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div>
            <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>Hist. 30D Return</div>
            <div className="text-sm font-black" style={{ color: data.historicalReturn30d >= 0 ? "#34d399" : "#f87171" }}>
              {data.historicalReturn30d >= 0 ? "+" : ""}{data.historicalReturn30d.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>Win Rate</div>
            <div className="text-sm font-black" style={{ color: data.winRate30d >= 55 ? "#34d399" : "#f87171" }}>
              {data.winRate30d}%
            </div>
          </div>
        </div>
      </div>

      {/* All regimes playbook */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          ALL VIX REGIMES — GOLD PLAYBOOK
        </div>
        {data.playbooks.map((pb, i) => {
          const biasMeta = BIAS_META[pb.goldBias];
          const isCurrent = pb.regime === data.currentRegime;
          return (
            <div
              key={pb.regime}
              className="px-4 py-3"
              style={{
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                background: isCurrent ? "rgba(245,196,81,0.04)" : undefined,
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg">{pb.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: isCurrent ? "#f5c451" : "rgba(255,255,255,0.75)" }}>
                      {pb.regime}
                    </span>
                    {isCurrent && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "rgba(245,196,81,0.15)", color: "#f5c451" }}>CURRENT</span>}
                  </div>
                  <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>VIX {pb.vixRange}</div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: `${biasMeta.color}15`, color: biasMeta.color }}>
                    {biasMeta.label}
                  </span>
                  <div className="text-[9px] mt-1" style={{ color: pb.historicalReturn30d >= 0 ? "#34d399" : "#f87171" }}>
                    {pb.historicalReturn30d >= 0 ? "+" : ""}{pb.historicalReturn30d.toFixed(2)}% / {pb.winRate30d}%W
                  </div>
                </div>
              </div>
              <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{pb.description}</p>
              {isCurrent && (
                <p className="text-[9px] mt-1.5 leading-relaxed" style={{ color: "rgba(245,196,81,0.7)" }}>
                  → {pb.tradingStrategy}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* VIX legend */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="text-[9px] font-bold mb-2" style={{ color: "rgba(175,185,215,0.4)" }}>VIX QUICK REFERENCE</div>
        <div className="grid grid-cols-2 gap-2 text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
          <span>🔥 VIX &gt; 40: Crisis / Systemic Fear</span>
          <span>😨 VIX 25-40: High Fear</span>
          <span>😟 VIX 18-25: Moderate Concern</span>
          <span>😌 VIX 13-18: Complacency</span>
          <span>😴 VIX &lt; 13: Extreme Complacency</span>
          <span>📊 Historical avg VIX: ~19</span>
        </div>
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        VIX data from Yahoo Finance · Historical returns based on gold futures 1990-2024 · 15-min cache · Not financial advice
      </p>
    </div>
  );
}
