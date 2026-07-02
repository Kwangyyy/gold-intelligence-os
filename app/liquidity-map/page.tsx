"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { LiquidityMapPayload, SpreadEstimate, LiquiditySession } from "@/app/api/liquidity-map/route";

const QUALITY_COLOR: Record<string, string> = {
  excellent: "#34d399",
  good:      "#86efac",
  fair:      "#f5c451",
  poor:      "#f87171",
};

export default function LiquidityMapPage() {
  const [data, setData] = useState<LiquidityMapPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/liquidity-map", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5 * 60_000); return () => clearInterval(t); }, [load]);

  if (loading && !data) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Loading liquidity map…</div>
    </div>
  );
  if (!data) return null;

  const currentColor = QUALITY_COLOR[data.currentQuality] ?? "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="💧 Gold Liquidity Map"
        subtitle="Real-time bid-ask spreads and session activity — best times to trade"
      />

      {/* ── Live Status ───────────────────────────────────────── */}
      <div className="panel px-5 py-5">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="text-center">
            <div className="text-3xl font-black" style={{ color: currentColor }}>
              ${data.currentSpread.toFixed(2)}
            </div>
            <div className="text-[8px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
              Est. Spread ($/oz)
            </div>
          </div>
          <div className="h-12 w-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="text-center">
            <div className="text-3xl font-black" style={{ color: "#f5c451" }}>
              {data.currentVolumeIndex}
            </div>
            <div className="text-[8px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
              Volume Index
            </div>
          </div>
          <div className="h-12 w-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex-1 min-w-[120px]">
            <div className="text-[10px] font-black capitalize" style={{ color: currentColor }}>
              {data.currentQuality} liquidity
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>
              {data.activeSessions.length > 0
                ? `Active: ${data.activeSessions.join(", ")}`
                : "Between sessions"}
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
              Next best window: {data.bestEntryWindow}
            </div>
          </div>
        </div>
      </div>

      {/* ── 24H Spread Heatmap ────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🌐 24-Hour Spread Heatmap (UTC)
        </div>

        {/* Hour labels */}
        <div className="flex gap-px">
          {data.hourlySpreadMap.map((h: SpreadEstimate) => {
            const isCurrent = h.hour === data.currentHourUTC;
            const bg =
              h.quality === "excellent" ? "rgba(52,211,153,0.65)" :
              h.quality === "good"      ? "rgba(134,239,172,0.45)" :
              h.quality === "fair"      ? "rgba(245,196,81,0.35)" :
                                          "rgba(248,113,113,0.30)";
            return (
              <div key={h.hour}
                title={`${String(h.hour).padStart(2, "0")}:00 UTC · $${h.spreadDollar}/oz · ${h.quality} · ${h.session}`}
                className="flex-1 relative"
                style={{ height: "48px" }}>
                <div className="absolute inset-0 rounded-sm" style={{ background: bg }} />
                {isCurrent && (
                  <div className="absolute inset-0 rounded-sm" style={{
                    outline: "2px solid #f5c451",
                    outlineOffset: "-1px",
                    zIndex: 2,
                  }} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap text-[8px]">
          {["excellent", "good", "fair", "poor"].map(q => (
            <div key={q} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ background: QUALITY_COLOR[q] + "70" }} />
              <span style={{ color: QUALITY_COLOR[q] }}>{q}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sessions ──────────────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🕐 Market Sessions
        </div>
        {data.sessions.filter(s => s.name !== "London+NY Overlap").map((s: LiquiditySession) => (
          <div key={s.name} className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: s.currentlyOpen ? "rgba(245,196,81,0.04)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${s.currentlyOpen ? "rgba(245,196,81,0.2)" : "rgba(255,255,255,0.05)"}`,
            }}>
            <div className="text-xl shrink-0">{s.flag}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold" style={{ color: s.currentlyOpen ? "#f5c451" : "rgba(255,255,255,0.6)" }}>
                  {s.name}
                </span>
                {s.currentlyOpen && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>LIVE</span>
                )}
              </div>
              <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>
                {String(s.openUTC).padStart(2,"0")}:00–{String(s.closeUTC).padStart(2,"0")}:00 UTC · Best: {s.bestTradingHours}
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-[9px] font-black" style={{ color: QUALITY_COLOR[s.typicalSpread <= 0.12 ? "excellent" : s.typicalSpread <= 0.20 ? "good" : "fair"] }}>
                ${s.typicalSpread}/oz
              </div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>avg spread</div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-[9px] font-black" style={{ color: "#f5c451" }}>
                {s.typicalVolume}
              </div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>vol index</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Scheduled Events ─────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📅 Key Liquidity Events
        </div>
        {data.scheduledEvents.map(ev => (
          <div key={ev.label} className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-base shrink-0">
              {ev.impactOnLiquidity === "improves" ? "🟢" : "🔴"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{ev.label}</div>
              <div className="text-[8px] mt-0.5" style={{ color: "#f5c451" }}>{ev.time}</div>
              <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{ev.description}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Spread estimates from LBMA/COMEX historical averages · Auto-refreshes every 5 min
      </div>
    </div>
  );
}
