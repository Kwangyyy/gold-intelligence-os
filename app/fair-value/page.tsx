"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { FairValuePayload, DriverContribution } from "@/app/api/fair-value/route";

const VERDICT_LABEL = {
  overvalued: "Overvalued",
  fairly_valued: "Fairly Valued",
  undervalued: "Undervalued",
};

const DIR_COLOR = { bullish: "#34d399", neutral: "#f5c451", bearish: "#f87171" };

export default function FairValuePage() {
  const { tier } = useTier();
  const [data, setData] = useState<FairValuePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/fair-value", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/fair-value")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Running fair value model…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="📐 Gold Fair Value Model"
        subtitle="Statistical regression model: gold priced vs real yields (TIP), dollar (DXY), and fear (VIX)"
      />

      {/* ── Verdict Card ─── */}
      <div className="panel px-5 py-5 flex items-center gap-5"
        style={{ border: `1px solid ${data.verdictColor}30`, background: data.verdictColor + "06" }}>
        <div className="space-y-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Model Verdict</div>
          <div className="text-2xl font-black" style={{ color: data.verdictColor }}>
            {VERDICT_LABEL[data.verdict]}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
              Actual: <span style={{ color: "#f5c451", fontWeight: 700 }}>
                ${data.goldPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
              Model: <span style={{ color: data.verdictColor, fontWeight: 700 }}>
                ${data.fairValue.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="text-[8px]" style={{ color: data.premiumColor }}>
            {data.premium >= 0 ? "+" : ""}{data.premium.toFixed(1)}% vs fair value
          </div>
        </div>
        <div className="flex-1">
          {/* Premium gauge */}
          <div className="space-y-1">
            <div className="flex justify-between text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              <span>-20%</span><span>FV</span><span>+20%</span>
            </div>
            <div className="h-3 rounded-full relative" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="absolute top-0 left-1/2 w-0.5 h-full" style={{ background: "rgba(255,255,255,0.15)" }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                style={{
                  left: `calc(50% + ${Math.min(45, Math.max(-45, data.premium * 2.25))}% - 5px)`,
                  background: data.premiumColor,
                  boxShadow: `0 0 6px ${data.premiumColor}`,
                }} />
            </div>
          </div>
          <div className="text-[8px] mt-3 leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>
            {data.verdictDescription}
          </div>
        </div>
      </div>

      {/* ── Price Targets ─── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Bear Target", value: data.targetBear, color: "#f87171", desc: "FV - 1.5σ" },
          { label: "Base (FV)", value: data.targetBase, color: "#f5c451", desc: "Model fair value" },
          { label: "Bull Target", value: data.targetBull, color: "#34d399", desc: "FV + 1.5σ" },
        ].map(t => (
          <div key={t.label} className="panel px-4 py-4 text-center space-y-1">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{t.label}</div>
            <div className="text-xl font-black" style={{ color: t.color }}>${t.value.toLocaleString()}</div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* ── Driver Breakdown ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🧮 Model Driver Contributions
        </div>
        {data.drivers.map((d: DriverContribution) => {
          const dColor = DIR_COLOR[d.direction];
          const isPositive = d.contribution > 0;
          const barW = Math.min(Math.abs(d.contribution) / (data.fairValue / 2) * 100, 100);
          return (
            <div key={d.name} className="rounded-xl px-4 py-3"
              style={{ background: dColor + "06", border: `1px solid ${dColor}20` }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{d.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{d.currentValue}</span>
                  <span className="text-[9px] font-black" style={{ color: dColor }}>
                    {isPositive ? "+" : ""}${Math.round(d.contribution).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="text-[7px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>{d.description}</div>
              <div className="mt-1.5 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full" style={{ width: `${barW}%`, background: dColor + "60" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Model Quality ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>🔬 Model Quality</div>
        <div className="flex items-center gap-3">
          <div className="text-2xl font-black" style={{ color: data.rSquared > 0.7 ? "#34d399" : data.rSquared > 0.5 ? "#f5c451" : "#f87171" }}>
            {(data.rSquared * 100).toFixed(0)}%
          </div>
          <div>
            <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
              R² — {data.rSquared > 0.7 ? "Good explanatory power" : data.rSquared > 0.5 ? "Moderate fit" : "Low fit — use with caution"}
            </div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{data.modelNote}</div>
          </div>
        </div>
        <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-full rounded-full" style={{
            width: `${data.rSquared * 100}%`,
            background: data.rSquared > 0.7 ? "#34d399aa" : data.rSquared > 0.5 ? "#f5c451aa" : "#f87171aa"
          }} />
        </div>
      </div>

      {/* ── Education ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>📚 How to Use This Model</div>
        {[
          { case: "Gold 10%+ above fair value", action: "Consider profit-taking / scaling out; expect mean reversion or macro shift needed" },
          { case: "Gold at fair value (±5%)", action: "Fairly priced — follow technical levels and momentum for entry/exit decisions" },
          { case: "Gold 10%+ below fair value", action: "Historically strong buy zone vs model — accumulate with wider stops" },
          { case: "R² below 50%", action: "Model fit is weak — other factors dominating (geopolitics, physical demand) not captured here" },
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
        {new Date(data.timestamp).toLocaleString()} · Regression model · Not financial advice · Updates every hour
      </div>
    </div>
  );
}
