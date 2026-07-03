"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { SilverRatioPayload } from "@/app/api/silver-ratio/route";

function RatioGauge({ ratio, min = 14, max = 123, avg = 70, color }: {
  ratio: number; min?: number; max?: number; avg?: number; color: string;
}) {
  const pct    = Math.min(100, Math.max(0, (ratio - min) / (max - min) * 100));
  const avgPct = Math.min(100, Math.max(0, (avg - min)   / (max - min) * 100));
  return (
    <div className="mt-3">
      <div className="relative h-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        {/* Color zones */}
        <div className="absolute inset-y-0 left-0 w-[15%]" style={{ background: "rgba(248,113,113,0.3)" }} />
        <div className="absolute inset-y-0 left-[15%] w-[20%]" style={{ background: "rgba(249,115,22,0.2)" }} />
        <div className="absolute inset-y-0 left-[35%] w-[30%]" style={{ background: "rgba(245,196,81,0.2)" }} />
        <div className="absolute inset-y-0 left-[65%] w-[20%]" style={{ background: "rgba(134,239,172,0.2)" }} />
        <div className="absolute inset-y-0 left-[85%] right-0" style={{ background: "rgba(52,211,153,0.3)" }} />
        {/* Average marker */}
        <div className="absolute inset-y-0 w-0.5 bg-white/20" style={{ left: `${avgPct}%` }} />
        {/* Current marker */}
        <div className="absolute inset-y-0 w-1 rounded-sm" style={{ left: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between text-[8px] mt-1" style={{ color: "rgba(175,185,215,0.3)" }}>
        <span>Silver Peak ({min})</span>
        <span>Avg ({avg})</span>
        <span>COVID High ({max})</span>
      </div>
    </div>
  );
}

function RatioChart({ bars }: { bars: SilverRatioPayload["bars"] }) {
  if (bars.length < 2) return null;
  const ratios = bars.map(b => b.ratio);
  const min    = Math.min(...ratios) * 0.98;
  const max    = Math.max(...ratios) * 1.02;
  const range  = max - min || 1;
  const W = 600, H = 100;
  const pts = bars.map((b, i) => {
    const x = (i / (bars.length - 1)) * W;
    const y = H - ((b.ratio - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const avgY = H - ((70 - min) / range) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="80" preserveAspectRatio="none">
      {/* Avg line */}
      <line x1="0" y1={avgY} x2={W} y2={avgY} stroke="rgba(245,196,81,0.3)" strokeDasharray="4,4" strokeWidth="1" />
      {/* Ratio line */}
      <polyline points={pts} fill="none" stroke="#c084fc" strokeWidth="2" strokeLinejoin="round" />
      {/* Last dot */}
      <circle cx={W} cy={H - ((ratios.at(-1)! - min) / range) * H} r="3" fill="#c084fc" />
    </svg>
  );
}

export default function SilverRatioPage() {
  const [data, setData]       = useState<SilverRatioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/silver-ratio", { cache: "no-store" });
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
        title="⚖️ Gold/Silver Ratio"
        subtitle="อัตราส่วนทอง/เงิน — ตัวชี้วัด relative value และสัญญาณ precious metals ที่นักลงทุนสถาบันติดตาม"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            ⚖️ กำลังโหลดข้อมูล Ratio…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5" style={{ borderLeft: `4px solid ${data.zoneColor}` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Gold/Silver Ratio
                </div>
                <div className="text-4xl font-black" style={{ color: data.zoneColor }}>
                  {data.currentRatio}
                </div>
                <div className="text-xs mt-1" style={{ color: data.zoneTh.includes("ถูก") ? "#34d399" : data.zoneTh.includes("แพง") ? "#f87171" : "#f5c451" }}>
                  {data.zoneTh}
                </div>
                <div className="flex gap-3 mt-2 text-[9px]">
                  <span style={{ color: data.change1w >= 0 ? "#f87171" : "#34d399" }}>
                    {data.change1w >= 0 ? "+" : ""}{data.change1w} 1W
                  </span>
                  <span style={{ color: data.change1m >= 0 ? "#f87171" : "#34d399" }}>
                    {data.change1m >= 0 ? "+" : ""}{data.change1m} 1M
                  </span>
                  <span style={{ color: data.change3m >= 0 ? "#f87171" : "#34d399" }}>
                    {data.change3m >= 0 ? "+" : ""}{data.change3m} 3M
                  </span>
                </div>
              </div>
              <div className="text-right text-[9px]">
                <div style={{ color: "rgba(175,185,215,0.4)" }}>Gold</div>
                <div className="font-mono font-bold text-sm" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
                <div className="mt-1" style={{ color: "rgba(175,185,215,0.4)" }}>Silver</div>
                <div className="font-mono font-bold text-sm" style={{ color: "#c084fc" }}>${data.silverPrice}</div>
                <div className="mt-1 text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                  vs avg: {data.currentVsAvg > 0 ? "+" : ""}{data.currentVsAvg}%
                </div>
              </div>
            </div>
            <RatioGauge ratio={data.currentRatio} color={data.zoneColor} />
          </div>

          {/* Signal */}
          <div className="panel px-5 py-4" style={{ borderLeft: `3px solid ${data.signalColor}` }}>
            <div className="text-xs font-black mb-1" style={{ color: data.signalColor }}>
              {data.signalTh}
            </div>
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.7)" }}>{data.implicationTh}</p>
            <p className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>{data.implication}</p>
          </div>

          {/* Chart */}
          {data.bars.length > 4 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
                Gold/Silver Ratio — 52 สัปดาห์ (เส้นเหลือง = ค่าเฉลี่ย 70)
              </div>
              <RatioChart bars={data.bars} />
              <div className="flex justify-between text-[8px] mt-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                <span>{data.bars[0]?.date}</span>
                <span className="font-mono font-bold" style={{ color: "#c084fc" }}>
                  ปัจจุบัน: {data.currentRatio}
                </span>
                <span>{data.bars.at(-1)?.date}</span>
              </div>
            </div>
          )}

          {/* Historical comparison */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              เปรียบเทียบ Ratio ในอดีต
            </div>
            <div className="space-y-2">
              {[
                { label: "3 เดือนก่อน", val: data.ratioAt3M },
                { label: "6 เดือนก่อน", val: data.ratioAt6M },
                { label: "1 ปีก่อน",    val: data.ratioAt1Y },
                { label: "ค่าเฉลี่ย 20 ปี", val: data.longTermAvg },
                { label: "High สุด (COVID)",  val: data.historicalHigh },
                { label: "Low สุด (2011)",    val: data.historicalLow },
              ].map(({ label, val }) => {
                if (!val) return null;
                const diff = +(data.currentRatio - val).toFixed(2);
                return (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.5)" }}>{label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs" style={{ color: "rgba(175,185,215,0.7)" }}>{val}</span>
                      <span className="font-mono text-[9px] w-16 text-right"
                        style={{ color: diff > 0 ? "#f87171" : "#34d399" }}>
                        {diff > 0 ? "+" : ""}{diff}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Education */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 Gold/Silver Ratio ใช้อย่างไร
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ Ratio &gt; 80 = Silver ถูกมากเทียบทอง → สถาบันบางส่วนสลับจากทองมา Silver</li>
              <li>→ Ratio &lt; 50 = Silver แพงเกิน → อาจถึงเวลา take profit silver, หันมาทอง</li>
              <li>→ Ratio ค่าเฉลี่ยระยะยาวอยู่ที่ ~70 (post-1970s) | ยุคทองโบราณ 15:1</li>
              <li>→ ในช่วง Risk-off: ทองมักแข็งค่ากว่า → Ratio สูงขึ้น</li>
              <li>→ Ratio ใช้ &quot;trade the spread&quot; ไม่ใช่ signal เดี่ยว ต้องดู macro ด้วย</li>
            </ul>
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
