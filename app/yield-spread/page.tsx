"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface SpreadDataPoint {
  date: string;
  spread: number;
  us10y: number;
  us2y: number;
}

interface Playbook {
  scenario: string;
  spread: string;
  goldBias: string;
  note: string;
}

interface YieldSpreadData {
  us10y: number | null;
  us2y: number | null;
  us3m: number | null;
  spread10y2y: number | null;
  spread10y3m: number | null;
  spreadTrend: "steepening" | "stable" | "flattening" | "inverting";
  invertedSince: string | null;
  goldImplication: string;
  signal: "strong_bullish" | "bullish" | "neutral" | "bearish";
  history: SpreadDataPoint[];
  playbook: Playbook[];
  insight: string;
  timestamp: string;
}

const SIGNAL_META = {
  strong_bullish: { label: "Strong Bullish", color: "#34d399", icon: "⬆⬆" },
  bullish:        { label: "Bullish",         color: "#86efac", icon: "↗"   },
  neutral:        { label: "Neutral",          color: "#f5c451", icon: "→"   },
  bearish:        { label: "Bearish",          color: "#f87171", icon: "↘"   },
};

const TREND_META = {
  steepening: { label: "Steepening", color: "#f87171", icon: "🔺" },
  stable:     { label: "Stable",     color: "#f5c451", icon: "→"  },
  flattening: { label: "Flattening", color: "#fb923c", icon: "→"  },
  inverting:  { label: "Inverting",  color: "#34d399", icon: "⬇"  },
};

export default function YieldSpreadPage() {
  const { t } = useI18n();
  const [data, setData] = useState<YieldSpreadData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/yield-spread")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading yield curve data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const sig = SIGNAL_META[data.signal];
  const trendMeta = TREND_META[data.spreadTrend];
  const spread = data.spread10y2y;
  const spreadColor = spread !== null
    ? (spread < -50 ? "#34d399" : spread < 0 ? "#86efac" : spread > 100 ? "#f87171" : "#f5c451")
    : "#f5c451";

  // Chart: normalize spread history for SVG line
  const history = data.history.slice(-20);
  const minS = Math.min(...history.map(h => h.spread), -10);
  const maxS = Math.max(...history.map(h => h.spread), 10);
  const W = 560; const H = 80;
  const normY = (v: number) => H - ((v - minS) / (maxS - minS)) * H;
  const zeroPct = ((0 - minS) / (maxS - minS)) * H;
  const path = history.map((h, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = normY(h.spread);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navYieldSpread")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          US Yield Curve Spread Monitor · 10Y-2Y Inversion · Gold Recession Playbook
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "10Y Yield",     value: data.us10y !== null ? `${data.us10y.toFixed(3)}%` : "—", color: "#60a5fa" },
          { label: "2Y Yield",      value: data.us2y  !== null ? `${data.us2y.toFixed(3)}%`  : "—", color: "#a78bfa" },
          { label: "10Y-2Y Spread", value: spread !== null ? `${spread.toFixed(0)}bps` : "—", color: spreadColor, highlight: true },
          { label: "3M Yield",      value: data.us3m  !== null ? `${data.us3m.toFixed(3)}%`  : "—", color: "#94a3b8" },
          { label: "10Y-3M Spread", value: data.spread10y3m !== null ? `${data.spread10y3m.toFixed(0)}bps` : "—", color: spreadColor },
          { label: "Trend",         value: trendMeta.label, color: trendMeta.color },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${item.highlight ? `${spreadColor}30` : "rgba(255,255,255,0.06)"}` }}>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>{item.label}</div>
            <div className={`font-black ${item.highlight ? "text-2xl" : "text-base"}`} style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Signal banner */}
      <div className="rounded-xl p-4" style={{ background: `${sig.color}0a`, border: `1px solid ${sig.color}30` }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl">{sig.icon}</span>
          <span className="text-sm font-bold" style={{ color: sig.color }}>{sig.label} for Gold</span>
          {data.invertedSince && (
            <span className="text-[8px] px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>
              Inverted since {data.invertedSince}
            </span>
          )}
        </div>
        <p className="text-[11px] leading-relaxed mb-2" style={{ color: "rgba(175,185,215,0.6)" }}>{data.goldImplication}</p>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{data.insight}</p>
      </div>

      {/* Spread history chart */}
      {history.length > 3 && (
        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[10px] font-bold mb-3" style={{ color: "rgba(175,185,215,0.5)" }}>20-DAY 10Y-2Y SPREAD (bps)</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "80px" }}>
            {/* Zero line */}
            <line x1="0" y1={H - zeroPct} x2={W} y2={H - zeroPct}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4,4" />
            {/* Spread fill */}
            <path
              d={`${path} L ${W} ${H - zeroPct} L 0 ${H - zeroPct} Z`}
              fill={spread !== null && spread < 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)"}
            />
            <path d={path} fill="none" stroke={spreadColor} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="flex justify-between text-[8px] mt-1" style={{ color: "rgba(175,185,215,0.25)" }}>
            <span>{history[0]?.date?.slice(5) ?? ""}</span>
            <span className="text-center">── 0bp ──</span>
            <span>Today</span>
          </div>
        </div>
      )}

      {/* Playbook table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          YIELD CURVE → GOLD PLAYBOOK
        </div>
        {data.playbook.map((pb, i) => {
          const pbColor = pb.goldBias.includes("Buy") ? "#34d399" : pb.goldBias === "Bullish" ? "#86efac" : pb.goldBias === "Bearish" ? "#f87171" : "#f5c451";
          const isCurrent = spread !== null && pb.spread.includes("-50") && spread < -50
            ? true
            : spread !== null && pb.spread.startsWith("-50 to 0") && spread >= -50 && spread < 0
            ? true
            : spread !== null && pb.spread.includes("-10 to +10") && spread >= -10 && spread <= 10
            ? true
            : spread !== null && pb.spread.startsWith(">") && spread > 100;
          return (
            <div
              key={i}
              className="flex gap-3 px-4 py-3"
              style={{
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                background: isCurrent ? "rgba(245,196,81,0.04)" : undefined,
              }}
            >
              <div className="w-20 shrink-0">
                <div className="text-[9px] font-mono" style={{ color: "rgba(175,185,215,0.5)" }}>{pb.spread}</div>
                <div className="text-[9px] font-bold mt-0.5" style={{ color: pbColor }}>{pb.goldBias}</div>
                {isCurrent && <div className="text-[7px]" style={{ color: "#f5c451" }}>◄ NOW</div>}
              </div>
              <div>
                <div className="text-[10px] font-bold mb-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>{pb.scenario}</div>
                <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{pb.note}</div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Yield data from Yahoo Finance (^TNX, ^TWO, ^IRX) · 15-min cache · Inversion signal based on NY Fed recession model methodology · Not financial advice
      </p>
    </div>
  );
}
