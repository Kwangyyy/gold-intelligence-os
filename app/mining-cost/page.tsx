"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MiningCostPayload, MinerEntry } from "@/app/api/mining-cost/route";

const MARGIN_LABEL_TH: Record<MinerEntry["marginLabel"], string> = {
  excellent: "กำไรสูงมาก", good: "กำไรดี", moderate: "กำไรปานกลาง",
  tight: "กำไรน้อย", underwater: "ขาดทุน",
};
const TYPE_LABEL: Record<MinerEntry["aiscType"], string> = {
  major: "Major", mid: "Mid-tier", royalty: "Royalty",
};

function MarginBar({ aisc, gold }: { aisc: number; gold: number }) {
  if (aisc === 0) return <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Royalty model</div>;
  const aiscPct = (aisc / gold) * 100;
  const marginPct = 100 - aiscPct;
  const color = marginPct > 50 ? "#34d399" : marginPct > 30 ? "#86efac" : marginPct > 10 ? "#f5c451" : "#f87171";

  return (
    <div className="space-y-0.5">
      <div className="flex h-3 rounded overflow-hidden">
        <div style={{ width: `${aiscPct}%`, background: "rgba(248,113,113,0.4)" }} />
        <div style={{ width: `${marginPct}%`, background: color, opacity: 0.7 }} />
      </div>
      <div className="flex justify-between text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
        <span style={{ color: "#f87171" }}>AISC ${aisc.toLocaleString()}</span>
        <span style={{ color }}>Margin ${(gold - aisc).toLocaleString()} ({marginPct.toFixed(0)}%)</span>
      </div>
    </div>
  );
}

function MinerCard({ m, gold }: { m: MinerEntry; gold: number }) {
  return (
    <div className="panel px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{m.flag}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black" style={{ color: "rgba(245,196,81,0.9)" }}>
                {m.ticker}
              </span>
              <span className="text-[8px] px-1 py-0.5 rounded font-bold"
                style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8" }}>
                {TYPE_LABEL[m.aiscType]}
              </span>
            </div>
            <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>{m.nameTh}</div>
          </div>
        </div>
        {m.aiscType !== "royalty" && (
          <div className="text-right">
            <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
              style={{ background: m.marginColor + "22", color: m.marginColor }}>
              {MARGIN_LABEL_TH[m.marginLabel]}
            </span>
            <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
              {m.dataSource}
            </div>
          </div>
        )}
      </div>
      <MarginBar aisc={m.aisc} gold={gold} />
      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>💬 {m.note}</div>
    </div>
  );
}

export default function MiningCostPage() {
  const [data, setData]       = useState<MiningCostPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [filter, setFilter]   = useState<"all" | "major" | "mid" | "royalty">("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/mining-cost", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data?.miners.filter(m => filter === "all" || m.aiscType === filter) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="⛏️ Gold Mining Cost Tracker"
        subtitle="AISC (All-In Sustaining Cost) ต่อ oz ของเหมืองทอง — ราคา floor ที่ผู้ผลิตอยู่รอดได้"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            ⛏️ กำลังโหลดข้อมูลต้นทุนเหมือง…
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
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Price</div>
                <div className="text-lg font-black" style={{ color: "#f5c451" }}>
                  ${data.goldPrice.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Industry Avg AISC</div>
                <div className="text-lg font-black" style={{ color: "#f87171" }}>
                  ${data.industryAvgAisc.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Avg Margin</div>
                <div className="text-lg font-black" style={{ color: "#34d399" }}>
                  ${data.industryMargin.toLocaleString()}
                  <span className="text-xs font-normal ml-1" style={{ color: "rgba(175,185,215,0.4)" }}>
                    ({data.industryMarginPct}%)
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Price Floor (P90)</div>
                <div className="text-lg font-black" style={{ color: "#c084fc" }}>
                  ${data.priceFloor.toLocaleString()}
                </div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>AISC support level</div>
              </div>
            </div>

            {/* Composite bar */}
            <div className="mb-3">
              <div className="flex h-4 rounded overflow-hidden">
                <div style={{ width: `${(data.industryAvgAisc / data.goldPrice) * 100}%`, background: "rgba(248,113,113,0.35)" }} />
                <div style={{ flex: 1, background: "rgba(52,211,153,0.3)" }} />
              </div>
              <div className="flex justify-between text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
                <span>0</span>
                <span style={{ color: "#f87171" }}>AISC ${data.industryAvgAisc.toLocaleString()}</span>
                <span style={{ color: "#34d399" }}>Gold ${data.goldPrice.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-xs font-bold" style={{ color: data.goldBiasColor }}>
              🪙 {data.goldBiasTh}
            </div>
            <div className="text-[9px] mt-1" style={{ color: "rgba(175,185,215,0.4)" }}>
              Low-cost producer: {data.lowestCostProducer} (${data.lowestAisc.toLocaleString()}/oz)
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "major", "mid", "royalty"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all capitalize"
                style={{
                  background: filter === f ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filter === f ? "rgba(245,196,81,0.5)" : "rgba(255,255,255,0.06)"}`,
                  color: filter === f ? "#f5c451" : "rgba(175,185,215,0.5)",
                }}>
                {f === "all" ? "ทั้งหมด" : TYPE_LABEL[f as MinerEntry["aiscType"]]}
              </button>
            ))}
          </div>

          {/* Miner cards */}
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-widest px-1 mb-2"
              style={{ color: "rgba(175,185,215,0.3)" }}>
              Mining Cost Breakdown ({filtered.length})
            </div>
            {filtered.map(m => <MinerCard key={m.ticker} m={m} gold={data.goldPrice} />)}
          </div>

          {/* Why AISC matters */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 ทำไม AISC ถึงสำคัญ
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ AISC = ต้นทุนรวมทั้งหมดในการผลิตทอง 1 oz (รวม overhead, exploration, capex)
              </li>
              <li>→ ถ้าราคาทอง &lt; AISC → เหมืองปิดตัว → supply ลด → ราคาทองฟื้น (natural support)
              </li>
              <li>→ <span className="font-bold" style={{ color: "#c084fc" }}>Price Floor ที่ ${data.priceFloor.toLocaleString()}</span> = ระดับที่ high-cost miners เริ่มขาดทุน
              </li>
              <li>→ Royalty companies (FNV, WPM) ไม่มี AISC — protected จาก cost inflation
              </li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ AISC จากรายงานผลประกอบการ — อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
