"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface AssetMomentum {
  symbol: string;
  name: string;
  price: number | null;
  returns: {
    d1: number | null;
    d5: number | null;
    d20: number | null;
    d60: number | null;
  };
  momentum: number;
  trend: "strong_up" | "up" | "neutral" | "down" | "strong_down";
  goldCorrelation: "positive" | "inverse" | "low";
}

interface MultiMomentumData {
  assets: AssetMomentum[];
  goldMomentum: number;
  leaderAsset: string;
  insight: string;
  timestamp: string;
}

const TREND_META = {
  strong_up:   { label: "Strong Up",   color: "#34d399", icon: "⬆⬆" },
  up:          { label: "Up",           color: "#86efac", icon: "⬆"  },
  neutral:     { label: "Neutral",      color: "#f5c451", icon: "→"  },
  down:        { label: "Down",         color: "#fca5a5", icon: "⬇"  },
  strong_down: { label: "Strong Down",  color: "#f87171", icon: "⬇⬇" },
};

const CORR_META = {
  positive: { label: "↑ with Gold",  color: "#34d399" },
  inverse:  { label: "↓ with Gold",  color: "#f87171" },
  low:      { label: "Low Corr",     color: "#94a3b8" },
};

function fmtRet(n: number | null): string {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function ReturnCell({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "rgba(175,185,215,0.3)" }}>—</span>;
  const color = value >= 0 ? "#34d399" : "#f87171";
  return <span style={{ color }}>{value >= 0 ? "+" : ""}{value.toFixed(2)}%</span>;
}

function MomentumBar({ value, corr }: { value: number; corr: AssetMomentum["goldCorrelation"] }) {
  const color = value >= 65 ? "#34d399" : value <= 35 ? "#f87171" : "#f5c451";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full"
          style={{ width: `${value}%`, background: color, transition: "width 0.7s ease" }} />
      </div>
      <span className="text-[10px] w-6 text-right font-mono" style={{ color }}>{value}</span>
    </div>
  );
}

export default function MultiMomentumPage() {
  const { t } = useI18n();
  const [data, setData] = useState<MultiMomentumData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/multi-momentum")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading momentum data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const goldAsset = data.assets.find(a => a.symbol === "GC=F");
  const goldColor = data.goldMomentum >= 65 ? "#34d399" : data.goldMomentum <= 35 ? "#f87171" : "#f5c451";

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navMultiMomentum")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Cross-Asset Momentum Dashboard · Gold + 9 Correlated Markets · 1D / 5D / 20D / 60D Returns
        </p>
      </div>

      {/* Gold momentum hero */}
      <div className="rounded-xl p-5 flex gap-5 items-center"
        style={{ background: `rgba(${data.goldMomentum >= 65 ? "52,211,153" : data.goldMomentum <= 35 ? "248,113,113" : "245,196,81"},0.06)`, border: `1px solid rgba(${data.goldMomentum >= 65 ? "52,211,153" : data.goldMomentum <= 35 ? "248,113,113" : "245,196,81"},0.15)` }}>
        <div className="text-4xl">🪙</div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>GOLD MOMENTUM SCORE</div>
          <div className="text-3xl font-black" style={{ color: goldColor }}>{data.goldMomentum}<span className="text-lg">/100</span></div>
          <div className="mt-1.5">
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${data.goldMomentum}%`, background: goldColor }} />
            </div>
          </div>
          <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.insight}</p>
        </div>
      </div>

      {/* Returns summary for gold */}
      {goldAsset && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "1D",  val: goldAsset.returns.d1  },
            { label: "5D",  val: goldAsset.returns.d5  },
            { label: "20D", val: goldAsset.returns.d20 },
            { label: "60D", val: goldAsset.returns.d60 },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[9px] mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>Gold {item.label}</div>
              <div className="text-sm font-black">
                <ReturnCell value={item.val} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full asset table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.6)" }}>
          ALL ASSETS — MOMENTUM RANKING
        </div>
        <div className="space-y-0">
          {data.assets
            .slice()
            .sort((a, b) => b.momentum - a.momentum)
            .map((asset) => {
              const trend = TREND_META[asset.trend];
              const corr = CORR_META[asset.goldCorrelation];
              const isGold = asset.symbol === "GC=F";
              return (
                <div key={asset.symbol}
                  className="px-4 py-3"
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    background: isGold ? "rgba(245,196,81,0.04)" : undefined,
                  }}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="w-20 shrink-0">
                      <div className="text-xs font-bold" style={{ color: isGold ? "#f5c451" : "rgba(255,255,255,0.75)" }}>
                        {asset.name}
                      </div>
                      <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>{asset.symbol}</div>
                    </div>
                    <div className="flex-1">
                      <MomentumBar value={asset.momentum} corr={asset.goldCorrelation} />
                    </div>
                    <div className="w-14 text-right shrink-0">
                      <div className="text-[10px] font-bold" style={{ color: trend.color }}>
                        {trend.icon} {trend.label}
                      </div>
                    </div>
                    <div className="w-16 text-right shrink-0">
                      <span className="text-[8px] px-1.5 py-0.5 rounded"
                        style={{ background: `rgba(${corr.color === "#34d399" ? "52,211,153" : "248,113,113"},0.1)`, color: corr.color }}>
                        {corr.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-[9px]">
                    <span style={{ color: "rgba(175,185,215,0.4)" }}>1D: <ReturnCell value={asset.returns.d1} /></span>
                    <span style={{ color: "rgba(175,185,215,0.4)" }}>5D: <ReturnCell value={asset.returns.d5} /></span>
                    <span style={{ color: "rgba(175,185,215,0.4)" }}>20D: <ReturnCell value={asset.returns.d20} /></span>
                    <span style={{ color: "rgba(175,185,215,0.4)" }}>60D: <ReturnCell value={asset.returns.d60} /></span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-2"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold mb-2" style={{ color: "rgba(175,185,215,0.6)" }}>HOW TO USE CROSS-ASSET MOMENTUM</div>
        {[
          { icon: "🟢", text: "Positive corr assets trending up while gold trends up = confirmation. Multiple aligned signals = stronger trend." },
          { icon: "🔴", text: "Inverse corr assets (DXY, Yields, SPY) trending down while gold trends up = bullish confluence for gold." },
          { icon: "⚠️", text: "Divergence: gold up but DXY also up = unusual. Watch for reversal when the divergence resolves." },
          { icon: "🔮", text: "Silver often leads gold at turning points. A breakout in Silver before gold can signal the next gold move." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Momentum scores computed from Yahoo Finance 3-month OHLC data · 10-min cache · Momentum = weighted composite of 4 lookback periods · Not financial advice
      </p>
    </div>
  );
}
