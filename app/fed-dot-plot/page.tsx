"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface RateMeeting {
  date: string;
  marketImplied: number;
  fedMedianDot: number;
  divergence: number;
  goldSignal: "bullish" | "neutral" | "bearish";
}

interface FedDotPlotData {
  currentFedFundsRate: number;
  currentFedFundsTarget: string;
  marketImplied2025End: number;
  fedDot2025End: number;
  expectedCuts2025: number;
  divergence: number;
  goldImplication: string;
  signal: "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish";
  meetings: RateMeeting[];
  insight: string;
  timestamp: string;
}

const SIGNAL_META = {
  very_bullish: { label: "Very Bullish",  color: "#34d399", icon: "⬆⬆" },
  bullish:      { label: "Bullish",       color: "#86efac", icon: "↗"   },
  neutral:      { label: "Neutral",       color: "#f5c451", icon: "→"   },
  bearish:      { label: "Bearish",       color: "#fca5a5", icon: "↘"   },
  very_bearish: { label: "Very Bearish",  color: "#f87171", icon: "⬇⬇" },
};

const GSIG_META = {
  bullish: { color: "#34d399" },
  neutral: { color: "#f5c451" },
  bearish: { color: "#f87171" },
};

function RateBar({ rate, max, color }: { rate: number; max: number; color: string }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
      <div className="h-full rounded-full" style={{ width: `${(rate / max) * 100}%`, background: color }} />
    </div>
  );
}

export default function FedDotPlotPage() {
  const { t } = useI18n();
  const [data, setData] = useState<FedDotPlotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/fed-dot-plot")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Fetching Fed rate expectations…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const sig = SIGNAL_META[data.signal];
  const maxRate = 5.5;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navFedDotPlot")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Fed Dot Plot vs Market Pricing · Rate Path Tracker · Gold Implication from Rates
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Fed Funds Target", value: data.currentFedFundsTarget, color: "#f5c451" },
          { label: "Market 2025 End",  value: `${data.marketImplied2025End.toFixed(2)}%`, color: "#60a5fa" },
          { label: "Fed Dot 2025 End", value: `${data.fedDot2025End.toFixed(2)}%`, color: "#a78bfa" },
          {
            label: "Cuts Expected",
            value: `${data.expectedCuts2025}×`,
            color: data.expectedCuts2025 > 2 ? "#34d399" : data.expectedCuts2025 > 0 ? "#f5c451" : "#f87171",
          },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>{item.label}</div>
            <div className="text-xl font-black" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Divergence signal */}
      <div className="rounded-xl p-5" style={{ background: `${sig.color}0a`, border: `1px solid ${sig.color}30` }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{sig.icon}</span>
          <div>
            <div className="text-xs font-bold" style={{ color: sig.color }}>{sig.label} for Gold</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
              Market {data.divergence > 0 ? "more dovish" : "more hawkish"} than Fed by {Math.abs(data.divergence * 100).toFixed(0)}bp
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed mb-2" style={{ color: "rgba(175,185,215,0.6)" }}>{data.goldImplication}</p>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>{data.insight}</p>
      </div>

      {/* Market vs Fed dot comparison */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold mb-4" style={{ color: "rgba(175,185,215,0.5)" }}>MARKET vs FED RATE PATH</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[9px] mb-2 flex items-center gap-2" style={{ color: "#60a5fa" }}>
              <div className="w-3 h-0.5 rounded" style={{ background: "#60a5fa" }} />
              Market Implied
            </div>
            <div className="space-y-2">
              <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>Current: <span style={{ color: "#f5c451" }}>{data.currentFedFundsRate.toFixed(2)}%</span></div>
              <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>End 2025: <span style={{ color: "#60a5fa" }}>{data.marketImplied2025End.toFixed(2)}%</span></div>
              <RateBar rate={data.marketImplied2025End} max={maxRate} color="#60a5fa" />
              <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                Implies {data.expectedCuts2025} cuts of 25bp
              </div>
            </div>
          </div>
          <div>
            <div className="text-[9px] mb-2 flex items-center gap-2" style={{ color: "#a78bfa" }}>
              <div className="w-3 h-0.5 rounded" style={{ background: "#a78bfa" }} />
              Fed Dot Plot
            </div>
            <div className="space-y-2">
              <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>Current: <span style={{ color: "#f5c451" }}>{data.currentFedFundsRate.toFixed(2)}%</span></div>
              <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>End 2025: <span style={{ color: "#a78bfa" }}>{data.fedDot2025End.toFixed(2)}%</span></div>
              <RateBar rate={data.fedDot2025End} max={maxRate} color="#a78bfa" />
              <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                Median FOMC participant projection
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meeting-by-meeting table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="grid grid-cols-[80px_1fr_1fr_1fr_60px] text-[9px] font-bold px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.4)" }}>
          <span>Meeting</span>
          <span className="text-center">Market</span>
          <span className="text-center">Fed Dot</span>
          <span className="text-center">Divergence</span>
          <span className="text-center">Gold</span>
        </div>
        {data.meetings.map((m, i) => {
          const gSig = GSIG_META[m.goldSignal];
          const divColor = m.divergence > 0 ? "#34d399" : m.divergence < 0 ? "#f87171" : "#f5c451";
          return (
            <div key={m.date} className="grid grid-cols-[80px_1fr_1fr_1fr_60px] items-center px-3 py-2.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
              <span className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>{m.date}</span>
              <div className="text-center">
                <span className="text-[10px] font-mono" style={{ color: "#60a5fa" }}>{m.marketImplied.toFixed(2)}%</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-mono" style={{ color: "#a78bfa" }}>{m.fedMedianDot.toFixed(2)}%</span>
              </div>
              <div className="text-center">
                <span className="text-[9px] font-mono" style={{ color: divColor }}>
                  {m.divergence >= 0 ? "+" : ""}{(m.divergence * 100).toFixed(0)}bp
                </span>
              </div>
              <div className="text-center">
                <span className="text-[9px]" style={{ color: gSig.color }}>
                  {m.goldSignal === "bullish" ? "↑" : m.goldSignal === "bearish" ? "↓" : "→"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>FED RATES & GOLD — KEY RELATIONSHIPS</div>
        {[
          { icon: "✂️", text: "Rate cuts = Lower opportunity cost of holding gold (which pays no yield) → Bullish. Each 25bp cut historically adds 0.5-2% to gold price." },
          { icon: "🎯", text: "Dot Plot divergence: When market prices MORE cuts than dots, it means market expects economic weakness — bullish for gold safe-haven AND yield reduction." },
          { icon: "⚡", text: "Surprise cuts (emergency, off-cycle) are the MOST bullish. They signal financial stress → gold surges on both safe-haven + rate signals." },
          { icon: "📊", text: "Note: Higher real yields (nominal yield − inflation) matter more than nominal rates alone. Gold can rally even when Fed is hiking if inflation outpaces." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Rate expectations are estimated from CME FedWatch methodology · Fed dots from Dec 2024 SEP · 1-hour cache · Not financial advice
      </p>
    </div>
  );
}
