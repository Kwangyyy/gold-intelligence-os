"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { SupplyDemandPayload, EtfFlowBar } from "@/app/api/supply-demand/route";

function EtfChart({ flows }: { flows: EtfFlowBar[] }) {
  if (flows.length < 3) return null;
  const W = 560, H = 80;
  const maxAbs = Math.max(...flows.map(f => Math.abs(f.etfTonnes)), 0.1);
  const barW = W / flows.length - 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.06)" />
      {flows.map((f, i) => {
        const isPos = f.etfTonnes >= 0;
        const barH  = (Math.abs(f.etfTonnes) / maxAbs) * (H / 2 - 4);
        const x     = i * (W / flows.length) + 1;
        const y     = isPos ? H / 2 - barH : H / 2;
        return (
          <rect
            key={i} x={x} y={y} width={barW} height={Math.max(barH, 1)}
            fill={isPos ? "#34d399" : "#f87171"} opacity={0.7} rx="1"
          />
        );
      })}
    </svg>
  );
}

function PieDonut({ slices, total, label }: {
  slices: { pct: number; color: string; label: string }[];
  total: number;
  label: string;
}) {
  const r = 38, cx = 50, cy = 50, stroke = 14;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 100 100" width="100" height="100">
        {slices.map((s, i) => {
          const dash = (s.pct / 100) * circumference;
          const gap  = circumference - dash;
          const el = (
            <circle
              key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={0.8}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="rgba(245,196,81,0.9)">{total.toLocaleString()}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="6" fill="rgba(175,185,215,0.4)">tonnes</text>
      </svg>
      <div className="text-[9px] uppercase tracking-wider mt-1" style={{ color: "rgba(175,185,215,0.3)" }}>{label}</div>
    </div>
  );
}

const SUPPLY_COLORS = ["#f5c451", "#60a5fa", "#a78bfa"];
const DEMAND_COLORS = ["#34d399", "#6ee7b7", "#f5c451", "#60a5fa", "#f97316"];

export default function SupplyDemandPage() {
  const [data, setData]       = useState<SupplyDemandPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/supply-demand", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const balanceColor = (b: string) => b === "deficit" ? "#34d399" : b === "surplus" ? "#f87171" : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="⚖️ Supply & Demand"
        subtitle="Gold supply/demand balance — ETF flows, central banks, structural breakdown"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            ⚖️ กำลังโหลดข้อมูล Supply & Demand…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Price + Balance hero */}
          <div className="grid grid-cols-3 gap-3">
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>ราคาทอง</div>
              <div className="text-xl font-black" style={{ color: "#f5c451" }}>${data.currentPrice.toLocaleString()}</div>
              <div className="text-[10px] font-bold mt-0.5" style={{ color: data.priceChange30d >= 0 ? "#34d399" : "#f87171" }}>
                {data.priceChange30d >= 0 ? "+" : ""}{data.priceChange30d.toFixed(2)}% (30d)
              </div>
            </div>
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Balance</div>
              <div className="text-sm font-black" style={{ color: balanceColor(data.balance) }}>{data.balanceTh}</div>
              <div className="text-[10px] font-bold mt-0.5" style={{ color: balanceColor(data.balance) }}>
                {data.balanceTonnes > 0 ? "+" : ""}{data.balanceTonnes} ตัน
              </div>
            </div>
            <div className="panel px-4 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>ETF Flows (20d)</div>
              <div className="text-sm font-black" style={{ color: data.etfTrend === "inflows" ? "#34d399" : data.etfTrend === "outflows" ? "#f87171" : "#f5c451" }}>
                {data.etfTrendTh}
              </div>
              <div className="text-[10px] font-bold mt-0.5" style={{ color: data.etfTotalChange >= 0 ? "#34d399" : "#f87171" }}>
                {data.etfTotalChange >= 0 ? "+" : ""}{data.etfTotalChange} ตัน
              </div>
            </div>
          </div>

          {/* Implication */}
          <div className="panel px-5 py-4" style={{ background: `${balanceColor(data.balance)}08`, border: `1px solid ${balanceColor(data.balance)}20` }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: `${balanceColor(data.balance)}80` }}>🪙 นัยสำหรับทองคำ</div>
            <p className="text-sm font-semibold" style={{ color: balanceColor(data.balance) }}>{data.implicationTh}</p>
            <p className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.35)" }}>{data.implicationEn}</p>
          </div>

          {/* Supply vs Demand donuts */}
          <div className="panel px-5 py-5">
            <div className="text-[9px] uppercase tracking-widest mb-4" style={{ color: "rgba(175,185,215,0.3)" }}>
              โครงสร้างอุปทาน vs อุปสงค์ (ประมาณการปี 2024-25)
            </div>
            <div className="flex justify-around items-start gap-4">
              <div className="flex-1">
                <PieDonut
                  slices={data.supplyBreakdown.map((s, i) => ({ pct: s.pct, color: SUPPLY_COLORS[i] ?? "#888", label: s.category }))}
                  total={data.annualSupplyTonnes}
                  label="Supply"
                />
                <div className="mt-3 space-y-1.5">
                  {data.supplyBreakdown.map((s, i) => (
                    <div key={s.category} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SUPPLY_COLORS[i] }} />
                      <span className="text-[9px] flex-1" style={{ color: "rgba(175,185,215,0.5)" }}>{s.categoryTh}</span>
                      <span className="text-[9px] font-bold" style={{ color: "rgba(175,185,215,0.7)" }}>{s.tonnes.toLocaleString()}t</span>
                      <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.05)" }} />

              <div className="flex-1">
                <PieDonut
                  slices={data.demandBreakdown.map((s, i) => ({ pct: s.pct, color: DEMAND_COLORS[i] ?? "#888", label: s.category }))}
                  total={data.annualDemandTonnes}
                  label="Demand"
                />
                <div className="mt-3 space-y-1.5">
                  {data.demandBreakdown.map((s, i) => (
                    <div key={s.category} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: DEMAND_COLORS[i] }} />
                      <span className="text-[9px] flex-1" style={{ color: "rgba(175,185,215,0.5)" }}>{s.categoryTh}</span>
                      <span className="text-[9px] font-bold" style={{ color: "rgba(175,185,215,0.7)" }}>{s.tonnes.toLocaleString()}t</span>
                      <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Central bank */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.12)" }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🏦</span>
              <div>
                <div className="text-xs font-bold" style={{ color: data.centralBankBias === "accumulating" ? "#34d399" : data.centralBankBias === "reducing" ? "#f87171" : "#f5c451" }}>
                  ธนาคารกลาง: {data.centralBankBias === "accumulating" ? "สะสมทอง 🟢" : data.centralBankBias === "reducing" ? "ลดทอง 🔴" : "Neutral 🟡"}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{data.centralBankTh}</div>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.min(100, (data.cbTonnes / 1200) * 100)}%`,
                background: data.centralBankBias === "accumulating" ? "#34d399" : "#f87171",
              }} />
            </div>
            <div className="text-[8px] mt-1" style={{ color: "rgba(175,185,215,0.3)" }}>{data.cbTonnes} ตัน / ปี (ประมาณการ)</div>
          </div>

          {/* ETF flow chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              ETF Flow Proxy (20 วัน) — เขียว = ไหลเข้า · แดง = ไหลออก
            </div>
            <EtfChart flows={data.etfFlows} />
            <div className="flex justify-between mt-1 text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              <span>{data.etfFlows[0]?.date}</span>
              <span>{data.etfFlows.at(-1)?.date}</span>
            </div>
          </div>

          {/* Context note */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>💡 หมายเหตุ</div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.5)" }}>
              <li>→ ตัวเลขอุปทาน/อุปสงค์ใช้ประมาณการ World Gold Council 2024-25</li>
              <li>→ ETF Flow เป็น proxy จาก gold price momentum (ไม่ใช่ข้อมูล GLD จริง)</li>
              <li>→ Central bank demand ปี 2024-25 อยู่ระดับสูงสุดในรอบ 55 ปี</li>
              <li>→ Deficit = demand &gt; supply → สนับสนุน price ขาขึ้นในระยะยาว</li>
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
