"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface DollarMilkshakeData {
  dxy: number;
  dxyChange1m: number;
  dxyChange3m: number;
  dxy5yHigh: number;
  dxyPctFrom5yHigh: number;
  emStressIndex: number;
  eurodollarProxy: number;
  capitalFlowSignal: "dollar_inflow" | "neutral" | "dollar_outflow";
  theoryPhase: "early_suck" | "peak_dollar" | "reversal_watch" | "dollar_crisis" | "gold_rip";
  phaseDescription: string;
  goldImplication: string;
  indicators: {
    name: string;
    value: string;
    signal: "bullish_gold" | "bearish_gold" | "neutral";
    description: string;
  }[];
  insight: string;
  timestamp: string;
}

const PHASE_CONFIG: Record<string, { label: string; bg: string; border: string; color: string; icon: string }> = {
  early_suck:    { label: "Early Dollar Suck",   bg: "from-red-900/30 to-rose-800/20",   border: "border-red-600/40",   color: "text-red-400",    icon: "🌪️" },
  peak_dollar:   { label: "Peak Dollar Watch",   bg: "from-orange-900/30 to-amber-800/20", border: "border-orange-600/40", color: "text-orange-400", icon: "🏔️" },
  reversal_watch:{ label: "Reversal Imminent",   bg: "from-yellow-900/30 to-amber-800/20", border: "border-yellow-500/40", color: "text-yellow-400", icon: "🔄" },
  dollar_crisis: { label: "Dollar Crisis",       bg: "from-purple-900/30 to-violet-800/20", border: "border-purple-500/40", color: "text-purple-400", icon: "💥" },
  gold_rip:      { label: "GOLD RIP Phase",      bg: "from-green-900/30 to-emerald-800/20", border: "border-green-600/40", color: "text-green-400",  icon: "🚀" },
};

const SIGNAL_STYLE: Record<string, string> = {
  bullish_gold: "text-green-400",
  bearish_gold: "text-red-400",
  neutral:      "text-slate-400",
};

const FLOW_LABEL: Record<string, string> = {
  dollar_inflow:  "💵 Dollar Inflow",
  neutral:        "→ Neutral Flow",
  dollar_outflow: "🌍 Dollar Outflow",
};

