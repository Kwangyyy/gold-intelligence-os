"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface GoldCatalyst {
  id: string;
  category: "monetary" | "geopolitical" | "inflation" | "physical" | "technical" | "structural";
  title: string;
  description: string;
  status: "active" | "watch" | "fading" | "emerging";
  impact: "very_bullish" | "bullish" | "neutral" | "bearish";
  timeframe: "short" | "medium" | "long";
  probability: number;
  supportingEvidence: string[];
  riskFactors: string[];
  potentialMove: string;
}

interface GoldNewsCatalystData {
  goldPrice: number;
  bullishCount: number;
  bearishCount: number;
  netCatalystScore: number;
  overallBias: "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";
  catalysts: GoldCatalyst[];
  topBullish: GoldCatalyst;
  topBearish: GoldCatalyst | null;
  weeklyCalendar: {
    date: string;
    event: string;
    importance: "high" | "medium";
    goldBias: "bullish" | "neutral" | "bearish";
  }[];
  insight: string;
  timestamp: string;
}

const CAT_COLORS: Record<string, string> = {
  monetary:     "#3b82f6",
  geopolitical: "#f97316",
  inflation:    "#eab308",
  physical:     "#a855f7",
  technical:    "#06b6d4",
  structural:   "#22c55e",
};

const CAT_ICON: Record<string, string> = {
  monetary: "🏦", geopolitical: "⚔️", inflation: "📈", physical: "🏅", technical: "📊", structural: "🏗️",
};

const IMPACT_STYLE: Record<string, string> = {
  very_bullish: "bg-green-500/20 text-green-400 border-green-500/30",
  bullish:      "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  neutral:      "bg-slate-600/30 text-slate-400 border-slate-500/30",
  bearish:      "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_STYLE: Record<string, string> = {
  active:    "text-green-400",
  watch:     "text-yellow-400",
  fading:    "text-slate-400",
  emerging:  "text-blue-400",
};

const STATUS_ICON: Record<string, string> = {
  active: "🟢", watch: "🟡", fading: "⬜", emerging: "🔵",
};

const TF_LABEL: Record<string, string> = {
  short: "Days–Weeks", medium: "1–6 Months", long: "1+ Year",
};

const BIAS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  strong_bullish: { bg: "from-green-900/30 to-emerald-800/20",   border: "border-green-600/40",   text: "text-green-400" },
  bullish:        { bg: "from-emerald-900/20 to-green-800/10",   border: "border-emerald-700/30",  text: "text-emerald-400" },
  neutral:        { bg: "from-slate-800/50 to-slate-700/30",     border: "border-slate-600/40",    text: "text-slate-300" },
  bearish:        { bg: "from-red-900/20 to-rose-800/10",        border: "border-red-700/30",      text: "text-red-400" },
  strong_bearish: { bg: "from-red-900/30 to-rose-800/20",        border: "border-red-600/40",      text: "text-red-300" },
};

