"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface MonthStat {
  month: number;
  name: string;
  avgReturn: number;
  winRate: number;
  bestYear: number;
  bestReturn: number;
  worstYear: number;
  worstReturn: number;
  sampleYears: number;
  signal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
}

interface QuarterStat {
  quarter: string;
  months: string;
  avgReturn: number;
  winRate: number;
  bestQuarterReturn: number;
}

interface SeasonalityDetailData {
  currentMonth: number;
  currentMonthStat: MonthStat;
  months: MonthStat[];
  quarters: QuarterStat[];
  bestMonths: MonthStat[];
  worstMonths: MonthStat[];
  currentYearProjected: number;
  timestamp: string;
}

const SIGNAL_META = {
  strong_buy:  { label: "Strong Buy",  color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
  buy:         { label: "Buy",         color: "#86efac", bg: "rgba(134,239,172,0.08)" },
  neutral:     { label: "Neutral",     color: "#f5c451", bg: "rgba(245,196,81,0.08)"  },
  sell:        { label: "Sell",        color: "#fca5a5", bg: "rgba(252,165,165,0.08)" },
  strong_sell: { label: "Strong Sell", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
};

const MON_ABBR = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function ReturnBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = (Math.abs(value) / maxAbs) * 100;
  const color = value >= 0 ? "#34d399" : "#f87171";
  return (
    <div className="flex items-center gap-1.5 flex-1">
      {value < 0 ? (
        <>
          <div className="h-2 rounded-r-sm" style={{ width: `${pct}%`, background: color, marginLeft: `${100 - pct}%` }} />
          <div className="w-0" />
        </>
      ) : (
        <div className="h-2 rounded-r-sm" style={{ width: `${pct}%`, background: color }} />
      )}
    </div>
  );
}

export default function SeasonalityDetailPage() {
  const { t } = useI18n();
  const [data, setData] = useState<SeasonalityDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seasonality-detail")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading seasonality data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const maxAbs = Math.max(...data.months.map(m => Math.abs(m.avgReturn)));
  const cur = data.currentMonthStat;
  const curMeta = SIGNAL_META[cur.signal];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navSeasonalityDetail")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Gold Seasonality (1975–2024) · Monthly & Quarterly Patterns · {data.months[0].sampleYears} Years of Data
        </p>
      </div>

      {/* Current month highlight */}
      <div className="rounded-xl p-5 flex gap-4 items-start"
        style={{ background: curMeta.bg, border: `1px solid rgba(255,255,255,0.08)` }}>
        <div className="text-3xl">📅</div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>
            CURRENT MONTH — {cur.name.toUpperCase()}
          </div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-black" style={{ color: cur.avgReturn >= 0 ? "#34d399" : "#f87171" }}>
              {cur.avgReturn >= 0 ? "+" : ""}{cur.avgReturn.toFixed(2)}%
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{ background: curMeta.bg, color: curMeta.color, border: `1px solid ${curMeta.color}30` }}>
              {curMeta.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div style={{ color: "rgba(175,185,215,0.5)" }}>Win Rate: <span style={{ color: "#f5c451" }}>{cur.winRate}%</span></div>
            <div style={{ color: "rgba(175,185,215,0.5)" }}>Projected remaining: <span style={{ color: "#f5c451" }}>{data.currentYearProjected >= 0 ? "+" : ""}{data.currentYearProjected.toFixed(1)}%</span></div>
            <div style={{ color: "rgba(175,185,215,0.5)" }}>Best: <span style={{ color: "#34d399" }}>+{cur.bestReturn}% ({cur.bestYear})</span></div>
            <div style={{ color: "rgba(175,185,215,0.5)" }}>Worst: <span style={{ color: "#f87171" }}>{cur.worstReturn}% ({cur.worstYear})</span></div>
          </div>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="rounded-xl p-5"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold mb-4" style={{ color: "rgba(175,185,215,0.6)" }}>
          AVERAGE MONTHLY RETURN (49yr) — Higher = Stronger Seasonal Tailwind
        </div>
        <div className="space-y-2">
          {data.months.map((m) => {
            const meta = SIGNAL_META[m.signal];
            const isCur = m.month === data.currentMonth;
            const barW = (Math.abs(m.avgReturn) / maxAbs) * 100;
            return (
              <div key={m.month} className="flex items-center gap-2"
                style={isCur ? { background: "rgba(245,196,81,0.06)", borderRadius: 8, padding: "2px 4px", margin: "-2px -4px" } : {}}>
                <div className="w-7 text-[10px] font-bold shrink-0 text-right"
                  style={{ color: isCur ? "#f5c451" : "rgba(175,185,215,0.5)" }}>
                  {MON_ABBR[m.month]}
                </div>
                <div className="flex-1 h-3 relative rounded overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="absolute left-0 top-0 h-full rounded"
                    style={{
                      width: `${barW}%`,
                      background: m.avgReturn >= 0
                        ? `rgba(52,211,153,${0.4 + barW / 200})`
                        : `rgba(248,113,113,${0.4 + barW / 200})`,
                    }} />
                </div>
                <div className="w-14 text-[10px] font-mono text-right shrink-0"
                  style={{ color: m.avgReturn >= 0 ? "#34d399" : "#f87171" }}>
                  {m.avgReturn >= 0 ? "+" : ""}{m.avgReturn.toFixed(2)}%
                </div>
                <div className="w-8 text-[9px] text-right shrink-0"
                  style={{ color: "rgba(175,185,215,0.35)" }}>
                  {m.winRate}%W
                </div>
                <div className="w-16 text-[9px] shrink-0">
                  <span className="px-1.5 py-0.5 rounded text-[8px]"
                    style={{ background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quarterly breakdown */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.quarters.map(q => (
          <div key={q.quarter} className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-base font-black" style={{ color: "#f5c451" }}>{q.quarter}</div>
            <div className="text-[9px] mb-2" style={{ color: "rgba(175,185,215,0.35)" }}>{q.months}</div>
            <div className="text-xl font-black" style={{ color: q.avgReturn >= 0 ? "#34d399" : "#f87171" }}>
              {q.avgReturn >= 0 ? "+" : ""}{q.avgReturn.toFixed(2)}%
            </div>
            <div className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.4)" }}>
              Win: {q.winRate}% · Best: +{q.bestQuarterReturn}%
            </div>
          </div>
        ))}
      </div>

      {/* Best / worst */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl p-4" style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.12)" }}>
          <div className="text-xs font-bold mb-3" style={{ color: "#34d399" }}>🏆 STRONGEST MONTHS</div>
          {data.bestMonths.map((m, i) => (
            <div key={m.month} className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black w-4" style={{ color: "#34d399" }}>#{i + 1}</span>
                <span className="text-[11px]" style={{ color: "rgba(175,185,215,0.7)" }}>{m.name}</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold" style={{ color: "#34d399" }}>+{m.avgReturn.toFixed(2)}%</div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>{m.winRate}% win</div>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-4" style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.12)" }}>
          <div className="text-xs font-bold mb-3" style={{ color: "#f87171" }}>⚠️ WEAKEST MONTHS</div>
          {data.worstMonths.map((m, i) => (
            <div key={m.month} className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black w-4" style={{ color: "#f87171" }}>#{i + 1}</span>
                <span className="text-[11px]" style={{ color: "rgba(175,185,215,0.7)" }}>{m.name}</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold" style={{ color: "#f87171" }}>{m.avgReturn.toFixed(2)}%</div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>{m.winRate}% win</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Based on 49 years of COMEX gold monthly data (1975–2024) · Past seasonal patterns do not guarantee future performance · Not financial advice
      </p>
    </div>
  );
}
