"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { M2Entry, MoneySupplyPayload } from "@/app/api/money-supply/route";

function LiquidityGauge({ score, signal }: { score: number; signal: string }) {
  const color = score >= 60 ? "#34d399" : score >= 35 ? "#f5c451" : "#f87171";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.35)" }}>
          Liquidity Score
        </span>
        <span className="text-xs font-black" style={{ color }}>{score}/100</span>
      </div>
      <div className="relative h-6 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
            {signal === "expanding" ? "สภาพคล่องขยาย" : signal === "contracting" ? "สภาพคล่องตึง" : "สภาพคล่องปกติ"}
          </span>
        </div>
      </div>
      <div className="flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        <span>0 ตึงมาก</span>
        <span>50 ปกติ</span>
        <span>100 ขยายมาก</span>
      </div>
    </div>
  );
}

function GrowthBar({ pct, max }: { pct: number; max: number }) {
  const w = Math.min(100, (Math.abs(pct) / max) * 100);
  const color = pct > 6 ? "#34d399" : pct > 2 ? "#f5c451" : "#f87171";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: color, opacity: 0.8 }} />
      </div>
      <span className="text-[9px] font-bold w-10 text-right" style={{ color }}>
        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
      </span>
    </div>
  );
}

function CountryCard({ e }: { e: M2Entry }) {
  return (
    <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>{e.countryTh}</div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{e.currency} · {e.lastUpdated}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black" style={{ color: "#f5c451" }}>${e.m2Trillions.toFixed(1)}T</div>
          <div className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${e.trendColor}18`, color: e.trendColor }}>
            {e.trend === "expanding" ? "ขยาย" : e.trend === "contracting" ? "หดตัว" : "คงที่"}
          </div>
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          <span>YoY Growth</span>
          <span>MoM</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <GrowthBar pct={e.yoyGrowthPct} max={14} />
          </div>
          <span className="text-[8px]" style={{ color: e.momGrowthPct >= 0 ? "#34d399" : "#f87171" }}>
            {e.momGrowthPct >= 0 ? "+" : ""}{e.momGrowthPct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="text-[8px] pt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{e.note}</div>
      <div className="text-[8px] font-bold" style={{ color: e.goldImpact === "bullish" ? "#34d399" : e.goldImpact === "bearish" ? "#f87171" : "#f5c451" }}>
        🪙 {e.goldImpactTh}
      </div>
    </div>
  );
}

function M2BarChart({ entries }: { entries: M2Entry[] }) {
  const maxSize = Math.max(...entries.map(e => e.m2Trillions));
  return (
    <div className="space-y-2">
      {[...entries].sort((a, b) => b.m2Trillions - a.m2Trillions).map(e => (
        <div key={e.country} className="flex items-center gap-3">
          <div className="w-20 text-[9px] truncate" style={{ color: "rgba(175,185,215,0.55)" }}>{e.countryTh}</div>
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${(e.m2Trillions / maxSize) * 100}%`,
                background: `linear-gradient(90deg, ${e.trendColor}60, ${e.trendColor})`
              }}
            />
          </div>
          <div className="w-14 text-right text-[9px] font-bold" style={{ color: "#f5c451" }}>${e.m2Trillions.toFixed(1)}T</div>
        </div>
      ))}
    </div>
  );
}

export default function MoneySupplyPage() {
  const [data, setData]       = useState<MoneySupplyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/money-supply", { cache: "no-store" });
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
        title="💵 Global Money Supply"
        subtitle="M2 โลก — การขยายตัวของสภาพคล่องและผลกระทบต่อทองคำ"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            💵 กำลังโหลดข้อมูล M2…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Global M2</div>
                <div className="text-2xl font-black" style={{ color: "#f5c451" }}>${data.totalM2Usd.toFixed(0)}T</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>USD equivalent</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Global YoY</div>
                <div className="text-2xl font-black" style={{ color: data.globalYoyGrowth > 4 ? "#34d399" : data.globalYoyGrowth > 1 ? "#f5c451" : "#f87171" }}>
                  +{data.globalYoyGrowth.toFixed(1)}%
                </div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>weighted avg</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
                <div className="text-2xl font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>GC=F</div>
              </div>
            </div>

            <LiquidityGauge score={data.liquidityScore} signal={data.liquiditySignal} />

            <div className="rounded-xl px-4 py-3 text-center" style={{ background: `${data.goldBiasColor}10`, border: `1px solid ${data.goldBiasColor}30` }}>
              <div className="text-xs font-black" style={{ color: data.goldBiasColor }}>🪙 {data.goldBiasTh}</div>
            </div>
          </div>

          {/* M2 Size Bar Chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              ขนาด M2 ตามประเทศ (USD equivalent)
            </div>
            <M2BarChart entries={data.entries} />
          </div>

          {/* Country Cards */}
          <div className="space-y-3">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
              รายละเอียดแต่ละประเทศ
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.entries.map(e => <CountryCard key={e.country} e={e} />)}
            </div>
          </div>

          {/* Theory */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 ความสัมพันธ์ M2 → ทองคำ
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ M2 ขยายตัวเร็ว = เงินมากขึ้น → purchasing power ลด → ทองคำมักแข็งค่า</li>
              <li>→ China M2 ใหญ่ที่สุดในโลก → ขยายตัวสูง → demand ทองจากจีนมักเพิ่มตาม</li>
              <li>→ US M2 หดตัว 2022-2023 → ทองกดดัน → กลับมาขยาย 2024+ หนุนขา bull</li>
              <li>→ Global M2 YoY &gt;6% ประวัติศาสตร์มักตามด้วย gold bull market</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ ข้อมูล M2 อัปเดตรายไตรมาส | Gold: Yahoo Finance | {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
