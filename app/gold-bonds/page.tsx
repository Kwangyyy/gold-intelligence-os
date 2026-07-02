"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { GoldBondsPayload, BondAsset } from "@/app/api/gold-bonds/route";

const REAL_YIELD_COLOR = { bullish: "#34d399", neutral: "#f5c451", bearish: "#f87171" };
const REAL_YIELD_LABEL = {
  bullish: "Low Real Yields — Gold Positive",
  neutral: "Neutral Real Yields",
  bearish: "High Real Yields — Gold Headwind",
};

function corrBar(corr: number) {
  const pct = ((corr + 1) / 2) * 100;
  const col = corr < -0.2 ? "#34d399" : corr > 0.4 ? "#f87171" : "#f5c451";
  return { pct, col };
}

export default function GoldBondsPage() {
  const { tier } = useTier();
  const [data, setData] = useState<GoldBondsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/gold-bonds", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/gold-bonds")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Analyzing gold-bond relationship…</div>
    </div>
  );
  if (!data) return null;

  const ryColor = REAL_YIELD_COLOR[data.realYieldSignal];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🏦 Gold vs Treasury Bonds"
        subtitle="How bond markets (real yields, duration) interact with gold — portfolio hedge analysis"
      />

      {/* ── Overall Signal ─── */}
      <div className="panel px-5 py-4 flex items-center gap-4"
        style={{ border: `1px solid ${data.overallColor}30`, background: data.overallColor + "06" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: data.overallColor + "18", border: `2px solid ${data.overallColor}40` }}>
          {data.overallSignal === "bonds_supportive" ? "🟢" : data.overallSignal === "bonds_headwind" ? "🔴" : "⚖️"}
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Bond Market Signal for Gold</div>
          <div className="text-base font-black" style={{ color: data.overallColor }}>{data.overallLabel}</div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.overallDesc}</div>
        </div>
      </div>

      {/* ── Key Metrics ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Gold", value: `$${data.goldPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            sub: `${data.goldChange1DPct >= 0 ? "+" : ""}${data.goldChange1DPct.toFixed(2)}% today`,
            color: "#f5c451",
          },
          {
            label: "TIP (Real Yield ETF)", value: `$${data.tipPrice.toFixed(1)}`,
            sub: `${data.tipChange1DPct >= 0 ? "+" : ""}${data.tipChange1DPct.toFixed(2)}% today`,
            color: ryColor,
          },
          {
            label: "Hedge Score", value: `${data.hedgeScore}/100`,
            sub: data.hedgeSignal,
            color: data.hedgeColor,
          },
          {
            label: "TLT vs Gold (1M)", value: `${data.tltGoldSpread1M >= 0 ? "+" : ""}${data.tltGoldSpread1M.toFixed(1)}%`,
            sub: data.tltGoldSpread1M > 0 ? "Bonds leading" : "Gold leading",
            color: data.tltGoldSpread1M > 0 ? "#c084fc" : "#f5c451",
          },
        ].map(m => (
          <div key={m.label} className="panel px-3 py-3 space-y-0.5">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{m.label}</div>
            <div className="text-lg font-black" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Real Yield Signal ─── */}
      <div className="panel px-5 py-4 space-y-2"
        style={{ border: `1px solid ${ryColor}20`, background: ryColor + "05" }}>
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>📡 Real Yield Signal (TIP ETF Proxy)</div>
        <div className="flex items-center gap-4">
          <div className="text-xl font-black" style={{ color: ryColor }}>{REAL_YIELD_LABEL[data.realYieldSignal]}</div>
        </div>
        <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>
          TIP ETF at ${data.tipPrice.toFixed(1)} — a proxy for real yields (TIPS price rises when real yields fall, gold bullish).
          Estimated real yield proxy: {data.realYieldProxy > 0 ? "+" : ""}{data.realYieldProxy.toFixed(1)}% (positive = headwind).
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>Bearish zone ($108)</div>
          <div className="flex-1 h-2 rounded-full relative" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="absolute top-0 left-0 h-full rounded-full" style={{
              width: `${Math.min(100, Math.max(0, ((data.tipPrice - 104) / (120 - 104)) * 100))}%`,
              background: `linear-gradient(90deg, #f87171 0%, #f5c451 40%, #34d399 100%)`,
            }} />
          </div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>Bullish zone ($115+)</div>
        </div>
      </div>

      {/* ── Bond-Gold Correlation Table ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Bond ETF Correlation with Gold
        </div>
        {data.bonds.map((b: BondAsset) => {
          const c30 = corrBar(b.corrWithGold30D);
          const c90 = corrBar(b.corrWithGold90D);
          return (
            <div key={b.symbol} className="rounded-xl px-4 py-3"
              style={{ background: b.implColor + "06", border: `1px solid ${b.implColor}18` }}>
              <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                <div>
                  <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>{b.name}</div>
                  <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>{b.duration} duration</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[8px] font-black" style={{ color: b.change1DPct >= 0 ? "#34d399" : "#f87171" }}>
                    {b.change1DPct >= 0 ? "+" : ""}{b.change1DPct.toFixed(2)}% today
                  </div>
                  <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                    {b.change1MPct >= 0 ? "+" : ""}{b.change1MPct.toFixed(1)}% 1M
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[7px] w-12 shrink-0" style={{ color: "rgba(175,185,215,0.3)" }}>30D corr</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full" style={{ width: `${c30.pct}%`, background: c30.col + "80" }} />
                  </div>
                  <span className="text-[8px] font-bold w-8 text-right" style={{ color: c30.col }}>{b.corrWithGold30D.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[7px] w-12 shrink-0" style={{ color: "rgba(175,185,215,0.3)" }}>90D corr</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full" style={{ width: `${c90.pct}%`, background: c90.col + "50" }} />
                  </div>
                  <span className="text-[8px] font-bold w-8 text-right" style={{ color: c90.col }}>{b.corrWithGold90D.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-[7px] mt-1.5" style={{ color: b.implColor }}>{b.implication}</div>
            </div>
          );
        })}
      </div>

      {/* ── Bond Replacement Note ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>💼 Gold-Bond Portfolio Rotation</div>
        <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.bondReplacementNote}</p>
        <div className="flex items-center gap-3 mt-1">
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>
            Blended bond-gold correlation (90D):
          </div>
          <div className="text-[9px] font-black" style={{ color: corrBar(data.goldBondPortfolioCorr).col }}>
            {data.goldBondPortfolioCorr.toFixed(2)}
          </div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            {Math.abs(data.goldBondPortfolioCorr) < 0.2 ? "uncorrelated" : data.goldBondPortfolioCorr < 0 ? "negatively correlated — excellent hedge" : "positively correlated — reduced hedge benefit"}
          </div>
        </div>
      </div>

      {/* ── Education ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>📚 Bond Market Fundamentals for Gold Traders</div>
        {[
          { case: "Real yields falling (TIP rising)", action: "Historically the strongest bullish driver for gold — reduces opportunity cost of holding non-yielding asset" },
          { case: "Long bonds rallying (TLT rising)", action: "Often coincides with gold strength in risk-off environments — both benefit from safety/duration demand" },
          { case: "Yield curve inverting (2Y > 10Y)", action: "Recession signal — gold historically outperforms in the 6-12 months following inversion" },
          { case: "Gold-bond correlation turns negative", action: "Gold acting as true portfolio diversifier — most attractive for institutional allocation" },
        ].map(item => (
          <div key={item.case} className="flex gap-2 text-[8px]">
            <span className="font-bold shrink-0" style={{ color: "#c084fc" }}>→</span>
            <div>
              <span className="font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{item.case}: </span>
              <span style={{ color: "rgba(175,185,215,0.4)" }}>{item.action}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · TLT/IEF/SHY/TIP/BND ETF data · Not financial advice
      </div>
    </div>
  );
}
