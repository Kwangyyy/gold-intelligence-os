"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface DataPoint {
  date: string;
  breakeven: number;
  goldPrice: number;
  realYield: number;
}

interface KeyLevel {
  level: number;
  label: string;
  note: string;
}

interface GoldBreakevenData {
  breakeven5y5y: number;
  breakevenChange1d: number;
  realYield10y: number;
  realYieldChange1d: number;
  goldPrice: number;
  goldChange1d: number;
  breakevenSignal: "rising_fast" | "rising" | "stable" | "falling" | "falling_fast";
  goldImplication: string;
  correlation30d: number;
  history: DataPoint[];
  keyLevels: KeyLevel[];
  insight: string;
  timestamp: string;
}

const SIGNAL_META: Record<string, { label: string; color: string; icon: string }> = {
  rising_fast:  { label: "Rising Fast",  color: "#34d399", icon: "⬆⬆" },
  rising:       { label: "Rising",       color: "#86efac", icon: "↗"   },
  stable:       { label: "Stable",       color: "#f5c451", icon: "→"   },
  falling:      { label: "Falling",      color: "#fca5a5", icon: "↘"   },
  falling_fast: { label: "Falling Fast", color: "#f87171", icon: "⬇⬇" },
};

export default function GoldBreakevenPage() {
  const { t } = useI18n();
  const [data, setData] = useState<GoldBreakevenData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gold-breakeven")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Computing inflation expectations…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const sig = SIGNAL_META[data.breakevenSignal];
  const corrColor = data.correlation30d > 0.5 ? "#34d399" : data.correlation30d < 0 ? "#f87171" : "#f5c451";
  const ryColor = data.realYield10y < 0 ? "#34d399" : data.realYield10y > 2 ? "#f87171" : "#f5c451";

  // Chart: dual-axis breakeven + gold normalized
  const minBE = Math.min(...data.history.map(h => h.breakeven));
  const maxBE = Math.max(...data.history.map(h => h.breakeven));
  const minG  = Math.min(...data.history.map(h => h.goldPrice));
  const maxG  = Math.max(...data.history.map(h => h.goldPrice));
  const normBE = (v: number) => maxBE === minBE ? 50 : ((v - minBE) / (maxBE - minBE)) * 100;
  const normG  = (v: number) => maxG  === minG  ? 50 : ((v - minG)  / (maxG  - minG))  * 100;

  const W = 560;
  const H = 100;
  const bePath = data.history.map((h, i) => {
    const x = (i / (data.history.length - 1)) * W;
    const y = H - normBE(h.breakeven) * (H / 100);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const gPath = data.history.map((h, i) => {
    const x = (i / (data.history.length - 1)) * W;
    const y = H - normG(h.goldPrice) * (H / 100);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navGoldBreakeven")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Gold vs Inflation Breakeven · Real Yield Monitor · Inflation Expectation Signal
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "5Y Breakeven",
            value: `${data.breakeven5y5y.toFixed(2)}%`,
            sub: `${data.breakevenChange1d >= 0 ? "+" : ""}${data.breakevenChange1d.toFixed(3)}% today`,
            color: sig.color,
            extra: `${sig.icon} ${sig.label}`,
          },
          {
            label: "Real Yield (10Y)",
            value: `${data.realYield10y.toFixed(2)}%`,
            sub: `${data.realYieldChange1d >= 0 ? "+" : ""}${data.realYieldChange1d.toFixed(3)}% today`,
            color: ryColor,
            extra: data.realYield10y < 0 ? "Negative — Gold Bullish" : data.realYield10y > 2 ? "High — Gold Headwind" : "Moderate",
          },
          {
            label: "Gold Price",
            value: `$${data.goldPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            sub: `${data.goldChange1d >= 0 ? "+" : ""}${data.goldChange1d.toFixed(2)}% today`,
            color: data.goldChange1d >= 0 ? "#34d399" : "#f87171",
            extra: "",
          },
          {
            label: "30D Correlation",
            value: `${(data.correlation30d * 100).toFixed(0)}%`,
            sub: "Breakeven vs Gold",
            color: corrColor,
            extra: data.correlation30d > 0.5 ? "High — Inflation Driven" : "Low — Other Drivers",
          },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>{item.label}</div>
            <div className="text-xl font-black" style={{ color: item.color }}>{item.value}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{item.sub}</div>
            {item.extra && <div className="text-[8px] mt-1" style={{ color: item.color }}>{item.extra}</div>}
          </div>
        ))}
      </div>

      {/* Signal banner */}
      <div className="rounded-xl p-4" style={{ background: `${sig.color}0d`, border: `1px solid ${sig.color}30` }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{sig.icon}</span>
          <span className="text-xs font-bold" style={{ color: sig.color }}>Breakeven {sig.label}</span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>{data.goldImplication}</p>
        <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{data.insight}</p>
      </div>

      {/* Dual chart */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>20-DAY NORMALIZED CHART</div>
          <div className="flex gap-3 text-[8px]">
            <span style={{ color: "#fb923c" }}>— Breakeven</span>
            <span style={{ color: "#f5c451" }}>— Gold</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "100px" }}>
          <path d={bePath} fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" />
          <path d={gPath}  fill="none" stroke="#f5c451" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div className="flex justify-between text-[8px] mt-1" style={{ color: "rgba(175,185,215,0.25)" }}>
          <span>{data.history[0]?.date?.slice(5) ?? ""}</span>
          <span>Today</span>
        </div>
      </div>

      {/* Key levels */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          BREAKEVEN REFERENCE LEVELS
        </div>
        {data.keyLevels.map((kl, i) => {
          const isCurrent = data.breakeven5y5y >= kl.level - 0.25 && data.breakeven5y5y < kl.level + 0.25;
          const color = kl.level >= 3.0 ? "#34d399" : kl.level >= 2.5 ? "#86efac" : kl.level >= 2.0 ? "#f5c451" : "#f87171";
          return (
            <div
              key={kl.level}
              className="flex gap-4 px-4 py-3"
              style={{
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                background: isCurrent ? "rgba(245,196,81,0.04)" : undefined,
              }}
            >
              <div className="w-14 shrink-0 text-right">
                <div className="text-sm font-black" style={{ color }}>{kl.level.toFixed(1)}%</div>
                {isCurrent && <div className="text-[7px]" style={{ color: "#f5c451" }}>◄ NOW</div>}
              </div>
              <div>
                <div className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.7)" }}>{kl.label}</div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{kl.note}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>BREAKEVEN VS REAL YIELD PLAYBOOK</div>
        {[
          { icon: "🔥", text: "Breakeven rising + Real yield falling = Most bullish gold combination. Inflation expectations outpace nominal yield rises." },
          { icon: "❄️", text: "Breakeven falling + Real yield rising = Most bearish. Deflation fears with rising opportunity cost — no reason to hold gold." },
          { icon: "🔄", text: "Breakeven stable + Real yield falling = Mildly bullish. Gold benefits from lower opportunity cost even without inflation narrative." },
          { icon: "⚖️", text: "Watch the spread: Real yield = Nominal 10Y − Breakeven. When real yields go negative, gold historically surges (2020, 2011 peaks)." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Breakeven estimated from TIP/TLT ETF ratio · Real yield proxied from TIPS price changes · 15-min cache · Not financial advice
      </p>
    </div>
  );
}
