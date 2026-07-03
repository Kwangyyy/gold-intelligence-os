"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface TradeSetup {
  direction: "long" | "short";
  type: string;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  rr1: number;
  rr2: number;
  rr3: number;
  probability: number;
  rationale: string;
  conditions: string[];
  invalidation: string;
}

interface TradeSetupData {
  spot: number;
  high: number;
  low: number;
  atr: number;
  trend: "up" | "neutral" | "down";
  volatility: "high" | "normal" | "low";
  session: string;
  setups: TradeSetup[];
  bias: "long" | "neutral" | "short";
  biasRationale: string;
  timestamp: string;
}

const BIAS_STYLE = {
  long:    { bg: "from-green-900/30 to-emerald-800/20", border: "border-green-600/30", text: "text-green-400", label: "Bullish Bias" },
  short:   { bg: "from-red-900/30 to-rose-800/20",   border: "border-red-600/30",   text: "text-red-400",   label: "Bearish Bias" },
  neutral: { bg: "from-slate-800/50 to-slate-700/30", border: "border-slate-600/30", text: "text-slate-300", label: "Neutral" },
};

const DIR_STYLE = {
  long:  { badge: "bg-green-500/20 text-green-400 border-green-500/30", icon: "▲", color: "#22c55e" },
  short: { badge: "bg-red-500/20 text-red-400 border-red-500/30",       icon: "▼", color: "#ef4444" },
};

function ProbBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-700 rounded overflow-hidden">
        <div className="h-full bg-blue-500 rounded" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-blue-400 text-xs font-semibold w-8 text-right">{pct}%</span>
    </div>
  );
}

