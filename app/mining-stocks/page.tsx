"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MiningStocksPayload, MiningStock } from "@/app/api/mining-stocks/route";

const CAT_LABEL: Record<MiningStock["category"], string> = {
  etf: "ETF", major: "Major", mid: "Mid-Cap", royalty: "Royalty",
};
const CAT_COLOR: Record<MiningStock["category"], string> = {
  etf: "#c084fc", major: "#f5c451", mid: "#60a5fa", royalty: "#34d399",
};

function BetaBar({ beta }: { beta: number }) {
  const pct = Math.min(100, (beta / 3) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#c084fc" }} />
      </div>
      <span className="font-mono text-[9px]" style={{ color: "#c084fc" }}>{beta}x</span>
    </div>
  );
}

function ChangeChip({ val }: { val: number }) {
  const color = val > 0 ? "#34d399" : val < 0 ? "#f87171" : "#f5c451";
  return (
    <span className="text-[9px] font-mono font-bold" style={{ color }}>
      {val > 0 ? "+" : ""}{val.toFixed(2)}%
    </span>
  );
}

function StockRow({ s, expanded, onToggle }: {
  s: MiningStock; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="panel overflow-hidden mb-2">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {/* Category chip */}
        <span className="text-[8px] px-1.5 py-0.5 rounded font-bold shrink-0"
          style={{ background: CAT_COLOR[s.category] + "22", color: CAT_COLOR[s.category] }}>
          {CAT_LABEL[s.category]}
        </span>
        {/* Symbol + name */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black" style={{ color: "#f5c451" }}>{s.symbol}</div>
          <div className="text-[8px] truncate" style={{ color: "rgba(175,185,215,0.4)" }}>{s.nameTh}</div>
        </div>
        {/* Price */}
        <div className="text-right shrink-0 mr-2">
          <div className="text-xs font-mono font-bold" style={{ color: "rgba(175,185,215,0.9)" }}>
            ${s.price.toFixed(2)}
          </div>
          <ChangeChip val={s.change1d} />
        </div>
        {/* Signal badge */}
        <span className="text-[8px] px-2 py-1 rounded-lg font-bold shrink-0"
          style={{ background: s.signalColor + "22", color: s.signalColor, border: `1px solid ${s.signalColor}44` }}>
          {s.signal.toUpperCase()}
        </span>
        <span className="text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="grid grid-cols-3 gap-3 mt-3 mb-3">
            <div>
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>1 สัปดาห์</div>
              <ChangeChip val={s.change1w} />
            </div>
            <div>
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>1 เดือน</div>
              <ChangeChip val={s.change1m} />
            </div>
            <div>
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>vs Gold (ratio)</div>
              <span className="text-[9px] font-mono" style={{ color: "#c084fc" }}>{s.goldRatio.toFixed(3)}</span>
            </div>
          </div>
          <div className="mb-2">
            <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Beta ต่อทอง (leverage)</div>
            <BetaBar beta={s.betaToGold} />
          </div>
          <div className="flex gap-4 text-[8px]">
            <div>
              <span style={{ color: "rgba(175,185,215,0.3)" }}>Market Cap: </span>
              <span style={{ color: "rgba(175,185,215,0.7)" }}>${s.marketCapBillion}B</span>
            </div>
            <div>
              <span style={{ color: "rgba(175,185,215,0.3)" }}>ผลผลิต: </span>
              <span style={{ color: "rgba(175,185,215,0.7)" }}>{s.productionTh}</span>
            </div>
          </div>
          <div className="mt-2 text-[10px]" style={{ color: s.signalColor }}>
            {s.signalTh}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MiningStocksPage() {
  const [data, setData]       = useState<MiningStocksPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [open, setOpen]       = useState<Record<string, boolean>>({});
  const [filter, setFilter]   = useState<"all" | "etf" | "major" | "mid" | "royalty">("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/mining-stocks", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (sym: string) => setOpen(p => ({ ...p, [sym]: !p[sym] }));

  const filtered = data?.stocks.filter(s => filter === "all" || s.category === filter) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="⛏ Gold Mining Stocks"
        subtitle="GDX, GDXJ, NEM, Barrick — ติดตามหุ้นทองและ ETF เทียบกับราคาทอง XAUUSD"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            ⛏ กำลังโหลดข้อมูลหุ้นทอง…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Sector overview */}
          <div className="panel px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Gold สัปดาห์นี้
                </div>
                <div className="text-xl font-black" style={{ color: "#f5c451" }}>
                  ${data.goldPrice.toLocaleString()}
                </div>
                <div className="flex gap-3 text-xs mt-1">
                  <ChangeChip val={data.goldChange1d} />
                  <span style={{ color: "rgba(175,185,215,0.3)" }}>วันนี้</span>
                  <ChangeChip val={data.goldChange1w} />
                  <span style={{ color: "rgba(175,185,215,0.3)" }}>สัปดาห์</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Sector Bias</div>
                <div className="text-sm font-black px-3 py-1.5 rounded-xl"
                  style={{ background: data.sectorBiasColor + "22", color: data.sectorBiasColor, border: `1px solid ${data.sectorBiasColor}55` }}>
                  {data.sectorBias.toUpperCase()}
                </div>
              </div>
            </div>
            <p className="text-[10px] mt-2" style={{ color: "rgba(175,185,215,0.5)" }}>{data.sectorBiasTh}</p>
          </div>

          {/* GDX vs GDXJ relative to gold */}
          <div className="grid grid-cols-2 gap-3">
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>GDX vs Gold (1W)</div>
              <div className="text-lg font-black"
                style={{ color: data.gdxVsGold >= 0 ? "#34d399" : "#f87171" }}>
                {data.gdxVsGold >= 0 ? "+" : ""}{data.gdxVsGold}%
              </div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                {data.gdxVsGold >= 0 ? "Outperform ทอง" : "Underperform ทอง"}
              </div>
            </div>
            <div className="panel px-4 py-3">
              <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>GDXJ vs Gold (1W)</div>
              <div className="text-lg font-black"
                style={{ color: data.gdxjVsGold >= 0 ? "#34d399" : "#f87171" }}>
                {data.gdxjVsGold >= 0 ? "+" : ""}{data.gdxjVsGold}%
              </div>
              <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                {data.gdxjVsGold >= 0 ? "Junior miners ชนะทอง" : "Junior miners แพ้ทอง"}
              </div>
            </div>
          </div>

          {/* Top/Bottom */}
          <div className="grid grid-cols-2 gap-3">
            <div className="panel px-4 py-3" style={{ borderLeft: "3px solid #34d399" }}>
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Best 1W</div>
              <div className="text-sm font-black" style={{ color: "#34d399" }}>{data.topPerformer}</div>
            </div>
            <div className="panel px-4 py-3" style={{ borderLeft: "3px solid #f87171" }}>
              <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Worst 1W</div>
              <div className="text-sm font-black" style={{ color: "#f87171" }}>{data.bottomPerformer}</div>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "etf", "major", "mid", "royalty"] as const).map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className="px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all"
                style={{
                  background: filter === c ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filter === c ? "rgba(245,196,81,0.5)" : "rgba(255,255,255,0.06)"}`,
                  color: filter === c ? "#f5c451" : "rgba(175,185,215,0.5)",
                }}>
                {c === "all" ? "ทั้งหมด" : CAT_LABEL[c]}
              </button>
            ))}
          </div>

          {/* Stock list */}
          <div>
            {filtered.map(s => (
              <StockRow key={s.symbol} s={s} expanded={!!open[s.symbol]} onToggle={() => toggle(s.symbol)} />
            ))}
          </div>

          {/* Education note */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 Mining Stocks vs Gold
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ หุ้นทองมี Beta สูงกว่าทอง — ทองขึ้น 1% หุ้นทองอาจขึ้น 1.5-2.5%</li>
              <li>→ GDX = หุ้นทองขนาดใหญ่ (Newmont, Barrick) | GDXJ = ขนาดกลาง</li>
              <li>→ Royalty (FNV, WPM) = Beta ต่ำกว่า ความเสี่ยงต่ำกว่า แต่ upside น้อยกว่า</li>
              <li>→ ในตลาด Risk-off: หุ้นทองมักตามทองขึ้น แต่หากหุ้นตลาดลงด้วย หุ้นทองอาจลงมากกว่า</li>
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
