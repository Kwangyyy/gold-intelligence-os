"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { IntermarketHeatmapPayload, HeatmapCell } from "@/app/api/intermarket-heatmap/route";

const CATEGORY_LABELS: Record<string, { label: string; labelTh: string }> = {
  metal:     { label: "Metals",      labelTh: "โลหะ"        },
  equity:    { label: "Equities",    labelTh: "หุ้น"         },
  bond:      { label: "Bonds",       labelTh: "พันธบัตร"     },
  currency:  { label: "Currencies",  labelTh: "สกุลเงิน"     },
  commodity: { label: "Commodities", labelTh: "สินค้าโภคภัณฑ์" },
  crypto:    { label: "Crypto",      labelTh: "คริปโต"      },
};

function RetCell({ val, color }: { val: number; color: string }) {
  return (
    <div
      className="rounded text-center py-1.5 px-1"
      style={{ background: `${color}22`, minWidth: 52 }}
    >
      <span className="text-[10px] font-black" style={{ color }}>
        {val > 0 ? "+" : ""}{val.toFixed(2)}%
      </span>
    </div>
  );
}

function CorrBadge({ corr }: { corr: number | null }) {
  if (corr === null) return <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.2)" }}>—</span>;
  const color = corr > 0.5 ? "#34d399" : corr > 0.2 ? "#6ee7b7" : corr < -0.5 ? "#f87171" : corr < -0.2 ? "#f97316" : "rgba(175,185,215,0.3)";
  return (
    <span className="text-[9px] font-bold" style={{ color }}>
      {corr > 0 ? "+" : ""}{corr.toFixed(2)}
    </span>
  );
}

function AssetRow({ cell, isGold }: { cell: HeatmapCell; isGold: boolean }) {
  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-lg"
      style={{
        background: isGold ? "rgba(245,196,81,0.06)" : "rgba(255,255,255,0.02)",
        border: isGold ? "1px solid rgba(245,196,81,0.2)" : "1px solid transparent",
      }}
    >
      {/* Name */}
      <div className="w-28 min-w-0">
        <div className="text-[10px] font-bold truncate" style={{ color: isGold ? "#f5c451" : "rgba(175,185,215,0.8)" }}>
          {cell.nameTh}
        </div>
        <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{cell.name}</div>
      </div>
      {/* Price */}
      <div className="w-20 text-right">
        <span className="text-[10px] font-mono font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>
          {cell.currentPrice.toLocaleString()}
        </span>
      </div>
      {/* 1D */}
      <RetCell val={cell.ret1d} color={cell.color1d} />
      {/* 1W */}
      <RetCell val={cell.ret1w} color={cell.color1w} />
      {/* 1M */}
      <RetCell val={cell.ret1m} color={cell.color1m} />
      {/* Gold corr */}
      <div className="w-10 text-right">
        <CorrBadge corr={cell.goldCorr} />
      </div>
    </div>
  );
}

export default function IntermarketHeatmapPage() {
  const [data, setData]       = useState<IntermarketHeatmapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/intermarket-heatmap", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = data
    ? ["all", ...Array.from(new Set(data.cells.map(c => c.category)))]
    : ["all"];

  const filtered = data
    ? (activeCategory === "all" ? data.cells : data.cells.filter(c => c.category === activeCategory))
    : [];

  const riskColor = data?.riskOnOff === "risk_on" ? "#34d399" : data?.riskOnOff === "risk_off" ? "#f87171" : "#f5c451";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🌍 Intermarket Heat Map"
        subtitle="14 assets across metals, equities, bonds, currencies, commodities & crypto"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🌍 กำลังโหลด 14 สินทรัพย์…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Gold hero + Risk-On/Off */}
          <div className="grid grid-cols-2 gap-3">
            <div className="panel px-5 py-4">
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>🪙 Gold</div>
              <div className="text-2xl font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
              <div className="flex gap-3 mt-2 text-[10px] font-bold">
                <span style={{ color: data.goldRet1d >= 0 ? "#34d399" : "#f87171" }}>1D {data.goldRet1d > 0 ? "+" : ""}{data.goldRet1d}%</span>
                <span style={{ color: data.goldRet1w >= 0 ? "#34d399" : "#f87171" }}>1W {data.goldRet1w > 0 ? "+" : ""}{data.goldRet1w}%</span>
                <span style={{ color: data.goldRet1m >= 0 ? "#34d399" : "#f87171" }}>1M {data.goldRet1m > 0 ? "+" : ""}{data.goldRet1m}%</span>
              </div>
            </div>
            <div className="panel px-5 py-4" style={{ borderLeft: `3px solid ${riskColor}` }}>
              <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Risk Sentiment</div>
              <div className="text-sm font-black" style={{ color: riskColor }}>{data.riskOnOffTh}</div>
              <div className="text-[9px] mt-1.5 leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
                {data.riskSummaryTh}
              </div>
            </div>
          </div>

          {/* Category filter tabs */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: activeCategory === cat ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${activeCategory === cat ? "rgba(245,196,81,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: activeCategory === cat ? "#f5c451" : "rgba(175,185,215,0.4)",
                }}
              >
                {cat === "all" ? "ทั้งหมด" : CATEGORY_LABELS[cat]?.labelTh ?? cat}
              </button>
            ))}
          </div>

          {/* Header row */}
          <div className="flex items-center gap-3 px-3 text-[8px] uppercase tracking-wider" style={{ color: "rgba(175,185,215,0.25)" }}>
            <div className="w-28">สินทรัพย์</div>
            <div className="w-20 text-right">ราคา</div>
            <div className="w-14 text-center">1 วัน</div>
            <div className="w-14 text-center">1 สัปดาห์</div>
            <div className="w-14 text-center">1 เดือน</div>
            <div className="w-10 text-right">Corr🪙</div>
          </div>

          {/* Asset rows grouped by category */}
          <div className="space-y-1">
            {activeCategory === "all"
              ? Object.keys(CATEGORY_LABELS).map(cat => {
                  const group = filtered.filter(c => c.category === cat);
                  if (!group.length) return null;
                  return (
                    <div key={cat} className="mb-3">
                      <div className="text-[8px] uppercase tracking-widest px-3 mb-1" style={{ color: "rgba(175,185,215,0.2)" }}>
                        {CATEGORY_LABELS[cat]?.labelTh}
                      </div>
                      {group.map(cell => (
                        <AssetRow key={cell.symbol} cell={cell} isGold={cell.symbol === "GC%3DF"} />
                      ))}
                    </div>
                  );
                })
              : filtered.map(cell => (
                  <AssetRow key={cell.symbol} cell={cell} isGold={cell.symbol === "GC%3DF"} />
                ))
            }
          </div>

          {/* Legend */}
          <div className="panel px-5 py-3">
            <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.2)" }}>คำอธิบาย</div>
            <div className="flex flex-wrap gap-3 text-[9px]">
              {[
                { color: "#34d399", label: "> +3%" },
                { color: "#6ee7b7", label: "+1% ถึง +3%" },
                { color: "#a7f3d0", label: "0% ถึง +1%" },
                { color: "#fca5a5", label: "-1% ถึง 0%" },
                { color: "#f87171", label: "-3% ถึง -1%" },
                { color: "#ef4444", label: "< -3%" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ background: color }} />
                  <span style={{ color: "rgba(175,185,215,0.5)" }}>{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 ml-3">
                <span style={{ color: "rgba(175,185,215,0.5)" }}>Corr🪙 = สหสัมพันธ์กับทอง (ประวัติศาสตร์)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              {data.cells.length} สินทรัพย์ · อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
