"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface PremiumWeek {
  week: string;
  premium: number;
  comex: number;
  sge: number;
}

interface KeyLevel {
  label: string;
  value: number;
  note: string;
}

interface AsiaPremiumData {
  comexSpot: number;
  sgePremium: number;
  premiumPct: number;
  signal: "strong_demand" | "moderate_demand" | "neutral" | "discount";
  goldImplication: string;
  history: PremiumWeek[];
  keyLevels: KeyLevel[];
  interpretation: string;
  timestamp: string;
}

const SIGNAL_META = {
  strong_demand:    { label: "Strong Demand",    color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
  moderate_demand:  { label: "Moderate Demand",  color: "#86efac", bg: "rgba(134,239,172,0.06)", border: "rgba(134,239,172,0.15)" },
  neutral:          { label: "Neutral",           color: "#f5c451", bg: "rgba(245,196,81,0.06)",  border: "rgba(245,196,81,0.15)"  },
  discount:         { label: "Discount / Weak",  color: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.15)" },
};

function PremiumBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = value >= 25 ? "#34d399" : value >= 10 ? "#86efac" : value >= 0 ? "#f5c451" : "#f87171";
  return (
    <div className="flex items-end gap-1 h-10">
      <div className="flex-1 flex flex-col justify-end h-full">
        <div
          className="rounded-t-sm transition-all duration-500"
          style={{ height: `${pct}%`, background: color, minHeight: "2px" }}
        />
      </div>
    </div>
  );
}

export default function AsiaPremiumPage() {
  const { t } = useI18n();
  const [data, setData] = useState<AsiaPremiumData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/asia-premium")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading SGE premium data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const meta = SIGNAL_META[data.signal];
  const maxPremium = Math.max(...data.history.map(h => h.premium), 40);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navAsiaPremium")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          SGE (Shanghai Gold Exchange) vs COMEX Basis · Chinese Physical Demand Signal
        </p>
      </div>

      {/* Hero premium card */}
      <div className="rounded-xl p-5" style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>SGE PREMIUM OVER COMEX</div>
            <div className="text-4xl font-black" style={{ color: meta.color }}>
              {data.sgePremium >= 0 ? "+" : ""}{data.sgePremium.toFixed(1)}
              <span className="text-base ml-1">USD/oz</span>
            </div>
            <div className="text-sm mt-1" style={{ color: "rgba(175,185,215,0.5)" }}>
              ({data.premiumPct >= 0 ? "+" : ""}{data.premiumPct.toFixed(3)}% of COMEX spot)
            </div>
          </div>
          <div className="text-right">
            <span className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: meta.border, color: meta.color }}>
              {meta.label}
            </span>
            <div className="text-[10px] mt-2" style={{ color: "rgba(175,185,215,0.35)" }}>
              COMEX: ${data.comexSpot.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>
          {data.goldImplication}
        </p>
      </div>

      {/* 12-week bar chart */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold mb-3" style={{ color: "rgba(175,185,215,0.5)" }}>12-WEEK SGE PREMIUM HISTORY</div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${data.history.length}, 1fr)` }}>
          {data.history.map((w, i) => {
            const isLast = i === data.history.length - 1;
            const color = w.premium >= 25 ? "#34d399" : w.premium >= 10 ? "#86efac" : w.premium >= 0 ? "#f5c451" : "#f87171";
            const pct = Math.max(4, (Math.max(0, w.premium) / maxPremium) * 100);
            return (
              <div key={w.week} className="flex flex-col items-center gap-1">
                <div className="text-[8px] font-mono" style={{ color: color }}>
                  {w.premium >= 0 ? "+" : ""}{w.premium.toFixed(0)}
                </div>
                <div className="w-full flex flex-col justify-end" style={{ height: "60px" }}>
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${pct}%`,
                      background: isLast ? color : `${color}99`,
                      border: isLast ? `1px solid ${color}` : "none",
                    }}
                  />
                </div>
                <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)", writingMode: "vertical-rl", transform: "rotate(180deg)", height: "28px" }}>
                  {w.week}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          <span>🟢 ≥$25 Strong</span>
          <span>🟡 ≥$10 Moderate</span>
          <span>⚪ ~$0 Neutral</span>
          <span>🔴 &lt;$0 Discount</span>
        </div>
      </div>

      {/* Key levels */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          PREMIUM THRESHOLD LEVELS
        </div>
        {data.keyLevels.map((kl, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
            <div className="w-24 shrink-0">
              <div className="text-xs font-bold" style={{ color: "#f5c451" }}>${kl.value}</div>
              <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{kl.label}</div>
            </div>
            <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.45)" }}>{kl.note}</div>
          </div>
        ))}
      </div>

      {/* Interpretation */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>HOW SGE PREMIUM WORKS</div>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.interpretation}</p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          {[
            { icon: "🇨🇳", title: "China Is Key", text: "China is the world's largest gold consumer. When Chinese demand is high, the SGE premium rises as importers pay above world price." },
            { icon: "🚢", title: "Import Quotas", text: "The PBOC controls gold import quotas. When quotas tighten, premiums spike even if demand is unchanged — a supply squeeze signal." },
            { icon: "📊", title: "Arbitrage Trigger", text: "When SGE premium exceeds ~$45, international gold flows into Shanghai. This physical arbitrage eventually pulls COMEX prices higher." },
            { icon: "⚠️", title: "Seasonal Patterns", text: "Premium typically rises in Q1 (Chinese New Year demand) and Q4 (festival season). Lowest premiums often seen in Q2-Q3." },
          ].map((item, i) => (
            <div key={i} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span>{item.icon}</span>
                <span className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.7)" }}>{item.title}</span>
              </div>
              <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        SGE premium estimated from representative historical patterns · COMEX spot from Yahoo Finance GC=F · 30-min cache · Not financial advice
      </p>
    </div>
  );
}
