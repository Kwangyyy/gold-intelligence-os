"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { OptionsFlowPayload } from "@/app/api/options-flow/route";

function IVGauge({ pct, color }: { pct: number; color: string }) {
  const r = 38, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg viewBox="0 0 100 100" width="80" height="80">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="14" fontWeight="900" fill={color}>{pct}</text>
    </svg>
  );
}

function PutCallBar({ score }: { score: number }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1 text-[8px]">
        <span style={{ color: "#f87171" }}>PUTS</span>
        <div className="flex-1 h-3 rounded-full overflow-hidden relative" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, #f87171, #f5c451, #34d399)`,
          }} />
          <div className="absolute inset-y-0 w-0.5 bg-white/30" style={{ left: "50%" }} />
        </div>
        <span style={{ color: "#34d399" }}>CALLS</span>
      </div>
      <div className="text-center text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
        {score < 35 ? "Put-heavy" : score > 65 ? "Call-heavy" : "Balanced"} ({score}/100)
      </div>
    </div>
  );
}

export default function OptionsFlowPage() {
  const [data, setData]       = useState<OptionsFlowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/options-flow", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ivColor = (pct: number) => pct > 75 ? "#f87171" : pct > 50 ? "#f97316" : pct > 25 ? "#f5c451" : "#34d399";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="📊 Options Flow & IV"
        subtitle="Implied volatility, put/call sentiment, IV vs RV spread — gold options insight"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📊 กำลังวิเคราะห์ Options Flow…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5 flex items-center gap-6">
            <IVGauge pct={data.ivPercentile} color={ivColor(data.ivPercentile)} />
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                IV Percentile (Gold Options)
              </div>
              <div className="text-2xl font-black" style={{ color: ivColor(data.ivPercentile) }}>
                {data.impliedVol}% IV
              </div>
              <div className="text-[10px] mb-2" style={{ color: ivColor(data.ivPercentile) }}>
                {data.ivRankTh} ({data.ivRank})
              </div>
              <div className="flex gap-4 text-[9px]">
                <span>🪙 ${data.goldPrice.toLocaleString()}</span>
                <span style={{ color: "rgba(175,185,215,0.4)" }}>VIX {data.vix}</span>
                <span style={{ color: "rgba(175,185,215,0.4)" }}>RV {data.realizedVol}%</span>
              </div>
            </div>
          </div>

          {/* Composite signal */}
          <div className="panel px-5 py-4" style={{ borderLeft: `3px solid ${data.compositeColor}` }}>
            <div className="text-xs font-black mb-1" style={{ color: data.compositeColor }}>
              {data.compositeSignalTh}
            </div>
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.6)" }}>{data.implicationTh}</p>
          </div>

          {/* Put/Call */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Put/Call Sentiment Proxy
            </div>
            <PutCallBar score={data.putCallScore} />
            <p className="text-[10px] mt-2" style={{ color: "rgba(175,185,215,0.5)" }}>{data.putCallTh}</p>
          </div>

          {/* IV vs RV grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Implied Vol (IV)</div>
              <div className="text-xl font-black" style={{ color: "#c084fc" }}>{data.impliedVol}%</div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>proxy via VIX × beta</div>
            </div>
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Realized Vol (RV 20d)</div>
              <div className="text-xl font-black" style={{ color: "#60a5fa" }}>{data.realizedVol}%</div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>annualized</div>
            </div>
          </div>

          {/* IV-RV spread */}
          <div className="panel px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
                IV − RV Spread (Volatility Risk Premium)
              </span>
              <span className="font-mono font-black text-sm" style={{ color: data.ivRvSpread > 0 ? "#f97316" : "#34d399" }}>
                {data.ivRvSpread > 0 ? "+" : ""}{data.ivRvSpread}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.min(100, Math.abs(data.ivRvSpread) * 5 + 50)}%`,
                background: data.ivRvSpread > 0 ? "#f97316" : "#34d399",
              }} />
            </div>
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.6)" }}>{data.ivRvSignalTh}</p>
            <p className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>{data.ivRvSignal}</p>
          </div>

          {/* Term structure */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>Term Structure</div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{data.termStructure === "contango" ? "📈" : data.termStructure === "backwardation" ? "📉" : "➡️"}</span>
              <div>
                <div className="text-xs font-bold" style={{ color: "#f5c451" }}>{data.termStructureTh}</div>
                <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
                  {data.termStructure === "contango" ? "Normal — near-term options ถูกกว่า far-term" :
                   data.termStructure === "backwardation" ? "Stress — near-term options แพงขึ้นผิดปกติ" :
                   "Flat term structure"}
                </div>
              </div>
            </div>
          </div>

          {/* Educational */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>💡 วิธีอ่าน Options Flow</div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ IV สูง = ตลาดคาดความผันผวนมาก — options แพง (sell premium)</li>
              <li>→ IV ต่ำ = ตลาดสงบ — options ถูก → โอกาสซื้อ call/put ก่อน breakout</li>
              <li>→ IV &gt; RV = Volatility Risk Premium สูง → ขาย straddle/strangle</li>
              <li>→ Put-heavy = นักลงทุนป้องกัน downside มาก → มักเป็น contrarian bullish</li>
              <li>→ Backwardation = stress สูง near-term → ระวัง spike ระยะสั้น</li>
            </ul>
          </div>

          <div className="panel px-5 py-3">
            <p className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              ⚠ Options flow นี้เป็น proxy จาก VIX × gold beta ไม่ใช่ข้อมูล CBOE GVZ จริง ใช้เป็นการประมาณการเท่านั้น
            </p>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
