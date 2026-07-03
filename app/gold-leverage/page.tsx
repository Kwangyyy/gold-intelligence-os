"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface LeverageHistory {
  week: string;
  openInterest: number;
  oiTonnes: number;
  leverage: number;
  signal: "extreme" | "high" | "moderate" | "low";
}

interface HistoricalExtreme {
  date: string;
  leverage: number;
  priceAfter30d: number;
}

interface GoldLeverageData {
  openInterestContracts: number;
  openInterestTonnes: number;
  registeredVaultTonnes: number;
  leverageRatio: number;
  leverageTrend: "rising" | "stable" | "falling";
  signal: "very_bullish" | "bullish" | "neutral" | "bearish";
  goldImplication: string;
  history: LeverageHistory[];
  extremes: HistoricalExtreme[];
  insight: string;
  timestamp: string;
}

const SIG_META = {
  very_bullish: { label: "Very Bullish (Squeeze Risk)",  color: "#34d399", icon: "🚨" },
  bullish:      { label: "Bullish (High Leverage)",       color: "#86efac", icon: "⚠️" },
  neutral:      { label: "Neutral",                        color: "#f5c451", icon: "→"  },
  bearish:      { label: "Bearish (Low Leverage)",         color: "#f87171", icon: "📉" },
};

const HIST_SIG_META = {
  extreme:  { color: "#f87171" },
  high:     { color: "#fb923c" },
  moderate: { color: "#f5c451" },
  low:      { color: "#34d399" },
};

const TREND_META = {
  rising:  { label: "Rising",  color: "#f87171" },
  stable:  { label: "Stable",  color: "#f5c451" },
  falling: { label: "Falling", color: "#34d399" },
};

export default function GoldLeveragePage() {
  const { t } = useI18n();
  const [data, setData] = useState<GoldLeverageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gold-leverage")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Computing gold leverage ratio…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const sig = SIG_META[data.signal];
  const trend = TREND_META[data.leverageTrend];
  const maxLeverage = Math.max(...data.history.map(h => h.leverage));

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navGoldLeverage")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          COMEX Gold Leverage Ratio · Paper vs Physical · Short Squeeze Risk Monitor
        </p>
      </div>

      {/* Hero leverage gauge */}
      <div className="rounded-xl p-5" style={{ background: `${sig.color}0a`, border: `1px solid ${sig.color}30` }}>
        <div className="flex items-center gap-5">
          <div>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>LEVERAGE RATIO</div>
            <div className="text-5xl font-black" style={{ color: sig.color }}>
              {data.leverageRatio.toFixed(1)}
              <span className="text-lg ml-1">×</span>
            </div>
            <div className="text-[10px] mt-1" style={{ color: "rgba(175,185,215,0.4)" }}>Paper OI per physical oz</div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{sig.icon}</span>
              <span className="text-xs font-bold" style={{ color: sig.color }}>{sig.label}</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px]" style={{ color: trend.color }}>{trend.label} Trend</span>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.goldImplication}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>OPEN INTEREST</div>
          <div className="text-base font-black" style={{ color: "#60a5fa" }}>
            {(data.openInterestContracts / 1000).toFixed(0)}k
          </div>
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>contracts = {data.openInterestTonnes}t</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>REGISTERED VAULT</div>
          <div className="text-base font-black" style={{ color: "#34d399" }}>{data.registeredVaultTonnes}t</div>
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>physical backing</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>LEVERAGE</div>
          <div className="text-base font-black" style={{ color: sig.color }}>{data.leverageRatio.toFixed(1)}×</div>
          <div className="text-[9px]" style={{ color: trend.color }}>{trend.label}</div>
        </div>
      </div>

      {/* Insight */}
      <p className="text-[10px] leading-relaxed px-1" style={{ color: "rgba(175,185,215,0.5)" }}>{data.insight}</p>

      {/* 12-week leverage chart */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold mb-3" style={{ color: "rgba(175,185,215,0.5)" }}>12-WEEK LEVERAGE HISTORY</div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${data.history.length}, 1fr)` }}>
          {data.history.map((w, i) => {
            const isLast = i === data.history.length - 1;
            const pct = (w.leverage / (maxLeverage + 1)) * 80;
            const hMeta = HIST_SIG_META[w.signal];
            return (
              <div key={w.week} className="flex flex-col items-center gap-0.5">
                <div className="text-[7px] font-mono" style={{ color: hMeta.color }}>{w.leverage.toFixed(1)}x</div>
                <div className="w-full flex flex-col justify-end" style={{ height: "60px" }}>
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${pct}%`,
                      background: isLast ? hMeta.color : `${hMeta.color}88`,
                    }}
                  />
                </div>
                <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.25)", writingMode: "vertical-rl", transform: "rotate(180deg)", height: "28px" }}>
                  {w.week}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 mt-2 text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          <span><span style={{ color: "#f87171" }}>■</span> Extreme (&gt;6×)</span>
          <span><span style={{ color: "#fb923c" }}>■</span> High (4-6×)</span>
          <span><span style={{ color: "#f5c451" }}>■</span> Moderate (2-4×)</span>
          <span><span style={{ color: "#34d399" }}>■</span> Low (&lt;2×)</span>
        </div>
      </div>

      {/* Historical extremes */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          HISTORICAL EXTREME LEVERAGE EVENTS
        </div>
        {data.extremes.map((ex, i) => (
          <div key={ex.date} className="flex items-center gap-4 px-4 py-2.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
            <div className="w-16 text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>{ex.date}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold" style={{ color: ex.leverage > 8 ? "#f87171" : "#fb923c" }}>{ex.leverage}×</span>
                <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(ex.leverage / 12) * 100}%`, background: ex.leverage > 8 ? "#f87171" : "#fb923c" }} />
                </div>
              </div>
            </div>
            <div className="text-right w-24">
              <div className="text-[10px] font-bold" style={{ color: ex.priceAfter30d >= 0 ? "#34d399" : "#f87171" }}>
                {ex.priceAfter30d >= 0 ? "+" : ""}{ex.priceAfter30d.toFixed(1)}%
              </div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>gold 30D after</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        OI from CME Group / leverage model from COMEX warehouse data · 1-hour cache · Not financial advice
      </p>
    </div>
  );
}
