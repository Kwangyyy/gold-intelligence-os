"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface OwnershipSegment {
  name: string;
  icon: string;
  totalTonnes: number;
  pctOfAll: number;
  trend: "increasing" | "stable" | "decreasing";
  trendNote: string;
  goldImplication: string;
  color: string;
}

interface TopHolder {
  rank: number;
  name: string;
  flag: string;
  tonnes: number;
  pctOfReserves: number;
  trend: "buying" | "stable" | "selling";
}

interface GoldOwnershipData {
  totalAboveGroundTonnes: number;
  totalInvestmentTonnes: number;
  segments: OwnershipSegment[];
  topCentralBanks: TopHolder[];
  topEtfs: { name: string; tonnes: number; change1y: number }[];
  demandSignal: "strong" | "moderate" | "neutral" | "weak";
  insight: string;
  timestamp: string;
}

const DEMAND_META = {
  strong:   { label: "Strong Demand",   color: "#34d399" },
  moderate: { label: "Moderate Demand", color: "#86efac" },
  neutral:  { label: "Neutral",         color: "#f5c451" },
  weak:     { label: "Weak Demand",     color: "#f87171" },
};

const TREND_META = {
  increasing: { label: "↑ Increasing", color: "#34d399" },
  stable:     { label: "→ Stable",     color: "#f5c451" },
  decreasing: { label: "↓ Decreasing", color: "#f87171" },
};

const CB_TREND_META = {
  buying:  { label: "Buying",  color: "#34d399" },
  stable:  { label: "Stable",  color: "#f5c451" },
  selling: { label: "Selling", color: "#f87171" },
};

export default function GoldOwnershipPage() {
  const { t } = useI18n();
  const [data, setData] = useState<GoldOwnershipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/gold-ownership")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading gold ownership data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const demand = DEMAND_META[data.demandSignal];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navGoldOwnership")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Global Gold Ownership Structure · Who Holds the World&apos;s Gold · Demand Trends
        </p>
      </div>

      {/* Summary hero */}
      <div className="rounded-xl p-5" style={{ background: "rgba(245,196,81,0.05)", border: "1px solid rgba(245,196,81,0.15)" }}>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>TOTAL ABOVE-GROUND</div>
            <div className="text-xl font-black" style={{ color: "#f5c451" }}>
              {(data.totalAboveGroundTonnes / 1000).toFixed(0)}k
              <span className="text-sm ml-1">tonnes</span>
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>INVESTMENT GOLD</div>
            <div className="text-xl font-black" style={{ color: "#60a5fa" }}>
              {(data.totalInvestmentTonnes / 1000).toFixed(0)}k
              <span className="text-sm ml-1">tonnes (~40%)</span>
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>DEMAND SIGNAL</div>
            <div className="text-sm font-black" style={{ color: demand.color }}>{demand.label}</div>
          </div>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.insight}</p>
      </div>

      {/* Segment breakdown */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          OWNERSHIP BY SEGMENT
        </div>
        {data.segments.map((seg, i) => {
          const trend = TREND_META[seg.trend];
          const isOpen = expanded === seg.name;
          return (
            <div key={seg.name} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
              <button
                className="w-full px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : seg.name)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{seg.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>{seg.name}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${trend.color}15`, color: trend.color }}>
                        {trend.label}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${seg.pctOfAll}%`, background: seg.color }}
                      />
                    </div>
                  </div>
                  <div className="text-right w-20 shrink-0">
                    <div className="text-sm font-black" style={{ color: seg.color }}>{seg.pctOfAll.toFixed(1)}%</div>
                    <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                      {(seg.totalTonnes / 1000).toFixed(0)}k t
                    </div>
                  </div>
                  <span className="text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-3 space-y-2">
                  <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{seg.trendNote}</p>
                  <div className="rounded-lg p-3" style={{ background: `${seg.color}08`, border: `1px solid ${seg.color}20` }}>
                    <div className="text-[8px] font-bold mb-1" style={{ color: seg.color }}>GOLD IMPLICATION</div>
                    <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{seg.goldImplication}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Central Bank rankings */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          TOP CENTRAL BANK GOLD HOLDINGS (WGC 2024)
        </div>
        {data.topCentralBanks.map((cb, i) => {
          const cbTrend = CB_TREND_META[cb.trend];
          const barW = (cb.tonnes / data.topCentralBanks[0].tonnes) * 100;
          return (
            <div key={cb.name} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
              <div className="w-5 text-center text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>#{cb.rank}</div>
              <span className="text-base">{cb.flag}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>{cb.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${cbTrend.color}15`, color: cbTrend.color }}>
                    {cbTrend.label}
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${barW}%`, background: cb.trend === "buying" ? "#34d399" : "#f5c451" }} />
                </div>
              </div>
              <div className="text-right w-24 shrink-0">
                <div className="text-[10px] font-bold" style={{ color: "#f5c451" }}>{cb.tonnes.toLocaleString()}t</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{cb.pctOfReserves}% of reserves</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ETF holdings */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          MAJOR GOLD ETF HOLDINGS (approx. 2024)
        </div>
        {data.topEtfs.map((etf, i) => (
          <div key={etf.name} className="flex items-center gap-4 px-4 py-2.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
            <div className="flex-1">
              <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>{etf.name}</div>
              <div className="h-1 mt-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${(etf.tonnes / data.topEtfs[0].tonnes) * 100}%`, background: "#fb923c" }} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold" style={{ color: "#fb923c" }}>{etf.tonnes.toLocaleString()}t</div>
              <div className="text-[9px]" style={{ color: etf.change1y >= 0 ? "#34d399" : "#f87171" }}>
                {etf.change1y >= 0 ? "+" : ""}{etf.change1y}t 1Y
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Data from World Gold Council 2024 annual report · ETF flows from publicly available filings · Updated daily · Not financial advice
      </p>
    </div>
  );
}
