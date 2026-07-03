"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface COTSnapshot {
  asOf: string;
  commercialsNet: number;
  managedMoneyNet: number;
  openInterestTonnes: number;
  largeTradersLong: number;
  largeTradersShort: number;
  retailSmallLong: number;
  retailSmallShort: number;
}

interface COTSignal {
  label: string;
  value: string;
  signal: "extreme_bullish" | "bullish" | "neutral" | "bearish" | "extreme_bearish";
  explanation: string;
}

interface COTLiveData {
  goldPrice: number;
  goldChange1w: number;
  latestSnapshot: COTSnapshot;
  mmNetLong: number;
  mmPositioningPct: number;
  commercialHedgePct: number;
  overallSignal: "extreme_bullish" | "bullish" | "neutral" | "bearish" | "extreme_bearish";
  signals: COTSignal[];
  historicalExtremes: { date: string; mmNet: number; goldPriceAfter1m: number; signal: string }[];
  insight: string;
  methodology: string;
  timestamp: string;
}

const SIGNAL_STYLE: Record<string, { text: string; bg: string; border: string; label: string }> = {
  extreme_bullish: { text: "text-green-300",  bg: "from-green-900/30 to-emerald-800/20", border: "border-green-600/40",  label: "Extreme Long (Contrarian Bearish Risk)" },
  bullish:         { text: "text-green-400",  bg: "from-green-900/20 to-emerald-800/10", border: "border-green-700/30",  label: "Managed Money Long" },
  neutral:         { text: "text-slate-300",  bg: "from-slate-800/50 to-slate-700/30",   border: "border-slate-600/40",  label: "Neutral Positioning" },
  bearish:         { text: "text-red-400",    bg: "from-red-900/20 to-rose-800/10",      border: "border-red-700/30",    label: "Managed Money Short" },
  extreme_bearish: { text: "text-red-300",    bg: "from-red-900/30 to-rose-800/20",      border: "border-red-600/40",    label: "Extreme Short (Contrarian Bullish Signal)" },
};

const SIG_BADGE: Record<string, string> = {
  extreme_bullish: "bg-green-500/20 text-green-400 border-green-500/30",
  bullish:         "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  neutral:         "bg-slate-600/30 text-slate-400 border-slate-500/30",
  bearish:         "bg-red-500/20 text-red-400 border-red-500/30",
  extreme_bearish: "bg-red-600/20 text-red-300 border-red-600/30",
};

