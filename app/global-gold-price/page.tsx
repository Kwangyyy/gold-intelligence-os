"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface CurrencyGold {
  currency: string;
  code: string;
  flag: string;
  goldPriceLocal: number;
  goldPriceUSD: number;
  athLocal: number;
  athDate: string;
  pctFromATH: number;
  change1d: number | null;
  isATH: boolean;
  interpretation: string;
}

interface GlobalGoldPriceData {
  goldUSD: number;
  goldChange1dUSD: number;
  currencies: CurrencyGold[];
  nearATH: string[];
  insight: string;
  timestamp: string;
}

function formatLocal(val: number, code: string): string {
  if (code === "JPY") return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (code === "INR") return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ATHBadge({ pct }: { pct: number }) {
  if (pct >= -1.5) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">ATH</span>;
  if (pct >= -5) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">Near ATH</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-700/50 text-slate-400 border border-slate-600/30">{pct.toFixed(1)}% from ATH</span>;
}

export default function GlobalGoldPricePage() {
  const { t } = useI18n();
  const [data, setData] = useState<GlobalGoldPriceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/global-gold-price")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-slate-400 text-lg">Loading global gold prices…</div>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-red-400">Failed to load data.</div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🌍 {t("navGlobalGoldPrice")}</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Gold price in major world currencies — ATH tracker and currency weakness signals.
        </p>
      </div>

      {/* USD hero */}
      <div className="bg-gradient-to-r from-yellow-900/30 to-amber-800/20 border border-yellow-600/30 rounded-xl p-6 flex flex-wrap gap-6 items-center">
        <div>
          <div className="text-slate-400 text-sm mb-1">Gold USD (COMEX)</div>
          <div className="text-4xl font-bold text-yellow-400">
            ${data.goldUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-sm mt-1 font-semibold ${data.goldChange1dUSD >= 0 ? "text-green-400" : "text-red-400"}`}>
            {data.goldChange1dUSD >= 0 ? "▲" : "▼"} {Math.abs(data.goldChange1dUSD).toFixed(2)}% today
          </div>
        </div>
        {data.nearATH.length > 0 && (
          <div className="flex-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="text-yellow-400 font-bold text-sm mb-1">🏆 ALL-TIME HIGH in:</div>
            <div className="text-white text-xl font-bold">{data.nearATH.join("  ·  ")}</div>
            <div className="text-slate-400 text-xs mt-1">Currency weakness amplifying gold rally</div>
          </div>
        )}
        <div className="text-slate-400 text-xs self-end">
          Updated: {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Insight */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-slate-300 text-sm">
        💡 {data.insight}
      </div>

      {/* Currency table */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-white font-semibold">Gold in Major Currencies</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-3 px-4">Currency</th>
                <th className="text-right py-3 px-4">Gold Price</th>
                <th className="text-right py-3 px-4">1D Change</th>
                <th className="text-right py-3 px-4">ATH</th>
                <th className="text-right py-3 px-4">ATH Date</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.currencies.map(c => (
                <tr
                  key={c.code}
                  className={`hover:bg-slate-800/40 transition-colors ${c.isATH ? "bg-yellow-900/10" : ""}`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{c.flag}</span>
                      <div>
                        <div className="text-white font-semibold">{c.code}</div>
                        <div className="text-slate-500 text-xs">{c.currency}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-white font-mono font-semibold">
                    {formatLocal(c.goldPriceLocal, c.code)}
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold ${(c.change1d ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {c.change1d !== null ? `${c.change1d >= 0 ? "+" : ""}${c.change1d.toFixed(2)}%` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300 font-mono text-xs">
                    {formatLocal(c.athLocal, c.code)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500 text-xs">{c.athDate}</td>
                  <td className="py-3 px-4">
                    <ATHBadge pct={c.pctFromATH} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar chart: % from ATH */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4">Distance from ATH by Currency</h3>
        <div className="space-y-3">
          {[...data.currencies].sort((a, b) => b.pctFromATH - a.pctFromATH).map(c => {
            const barPct = Math.max(0, 100 + c.pctFromATH); // 0–100 scale
            const color = c.isATH ? "#f59e0b" : c.pctFromATH > -5 ? "#f97316" : "#64748b";
            return (
              <div key={c.code} className="flex items-center gap-3">
                <span className="w-12 text-right text-slate-400 text-xs">{c.flag} {c.code}</span>
                <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${Math.max(2, barPct)}%`, backgroundColor: color }}
                  />
                </div>
                <span className={`w-16 text-right text-xs font-semibold ${c.isATH ? "text-yellow-400" : c.pctFromATH > -5 ? "text-orange-400" : "text-slate-400"}`}>
                  {c.pctFromATH >= 0 ? "ATH" : `${c.pctFromATH.toFixed(1)}%`}
                </span>
              </div>
            );
          })}
        </div>
        <div className="text-slate-500 text-xs mt-4">
          Bar length = closeness to ATH (100% = at ATH). Gold = at ATH, Orange = within 5%, Gray = further.
        </div>
      </div>

      {/* Interpretation grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.currencies.filter(c => c.isATH || c.pctFromATH > -6).map(c => (
          <div key={c.code} className={`rounded-xl p-4 border text-sm ${c.isATH ? "bg-yellow-900/15 border-yellow-600/30" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{c.flag}</span>
              <span className="text-white font-semibold">{c.code}</span>
              <ATHBadge pct={c.pctFromATH} />
            </div>
            <p className="text-slate-300">{c.interpretation}</p>
          </div>
        ))}
      </div>

      {/* Education */}
      <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-6 space-y-3 text-sm text-slate-400">
        <h3 className="text-white font-semibold mb-3">Why Currency Context Matters</h3>
        <p>Gold is priced in USD but <span className="text-slate-200">its true value is measured in every currency</span>. A currency hitting an ATH in local terms while USD gold is flat means the local currency is weakening — a de facto gold bullish signal for that economy.</p>
        <p>During USD bull markets, USD-priced gold may stall while breaking records in JPY, TRY, BRL, etc. <span className="text-slate-200">Broad ATHs across many currencies = structural gold demand</span>, not just a dollar story.</p>
        <p>Conversely, if gold makes new ATHs only in USD, it may reflect temporary safe-haven demand rather than a persistent trend.</p>
      </div>
    </div>
  );
}
