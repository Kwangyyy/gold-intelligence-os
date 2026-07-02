"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface PriceLevel {
  price: number;
  oiEstimate: number;
  type: "support" | "resistance" | "neutral";
  isCurrentLevel: boolean;
  isMajor: boolean;
  label?: string;
}

interface PositionHeatData {
  spot: number;
  dailyHigh: number;
  dailyLow: number;
  levels: PriceLevel[];
  strongestSupport: PriceLevel;
  strongestResistance: PriceLevel;
  liquidityGapAbove: number;
  liquidityGapBelow: number;
  insight: string;
  timestamp: string;
}

function heatColor(oi: number): string {
  if (oi >= 70) return "#f87171";
  if (oi >= 50) return "#fb923c";
  if (oi >= 30) return "#f5c451";
  if (oi >= 15) return "#86efac";
  return "rgba(255,255,255,0.1)";
}

export default function PositionHeatPage() {
  const { t } = useI18n();
  const [data, setData] = useState<PositionHeatData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/position-heat")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Mapping position heat…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  // Show levels sorted high→low for the heatmap display
  const levelsDesc = [...data.levels].sort((a, b) => b.price - a.price);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navPositionHeat")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Open Interest Heatmap · Price Level Liquidity · Stop Cluster Zones
        </p>
      </div>

      {/* Key levels summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Spot Price", value: `$${data.spot.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#f5c451" },
          { label: "Strongest Support", value: `$${data.strongestSupport.price}`, color: "#34d399" },
          { label: "Strongest Resistance", value: `$${data.strongestResistance.price}`, color: "#f87171" },
          { label: "Liquidity Gap Above", value: `$${data.liquidityGapAbove}`, color: "#c084fc" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>{s.label}</div>
            <div className="text-base font-black" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Insight */}
      <div className="rounded-xl p-4 flex gap-3"
        style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.12)" }}>
        <span className="text-lg">💡</span>
        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>{data.insight}</p>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl p-5"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold mb-1" style={{ color: "rgba(175,185,215,0.6)" }}>
          PRICE LEVEL HEAT MAP — OI CONCENTRATION
        </div>
        <div className="text-[9px] mb-4" style={{ color: "rgba(175,185,215,0.3)" }}>
          Higher heat = more open interest / stop clusters at that price level
        </div>

        <div className="space-y-0.5">
          {levelsDesc.map((lvl) => {
            const isSpot = lvl.isCurrentLevel;
            const color = isSpot ? "#f5c451" : lvl.type === "resistance" ? "#f87171" : "#34d399";
            const barW = `${lvl.oiEstimate}%`;

            return (
              <div key={lvl.price}
                className="flex items-center gap-2"
                style={isSpot ? {
                  background: "rgba(245,196,81,0.08)",
                  borderRadius: 6,
                  padding: "2px 4px",
                  margin: "-2px -4px",
                  border: "1px solid rgba(245,196,81,0.2)",
                } : {}}>
                <div className="w-16 text-[10px] font-mono text-right shrink-0"
                  style={{ color: isSpot ? "#f5c451" : "rgba(175,185,215,0.6)", fontWeight: lvl.isMajor ? 700 : 400 }}>
                  ${lvl.price.toLocaleString()}
                  {isSpot && <span className="ml-1 text-[8px] font-bold">◄</span>}
                </div>
                <div className="flex-1 h-3.5 relative rounded overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded transition-all duration-300"
                    style={{
                      width: barW,
                      background: isSpot
                        ? "rgba(245,196,81,0.7)"
                        : heatColor(lvl.oiEstimate),
                    }} />
                </div>
                <div className="w-8 text-[9px] text-right shrink-0"
                  style={{ color: "rgba(175,185,215,0.35)" }}>{lvl.oiEstimate}</div>
                {lvl.label && (
                  <div className="text-[8px] shrink-0 w-10"
                    style={{ color: lvl.isMajor ? color : "transparent" }}>
                    {lvl.type === "resistance" ? "RESIST" : lvl.type === "support" ? "SUPP" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-[9px]">
          {[
            { color: "#f87171", label: "Extreme OI (70+)" },
            { color: "#fb923c", label: "High OI (50-70)" },
            { color: "#f5c451", label: "Medium OI (30-50)" },
            { color: "#86efac", label: "Low OI (15-30)" },
            { color: "rgba(255,255,255,0.15)", label: "Thin / Gap (<15)" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ background: item.color }} />
              <span style={{ color: "rgba(175,185,215,0.45)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-3"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>HOW TO USE THE HEATMAP</div>
        {[
          { icon: "🔴", text: "High OI at resistance: many sell orders/stops clustered → price may stall or reverse here." },
          { icon: "🟢", text: "High OI at support: many buy orders/stops → price may bounce or stop falling here." },
          { icon: "⬜", text: "Thin liquidity zones (white/gaps): if price enters, it can move quickly with little friction — watch for fast runs." },
          { icon: "🎯", text: "Round numbers ($3300, $3350…) attract the most OI — these act as price magnets and decision points." },
          { icon: "⚡", text: "Stop raids: smart money targets areas with concentrated stops (above recent highs, below lows) to generate liquidity." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-sm shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        OI concentration modeled from round-number attraction, stop cluster heuristics, and Yahoo Finance price data · Simulated — not actual COMEX OI data · Not financial advice
      </p>
    </div>
  );
}
