"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface CurrencySignal {
  name: string;
  symbol: string;
  flag: string;
  price: number | null;
  change1d: number | null;
  stressLevel: "extreme" | "high" | "moderate" | "low" | "stable";
  goldImplication: "bullish" | "neutral" | "bearish";
  weight: number;
  note: string;
}

interface CurrencyStressData {
  compositeStressIndex: number;
  stressRegime: "crisis" | "elevated" | "moderate" | "calm";
  goldImplication: string;
  currencies: CurrencySignal[];
  mostStressed: string;
  mostStable: string;
  insight: string;
  timestamp: string;
}

const STRESS_META = {
  extreme:  { label: "Extreme",  color: "#f87171", score: 100 },
  high:     { label: "High",     color: "#fb923c", score: 75  },
  moderate: { label: "Moderate", color: "#f5c451", score: 50  },
  low:      { label: "Low",      color: "#86efac", score: 25  },
  stable:   { label: "Stable",   color: "#34d399", score: 10  },
};

const REGIME_META = {
  crisis:   { label: "EM Crisis",       color: "#f87171", icon: "🚨" },
  elevated: { label: "Elevated Stress", color: "#fb923c", icon: "⚠️" },
  moderate: { label: "Moderate Stress", color: "#f5c451", icon: "😟" },
  calm:     { label: "Calm",            color: "#34d399", icon: "😌" },
};

const GOLD_IMPL_META = {
  bullish: { color: "#34d399", label: "Bullish" },
  neutral: { color: "#f5c451", label: "Neutral" },
  bearish: { color: "#f87171", label: "Bearish" },
};

export default function CurrencyStressPage() {
  const { t } = useI18n();
  const [data, setData] = useState<CurrencyStressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/currency-stress")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Scanning EM currency stress…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const regime = REGIME_META[data.stressRegime];
  const scoreColor = data.compositeStressIndex > 70 ? "#f87171" : data.compositeStressIndex > 50 ? "#fb923c" : data.compositeStressIndex > 30 ? "#f5c451" : "#34d399";

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navCurrencyStress")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          EM Currency Stress Index · Gold Safe-Haven Demand Signal · 7 EM Currency Monitor
        </p>
      </div>

      {/* Composite index hero */}
      <div className="rounded-xl p-5" style={{ background: `${scoreColor}0a`, border: `1px solid ${scoreColor}25` }}>
        <div className="flex items-center gap-5">
          <div>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>EM STRESS INDEX</div>
            <div className="text-5xl font-black" style={{ color: scoreColor }}>
              {data.compositeStressIndex.toFixed(0)}
              <span className="text-lg">/100</span>
            </div>
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ width: "160px", background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${data.compositeStressIndex}%`, background: scoreColor }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{regime.icon}</span>
              <span className="text-sm font-bold" style={{ color: regime.color }}>{regime.label}</span>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.goldImplication}</p>
          </div>
        </div>
        <p className="text-[10px] mt-3 leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{data.insight}</p>
      </div>

      {/* Most/least stressed */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>MOST STRESSED</div>
          <div className="text-sm font-bold" style={{ color: "#f87171" }}>{data.mostStressed}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>MOST STABLE</div>
          <div className="text-sm font-bold" style={{ color: "#34d399" }}>{data.mostStable}</div>
        </div>
      </div>

      {/* Currency table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          EM CURRENCY MONITOR (vs USD)
        </div>
        {data.currencies
          .slice()
          .sort((a, b) => STRESS_META[b.stressLevel].score - STRESS_META[a.stressLevel].score)
          .map((cur, i) => {
            const stress = STRESS_META[cur.stressLevel];
            const impl = GOLD_IMPL_META[cur.goldImplication];
            return (
              <div key={cur.symbol} className="px-4 py-3" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-xl">{cur.flag}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>{cur.name}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${stress.color}18`, color: stress.color }}>
                        {stress.label}
                      </span>
                    </div>
                    <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>{cur.symbol}</div>
                  </div>
                  <div className="text-right">
                    {cur.change1d !== null ? (
                      <div className="text-[10px] font-mono font-bold" style={{ color: cur.change1d >= 0 ? "#f87171" : "#34d399" }}>
                        {cur.change1d >= 0 ? "+" : ""}{cur.change1d.toFixed(2)}%
                      </div>
                    ) : (
                      <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>—</div>
                    )}
                    <div className="text-[9px]" style={{ color: impl.color }}>{impl.label}</div>
                  </div>
                </div>
                {/* Stress bar */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full" style={{ width: `${stress.score}%`, background: stress.color }} />
                  </div>
                  <span className="text-[8px] w-6 text-right" style={{ color: stress.color }}>{stress.score}</span>
                </div>
                <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.35)" }}>{cur.note}</p>
              </div>
            );
          })}
      </div>

      {/* How to use */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>EM STRESS → GOLD SIGNAL</div>
        {[
          { icon: "🚨", text: "EM Crisis (Index >70): Mass capital flight from EM currencies into gold. Historically precedes 3-8% gold rallies within 30 days." },
          { icon: "⚠️", text: "Elevated Stress (50-70): Safe-haven demand building. Gold is receiving tailwind. Risk of escalation to crisis is higher." },
          { icon: "😟", text: "Moderate Stress (30-50): Some EM pressure but not systemic. Gold gets mild safe-haven premium but macro factors still dominate." },
          { icon: "😌", text: "Calm (<30): EM currencies stable. Risk appetite high. Gold needs inflation or rate-driven catalysts — not EM flows — to move." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Currency data from Yahoo Finance · 15-min cache · EM = Emerging Markets · Stress index is composite weighted model · Not financial advice
      </p>
    </div>
  );
}