export default function GoldNewsCatalystPage() {
  const { t } = useI18n();
  const [data, setData] = useState<GoldNewsCatalystData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");

  useEffect(() => {
    fetch("/api/gold-news-catalyst")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-400 text-lg">Loading catalyst analysis…</div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-400">Failed to load data.</div>
    </div>
  );

  const biasStyle = BIAS_STYLE[data.overallBias] ?? BIAS_STYLE.neutral;
  const categories = ["all", ...Array.from(new Set(data.catalysts.map(c => c.category)))];
  const filtered = filterCat === "all" ? data.catalysts : data.catalysts.filter(c => c.category === filterCat);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">⚡ {t("navGoldNewsCatalyst")}</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Active gold catalysts with evidence, risk factors, and potential price moves.
        </p>
      </div>

      {/* Overall bias hero */}
      <div className={`bg-gradient-to-r ${biasStyle.bg} border ${biasStyle.border} rounded-xl p-6`}>
        <div className="flex flex-wrap gap-6 items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs mb-1">Net Catalyst Bias</div>
            <div className={`text-3xl font-bold ${biasStyle.text} capitalize`}>
              {data.overallBias.replace("_", " ")}
            </div>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-slate-400 text-xs">Bullish Catalysts</div>
              <div className="text-green-400 text-2xl font-bold">{data.bullishCount}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Net Score</div>
              <div className={`text-2xl font-bold ${data.netCatalystScore >= 0 ? "text-green-400" : "text-red-400"}`}>
                +{data.netCatalystScore}/100
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Bearish Catalysts</div>
              <div className="text-red-400 text-2xl font-bold">{data.bearishCount}</div>
            </div>
          </div>
        </div>
        <div className="mt-3 text-slate-300 text-sm">{data.insight}</div>
      </div>

      {/* Top catalyst callout */}
      <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{CAT_ICON[data.topBullish.category]}</span>
          <span className="text-green-400 font-bold text-sm">Top Bullish Catalyst</span>
          <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold border ${IMPACT_STYLE[data.topBullish.impact]}`}>
            {data.topBullish.impact.replace("_", " ")}
          </span>
        </div>
        <div className="text-white font-semibold mb-1">{data.topBullish.title}</div>
        <div className="text-slate-300 text-sm mb-2">{data.topBullish.description}</div>
        <div className="flex gap-4 text-xs">
          <span className="text-green-400">Potential: {data.topBullish.potentialMove}</span>
          <span className="text-slate-500">Probability: {data.topBullish.probability}%</span>
          <span className="text-slate-500">Timeframe: {TF_LABEL[data.topBullish.timeframe]}</span>
        </div>
      </div>

      {/* Upcoming weekly events */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Upcoming Key Events</h2>
        <div className="space-y-2">
          {data.weeklyCalendar.map((ev, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
              <span className="text-slate-500 text-xs w-20">{ev.date}</span>
              <span className="text-slate-300 text-sm flex-1">{ev.event}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                ev.importance === "high" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-slate-600/30 text-slate-400 border-slate-500/30"
              }`}>{ev.importance.toUpperCase()}</span>
              <span className={`text-xs font-semibold capitalize ${
                ev.goldBias === "bullish" ? "text-green-400" : ev.goldBias === "bearish" ? "text-red-400" : "text-slate-400"
              }`}>{ev.goldBias}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Catalyst cards */}
      <div>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className="px-3 py-1 rounded text-xs font-semibold transition-colors capitalize"
              style={{
                backgroundColor: filterCat === cat ? (CAT_COLORS[cat] ?? "#f59e0b") + "30" : undefined,
                color: filterCat === cat ? (CAT_COLORS[cat] ?? "#f59e0b") : "#94a3b8",
                border: `1px solid ${filterCat === cat ? (CAT_COLORS[cat] ?? "#f59e0b") + "60" : "#334155"}`,
              }}
            >
              {cat === "all" ? "All" : `${CAT_ICON[cat]} ${cat}`}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filtered.map(c => {
            const catColor = CAT_COLORS[c.category] ?? "#64748b";
            return (
              <div key={c.id} className="rounded-xl border p-5" style={{ borderColor: `${catColor}30`, backgroundColor: `${catColor}08` }}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">{CAT_ICON[c.category]}</span>
                    <span className="text-white font-semibold">{c.title}</span>
                    <span className={`text-xs ${STATUS_STYLE[c.status]}`}>{STATUS_ICON[c.status]} {c.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${IMPACT_STYLE[c.impact]}`}>
                      {c.impact.replace("_", " ")}
                    </span>
                    <span className="text-slate-500 text-xs">{TF_LABEL[c.timeframe]}</span>
                  </div>
                </div>

                <p className="text-slate-300 text-sm mb-3">{c.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500 font-semibold mb-1 uppercase tracking-wide">Supporting Evidence</div>
                    {c.supportingEvidence.map((e, j) => (
                      <div key={j} className="flex gap-1 text-slate-400 mb-0.5">
                        <span className="text-green-500">✓</span><span>{e}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-slate-500 font-semibold mb-1 uppercase tracking-wide">Risk Factors</div>
                    {c.riskFactors.map((rf, j) => (
                      <div key={j} className="flex gap-1 text-slate-400 mb-0.5">
                        <span className="text-red-400">⚠</span><span>{rf}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Potential move: </span>
                    <span className="text-yellow-400 font-semibold">{c.potentialMove}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Probability: </span>
                    <span className="text-blue-400 font-semibold">{c.probability}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-slate-600 text-xs">
        Updated: {new Date(data.timestamp).toLocaleString()} · Research-based estimates; not financial advice.
      </div>
    </div>
  );
}
