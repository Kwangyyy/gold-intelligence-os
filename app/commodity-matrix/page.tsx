"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { CommodityMatrixPayload, CommodityRow } from "@/app/api/commodity-matrix/route";

const CAT_ICON: Record<CommodityRow["category"], string> = {
  precious: "💎", energy: "⚡", industrial: "🏭", agriculture: "🌾", crypto: "₿",
};
const CAT_COLOR: Record<CommodityRow["category"], string> = {
  precious: "#f5c451", energy: "#f97316", industrial: "#60a5fa", agriculture: "#86efac", crypto: "#c084fc",
};
const CAT_LABEL: Record<CommodityRow["category"], string> = {
  precious: "Precious", energy: "Energy", industrial: "Industrial", agriculture: "Agriculture", crypto: "Crypto",
};

function ChangeCell({ val }: { val: number }) {
  const color = val > 1 ? "#34d399" : val > 0 ? "#86efac" : val > -1 ? "#fca5a5" : "#f87171";
  return (
    <td className="px-2 py-1 text-center font-mono text-[9px] font-bold" style={{ color }}>
      {val > 0 ? "+" : ""}{val.toFixed(2)}%
    </td>
  );
}

function CorrBar({ corr, color }: { corr: number; color: string }) {
  const pct = Math.abs(corr) * 100;
  const left = corr < 0;
  return (
    <div className="flex items-center gap-1">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden relative" style={{ background: "rgba(255,255,255,0.05)" }}>
        {left
          ? <div className="absolute right-1/2 inset-y-0 rounded-l-full" style={{ width: `${pct / 2}%`, background: color, right: "50%" }} />
          : <div className="absolute left-1/2 inset-y-0 rounded-r-full" style={{ width: `${pct / 2}%`, background: color }} />
        }
        <div className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: "50%" }} />
      </div>
      <span className="font-mono text-[9px] w-10 text-right" style={{ color }}>
        {corr > 0 ? "+" : ""}{corr.toFixed(2)}
      </span>
    </div>
  );
}

export default function CommodityMatrixPage() {
  const [data, setData]   = useState<CommodityMatrixPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [filter, setFilter]   = useState<"all" | CommodityRow["category"]>("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/commodity-matrix", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cats = ["all", "precious", "energy", "industrial", "agriculture", "crypto"] as const;
  const filtered = data?.rows.filter(r => filter === "all" || r.category === filter) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🌐 Commodity Correlation Matrix"
        subtitle="Gold เทียบสินค้าโภคภัณฑ์ — Silver, Oil, Bitcoin, Copper, Corn, Wheat + Correlation rolling 30 วัน"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🌐 กำลังโหลด Commodity Matrix…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
              <div className="text-sm font-mono font-black" style={{ color: "#f5c451" }}>
                ${data.goldPrice.toLocaleString()}
              </div>
              <div className="text-[9px]" style={{ color: data.goldChange1w >= 0 ? "#34d399" : "#f87171" }}>
                {data.goldChange1w >= 0 ? "+" : ""}{data.goldChange1w}% 1W
              </div>
            </div>
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Best Corr w/ Gold</div>
              <div className="text-sm font-black" style={{ color: "#34d399" }}>{data.bestCorrelated}</div>
            </div>
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Top Mover 1W</div>
              <div className="text-xs font-bold truncate" style={{ color: "#34d399" }}>{data.topMoverName}</div>
            </div>
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Worst 1W</div>
              <div className="text-xs font-bold truncate" style={{ color: "#f87171" }}>{data.worstMoverName}</div>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {cats.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className="px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all flex items-center gap-1"
                style={{
                  background: filter === c ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filter === c ? "rgba(245,196,81,0.5)" : "rgba(255,255,255,0.06)"}`,
                  color: filter === c ? "#f5c451" : "rgba(175,185,215,0.5)",
                }}>
                {c !== "all" && <span>{CAT_ICON[c as CommodityRow["category"]]}</span>}
                {c === "all" ? "ทั้งหมด" : CAT_LABEL[c as CommodityRow["category"]]}
              </button>
            ))}
          </div>

          {/* Matrix table */}
          <div className="panel overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["สินค้า","ราคา","1D","1W","1M","3M","Corr ทอง","Beta"].map(h => (
                    <th key={h} className="px-2 py-3 text-left text-[8px] uppercase tracking-wider font-semibold"
                      style={{ color: "rgba(175,185,215,0.35)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "" : ""}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      background: row.symbol.startsWith("GC") || row.symbol === "GC" ? "rgba(245,196,81,0.04)" : undefined,
                    }}>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span>{CAT_ICON[row.category]}</span>
                        <div>
                          <div className="text-[10px] font-bold" style={{ color: CAT_COLOR[row.category] }}>
                            {row.symbol.replace("3DF","").replace("GCF","GC").replace("SIF","SI")}
                          </div>
                          <div className="text-[8px] truncate max-w-[80px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                            {row.nameTh}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <span className="font-mono text-[9px]" style={{ color: "rgba(175,185,215,0.8)" }}>
                        {row.price > 1000 ? row.price.toLocaleString() : row.price.toFixed(2)}
                      </span>
                    </td>
                    <ChangeCell val={row.change1d} />
                    <ChangeCell val={row.change1w} />
                    <ChangeCell val={row.change1m} />
                    <ChangeCell val={row.change3m} />
                    <td className="px-2 py-1 min-w-[100px]">
                      <CorrBar corr={row.corrWithGold} color={row.corrColor} />
                      <div className="text-[7px] mt-0.5" style={{ color: row.corrColor }}>{row.corrLabel}</div>
                    </td>
                    <td className="px-2 py-1 text-center">
                      <span className="font-mono text-[9px]" style={{ color: "#c084fc" }}>
                        {row.betaToGold.toFixed(2)}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Education */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 อ่าน Correlation อย่างไร
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ Corr +1.0 = เคลื่อนที่ตามกันสมบูรณ์ | 0 = ไม่สัมพันธ์ | -1.0 = ตรงข้ามกันสมบูรณ์</li>
              <li>→ Silver มักมี Corr สูงสุดกับทอง (precious metal family)</li>
              <li>→ Bitcoin corr กับทองผันแปร — บางช่วงตามกัน (inflation hedge) บางช่วงตรงข้าม (risk asset)</li>
              <li>→ Crude Oil corr ปานกลาง — เชื่อมกันผ่าน USD และ inflation expectations</li>
              <li>→ Beta &gt; 1 = leverage มากกว่าทอง | Beta &lt; 1 = conservative กว่า</li>
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
