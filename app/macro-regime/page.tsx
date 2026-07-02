"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface RegimeQuadrant {
  id: string;
  growth: "rising" | "falling";
  inflation: "rising" | "falling";
  label: string;
  goldReturn30d: number;
  goldReturn90d: number;
  winRate: number;
  description: string;
  examples: string[];
  goldAction: string;
}

interface MacroIndicator {
  name: string;
  value: number;
  change1m: number;
  direction: "rising" | "falling" | "stable";
  trend: string;
  signal: string;
}

interface MacroRegimeData {
  currentQuadrant: string;
  growthDirection: "rising" | "falling";
  inflationDirection: "rising" | "falling";
  confidence: number;
  indicators: MacroIndicator[];
  quadrants: RegimeQuadrant[];
  goldPrice: number;
  goldChange1m: number;
  insight: string;
  timestamp: string;
}

const QUADRANT_COLORS: Record<string, string> = {
  q1: "#f97316", // overheating — orange
  q2: "#22c55e", // stagflation — green (best for gold)
  q3: "#ef4444", // goldilocks — red (worst for gold)
  q4: "#3b82f6", // recession — blue
};

const QUADRANT_ICONS: Record<string, string> = {
  q1: "🌡️", q2: "⚡", q3: "☀️", q4: "❄️",
};

const DIR_STYLE = {
  rising:  { color: "text-green-400", icon: "↑" },
  falling: { color: "text-red-400",   icon: "↓" },
  stable:  { color: "text-slate-400", icon: "→" },
};

