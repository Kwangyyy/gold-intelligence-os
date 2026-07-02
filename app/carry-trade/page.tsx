"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { CarryTradePayload, ForwardPoint, HistoricalLeaseRate } from "@/app/api/carry-trade/route";

function StructureBadge({ shape }: { shape: string }) {
  const cfg =
    shape === "contango"     ? { bg: "rgba(245,196,81,0.12)",  color: "#f5c451", label: "Contango"     } :
    shape === "backwardation"? { bg: "rgba(52,211,153,0.12)",  color: "#34d399", label: "Backwardation"} :
    shape === "mixed"        ? { bg: "rgba(192,132,252,0.12)", color: "#c084fc", label: "Mixed"        } :
                               { bg: "rgba(156,163,175,0.12)", color: "#9ca3af", label: "Flat"         };
  return (
    <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      {cfg.label}
    </span>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const cfg =
    signal === "gold friendly" ? { bg: "rgba(52,211,153,0.12)",  color: "#34d399" } :
    signal === "carry headwind"? { bg: "rgba(248,113,113,0.12)", color: "#f87171" } :
                                 { bg: "rgba(245,196,81,0.12)",  color: "#f5c451" };
  return (
    <span className="text-[9px] font-black px-3 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      {signal}
    </span>
  );
}

export default function CarryTradePage() {
  const { tier } = useTier();
  const [data, setData] = useState<CarryTradePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/carry-trade", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/carry-trade")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Premium tier required</div>
          <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>Upgrade to access Carry Trade & Forward Curve</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Fetching forward curve…</div>
    </div>
  );
  if (error || !data) return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-xs" style={{ color: "#f87171" }}>{error || "No data"}</div>
    </div>
  );

  const { metrics } = data;
  const maxPremium = Math.max(...data.forwardCurve.map(f => Math.abs(f.premium ?? 0)), 1);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="💱 Carry Trade & Forward Curve"
        subtitle="Gold futures structure — contango, lease rates, carry analysis"
      />

      {/* ── Header Metrics ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Spot Gold",        value: `$${metrics.spotPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: "#f5c451" },
          { label: "Curve Shape",      value: data.curveShape, color: data.curveShape === "backwardation" ? "#34d399" : "#f5c451", badge: true },
          { label: "Avg Carry (Ann.)", value: `${metrics.avgCarryCost.toFixed(2)}%`, color: "#f5c451" },
          { label: "Risk-Free (SOFR)", value: `${metrics.riskFreeRate.toFixed(2)}%`, color: "rgba(175,185,215,0.6)" },
        ].map(item => (
          <div key={item.label} className="panel px-3 py-3 text-center">
            <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>{item.label}</div>
            {item.badge
              ? <StructureBadge shape={item.value} />
              : <div className="text-lg font-black" style={{ color: item.color }}>{item.value}</div>
            }
          </div>
        ))}
      </div>

      {/* ── Carry Signal ─────────────────────────────────────── */}
      <div className="panel px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Carry Signal</div>
          <SignalBadge signal={data.carrySignal} />
        </div>
        <div className="flex-1 text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>
          {data.carryInterpretation}
        </div>
      </div>

      {/* ── Forward Curve Chart ───────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-4">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📈 Forward Curve — Futures Prices
        </div>

        {/* Spot baseline */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-16 text-right text-[9px] font-bold" style={{ color: "rgba(175,185,215,0.4)" }}>Spot</div>
          <div className="flex-1 h-8 relative">
            <div className="absolute left-0 top-0 h-full w-px" style={{ background: "rgba(245,196,81,0.4)" }} />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 ml-2 text-[9px] font-black" style={{ color: "#f5c451" }}>
              ${data.spotPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {data.forwardCurve.map((f: ForwardPoint) => {
          const pct = maxPremium > 0 ? Math.abs(f.premium ?? 0) / maxPremium : 0;
          const isContango = (f.premium ?? 0) > 0;
          return (
            <div key={f.label} className="flex items-center gap-3">
              <div className="w-16 text-right text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{f.label}</div>
              <div className="flex-1 relative h-8 rounded-lg overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-lg"
                  style={{
                    width: `${Math.max(pct * 80 + 5, 5)}%`,
                    background: isContango ? "rgba(245,196,81,0.12)" : "rgba(52,211,153,0.15)",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <span className="text-[9px] font-black" style={{ color: "rgba(255,255,255,0.7)" }}>
                    ${f.price?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px]"
                      style={{ color: isContango ? "#f5c451" : "#34d399" }}>
                      {isContango ? "+" : ""}{(f.premium ?? 0).toFixed(1)} ({(f.premiumPct ?? 0).toFixed(1)}%/yr)
                    </span>
                    <StructureBadge shape={f.structure ?? "flat"} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Lease Rates & Carry Metrics ───────────────────────── */}
      <div className="panel px-5 py-5 space-y-4">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          💰 Implied Lease Rates & Carry Metrics
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Implied Lease 3M",  value: `${metrics.impliedLeasRate3M.toFixed(2)}%`, sub: "gold borrow cost vs SOFR" },
            { label: "Implied Lease 12M", value: `${metrics.impliedLeaseRate12M.toFixed(2)}%`, sub: "longer-dated borrow rate" },
            { label: "Gold Borrow Cost",  value: `${metrics.goldBorrowCost.toFixed(2)}%`, sub: "risk-free minus carry" },
            { label: "Carry Opportunity", value: metrics.carryOpportunity, sub: "vs USD rates", color: metrics.carryOpportunity === "positive" ? "#34d399" : metrics.carryOpportunity === "negative" ? "#f87171" : "#f5c451" },
          ].map(item => (
            <div key={item.label} className="rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>{item.label}</div>
              <div className="text-sm font-black" style={{ color: item.color ?? "#f5c451" }}>{item.value}</div>
              <div className="text-[7px] mt-0.5" style={{ color: "rgba(175,185,215,0.25)" }}>{item.sub}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl px-4 py-3 text-[9px] space-y-1.5"
          style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.12)" }}>
          <div className="font-bold" style={{ color: "rgba(168,85,247,0.7)" }}>💡 Carry Trade Logic</div>
          <div style={{ color: "rgba(175,185,215,0.5)" }}>
            Gold carry trade = borrow USD at risk-free rate → buy spot gold → sell forward.<br />
            Profit when: lease rate &gt; 0 (forward premium &lt; risk-free rate difference).<br />
            <span style={{ color: "#f5c451" }}>Low lease rates</span> → carry trade profits shrink → gold becomes less attractive vs USD bonds.<br />
            <span style={{ color: "#34d399" }}>Backwardation</span> → immediate demand exceeds supply → historically very bullish signal.
          </div>
        </div>
      </div>

      {/* ── Historical Lease Rates ────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📅 Historical Lease Rate Context
        </div>
        {data.historicalLeaseRates.map((h: HistoricalLeaseRate) => (
          <div key={h.period} className="flex items-center gap-3 rounded-xl px-4 py-2.5"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-28 shrink-0">
              <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{h.period}</div>
            </div>
            <div className="flex gap-3 flex-1">
              <div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>1M</div>
                <div className="text-[10px] font-black" style={{ color: h.leaseRate1M > 0 ? "#f5c451" : "#34d399" }}>
                  {h.leaseRate1M.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>3M</div>
                <div className="text-[10px] font-black" style={{ color: h.leaseRate3M > 0 ? "#f5c451" : "#34d399" }}>
                  {h.leaseRate3M.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="text-[8px] flex-1 text-right" style={{ color: "rgba(175,185,215,0.35)" }}>{h.note}</div>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Updated every 15m
      </div>
    </div>
  );
}
