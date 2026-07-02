"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface InternalFactor {
  name: string;
  shortName: string;
  value: number;
  prev: number;
  unit: string;
  signal: "bullish" | "neutral" | "bearish";
  weight: number;
  description: string;
}

interface MarketInternalsData {
  composite: number;
  regime: "risk_on" | "neutral" | "risk_off";
  goldImplication: "bullish" | "neutral" | "bearish";
  goldImplicationText: string;
  factors: InternalFactor[];
  timestamp: string;
}

const SIGNAL_COLOR = { bullish: "#34d399", neutral: "#f5c451", bearish: "#f87171" };
const REGIME_META = {
  risk_off: { label: "RISK OFF",  color: "#34d399", icon: "🛡️", desc: "Safe-haven mode — gold favored" },
  neutral:  { label: "NEUTRAL",   color: "#f5c451", icon: "⚖️", desc: "Mixed signals — event-driven" },
  risk_on:  { label: "RISK ON",   color: "#f87171", icon: "📈", desc: "Risk appetite high — equities over gold" },
};

function fmtChange(cur: number, prev: number, unit = "") {
  const ch = cur - prev;
  const pct = prev !== 0 ? (ch / prev * 100) : 0;
  const sign = ch >= 0 ? "+" : "";
  if (unit === "%") return `${sign}${ch.toFixed(2)}bp`;
  return `${sign}${pct.toFixed(2)}%`;
}

export default function MarketInternalsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<MarketInternalsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market-internals")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading market internals…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load data</div>
    </div>
  );

  const regime = REGIME_META[data.regime];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navMarketInternals")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          VIX · Credit · Rates · Dollar · Risk Appetite Composite · Gold Implication
        </p>
      </div>

      {/* Composite score + regime */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Score dial */}
        <div className="rounded-xl p-5 flex flex-col items-center gap-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>
            RISK-OFF COMPOSITE
          </div>
          {/* Radial progress */}
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" strokeWidth="10"
                stroke="rgba(255,255,255,0.06)" />
              <circle cx="50" cy="50" r="40" fill="none" strokeWidth="10"
                stroke={data.composite >= 60 ? "#34d399" : data.composite <= 40 ? "#f87171" : "#f5c451"}
                strokeDasharray={`${data.composite * 2.513} 251.3`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black"
                style={{ color: data.composite >= 60 ? "#34d399" : data.composite <= 40 ? "#f87171" : "#f5c451" }}>
                {data.composite}
              </span>
              <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>/ 100</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-base font-black flex items-center gap-2 justify-center" style={{ color: regime.color }}>
              <span>{regime.icon}</span>{regime.label}
            </div>
            <div className="text-[10px] mt-1" style={{ color: "rgba(175,185,215,0.45)" }}>{regime.desc}</div>
          </div>
        </div>

        {/* Gold implication */}
        <div className="space-y-3">
          <div className="rounded-xl p-4"
            style={{
              background: `rgba(${data.goldImplication === "bullish" ? "52,211,153" : data.goldImplication === "bearish" ? "248,113,113" : "245,196,81"},0.06)`,
              border: `1px solid rgba(${data.goldImplication === "bullish" ? "52,211,153" : data.goldImplication === "bearish" ? "248,113,113" : "245,196,81"},0.15)`,
            }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>GOLD IMPLICATION</div>
            <div className="text-base font-black mb-1 capitalize"
              style={{ color: SIGNAL_COLOR[data.goldImplication] }}>
              {data.goldImplication === "bullish" ? "🟢 Bullish" : data.goldImplication === "bearish" ? "🔴 Bearish" : "🟡 Neutral"}
            </div>
            <div className="text-[11px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
              {data.goldImplicationText}
            </div>
          </div>

          {/* Scale */}
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "rgba(175,185,215,0.4)" }}>SCALE</div>
            <div className="flex h-2 rounded-full overflow-hidden">
              <div style={{ flex: 1, background: "#f87171" }} />
              <div style={{ flex: 1, background: "#f59e0b" }} />
              <div style={{ flex: 1, background: "#f5c451" }} />
              <div style={{ flex: 1, background: "#86efac" }} />
              <div style={{ flex: 1, background: "#34d399" }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
              <span>0 Risk-On</span>
              <span>50 Neutral</span>
              <span>100 Risk-Off</span>
            </div>
            {/* Marker */}
            <div className="relative mt-1">
              <div className="absolute w-2 h-2 rounded-full bg-white"
                style={{ left: `calc(${data.composite}% - 4px)`, top: 0 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Factor cards */}
      <div className="space-y-2">
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>INDIVIDUAL FACTORS</div>
        {data.factors.map((f) => {
          const chg = f.prev !== 0 ? ((f.value - f.prev) / Math.abs(f.prev) * 100) : 0;
          const color = SIGNAL_COLOR[f.signal];
          return (
            <div key={f.shortName} className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black"
                    style={{ background: `rgba(${color === "#34d399" ? "52,211,153" : color === "#f87171" ? "248,113,113" : "245,196,81"},0.12)`, color }}>
                    {f.shortName.slice(0, 3)}
                  </div>
                  <div>
                    <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>{f.name}</div>
                    <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>Weight: {f.weight}%</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {f.unit === "$" ? `$${f.value.toFixed(2)}` : f.unit === "%" ? `${f.value.toFixed(2)}%` : f.value.toFixed(2)}
                  </div>
                  <div className="text-[10px]" style={{ color: chg >= 0 ? "#34d399" : "#f87171" }}>
                    {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                  </div>
                </div>
              </div>
              {/* Signal bar */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`px-2 py-0.5 rounded text-[9px] font-bold capitalize`}
                  style={{ background: `rgba(${color === "#34d399" ? "52,211,153" : color === "#f87171" ? "248,113,113" : "245,196,81"},0.12)`, color }}>
                  {f.signal} for gold
                </div>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>
                {f.description}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Data from Yahoo Finance (VIX, SPY, HYG, TNX, DXY, JPY=X) · 15-min cache · Composite score weighted by gold impact relevance · Not financial advice
      </p>
    </div>
  );
}
