"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MacroCell, MacroHeatPayload } from "@/app/api/macro-heat/route";

const CATEGORY_ICONS: Record<MacroCell["category"], string> = {
  currency:   "💱",
  rate:       "📉",
  equity:     "📈",
  commodity:  "🪙",
  crypto:     "₿",
  volatility: "😱",
};

function ChangeCell({ val }: { val: number }) {
  const color = val > 1.5 ? "#34d399" : val > 0.3 ? "#86efac" : val > -0.3 ? "rgba(175,185,215,0.4)" : val > -1.5 ? "#fca5a5" : "#f87171";
  return (
    <span className="text-[9px] font-bold tabular-nums" style={{ color }}>
      {val >= 0 ? "+" : ""}{val.toFixed(2)}%
    </span>
  );
}

function HeatRow({ c }: { c: MacroCell }) {
  const impactColor = c.goldImpact === "bullish" ? "#34d399" : c.goldImpact === "bearish" ? "#f87171" : "rgba(175,185,215,0.3)";
  const isGold = c.symbol === "GC=F";
  return (
    <div
      className="rounded-xl px-4 py-3 transition-all"
      style={{
        background: isGold ? "rgba(245,196,81,0.06)" : c.heatColor,
        border: isGold ? "1px solid rgba(245,196,81,0.2)" : "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-base w-5 text-center">{CATEGORY_ICONS[c.category]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold" style={{ color: isGold ? "#f5c451" : "rgba(255,255,255,0.75)" }}>
              {c.nameTh}
            </span>
            {isGold && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(245,196,81,0.15)", color: "#f5c451" }}>GOLD</span>}
          </div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{c.goldImpactTh}</div>
        </div>
        <div className="text-right space-y-0.5">
          <div className="text-[10px] font-black" style={{ color: isGold ? "#f5c451" : "rgba(255,255,255,0.7)" }}>
            {c.price.toLocaleString()}
          </div>
          <ChangeCell val={c.change1d} />
        </div>
        <div className="hidden sm:flex flex-col gap-0.5 text-right pl-2 border-l" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex gap-2 text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
            <span>1W</span>
            <ChangeCell val={c.change1w} />
          </div>
          <div className="flex gap-2 text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>
            <span>1M</span>
            <ChangeCell val={c.change1m} />
          </div>
        </div>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: impactColor }} />
      </div>
    </div>
  );
}

function CompactMatrix({ cells }: { cells: MacroCell[] }) {
  const periods: Array<{ key: keyof MacroCell; label: string }> = [
    { key: "change1d", label: "1D" },
    { key: "change1w", label: "1W" },
    { key: "change1m", label: "1M" },
  ];

  function cellBg(val: number, isInverse: boolean): string {
    const adj = isInverse ? -val : val;
    if (adj >  3) return "#34d39940";
    if (adj >  1) return "#34d39920";
    if (adj >  0.3) return "#34d39910";
    if (adj > -0.3) return "transparent";
    if (adj > -1) return "#f8717110";
    if (adj > -3) return "#f8717120";
    return "#f8717140";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[9px]">
        <thead>
          <tr>
            <th className="text-left pb-1 pr-2" style={{ color: "rgba(175,185,215,0.3)", fontWeight: 500 }}>Asset</th>
            {periods.map(p => (
              <th key={p.key} className="pb-1 px-1 text-center" style={{ color: "rgba(175,185,215,0.3)", fontWeight: 500 }}>{p.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map(c => (
            <tr key={c.symbol}>
              <td className="pr-2 py-1 text-[9px]" style={{ color: "rgba(175,185,215,0.55)" }}>{c.nameTh}</td>
              {periods.map(p => {
                const val = c[p.key] as number;
                const isInverse = c.goldRelation === "negative";
                return (
                  <td key={p.key} className="px-1 py-1 text-center rounded" style={{ background: cellBg(val, isInverse) }}>
                    <span className="tabular-nums font-bold" style={{ color: val >= 0 ? "#34d399" : "#f87171" }}>
                      {val >= 0 ? "+" : ""}{val.toFixed(1)}%
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MacroHeatPage() {
  const [data, setData]       = useState<MacroHeatPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [view, setView]       = useState<"list" | "matrix">("list");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/macro-heat", { cache: "no-store" });
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
        title="🌡️ Macro Heat Map"
        subtitle="ตารางปัจจัย Macro แบบ real-time — ผลกระทบต่อทองคำในมุมมองรวม"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🌡️ กำลังโหลด Macro data…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Composite */}
          <div className="panel px-5 py-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Macro Gold Score</div>
                <div className="text-4xl font-black" style={{ color: data.compositeColor }}>{data.compositeScore}/100</div>
                <div className="text-xs mt-1 font-bold" style={{ color: data.compositeColor }}>{data.compositeTh}</div>
              </div>
              <div className="text-right">
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>🪙 Gold</div>
                <div className="text-2xl font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
                <div className="text-[8px] mt-2">
                  <span className="text-green-400 font-bold">{data.cells.filter(c => c.goldImpact === "bullish" && c.symbol !== "GC=F").length} Bullish</span>
                  {" · "}
                  <span className="text-yellow-400">{data.cells.filter(c => c.goldImpact === "neutral" && c.symbol !== "GC=F").length} Neutral</span>
                  {" · "}
                  <span className="text-red-400">{data.cells.filter(c => c.goldImpact === "bearish" && c.symbol !== "GC=F").length} Bearish</span>
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-full" style={{ width: `${data.compositeScore}%`, background: `linear-gradient(90deg, ${data.compositeColor}60, ${data.compositeColor})` }} />
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-1">
            {(["list", "matrix"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all"
                style={{
                  background: view === v ? "rgba(245,196,81,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${view === v ? "rgba(245,196,81,0.4)" : "rgba(255,255,255,0.06)"}`,
                  color: view === v ? "#f5c451" : "rgba(175,185,215,0.4)",
                }}>
                {v === "list" ? "📋 รายการ" : "🌡️ Matrix"}
              </button>
            ))}
          </div>

          {view === "list" ? (
            <div className="space-y-2">
              {data.cells.map(c => <HeatRow key={c.symbol} c={c} />)}
            </div>
          ) : (
            <div className="panel px-5 py-4">
              <CompactMatrix cells={data.cells} />
            </div>
          )}

          {/* Key */}
          <div className="flex gap-4 text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-400" /> ส่งผล Bullish ต่อทอง</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-400" /> Neutral</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-400" /> ส่งผล Bearish ต่อทอง</div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ ข้อมูล Yahoo Finance (1D lag) | {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
