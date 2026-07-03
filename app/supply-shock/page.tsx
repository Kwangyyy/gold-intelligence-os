"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface SupplyRisk {
  id: string;
  country: string;
  flag: string;
  category: "mine_strike" | "country_risk" | "refinery" | "export_ban" | "natural_disaster";
  severity: "critical" | "high" | "moderate" | "low";
  status: "active" | "resolved" | "monitoring";
  title: string;
  description: string;
  miningShareOfWorld: number;
  estimatedImpactTonnes: number;
  startDate: string;
  goldImpact: "very_bullish" | "bullish" | "neutral" | "bearish";
}

interface CountryConcentration {
  country: string;
  flag: string;
  productionTonnes: number;
  pctOfWorld: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  notes: string;
}

interface SupplyShockData {
  goldPrice: number;
  totalWorldProduction: number;
  activeDisruptions: number;
  estimatedSupplyAtRiskTonnes: number;
  supplyAtRiskPct: number;
  overallSignal: "very_bullish" | "bullish" | "neutral" | "bearish";
  risks: SupplyRisk[];
  topProducers: CountryConcentration[];
  concentrationRisk: string;
  insight: string;
  timestamp: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  moderate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low:      "bg-slate-600/30 text-slate-400 border-slate-500/30",
};

const STATUS_STYLE: Record<string, string> = {
  active:     "text-red-400",
  resolved:   "text-green-400",
  monitoring: "text-yellow-400",
};

const STATUS_ICON: Record<string, string> = {
  active: "🔴", resolved: "✅", monitoring: "🟡",
};

const CAT_LABEL: Record<string, string> = {
  mine_strike:       "Mine Strike",
  country_risk:      "Country Risk",
  refinery:          "Refinery",
  export_ban:        "Export Ban",
  natural_disaster:  "Natural Disaster",
};

const RISK_LEVEL_STYLE: Record<string, string> = {
  low:      "text-green-400",
  moderate: "text-yellow-400",
  high:     "text-orange-400",
  critical: "text-red-400",
};

const IMPACT_STYLE: Record<string, string> = {
  very_bullish: "bg-green-500/20 text-green-400 border-green-500/30",
  bullish:      "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  neutral:      "bg-slate-600/30 text-slate-400 border-slate-500/30",
  bearish:      "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function SupplyShockPage() {
  const { t } = useI18n();
  const [data, setData] = useState<SupplyShockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/supply-shock")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-400 text-lg">Loading supply data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-400">Failed to load data.</div>
    </div>
  );

  const maxProd = Math.max(...data.topProducers.map(p => p.productionTonnes));
  const filteredRisks = filter === "all" ? data.risks : data.risks.filter(r => r.status === filter);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">⚠️ {t("navSupplyShock")}</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Gold supply disruption tracker — mine strikes, country risks, export restrictions, and concentration risk.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "World Production",  value: `${data.totalWorldProduction.toLocaleString()}t/yr`, sub: "Total annual (WGC 2024)", color: "text-yellow-400" },
          { label: "Active Disruptions", value: String(data.activeDisruptions), sub: "Currently active events",  color: "text-red-400" },
          { label: "Supply at Risk",    value: `${data.estimatedSupplyAtRiskTonnes}t`,  sub: `${data.supplyAtRiskPct}% of world supply`, color: "text-orange-400" },
          { label: "Gold Signal",       value: data.overallSignal.replace("_", " ").toUpperCase(), sub: "From active disruptions", color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
            <div className="text-slate-500 text-xs mb-1">{s.label}</div>
            <div className={`text-xl font-bold capitalize ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Insight */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-slate-300 text-sm">
        💡 {data.insight}
      </div>

      {/* Risk events */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-white font-semibold">Supply Risk Events</h2>
          <div className="flex gap-2">
            {["all", "active", "monitoring", "resolved"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors capitalize ${
                  filter === f ? "bg-yellow-500 text-black" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {f === "all" ? "All" : STATUS_ICON[f]} {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-800/60">
          {filteredRisks.map(r => (
            <div key={r.id} className="px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{r.flag}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold">{r.title}</span>
                      <span className={`text-xs ${STATUS_STYLE[r.status]}`}>{STATUS_ICON[r.status]} {r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {r.country} · {CAT_LABEL[r.category]} · Since {r.startDate}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border capitalize ${SEVERITY_STYLE[r.severity]}`}>{r.severity}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${IMPACT_STYLE[r.goldImpact]}`}>
                    {r.goldImpact.replace("_", " ")}
                  </span>
                </div>
              </div>
              <p className="text-slate-300 text-sm mb-3">{r.description}</p>
              <div className="flex gap-6 text-xs text-slate-500">
                <span>World share: <span className="text-slate-300">{r.miningShareOfWorld}%</span></span>
                <span>Est. disruption: <span className="text-slate-300">{r.estimatedImpactTonnes}t/yr</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top producers concentration */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-2">Top Producer Concentration Risk</h2>
        <p className="text-slate-400 text-xs mb-4">{data.concentrationRisk}</p>
        <div className="space-y-3">
          {data.topProducers.map(p => {
            const barPct = (p.productionTonnes / maxProd) * 100;
            return (
              <div key={p.country} className="flex items-center gap-3">
                <span className="w-6 text-center text-lg">{p.flag}</span>
                <span className="w-28 text-slate-300 text-xs">{p.country}</span>
                <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${barPct}%`,
                      backgroundColor: p.riskLevel === "critical" ? "#ef4444" : p.riskLevel === "high" ? "#f97316" : p.riskLevel === "moderate" ? "#f59e0b" : "#22c55e",
                    }}
                  />
                </div>
                <span className="w-16 text-right text-slate-300 text-xs font-mono">{p.productionTonnes}t</span>
                <span className="w-10 text-right text-slate-500 text-xs">{p.pctOfWorld}%</span>
                <span className={`w-16 text-xs font-semibold capitalize ${RISK_LEVEL_STYLE[p.riskLevel]}`}>{p.riskLevel}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-slate-500">
          <span><span className="text-red-400">■</span> Critical</span>
          <span><span className="text-orange-400">■</span> High</span>
          <span><span className="text-yellow-400">■</span> Moderate</span>
          <span><span className="text-green-400">■</span> Low</span>
        </div>
      </div>

      {/* Education */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        {[
          { icon: "🔴", title: "Active Disruptions", body: "Active disruptions remove actual tonnes from market supply. Severity indicates how immediately prices are affected. Russia sanctions alone redirect ~340t/yr away from Western markets." },
          { icon: "🌐", title: "Concentration Risk", body: "Top 3 producers = 27% of world supply. Any political event in China, Russia, or Australia (the top 3) could materially impact gold availability for settlement and delivery." },
          { icon: "📉", title: "Supply vs Price", body: "Gold supply is relatively inelastic — mine supply cannot quickly respond to price spikes. Supply shocks therefore have outsized price impact vs other commodities." },
        ].map(card => (
          <div key={card.title} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
            <div className="text-2xl mb-2">{card.icon}</div>
            <h3 className="text-white font-semibold mb-2">{card.title}</h3>
            <p className="text-slate-400">{card.body}</p>
          </div>
        ))}
      </div>

      <div className="text-slate-600 text-xs">
        Supply data: World Gold Council 2024. Risk events based on public reports. Updated: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
