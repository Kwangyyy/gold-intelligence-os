"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { DemandSector, GoldDemandPayload, RegionalEntry } from "@/app/api/gold-demand/route";

function DonutChart({ sectors }: { sectors: DemandSector[] }) {
  const R = 60, CX = 80, CY = 80, strokeW = 22;
  const circumference = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 160 160" width="160" height="160" className="shrink-0">
      {sectors.map(s => {
        const dash = (s.sharePct / 100) * circumference;
        const gap  = circumference - dash;
        const el = (
          <circle
            key={s.sector}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeW}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${CX}px ${CY}px`, opacity: 0.85 }}
          />
        );
        offset += dash;
        return el;
      })}
      {/* Center */}
      <text x={CX} y={CY - 6} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#f5c451">{sectors.reduce((s,e)=>s+e.tonnes,0).toFixed(0)}</text>
      <text x={CX} y={CY + 7} textAnchor="middle" fontSize="7" fill="rgba(175,185,215,0.4)">tonnes</text>
      <text x={CX} y={CY + 18} textAnchor="middle" fontSize="6" fill="rgba(175,185,215,0.3)">Q1 2026</text>
    </svg>
  );
}

function SectorRow({ s }: { s: DemandSector }) {
  const dir = s.yoyChangePct >= 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.7)" }}>{s.sectorTh}</span>
        </div>
        <div className="flex items-center gap-3 text-[9px]">
          <span style={{ color: "rgba(175,185,215,0.4)" }}>{s.tonnes}t</span>
          <span className="font-bold" style={{ color: dir ? "#34d399" : "#f87171" }}>
            {dir ? "+" : ""}{s.yoyChangePct.toFixed(1)}%
          </span>
          <span style={{ color: "rgba(175,185,215,0.3)" }}>{s.sharePct}%</span>
        </div>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full" style={{ width: `${s.sharePct}%`, background: s.color, opacity: 0.7 }} />
      </div>
      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{s.note}</div>
    </div>
  );
}

function RegionRow({ e }: { e: RegionalEntry }) {
  const typeIcon = e.type === "central_bank" ? "🏦" : e.type === "etf" ? "📈" : "🌍";
  const dir = e.yoyChangePct >= 0;
  return (
    <div className="flex items-center gap-3 py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <span className="text-sm">{typeIcon}</span>
      <span className="flex-1 text-[10px]" style={{ color: "rgba(175,185,215,0.6)" }}>{e.regionTh}</span>
      <span className="text-[10px] font-bold" style={{ color: "#f5c451" }}>{e.tonnes}t</span>
      <span className="text-[9px] font-bold w-12 text-right" style={{ color: dir ? "#34d399" : "#f87171" }}>
        {dir ? "+" : ""}{e.yoyChangePct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function GoldDemandPage() {
  const [data, setData]       = useState<GoldDemandPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/gold-demand", { cache: "no-store" });
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
        title="📊 Gold Demand Breakdown"
        subtitle="อุปสงค์ทองคำรายภาคส่วน — Q1 2026 (World Gold Council)"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📊 กำลังโหลดข้อมูลอุปสงค์…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5 space-y-4">
            <div className="flex items-center gap-5">
              <DonutChart sectors={data.sectors} />
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Total Q1 2026</div>
                    <div className="text-2xl font-black" style={{ color: "#f5c451" }}>{data.totalTonnes}t</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>YoY Change</div>
                    <div className="text-2xl font-black" style={{ color: data.yoyChangePct >= 0 ? "#34d399" : "#f87171" }}>
                      {data.yoyChangePct >= 0 ? "+" : ""}{data.yoyChangePct}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Implied Annual</div>
                    <div className="text-base font-black" style={{ color: "#f5c451" }}>{data.impliedAnnualDemand}t</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
                    <div className="text-base font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
                  </div>
                </div>
                <div className="rounded-xl px-3 py-2" style={{ background: `${data.demandBiasColor}10`, border: `1px solid ${data.demandBiasColor}30` }}>
                  <div className="text-[10px] font-bold" style={{ color: data.demandBiasColor }}>🪙 {data.demandBiasTh}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sector breakdown */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-4" style={{ color: "rgba(175,185,215,0.3)" }}>
              อุปสงค์แยกตามภาคส่วน
            </div>
            <div className="space-y-4">
              {data.sectors.map(s => <SectorRow key={s.sector} s={s} />)}
            </div>
          </div>

          {/* Regional */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              อุปสงค์รายภูมิภาค
            </div>
            <div>
              {data.regional.map(e => <RegionRow key={e.region} e={e} />)}
            </div>
          </div>

          {/* Demand score */}
          <div className="panel px-5 py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Investment Demand Score</span>
              <span className="text-xs font-black" style={{ color: data.demandScore >= 60 ? "#34d399" : "#f5c451" }}>{data.demandScore}/100</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-full" style={{ width: `${data.demandScore}%`, background: "linear-gradient(90deg, #34d39960, #34d399)" }} />
            </div>
            <div className="text-[8px] mt-1.5" style={{ color: "rgba(175,185,215,0.35)" }}>
              สัดส่วน bullish sectors (ETF + Bar/Coin + CB) ต่ออุปสงค์รวม
            </div>
          </div>

          {/* Context */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 วิธีใช้ Gold Demand Data
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ ETF + Bar/Coin inflows ขนาดใหญ่ → สัญญาณ investment demand แข็งแกร่ง</li>
              <li>→ CB buying ต่อเนื่อง → structural support ราคาทอง</li>
              <li>→ Jewellery อ่อนจากราคาสูง → ปกติเมื่อทองแพง; ไม่ใช่ bear signal</li>
              <li>→ Technology demand เพิ่ม → secular demand จาก AI/electronics</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ ข้อมูลอ้างอิง World Gold Council Q1 2026 | Gold: Yahoo Finance
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
