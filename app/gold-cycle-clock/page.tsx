"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { GoldCyclePayload, CycleIndicator } from "@/app/api/gold-cycle-clock/route";

const PHASES = [
  { phase: "accumulation", angle: 315, label: "Accum." },
  { phase: "early_bull",   angle: 45,  label: "Early Bull" },
  { phase: "mid_bull",     angle: 90,  label: "Mid Bull" },
  { phase: "late_bull",    angle: 135, label: "Late Bull" },
  { phase: "distribution", angle: 180, label: "Distrib." },
  { phase: "early_bear",   angle: 225, label: "Early Bear" },
  { phase: "mid_bear",     angle: 270, label: "Mid Bear" },
  { phase: "late_bear",    angle: 285, label: "Late Bear" },
];

const PHASE_COLORS: Record<string, string> = {
  accumulation: "#60a5fa", early_bull: "#34d399", mid_bull: "#4ade80",
  late_bull: "#fbbf24",    distribution: "#f97316", early_bear: "#fb923c",
  mid_bear: "#f87171",     late_bear: "#a78bfa",
};

function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function ClockDial({ phase, angle, color }: { phase: string; angle: number; color: string }) {
  const cx = 110, cy = 110, R = 90, r = 72;

  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[220px] mx-auto">
      {/* Outer ring ticks */}
      {PHASES.map((p) => {
        const outer = polarToXY(p.angle, R + 10, cx, cy);
        const inner = polarToXY(p.angle, R + 3, cx, cy);
        const isActive = p.phase === phase;
        return (
          <g key={p.phase}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={PHASE_COLORS[p.phase]} strokeWidth={isActive ? 3 : 1} opacity={isActive ? 1 : 0.3} />
          </g>
        );
      })}

      {/* Clock segments */}
      {PHASES.map((p, i) => {
        const next = PHASES[(i + 1) % PHASES.length];
        const startAngle = p.angle;
        const endAngle = next.angle;
        const isActive = p.phase === phase;
        const sa = ((startAngle - 90) * Math.PI) / 180;
        const ea = ((endAngle - 90) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
        const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
        const x3 = cx + R * Math.cos(ea), y3 = cy + R * Math.sin(ea);
        const x4 = cx + R * Math.cos(sa), y4 = cy + R * Math.sin(sa);
        let diff = endAngle - startAngle;
        if (diff < 0) diff += 360;
        const large = diff > 180 ? 1 : 0;
        const d = [
          `M ${x1} ${y1}`,
          `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${R} ${R} 0 ${large} 0 ${x4} ${y4}`,
          "Z",
        ].join(" ");
        return (
          <path key={p.phase} d={d} fill={PHASE_COLORS[p.phase]}
            opacity={isActive ? 0.35 : 0.06} stroke={PHASE_COLORS[p.phase]} strokeWidth={isActive ? 1 : 0.5} strokeOpacity={0.4} />
        );
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={26} fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />

      {/* Needle */}
      {(() => {
        const tip = polarToXY(angle, R - 2, cx, cy);
        const base1 = polarToXY(angle + 90, 6, cx, cy);
        const base2 = polarToXY(angle - 90, 6, cx, cy);
        return (
          <polygon
            points={`${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`}
            fill={color} opacity={0.9}
          />
        );
      })()}

      {/* Center label */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="8" fontWeight="bold" className="font-mono">
        PHASE
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill={color} fontSize="6" opacity={0.7}>
        CLOCK
      </text>

      {/* Phase labels */}
      {PHASES.map((p) => {
        const pos = polarToXY(p.angle, R + 18, cx, cy);
        const isActive = p.phase === phase;
        return (
          <text key={p.phase} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
            fill={PHASE_COLORS[p.phase]} fontSize={isActive ? "5.5" : "4.5"} fontWeight={isActive ? "bold" : "normal"}
            opacity={isActive ? 1 : 0.4}>
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function GoldCycleClockPage() {
  const { tier } = useTier();
  const [data, setData] = useState<GoldCyclePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/gold-cycle-clock", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/gold-cycle-clock")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Detecting market cycle phase…</div>
    </div>
  );
  if (!data) return null;

  const c = data.phaseColor;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🕐 Gold Cycle Clock"
        subtitle="Market cycle phase detection — momentum, RSI, drawdown, DXY, and Fed cycle mapped to 8-phase gold clock"
      />

      {/* ── Phase Banner ─── */}
      <div className="panel px-5 py-4" style={{ border: `1px solid ${c}30`, background: c + "06" }}>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Current Cycle Phase</div>
            <div className="text-2xl font-black mt-0.5" style={{ color: c }}>{data.phaseLabel}</div>
            <div className="text-[8px] leading-relaxed mt-1.5" style={{ color: "rgba(175,185,215,0.45)" }}>
              {data.phaseDescription}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div>
                <div className="text-[6px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.25)" }}>Phase Progress</div>
                <div className="w-24 h-1.5 rounded-full mt-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="h-full rounded-full" style={{ width: `${data.cycleProgress}%`, background: c + "90" }} />
                </div>
              </div>
              <div>
                <div className="text-[6px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.25)" }}>Next Phase</div>
                <div className="text-[8px] font-bold" style={{ color: PHASE_COLORS[data.nextPhase] ?? "#94a3b8" }}>
                  → {data.nextPhaseLabel}
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right space-y-1">
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>6M Change</div>
            <div className="text-lg font-black" style={{ color: data.goldChange6M >= 0 ? "#34d399" : "#f87171" }}>
              {data.goldChange6M >= 0 ? "+" : ""}{data.goldChange6M.toFixed(1)}%
            </div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>1Y Change</div>
            <div className="text-sm font-bold" style={{ color: data.goldChange1Y >= 0 ? "#34d399" : "#f87171" }}>
              {data.goldChange1Y >= 0 ? "+" : ""}{data.goldChange1Y.toFixed(1)}%
            </div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Off 52W High</div>
            <div className="text-sm font-bold" style={{ color: data.drawdown > -5 ? "#34d399" : data.drawdown > -15 ? "#fbbf24" : "#f87171" }}>
              {data.drawdown.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* ── Clock Dial + Key Stats ─── */}
      <div className="grid grid-cols-[220px_1fr] gap-4 items-start">
        <ClockDial phase={data.phase} angle={data.phaseAngle} color={c} />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "RSI (14)", val: data.rsi14.toFixed(1), color: data.rsi14 >= 70 ? "#f87171" : data.rsi14 <= 30 ? "#34d399" : "#f5c451" },
              { label: "RSI (28)", val: data.rsi28.toFixed(1), color: data.rsi28 >= 65 ? "#f87171" : data.rsi28 <= 35 ? "#34d399" : "#94a3b8" },
            ].map(item => (
              <div key={item.label} className="panel px-3 py-3 text-center">
                <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{item.label}</div>
                <div className="text-xl font-black" style={{ color: item.color }}>{item.val}</div>
              </div>
            ))}
          </div>
          <div className="panel px-3 py-3 space-y-1.5">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Cycle Context</div>
            <div className="text-[7px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>
              <span className="font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>DXY: </span>{data.dxyTrend}
            </div>
            <div className="text-[7px] leading-relaxed" style={{ color: "rgba(175,185,215,0.4)" }}>
              <span className="font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>Fed: </span>{data.fedCycle}
            </div>
          </div>
        </div>
      </div>

      {/* ── Indicators Table ─── */}
      <div className="panel px-5 py-5 space-y-2">
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Cycle Indicator Breakdown
        </div>
        {data.indicators.map((ind: CycleIndicator) => (
          <div key={ind.name} className="flex items-start justify-between gap-3 py-1.5 border-b border-white/[0.03] last:border-0">
            <div className="flex-1">
              <div className="text-[8px] font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>{ind.name}</div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                {ind.value} · Phase hint: {ind.contribution}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[7px] font-bold" style={{ color: ind.bullish ? "#34d399" : "#f87171" }}>
                {ind.signal}
              </div>
              <div className="text-[6px]" style={{ color: "rgba(175,185,215,0.25)" }}>{ind.bullish ? "↑ Bullish" : "↓ Bearish"}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Watch For ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: c }}>
          👁️ What to Watch in {data.phaseLabel} Phase
        </div>
        {data.watchFor.map((w, i) => (
          <div key={i} className="flex gap-2 text-[8px]">
            <span style={{ color: c }}>→</span>
            <span style={{ color: "rgba(175,185,215,0.4)" }}>{w}</span>
          </div>
        ))}
      </div>

      {/* ── Phase Reference Guide ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>📚 8-Phase Cycle Reference</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { ph: "Accumulation", clue: "Oversold, smart money buying, sentiment negative" },
            { ph: "Early Bull",   clue: "Trend reversing, breaking above key MAs" },
            { ph: "Mid Bull",     clue: "Best risk/reward, strong momentum, clear trend" },
            { ph: "Late Bull",    clue: "Parabolic, RSI>70, FOMO, vol rising" },
            { ph: "Distribution", clue: "Choppy, divergences, institutions selling" },
            { ph: "Early Bear",   clue: "Trend broken, lower highs, negative momentum" },
            { ph: "Mid Bear",     clue: "Downtrend, capitulation waves, weak hands exit" },
            { ph: "Late Bear",    clue: "Exhaustion, RSI 25-30, bottoming begins" },
          ].map(item => (
            <div key={item.ph} className="flex gap-1.5">
              <div className="w-1.5 h-1.5 mt-0.5 rounded-full shrink-0" style={{ background: PHASE_COLORS[item.ph.toLowerCase().replace(" ", "_").replace(".", "")] ?? "#94a3b8" }} />
              <div>
                <div className="text-[7px] font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>{item.ph}</div>
                <div className="text-[6.5px]" style={{ color: "rgba(175,185,215,0.3)" }}>{item.clue}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Heuristic cycle detection · Not financial advice
      </div>
    </div>
  );
}
