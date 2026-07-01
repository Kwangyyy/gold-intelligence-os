"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { PatternsPayload, PatternCandle, CandlePattern, PatternSignal } from "@/app/api/patterns/route";

const SIG_COLOR: Record<PatternSignal, string> = { bullish: "#34d399", bearish: "#f87171", neutral: "#f5c451" };
const SIG_TH: Record<PatternSignal, string>    = { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" };
const STRENGTH_COLOR = { strong: "#34d399", moderate: "#f5c451", weak: "#94a3b8" };

function MiniChart({ candles }: { candles: PatternCandle[] }) {
  if (!candles.length) return null;
  const W = 100 / candles.length;
  const prices = candles.flatMap(c => [c.h, c.l]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const span = maxP - minP || 1;

  function pct(v: number) { return ((v - minP) / span) * 100; }

  return (
    <div className="relative h-24 w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        {candles.map((c, i) => {
          const x = i * W + W * 0.5;
          const bodyTop    = Math.max(pct(c.o), pct(c.c));
          const bodyBot    = Math.min(pct(c.o), pct(c.c));
          const bodyH      = Math.max(0.5, bodyTop - bodyBot);
          const color = c.bullish ? "#34d399" : "#f87171";
          return (
            <g key={i}>
              {/* Wick */}
              <line x1={x} y1={100 - pct(c.h)} x2={x} y2={100 - pct(c.l)} stroke={color} strokeWidth={0.4} />
              {/* Body */}
              <rect
                x={i * W + W * 0.15} y={100 - bodyTop}
                width={W * 0.7} height={bodyH}
                fill={color} fillOpacity={0.85}
              />
            </g>
          );
        })}
      </svg>
      {/* Price label */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[8px] font-mono"
        style={{ color: "rgba(175,185,215,0.3)" }}>
        <span>${minP.toFixed(0)}</span>
        <span>${maxP.toFixed(0)}</span>
      </div>
    </div>
  );
}

