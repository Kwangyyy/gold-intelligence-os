"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { PositionDashboardPayload, PositionSource } from "@/app/api/position-dashboard/route";

const SIGNAL_COLOR: Record<string, string> = {
  very_bullish: "#34d399",
  bullish: "#86efac",
  neutral: "#f5c451",
  bearish: "#fb923c",
  very_bearish: "#f87171",
};

const SIGNAL_LABEL: Record<string, string> = {
  very_bullish: "Very Bullish",
  bullish: "Bullish",
  neutral: "Neutral",
  bearish: "Bearish",
  very_bearish: "Very Bearish",
};

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const angle = -135 + (score / 100) * 270;
  const r = 42;
  const cx = 60, cy = 60;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcX = cx + r * Math.cos(toRad(angle - 90));
  const arcY = cy + r * Math.sin(toRad(angle - 90));
  const arcPath = `M ${cx + r * Math.cos(toRad(-225))} ${cy + r * Math.sin(toRad(-225))} A ${r} ${r} 0 1 1 ${arcX} ${arcY}`;

  return (
    <svg viewBox="0 0 120 100" className="w-28 h-24">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" strokeDasharray="220 360" strokeDashoffset="-70" strokeLinecap="round" />
      <path d={arcPath} fill="none" stroke={color + "60"} strokeWidth="10" strokeLinecap="round" />
      <text x={cx} y={cy + 6} textAnchor="middle" fill={color} fontSize="18" fontWeight="900">{score}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fill="rgba(175,185,215,0.4)" fontSize="7">/ 100</text>
    </svg>
  );
}

export default function PositionDashboardPage() {
  const { tier } = useTier();
  const [data, setData] = useState<PositionDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/position-dashboard", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/position-dashboard")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Aggregating positioning data…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="📍 Position Dashboard"
        subtitle="Composite market positioning: ETF flows, miner sentiment, momentum, credit, dollar"
      />

      {/* ── Contrarian Alert ─── */}
      {data.contrarianNote && (
        <div className="panel px-5 py-3 rounded-xl"
          style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <div className="text-[9px] font-bold" style={{ color: "#f87171" }}>{data.contrarianNote}</div>
        </div>
      )}

      {/* ── Composite Score ─── */}
      <div className="panel px-5 py-5 flex items-center gap-5">
        <ScoreGauge score={data.compositeScore} color={data.compositeColor} />
        <div className="flex-1 space-y-2">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Composite Positioning</div>
          <div className="text-lg font-black leading-tight" style={{ color: data.compositeColor }}>
            {data.compositeLabel}
          </div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>
            {data.interpretation}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Gold:</div>
            <div className="text-[9px] font-black" style={{ color: "#f5c451" }}>
              ${data.goldPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </div>
            <div className="text-[8px]" style={{ color: data.goldChange1DPct >= 0 ? "#34d399" : "#f87171" }}>
              ({data.goldChange1DPct >= 0 ? "+" : ""}{data.goldChange1DPct.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      {/* ── Score Bar ─── */}
      <div className="panel px-5 py-4 space-y-3">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Positioning Spectrum</div>
        <div className="relative h-5 rounded-full overflow-hidden"
          style={{ background: "linear-gradient(90deg, #c084fc 0%, #f87171 20%, #fb923c 35%, #f5c451 45%, #86efac 65%, #34d399 80%, #ef4444 100%)" }}>
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg"
            style={{ left: `calc(${data.compositeScore}% - 6px)`, boxShadow: "0 0 8px rgba(255,255,255,0.7)" }} />
        </div>
        <div className="flex justify-between text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          <span>Extreme Short (0)</span>
          <span>Neutral (50)</span>
          <span>Extreme Long (100)</span>
        </div>
      </div>

      {/* ── Source Cards ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Positioning Components
        </div>
        {data.sources.map((s: PositionSource) => {
          const sColor = SIGNAL_COLOR[s.signal];
          const weightPct = Math.round(s.weight * 100);
          return (
            <div key={s.name} className="rounded-xl px-4 py-3"
              style={{ background: sColor + "06", border: `1px solid ${sColor}20` }}>
              <div className="flex items-center gap-3">
                <span className="text-xl shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] px-1 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.4)" }}>
                        {weightPct}% weight
                      </span>
                      <span className="text-[7px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: sColor + "20", color: sColor }}>
                        {SIGNAL_LABEL[s.signal]}
                      </span>
                    </div>
                  </div>
                  <div className="text-[7px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>{s.detail}</div>
                  <div className="mt-1.5 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full" style={{ width: `${s.value}%`, background: sColor + "70" }} />
                  </div>
                </div>
                <div className="shrink-0 text-[10px] font-black" style={{ color: sColor }}>{s.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Key Risk ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>⚠️ Key Risk</div>
        <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.keyRisk}</div>
      </div>

      {/* ── Historical Bands ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>📊 Score Interpretation Bands</div>
        {data.historicalBands.map(band => (
          <div key={band.label} className="flex items-center gap-3 text-[8px]">
            <div className="w-8 h-1.5 rounded-full shrink-0" style={{ background: band.color + "80" }} />
            <span style={{ color: "rgba(175,185,215,0.3)" }}>{band.minVal}–{band.maxVal}</span>
            <span style={{ color: "rgba(175,185,215,0.5)" }}>{band.label}</span>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Derived positioning estimate · Not financial advice · Updates every 30 min
      </div>
    </div>
  );
}