export default function MacroRegimePage() {
  const { t } = useI18n();
  const [data, setData] = useState<MacroRegimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/macro-regime")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-400 text-lg">Detecting macro regime…</div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-400">Failed to load data.</div>
    </div>
  );

  const currentQ = data.quadrants.find(q => q.id === data.currentQuadrant)!;
  const qColor = QUADRANT_COLORS[data.currentQuadrant] ?? "#64748b";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🧭 {t("navMacroRegime")}</h1>
        <p className="text-slate-400 mt-1 text-sm">
          2×2 Growth/Inflation macro quadrant — current regime detection and gold performance by regime.
        </p>
      </div>

      {/* Current regime hero */}
      <div className="rounded-xl p-6 border" style={{ borderColor: `${qColor}40`, background: `${qColor}15` }}>
        <div className="flex flex-wrap gap-6 items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs mb-1">Current Macro Regime</div>
            <div className="text-3xl font-bold text-white flex items-center gap-2">
              <span>{QUADRANT_ICONS[data.currentQuadrant]}</span>
              <span style={{ color: qColor }}>{currentQ.label}</span>
            </div>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-slate-400">Growth: <span className={DIR_STYLE[data.growthDirection].color}>{DIR_STYLE[data.growthDirection].icon} {data.growthDirection}</span></span>
              <span className="text-slate-400">Inflation: <span className={DIR_STYLE[data.inflationDirection].color}>{DIR_STYLE[data.inflationDirection].icon} {data.inflationDirection}</span></span>
            </div>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-slate-400 text-xs">Gold 30D avg return (this regime)</div>
              <div className={`text-2xl font-bold ${currentQ.goldReturn30d >= 0 ? "text-green-400" : "text-red-400"}`}>
                {currentQ.goldReturn30d >= 0 ? "+" : ""}{currentQ.goldReturn30d}%
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Historical win rate</div>
              <div className="text-blue-400 text-2xl font-bold">{currentQ.winRate}%</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Signal confidence</div>
              <div className="text-yellow-400 text-2xl font-bold">{data.confidence}%</div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-slate-300 text-sm">{currentQ.description}</div>
        <div className="mt-3 p-3 rounded-lg text-sm font-semibold" style={{ backgroundColor: `${qColor}20`, color: qColor, border: `1px solid ${qColor}40` }}>
          🎯 {currentQ.goldAction}
        </div>
      </div>

      {/* Insight */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-slate-300 text-sm">
        💡 {data.insight}
      </div>

      {/* 2x2 quadrant matrix */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Macro Quadrant Matrix</h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Labels */}
          <div className="col-span-2 flex justify-center gap-3 text-xs text-slate-500 mb-1">
            <span>← Growth Falling</span>
            <span>|</span>
            <span>Growth Rising →</span>
          </div>
          {[
            data.quadrants.find(q => q.id === "q2")!,
            data.quadrants.find(q => q.id === "q1")!,
            data.quadrants.find(q => q.id === "q4")!,
            data.quadrants.find(q => q.id === "q3")!,
          ].map((q, i) => {
            const isActive = q.id === data.currentQuadrant;
            const color = QUADRANT_COLORS[q.id];
            return (
              <div
                key={q.id}
                className="rounded-xl p-4 border-2 transition-all"
                style={{
                  borderColor: isActive ? color : `${color}30`,
                  backgroundColor: isActive ? `${color}20` : `${color}08`,
                  boxShadow: isActive ? `0 0 20px ${color}30, 0 0 0 2px ${color}60` : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{QUADRANT_ICONS[q.id]}</span>
                  {isActive && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${color}30`, color }}>← NOW</span>}
                  <span className="text-xs" style={{ color }}>{q.inflation === "rising" ? "Infl ↑" : "Infl ↓"}</span>
                </div>
                <div className="font-semibold text-white text-sm mb-1">{q.label}</div>
                <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                  <div className="text-slate-400">30D gold avg</div>
                  <div className={`font-bold text-right ${q.goldReturn30d >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {q.goldReturn30d >= 0 ? "+" : ""}{q.goldReturn30d}%
                  </div>
                  <div className="text-slate-400">Win rate</div>
                  <div className="text-blue-400 font-bold text-right">{q.winRate}%</div>
                </div>
                <div className="text-slate-500 text-xs mt-2">{q.examples.slice(0, 2).join(", ")}</div>
              </div>
            );
          })}
        </div>
        <div className="text-center text-xs text-slate-500 mt-2">
          Top row = Inflation Rising | Bottom row = Inflation Falling
        </div>
      </div>

      {/* Macro indicators */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-white font-semibold">Macro Indicators Used</h2>
          <p className="text-slate-500 text-xs mt-1">Updated: {new Date(data.timestamp).toLocaleString()}</p>
        </div>
        <div className="divide-y divide-slate-800/60">
          {data.indicators.map(ind => {
            const ds = DIR_STYLE[ind.direction];
            return (
              <div key={ind.name} className="px-6 py-4 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-48">
                  <div className="text-white font-semibold text-sm">{ind.name}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{ind.trend}</div>
                </div>
                <div className="text-white font-mono">{ind.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                <div className={`font-semibold ${ind.change1m >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {ind.change1m >= 0 ? "+" : ""}{ind.change1m.toFixed(2)}% 1M
                </div>
                <div className={`flex items-center gap-1 ${ds.color}`}>
                  <span>{ds.icon}</span>
                  <span className="text-sm font-semibold capitalize">{ind.direction}</span>
                </div>
                <div className="text-slate-400 text-xs px-2 py-0.5 bg-slate-800 rounded">{ind.signal}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All regimes */}
      <div className="space-y-3">
        <h2 className="text-white font-semibold text-lg">All Regime Playbooks</h2>
        {data.quadrants.map(q => {
          const color = QUADRANT_COLORS[q.id];
          const isActive = q.id === data.currentQuadrant;
          return (
            <div key={q.id} className={`rounded-xl border p-5 ${isActive ? "ring-1" : ""}`}
              style={{ borderColor: isActive ? color : `${color}30`, backgroundColor: `${color}08` }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{QUADRANT_ICONS[q.id]}</span>
                <div>
                  <span className="text-white font-semibold">{q.label}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    Growth {q.growth} · Inflation {q.inflation}
                  </span>
                  {isActive && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${color}30`, color }}>CURRENT</span>}
                </div>
                <div className="ml-auto flex gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-slate-400 text-xs">30D avg</div>
                    <div className={`font-bold ${q.goldReturn30d >= 0 ? "text-green-400" : "text-red-400"}`}>{q.goldReturn30d >= 0 ? "+" : ""}{q.goldReturn30d}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400 text-xs">90D avg</div>
                    <div className={`font-bold ${q.goldReturn90d >= 0 ? "text-green-400" : "text-red-400"}`}>{q.goldReturn90d >= 0 ? "+" : ""}{q.goldReturn90d}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400 text-xs">Win rate</div>
                    <div className="text-blue-400 font-bold">{q.winRate}%</div>
                  </div>
                </div>
              </div>
              <p className="text-slate-300 text-sm mb-2">{q.description}</p>
              <div className="text-xs font-semibold px-3 py-2 rounded" style={{ backgroundColor: `${color}20`, color }}>
                🎯 {q.goldAction}
              </div>
              <div className="text-slate-500 text-xs mt-2">Historical examples: {q.examples.join(", ")}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
