"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type {
  SmartMoneyPayload,
  COTSnapshot,
  ETFFlowEntry,
  CentralBankEntry,
  SmartMoneySignal,
} from "@/app/api/smart-money/route";

function ScoreArc({ score }: { score: number }) {
  const r = 56;
  const circ = Math.PI * r;
  const fill = circ * (score / 100);
  const color =
    score >= 75 ? "#34d399" :
    score >= 55 ? "#f5c451" :
    score >= 35 ? "#fb923c" : "#f87171";
  return (
    <svg viewBox="0 0 140 80" className="w-full max-w-[180px]">
      {/* Background arc */}
      <path
        d={`M 14 76 A ${r} ${r} 0 0 1 126 76`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round"
      />
      {/* Fill arc */}
      <path
        d={`M 14 76 A ${r} ${r} 0 0 1 126 76`}
        fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
      <text x="70" y="68" textAnchor="middle" fill={color} fontSize="22" fontWeight="900">{score}</text>
      <text x="70" y="78" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7">/100</text>
    </svg>
  );
}

function SignalBadge({ signal }: { signal: "bullish" | "neutral" | "bearish" }) {
  const cfg = {
    bullish:  { bg: "rgba(52,211,153,0.12)",  color: "#34d399", label: "Bullish"  },
    neutral:  { bg: "rgba(245,196,81,0.12)",  color: "#f5c451", label: "Neutral"  },
    bearish:  { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "Bearish"  },
  }[signal];
  return (
    <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      {cfg.label}
    </span>
  );
}

function WeightBar({ weight }: { weight: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 rounded-full flex-1" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full" style={{ width: `${weight * 100}%`, background: "rgba(192,132,252,0.6)" }} />
      </div>
      <span className="text-[8px] w-6 text-right" style={{ color: "rgba(175,185,215,0.4)" }}>{Math.round(weight * 100)}%</span>
    </div>
  );
}

export default function SmartMoneyPage() {
  const { tier } = useTier();
  const [data, setData] = useState<SmartMoneyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/smart-money", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/smart-money")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Pro tier required</div>
          <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.4)" }}>Upgrade to access Smart Money Dashboard</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Loading smart money data…</div>
    </div>
  );
  if (error || !data) return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-xs" style={{ color: "#f87171" }}>{error || "No data"}</div>
    </div>
  );

  const biasColor =
    data.smartMoneyBias.includes("Strongly Bullish") ? "#34d399" :
    data.smartMoneyBias.includes("Bullish")          ? "#86efac" :
    data.smartMoneyBias.includes("Bearish")          ? "#f87171" : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🧠 Smart Money Dashboard"
        subtitle="Institutional positioning — COT, ETF flows, central bank demand"
      />

      {/* ── Smart Money Score ─────────────────────────────────── */}
      <div className="panel px-5 py-5">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ScoreArc score={data.smartMoneyScore} />
            <div className="text-[9px] uppercase tracking-widest mt-1" style={{ color: "rgba(175,185,215,0.3)" }}>Smart Money Score</div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <div className="text-lg font-black" style={{ color: biasColor }}>{data.smartMoneyBias}</div>
              <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
                Trend: <span style={{ color: data.scoreTrend === "rising" ? "#34d399" : data.scoreTrend === "falling" ? "#f87171" : "#f5c451" }}>
                  {data.scoreTrend === "rising" ? "↗ Rising" : data.scoreTrend === "falling" ? "↘ Falling" : "→ Stable"}
                </span>
              </div>
            </div>
            <div className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>
              {data.interpretation}
            </div>
          </div>
        </div>
      </div>

      {/* ── Signal Breakdown ──────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Signal Components
        </div>
        {data.signals.map((sig: SmartMoneySignal) => (
          <div key={sig.source} className="rounded-xl px-4 py-3 space-y-1.5"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{sig.source}</div>
              <SignalBadge signal={sig.signal} />
            </div>
            <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.5)" }}>{sig.detail}</div>
            <WeightBar weight={sig.weight} />
          </div>
        ))}
      </div>

      {/* ── COT Report ────────────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
            📋 CFTC Commitments of Traders
          </div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
            Report date: {data.cot.reportDate}
          </div>
        </div>

        {/* Percentile bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>
            <span>Bearish (0)</span>
            <span className="font-bold" style={{ color: "#f5c451" }}>
              Large Spec Net: {data.cot.largeSpecNetPctile}th pctile
            </span>
            <span>Bullish (100)</span>
          </div>
          <div className="h-3 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full rounded-full relative" style={{ width: `${data.cot.largeSpecNetPctile}%`, background: "linear-gradient(90deg, #f5c451, #34d399)" }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2"
                style={{ background: "#111", borderColor: "#f5c451" }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Large Spec Net",  value: `+${data.cot.largeSpecNet.toLocaleString()}`, sub: "contracts", color: "#34d399" },
            { label: "Weekly Change",   value: data.cot.weeklyChange > 0 ? `+${data.cot.weeklyChange.toLocaleString()}` : data.cot.weeklyChange.toLocaleString(), sub: "contracts", color: data.cot.weeklyChange > 0 ? "#34d399" : "#f87171" },
            { label: "Open Interest",   value: data.cot.openInterest.toLocaleString(), sub: "contracts", color: "#f5c451" },
            { label: "Commercial Net",  value: data.cot.commercialNet.toLocaleString(), sub: "contracts (hedgers)", color: "#fb923c" },
          ].map(item => (
            <div key={item.label} className="rounded-xl px-3 py-2.5 text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[9px] mb-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{item.label}</div>
              <div className="text-sm font-black" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ETF Flows ─────────────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
          📈 Gold ETF Holdings & Flows
        </div>
        {data.etfFlows.map((e: ETFFlowEntry) => (
          <div key={e.ticker} className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-12 text-center">
              <div className="text-[9px] font-black" style={{ color: "#f5c451" }}>{e.ticker}</div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>${e.aumBn.toFixed(1)}B</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{e.name}</div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                {e.heldOzMillion.toFixed(2)}M oz held
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-[9px] font-bold" style={{ color: e.weekChange >= 0 ? "#34d399" : "#f87171" }}>
                {e.weekChange >= 0 ? "+" : ""}{e.weekChange.toFixed(2)}M oz
              </div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>this week</div>
            </div>
            <SignalBadge signal={e.signal === "inflow" ? "bullish" : e.signal === "outflow" ? "bearish" : "neutral"} />
          </div>
        ))}
        <div className="text-[8px] text-right pt-1" style={{ color: "rgba(175,185,215,0.25)" }}>
          Total weekly net: {data.etfFlows.reduce((s, e) => s + e.weekChange, 0).toFixed(2)}M oz
        </div>
      </div>

      {/* ── Central Bank Demand ───────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
          🏦 Central Bank Demand — Q1 2026 (WGC Data)
        </div>
        {data.centralBanks.map((cb: CentralBankEntry) => (
          <div key={cb.entity} className="flex items-center gap-3 rounded-xl px-4 py-2.5"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-xl shrink-0">{cb.flag}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] truncate" style={{ color: "rgba(255,255,255,0.65)" }}>{cb.entity}</div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                Gold: {cb.totalReservesPct.toFixed(1)}% of FX reserves
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black"
                style={{ color: cb.q1_2026Tonnes > 0 ? "#34d399" : cb.q1_2026Tonnes < 0 ? "#f87171" : "#f5c451" }}>
                {cb.q1_2026Tonnes > 0 ? "+" : ""}{cb.q1_2026Tonnes.toFixed(1)}t
              </div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Q1 2026</div>
            </div>
            <div className="text-sm">
              {cb.trend === "buying" ? "🟢" : cb.trend === "selling" ? "🔴" : "⚪"}
            </div>
          </div>
        ))}
        <div className="text-[8px] mt-1" style={{ color: "rgba(175,185,215,0.25)" }}>
          Total Q1 2026 purchases: +{data.centralBanks.reduce((s, c) => s + c.q1_2026Tonnes, 0).toFixed(1)} tonnes
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · CFTC/WGC data, ~weekly update
      </div>
    </div>
  );
}