export default function DollarMilkshakePage() {
  const { t } = useI18n();
  const [data, setData] = useState<DollarMilkshakeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dollar-milkshake")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-400 text-lg">Analyzing dollar milkshake…</div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-400">Failed to load data.</div>
    </div>
  );

  const phase = PHASE_CONFIG[data.theoryPhase] ?? PHASE_CONFIG.peak_dollar;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🍵 {t("navDollarMilkshake")}</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Dollar Milkshake Theory tracker — USD strength, EM capital flows, and the gold reversal signal.
        </p>
      </div>

      {/* Phase hero */}
      <div className={`bg-gradient-to-r ${phase.bg} border ${phase.border} rounded-xl p-6`}>
        <div className="flex flex-wrap gap-6 items-start">
          <div>
            <div className="text-slate-400 text-xs mb-1">Milkshake Theory Phase</div>
            <div className={`text-3xl font-bold ${phase.color}`}>{phase.icon} {phase.label}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <div>
              <div className="text-slate-400 text-xs">DXY</div>
              <div className="text-white text-xl font-bold">{data.dxy.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">vs 5Y High</div>
              <div className={`text-xl font-bold ${data.dxyPctFrom5yHigh < -5 ? "text-green-400" : "text-orange-400"}`}>
                {data.dxyPctFrom5yHigh.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">EM Stress</div>
              <div className={`text-xl font-bold ${data.emStressIndex > 50 ? "text-red-400" : "text-green-400"}`}>
                {data.emStressIndex}/100
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Capital Flow</div>
              <div className="text-white text-sm font-semibold">{FLOW_LABEL[data.capitalFlowSignal]}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-slate-300 text-sm">{data.phaseDescription}</div>
        <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-semibold border ${phase.border}`} style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
          🥇 Gold Implication: {data.goldImplication}
        </div>
      </div>

      {/* Insight */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-slate-300 text-sm">
        💡 {data.insight}
      </div>

      {/* EM Stress gauge */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">EM Currency Stress Index</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Low Stress (Gold Bullish)</span>
            <span>High Stress (Dollar Sucking Capital)</span>
          </div>
          <div className="h-6 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${data.emStressIndex}%`,
                background: data.emStressIndex > 70 ? "linear-gradient(90deg,#f59e0b,#ef4444)" :
                             data.emStressIndex > 40 ? "linear-gradient(90deg,#22c55e,#f59e0b)" :
                             "linear-gradient(90deg,#22c55e,#16a34a)",
              }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-green-400">0</span>
            <span className={`font-bold ${data.emStressIndex > 50 ? "text-red-400" : "text-green-400"}`}>
              {data.emStressIndex} / 100
            </span>
            <span className="text-red-400">100</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "linear-gradient(90deg,#22c55e,#16a34a)" }} />
            <span className="text-slate-400 text-xs">0–30: EM stable, dollar not sucking</span>
          </div>
          <div className="flex items-center gap-1.5 ml-4">
            <div className="w-3 h-3 rounded-full" style={{ background: "linear-gradient(90deg,#22c55e,#f59e0b)" }} />
            <span className="text-slate-400 text-xs">30–60: Moderate EM stress</span>
          </div>
          <div className="flex items-center gap-1.5 ml-4">
            <div className="w-3 h-3 rounded-full" style={{ background: "linear-gradient(90deg,#f59e0b,#ef4444)" }} />
            <span className="text-slate-400 text-xs">60–100: Extreme EM stress → watch for reversal</span>
          </div>
        </div>
      </div>

      {/* Indicator breakdown */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-white font-semibold">Theory Indicator Breakdown</h2>
        </div>
        <div className="divide-y divide-slate-800/60">
          {data.indicators.map((ind, i) => (
            <div key={i} className="px-6 py-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className="text-white font-semibold text-sm">{ind.name}</span>
                <span className={`text-sm font-bold ${SIGNAL_STYLE[ind.signal]} capitalize`}>
                  {ind.signal.replace("_gold", "").replace("_", " ")}
                </span>
              </div>
              <div className="text-slate-300 text-sm mb-1">{ind.value}</div>
              <div className="text-slate-500 text-xs">{ind.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Theory explainer */}
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-6 space-y-4 text-sm">
        <h3 className="text-white font-semibold text-lg">The Dollar Milkshake Theory</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="text-slate-300 font-semibold">Brent Johnson&apos;s Core Thesis:</div>
            <div className="space-y-2 text-slate-400">
              <p>1. <span className="text-white">The USD is like a straw</span> that "sucks" global capital into the US financial system via higher rates, stronger yield differentials, and safe-haven demand.</p>
              <p>2. <span className="text-white">Emerging markets</span> suffer: their debt is often USD-denominated, their currencies weaken, and capital flees to the US — creating EM crises.</p>
              <p>3. Eventually <span className="text-white">the system breaks</span> — too much EM stress, too much US debt, or a Fed pivot — and the dollar reverses sharply.</p>
              <p>4. <span className="text-white">Gold supercharges</span> in the reversal: as the dollar falls, gold captures all the stranded EM capital, fiscal debasement concerns, and safe-haven demand.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-slate-300 font-semibold">Phase Playbook:</div>
            <div className="space-y-2">
              {Object.entries(PHASE_CONFIG).map(([key, cfg]) => (
                <div key={key} className={`flex items-start gap-2 text-xs ${data.theoryPhase === key ? "opacity-100" : "opacity-50"}`}>
                  <span>{cfg.icon}</span>
                  <div>
                    <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
                    {data.theoryPhase === key && <span className="ml-1 text-yellow-400">← NOW</span>}
                    {key === "early_suck" && <p className="text-slate-500 mt-0.5">USD sucking capital. Gold headwind. Accumulate on dips.</p>}
                    {key === "peak_dollar" && <p className="text-slate-500 mt-0.5">USD elevated, momentum slowing. Position for reversal.</p>}
                    {key === "reversal_watch" && <p className="text-slate-500 mt-0.5">KEY SIGNAL. Dollar rolling over. Load gold now.</p>}
                    {key === "dollar_crisis" && <p className="text-slate-500 mt-0.5">EM contagion, Fed forced to act. Max gold bullish.</p>}
                    {key === "gold_rip" && <p className="text-slate-500 mt-0.5">Dollar in downtrend. Gold accelerating. Ride it.</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="text-slate-600 text-xs pt-2 border-t border-slate-700">
          Updated: {new Date(data.timestamp).toLocaleString()} · Theory by Brent Johnson (Santiago Capital). Not financial advice.
        </div>
      </div>
    </div>
  );
}
