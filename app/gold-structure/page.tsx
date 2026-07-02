"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { GoldStructurePayload, StructureLevel, PriceZone } from "@/app/api/gold-structure/route";

const TYPE_LABEL: Record<StructureLevel["type"], string> = {
  all_time_high: "All-Time High",
  major_resistance: "Major Resistance",
  major_support: "Major Support",
  psychological: "Psychological",
  yearly: "Annual Pivot",
  decade: "Decade Level",
};

const TYPE_ICON: Record<StructureLevel["type"], string> = {
  all_time_high: "👑",
  major_resistance: "🔴",
  major_support: "🟢",
  psychological: "💯",
  yearly: "📅",
  decade: "🏛️",
};

const SIG_COLOR: Record<StructureLevel["significance"], string> = {
  critical: "#f5c451",
  high: "#c084fc",
  moderate: "rgba(175,185,215,0.4)",
};

const BIAS_LABEL = { bullish: "Structurally Bullish", neutral: "Neutral Structure", bearish: "Structurally Bearish" };

export default function GoldStructurePage() {
  const { tier } = useTier();
  const [data, setData] = useState<GoldStructurePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/gold-structure", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/gold-structure")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Premium tier required</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Mapping structural levels…</div>
    </div>
  );
  if (!data) return null;

  const resistance = data.levels.filter(l => l.direction === "above");
  const support = data.levels.filter(l => l.direction === "below");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="🏗️ Gold Price Structure"
        subtitle="Key historical levels, psychological round numbers, and multi-year pivots"
      />

      {/* ── Structure Bias ─── */}
      <div className="panel px-5 py-4 flex items-center gap-5"
        style={{ border: `1px solid ${data.structureBiasColor}30`, background: data.structureBiasColor + "06" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: data.structureBiasColor + "18", border: `2px solid ${data.structureBiasColor}40` }}>
          {data.structureBias === "bullish" ? "🐂" : data.structureBias === "bearish" ? "🐻" : "⚖️"}
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Structural Bias</div>
          <div className="text-base font-black" style={{ color: data.structureBiasColor }}>{BIAS_LABEL[data.structureBias]}</div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.structureNote}</div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Current</div>
          <div className="text-xl font-black" style={{ color: "#f5c451" }}>${data.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>{data.pctFromATH >= 0 ? "AT ATH" : `${Math.abs(data.pctFromATH).toFixed(1)}% from ATH`}</div>
        </div>
      </div>

      {/* ── Next Key Levels ─── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="panel px-4 py-4 space-y-1">
          <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Next Major Resistance</div>
          <div className="text-xl font-black" style={{ color: "#f87171" }}>${data.nextMajorTarget.toLocaleString()}</div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            {data.nearestResistance ? `${data.nearestResistance.distance.toFixed(1)}% above — ${data.nearestResistance.label}` : "—"}
          </div>
        </div>
        <div className="panel px-4 py-4 space-y-1">
          <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Next Major Support</div>
          <div className="text-xl font-black" style={{ color: "#34d399" }}>${data.nextMajorSupport.toLocaleString()}</div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            {data.nearestSupport ? `${Math.abs(data.nearestSupport.distance).toFixed(1)}% below — ${data.nearestSupport.label}` : "—"}
          </div>
        </div>
      </div>

      {/* ── Resistance Levels ─── */}
      {resistance.length > 0 && (
        <div className="panel px-5 py-5 space-y-2">
          <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
            🔴 Resistance Levels Above (${data.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })})
          </div>
          {resistance.map(lv => (
            <LevelRow key={lv.price} lv={lv} />
          ))}
        </div>
      )}

      {/* ── Support Levels ─── */}
      {support.length > 0 && (
        <div className="panel px-5 py-5 space-y-2">
          <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
            🟢 Support Levels Below (${data.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })})
          </div>
          {support.map(lv => (
            <LevelRow key={lv.price} lv={lv} />
          ))}
        </div>
      )}

      {/* ── Key Zones ─── */}
      {data.zones.length > 0 && (
        <div className="panel px-5 py-5 space-y-3">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
            📦 Key Price Zones
          </div>
          {data.zones.map((z: PriceZone) => {
            const zColor = z.type === "resistance_zone" ? "#f87171" : "#34d399";
            return (
              <div key={`${z.from}-${z.to}`} className="rounded-xl px-4 py-3"
                style={{ background: zColor + "08", border: `1px solid ${zColor}20` }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[9px] font-bold" style={{ color: zColor }}>
                    ${z.from.toLocaleString()} – ${z.to.toLocaleString()}
                  </span>
                  <span className="text-[7px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ color: zColor, background: zColor + "18", border: `1px solid ${zColor}30` }}>
                    {z.strength} {z.type === "resistance_zone" ? "resistance" : "support"}
                  </span>
                </div>
                <div className="text-[7px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>{z.description}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Psychological Note ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>💯 Psychological Level Theory</div>
        <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.psychologicalNote}</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[
            { rule: "Price approaches round number from below", action: "Expect resistance — position for bounce or breakout confirmation" },
            { rule: "Price holds above round number", action: "Round number flipped to support — bullish structural signal" },
            { rule: "Price breaks below round number", action: "Support lost — next key level becomes target, round number is now resistance" },
            { rule: "ATH zone re-tested", action: "Bulls defending ATH is extremely bullish; failure creates double-top risk" },
          ].map(item => (
            <div key={item.rule} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[7px] font-bold mb-0.5" style={{ color: "#c084fc" }}>{item.rule}</div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.4)" }}>{item.action}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · GC=F (10Y monthly) · Structural levels based on historical data · Not financial advice
      </div>
    </div>
  );
}

function LevelRow({ lv }: { lv: StructureLevel }) {
  const sigColor = SIG_COLOR[lv.significance];
  const dirColor = lv.direction === "above" ? "#f87171" : "#34d399";
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{ background: dirColor + "05", border: `1px solid ${dirColor}15` }}>
      <span className="text-base">{TYPE_ICON[lv.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-black" style={{ color: "#f5c451" }}>
            ${lv.price.toLocaleString()}
          </span>
          <span className="text-[7px] px-1.5 py-0.5 rounded-full"
            style={{ color: sigColor, background: sigColor + "15", border: `1px solid ${sigColor}30` }}>
            {lv.significance}
          </span>
          <span className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>{TYPE_LABEL[lv.type]}</span>
          {lv.yearAchieved && (
            <span className="text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>{lv.yearAchieved}</span>
          )}
        </div>
        <div className="text-[7px] truncate" style={{ color: "rgba(175,185,215,0.35)" }}>{lv.description}</div>
      </div>
      <div className="text-[9px] font-black shrink-0" style={{ color: dirColor }}>
        {lv.direction === "above" ? "+" : ""}{lv.distance.toFixed(1)}%
      </div>
    </div>
  );
}
