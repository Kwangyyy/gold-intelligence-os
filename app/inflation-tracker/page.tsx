"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { InflationTrackerPayload, InflationMetric } from "@/app/api/inflation-tracker/route";

function VsTargetBar({ value, target, max }: { value: number; target: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const tgtPct = Math.min(100, (target / max) * 100);
  const overTarget = value > target;
  return (
    <div className="relative h-2 rounded-full overflow-visible" style={{ background: "rgba(255,255,255,0.04)" }}>
      <div className="h-full rounded-full" style={{
        width: `${pct}%`,
        background: overTarget ? "linear-gradient(90deg,#f5c451,#f87171)" : "linear-gradient(90deg,#818cf8,#34d399)",
      }} />
      {/* Target line */}
      <div className="absolute top-[-2px] bottom-[-2px] w-0.5 rounded"
        style={{ left: `${tgtPct}%`, background: "rgba(255,255,255,0.4)" }} />
    </div>
  );
}

function MetricCard({ m }: { m: InflationMetric }) {
  const goldColors = { bullish: "#34d399", neutral: "#9ca3af", bearish: "#f87171" };
  const maxVal = Math.max(m.value * 1.5, m.fedTarget * 2.5, 5);

  return (
    <div className="panel px-4 py-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold mb-0.5" style={{ color: "rgba(175,185,215,0.85)" }}>
            {m.nameTh}
          </div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>
            {m.period} · {m.releaseDate}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black" style={{ color: m.value > m.fedTarget ? "#f87171" : "#34d399" }}>
            {m.value}%
          </div>
          <div className="text-[8px] font-bold" style={{ color: m.trendColor }}>
            {m.trend === "rising" ? "▲" : m.trend === "falling" ? "▼" : "─"}
            {m.change >= 0 ? " +" : " "}{m.change.toFixed(1)}pp
          </div>
        </div>
      </div>
      <VsTargetBar value={m.value} target={m.fedTarget} max={maxVal} />
      <div className="flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
        <span>0%</span>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>Target {m.fedTarget}%</span>
        <span style={{ color: m.vsTarget > 0 ? "#f97316" : "#34d399" }}>
          {m.vsTarget >= 0 ? "+" : ""}{m.vsTarget.toFixed(1)}pp vs target
        </span>
      </div>
      <div className="text-[9px]" style={{ color: goldColors[m.goldImpact] }}>
        🪙 {m.goldImpactTh}
      </div>
    </div>
  );
}

export default function InflationTrackerPage() {
  const [data, setData]       = useState<InflationTrackerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/inflation-tracker", { cache: "no-store" });
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
        title="📊 Inflation Tracker"
        subtitle="ติดตาม CPI / PCE / PPI และ breakeven inflation — เงินเฟ้อเป็น key driver ทอง"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📊 กำลังโหลดข้อมูลเงินเฟ้อ…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Summary */}
          <div className="panel px-5 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Inflation Environment</div>
                <div className="text-xs font-black" style={{ color: data.goldBiasColor }}>
                  {data.inflationEnvironmentTh}
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Breakeven Inflation</div>
                <div className="text-lg font-black" style={{ color: data.breakEvenInflation > 2.5 ? "#f87171" : "#34d399" }}>
                  {data.breakEvenInflation}%
                </div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>10Y market implied</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Real Yield</div>
                <div className="text-lg font-black" style={{ color: data.realYield < 0 ? "#34d399" : data.realYield > 2 ? "#f87171" : "#f5c451" }}>
                  {data.realYield >= 0 ? "+" : ""}{data.realYield}%
                </div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>10Y - CPI proxy</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Hedge Value</div>
                <div className="text-sm font-black" style={{
                  color: data.goldVsInflation === "undervalued" ? "#34d399" : data.goldVsInflation === "overvalued" ? "#f87171" : "#9ca3af"
                }}>
                  {data.goldVsInflation === "undervalued" ? "Undervalued" : data.goldVsInflation === "overvalued" ? "Overvalued" : "Fair Value"}
                </div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>vs breakeven</div>
              </div>
            </div>
            <div className="text-xs font-bold" style={{ color: data.goldBiasColor }}>
              🪙 {data.goldBiasTh}
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.metrics.map(m => <MetricCard key={m.id} m={m} />)}
          </div>

          {/* Historical context */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 เงินเฟ้อกับทองคำ
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ ทองเป็น inflation hedge ในระยะยาว — ซื้อกำลังซื้อรักษาได้ดีกว่า cash</li>
              <li>→ <span className="font-bold" style={{ color: "#f87171" }}>เงินเฟ้อสูง (&gt;4%)</span> = ทองมักทำ all-time high (2022, 2011, 1980)</li>
              <li>→ Breakeven inflation สูง → ตลาด bond คาดเงินเฟ้อ → หนุน gold</li>
              <li>→ Real yield ติดลบ = ทอง outperform cash/bonds dramatically</li>
              <li>→ PCE คือ preferred measure ของ Fed สำหรับ inflation targeting</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ CPI/PCE/PPI data เป็น static จาก BLS/BEA — อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
