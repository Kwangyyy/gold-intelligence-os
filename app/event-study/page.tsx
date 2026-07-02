"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface EventResult {
  event: string;
  category: string;
  icon: string;
  instances: number;
  avgReturn1d: number;
  avgReturn5d: number;
  avgReturn20d: number;
  winRate1d: number;
  winRate5d: number;
  winRate20d: number;
  bestCase: number;
  worstCase: number;
  signal: "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";
  notes: string;
}

interface EventStudyData {
  events: EventResult[];
  topBullishEvent: string;
  topBearishEvent: string;
  insight: string;
  methodology: string;
  timestamp: string;
}

const SIGNAL_META = {
  strong_bullish: { label: "Strong Buy",  color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
  bullish:        { label: "Bullish",     color: "#86efac", bg: "rgba(134,239,172,0.07)" },
  neutral:        { label: "Neutral",     color: "#f5c451", bg: "rgba(245,196,81,0.07)"  },
  bearish:        { label: "Bearish",     color: "#fca5a5", bg: "rgba(252,165,165,0.07)" },
  strong_bearish: { label: "Strong Sell", color: "#f87171", bg: "rgba(248,113,113,0.1)"  },
};

const CATEGORIES = ["All", "Central Bank", "Inflation", "Employment", "Risk Event", "Dollar", "Geopolitical", "Fiscal"];

function ReturnBadge({ value }: { value: number }) {
  const color = value > 0.5 ? "#34d399" : value < -0.5 ? "#f87171" : "#f5c451";
  return <span className="text-[10px] font-mono font-bold" style={{ color }}>{value >= 0 ? "+" : ""}{value.toFixed(2)}%</span>;
}

function WinRateBar({ value }: { value: number }) {
  const color = value >= 65 ? "#34d399" : value <= 40 ? "#f87171" : "#f5c451";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 rounded-full overflow-hidden" style={{ width: "48px", background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[9px] font-mono" style={{ color }}>{value}%</span>
    </div>
  );
}

export default function EventStudyPage() {
  const { t } = useI18n();
  const [data, setData] = useState<EventStudyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"5d" | "1d" | "20d" | "wr5d">("5d");

  useEffect(() => {
    fetch("/api/event-study")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Loading historical event data…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const filtered = data.events
    .filter(e => filter === "All" || e.category === filter)
    .sort((a, b) => {
      if (sortBy === "5d")  return b.avgReturn5d  - a.avgReturn5d;
      if (sortBy === "1d")  return b.avgReturn1d  - a.avgReturn1d;
      if (sortBy === "20d") return b.avgReturn20d - a.avgReturn20d;
      return b.winRate5d - a.winRate5d;
    });

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navEventStudy")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Historical Gold Reaction to Macro Events · 1975–2024 · Avg Returns & Win Rates
        </p>
      </div>

      {/* Top insight */}
      <div className="rounded-xl p-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg p-3" style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.15)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>MOST BULLISH EVENT</div>
          <div className="text-xs font-bold" style={{ color: "#34d399" }}>{data.topBullishEvent}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.15)" }}>
          <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.4)" }}>MOST BEARISH EVENT</div>
          <div className="text-xs font-bold" style={{ color: "#f87171" }}>{data.topBearishEvent}</div>
        </div>
      </div>
      <p className="text-[10px] -mt-2 px-1 leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.insight}</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className="text-[9px] px-2.5 py-1 rounded-full transition-all"
            style={{
              background: filter === cat ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === cat ? "rgba(245,196,81,0.4)" : "rgba(255,255,255,0.06)"}`,
              color: filter === cat ? "#f5c451" : "rgba(175,185,215,0.5)",
            }}
          >
            {cat}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {(["5d", "1d", "20d", "wr5d"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className="text-[8px] px-2 py-1 rounded"
              style={{
                background: sortBy === s ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${sortBy === s ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.05)"}`,
                color: sortBy === s ? "#60a5fa" : "rgba(175,185,215,0.4)",
              }}
            >
              Sort: {s === "wr5d" ? "Win%" : s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Event table */}
      <div className="space-y-2">
        {filtered.map(ev => {
          const sig = SIGNAL_META[ev.signal];
          return (
            <div key={ev.event} className="rounded-xl p-4" style={{ background: sig.bg, border: `1px solid ${sig.color}22` }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">{ev.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>{ev.event}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.4)" }}>{ev.category}</span>
                    <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{ev.instances} instances</span>
                  </div>
                </div>
                <span className="text-[9px] px-2 py-1 rounded-full font-bold" style={{ background: `${sig.color}18`, color: sig.color }}>
                  {sig.label}
                </span>
              </div>

              {/* Returns grid */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: "1D Avg",  ret: ev.avgReturn1d,  wr: ev.winRate1d  },
                  { label: "5D Avg",  ret: ev.avgReturn5d,  wr: ev.winRate5d  },
                  { label: "20D Avg", ret: ev.avgReturn20d, wr: ev.winRate20d },
                ].map(item => (
                  <div key={item.label} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>{item.label}</div>
                    <ReturnBadge value={item.ret} />
                    <div className="mt-1"><WinRateBar value={item.wr} /></div>
                  </div>
                ))}
              </div>

              {/* Range */}
              <div className="flex items-center gap-4 mb-2">
                <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                  Best 5D: <span style={{ color: "#34d399" }}>+{ev.bestCase.toFixed(1)}%</span>
                </span>
                <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                  Worst 5D: <span style={{ color: "#f87171" }}>{ev.worstCase.toFixed(1)}%</span>
                </span>
              </div>

              <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{ev.notes}</p>
            </div>
          );
        })}
      </div>

      {/* Methodology */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="text-[9px] font-bold mb-2" style={{ color: "rgba(175,185,215,0.4)" }}>METHODOLOGY</div>
        <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.35)" }}>{data.methodology}</p>
      </div>

      <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        Historical data 1975–2024 · Past performance does not guarantee future results · Not financial advice
      </p>
    </div>
  );
}
