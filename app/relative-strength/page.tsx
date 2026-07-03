"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { RelativeStrengthPayload, AssetPerformance } from "@/app/api/relative-strength/route";

const CAT_COLOR: Record<string, string> = {
  "Precious Metal":  "#f5c451",
  "Industrial Metal": "#fb923c",
  "Energy": "#ef4444",
  "Equities": "#c084fc",
  "Bonds": "#60a5fa",
  "Currency": "#34d399",
  "Crypto": "#f97316",
  "Gold ETF": "#fde68a",
  "Volatility": "#f87171",
  "Rates": "#a78bfa",
};

const RS_ICON: Record<string, string> = {
  strong_outperform: "🏆",
  outperform: "📈",
  neutral: "📊",
  underperform: "📉",
  strong_underperform: "⚠️",
};

type SortKey = "rank1M" | "change1M" | "change3M" | "vsGold1M";

export default function RelativeStrengthPage() {
  const { tier } = useTier();
  const [data, setData] = useState<RelativeStrengthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("rank1M");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/relative-strength", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/relative-strength")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Fetching 20-asset performance data…</div>
    </div>
  );
  if (!data) return null;

  const sorted = [...data.assets].sort((a, b) => {
    if (sort === "rank1M") return a.rank1M - b.rank1M;
    if (sort === "change1M") return b.change1M - a.change1M;
    if (sort === "change3M") return b.change3M - a.change3M;
    return a.vsGold1M - b.vsGold1M;  // vsGold1M: most underperforming vs gold first
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="📊 Gold Relative Strength"
        subtitle="Gold performance vs 20 global assets across multiple timeframes — rank and context"
      />

      {/* ── RS Signal ─── */}
      <div className="panel px-5 py-4 flex items-center gap-4"
        style={{ border: `1px solid ${data.rsColor}30`, background: data.rsColor + "06" }}>
        <div className="text-3xl">{RS_ICON[data.rsSignal]}</div>
        <div className="flex-1 space-y-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Relative Strength</div>
          <div className="text-base font-black" style={{ color: data.rsColor }}>{data.rsLabel}</div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.rsDescription}</div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Rank (1M)</div>
          <div className="text-xl font-black" style={{ color: data.rsColor }}>
            #{data.goldRank1M}
          </div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>of {data.totalAssets}</div>
        </div>
      </div>

      {/* ── Gold Summary ─── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "1W", value: data.goldChange1W },
          { label: "1M", value: data.goldChange1M },
          { label: "3M", value: data.goldChange3M },
          { label: "6M", value: data.goldChange6M },
        ].map(p => (
          <div key={p.label} className="panel px-3 py-3 text-center">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold {p.label}</div>
            <div className="text-lg font-black" style={{ color: p.value >= 0 ? "#34d399" : "#f87171" }}>
              {p.value >= 0 ? "+" : ""}{p.value.toFixed(1)}%
            </div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              Beats {p.label === "1M" ? data.goldOutperformsCount1M : data.goldOutperformsCount3M}/{data.totalAssets - 1} assets
            </div>
          </div>
        ))}
      </div>

      {/* ── Sort Controls ─── */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "rank1M" as SortKey, label: "Rank (1M)" },
          { key: "change1M" as SortKey, label: "1M Return" },
          { key: "change3M" as SortKey, label: "3M Return" },
          { key: "vsGold1M" as SortKey, label: "vs Gold (1M)" },
        ]).map(s => (
          <button key={s.key} onClick={() => setSort(s.key)}
            className="px-3 py-1 rounded-full text-[7px] uppercase tracking-wider transition-all"
            style={{
              background: sort === s.key ? "#f5c45120" : "rgba(255,255,255,0.03)",
              border: `1px solid ${sort === s.key ? "#f5c451" : "rgba(255,255,255,0.08)"}`,
              color: sort === s.key ? "#f5c451" : "rgba(175,185,215,0.4)",
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Asset Table ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 gap-y-0.5 items-center text-[7px] uppercase tracking-wider pb-2"
          style={{ color: "rgba(175,185,215,0.25)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span>#</span>
          <span>Asset</span>
          <span className="text-right">1M</span>
          <span className="text-right">3M</span>
          <span className="text-right">vs Gold 1M</span>
        </div>
        {sorted.map((a: AssetPerformance) => {
          const isGold = a.symbol === "GC=F";
          const catColor = CAT_COLOR[a.category] ?? "#f5c451";
          return (
            <div key={a.symbol} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 items-center py-1.5 rounded-lg px-2"
              style={{ background: isGold ? "#f5c45108" : "transparent", border: isGold ? "1px solid #f5c45125" : "1px solid transparent" }}>
              <span className="text-[8px] font-black w-5 text-center" style={{ color: isGold ? "#f5c451" : "rgba(175,185,215,0.3)" }}>
                {a.rank1M}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: catColor }} />
                  <span className="text-[8px] font-bold truncate" style={{ color: isGold ? "#f5c451" : "rgba(255,255,255,0.55)" }}>
                    {a.name}
                  </span>
                </div>
                <div className="text-[6px]" style={{ color: catColor + "80" }}>{a.category}</div>
              </div>
              <span className="text-[8px] font-bold text-right tabular-nums"
                style={{ color: a.change1M >= 0 ? "#34d399" : "#f87171" }}>
                {a.change1M >= 0 ? "+" : ""}{a.change1M.toFixed(1)}%
              </span>
              <span className="text-[8px] text-right tabular-nums"
                style={{ color: a.change3M >= 0 ? "#34d399" : "#f87171" }}>
                {a.change3M >= 0 ? "+" : ""}{a.change3M.toFixed(1)}%
              </span>
              <span className="text-[8px] font-bold text-right tabular-nums"
                style={{ color: isGold ? "rgba(175,185,215,0.25)" : a.vsGold1M < 0 ? "#34d399" : "#f87171" }}>
                {isGold ? "—" : (a.vsGold1M < 0 ? "+" : "") + (- a.vsGold1M).toFixed(1) + "%"}
              </span>
            </div>
          );
        })}
        <div className="text-[7px] pt-2" style={{ color: "rgba(175,185,215,0.2)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          &quot;vs Gold 1M&quot; column shows how much gold OUTPERFORMS that asset (+ = gold better). Highlighted row = Gold.
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · 20-asset universe · 1Y daily data · Not financial advice
      </div>
    </div>
  );
}
