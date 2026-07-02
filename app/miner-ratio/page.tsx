"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { MinerRatioPayload, MinerEntry } from "@/app/api/miner-ratio/route";

const SIGNAL_LABEL: Record<string, string> = {
  miners_lead: "Miners Leading Gold",
  gold_leads:  "Gold Leading Miners",
  diverging:   "Divergence Warning",
  aligned:     "Aligned Movement",
};

export default function MinerRatioPage() {
  const { tier } = useTier();
  const [data, setData] = useState<MinerRatioPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/miner-ratio", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/miner-ratio")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Loading miner data…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="⛏️ Gold Miner Ratios"
        subtitle="GDX/GLD ratio, junior vs senior miners, and beta vs gold — miners often lead gold moves"
      />

      {/* ── Signal Banner ─── */}
      <div className="panel px-5 py-4 flex items-center gap-4"
        style={{ border: `1px solid ${data.signalColor}30`, background: data.signalColor + "06" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black"
          style={{ background: data.signalColor + "18", border: `2px solid ${data.signalColor}40`, color: data.signalColor }}>
          {data.signalBias === "miners_lead" ? "▲" : data.signalBias === "diverging" ? "⚡" : data.signalBias === "gold_leads" ? "↗" : "↔"}
        </div>
        <div className="flex-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Current Signal</div>
          <div className="text-base font-black" style={{ color: data.signalColor }}>{SIGNAL_LABEL[data.signalBias]}</div>
          <div className="text-[8px] mt-0.5 leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.signalDescription}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
          <div className="text-lg font-black" style={{ color: "#f5c451" }}>
            ${data.goldPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </div>
        </div>
      </div>

      {/* ── Key Ratio Metrics ─── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "GDX / GLD Ratio",
            value: data.gdxGldRatio.toFixed(3),
            sub: "Senior miners vs gold ETF",
            color: data.gdxGldRatio > 0.28 ? "#34d399" : data.gdxGldRatio < 0.20 ? "#f87171" : "#f5c451",
          },
          {
            label: "GDXJ / GDX Ratio",
            value: data.gdxjGdxRatio.toFixed(3),
            sub: "Juniors vs seniors",
            color: data.gdxjGdxRatio > 0.65 ? "#c084fc" : "#9ca3af",
          },
          {
            label: "GDX / Gold %",
            value: `${data.gdxPriceVsGold.toFixed(2)}%`,
            sub: "GDX price as % of gold",
            color: "#60a5fa",
          },
        ].map(m => (
          <div key={m.label} className="panel px-4 py-4 space-y-1">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{m.label}</div>
            <div className="text-2xl font-black" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Key Insight ─── */}
      <div className="panel px-5 py-4">
        <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>💡 Key Insight</div>
        <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>{data.keyInsight}</div>
      </div>

      {/* ── Miner Table ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Individual Miner Performance vs Gold
        </div>

        {/* Header */}
        <div className="grid grid-cols-12 gap-1 px-2 text-[7px] uppercase tracking-widest"
          style={{ color: "rgba(175,185,215,0.25)" }}>
          <div className="col-span-4">Miner</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">1D %</div>
          <div className="col-span-2 text-right">Ratio 1W</div>
          <div className="col-span-2 text-right">Beta</div>
        </div>

        {data.miners.map((m: MinerEntry) => {
          const dayColor = m.change1DPct >= 0 ? "#34d399" : "#f87171";
          const ratioColor = m.outperforming ? "#34d399" : "#f87171";
          return (
            <div key={m.symbol} className="rounded-xl px-3 py-3 grid grid-cols-12 gap-1 items-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="col-span-4 flex items-center gap-2">
                <span className="text-base shrink-0">{m.icon}</span>
                <div>
                  <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{m.symbol}</div>
                  <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{m.name.split(" ").slice(0, 2).join(" ")}</div>
                </div>
              </div>
              <div className="col-span-2 text-[9px] font-black text-right" style={{ color: "rgba(255,255,255,0.6)" }}>
                ${m.price.toFixed(2)}
              </div>
              <div className="col-span-2 text-[8px] font-bold text-right" style={{ color: dayColor }}>
                {m.change1DPct >= 0 ? "+" : ""}{m.change1DPct.toFixed(2)}%
              </div>
              <div className="col-span-2 text-[8px] font-bold text-right" style={{ color: ratioColor }}>
                {m.ratioChange1W >= 0 ? "+" : ""}{m.ratioChange1W.toFixed(1)}%
              </div>
              <div className="col-span-2 text-right">
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded"
                  style={{
                    background: m.betaVsGold > 1.5 ? "rgba(192,132,252,0.15)" : "rgba(245,196,81,0.1)",
                    color: m.betaVsGold > 1.5 ? "#c084fc" : "#f5c451",
                  }}>
                  {m.betaVsGold.toFixed(1)}β
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Historical Context ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📚 Historical Context
        </div>
        <p className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.historicalContext}</p>
        <div className="space-y-1.5 pt-1">
          {[
            { rule: "Miners leading up", implication: "Gold tends to follow within 1-3 trading days — strong bull signal" },
            { rule: "Miners lagging gold", implication: "Either gold move is unsustainable or miners are cheap relative to gold" },
            { rule: "GDXJ > GDX performance", implication: "Risk-on within gold sector; bullish sentiment for overall gold" },
            { rule: "High beta (>1.5×)", implication: "Use miners for leveraged exposure when conviction is high" },
          ].map(item => (
            <div key={item.rule} className="flex gap-3 text-[8px]">
              <span className="font-bold shrink-0" style={{ color: "#f5c451" }}>{item.rule}:</span>
              <span style={{ color: "rgba(175,185,215,0.4)" }}>{item.implication}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Data from Yahoo Finance · Not financial advice
      </div>
    </div>
  );
}
