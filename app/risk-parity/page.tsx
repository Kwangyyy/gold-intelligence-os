"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { RiskParityPayload, AssetAllocation, PortfolioStats } from "@/app/api/risk-parity/route";

const CAT_COLOR: Record<string, string> = {
  Commodity: "#f5c451",
  Equity: "#c084fc",
  Bonds: "#60a5fa",
  Crypto: "#fb923c",
  Currency: "#34d399",
};

const PORTFOLIO_ICONS = ["⚖️", "🎯", "🥇"];

export default function RiskParityPage() {
  const { tier } = useTier();
  const [data, setData] = useState<RiskParityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selPort, setSelPort] = useState(1); // default Risk Parity

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/risk-parity", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/risk-parity")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Pro tier required</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Computing portfolio optimization…</div>
    </div>
  );
  if (!data) return null;

  const selectedPortfolio = data.portfolios[selPort];
  const maxWeight = selectedPortfolio ? Math.max(...selectedPortfolio.weights.map(w => w.pct)) : 100;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="⚖️ Gold Risk Parity Model"
        subtitle="Optimal gold allocation using volatility-weighted risk parity across equities, bonds, BTC, and dollar"
      />

      {/* ── Gold Diversification Score ─── */}
      <div className="panel px-5 py-4 flex items-center gap-4"
        style={{ border: `1px solid ${data.goldDiversColor}30`, background: data.goldDiversColor + "05" }}>
        <div className="text-center shrink-0 w-24">
          <div className="text-4xl font-black" style={{ color: data.goldDiversColor }}>{data.goldDiversScore}</div>
          <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Diversifier Score</div>
          <div className="h-1.5 rounded-full mt-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full rounded-full" style={{ width: `${data.goldDiversScore}%`, background: data.goldDiversColor + "90" }} />
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold as Portfolio Diversifier (30D)</div>
          <div className="text-[8px] font-bold" style={{ color: data.goldDiversColor }}>{data.optimalGoldRange}</div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.marketRegimeNote}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Gold 30D Vol</div>
          <div className="text-lg font-black" style={{ color: "#f5c451" }}>{data.goldVol30D.toFixed(1)}%</div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Risk contrib: {data.goldRiskContrib.toFixed(1)}%</div>
        </div>
      </div>

      {/* ── Portfolio Selector ─── */}
      <div className="grid grid-cols-3 gap-3">
        {data.portfolios.map((p: PortfolioStats, i: number) => (
          <button key={p.name} onClick={() => setSelPort(i)}
            className="panel px-3 py-3 text-center transition-all"
            style={{
              border: selPort === i ? `1px solid ${p.riskColor}` : "1px solid rgba(255,255,255,0.06)",
              background: selPort === i ? p.riskColor + "10" : undefined,
            }}>
            <div className="text-lg">{PORTFOLIO_ICONS[i]}</div>
            <div className="text-[7px] uppercase tracking-widest mt-0.5" style={{ color: selPort === i ? p.riskColor : "rgba(175,185,215,0.3)" }}>{p.name}</div>
            <div className="text-sm font-black mt-0.5" style={{ color: p.riskColor }}>
              {p.goldPct.toFixed(1)}% Gold
            </div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              ~{p.expectedVol.toFixed(1)}% vol
            </div>
          </button>
        ))}
      </div>

      {/* ── Selected Portfolio Weights ─── */}
      {selectedPortfolio && (
        <div className="panel px-5 py-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
              {selectedPortfolio.name} — Allocations
            </div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              Est. port vol: {selectedPortfolio.expectedVol.toFixed(1)}%
              {selectedPortfolio.diversificationBenefit !== 0 && ` · saves ${selectedPortfolio.diversificationBenefit.toFixed(1)}% vol vs equal-weight`}
            </div>
          </div>
          <div className="text-[7px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{selectedPortfolio.description}</div>
          {selectedPortfolio.weights.map(w => {
            const asset = data.assets.find(a => a.symbol === w.symbol);
            if (!asset) return null;
            const catColor = CAT_COLOR[asset.category] ?? "#f5c451";
            const barW = maxWeight > 0 ? (w.pct / maxWeight) * 100 : 0;
            return (
              <div key={w.symbol} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: catColor }} />
                <div className="text-[8px] w-28 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }}>{asset.name}</div>
                <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full" style={{ width: `${barW}%`, background: catColor + "70" }} />
                </div>
                <div className="text-[9px] font-black w-12 text-right" style={{ color: catColor }}>
                  {w.pct.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Asset Volatility Table ─── */}
      <div className="panel px-5 py-5 space-y-2">
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Asset Volatility & Gold Correlation
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 text-[7px] uppercase tracking-wider pb-1.5"
          style={{ color: "rgba(175,185,215,0.25)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span>Asset</span>
          <span className="text-right">Vol 30D</span>
          <span className="text-right">Vol 90D</span>
          <span className="text-right">Corr w/ Gold</span>
          <span className="text-right">Risk %</span>
        </div>
        {data.assets.map((a: AssetAllocation) => {
          const catColor = CAT_COLOR[a.category] ?? "#f5c451";
          const corrColor = Math.abs(a.currentCorr) < 0.2 ? "#34d399" : a.currentCorr < 0 ? "#86efac" : "#f87171";
          return (
            <div key={a.symbol} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center py-1">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: catColor }} />
                <span className="text-[8px] font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>{a.name}</span>
              </div>
              <span className="text-[8px] text-right" style={{ color: a.vol30D > 30 ? "#f87171" : a.vol30D > 15 ? "#f5c451" : "#34d399" }}>
                {a.vol30D.toFixed(1)}%
              </span>
              <span className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.4)" }}>
                {a.vol90D.toFixed(1)}%
              </span>
              <span className="text-[8px] font-bold text-right" style={{ color: corrColor }}>
                {a.symbol === "GC=F" ? "—" : (a.currentCorr >= 0 ? "+" : "") + a.currentCorr.toFixed(2)}
              </span>
              <span className="text-[7px] text-right" style={{ color: "rgba(175,185,215,0.3)" }}>
                {a.marginalContribution.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Education ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>📚 Risk Parity Fundamentals</div>
        {[
          { case: "What is Risk Parity?", action: "Equal risk contribution from each asset rather than equal dollar weight. Higher-vol assets get smaller weights so no single asset dominates portfolio risk." },
          { case: "Why gold in risk parity?", action: "Gold's low correlation with equities and bonds during crises makes it an excellent risk parity component — stabilizing the portfolio when others fall." },
          { case: "When to increase gold allocation?", action: "When gold-equity correlation turns negative and gold vol is relatively low — this maximizes diversification benefit per dollar of gold allocation." },
          { case: "Optimal gold range historically", action: "Academic research suggests 10-20% gold in multi-asset portfolios improves Sharpe ratio. Crisis periods (2008, 2020) showed benefit of 25-40% allocations." },
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
        {new Date(data.timestamp).toLocaleString()} · Simplified risk parity (univariate vol, ignores cross-correlations) · Not financial advice
      </div>
    </div>
  );
}
