"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { FlowTrackerPayload, AssetFlow } from "@/app/api/flow-tracker/route";

const FLOW_COLOR: Record<string, string> = {
  bullish: "#34d399",
  neutral: "#f5c451",
  bearish: "#f87171",
};

function FlowBar({ score }: { score: number }) {
  const color = score >= 60 ? "#34d399" : score >= 40 ? "#f5c451" : "#f87171";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color + "90" }} />
      </div>
      <span className="text-[9px] font-black w-6 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

export default function FlowTrackerPage() {
  const { tier } = useTier();
  const [data, setData] = useState<FlowTrackerPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/flow-tracker", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/flow-tracker")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Tracking asset flows…</div>
    </div>
  );
  if (!data) return null;

  const scoreColor = data.summary.flowScore >= 60 ? "#34d399" : data.summary.flowScore >= 40 ? "#f5c451" : "#f87171";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🌊 Multi-Asset Flow Tracker"
        subtitle="Cross-asset signals for gold — DXY, yields, VIX, crypto, commodities"
      />

      {/* ── Flow Score ────────────────────────────────────────── */}
      <div className="panel px-5 py-5">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="text-center shrink-0">
            <div className="text-4xl font-black" style={{ color: scoreColor }}>{data.summary.flowScore}</div>
            <div className="text-[8px] uppercase tracking-widest mt-1" style={{ color: "rgba(175,185,215,0.3)" }}>
              Flow Score
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3 text-[9px]">
              <span className="font-bold" style={{ color: "#34d399" }}>↑ {data.summary.totalBullishFlows} bullish</span>
              <span style={{ color: "#f87171" }}>↓ {data.summary.totalBearishFlows} bearish</span>
            </div>
            <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
              {data.summary.dominantTheme}
            </div>
            <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>
              {data.flowNarrative}
            </div>
          </div>
        </div>
      </div>

      {/* ── Asset Table ───────────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-2">
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Asset Flow Analysis
        </div>

        {/* Header */}
        <div className="grid grid-cols-12 gap-1 px-2 text-[7px] uppercase tracking-widest mb-1"
          style={{ color: "rgba(175,185,215,0.25)" }}>
          <div className="col-span-4">Asset</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">1D%</div>
          <div className="col-span-2 text-right">Relation</div>
          <div className="col-span-2 text-right">Signal</div>
        </div>

        {data.assets.map((asset: AssetFlow) => {
          const flowColor = FLOW_COLOR[asset.flowToGold];
          const chgColor = (asset.change1D ?? 0) >= 0 ? "#34d399" : "#f87171";
          return (
            <div key={asset.symbol}
              className="group rounded-xl px-3 py-2.5 grid grid-cols-12 gap-1 items-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                <span className="text-sm shrink-0">{asset.icon}</span>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold truncate" style={{ color: "rgba(255,255,255,0.7)" }}>{asset.name}</div>
                  <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>{asset.symbol}</div>
                </div>
              </div>
              <div className="col-span-2 text-right">
                <div className="text-[9px] font-black" style={{ color: "#f5c451" }}>
                  {asset.price
                    ? asset.price >= 1000
                      ? `$${asset.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : `${asset.price.toFixed(2)}`
                    : "—"
                  }
                </div>
              </div>
              <div className="col-span-2 text-right">
                <div className="text-[9px] font-bold" style={{ color: chgColor }}>
                  {asset.change1D !== null
                    ? `${asset.change1D >= 0 ? "+" : ""}${asset.change1D.toFixed(2)}%`
                    : "—"
                  }
                </div>
              </div>
              <div className="col-span-2 text-right">
                <div className="text-[7px] capitalize" style={{ color: "rgba(175,185,215,0.35)" }}>
                  {asset.goldRelation.replace("-", " ")}
                </div>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded capitalize"
                  style={{ background: flowColor + "18", color: flowColor }}>
                  {asset.flowToGold}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Relation Guide ────────────────────────────────────── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
          💡 Cross-Asset Relationships
        </div>
        {[
          { label: "Inverse",          color: "#f87171", desc: "DXY/yields — when these fall, gold rises. Strong negative correlation." },
          { label: "Direct",           color: "#34d399", desc: "Silver/oil — tend to move with gold, confirming commodity trend." },
          { label: "Safe-Haven Alt",   color: "#c084fc", desc: "Bitcoin/JPY — compete with gold for capital; outperformance may reduce gold demand." },
          { label: "Inflation Hedge",  color: "#f5c451", desc: "Copper/commodities — rising inflation proxies support the gold narrative." },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-3 text-[8px]">
            <span className="font-black shrink-0 w-24" style={{ color: r.color }}>{r.label}</span>
            <span style={{ color: "rgba(175,185,215,0.4)" }}>{r.desc}</span>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Live data from Yahoo Finance · Updates every 10 min
      </div>
    </div>
  );
}
