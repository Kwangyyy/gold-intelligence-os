"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { GlobalYieldsPayload, CountryYield, YieldSpread } from "@/app/api/global-yields/route";

const IMPL_COLOR = { bullish: "#34d399", neutral: "#f5c451", bearish: "#f87171" };

export default function GlobalYieldsPage() {
  const { tier } = useTier();
  const [data, setData] = useState<GlobalYieldsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/global-yields", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/global-yields")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Fetching global yields…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🌐 Global Bond Yields"
        subtitle="G6 government 10Y yields, real rates, and their implications for gold"
      />

      {/* ── Summary Header ─── */}
      <div className="panel px-5 py-4 flex items-center gap-4"
        style={{ border: `1px solid ${data.biasColor}30`, background: data.biasColor + "06" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
          style={{ background: data.biasColor + "18", border: `2px solid ${data.biasColor}40`, color: data.biasColor }}>
          {data.overallGoldBias === "bullish" ? "↑" : data.overallGoldBias === "bearish" ? "↓" : "→"}
        </div>
        <div className="flex-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Yield Bias</div>
          <div className="text-base font-black capitalize" style={{ color: data.biasColor }}>{data.overallGoldBias} for gold</div>
          <div className="text-[8px] mt-0.5 leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.keyTheme}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
          <div className="text-lg font-black" style={{ color: "#f5c451" }}>
            ${data.goldPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </div>
          <div className="text-[8px]" style={{ color: data.goldChange1DPct >= 0 ? "#34d399" : "#f87171" }}>
            {data.goldChange1DPct >= 0 ? "+" : ""}{data.goldChange1DPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* ── DXY vs Yields Context ─── */}
      <div className="panel px-5 py-3">
        <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>💱 Dollar vs Yields</div>
        <p className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.dollarsVsYields}</p>
      </div>

      {/* ── Yield Bars ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 10Y Government Bond Yields
        </div>
        <div className="grid grid-cols-12 gap-1 px-1 text-[7px] uppercase tracking-widest"
          style={{ color: "rgba(175,185,215,0.25)" }}>
          <div className="col-span-4">Country</div>
          <div className="col-span-2 text-right">10Y %</div>
          <div className="col-span-2 text-right">1D Δ</div>
          <div className="col-span-2 text-right">Real %</div>
          <div className="col-span-2 text-center">Gold</div>
        </div>

        {data.yields.map((y: CountryYield) => {
          const implColor = IMPL_COLOR[y.goldImplication];
          const maxYield = 6;
          const pct = Math.min((y.yield10Y / maxYield) * 100, 100);
          return (
            <div key={y.code} className="space-y-1">
              <div className="grid grid-cols-12 gap-1 items-center px-1">
                <div className="col-span-4 flex items-center gap-1.5">
                  <span className="text-base shrink-0">{y.flag}</span>
                  <div>
                    <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{y.code}</div>
                    <div className="text-[6px]" style={{ color: "rgba(175,185,215,0.3)" }}>{y.country}</div>
                  </div>
                </div>
                <div className="col-span-2 text-[9px] font-black text-right" style={{ color: "#f5c451" }}>
                  {y.yield10Y.toFixed(2)}%
                </div>
                <div className="col-span-2 text-[8px] font-bold text-right"
                  style={{ color: y.change1D > 0 ? "#f87171" : "#34d399" }}>
                  {y.change1D > 0 ? "+" : ""}{y.change1D.toFixed(2)}
                </div>
                <div className="col-span-2 text-[8px] text-right"
                  style={{ color: y.realYield !== null ? (y.realYield < 0 ? "#34d399" : y.realYield > 2 ? "#f87171" : "#9ca3af") : "rgba(175,185,215,0.25)" }}>
                  {y.realYield !== null ? `${y.realYield.toFixed(1)}%` : "N/A"}
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[7px] px-1 py-0.5 rounded font-bold"
                    style={{ background: implColor + "18", color: implColor }}>
                    {y.goldImplication === "bullish" ? "↑" : y.goldImplication === "bearish" ? "↓" : "→"}
                  </span>
                </div>
              </div>
              {/* Yield bar */}
              <div className="mx-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: implColor + "50" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Spreads ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📐 Key Yield Spreads
        </div>
        {data.spreads.map((s: YieldSpread) => {
          const bps = s.spread;
          const spreadColor = Math.abs(bps) > 200 ? "#f87171" : Math.abs(bps) > 100 ? "#f5c451" : "#34d399";
          return (
            <div key={s.pair} className="rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{s.pair}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] capitalize px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.5)" }}>
                    {s.direction}
                  </span>
                  <span className="text-[10px] font-black" style={{ color: spreadColor }}>
                    {bps > 0 ? "+" : ""}{bps.toFixed(0)} bps
                  </span>
                </div>
              </div>
              <div className="text-[8px] mt-1" style={{ color: "rgba(175,185,215,0.4)" }}>{s.goldImplication}</div>
            </div>
          );
        })}
      </div>

      {/* ── Education ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📚 Yield-Gold Relationship
        </div>
        {[
          { rule: "Rising US real yields", impact: "Bearish for gold — increases opportunity cost of holding non-yielding asset" },
          { rule: "Falling real yields / negative real yields", impact: "Bullish for gold — gold becomes attractive vs bonds" },
          { rule: "Inverted US yield curve", impact: "Initially bearish but recession fear supports gold safe-haven demand" },
          { rule: "Wide US-DE spread", impact: "Supports USD vs EUR — indirect gold headwind via dollar strength" },
          { rule: "BoJ yield curve control abandonment", impact: "Global yield shock risk — temporary gold sell-off then rally on uncertainty" },
        ].map(item => (
          <div key={item.rule} className="flex gap-2 text-[8px]">
            <span className="font-bold shrink-0" style={{ color: "#c084fc" }}>↗</span>
            <div>
              <span className="font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{item.rule}: </span>
              <span style={{ color: "rgba(175,185,215,0.4)" }}>{item.impact}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Intl yields are estimates · Not financial advice · Updates every 30 min
      </div>
    </div>
  );
}
