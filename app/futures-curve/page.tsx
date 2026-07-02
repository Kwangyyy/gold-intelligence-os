"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface FuturesContract {
  symbol: string;
  label: string;
  expiry: string;
  monthsOut: number;
  price: number | null;
  basis: number | null;
  annualizedBasis: number | null;
}

interface CurveData {
  spot: number;
  curve: FuturesContract[];
  structure: "contango" | "backwardation" | "flat";
  spreadM1M3: number | null;
  spreadM1M6: number | null;
  impliedCarryCost: number | null;
  signal: "bullish" | "neutral" | "bearish";
  signalReason: string;
  timestamp: string;
}

const SIGNAL_COLOR = {
  bullish: "#34d399",
  neutral: "#f5c451",
  bearish: "#f87171",
};

const STRUCTURE_COLOR = {
  contango: "#f87171",
  backwardation: "#34d399",
  flat: "#94a3b8",
};

export default function FuturesCurvePage() {
  const { t } = useI18n();
  const [data, setData] = useState<CurveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/futures-curve")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const fmtPrice = (n: number | null) =>
    n !== null ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
  const fmtBasis = (n: number | null) => {
    if (n === null) return "—";
    const sign = n >= 0 ? "+" : "";
    return `${sign}$${n.toFixed(2)}`;
  };
  const fmtPct = (n: number | null) => {
    if (n === null) return "—";
    const sign = n >= 0 ? "+" : "";
    return `${sign}${n.toFixed(2)}%`;
  };

  // Build chart bars — normalize to spot
  const maxPrice = data ? Math.max(...[data.spot, ...data.curve.map(c => c.price ?? 0)]) : 1;
  const minPrice = data ? Math.min(...[data.spot, ...data.curve.map(c => c.price ?? 0)]) * 0.999 : 0;
  const chartRange = maxPrice - minPrice || 1;
  const barHeight = (price: number) => ((price - minPrice) / chartRange) * 100;

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading futures curve…</div>
    </div>
  );

  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load data</div>
    </div>
  );

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>
          {t("navFuturesCurve")}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          COMEX Gold Futures Term Structure · Contango / Backwardation Analysis
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Spot Price", value: fmtPrice(data.spot), color: "#f5c451" },
          {
            label: "Curve Structure",
            value: data.structure.charAt(0).toUpperCase() + data.structure.slice(1),
            color: STRUCTURE_COLOR[data.structure],
          },
          { label: "M1–M3 Spread", value: fmtBasis(data.spreadM1M3), color: "rgba(175,185,215,0.8)" },
          { label: "Implied Carry", value: fmtPct(data.impliedCarryCost) + "/yr", color: "rgba(175,185,215,0.8)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>
              {s.label}
            </div>
            <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Signal banner */}
      <div className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background: `rgba(${data.signal === "bullish" ? "52,211,153" : data.signal === "bearish" ? "248,113,113" : "245,196,81"},0.06)`,
          border: `1px solid rgba(${data.signal === "bullish" ? "52,211,153" : data.signal === "bearish" ? "248,113,113" : "245,196,81"},0.18)`,
        }}>
        <div className="text-xl">{data.signal === "bullish" ? "🟢" : data.signal === "bearish" ? "🔴" : "🟡"}</div>
        <div>
          <div className="text-sm font-bold capitalize" style={{ color: SIGNAL_COLOR[data.signal] }}>
            {data.signal} Signal
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.55)" }}>
            {data.signalReason}
          </div>
        </div>
      </div>

      {/* Visual bar chart */}
      <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold mb-4" style={{ color: "rgba(175,185,215,0.6)" }}>FUTURES CURVE SHAPE</div>
        <div className="flex items-end gap-2 h-36">
          {/* Spot bar */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="text-[8px]" style={{ color: "#f5c451" }}>{fmtPrice(data.spot)}</div>
            <div className="w-full rounded-t-sm transition-all"
              style={{
                height: `${barHeight(data.spot)}%`,
                minHeight: 4,
                background: "linear-gradient(180deg, #f5c451 0%, rgba(245,196,81,0.3) 100%)",
              }} />
            <div className="text-[8px] text-center" style={{ color: "rgba(175,185,215,0.5)" }}>Spot</div>
          </div>
          {data.curve.map((c) => {
            const isContango = c.price !== null && c.price > data.spot;
            return (
              <div key={c.symbol} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-[8px]" style={{ color: isContango ? "#f87171" : "#34d399" }}>
                  {fmtPrice(c.price)}
                </div>
                <div className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${barHeight(c.price ?? minPrice)}%`,
                    minHeight: 4,
                    background: isContango
                      ? "linear-gradient(180deg, #f87171 0%, rgba(248,113,113,0.3) 100%)"
                      : "linear-gradient(180deg, #34d399 0%, rgba(52,211,153,0.3) 100%)",
                  }} />
                <div className="text-[8px] text-center" style={{ color: "rgba(175,185,215,0.5)" }}>
                  {c.expiry}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 justify-center">
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.5)" }}>
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#f87171" }} /> Contango (above spot)
          </div>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.5)" }}>
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#34d399" }} /> Backwardation (below spot)
          </div>
        </div>
      </div>

      {/* Contract table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)" }}>
              {["Contract", "Price", "Basis vs Spot", "Annualized Basis"].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold"
                  style={{ color: "rgba(175,185,215,0.5)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <td className="px-4 py-3 font-bold" style={{ color: "#f5c451" }}>Spot (GC=F)</td>
              <td className="px-4 py-3 font-mono" style={{ color: "#f5c451" }}>{fmtPrice(data.spot)}</td>
              <td className="px-4 py-3" style={{ color: "rgba(175,185,215,0.4)" }}>—</td>
              <td className="px-4 py-3" style={{ color: "rgba(175,185,215,0.4)" }}>—</td>
            </tr>
            {data.curve.map((c) => {
              const basisColor = c.basis === null ? "rgba(175,185,215,0.4)" : c.basis >= 0 ? "#f87171" : "#34d399";
              return (
                <tr key={c.symbol} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-4 py-3" style={{ color: "rgba(175,185,215,0.7)" }}>{c.label}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: "rgba(255,255,255,0.8)" }}>{fmtPrice(c.price)}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: basisColor }}>{fmtBasis(c.basis)}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: basisColor }}>{fmtPct(c.annualizedBasis)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>HOW TO READ THE CURVE</div>
        {[
          { term: "Contango", def: "Futures price > Spot. Normal for gold (storage + financing cost). Steep contango can signal weak physical demand." },
          { term: "Backwardation", def: "Futures price < Spot. Rare for gold. Signals extreme physical demand, lease rate spike, or supply squeeze — historically bullish." },
          { term: "Basis", def: "Futures – Spot price. Positive = contango; negative = backwardation. Widens with time to expiry." },
          { term: "Implied Carry", def: "Annualized basis as % of spot. Normal range 3–6% (storage ~0.1–0.15%/yr + risk-free rate). Extreme readings = market dislocation." },
        ].map((item) => (
          <div key={item.term} className="flex gap-3">
            <span className="text-[10px] font-bold shrink-0 w-28" style={{ color: "#f5c451" }}>{item.term}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.def}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Futures prices sourced from Yahoo Finance · Simulated carry model used as fallback · Not financial advice · Updated every 30 min
      </p>
    </div>
  );
}