export default function COTLivePage() {
  const { t } = useI18n();
  const [data, setData] = useState<COTLiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cot-live")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-400 text-lg">Loading COT positioning…</div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-400">Failed to load data.</div>
    </div>
  );

  const sigStyle = SIGNAL_STYLE[data.overallSignal] ?? SIGNAL_STYLE.neutral;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">📋 {t("navCotLive")}</h1>
        <p className="text-slate-400 mt-1 text-sm">
          COMEX Gold Futures positioning — managed money net longs, commercial hedges, and extreme positioning signals.
        </p>
      </div>

      {/* Hero positioning */}
      <div className={`bg-gradient-to-r ${sigStyle.bg} border ${sigStyle.border} rounded-xl p-6`}>
        <div className="flex flex-wrap gap-6 items-center">
          <div>
            <div className="text-slate-400 text-xs mb-1">Positioning Signal</div>
            <div className={`text-3xl font-bold ${sigStyle.text}`}>{sigStyle.label}</div>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-slate-400 text-xs">MM Net Long</div>
              <div className="text-white text-xl font-bold">{data.mmNetLong.toLocaleString()}t</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Positioning %ile</div>
              <div className={`text-xl font-bold ${data.mmPositioningPct > 70 ? "text-red-400" : data.mmPositioningPct < 30 ? "text-green-400" : "text-white"}`}>
                {data.mmPositioningPct.toFixed(0)}th
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Commercial Hedge</div>
              <div className={`text-xl font-bold ${data.commercialHedgePct > 55 ? "text-red-400" : "text-green-400"}`}>
                {data.commercialHedgePct}%
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-slate-300 text-sm">{data.insight}</div>
      </div>

      {/* Positioning gauge */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Managed Money Net Long Percentile</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>0th pct — Extreme Short (Buy Signal)</span>
            <span>100th pct — Extreme Long (Risk!)</span>
          </div>
          <div className="h-7 bg-slate-700 rounded-full overflow-hidden relative">
            {/* Color zones */}
            <div className="absolute inset-0 flex">
              <div className="w-[20%] bg-green-700/40" />
              <div className="w-[30%] bg-green-500/20" />
              <div className="w-[30%] bg-yellow-500/10" />
              <div className="w-[15%] bg-orange-500/20" />
              <div className="w-[5%] bg-red-700/40" />
            </div>
            {/* Indicator needle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white rounded"
              style={{ left: `${data.mmPositioningPct}%`, transform: "translateX(-50%)" }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-green-400">Contrarian Long</span>
            <span className={`font-bold ${data.mmPositioningPct > 70 ? "text-red-400" : "text-white"}`}>
              {data.mmPositioningPct.toFixed(0)}th pct
            </span>
            <span className="text-red-400">Contrarian Short</span>
          </div>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-slate-500 flex-wrap">
          <span><span className="text-green-400">■</span> 0–20%: Extreme low — high-prob buy</span>
          <span><span className="text-yellow-400">■</span> 40–60%: Normal range</span>
          <span><span className="text-red-400">■</span> 80–100%: Crowded — watch for reversal</span>
        </div>
      </div>

      {/* Signals table */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-white font-semibold">COT Signal Analysis</h2>
        </div>
        <div className="divide-y divide-slate-800/60">
          {data.signals.map((s, i) => (
            <div key={i} className="px-6 py-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className="text-white font-semibold text-sm">{s.label}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border capitalize ${SIG_BADGE[s.signal]}`}>
                  {s.signal.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-slate-300 text-sm mb-1">{s.value}</div>
              <div className="text-slate-500 text-xs">{s.explanation}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Snapshot breakdown */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Positioning Snapshot (est. {data.latestSnapshot.asOf})</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: "Managed Money Net",  val: `${data.latestSnapshot.managedMoneyNet.toLocaleString()}t`, color: data.latestSnapshot.managedMoneyNet > 0 ? "text-green-400" : "text-red-400" },
            { label: "Commercials Net",    val: `${data.latestSnapshot.commercialsNet.toLocaleString()}t`, color: data.latestSnapshot.commercialsNet < 0 ? "text-orange-400" : "text-green-400" },
            { label: "Total OI",           val: `${data.latestSnapshot.openInterestTonnes.toLocaleString()}t`, color: "text-blue-400" },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/60 rounded-lg p-3 text-center">
              <div className="text-slate-400 text-xs mb-1">{s.label}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical extremes */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-white font-semibold">Historical Positioning Extremes → Gold Return</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-right py-3 px-4">MM Net (contracts)</th>
                <th className="text-right py-3 px-4">Gold 1M Later</th>
                <th className="text-left py-3 px-4">Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.historicalExtremes.map((h, i) => (
                <tr key={i} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 text-slate-300">{h.date}</td>
                  <td className={`py-3 px-4 text-right font-mono ${h.mmNet < 0 ? "text-red-400" : "text-green-400"}`}>
                    {h.mmNet.toLocaleString()}
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold ${h.goldPriceAfter1m >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {h.goldPriceAfter1m >= 0 ? "+" : ""}{h.goldPriceAfter1m}%
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{h.signal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology note */}
      <div className="bg-amber-900/20 border border-amber-600/30 rounded-xl p-4 text-xs text-slate-400">
        <strong className="text-amber-400">Methodology:</strong> {data.methodology}
        <div className="mt-1 text-slate-500">Updated: {new Date(data.timestamp).toLocaleString()}</div>
      </div>
    </div>
  );
}
