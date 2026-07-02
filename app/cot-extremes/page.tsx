"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface COTRecord {
  date: string;
  commercials: number;
  largeSpecs: number;
  smallSpecs: number;
  openInterest: number;
}

interface COTData {
  latest: COTRecord;
  history: COTRecord[];
  largeSpecsNetPctile: number;
  commercialsNetPctile: number;
  signal: "extreme_bullish" | "bullish" | "neutral" | "bearish" | "extreme_bearish";
  signalReason: string;
  crowdedLong: boolean;
  crowdedShort: boolean;
  openInterestChange: number;
  timestamp: string;
}

const SIGNAL_META = {
  extreme_bullish: { label: "Extreme Bullish", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)", icon: "🚀" },
  bullish:         { label: "Bullish",          color: "#34d399", bg: "rgba(52,211,153,0.05)", border: "rgba(52,211,153,0.12)", icon: "🟢" },
  neutral:         { label: "Neutral",           color: "#f5c451", bg: "rgba(245,196,81,0.05)", border: "rgba(245,196,81,0.12)", icon: "🟡" },
  bearish:         { label: "Bearish",           color: "#f87171", bg: "rgba(248,113,113,0.05)", border: "rgba(248,113,113,0.12)", icon: "🔴" },
  extreme_bearish: { label: "Extreme Bearish",   color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", icon: "⚠️" },
};

function fmtK(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${abs}`;
}

function PctileGauge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px]">
        <span style={{ color: "rgba(175,185,215,0.5)" }}>{label}</span>
        <span className="font-bold" style={{ color }}>{value}th pctile</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }} />
      </div>
      <div className="flex justify-between text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
        <span>Extreme Short</span>
        <span>Neutral</span>
        <span>Extreme Long</span>
      </div>
    </div>
  );
}

export default function COTExtremesPage() {
  const { t } = useI18n();
  const [data, setData] = useState<COTData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cot-extremes")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading COT data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load data</div>
    </div>
  );

  const meta = SIGNAL_META[data.signal];
  const { latest, history } = data;

  // Mini chart data: large specs net over time
  const chartData = history.slice(-16);
  const maxNet = Math.max(...chartData.map(r => Math.abs(r.largeSpecs)));
  const chartH = 80;

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>
          {t("navCotExtremes")}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          CFTC Commitment of Traders · Gold Futures (COMEX) · Speculator Positioning Extremes
        </p>
      </div>

      {/* Signal banner */}
      <div className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
        <div className="text-2xl">{meta.icon}</div>
        <div className="flex-1">
          <div className="text-sm font-black" style={{ color: meta.color }}>{meta.label} — Contrarian Signal</div>
          <div className="text-xs mt-1" style={{ color: "rgba(175,185,215,0.55)" }}>{data.signalReason}</div>
          <div className="flex gap-2 mt-2">
            {data.crowdedLong && (
              <span className="px-2 py-0.5 rounded text-[9px] font-bold"
                style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                ⚠️ CROWDED LONG
              </span>
            )}
            {data.crowdedShort && (
              <span className="px-2 py-0.5 rounded text-[9px] font-bold"
                style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                🎯 SQUEEZE SETUP
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Large Specs Net", value: fmtK(latest.largeSpecs), color: latest.largeSpecs >= 0 ? "#34d399" : "#f87171" },
          { label: "Commercials Net", value: fmtK(latest.commercials), color: latest.commercials >= 0 ? "#34d399" : "#f87171" },
          { label: "Open Interest", value: `${(latest.openInterest/1000).toFixed(0)}K`, color: "rgba(175,185,215,0.8)" },
          { label: "OI Change (WoW)", value: fmtK(data.openInterestChange), color: data.openInterestChange >= 0 ? "#34d399" : "#f87171" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>{s.label}</div>
            <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Percentile gauges */}
      <div className="rounded-xl p-5 space-y-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>POSITIONING PERCENTILE (26-WEEK RANGE)</div>
        <PctileGauge
          value={data.largeSpecsNetPctile}
          label="Large Speculators (Managed Money)"
          color={data.largeSpecsNetPctile >= 70 ? "#f87171" : data.largeSpecsNetPctile <= 30 ? "#34d399" : "#f5c451"}
        />
        <PctileGauge
          value={data.commercialsNetPctile}
          label="Commercials (Hedgers)"
          color="rgba(168,85,247,0.9)"
        />
      </div>

      {/* Mini chart: Large Specs Net trend */}
      <div className="rounded-xl p-5"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold mb-3" style={{ color: "rgba(175,185,215,0.6)" }}>LARGE SPECS NET POSITIONING (16W)</div>
        <div className="flex items-end gap-0.5" style={{ height: chartH }}>
          {chartData.map((r, i) => {
            const isLatest = i === chartData.length - 1;
            const barH = Math.max(2, (Math.abs(r.largeSpecs) / (maxNet || 1)) * chartH);
            const isPositive = r.largeSpecs >= 0;
            return (
              <div key={r.date} className="flex flex-col items-center gap-0 flex-1">
                {isPositive ? (
                  <>
                    <div style={{ height: chartH - barH, width: "100%" }} />
                    <div className="w-full rounded-t-[1px]"
                      style={{
                        height: barH,
                        background: isLatest ? "#f5c451" : "rgba(52,211,153,0.5)",
                        border: isLatest ? "1px solid #f5c451" : "none",
                      }} />
                  </>
                ) : (
                  <>
                    <div style={{ height: chartH - barH, width: "100%" }} />
                    <div className="w-full rounded-b-[1px]"
                      style={{
                        height: barH,
                        background: isLatest ? "#f5c451" : "rgba(248,113,113,0.5)",
                        border: isLatest ? "1px solid #f5c451" : "none",
                      }} />
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          <span>{chartData[0]?.date}</span>
          <span>Net Longs (contracts)</span>
          <span>{chartData[chartData.length - 1]?.date}</span>
        </div>
      </div>

      {/* Interpretation guide */}
      <div className="rounded-xl p-5 space-y-3"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>HOW TRADERS USE COT DATA</div>
        {[
          { icon: "🐂", text: "Large Specs at extreme NET SHORT (< 20th pctile) → contrarian BUY signal. Capitulation = fuel for squeeze rally." },
          { icon: "🐻", text: "Large Specs at extreme NET LONG (> 80th pctile) → crowded trade. Any negative catalyst accelerates unwinding." },
          { icon: "🏭", text: "Commercials (producers/banks) are natural gold hedgers. Their extreme net short = they expect higher prices (hedging more)." },
          { icon: "📊", text: "Rising OI + rising price = new money entering = trend confirmation. Falling OI + rising price = short covering, weaker move." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-base shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        COT data based on simulated representative data · Real data from CFTC released weekly (Tuesday positions, Friday publication) · Not financial advice
      </p>
    </div>
  );
}
