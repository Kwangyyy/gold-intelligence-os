"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface CyclePhase {
  name: string;
  start: number;
  end: number | null;
  durationYears: number | null;
  peakPrice: number;
  troughPrice: number;
  gainPct: number;
  peakYear: number | null;
}

interface CurrentCycleData {
  cycleStart: number;
  currentPrice: number;
  cycleLow: number;
  cycleLowYear: number;
  gainFromLow: number;
  yearInCycle: number;
  projectedPeak: number | null;
  projectedPeakYear: number | null;
  phase: "early" | "mid" | "late" | "peak" | "correction";
  phaseDescription: string;
}

interface GoldCycleData {
  currentPrice: number;
  historicalCycles: CyclePhase[];
  currentCycle: CurrentCycleData;
  avgBullDuration: number;
  avgBullGain: number;
  insight: string;
  timestamp: string;
}

const PHASE_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  early:      { bg: "from-blue-900/30 to-blue-800/20",   border: "border-blue-600/40",   text: "text-blue-400",   label: "Early Bull" },
  mid:        { bg: "from-green-900/30 to-green-800/20", border: "border-green-600/40",  text: "text-green-400",  label: "Mid Bull" },
  late:       { bg: "from-yellow-900/30 to-amber-800/20", border: "border-yellow-500/40", text: "text-yellow-400", label: "Late Bull" },
  peak:       { bg: "from-red-900/30 to-rose-800/20",    border: "border-red-500/40",    text: "text-red-400",    label: "Peak Risk" },
  correction: { bg: "from-slate-800/50 to-slate-700/30", border: "border-slate-600/40",  text: "text-slate-300",  label: "Correction" },
};

