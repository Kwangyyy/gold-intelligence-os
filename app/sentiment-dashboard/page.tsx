"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { SentimentDashboardPayload, SentimentSignal } from "@/app/api/sentiment-dashboard/route";

function CompositeGauge({ score, color }: { score: number; color: string }) {
  const r = 52, cx = 60, cy = 64;
  const startAngle = -210;
  const totalAngle = 240;
  const angle = startAngle + (score / 100) * totalAngle;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const ax = (a: number) => cx + r * Math.cos(toRad(a));
  const ay = (a: number) => cy + r * Math.sin(toRad(a));
  const largeArc = (score / 100) * totalAngle > 180 ? 1 : 0;
  const bgD = `M ${ax(startAngle)} ${ay(startAngle)} A ${r} ${r} 0 1 1 ${ax(startAngle + totalAngle)} ${ay(startAngle + totalAngle)}`;
  const fillD = score > 0
    ? `M ${ax(startAngle)} ${ay(startAngle)} A ${r} ${r} 0 ${largeArc} 1 ${ax(angle)} ${ay(angle)}`
    : "";

  const zones = [
    { from: 0, to: 20,  color: "#f87171" },
    { from: 20, to: 40, color: "#f97316" },
    { from: 40, to: 60, color: "#9ca3af" },
    { from: 60, to: 80, color: "#86efac" },
    { from: 80, to: 100, color: "#34d399" },
  ];

  return (
    <svg viewBox="0 0 120 90" width="160" height="120">
      <path d={bgD} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" strokeLinecap="round" />
      {zones.map((z, i) => {
        const a1 = startAngle + (z.from / 100) * totalAngle;
        const a2 = startAngle + (z.to / 100) * totalAngle;
        const big = (z.to - z.from) / 100 * totalAngle > 180 ? 1 : 0;
        const zD = `M ${ax(a1)} ${ay(a1)} A ${r} ${r} 0 ${big} 1 ${ax(a2)} ${ay(a2)}`;
        return <path key={i} d={zD} fill="none" stroke={z.color} strokeWidth="10" strokeLinecap="round" opacity={0.15} />;
      })}
      {fillD && <path d={fillD} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="24" fontWeight="900" fill={color}>{score}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="rgba(175,185,215,0.35)">/ 100</text>
      <text x={ax(startAngle)} y={ay(startAngle) + 10} textAnchor="middle" fontSize="6" fill="rgba(175,185,215,0.3)">Bear</text>
      <text x={ax(startAngle + totalAngle)} y={ay(startAngle + totalAngle) + 10} textAnchor="middle" fontSize="6" fill="rgba(175,185,215,0.3)">Bull</text>
    </svg>
  );
}

function ScorePip({ score, color }: { score: number; color: string }) {
  const pct = score;
  return (
    <div className="h-1 rounded-full overflow-hidden flex-1" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function SignalRow({ s }: { s: SentimentSignal }) {
  return (
    <div className="panel px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-base shrink-0 w-5 text-center">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.85)" }}>
              {s.nameTh}
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
              style={{ background: s.signalColor + "22", color: s.signalColor }}>
              {s.signalTh}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ScorePip score={s.score} color={s.signalColor} />
            <span className="text-[8px] shrink-0" style={{ color: "rgba(175,185,215,0.35)" }}>
              {s.score}/100
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.7)" }}>
            {s.value}
          </div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            weight {s.weight}%
          </div>
        </div>
      </div>
      <div className="mt-1.5 text-[9px] pl-8" style={{ color: s.signalColor + "bb" }}>
        → {s.description}
      </div>
    </div>
  );
}

export default function SentimentDashboardPage() {
  const [data, setData]       = useState<SentimentDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/sentiment-dashboard", { cache: "no-store" });
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
        title="🧭 Gold Sentiment Dashboard"
        subtitle="รวม sentiment signals ทั้งหมดเป็น composite score เดียว — ภาพรวม bias ต่อทองทันที"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🧭 กำลังประมวลผล signals…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero: Composite gauge */}
          <div className="panel px-5 py-5">
            <div className="flex items-center gap-5">
              <CompositeGauge score={data.compositeScore} color={data.goldBiasColor} />
              <div className="flex-1">
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Composite Gold Sentiment
                </div>
                <div className="text-2xl font-black mb-1" style={{ color: data.goldBiasColor }}>
                  {data.goldBiasTh}
                </div>
                <div className="text-xs mb-3" style={{ color: "rgba(175,185,215,0.45)" }}>
                  ทอง ${data.goldPrice.toLocaleString()} &nbsp;
                  <span style={{ color: data.goldChange >= 0 ? "#34d399" : "#f87171" }}>
                    {data.goldChange >= 0 ? "▲" : "▼"} {Math.abs(data.goldChange).toFixed(2)}%
                  </span>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span style={{ color: "#34d399" }}>{data.bullishSignals} Bullish</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                    <span style={{ color: "#9ca3af" }}>{data.neutralSignals} Neutral</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                    <span style={{ color: "#f87171" }}>{data.bearishSignals} Bearish</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Signal breakdown */}
          <div>
            <div className="text-[9px] uppercase tracking-widest px-1 mb-2"
              style={{ color: "rgba(175,185,215,0.3)" }}>
              Signal Breakdown ({data.signals.length} indicators)
            </div>
            <div className="space-y-2">
              {[...data.signals].sort((a, b) => b.weight - a.weight).map(s => (
                <SignalRow key={s.id} s={s} />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="panel px-5 py-3">
            <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              Score Guide
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "0-25", text: "Bearish มาก", color: "#f87171" },
                { label: "26-42", text: "Bearish", color: "#f97316" },
                { label: "43-57", text: "Neutral", color: "#9ca3af" },
                { label: "58-74", text: "Bullish", color: "#86efac" },
                { label: "75-100", text: "Bullish มาก", color: "#34d399" },
              ].map(z => (
                <div key={z.label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: z.color }} />
                  <span className="text-[8px]" style={{ color: z.color }}>{z.label}</span>
                  <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{z.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ Sentiment score เป็นการสังเคราะห์ข้อมูล — ไม่ใช่คำแนะนำการลงทุน | {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
