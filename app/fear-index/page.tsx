"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { FearIndexPayload, FearComponent } from "@/app/api/fear-index/route";

const SIGNAL_LABEL = {
  extreme_fear: "Extreme Fear",
  fear: "Fear",
  neutral: "Neutral",
  greed: "Greed",
  extreme_greed: "Extreme Greed",
};

function GaugeArc({ score, color }: { score: number; color: string }) {
  const r = 54;
  const cx = 70, cy = 70;
  const totalArc = Math.PI;
  const arcLen = 2 * Math.PI * r * (totalArc / (2 * Math.PI));
  const pct = score / 100;
  const x1 = cx + r * Math.cos(Math.PI);
  const y1 = cy + r * Math.sin(Math.PI);
  const x2 = cx + r * Math.cos(Math.PI + totalArc);
  const y2 = cy + r * Math.sin(Math.PI + totalArc);
  const x3 = cx + r * Math.cos(Math.PI + totalArc * pct);
  const y3 = cy + r * Math.sin(Math.PI + totalArc * pct);
  const startAngle = Math.PI;
  const endAngle = Math.PI + totalArc * pct;
  const lf = totalArc * pct > Math.PI ? 1 : 0;

  return (
    <svg viewBox="0 0 140 85" className="w-full max-w-[180px] mx-auto">
      {/* Background arc */}
      <path
        d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 1 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" strokeLinecap="round"
      />
      {/* Filled arc */}
      {pct > 0 && (
        <path
          d={`M ${(cx + r * Math.cos(startAngle)).toFixed(1)} ${(cy + r * Math.sin(startAngle)).toFixed(1)} A ${r} ${r} 0 ${lf} 1 ${x3.toFixed(1)} ${y3.toFixed(1)}`}
          fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" opacity="0.85"
        />
      )}
      {/* Center text */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="22" fontWeight="900">{score}</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(175,185,215,0.5)" fontSize="7">/ 100</text>
    </svg>
  );
}

export default function FearIndexPage() {
  const { tier } = useTier();
  const [data, setData] = useState<FearIndexPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/fear-index", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/fear-index")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Computing fear index…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="😱 Multi-Asset Fear Index"
        subtitle="Composite fear gauge from VIX, credit, momentum, safe-haven flows — with gold implication"
      />

      {/* ── Fear Gauge ─── */}
      <div className="panel px-5 py-5 flex items-center gap-6"
        style={{ border: `1px solid ${data.compositeColor}30`, background: data.compositeColor + "05" }}>
        <div className="w-[160px] shrink-0">
          <GaugeArc score={data.compositeScore} color={data.compositeColor} />
          <div className="text-center mt-1">
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: data.compositeColor }}>
              {data.compositeLabel}
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.compositeDescription}</div>
          <div className="rounded-xl px-3 py-2.5" style={{ background: data.goldImplicationColor + "08", border: `1px solid ${data.goldImplicationColor}20` }}>
            <div className="text-[7px] uppercase tracking-wider mb-0.5" style={{ color: data.goldImplicationColor + "99" }}>Gold Implication</div>
            <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.55)" }}>{data.goldImplication}</div>
          </div>
          {data.goldBenefiting && (
            <div className="text-[8px] font-bold" style={{ color: "#34d399" }}>
              ✓ Gold currently rising while fear elevated — safe-haven demand confirmed
            </div>
          )}
        </div>
      </div>

      {/* ── Fear scale reference ─── */}
      <div className="panel px-5 py-3 flex items-center gap-2">
        {[
          { label: "Extreme Greed", range: "0-20", color: "#34d399" },
          { label: "Greed", range: "20-40", color: "#86efac" },
          { label: "Neutral", range: "40-60", color: "#f5c451" },
          { label: "Fear", range: "60-80", color: "#fb923c" },
          { label: "Extreme Fear", range: "80-100", color: "#f87171" },
        ].map(s => (
          <div key={s.label} className="flex-1 text-center">
            <div className="h-1.5 rounded-full mx-auto mb-1" style={{ background: s.color + "60" }} />
            <div className="text-[6px] uppercase tracking-wider" style={{ color: s.color + "99" }}>{s.label}</div>
            <div className="text-[6px]" style={{ color: "rgba(175,185,215,0.2)" }}>{s.range}</div>
          </div>
        ))}
      </div>

      {/* ── Component Breakdown ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🔬 Fear Index Components
        </div>
        {data.components.map((c: FearComponent) => (
          <div key={c.name} className="rounded-xl px-4 py-3"
            style={{ background: c.signalColor + "06", border: `1px solid ${c.signalColor}18` }}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">{c.icon}</span>
                <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{c.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[7px] px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ color: c.signalColor, background: c.signalColor + "18", border: `1px solid ${c.signalColor}30` }}>
                  {SIGNAL_LABEL[c.signal]}
                </span>
                <span className="text-[8px] font-black" style={{ color: c.signalColor }}>{c.score}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full mb-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: c.signalColor + "80" }} />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{c.description}</div>
              <div className="text-[7px] shrink-0 ml-2" style={{ color: "rgba(175,185,215,0.25)" }}>weight {c.weight}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Historical Context ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>📜 Historical Context</div>
        <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.historicalContext}</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[
            { rule: "VIX > 30 (Extreme Fear)", action: "Historically a contrarian buy signal — gold often rallies 5-15% in the following 30 days as panic peaks" },
            { rule: "VIX < 15 (Extreme Greed)", action: "Complacency phase — gold tends to drift lower as alternative investments capture more capital" },
            { rule: "Credit spreads widening", action: "HYG falling = credit stress rising → supports gold as flight-to-quality accelerates" },
            { rule: "Defensive rotation (XLU > XLF)", action: "Smart money rotating to utilities over financials signals risk-off posture — gold supportive" },
          ].map(item => (
            <div key={item.rule} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[7px] font-bold mb-0.5" style={{ color: "#c084fc" }}>{item.rule}</div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.4)" }}>{item.action}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · VIX/HYG/XLU/XLF/SPX data · Updates every 15 min · Not financial advice
      </div>
    </div>
  );
}
