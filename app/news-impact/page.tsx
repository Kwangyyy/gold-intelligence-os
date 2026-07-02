"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { NewsImpactPayload, ImpactStudy, UpcomingEvent } from "@/app/api/news-impact/route";

const RISK_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f87171",
  medium:   "#f5c451",
  low:      "#9ca3af",
};
const RISK_BG: Record<string, string> = {
  critical: "rgba(239,68,68,0.15)",
  high:     "rgba(248,113,113,0.10)",
  medium:   "rgba(245,196,81,0.10)",
  low:      "rgba(156,163,175,0.08)",
};

function RiskBadge({ level }: { level: string }) {
  return (
    <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase"
      style={{ background: RISK_BG[level], color: RISK_COLOR[level], border: `1px solid ${RISK_COLOR[level]}40` }}>
      {level}
    </span>
  );
}

function MoveBars({ hot, cool }: { hot: number; cool: number }) {
  const maxAbs = Math.max(Math.abs(hot), Math.abs(cool), 1);
  return (
    <div className="space-y-1">
      {[
        { label: "Hot surprise", val: hot,  color: "#f87171" },
        { label: "Cool surprise", val: cool, color: "#34d399" },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <div className="w-20 text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>{item.label}</div>
          <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full rounded-sm" style={{
              width: `${(Math.abs(item.val) / maxAbs) * 100}%`,
              background: item.color + "80",
              marginLeft: item.val < 0 ? 0 : undefined,
            }} />
          </div>
          <div className="w-10 text-right text-[8px] font-bold" style={{ color: item.color }}>
            {item.val > 0 ? "+" : ""}{item.val.toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NewsImpactPage() {
  const { tier } = useTier();
  const [data, setData] = useState<NewsImpactPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/news-impact", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/news-impact")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Premium tier required</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Loading impact studies…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="📰 News Impact Studies"
        subtitle="Historical gold price reaction to major economic releases — sorted by impact"
      />

      {/* ── Upcoming Events ───────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
            📅 Upcoming High-Impact Events
          </div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
            Next: {data.nextHighImpact}
          </div>
        </div>
        {data.upcomingEvents.map((ev: UpcomingEvent) => (
          <div key={`${ev.event}-${ev.date}`} className="flex items-center gap-3 rounded-xl px-4 py-2.5"
            style={{ background: RISK_BG[ev.riskLevel], border: `1px solid ${RISK_COLOR[ev.riskLevel]}25` }}>
            <div className="text-xl shrink-0">{ev.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black" style={{ color: "rgba(255,255,255,0.75)" }}>{ev.event}</span>
                <RiskBadge level={ev.riskLevel} />
              </div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                {ev.date} · {ev.time} UTC · Exp: {ev.expected} · Prior: {ev.prior}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-black" style={{ color: RISK_COLOR[ev.riskLevel] }}>
                {ev.daysAway}d
              </div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>away</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Impact Studies ────────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
          🔬 Historical Impact Studies (5Y Average Gold Reaction)
        </div>

        {data.impactStudies.map((study: ImpactStudy) => {
          const isExpanded = expanded === study.event;
          return (
            <div key={study.event}
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Header row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ background: "rgba(255,255,255,0.02)" }}
                onClick={() => setExpanded(isExpanded ? null : study.event)}>
                <div className="text-xl shrink-0">{study.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black" style={{ color: "rgba(255,255,255,0.75)" }}>{study.event}</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(245,196,81,0.1)", color: "#f5c451" }}>
                      {study.bullishPct}% bullish
                    </span>
                  </div>
                  <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
                    Avg move: 1H±{study.avgMove1H.toFixed(2)}% · 4H±{study.avgMove4H.toFixed(2)}% · 24H±{study.avgMove24H.toFixed(2)}%
                  </div>
                </div>
                <div className="text-xs" style={{ color: "rgba(175,185,215,0.3)" }}>
                  {isExpanded ? "▲" : "▼"}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="text-[9px] leading-relaxed pt-2" style={{ color: "rgba(175,185,215,0.55)" }}>
                    {study.logic}
                  </div>

                  <div>
                    <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.25)" }}>
                      Gold Reaction by Surprise Direction
                    </div>
                    <MoveBars hot={study.hotterExpected} cool={study.coolerExpected} />
                  </div>

                  {/* Recent surprises */}
                  <div>
                    <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.25)" }}>
                      Recent Releases
                    </div>
                    <div className="space-y-1.5">
                      {study.recentSurprises.map(s => (
                        <div key={s.date} className="flex items-center gap-3 rounded-lg px-3 py-2"
                          style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div className="w-16 text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>{s.date}</div>
                          <div className="text-[8px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{s.actual}</div>
                          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>exp: {s.expected}</div>
                          <div className="flex-1 text-right">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                              style={{
                                background: s.surprise === "cool" ? "rgba(52,211,153,0.1)" : s.surprise === "hot" ? "rgba(248,113,113,0.1)" : "rgba(245,196,81,0.1)",
                                color: s.surprise === "cool" ? "#34d399" : s.surprise === "hot" ? "#f87171" : "#f5c451",
                              }}>
                              {s.surprise}
                            </span>
                          </div>
                          <div className="w-12 text-right text-[9px] font-black"
                            style={{ color: s.goldMove >= 0 ? "#34d399" : "#f87171" }}>
                            {s.goldMove >= 0 ? "+" : ""}{s.goldMove.toFixed(2)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Impact data based on 5Y event study analysis
      </div>
    </div>
  );
}
