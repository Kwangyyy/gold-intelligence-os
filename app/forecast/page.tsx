"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { WeeklyForecast } from "@/lib/gemini";

interface ApiResp { forecast: WeeklyForecast; cached: boolean; error?: string }

const BIAS_COLOR = { bullish: "#34d399", bearish: "#f87171", neutral: "#f5c451" } as const;
const BIAS_TH    = { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" } as const;
const BIAS_ICON  = { bullish: "📈", bearish: "📉", neutral: "↔️" } as const;

function ScoreMeter({ score, color }: { score: number; color: string }) {
  const r = 48; const cx = 60; const cy = 60;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  const offset = circ * (1 - pct);
  return (
    <svg viewBox="0 0 120 70" className="w-36">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10}
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={circ * 0.375} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${circ * 0.75 * pct} ${circ * (1 - 0.75 * pct)}`}
        strokeDashoffset={circ * 0.375} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize={20} fontWeight="800">{score}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="rgba(175,185,215,0.35)" fontSize={9}>/ 100</text>
    </svg>
  );
}

function PriceRangeBar({ low, mid, high, current, color }: { low: number; mid: number; high: number; current: number; color: string }) {
  const span = high - low;
  if (span <= 0) return null;
  const pct = (v: number) => `${((v - low) / span) * 100}%`;
  return (
    <div className="mt-3">
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        {/* Low-mid gradient */}
        <div className="absolute inset-y-0 rounded-full" style={{
          left: 0, width: pct(mid), background: `linear-gradient(90deg, rgba(248,113,113,0.4), ${color}60)`,
        }} />
        {/* Mid-high gradient */}
        <div className="absolute inset-y-0 rounded-full" style={{
          left: pct(mid), width: `${((high - mid) / span) * 100}%`, background: `linear-gradient(90deg, ${color}60, rgba(52,211,153,0.4))`,
        }} />
        {/* Current price */}
        <div className="absolute inset-y-0 w-0.5 bg-white/80 rounded-full" style={{ left: pct(current) }} />
        {/* Mid */}
        <div className="absolute inset-y-0 w-px" style={{ left: pct(mid), background: `${color}80` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] font-mono" style={{ color: "rgba(175,185,215,0.4)" }}>
        <span>${low.toFixed(0)}</span>
        <span style={{ color }}>mid ${mid.toFixed(0)}</span>
        <span>${high.toFixed(0)}</span>
      </div>
    </div>
  );
}

function EventRow({ day, event, impact }: { day: string; event: string; impact: "high" | "medium" }) {
  const col = impact === "high" ? "#f87171" : "#f5c451";
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="w-7 shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-bold uppercase"
        style={{ background: `${col}15`, color: col }}>{day}</div>
      <span className="flex-1 text-xs" style={{ color: "rgba(175,185,215,0.7)" }}>{event}</span>
      <span className="text-[9px] rounded-full px-2 py-0.5 shrink-0"
        style={{ background: `${col}12`, color: col, border: `1px solid ${col}30` }}>{impact}</span>
    </div>
  );
}

export default function ForecastPage() {
  const [data, setData]     = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");

  const load = useCallback(async (bust = false) => {
    setLoading(true); setErr("");
    try {
      const res = await fetch(bust ? "/api/forecast?bust=1" : "/api/forecast", { cache: "no-store" });
      const json: ApiResp = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const f = data?.forecast;
  const color = f ? BIAS_COLOR[f.bias] : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🔮 Gold Weekly Forecast"
        subtitle="AI สังเคราะห์ภาพรวมสัปดาห์จาก Regime + Technical + AI Model + News · อัปเดตทุกชั่วโมง"
      />

      {/* Top actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          {data?.cached ? "🗃 cached" : "✨ fresh"} ·
          {f && ` ${new Date(f.generatedAt).toLocaleString("th-TH", { hour:"2-digit", minute:"2-digit" })}`}
        </div>
        <button onClick={() => load(true)} disabled={loading}
          className="rounded-xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-40"
          style={{ background: "rgba(245,196,81,0.12)", border: "1px solid rgba(245,196,81,0.3)", color: "#f5c451" }}>
          {loading ? "⏳ กำลังสร้าง…" : "🔄 สร้าง Forecast ใหม่"}
        </button>
      </div>

      {err && (
        <div className="panel mb-4 px-5 py-4 text-sm" style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}>
          {err}
        </div>
      )}

      {loading && !f && (
        <div className="flex h-64 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>⏳ AI กำลังวิเคราะห์…</div>
        </div>
      )}

      {f && (
        <div className="space-y-5">
          {/* Hero: bias + score */}
          <div className="panel px-6 py-6" style={{ border: `1px solid ${color}28`, background: `${color}06` }}>
            <div className="flex flex-wrap items-start gap-6">
              <ScoreMeter score={f.biasScore} color={color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{BIAS_ICON[f.bias]}</span>
                  <span className="text-2xl font-black" style={{ color }}>{BIAS_TH[f.bias]}</span>
                </div>
                <div className="text-sm font-semibold mb-2" style={{ color: "rgba(175,185,215,0.85)" }}>{f.headline}</div>
                <div className="text-xs mb-3" style={{ color: "rgba(175,185,215,0.55)" }}>{f.headlineTh}</div>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>{f.summaryTh}</p>
              </div>
            </div>
          </div>

          {/* Price range */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
              Weekly Price Range Forecast
            </div>
            <PriceRangeBar low={f.priceRangeLow} mid={f.priceRangeMid} high={f.priceRangeHigh} current={f.priceRangeMid} color={color} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[["Bear Case", f.priceRangeLow, "#f87171"], ["Mid Target", f.priceRangeMid, color], ["Bull Case", f.priceRangeHigh, "#34d399"]].map(([label, price, c]) => (
                <div key={label as string} className="rounded-xl text-center px-3 py-2.5"
                  style={{ background: `${c as string}08`, border: `1px solid ${c as string}25` }}>
                  <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: `${c as string}80` }}>{label}</div>
                  <div className="font-mono text-sm font-black" style={{ color: c as string }}>${(price as number).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Key levels */}
          {f.keyLevels.length > 0 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>Key Price Levels</div>
              <div className="space-y-2">
                {f.keyLevels.map((lv, i) => {
                  const c = lv.type === "resistance" ? "#f87171" : "#34d399";
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c }} />
                      <span className="flex-1 text-xs" style={{ color: "rgba(175,185,215,0.65)" }}>{lv.labelTh}</span>
                      <span className="font-mono text-sm font-bold" style={{ color: c }}>${lv.price.toFixed(2)}</span>
                      <span className="text-[9px] rounded-full px-2 py-0.5 uppercase"
                        style={{ background: `${c}12`, color: `${c}`, border: `1px solid ${c}30` }}>{lv.type}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bull/Bear scenarios */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel px-5 py-4" style={{ border: "1px solid rgba(52,211,153,0.2)" }}>
              <div className="text-[9px] uppercase tracking-widest mb-3 text-emerald-400/70">📈 Bull Scenario</div>
              <ul className="space-y-2">
                {f.bullScenarioTh.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "rgba(175,185,215,0.7)" }}>
                    <span className="text-emerald-400/60 shrink-0">✓</span><span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel px-5 py-4" style={{ border: "1px solid rgba(248,113,113,0.2)" }}>
              <div className="text-[9px] uppercase tracking-widest mb-3 text-red-400/70">📉 Bear Scenario</div>
              <ul className="space-y-2">
                {f.bearScenarioTh.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "rgba(175,185,215,0.7)" }}>
                    <span className="text-red-400/60 shrink-0">✗</span><span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Events + Risks */}
          <div className="grid gap-4 sm:grid-cols-2">
            {f.keyEvents.length > 0 && (
              <div className="panel px-5 py-4">
                <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>📅 Key Events This Week</div>
                <div>
                  {f.keyEvents.map((e, i) => (
                    <EventRow key={i} day={e.day} event={e.event} impact={e.impact} />
                  ))}
                </div>
              </div>
            )}
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>⚠ Risk Factors</div>
              <ul className="space-y-2">
                {f.riskFactorsTh.map((r, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "rgba(175,185,215,0.6)" }}>
                    <span className="text-amber-400/50 shrink-0">!</span><span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* EN summary expandable */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              Weekly Summary (EN)
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{f.summary}</p>
          </div>

          {/* Links */}
          <p className="text-[10px] text-center" style={{ color: "rgba(175,185,215,0.25)" }}>
            ⚠️ Forecast เพื่อประกอบการตัดสินใจเท่านั้น ไม่ใช่การรับประกันผลกำไร ·
            <a href="/market-regime" className="ml-1 underline opacity-60">Market Regime</a> ·
            <a href="/trade-ideas" className="ml-1 underline opacity-60">Trade Ideas</a> ·
            <a href="/technical" className="ml-1 underline opacity-60">Technical</a>
          </p>
        </div>
      )}
    </div>
  );
}
