"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MacroScenario, MacroScenarioPayload } from "@/app/api/macro-scenario/route";

const IMPACT_LABELS: Record<string, string> = {
  very_bullish: "Very Bullish 🚀",
  bullish:      "Bullish 📈",
  neutral:      "Neutral ➡️",
  bearish:      "Bearish 📉",
  very_bearish: "Very Bearish 💀",
};

function ProbabilityBar({ prob, color }: { prob: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full" style={{ width: `${prob}%`, background: color, opacity: 0.8 }} />
      </div>
      <span className="text-[9px] font-black w-8 text-right" style={{ color }}>{prob}%</span>
    </div>
  );
}

function ScenarioCard({ s, isBase, isSelected, onSelect }: {
  s: MacroScenario; isBase: boolean; isSelected: boolean; onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="rounded-xl px-4 py-4 cursor-pointer transition-all space-y-3"
      style={{
        background: isSelected ? `${s.goldImpactColor}08` : "rgba(255,255,255,0.02)",
        border: `1px solid ${isSelected ? s.goldImpactColor + "50" : "rgba(255,255,255,0.06)"}`,
        boxShadow: isSelected ? `0 0 12px ${s.goldImpactColor}15` : "none",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{s.icon}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>{s.nameTh}</span>
              {isBase && <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(245,196,81,0.2)", color: "#f5c451" }}>BASE</span>}
            </div>
            <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{s.timeframeTh}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] font-black" style={{ color: s.goldImpactColor }}>
            {IMPACT_LABELS[s.goldImpact]}
          </div>
        </div>
      </div>

      <ProbabilityBar prob={s.probability} color={s.goldImpactColor} />

      <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.5)" }}>{s.descriptionTh}</div>

      {isSelected && (
        <div className="space-y-2 border-t pt-3" style={{ borderColor: `${s.goldImpactColor}20` }}>
          {/* Price range */}
          <div className="flex justify-between items-center">
            <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>Gold Price Range</span>
            <span className="text-[10px] font-black" style={{ color: s.goldImpactColor }}>
              ${s.priceRangeLow.toLocaleString()} – ${s.priceRangeHigh.toLocaleString()}
            </span>
          </div>

          {/* Factors */}
          <div className="space-y-1">
            {s.factors.map(f => {
              const dirColor = f.direction === "up" ? "#34d399" : f.direction === "down" ? "#f87171" : "#9ca3af";
              const icon = f.direction === "up" ? "↑" : f.direction === "down" ? "↓" : "→";
              return (
                <div key={f.name} className="flex items-center gap-2 text-[8px]">
                  <span className="font-bold w-2" style={{ color: dirColor }}>{icon}</span>
                  <span style={{ color: "rgba(175,185,215,0.5)" }}>{f.nameTh}</span>
                  <span style={{ color: dirColor }}>{f.note}</span>
                </div>
              );
            })}
          </div>

          {/* Historical analog */}
          <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.12)" }}>
            <div className="text-[7px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(168,85,247,0.4)" }}>Historical Analog</div>
            <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.5)" }}>{s.historicalAnalogTh}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeightedTarget({ scenarios, current, weighted }: { scenarios: MacroScenario[]; current: number; weighted: number }) {
  const min = Math.min(...scenarios.map(s => s.priceRangeLow));
  const max = Math.max(...scenarios.map(s => s.priceRangeHigh));
  const range = max - min;
  const posW = ((weighted - min) / range) * 100;
  const posC = ((current - min) / range) * 100;

  return (
    <div className="space-y-2">
      <div className="relative h-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        {/* Green zone */}
        <div className="absolute inset-y-0" style={{ left: "50%", right: 0, background: "rgba(52,211,153,0.06)" }} />
        {/* Current price */}
        <div className="absolute top-0 bottom-0 w-1" style={{ left: `${posC}%`, background: "#f5c451", opacity: 0.9 }} />
        {/* Weighted target */}
        <div className="absolute top-0 bottom-0 w-1" style={{ left: `${posW}%`, background: "#818cf8" }} />
      </div>
      <div className="flex justify-between text-[8px]">
        <span style={{ color: "rgba(175,185,215,0.3)" }}>${min.toLocaleString()}</span>
        <div className="text-center space-y-0.5">
          <div><span style={{ color: "#f5c451" }}>⬛ Current</span> <span style={{ color: "#818cf8" }}>⬛ Weighted Target</span></div>
        </div>
        <span style={{ color: "rgba(175,185,215,0.3)" }}>${max.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function MacroScenarioPage() {
  const [data, setData]       = useState<MacroScenarioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [selected, setSelected] = useState<string | null>("soft_landing");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/macro-scenario", { cache: "no-store" });
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
        title="🎭 Macro Scenario Builder"
        subtitle="สถานการณ์ Macro และผลกระทบต่อทองคำ — กดเพื่อดูรายละเอียด"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            🎭 กำลังโหลด scenarios…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Summary */}
          <div className="panel px-5 py-5 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Now</div>
                <div className="text-xl font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Prob-Weighted Target</div>
                <div className="text-xl font-black" style={{ color: "#818cf8" }}>${data.weightedGoldTarget.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Scenarios</div>
                <div className="text-xl font-black" style={{ color: "#9ca3af" }}>{data.scenarios.length}</div>
              </div>
            </div>
            <WeightedTarget
              scenarios={data.scenarios}
              current={data.goldPrice}
              weighted={data.weightedGoldTarget}
            />
            <div className="text-[8px] text-center" style={{ color: "rgba(175,185,215,0.3)" }}>
              ⚠ Probability estimates สำหรับ educational purposes เท่านั้น — ไม่ใช่การพยากรณ์
            </div>
          </div>

          {/* Scenario cards */}
          <div className="space-y-3">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
              คลิกสถานการณ์เพื่อดูรายละเอียด
            </div>
            {data.scenarios
              .sort((a, b) => b.probability - a.probability)
              .map(s => (
                <ScenarioCard
                  key={s.id}
                  s={s}
                  isBase={s.id === data.baseCase}
                  isSelected={selected === s.id}
                  onSelect={() => setSelected(prev => prev === s.id ? null : s.id)}
                />
              ))}
          </div>

          {/* Probability total */}
          <div className="text-center text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            รวม Probability: {data.totalProbability}% | หมายเหตุ: ไม่ครบ 100% เนื่องจากยังมีสถานการณ์อื่น
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ Price ranges เป็นประมาณการ 3-24 เดือน | Gold: Yahoo Finance
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
