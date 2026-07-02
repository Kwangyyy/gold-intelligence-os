"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface DrawdownPeriod {
  startDate: string;
  troughDate: string;
  recoveryDate: string | null;
  peakPrice: number;
  troughPrice: number;
  maxDrawdown: number;
  daysToTrough: number;
  daysToRecovery: number | null;
  recovered: boolean;
}

interface DrawdownData {
  currentSpot: number;
  allTimeHigh: number;
  allTimeHighDate: string;
  currentDrawdown: number;
  isDrawdown: boolean;
  historicalDrawdowns: DrawdownPeriod[];
  avgMaxDrawdown: number;
  avgRecoveryDays: number;
  worstDrawdown: DrawdownPeriod;
  insight: string;
  timestamp: string;
}

function fmtPrice(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function ddColor(dd: number): string {
  if (dd <= -40) return "#f87171";
  if (dd <= -20) return "#fb923c";
  if (dd <= -10) return "#f5c451";
  return "#86efac";
}

export default function DrawdownTrackerPage() {
  const { t } = useI18n();
  const [data, setData] = useState<DrawdownData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/drawdown-tracker")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Analyzing drawdowns…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const sortedDD = [...data.historicalDrawdowns].sort((a, b) => a.maxDrawdown - b.maxDrawdown);
  const maxDDabs = Math.max(...data.historicalDrawdowns.map(d => Math.abs(d.maxDrawdown)));

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navDrawdownTracker")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Historical Gold Drawdown Analysis · Peak-to-Trough · Recovery Timeline
        </p>
      </div>

      {/* Current status */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Current Spot", value: fmtPrice(data.currentSpot), color: "#f5c451" },
          { label: "All-Time High", value: `${fmtPrice(data.allTimeHigh)} (${data.allTimeHighDate})`, color: "#c084fc" },
          { label: "From ATH", value: `${data.currentDrawdown >= 0 ? "+" : ""}${data.currentDrawdown.toFixed(1)}%`, color: data.currentDrawdown < -10 ? "#f87171" : data.currentDrawdown < -5 ? "#f5c451" : "#34d399" },
          { label: "Avg Recovery", value: `${Math.round(data.avgRecoveryDays / 30)} months`, color: "rgba(175,185,215,0.8)" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>{s.label}</div>
            <div className="text-sm font-black leading-tight" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Insight */}
      <div className="rounded-xl p-4 flex gap-3"
        style={{ background: data.isDrawdown ? "rgba(248,113,113,0.05)" : "rgba(245,196,81,0.04)", border: `1px solid ${data.isDrawdown ? "rgba(248,113,113,0.15)" : "rgba(245,196,81,0.12)"}` }}>
        <span className="text-lg">{data.isDrawdown ? "⚠️" : "💡"}</span>
        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>{data.insight}</p>
      </div>

      {/* Historical drawdown bars */}
      <div className="rounded-xl p-5"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold mb-4" style={{ color: "rgba(175,185,215,0.6)" }}>
          MAJOR HISTORICAL DRAWDOWNS — DEPTH & RECOVERY
        </div>
        <div className="space-y-4">
          {sortedDD.map((dd, i) => {
            const barW = (Math.abs(dd.maxDrawdown) / maxDDabs) * 100;
            const color = ddColor(dd.maxDrawdown);
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {dd.startDate} → {dd.troughDate}
                    </span>
                    <span className="text-[9px] ml-2" style={{ color: "rgba(175,185,215,0.4)" }}>
                      {fmtPrice(dd.peakPrice)} → {fmtPrice(dd.troughPrice)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black" style={{ color }}>{dd.maxDrawdown.toFixed(1)}%</div>
                    <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                      {dd.recovered ? `Recovered ${dd.recoveryDate} (${Math.round((dd.daysToRecovery ?? 0) / 30)}mo)` : "Not recovered"}
                    </div>
                  </div>
                </div>
                {/* Drawdown bar */}
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${barW}%`, background: color }} />
                </div>
                {/* Recovery bar */}
                {dd.recovered && dd.daysToRecovery && dd.daysToTrough && (
                  <div className="flex items-center gap-2">
                    <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Recovery:</div>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-full rounded-full"
                        style={{
                          width: `${(dd.daysToTrough / dd.daysToRecovery) * 100}%`,
                          background: "rgba(52,211,153,0.5)",
                        }} />
                    </div>
                    <div className="text-[8px]" style={{ color: "rgba(52,211,153,0.6)" }}>
                      {Math.round(dd.daysToRecovery / 30)}mo
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Worst Drawdown", value: `${data.worstDrawdown.maxDrawdown.toFixed(1)}%`, sub: `${data.worstDrawdown.startDate}`, color: "#f87171" },
          { label: "Avg Max Drawdown", value: `${data.avgMaxDrawdown.toFixed(1)}%`, sub: "All major drawdowns", color: "#fb923c" },
          { label: "Avg Recovery", value: `${Math.round(data.avgRecoveryDays / 30)} months`, sub: "From peak", color: "#34d399" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>{s.label}</div>
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-3"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>DRAWDOWN ANALYSIS PRINCIPLES</div>
        {[
          { icon: "📉", text: "Max Drawdown = peak-to-trough decline. The deepest historical drawdown for gold was ~65% (1980 ATH to 1982 trough). Long-term holders recovered." },
          { icon: "⏱️", text: "Recovery time varies widely. The 2011→2020 recovery took 9 years. The 2013→2019 recovery took ~6 years. Patience is the primary edge." },
          { icon: "📊", text: "Current drawdown from ATH matters for position sizing. Never risk more than you can afford to hold through a multi-year recovery period." },
          { icon: "🎯", text: "Buying at historic drawdown extremes (>30% from ATH) has historically been rewarding over 3–5 year horizons — but volatility in between is high." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-sm shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Historical drawdowns from COMEX gold records (1975–2024) · Current data from Yahoo Finance GC=F · Not financial advice
      </p>
    </div>
  );
}