export default function GoldCycleAnalysisPage() {
  const { t } = useI18n();
  const [data, setData] = useState<GoldCycleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gold-cycle-analysis")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-400 text-lg">Loading cycle analysis…</div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-400">Failed to load data.</div>
    </div>
  );

  const cc = data.currentCycle;
  const phase = PHASE_STYLE[cc.phase] ?? PHASE_STYLE.mid;
  const bullCycles = data.historicalCycles.filter(c => c.gainPct > 0);
  const maxGain = Math.max(...bullCycles.map(c => Math.abs(c.gainPct)));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🔄 {t("navGoldCycleAnalysis")}</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Historical gold bull/bear cycles — current phase, projected peak, and cycle timing analysis.
        </p>
      </div>

      {/* Current cycle hero */}
      <div className={`bg-gradient-to-r ${phase.bg} border ${phase.border} rounded-xl p-6`}>
        <div className="flex flex-wrap gap-8 items-start">
          <div>
            <div className="text-slate-400 text-xs mb-1">Current Cycle Phase</div>
            <div className={`text-3xl font-bold ${phase.text}`}>{phase.label}</div>
            <div className="text-slate-400 text-sm mt-1">Started: {cc.cycleLowYear} (year {cc.yearInCycle} of cycle)</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs mb-1">Cycle Low → Now</div>
            <div className="text-white font-mono text-lg">${cc.cycleLow.toLocaleString()} → ${cc.currentPrice.toLocaleString()}</div>
            <div className="text-green-400 font-bold text-xl">+{cc.gainFromLow.toFixed(1)}%</div>
          </div>
          {cc.projectedPeak && (
            <div>
              <div className="text-slate-400 text-xs mb-1">Avg Cycle Projected Peak</div>
              <div className="text-yellow-400 font-bold text-2xl">${cc.projectedPeak.toLocaleString()}</div>
              <div className="text-slate-400 text-xs mt-1">by ~{cc.projectedPeakYear} (avg {data.avgBullDuration}yr cycle)</div>
            </div>
          )}
          <div>
            <div className="text-slate-400 text-xs mb-1">Avg Bull Gain (historical)</div>
            <div className="text-blue-400 font-bold text-xl">+{data.avgBullGain}%</div>
            <div className="text-slate-400 text-xs mt-1">over {data.avgBullDuration} years avg</div>
          </div>
        </div>
        <div className="mt-4 text-slate-300 text-sm border-t border-slate-600/40 pt-4">
          {cc.phaseDescription}
        </div>
      </div>

      {/* Insight */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-slate-300 text-sm">
        💡 {data.insight}
      </div>

      {/* Historical cycles bar chart */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Historical Gold Cycles</h2>
        <div className="space-y-3">
          {data.historicalCycles.map((c, i) => {
            const isBull = c.gainPct > 0;
            const isCurrent = c.end === null;
            const barWidth = Math.min(100, Math.abs(c.gainPct) / maxGain * 100);
            const color = isBull ? "#22c55e" : "#ef4444";
            return (
              <div key={i} className={`rounded-lg p-3 ${isCurrent ? "bg-yellow-900/15 border border-yellow-600/30" : "bg-slate-800/40"}`}>
                <div className="flex flex-wrap justify-between items-start mb-2 gap-2">
                  <div>
                    <span className={`text-sm font-semibold ${isCurrent ? "text-yellow-400" : "text-white"}`}>
                      {c.name} {isCurrent && "← CURRENT"}
                    </span>
                    <span className="text-slate-500 text-xs ml-2">{c.start}–{c.end ?? "now"}</span>
                    {c.durationYears !== null && (
                      <span className="text-slate-500 text-xs ml-2">({c.durationYears} yr{c.durationYears !== 1 ? "s" : ""})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">${c.troughPrice.toLocaleString()} → ${c.peakPrice.toLocaleString()}</span>
                    <span className={`font-bold text-base ${isBull ? "text-green-400" : "text-red-400"}`}>
                      {c.gainPct > 0 ? "+" : ""}{c.gainPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-4 bg-slate-700 rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${barWidth}%`, backgroundColor: color, opacity: isCurrent ? 1 : 0.7 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cycle progress gauge */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Current Cycle Progress</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Cycle Start: {cc.cycleLowYear}</span>
              <span>Year {cc.yearInCycle} of {data.avgBullDuration} avg</span>
              <span>Avg Peak: ~{cc.projectedPeakYear}</span>
            </div>
            <div className="h-6 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-green-400 to-yellow-400"
                style={{ width: `${Math.min(100, (cc.yearInCycle / data.avgBullDuration) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0%</span>
              <span className={phase.text}>{((cc.yearInCycle / data.avgBullDuration) * 100).toFixed(0)}% through avg cycle</span>
              <span>100%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Gain from Low: 0%</span>
              <span>+{cc.gainFromLow.toFixed(1)}% now</span>
              <span>Avg Peak: +{data.avgBullGain}%</span>
            </div>
            <div className="h-6 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-yellow-400"
                style={{ width: `${Math.min(100, (cc.gainFromLow / data.avgBullGain) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0%</span>
              <span className={phase.text}>{((cc.gainFromLow / data.avgBullGain) * 100).toFixed(0)}% of avg cycle gain realized</span>
              <span>{data.avgBullGain}%</span>
            </div>
          </div>
        </div>

        {cc.projectedPeak && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-800/60 rounded-lg p-3 text-center">
              <div className="text-slate-400 text-xs">Remaining to Avg Peak</div>
              <div className="text-yellow-400 font-bold text-lg">${(cc.projectedPeak - cc.currentPrice).toLocaleString()}</div>
              <div className="text-slate-500 text-xs">+{(((cc.projectedPeak - cc.currentPrice) / cc.currentPrice) * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 text-center">
              <div className="text-slate-400 text-xs">Projected Peak</div>
              <div className="text-green-400 font-bold text-lg">${cc.projectedPeak.toLocaleString()}</div>
              <div className="text-slate-500 text-xs">~{cc.projectedPeakYear}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 text-center">
              <div className="text-slate-400 text-xs">Years Remaining</div>
              <div className="text-blue-400 font-bold text-lg">{((cc.projectedPeakYear ?? 2030) - 2025).toFixed(0)}</div>
              <div className="text-slate-500 text-xs">est. based on avg</div>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-900/20 border border-amber-600/30 rounded-xl p-4 text-xs text-slate-400">
        <strong className="text-amber-400">Cycle Analysis Disclaimer:</strong> Historical cycles do not repeat exactly. The &quot;average&quot; cycle is an approximation. Real cycles are driven by fundamentals (inflation, USD policy, geopolitics) not just time. This is a historical reference tool — not a price target or financial advice. Updated: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
