"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { DXYBreakdownPayload, DXYComponent } from "@/app/api/dxy-breakdown/route";

function DXYGauge({ level }: { level: number }) {
  const MIN = 90, MAX = 115;
  const pct = Math.min(100, Math.max(0, ((level - MIN) / (MAX - MIN)) * 100));
  const color = level > 104 ? "#f87171" : level < 98 ? "#34d399" : "#f5c451";
  return (
    <div className="space-y-1.5">
      <div className="relative h-6 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        {/* Zone backgrounds */}
        <div className="absolute inset-y-0 left-0 w-[32%]" style={{ background: "rgba(52,211,153,0.08)" }} />
        <div className="absolute inset-y-0" style={{ left: "32%", right: "24%", background: "rgba(245,196,81,0.06)" }} />
        <div className="absolute inset-y-0 right-0 w-[24%]" style={{ background: "rgba(248,113,113,0.08)" }} />
        {/* Fill */}
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-black" style={{ color: "rgba(255,255,255,0.5)" }}>{level.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex justify-between text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        <span>90 (Weak USD)</span>
        <span>98–104 Normal</span>
        <span>115 (Strong USD)</span>
      </div>
    </div>
  );
}

function ContributionBar({ c }: { c: DXYComponent }) {
  const isPositive = c.contribution1d >= 0;
  const absPct = Math.min(100, Math.abs(c.contribution1d) * 500);   // scale for visualization
  return (
    <div className="flex items-center gap-2 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <span className="text-base w-6">{c.flag}</span>
      <div className="w-14 text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{c.currency}</div>
      <div className="text-[8px] w-8 text-right" style={{ color: "rgba(175,185,215,0.3)" }}>{c.weight}%</div>
      {/* Bar */}
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${absPct}%`,
            marginLeft: isPositive ? "0" : "auto",
            background: isPositive ? "rgba(248,113,113,0.7)" : "rgba(52,211,153,0.7)",
          }}
        />
      </div>
      <div className="text-[8px] w-14 text-right tabular-nums" style={{ color: c.trendColor }}>
        {c.change1d >= 0 ? "+" : ""}{c.change1d.toFixed(2)}%
      </div>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.goldImpact === "bullish" ? "#34d399" : c.goldImpact === "bearish" ? "#f87171" : "#9ca3af" }} />
    </div>
  );
}

function ComponentCard({ c }: { c: DXYComponent }) {
  return (
    <div className="rounded-xl px-4 py-3 space-y-1"
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.05)` }}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="text-xl">{c.flag}</span>
          <div>
            <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>
              {c.currencyTh} ({c.currency})
            </div>
            <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{c.pair} · weight {c.weight}%</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black" style={{ color: "#f5c451" }}>{c.rate}</div>
          <div className="text-[9px] font-bold" style={{ color: c.change1d >= 0 ? "#f87171" : "#34d399" }}>
            {c.change1d >= 0 ? "+" : ""}{c.change1d.toFixed(3)}%
          </div>
        </div>
      </div>
      <div className="text-[8px] font-bold" style={{ color: c.goldImpact === "bullish" ? "#34d399" : c.goldImpact === "bearish" ? "#f87171" : "#9ca3af" }}>
        🪙 {c.goldImpactTh}
      </div>
    </div>
  );
}

export default function DXYBreakdownPage() {
  const [data, setData]       = useState<DXYBreakdownPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [view, setView]       = useState<"contribution" | "cards">("contribution");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/dxy-breakdown", { cache: "no-store" });
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
        title="💱 DXY Breakdown"
        subtitle="การแยกวิเคราะห์ดัชนีดอลลาร์สหรัฐ (ICE DXY) รายสกุลเงิน — ผลกระทบต่อทองคำ"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            💱 กำลังโหลดข้อมูล DXY…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>DXY Level</div>
                <div className="text-4xl font-black" style={{ color: data.dxyColor }}>{data.dxyLevel}</div>
                <div className="text-xs font-bold mt-0.5" style={{ color: data.dxyColor }}>{data.dxyZoneTh}</div>
              </div>
              <div className="text-right space-y-2">
                <div>
                  <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>1D</div>
                  <div className="text-base font-black" style={{ color: data.dxyChange1d >= 0 ? "#f87171" : "#34d399" }}>
                    {data.dxyChange1d >= 0 ? "+" : ""}{data.dxyChange1d.toFixed(3)}%
                  </div>
                </div>
                <div>
                  <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>🪙 Gold</div>
                  <div className="text-base font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <DXYGauge level={data.dxyLevel} />

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl px-3 py-2" style={{ background: `${data.goldBiasColor}10`, border: `1px solid ${data.goldBiasColor}30` }}>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Signal</div>
                <div className="text-xs font-bold" style={{ color: data.goldBiasColor }}>🪙 {data.goldBiasTh}</div>
              </div>
              <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>ปัจจัยหลัก</div>
                <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{data.dominantDriver}</div>
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-1">
            {(["contribution", "cards"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="rounded-lg px-3 py-1.5 text-[10px] font-bold"
                style={{
                  background: view === v ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${view === v ? "rgba(245,196,81,0.4)" : "rgba(255,255,255,0.06)"}`,
                  color: view === v ? "#f5c451" : "rgba(175,185,215,0.4)",
                }}>
                {v === "contribution" ? "📊 Contribution" : "💱 รายสกุลเงิน"}
              </button>
            ))}
          </div>

          {view === "contribution" ? (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                DXY Contribution by Currency (1D)
              </div>
              <div className="flex justify-between text-[8px] mb-2" style={{ color: "rgba(175,185,215,0.25)" }}>
                <span>Currency · Weight</span>
                <span>Change vs USD</span>
              </div>
              {data.components.map(c => <ContributionBar key={c.currency} c={c} />)}
              <div className="flex gap-4 mt-3 text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                <span><span style={{ color: "#34d399" }}>■</span> EUR/GBP แข็ง → DXY ลง → Gold ขึ้น</span>
                <span><span style={{ color: "#f87171" }}>■</span> JPY/others อ่อน → DXY ขึ้น → Gold ลง</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.components.map(c => <ComponentCard key={c.currency} c={c} />)}
            </div>
          )}

          {/* Education */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 DXY กับทองคำ
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ EUR มีน้ำหนัก 57.6% ใน DXY → EURUSD เป็นตัวขับเคลื่อนหลัก</li>
              <li>→ DXY กับทองมีความสัมพันธ์ negative (-0.7 to -0.9) ระยะยาว</li>
              <li>→ JPY อ่อนค่า → BOJ dovish → risk-on → ทองอาจถูกทดแทนด้วย stocks</li>
              <li>→ CHF แข็งค่า = safe haven demand → มักพร้อมกับทองขึ้น</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ Yahoo Finance FX rates | DXY from ICE | {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
