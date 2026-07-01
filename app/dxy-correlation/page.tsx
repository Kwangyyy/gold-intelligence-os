"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { DXYCorrPayload, DailyPair } from "@/app/api/dxy-correlation/route";

function CorrGauge({ corr }: { corr: number }) {
  const pct = (corr + 1) / 2 * 100;
  const color = corr < -0.5 ? "#f87171" : corr < -0.2 ? "#f5c451" : corr < 0.2 ? "rgba(175,185,215,0.4)" : "#34d399";
  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[8px]" style={{ color: "#f87171" }}>-1</span>
        <div className="flex-1 h-3 rounded-full overflow-hidden relative" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="absolute inset-y-0" style={{ left: 0, width: `${pct}%`, background: `linear-gradient(90deg, #f87171, #f5c451, #34d399)` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/60" style={{ left: `${pct}%`, transform: "translateX(-50%)" }} />
        </div>
        <span className="text-[8px]" style={{ color: "#34d399" }}>+1</span>
      </div>
      <div className="text-center text-2xl font-black mt-1" style={{ color }}>
        {corr.toFixed(2)}
      </div>
    </div>
  );
}

function DualLineChart({ history }: { history: DailyPair[] }) {
  if (history.length < 5) return null;
  const W = 560, H = 100;
  const goldVals = history.map(b => b.goldReturn);
  const dxyVals  = history.map(b => b.dxyReturn);
  const allVals  = [...goldVals, ...dxyVals];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;

  function toPath(vals: number[]): string {
    return vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = H - ((v - minV) / range) * H;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }

  const zeroY = H - ((0 - minV) / range) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
      <path d={toPath(goldVals)} fill="none" stroke="#f5c451" strokeWidth="1.5" />
      <path d={toPath(dxyVals)}  fill="none" stroke="#60a5fa" strokeWidth="1.5" />
    </svg>
  );
}

export default function DXYCorrelationPage() {
  const [data, setData]       = useState<DXYCorrPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/dxy-correlation", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const corrColor = (c: number) => c < -0.5 ? "#f87171" : c < -0.2 ? "#f5c451" : "rgba(175,185,215,0.4)";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="💱 DXY Correlation"
        subtitle="Gold vs US Dollar Index — rolling correlation & divergence signals"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>💱 กำลังโหลด DXY data…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Current prices */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Gold (XAUUSD)", price: `$${data.goldPrice.toFixed(0)}`, change: data.goldChange1d, color: "#f5c451" },
              { label: "USD Index (DXY)", price: data.dxyPrice.toFixed(2), change: data.dxyChange1d, color: "#60a5fa" },
            ].map(({ label, price, change, color }) => (
              <div key={label} className="panel px-4 py-4">
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>{label}</div>
                <div className="text-xl font-black" style={{ color }}>{price}</div>
                <div className="text-[10px] font-bold" style={{ color: change >= 0 ? "#34d399" : "#f87171" }}>
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}% today
                </div>
              </div>
            ))}
          </div>

          {/* Correlation gauge */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
              30-Day Rolling Correlation
            </div>
            <CorrGauge corr={data.currentCorrelation} />
            <div className="text-center text-[10px] mt-1" style={{ color: "rgba(175,185,215,0.5)" }}>
              {data.correlationLabelTh} ({data.correlationLabel})
            </div>
          </div>

          {/* Rolling correlation bars */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Rolling Correlation by Window
            </div>
            <div className="space-y-3">
              {data.rollingCorrelations.map(r => {
                const c = r.correlation;
                const barWidth = Math.abs(c) * 50;
                const color = corrColor(c);
                return (
                  <div key={r.window} className="flex items-center gap-3">
                    <span className="w-10 text-[10px] font-bold" style={{ color: "rgba(175,185,215,0.5)" }}>{r.window}D</span>
                    <div className="flex-1 h-3 rounded-full relative" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="absolute inset-y-0 rounded-full" style={{
                        left: c < 0 ? `${50 - barWidth}%` : "50%",
                        width: `${barWidth}%`,
                        background: color,
                      }} />
                      <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
                    </div>
                    <span className="w-12 text-right font-mono text-[10px] font-bold" style={{ color }}>{c.toFixed(2)}</span>
                    <span className="w-24 text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>{r.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divergence signal */}
          <div className={`panel px-5 py-4 ${data.divergence.active ? "ring-1 ring-amber-400/30" : ""}`}
            style={{ background: data.divergence.active ? "rgba(245,196,81,0.04)" : undefined }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{data.divergence.active ? "⚡" : "✓"}</span>
              <div>
                <div className="text-xs font-bold" style={{ color: data.divergence.active ? "#f5c451" : "#34d399" }}>
                  {data.divergence.active ? "Divergence Detected" : "Normal Relationship"}
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                  Gold: {data.divergence.goldDir === "up" ? "↑" : "↓"} ·
                  DXY: {data.divergence.dxyDir === "up" ? "↑" : "↓"} ·
                  Last 5 days
                </div>
              </div>
            </div>
            <p className="text-xs" style={{ color: "rgba(175,185,215,0.7)" }}>{data.divergence.signalTh}</p>
            <p className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>{data.divergence.signal}</p>
          </div>

          {/* Dual line chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              Daily Returns — เส้นเหลือง = Gold · เส้นฟ้า = DXY
            </div>
            <DualLineChart history={data.history} />
            <div className="flex gap-4 mt-1 text-[8px]">
              <span style={{ color: "#f5c451" }}>━ Gold Return</span>
              <span style={{ color: "#60a5fa" }}>━ DXY Return</span>
            </div>
          </div>

          {/* Tips */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3 text-amber-400/60">💡 DXY vs Gold</div>
            <ul className="space-y-2 text-xs" style={{ color: "rgba(175,185,215,0.6)" }}>
              <li>→ ปกติ: Gold กับ DXY มีความสัมพันธ์ผกผัน (Correlation ~ -0.5 ถึง -0.8)</li>
              <li>→ Corr ใกล้ -1 = inverse สูงมาก — ซื้อ Gold เมื่อ DXY อ่อน</li>
              <li>→ Corr ใกล้ 0 = ความสัมพันธ์หายชั่วคราว — มีปัจจัยอื่นเข้ามาแทรก (geopolitics)</li>
              <li>→ Divergence (ทองและ USD ขึ้นพร้อมกัน) = safe-haven demand แข็งแกร่งมาก</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              {data.history.length} วัน ·
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
