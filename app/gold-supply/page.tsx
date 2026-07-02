"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { GoldSupplyPayload, SupplyComponent, MiningRegion } from "@/app/api/gold-supply/route";

function BalanceBar({ supply, demand }: { supply: number; demand: number }) {
  const total = Math.max(supply, demand) * 1.05;
  const sW = (supply / total) * 100;
  const dW = (demand / total) * 100;
  const isDeficit = demand > supply;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex justify-between text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
          <span>อุปทาน (Supply)</span>
          <span className="font-bold" style={{ color: "#f87171" }}>{supply}t</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-full rounded-full" style={{ width: `${sW}%`, background: "rgba(248,113,113,0.6)" }} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
          <span>อุปสงค์ (Demand)</span>
          <span className="font-bold" style={{ color: "#34d399" }}>{demand}t</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-full rounded-full" style={{ width: `${dW}%`, background: "rgba(52,211,153,0.6)" }} />
        </div>
      </div>
      <div className="flex items-center gap-2 text-[9px]">
        <div className="w-2 h-2 rounded-full" style={{ background: isDeficit ? "#34d399" : "#f87171" }} />
        <span style={{ color: isDeficit ? "#34d399" : "#f87171" }}>
          {isDeficit ? `ขาดดุล ${Math.abs(demand - supply)}t → Bullish` : `เกินดุล ${supply - demand}t`}
        </span>
      </div>
    </div>
  );
}

function SupplyRow({ c }: { c: SupplyComponent }) {
  const trendIcon = c.trend === "up" ? "↑" : c.trend === "down" ? "↓" : "→";
  return (
    <div className="rounded-xl px-4 py-3 space-y-1.5"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>{c.nameTh}</div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{c.shareOfTotal}% of total supply</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black" style={{ color: "#f5c451" }}>{c.tonnesQ1}t</div>
          <div className="text-[9px] font-bold" style={{ color: c.trendColor }}>
            {trendIcon} {c.yoyChangePct >= 0 ? "+" : ""}{c.yoyChangePct.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full" style={{ width: `${c.shareOfTotal}%`, background: c.trendColor, opacity: 0.7 }} />
      </div>
      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>{c.note}</div>
    </div>
  );
}

function RegionRow({ r }: { r: MiningRegion }) {
  const dir = r.yoyChangePct >= 0;
  return (
    <div className="flex items-center gap-3 py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <span className="flex-1 text-[10px]" style={{ color: "rgba(175,185,215,0.6)" }}>{r.regionTh}</span>
      <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full" style={{ width: `${r.sharePct}%`, background: "rgba(245,196,81,0.5)" }} />
      </div>
      <span className="text-[9px] font-bold w-10 text-right" style={{ color: "#f5c451" }}>{r.tonnes}t</span>
      <span className="text-[8px] w-10 text-right" style={{ color: dir ? "#34d399" : "#f87171" }}>
        {dir ? "+" : ""}{r.yoyChangePct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function GoldSupplyPage() {
  const [data, setData]       = useState<GoldSupplyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/gold-supply", { cache: "no-store" });
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
        title="⛏ Gold Supply Monitor"
        subtitle="การผลิต รีไซเคิล และดุลอุปสงค์-อุปทานทองคำโลก Q1 2026"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            ⛏ กำลังโหลดข้อมูลอุปทาน…
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
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Total Supply Q1</div>
                <div className="text-2xl font-black" style={{ color: "#f87171" }}>{data.totalSupplyQ1}t</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Total Demand Q1</div>
                <div className="text-2xl font-black" style={{ color: "#34d399" }}>{data.totalDemandQ1}t</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Supply Growth</div>
                <div className="text-2xl font-black" style={{ color: data.supplyGrowthYoy > 3 ? "#f87171" : "#f5c451" }}>
                  +{data.supplyGrowthYoy.toFixed(1)}%
                </div>
              </div>
            </div>

            <BalanceBar supply={data.totalSupplyQ1} demand={data.totalDemandQ1} />

            <div className="rounded-xl px-4 py-3" style={{ background: `${data.balanceColor}10`, border: `1px solid ${data.balanceColor}30` }}>
              <div className="text-xs font-bold" style={{ color: data.balanceColor }}>⚖️ {data.balanceTh}</div>
            </div>
          </div>

          {/* Mining margin */}
          <div className="panel px-5 py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Mining Margin (Gold vs AISC)</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Price</div>
                <div className="text-lg font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Avg AISC</div>
                <div className="text-lg font-black" style={{ color: "#9ca3af" }}>${data.miningCostAvgAisc.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Margin</div>
                <div className="text-lg font-black" style={{ color: "#34d399" }}>{data.marginPct.toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-2 text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
              Margin สูง = ผู้ผลิตมีแรงจูงใจขยายกำลังผลิต → แรงขายระยะยาว
            </div>
          </div>

          {/* Supply breakdown */}
          <div className="space-y-3">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
              แหล่งอุปทาน
            </div>
            {data.components.map(c => <SupplyRow key={c.name} c={c} />)}
          </div>

          {/* Mining regions */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              การผลิตเหมืองแยกตามภูมิภาค (ประมาณการรายปี)
            </div>
            {data.regions.map(r => <RegionRow key={r.region} r={r} />)}
          </div>

          {/* Context */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 วิธีใช้ Gold Supply Data
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ Supply &lt; Demand (Deficit) → structural bullish; ราคาต้องขึ้นเพื่อ destroy demand</li>
              <li>→ Recycling เพิ่มเมื่อราคาสูง → แรงขาย หากราคา spike แรง</li>
              <li>→ Producer Dehedging → bullish; miners ไม่ต้องการขาย forward</li>
              <li>→ Margin สูง → M&amp;A activity; นักลงทุน prefer miners over physical</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ WGC Q1 2026 estimates | Gold: Yahoo Finance
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