function PatternCard({ pattern }: { pattern: CandlePattern }) {
  const sigColor = SIG_COLOR[pattern.signal];
  const strColor = STRENGTH_COLOR[pattern.strength];
  return (
    <div className="rounded-2xl px-5 py-4"
      style={{ background: `${sigColor}06`, border: `1px solid ${sigColor}25` }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-sm font-black mb-0.5" style={{ color: sigColor }}>{pattern.name}</div>
          <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.45)" }}>{pattern.nameTh}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase"
            style={{ background: `${sigColor}18`, border: `1px solid ${sigColor}35`, color: sigColor }}>
            {SIG_TH[pattern.signal]}
          </span>
          <span className="text-[9px] font-bold" style={{ color: strColor }}>{pattern.strength}</span>
        </div>
      </div>

      <p className="text-xs mb-2" style={{ color: "rgba(175,185,215,0.65)" }}>{pattern.descriptionTh}</p>

      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${pattern.reliability}%`, background: sigColor }} />
        </div>
        <span className="text-[9px] font-mono shrink-0" style={{ color: sigColor }}>{pattern.reliability}% reliable</span>
      </div>

      <div className="mt-2 flex gap-1.5">
        <span className="text-[9px] rounded px-1.5 py-0.5"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(175,185,215,0.35)" }}>
          {pattern.type}
        </span>
        <span className="text-[9px] rounded px-1.5 py-0.5"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(175,185,215,0.35)" }}>
          ${pattern.price.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default function PatternsPage() {
  const [data, setData]       = useState<PatternsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/patterns", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sigColor = data ? SIG_COLOR[data.overallSignal] : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🕯 Price Action Patterns"
        subtitle="ตรวจจับ Candlestick Patterns บน XAUUSD D1 แบบ Real-time · อัปเดตทุก 10 นาที"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>⏳ กำลังสแกน patterns…</div>
        </div>
      )}
      {err && (
        <div className="panel px-5 py-4 text-sm mb-4" style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}>{err}</div>
      )}

      {data && !loading && (
        <div className="space-y-5">
          {/* Summary banner */}
          <div className="panel px-5 py-4 flex flex-wrap items-center gap-4"
            style={{ border: `1px solid ${sigColor}25`, background: `${sigColor}05` }}>
            <div>
              <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>Overall Pattern Signal</div>
              <div className="text-xl font-black" style={{ color: sigColor }}>{SIG_TH[data.overallSignal]}</div>
            </div>
            <div className="flex gap-4 text-center">
              <div>
                <div className="text-lg font-black text-emerald-400">{data.bullCount}</div>
                <div className="text-[9px] text-silver/30">Bullish</div>
              </div>
              <div>
                <div className="text-lg font-black text-red-400">{data.bearCount}</div>
                <div className="text-[9px] text-silver/30">Bearish</div>
              </div>
              <div>
                <div className="text-lg font-black" style={{ color: "#f5c451" }}>{data.patterns.filter(p => p.signal === "neutral").length}</div>
                <div className="text-[9px] text-silver/30">Neutral</div>
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-mono text-sm font-bold" style={{ color: "#f5c451" }}>${data.price.toFixed(2)}</div>
              <div className="text-[9px] text-silver/30">XAUUSD D1</div>
            </div>
          </div>

          {/* Mini candlestick chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Last 12 D1 Candles
            </div>
            <MiniChart candles={data.candles} />
            <div className="mt-2 flex items-center gap-3 text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-emerald-400" /> Bullish</div>
              <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-red-400" /> Bearish</div>
              <span className="ml-auto">{data.candles.at(-1)?.date ?? ""}</span>
            </div>
          </div>

          {/* Pattern cards */}
          {data.patterns.length === 0 ? (
            <div className="panel flex flex-col items-center gap-3 py-12 text-center">
              <div className="text-4xl opacity-30">🕯</div>
              <div className="text-sm" style={{ color: "rgba(175,185,215,0.5)" }}>
                ไม่พบ Pattern ที่ชัดเจนในแท่งเทียนล่าสุด
              </div>
              <div className="text-xs" style={{ color: "rgba(175,185,215,0.3)" }}>
                ตลาดอาจกำลัง Consolidate หรืออยู่ใน Trend ที่ต่อเนื่อง
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                Detected Patterns ({data.patterns.length})
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.patterns
                  .sort((a, b) => b.reliability - a.reliability)
                  .map((p, i) => <PatternCard key={i} pattern={p} />)}
              </div>
            </div>
          )}

          {/* Pattern guide */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Pattern Reference Guide
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 text-[10px]" style={{ color: "rgba(175,185,215,0.5)" }}>
              {[
                ["Doji", "สัญญาณ Indecision — รอการยืนยัน"],
                ["Hammer", "Bullish Reversal — ไส้ล่างยาว"],
                ["Shooting Star", "Bearish Reversal — ไส้บนยาว"],
                ["Engulfing", "Reversal แข็งแกร่ง 2 แท่ง"],
                ["Inside Bar", "Consolidation — รอ Breakout"],
                ["Pin Bar", "Rejection ราคา — แนวรับ/ต้าน"],
                ["Morning Star", "Bullish Reversal 3 แท่ง"],
                ["Evening Star", "Bearish Reversal 3 แท่ง"],
                ["Marubozu", "แรง Momentum — ไม่มีไส้เทียน"],
              ].map(([name, desc]) => (
                <div key={name} className="flex gap-2 py-1 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <span className="font-semibold min-w-[90px]">{name}</span>
                  <span className="opacity-70">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Refresh */}
          <div className="flex items-center justify-between">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour:"2-digit", minute:"2-digit" })} ·
              <a href="/levels" className="ml-1 underline opacity-60">S/R Levels</a> ·
              <a href="/smc" className="ml-1 underline opacity-60">SMC</a>
            </p>
            <button onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold transition-all"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
