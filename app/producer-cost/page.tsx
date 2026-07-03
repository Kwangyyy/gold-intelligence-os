"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface MinerData {
  name: string;
  country: string;
  flag: string;
  ticker: string;
  aisc: number;
  productionKoz: number;
  margin: number;
  marginPct: number;
  region: string;
  status: "profitable" | "breakeven" | "loss";
}

interface CostTierData {
  tier: string;
  aiscRange: string;
  miners: string[];
  pctOfProduction: number;
  status: "profitable" | "breakeven" | "loss";
  goldPrice: number;
}

interface ProducerCostData {
  goldPrice: number;
  industryAvgAISC: number;
  marginalCost: number;
  totalProduction: number;
  profitableMiners: number;
  miners: MinerData[];
  costTiers: CostTierData[];
  insight: string;
  timestamp: string;
}

const STATUS_STYLE: Record<MinerData["status"], string> = {
  profitable: "bg-green-500/20 text-green-400 border-green-500/30",
  breakeven:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  loss:       "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function ProducerCostPage() {
  const { t } = useI18n();
  const [data, setData] = useState<ProducerCostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<string>("All");

  useEffect(() => {
    fetch("/api/producer-cost")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-400 text-lg">Loading producer cost data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-400">Failed to load data.</div>
    </div>
  );

  const regions = ["All", ...Array.from(new Set(data.miners.map(m => m.region)))];
  const filteredMiners = region === "All" ? data.miners : data.miners.filter(m => m.region === region);
  const maxAISC = Math.max(...data.miners.map(m => m.aisc));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">⛏️ {t("navProducerCost")}</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Gold miner All-In Sustaining Cost (AISC) vs current gold price — profit margins and structural support floor.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Gold Spot",        value: `$${data.goldPrice.toLocaleString()}`, sub: "COMEX GC=F",         color: "text-yellow-400" },
          { label: "Industry Avg AISC", value: `$${data.industryAvgAISC.toLocaleString()}`, sub: "Weighted avg", color: "text-blue-400" },
          { label: "Marginal Cost",    value: `$${data.marginalCost.toLocaleString()}`, sub: "90th %ile (floor)", color: "text-orange-400" },
          { label: "Profitable",       value: `${data.profitableMiners}%`,           sub: "of sampled production", color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
            <div className="text-slate-500 text-xs mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Insight */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-slate-300 text-sm">
        💡 {data.insight}
      </div>

      {/* Cost tiers */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Cost Curve by Tier</h2>
        <div className="space-y-3">
          {data.costTiers.map(tier => (
            <div key={tier.tier} className={`rounded-lg border p-4 ${STATUS_STYLE[tier.status]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <span className="font-semibold text-white">{tier.tier}</span>
                  <span className="ml-2 text-slate-400 text-xs">{tier.aiscRange}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400">{tier.pctOfProduction}% of production</span>
                  <span className={`px-2 py-0.5 rounded font-bold border capitalize ${STATUS_STYLE[tier.status]}`}>{tier.status}</span>
                </div>
              </div>
              {tier.miners.length > 0 && (
                <div className="text-slate-400 text-xs">{tier.miners.join(" · ")}</div>
              )}
            </div>
          ))}
        </div>
        {/* Gold price marker */}
        <div className="mt-4 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-yellow-300" />
          <span className="text-yellow-400 font-semibold text-sm">
            Gold spot ${data.goldPrice.toLocaleString()} = ${data.goldPrice - data.industryAvgAISC} margin above industry avg AISC
          </span>
        </div>
      </div>

      {/* Visual cost curve */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">AISC Cost Curve — Sorted Highest to Lowest</h2>
        <div className="space-y-2">
          {data.miners.map(m => {
            const barPct = (m.aisc / maxAISC) * 100;
            const goldBarPct = (data.goldPrice / maxAISC) * 100;
            return (
              <div key={m.name} className="flex items-center gap-3">
                <span className="w-36 text-right text-slate-400 text-xs truncate">{m.flag} {m.name}</span>
                <div className="flex-1 h-6 bg-slate-800 rounded overflow-hidden relative">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${barPct}%`,
                      backgroundColor: m.status === "profitable" ? "#22c55e" : m.status === "breakeven" ? "#f59e0b" : "#ef4444",
                    }}
                  />
                  {/* Gold price line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
                    style={{ left: `${goldBarPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-right text-white text-xs font-mono">${m.aisc.toLocaleString()}</span>
                  <span className={`text-xs font-semibold ${m.margin > 0 ? "text-green-400" : "text-red-400"}`}>
                    {m.margin > 0 ? "+" : ""}{m.margin.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
          <div className="w-3 h-0.5 bg-yellow-400" /> Gold spot price (yellow line) = breakeven boundary
        </div>
      </div>

      {/* Miner table */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-white font-semibold">Miner Detail Table</h2>
          <div className="flex gap-2 flex-wrap">
            {regions.map(r => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  region === r ? "bg-yellow-500 text-black" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-3 px-4">Company</th>
                <th className="text-right py-3 px-4">AISC</th>
                <th className="text-right py-3 px-4">Margin</th>
                <th className="text-right py-3 px-4">Margin %</th>
                <th className="text-right py-3 px-4">Production koz</th>
                <th className="text-right py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMiners.map(m => (
                <tr key={m.name} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span>{m.flag}</span>
                      <div>
                        <div className="text-white font-semibold">{m.name}</div>
                        <div className="text-slate-500 text-xs">{m.ticker} · {m.region}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-white font-mono">${m.aisc.toLocaleString()}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${m.margin > 0 ? "text-green-400" : "text-red-400"}`}>
                    {m.margin > 0 ? "+" : ""}{m.margin.toLocaleString()}
                  </td>
                  <td className={`py-3 px-4 text-right text-xs ${m.marginPct > 0 ? "text-green-400" : "text-red-400"}`}>
                    {m.marginPct.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300 text-xs">{m.productionKoz.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border capitalize ${STATUS_STYLE[m.status]}`}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-slate-800 text-xs text-slate-500">
          AISC data: WGC / publicly reported Q4 2024. Production in koz/year. Updated: {new Date(data.timestamp).toLocaleString()}
        </div>
      </div>

      {/* Education */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        {[
          { icon: "📊", title: "What is AISC?", body: "All-In Sustaining Cost includes mining, processing, G&A, sustaining capex, and royalties. It's the full cost to maintain production — the true economic breakeven." },
          { icon: "🏗️", title: "Marginal Cost as Support", body: "The 90th percentile AISC represents the cost of the most expensive viable mine. Gold below this level makes marginal producers unprofitable, reducing supply and supporting price." },
          { icon: "💰", title: "Streaming vs Mining", body: "Royalty/streaming companies (Franco-Nevada, Wheaton) have ultra-low effective AISC (<$700) because they fund mines upfront in exchange for metal at fixed low prices — a different risk/reward than operators." },
        ].map(card => (
          <div key={card.title} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
            <div className="text-2xl mb-2">{card.icon}</div>
            <h3 className="text-white font-semibold mb-2">{card.title}</h3>
            <p className="text-slate-400">{card.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
