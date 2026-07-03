"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Driver {
  name: string;
  symbol: string;
  icon: string;
  price: number | null;
  change1d: number | null;
  goldCorr: "positive" | "inverse";
  attribution: number;
  signal: "bullish" | "neutral" | "bearish";
  description: string;
}

interface MacroDriversData {
  goldPrice: number;
  goldChange1d: number;
  totalAttribution: number;
  dominantDriver: string;
  regime: "inflation_driven" | "safe_haven" | "dollar_driven" | "rates_driven" | "mixed";
  regimeDescription: string;
  drivers: Driver[];
  insight: string;
  timestamp: string;
}

const REGIME_META: Record<string, { icon: string; label: string; color: string }> = {
  inflation_driven: { icon: "🔥", label: "Inflation Driven",    color: "#fb923c" },
  safe_haven:       { icon: "🛡️", label: "Safe Haven Flows",    color: "#34d399" },
  dollar_driven:    { icon: "💵", label: "Dollar Driven",       color: "#60a5fa" },
  rates_driven:     { icon: "📈", label: "Real Rates Driven",   color: "#a78bfa" },
  mixed:            { icon: "🔀", label: "Mixed Drivers",       color: "#f5c451" },
};

const SIGNAL_COLOR = {
  bullish: "#34d399",
  neutral: "#f5c451",
  bearish: "#f87171",
};

function AttributionBar({ value }: { value: number }) {
  const isBull = value >= 0;
  const pct = Math.min(100, Math.abs(value) * 10);
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 flex justify-end">
        {!isBull && (
          <div className="h-2 rounded-l-full" style={{ width: `${pct}%`, maxWidth: "100%", background: "#f87171" }} />
        )}
      </div>
      <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.1)" }} />
      <div className="w-24">
        {isBull && (
          <div className="h-2 rounded-r-full" style={{ width: `${pct}%`, maxWidth: "100%", background: "#34d399" }} />
        )}
      </div>
      <span className="text-[10px] font-mono w-14 text-right" style={{ color: isBull ? "#34d399" : "#f87171" }}>
        {value >= 0 ? "+" : ""}{value.toFixed(2)}%
      </span>
    </div>
  );
}

export default function MacroDriversPage() {
  const { t } = useI18n();
  const [data, setData] = useState<MacroDriversData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/macro-drivers")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Analysing macro drivers…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const regime = REGIME_META[data.regime];
  const goldColor = data.goldChange1d >= 0 ? "#34d399" : "#f87171";

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navMacroDrivers")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Macro Driver Attribution · What&apos;s Moving Gold Today · DXY / Real Rates / Risk-Off / Inflation
        </p>
      </div>

      {/* Gold today + regime */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: "rgba(245,196,81,0.05)", border: "1px solid rgba(245,196,81,0.15)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>GOLD TODAY</div>
          <div className="text-2xl font-black" style={{ color: "#f5c451" }}>
            ${data.goldPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-sm font-bold mt-1" style={{ color: goldColor }}>
            {data.goldChange1d >= 0 ? "+" : ""}{data.goldChange1d.toFixed(2)}%
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: `rgba(${regime.color === "#34d399" ? "52,211,153" : regime.color === "#fb923c" ? "251,146,60" : regime.color === "#60a5fa" ? "96,165,250" : regime.color === "#a78bfa" ? "167,139,250" : "245,196,81"},0.05)`, border: `1px solid ${regime.color}30` }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>CURRENT REGIME</div>
          <div className="text-xl">{regime.icon}</div>
          <div className="text-xs font-bold mt-1" style={{ color: regime.color }}>{regime.label}</div>
        </div>
      </div>

      {/* Regime description */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold mb-2" style={{ color: "rgba(175,185,215,0.5)" }}>REGIME ANALYSIS</div>
        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>{data.regimeDescription}</p>
        <div className="mt-3 p-3 rounded-lg" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.1)" }}>
          <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.insight}</p>
        </div>
      </div>

      {/* Attribution waterfall */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
          <span className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>DRIVER ATTRIBUTION (today)</span>
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>← Bearish | Bullish →</div>
        </div>

        {data.drivers
          .slice()
          .sort((a, b) => Math.abs(b.attribution) - Math.abs(a.attribution))
          .map((driver, i) => (
          <div key={driver.name} className="px-4 py-3" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-base w-6 text-center">{driver.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>{driver.name}</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `rgba(${driver.goldCorr === "positive" ? "52,211,153" : "248,113,113"},0.1)`, color: driver.goldCorr === "positive" ? "#34d399" : "#f87171" }}>
                    {driver.goldCorr === "positive" ? "↑ with Gold" : "↓ with Gold"}
                  </span>
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>{driver.symbol}</div>
              </div>
              <div className="text-right">
                {driver.change1d !== null ? (
                  <div className="text-[10px] font-mono" style={{ color: driver.change1d >= 0 ? "#34d399" : "#f87171" }}>
                    {driver.change1d >= 0 ? "+" : ""}{driver.change1d.toFixed(2)}%
                  </div>
                ) : (
                  <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>—</div>
                )}
                {driver.price !== null && (
                  <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                    {driver.price > 100 ? driver.price.toFixed(2) : driver.price.toFixed(4)}
                  </div>
                )}
              </div>
            </div>
            <AttributionBar value={driver.attribution} />
            <p className="text-[9px] mt-1.5" style={{ color: "rgba(175,185,215,0.35)" }}>{driver.description}</p>
          </div>
        ))}

        {/* Total row */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
          <span className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>MODEL TOTAL</span>
          <span className="text-sm font-black" style={{ color: data.totalAttribution >= 0 ? "#34d399" : "#f87171" }}>
            {data.totalAttribution >= 0 ? "+" : ""}{data.totalAttribution.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>HOW TO USE MACRO ATTRIBUTION</div>
        {[
          { icon: "🎯", text: "A model that explains >80% of today's move gives you high-confidence regime identification. Use it to trade WITH the dominant macro narrative." },
          { icon: "⚡", text: "When model attribution diverges sharply from actual gold change, expect positioning/technical flows to normalize in coming days." },
          { icon: "🔄", text: "Regime shifts are the most actionable signal: Dollar Driven → Safe Haven is historically the most bullish transition for gold." },
          { icon: "⚠️", text: "When multiple drivers point in the same direction (confluence), moves are typically larger and more sustained." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Attribution model uses academic macro factor weights · Live data from Yahoo Finance · 15-min cache · Simplified model for educational purposes · Not financial advice
      </p>
    </div>
  );
}
