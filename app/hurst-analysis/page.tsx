"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface HurstResult {
  exponent: number;
  regime: "trending" | "random" | "mean_reverting";
  confidence: "high" | "medium" | "low";
  interpretation: string;
  tradingImplication: string;
}

interface TimeframedHurst {
  tf: string;
  label: string;
  periods: number;
  hurst: HurstResult;
}

interface HurstData {
  currentSpot: number;
  timeframes: TimeframedHurst[];
  overallBias: "trending" | "random" | "mean_reverting";
  overallHurst: number;
  signal: "trend_follow" | "range_trade" | "wait";
  signalReason: string;
  timestamp: string;
}

const REGIME_META = {
  trending:      { label: "Trending",       color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)",  icon: "📈" },
  random:        { label: "Random Walk",     color: "#f5c451", bg: "rgba(245,196,81,0.05)",  border: "rgba(245,196,81,0.12)", icon: "↔️" },
  mean_reverting:{ label: "Mean-Reverting",  color: "#c084fc", bg: "rgba(192,132,252,0.08)", border: "rgba(192,132,252,0.2)", icon: "🔄" },
};

const SIGNAL_META = {
  trend_follow: { label: "Trend Follow Mode",  color: "#34d399", icon: "📈" },
  range_trade:  { label: "Range Trade Mode",    color: "#c084fc", icon: "🔄" },
  wait:         { label: "No Clear Edge",        color: "#f5c451", icon: "⏸️" },
};

const CONF_COLOR = { high: "#34d399", medium: "#f5c451", low: "#f87171" };

function HurstDial({ value }: { value: number }) {
  // Gauge from 0 to 1; needle points at value
  const angle = (value - 0.5) * 180; // -90 to +90 degrees from center
  const centerX = 80, centerY = 80, radius = 60;
  const startAngle = -180;
  const endAngle = 0;

  // Arc path
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (from: number, to: number, color: string) => {
    const x1 = centerX + radius * Math.cos(toRad(from));
    const y1 = centerY + radius * Math.sin(toRad(from));
    const x2 = centerX + radius * Math.cos(toRad(to));
    const y2 = centerY + radius * Math.sin(toRad(to));
    const large = to - from > 180 ? 1 : 0;
    return `<path d="M${x1},${y1} A${radius},${radius} 0 ${large},1 ${x2},${y2}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`;
  };

  const needleAngle = startAngle + value * (endAngle - startAngle) * 2; // scaled
  const nx = centerX + (radius - 12) * Math.cos(toRad(needleAngle));
  const ny = centerY + (radius - 12) * Math.sin(toRad(needleAngle));

  return (
    <svg viewBox="0 0 160 90" className="w-full max-w-[180px] mx-auto">
      {/* Background arcs */}
      <path
        d={`M${centerX + radius * Math.cos(toRad(startAngle))},${centerY + radius * Math.sin(toRad(startAngle))} A${radius},${radius} 0 0,1 ${centerX + radius * Math.cos(toRad(-120))},${centerY + radius * Math.sin(toRad(-120))}`}
        fill="none" stroke="#c084fc" strokeWidth="8" strokeLinecap="round"
      />
      <path
        d={`M${centerX + radius * Math.cos(toRad(-120))},${centerY + radius * Math.sin(toRad(-120))} A${radius},${radius} 0 0,1 ${centerX + radius * Math.cos(toRad(-60))},${centerY + radius * Math.sin(toRad(-60))}`}
        fill="none" stroke="#f5c451" strokeWidth="8" strokeLinecap="round"
      />
      <path
        d={`M${centerX + radius * Math.cos(toRad(-60))},${centerY + radius * Math.sin(toRad(-60))} A${radius},${radius} 0 0,1 ${centerX + radius * Math.cos(toRad(endAngle))},${centerY + radius * Math.sin(toRad(endAngle))}`}
        fill="none" stroke="#34d399" strokeWidth="8" strokeLinecap="round"
      />
      {/* Needle */}
      <line x1={centerX} y1={centerY} x2={nx} y2={ny}
        stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx={centerX} cy={centerY} r="4" fill="#f5c451" />
      {/* Labels */}
      <text x="14" y="82" fill="rgba(192,132,252,0.7)" fontSize="7" textAnchor="middle">0 MR</text>
      <text x="80" y="22" fill="rgba(245,196,81,0.7)" fontSize="7" textAnchor="middle">0.5</text>
      <text x="146" y="82" fill="rgba(52,211,153,0.7)" fontSize="7" textAnchor="middle">1 TR</text>
    </svg>
  );
}

