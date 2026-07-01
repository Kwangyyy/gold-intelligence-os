"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MarketRegimePayload, RegimeType } from "@/app/api/market-regime/route";

const REGIME_COLORS: Record<RegimeType, string> = {
  TRENDING_UP:    "#34d399",
  TRENDING_DOWN:  "#f87171",
  RANGING:        "#f5c451",
  HIGH_VOLATILITY:"#f97316",
  LOW_VOLATILITY: "#94a3b8",
};

const REGIME_ICONS: Record<RegimeType, string> = {
  TRENDING_UP:    "📈",
  TRENDING_DOWN:  "📉",
  RANGING:        "↔️",
  HIGH_VOLATILITY:"⚡",
  LOW_VOLATILITY: "😴",
};

function GaugeMeter({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const r = 36; const cx = 50; const cy = 50;
  const circumference = Math.PI * r;
  const dashOffset = circumference * (1 - pct / 100);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 60" className="w-28">
        {/* Track */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} strokeLinecap="round" />
        {/* Value */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x={cx} y={cy - 5} textAnchor="middle" fill={color} className="text-[14px] font-black" fontSize={14} fontWeight="800">
          {value.toFixed(1)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="rgba(175,185,215,0.4)" fontSize={8}>
          / {max}
        </text>
      </svg>
      <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "rgba(175,185,215,0.4)" }}>{label}</div>
    </div>
  );
}

function EmaBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const positive = pct >= 0;
  const w = Math.min(50, Math.abs(pct) * 10);
  return (
    <div className="flex items-center gap-2">
      <div className="text-[10px] w-14 text-right shrink-0" style={{ color: "rgba(175,185,215,0.4)" }}>{label}</div>
      <div className="flex flex-1 items-center">
        <div className="flex-1 relative h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="absolute top-0 bottom-0 rounded-full" style={{
            width: `${w}%`,
            left:  positive ? "50%" : `${50 - w}%`,
            background: color,
          }} />
          <div className="absolute top-0 bottom-0 left-1/2 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />
        </div>
        <span className="ml-2 text-[10px] font-mono w-14" style={{ color }}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function RegimeHistoryChart({ history }: { history: MarketRegimePayload["regimeHistory"] }) {
  if (!history.length) return null;
  const W = 100 / history.length;
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
        Regime History (60 bars)
      </div>
      <div className="flex h-10 gap-[1px] rounded-lg overflow-hidden">
        {history.map((bar, i) => {
          const col = REGIME_COLORS[bar.regime];
          return (
            <div key={i} title={`${bar.date} · ${bar.regime} · ADX ${bar.adx}`}
              className="flex-1 transition-opacity hover:opacity-80"
              style={{ background: col, opacity: 0.7 }} />
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {(Object.entries(REGIME_COLORS) as [RegimeType, string][]).map(([k, c]) => {
          const count = history.filter(b => b.regime === k).length;
          if (!count) return null;
          return (
            <div key={k} className="flex items-center gap-1.5 text-[9px]">
              <div className="h-2 w-2 rounded-sm" style={{ background: c }} />
              <span style={{ color: "rgba(175,185,215,0.5)" }}>{k.replace("_", " ")} ({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MarketRegimePage() {
  const [data, setData] = useState<MarketRegimePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/market-regime", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const color = data ? REGIME_COLORS[data.regime] : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🎯 Market Regime"
        subtitle="วิเคราะห์ Regime ตลาดทองคำ · ADX + ATR% + EMA Structure · อัปเดตทุก 15 นาที"
      />

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm animate-pulse" style={{ color: "rgba(175,185,215,0.3)" }}>⏳ กำลังวิเคราะห์ Regime…</div>
        </div>
      )}

      {err && (
        <div className="panel px-5 py-4 text-sm" style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}>
          {err}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-5">
          {/* Big Regime Badge */}
          <div className="panel px-6 py-6 text-center" style={{ border: `1px solid ${color}30`, background: `${color}06` }}>
            <div className="text-5xl mb-3">{REGIME_ICONS[data.regime]}</div>
            <div className="text-2xl font-black mb-1" style={{ color }}>{data.regimeTh}</div>
            <div className="text-sm mb-3" style={{ color: "rgba(175,185,215,0.5)" }}>{data.regimeEn}</div>

            {/* Confidence */}
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="h-1.5 w-48 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${data.confidence}%`, background: color }} />
              </div>
              <span className="text-xs font-mono font-bold" style={{ color }}>{data.confidence}% confidence</span>
            </div>

            <p className="text-xs max-w-md mx-auto" style={{ color: "rgba(175,185,215,0.55)" }}>
              {data.description}
            </p>

            <div className="mt-3 text-[9px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ${data.price.toFixed(2)} · ADX {data.adx} · ATR% {data.atrPct}% · RSI {data.rsi}
            </div>
          </div>

          {/* Meters row */}
          <div className="panel px-5 py-5">
            <div className="text-[9px] uppercase tracking-widest mb-4" style={{ color: "rgba(175,185,215,0.3)" }}>ตัวชี้วัด Regime</div>
            <div className="flex justify-around gap-2 flex-wrap">
              <GaugeMeter value={data.adx}    max={50}  label="ADX"    color={data.adx > 25 ? "#34d399" : data.adx < 18 ? "#f87171" : "#f5c451"} />
              <GaugeMeter value={data.atrPct} max={2.0} label="ATR%"   color={data.atrPct > 1 ? "#f97316" : data.atrPct < 0.3 ? "#94a3b8" : "#f5c451"} />
              <GaugeMeter value={data.rsi}    max={100} label="RSI(14)" color={data.rsi > 65 ? "#f87171" : data.rsi < 35 ? "#34d399" : "#60a5fa"} />
            </div>

            {/* ADX legend */}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[9px]" style={{ color: "rgba(175,185,215,0.35)" }}>
              <span>ADX &lt;18 = Ranging</span>
              <span>ADX 18-25 = Weak Trend</span>
              <span>ADX &gt;25 = Trending</span>
              <span>ATR% &gt;1% = High Volatility</span>
            </div>
          </div>

          {/* EMA Structure */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>EMA Structure (Price vs EMA)</div>
            <div className="space-y-2.5">
              <EmaBar label="vs EMA20"  pct={data.priceVsEma20}  color={data.priceVsEma20  >= 0 ? "#34d399" : "#f87171"} />
              <EmaBar label="vs EMA50"  pct={data.priceVsEma50}  color={data.priceVsEma50  >= 0 ? "#34d399" : "#f87171"} />
              <EmaBar label="vs EMA200" pct={data.priceVsEma200} color={data.priceVsEma200 >= 0 ? "#34d399" : "#f87171"} />
              <EmaBar label="EMA20/50"  pct={data.ema20VsEma50}  color={data.ema20VsEma50  >= 0 ? "#60a5fa" : "#c084fc"} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["EMA20", data.ema20], ["EMA50", data.ema50], ["EMA200", data.ema200]].map(([label, val]) => (
                <div key={label as string} className="rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>{label}</div>
                  <div className="font-mono text-xs font-bold" style={{ color: "rgba(175,185,215,0.7)" }}>${(val as number).toFixed(0)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Regime history */}
          {data.regimeHistory.length > 0 && (
            <div className="panel px-5 py-4">
              <RegimeHistoryChart history={data.regimeHistory} />
            </div>
          )}

          {/* Strategy tips */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Do */}
            <div className="panel px-5 py-4" style={{ border: `1px solid ${color}20` }}>
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color }}>
                ✅ กลยุทธ์ใน {data.regimeTh}
              </div>
              <ul className="space-y-2.5">
                {data.strategyTips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "rgba(175,185,215,0.75)" }}>
                    <span style={{ color }} className="shrink-0">→</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Don't */}
            <div className="panel px-5 py-4" style={{ border: "1px solid rgba(248,113,113,0.2)" }}>
              <div className="text-[9px] uppercase tracking-widest mb-3 text-red-400/70">
                ⛔ สิ่งที่ควรหลีกเลี่ยง
              </div>
              <ul className="space-y-2.5">
                {data.avoidTips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "rgba(175,185,215,0.65)" }}>
                    <span className="text-red-400/50 shrink-0">✗</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Refresh + links */}
          <div className="flex items-center justify-between">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })} ·
              <a href="/technical" className="ml-1 underline opacity-60">Technical Score</a> ·
              <a href="/trade-ideas" className="ml-1 underline opacity-60">Trade Ideas</a>
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
