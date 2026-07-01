"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MarketSummaryPayload, SignalItem } from "@/app/api/market-summary/route";

const BIAS_CONFIG = {
  bullish: { color: "#34d399", label: "BULL", icon: "↑" },
  bearish: { color: "#f87171", label: "BEAR", icon: "↓" },
  neutral: { color: "#f5c451", label: "NEU",  icon: "→" },
};

function CompositeRing({ score, color }: { score: number; color: string }) {
  const r = 52, cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  return (
    <div className="relative flex items-center justify-center w-[120px] h-[120px]">
      <svg viewBox="0 0 120 120" width="120" height="120" className="absolute">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div className="relative z-10 text-center">
        <div className="text-2xl font-black" style={{ color }}>{score}</div>
        <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>/ 100</div>
      </div>
    </div>
  );
}

function SignalCard({ s }: { s: SignalItem }) {
  const [open, setOpen] = useState(false);
  const { color } = BIAS_CONFIG[s.bias];
  return (
    <div
      className="panel px-4 py-3 cursor-pointer"
      style={{ borderLeft: `3px solid ${color}30` }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.7)" }}>
              {s.moduleTh}
            </span>
            <span
              className="text-[8px] font-black px-1.5 py-0.5 rounded"
              style={{ background: `${color}20`, color }}
            >
              {BIAS_CONFIG[s.bias].icon} {BIAS_CONFIG[s.bias].label}
            </span>
          </div>
          {/* Score bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: color }} />
          </div>
        </div>
        <span className="text-[9px] opacity-30 shrink-0">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t space-y-1" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.7)" }}>{s.highlightTh}</p>
          <p className="text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>{s.signal}</p>
        </div>
      )}
    </div>
  );
}

function BiasPill({ count, bias }: { count: number; bias: SignalItem["bias"] }) {
  const { color, label } = BIAS_CONFIG[bias];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-2xl font-black" style={{ color }}>{count}</div>
      <div
        className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{ background: `${color}15`, color }}
      >
        {label}
      </div>
    </div>
  );
}

export default function MarketSummaryPage() {
  const [data, setData]       = useState<MarketSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/market-summary", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🧭 Market Summary"
        subtitle="Composite view across all modules — single actionable verdict"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🧭 กำลังรวบรวมสัญญาณจากทุกโมดูล…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero — composite score + bias counts */}
          <div className="panel px-5 py-5">
            <div className="flex items-center gap-6">
              <CompositeRing score={data.compositeScore} color={data.compositeColor} />
              <div className="flex-1">
                <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Composite Score
                </div>
                <div className="text-2xl font-black mb-0.5" style={{ color: data.compositeColor }}>
                  {data.compositeLabelTh}
                </div>
                <div className="text-[10px] mb-3" style={{ color: "rgba(175,185,215,0.4)" }}>
                  {data.compositeLabel}
                </div>
                <div className="flex gap-6">
                  <BiasPill count={data.bullCount}    bias="bullish" />
                  <BiasPill count={data.neutralCount} bias="neutral" />
                  <BiasPill count={data.bearCount}    bias="bearish" />
                </div>
              </div>
            </div>
          </div>

          {/* Actionable */}
          <div
            className="panel px-5 py-4"
            style={{
              background: `${data.compositeColor}08`,
              border: `1px solid ${data.compositeColor}25`,
            }}
          >
            <p className="text-sm font-bold" style={{ color: data.compositeColor }}>
              {data.actionableTh}
            </p>
          </div>

          {/* Summary text */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              สรุปภาพรวม
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(175,185,215,0.7)" }}>
              {data.summaryTh}
            </p>
            <p className="text-[9px] mt-1 leading-relaxed" style={{ color: "rgba(175,185,215,0.3)" }}>
              {data.summaryEn}
            </p>
          </div>

          {/* Signal cards */}
          <div>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              สัญญาณรายโมดูล ({data.signals.length}) — คลิกเพื่อดูรายละเอียด
            </div>
            <div className="space-y-2">
              {data.signals.map(s => <SignalCard key={s.module} s={s} />)}
            </div>
          </div>

          {/* Signal distribution bar */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              การกระจายสัญญาณ
            </div>
            <div className="flex h-5 rounded-full overflow-hidden gap-px">
              {data.bullCount > 0 && (
                <div style={{ flex: data.bullCount, background: "#34d399" }}>
                  <span className="flex items-center justify-center h-full text-[8px] font-black text-black">
                    {data.bullCount > 1 ? data.bullCount : ""}
                  </span>
                </div>
              )}
              {data.neutralCount > 0 && (
                <div style={{ flex: data.neutralCount, background: "#f5c451" }}>
                  <span className="flex items-center justify-center h-full text-[8px] font-black text-black">
                    {data.neutralCount > 1 ? data.neutralCount : ""}
                  </span>
                </div>
              )}
              {data.bearCount > 0 && (
                <div style={{ flex: data.bearCount, background: "#f87171" }}>
                  <span className="flex items-center justify-center h-full text-[8px] font-black text-black">
                    {data.bearCount > 1 ? data.bearCount : ""}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-between mt-1 text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              <span style={{ color: "#34d399" }}>■ Bullish ({data.bullCount})</span>
              <span style={{ color: "#f5c451" }}>■ Neutral ({data.neutralCount})</span>
              <span style={{ color: "#f87171" }}>■ Bearish ({data.bearCount})</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button
              onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}
            >
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
