"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { VolumeProfilePayload, VolumeBar, VolumeLevel } from "@/app/api/volume-profile/route";

const TREND_COLOR = { rising: "#34d399", flat: "#f5c451", falling: "#f87171" };
const TREND_ICON = { rising: "▲", flat: "→", falling: "▼" };
const SIG_COLOR = { bullish: "#34d399", neutral: "#f5c451", bearish: "#f87171" };

export default function VolumeProfilePage() {
  const { tier } = useTier();
  const [data, setData] = useState<VolumeProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/volume-profile", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/volume-profile")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Premium tier required</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Analyzing volume profile…</div>
    </div>
  );
  if (!data) return null;

  const maxVol = Math.max(...data.volumeLevels.map(l => l.pct));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="📊 Volume Profile"
        subtitle="OBV, PVT, A/D Line, price-by-volume (30D) — confirms whether price moves have institutional backing"
      />

      {/* ── Summary Stats ─── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "OBV Trend", value: TREND_ICON[data.obvTrend], sub: data.obvTrend, color: TREND_COLOR[data.obvTrend] },
          { label: "A/D Line", value: TREND_ICON[data.adLineTrend], sub: data.adLineTrend, color: TREND_COLOR[data.adLineTrend] },
          { label: "Vol Ratio", value: `${data.volumeRatio.toFixed(1)}×`, sub: data.volumeExpansion ? "Expanding" : "Normal", color: data.volumeExpansion ? "#c084fc" : "#9ca3af" },
          { label: "POC Level", value: `$${data.pocPrice.toFixed(0)}`, sub: `${data.pocPct > 0 ? "+" : ""}${data.pocPct.toFixed(1)}% from now`, color: "#f5c451" },
        ].map(m => (
          <div key={m.label} className="panel px-3 py-3 space-y-0.5 text-center">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{m.label}</div>
            <div className="text-xl font-black" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[7px] capitalize" style={{ color: "rgba(175,185,215,0.35)" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Interpretation ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>💡 Volume Signal</div>
        <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>{data.interpretation}</p>
        {data.confluences.map((c, i) => (
          <div key={i} className="flex items-start gap-2 text-[8px]" style={{ color: "rgba(175,185,215,0.45)" }}>
            <span style={{ color: "#c084fc" }}>•</span>
            <span>{c}</span>
          </div>
        ))}
      </div>

      {/* ── Volume Indicators Panel ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📈 Volume Indicators (3-Month)
        </div>
        {[
          { name: "OBV (On Balance Volume)", trend: data.obvTrend, signal: data.obvSignal, desc: "Adds volume on up days, subtracts on down days. Rising OBV = accumulation." },
          { name: "PVT (Price-Volume Trend)", trend: data.pvtTrend, signal: data.obvSignal, desc: "Weighted by % price change. More sensitive than OBV to momentum shifts." },
          { name: "A/D Line (Accumulation/Distribution)", trend: data.adLineTrend, signal: data.adLineSignal, desc: "Uses closing position within day's range × volume. Best for institutional flow." },
        ].map(ind => (
          <div key={ind.name} className="rounded-xl px-4 py-3"
            style={{ background: SIG_COLOR[ind.signal] + "06", border: `1px solid ${SIG_COLOR[ind.signal]}20` }}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>{ind.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold capitalize" style={{ color: TREND_COLOR[ind.trend] }}>
                  {TREND_ICON[ind.trend]} {ind.trend}
                </span>
                <span className="text-[7px] px-1.5 py-0.5 rounded capitalize"
                  style={{ background: SIG_COLOR[ind.signal] + "20", color: SIG_COLOR[ind.signal] }}>
                  {ind.signal}
                </span>
              </div>
            </div>
            <div className="text-[7px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>{ind.desc}</div>
          </div>
        ))}
      </div>

      {/* ── Price-by-Volume (Volume Profile) ─── */}
      <div className="panel px-5 py-5 space-y-2">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📐 Price-by-Volume (30D)
        </div>
        <div className="text-[8px] mb-3" style={{ color: "rgba(175,185,215,0.35)" }}>
          Point of Control (POC): <span style={{ color: "#f5c451", fontWeight: 700 }}>${data.pocPrice.toFixed(1)}</span>
          <span className="ml-2" style={{ color: data.pocPct > 0 ? "#34d399" : "#f87171" }}>
            ({data.pocPct > 0 ? "+" : ""}{data.pocPct.toFixed(1)}% from current)
          </span>
        </div>
        <div className="space-y-1">
          {[...data.volumeLevels].reverse().map((lv: VolumeLevel, i) => {
            const isPOC = lv.pct === maxVol;
            const isCurrent = data.goldPrice >= lv.priceMin && data.goldPrice < lv.priceMax;
            const barW = maxVol > 0 ? (lv.pct / maxVol) * 100 : 0;
            const barColor = isPOC ? "#f5c451" : isCurrent ? "#c084fc" : "#60a5fa";
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="text-[7px] w-20 text-right shrink-0" style={{ color: "rgba(175,185,215,0.35)" }}>
                  ${lv.priceMin.toFixed(0)}–{lv.priceMax.toFixed(0)}
                </div>
                <div className="flex-1 h-3 rounded-sm relative" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="h-full rounded-sm" style={{ width: `${barW}%`, background: barColor + "70" }} />
                  {(isPOC || isCurrent) && (
                    <span className="absolute right-1 top-0 text-[6px] leading-3 font-bold"
                      style={{ color: barColor }}>{isPOC ? "POC" : "↓"}</span>
                  )}
                </div>
                <div className="text-[7px] w-8 text-right shrink-0" style={{ color: "rgba(175,185,215,0.3)" }}>
                  {lv.pct.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Volume Bar Chart (last 20 days) ─── */}
      <div className="panel px-5 py-5 space-y-2">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📉 Daily Volume (Last 20 Days)
        </div>
        <div className="flex items-end gap-1 h-20">
          {data.recentBars.map((b: VolumeBar, i) => {
            const maxV = Math.max(...data.recentBars.map(x => x.volume));
            const hPct = maxV > 0 ? (b.volume / maxV) * 100 : 10;
            const col = b.volumeColor === "up" ? "#34d399" : b.volumeColor === "down" ? "#f87171" : "#9ca3af";
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="w-full rounded-sm" style={{ height: `${hPct}%`, background: col + "70" }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[6px]" style={{ color: "rgba(175,185,215,0.2)" }}>
          <span>{data.recentBars[0]?.date}</span>
          <span>MA20: {(data.volumeMA20 / 1000).toFixed(0)}K</span>
          <span>{data.recentBars[data.recentBars.length - 1]?.date}</span>
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Not financial advice · Updates every 15 min
      </div>
    </div>
  );
}