function RRCell({ rr }: { rr: number }) {
  const color = rr >= 2 ? "text-green-400" : rr >= 1 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-bold ${color}`}>{rr.toFixed(2)}:1</span>;
}

const TREND_LABEL: Record<string, string> = {
  up: "↑ Uptrend", neutral: "→ Neutral", down: "↓ Downtrend",
};
const TREND_COLOR: Record<string, string> = {
  up: "text-green-400", neutral: "text-slate-300", down: "text-red-400",
};
const VOL_COLOR: Record<string, string> = {
  high: "text-red-400", normal: "text-blue-400", low: "text-slate-400",
};

export default function TradeSetupPage() {
  const { t } = useI18n();
  const [data, setData] = useState<TradeSetupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trade-setup")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-400 text-lg">Scanning trade setups…</div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-400">Failed to load data.</div>
    </div>
  );

  const bias = BIAS_STYLE[data.bias];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🎯 {t("navTradeSetup")}</h1>
        <p className="text-slate-400 mt-1 text-sm">
          ATR-based trade setups with entry / SL / TP levels and risk:reward ratios.
        </p>
      </div>

      {/* Session stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Gold Spot",   value: `$${data.spot.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-yellow-400" },
          { label: "Day High",    value: `$${data.high.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-green-400" },
          { label: "Day Low",     value: `$${data.low.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,  color: "text-red-400" },
          { label: "ATR (14D)",   value: `$${data.atr.toFixed(2)}`, color: "text-blue-400" },
          { label: "Session",     value: data.session, color: "text-purple-400" },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
            <div className="text-slate-500 text-xs mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Trend + Bias banner */}
      <div className={`bg-gradient-to-r ${bias.bg} border ${bias.border} rounded-xl p-5`}>
        <div className="flex flex-wrap gap-6 items-center">
          <div>
            <div className="text-slate-400 text-xs mb-1">Market Bias</div>
            <div className={`text-2xl font-bold ${bias.text}`}>{bias.label}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs mb-1">Trend</div>
            <div className={`text-lg font-semibold ${TREND_COLOR[data.trend]}`}>{TREND_LABEL[data.trend]}</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs mb-1">Volatility</div>
            <div className={`text-lg font-semibold ${VOL_COLOR[data.volatility]} capitalize`}>{data.volatility}</div>
          </div>
          <div className="flex-1">
            <p className="text-slate-300 text-sm">{data.biasRationale}</p>
          </div>
        </div>
      </div>

      {/* Setup cards */}
      <div className="space-y-6">
        <h2 className="text-white font-semibold text-lg">Active Setups ({data.setups.length})</h2>
        {data.setups.map((setup, i) => {
          const ds = DIR_STYLE[setup.direction];
          const riskPts = Math.abs(setup.entry - setup.sl);
          return (
            <div key={i} className={`bg-slate-900/70 border rounded-xl overflow-hidden`} style={{ borderColor: `${ds.color}40` }}>
              {/* Setup header */}
              <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded border text-sm font-bold ${ds.badge}`}>
                    {ds.icon} {setup.direction.toUpperCase()}
                  </span>
                  <span className="text-white font-semibold">{setup.type}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-slate-500 text-xs">Win Rate</div>
                    <div className="text-blue-400 font-bold">{setup.probability}%</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Risk/pt</div>
                    <div className="text-white font-mono text-sm">${riskPts.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Levels */}
                <div>
                  <h3 className="text-slate-400 text-xs font-semibold uppercase mb-3">Price Levels</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-slate-400">Entry</span>
                      <span className="text-white font-mono font-bold">${setup.entry.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-red-400">Stop Loss</span>
                      <span className="text-red-400 font-mono font-bold">${setup.sl.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-green-300">TP1 <RRCell rr={setup.rr1} /></span>
                      <span className="text-green-300 font-mono">${setup.tp1.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-green-400">TP2 <RRCell rr={setup.rr2} /></span>
                      <span className="text-green-400 font-mono">${setup.tp2.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-400">TP3 <RRCell rr={setup.rr3} /></span>
                      <span className="text-emerald-400 font-mono">${setup.tp3.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-slate-500 text-xs mb-1">Historical Win Rate</div>
                    <ProbBar pct={setup.probability} />
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <h3 className="text-slate-400 text-xs font-semibold uppercase mb-3">Rationale & Conditions</h3>
                  <p className="text-slate-300 text-sm mb-3">{setup.rationale}</p>
                  <div className="space-y-1 mb-3">
                    {setup.conditions.map((c, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm text-slate-400">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                    <div className="text-red-400 text-xs font-semibold mb-1">Invalidation</div>
                    <p className="text-slate-300 text-xs">{setup.invalidation}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Disclaimer + education */}
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 space-y-3 text-sm">
        <h3 className="text-white font-semibold">How to Use These Setups</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-400">
          <div>
            <p className="font-semibold text-slate-300 mb-1">Setup Types</p>
            <p><span className="text-white">Breakout Long/Short</span> — momentum play when price clears the day high/low. Requires volume confirmation.</p>
            <p className="mt-1"><span className="text-white">Pullback Long</span> — counter-trend entry into a pullback within an uptrend. Higher probability but requires patience.</p>
            <p className="mt-1"><span className="text-white">Range Trade</span> — best in low-ATR, no-trend sessions. Buy support, sell resistance within the day&apos;s range.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-300 mb-1">Risk Management</p>
            <p>ATR = ${data.atr.toFixed(2)}/day. Size positions so 1 stop-loss hit = ≤1-2% of account. Target R:R ≥ 1.5:1 minimum; prefer 2:1+.</p>
            <p className="mt-1">TP levels are based on 0.5×, 1×, and 1.8× ATR from entry. Move SL to breakeven after TP1 is reached.</p>
          </div>
        </div>
        <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
          <p className="text-amber-400 text-xs font-semibold">⚠️ Risk Disclosure</p>
          <p className="text-slate-400 text-xs mt-1">These setups are generated algorithmically from ATR and price structure. They are NOT financial advice. Past win rates do not guarantee future results. Gold markets can gap significantly on news events — always use stop-loss orders and size appropriately. Updated: {new Date(data.timestamp).toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
}