export default function HurstAnalysisPage() {
  const { t } = useI18n();
  const [data, setData] = useState<HurstData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hurst-analysis")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Computing Hurst exponent…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load data</div>
    </div>
  );

  const overallMeta = REGIME_META[data.overallBias];
  const signalMeta = SIGNAL_META[data.signal];

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>
          {t("navHurstAnalysis")}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Hurst Exponent · Fractal Market Analysis · Trend vs Mean-Reversion Regime
        </p>
      </div>

      {/* Main dial + regime */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl p-5 flex flex-col items-center gap-3"
          style={{ background: overallMeta.bg, border: `1px solid ${overallMeta.border}` }}>
          <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>
            DAILY HURST EXPONENT
          </div>
          <HurstDial value={data.overallHurst} />
          <div className="text-3xl font-black" style={{ color: overallMeta.color }}>
            {data.overallHurst.toFixed(3)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base">{overallMeta.icon}</span>
            <span className="text-sm font-bold" style={{ color: overallMeta.color }}>
              {overallMeta.label} Regime
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Signal */}
          <div className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "rgba(175,185,215,0.4)" }}>TRADING SIGNAL</div>
            <div className="flex items-center gap-2 mb-1">
              <span>{signalMeta.icon}</span>
              <span className="text-sm font-black" style={{ color: signalMeta.color }}>{signalMeta.label}</span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
              {data.signalReason}
            </p>
          </div>

          {/* Hurst scale legend */}
          <div className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: "rgba(175,185,215,0.4)" }}>HURST SCALE</div>
            {[
              { range: "H > 0.65", label: "Trending", color: "#34d399", desc: "Persistent momentum" },
              { range: "H ≈ 0.50", label: "Random",   color: "#f5c451", desc: "No predictable pattern" },
              { range: "H < 0.35", label: "Mean-Rev", color: "#c084fc", desc: "Reverts to mean" },
            ].map(item => (
              <div key={item.range} className="flex items-center gap-3 mb-2">
                <div className="w-16 text-[9px] font-mono shrink-0" style={{ color: item.color }}>{item.range}</div>
                <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
                  <span className="font-bold" style={{ color: item.color }}>{item.label}</span> — {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeframe breakdown */}
      <div className="space-y-3">
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>HURST ACROSS TIMEFRAMES</div>
        {data.timeframes.map((tf) => {
          const meta = REGIME_META[tf.hurst.regime];
          const barPct = (tf.hurst.exponent / 1) * 100;
          return (
            <div key={tf.tf} className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>{tf.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
                    {tf.periods} periods used
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black" style={{ color: meta.color }}>
                    {tf.hurst.exponent.toFixed(3)}
                  </div>
                  <div className="text-[10px] flex items-center gap-1 justify-end" style={{ color: meta.color }}>
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    <span className="text-[9px] px-1 rounded"
                      style={{ background: `rgba(${CONF_COLOR[tf.hurst.confidence] === "#34d399" ? "52,211,153" : tf.hurst.confidence === "medium" ? "245,196,81" : "248,113,113"},0.12)`, color: CONF_COLOR[tf.hurst.confidence] }}>
                      {tf.hurst.confidence} conf
                    </span>
                  </div>
                </div>
              </div>
              {/* Bar */}
              <div className="h-1.5 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${barPct}%`, background: meta.color }} />
              </div>
              <p className="text-[10px] leading-relaxed mb-1" style={{ color: "rgba(175,185,215,0.45)" }}>
                {tf.hurst.interpretation}
              </p>
              <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.35)" }}>
                💡 {tf.hurst.tradingImplication}
              </p>
            </div>
          );
        })}
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-3"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>WHAT IS THE HURST EXPONENT?</div>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>
          Developed by hydrologist Harold Hurst (1951) and popularized in finance by Benoit Mandelbrot,
          the Hurst Exponent (H) measures the long-range dependence of a time series using
          Rescaled Range (R/S) analysis. It quantifies whether a series tends to trend (H &gt; 0.5),
          revert to mean (H &lt; 0.5), or behave randomly (H = 0.5).
        </p>
        {[
          { icon: "📐", text: "Calculated via R/S analysis: divide series into sub-periods, compute range/std for each, regress log(R/S) vs log(n). The slope = H." },
          { icon: "🪙", text: "Gold has historically shown H ≈ 0.55–0.65 on daily charts — mild trend persistence. This means momentum strategies outperform random entry on average." },
          { icon: "⚠️", text: "Hurst is not a timing indicator — it measures the statistical property of recent price history, not future direction." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-base shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Hurst computed via R/S analysis on GC=F Yahoo Finance data · Simulated fallback if data unavailable · Updated every 30 min · Not financial advice
      </p>
    </div>
  );
}
