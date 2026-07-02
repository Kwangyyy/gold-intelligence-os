"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { ETFPositioningPayload, GoldETFData } from "@/app/api/etf-positioning/route";

const TYPE_ICON: Record<GoldETFData["type"], string> = {
  physical: "🥇",
  miners: "⛏️",
  leveraged: "⚡",
};

const TYPE_COLOR: Record<GoldETFData["type"], string> = {
  physical: "#f5c451",
  miners: "#c084fc",
  leveraged: "#fb923c",
};

const BIAS_LABEL = {
  accumulation: "Accumulation",
  neutral: "Neutral",
  distribution: "Distribution",
};

export default function ETFPositioningPage() {
  const { tier } = useTier();
  const [data, setData] = useState<ETFPositioningPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "physical" | "miners" | "leveraged">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/etf-positioning", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/etf-positioning")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Loading ETF flow data…</div>
    </div>
  );
  if (!data) return null;

  const displayed = tab === "all" ? data.etfs : data.etfs.filter(e => e.type === tab);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="💹 Gold ETF Positioning"
        subtitle="Institutional flow signals from GLD, IAU, GDX, GDXJ and 5 more gold ETFs via volume analysis"
      />

      {/* ── Composite Signal ─── */}
      <div className="panel px-5 py-4 flex items-center gap-4"
        style={{ border: `1px solid ${data.compositeFlowColor}30`, background: data.compositeFlowColor + "05" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: data.compositeFlowColor + "18", border: `2px solid ${data.compositeFlowColor}40` }}>
          {data.compositeFlowSignal === "accumulation" ? "📥" : data.compositeFlowSignal === "distribution" ? "📤" : "📊"}
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Composite ETF Flow Signal</div>
          <div className="text-base font-black" style={{ color: data.compositeFlowColor }}>{data.compositeFlowLabel}</div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{data.compositeFlowDescription}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
          <div className="text-lg font-black" style={{ color: "#f5c451" }}>
            ${data.goldPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[7px]" style={{ color: data.goldChange1DPct >= 0 ? "#34d399" : "#f87171" }}>
            {data.goldChange1DPct >= 0 ? "+" : ""}{data.goldChange1DPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* ── Physical vs Miner Bias ─── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Physical Gold ETFs", sub: "GLD / IAU / SGOL / BAR", bias: data.physicalETFBias, color: data.physicalColor, icon: "🥇" },
          { label: "Gold Miner ETFs", sub: "GDX / GDXJ / RING", bias: data.minerETFBias, color: data.minerColor, icon: "⛏️" },
        ].map(b => (
          <div key={b.label} className="panel px-4 py-4 space-y-1"
            style={{ border: `1px solid ${b.color}25`, background: b.color + "05" }}>
            <div className="text-xl">{b.icon}</div>
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{b.label}</div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>{b.sub}</div>
            <div className="text-sm font-black" style={{ color: b.color }}>{BIAS_LABEL[b.bias]}</div>
          </div>
        ))}
      </div>

      {/* ── Leading Indicator Note ─── */}
      <div className="panel px-5 py-3 space-y-1">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>⚡ Miners vs Physical Lead/Lag</div>
        <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.leadingIndicatorNote}</div>
      </div>

      {/* ── Tab Filter ─── */}
      <div className="flex gap-2">
        {(["all", "physical", "miners", "leveraged"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-1 rounded-full text-[7px] uppercase tracking-wider transition-all capitalize"
            style={{
              background: tab === t ? "#f5c45118" : "rgba(255,255,255,0.03)",
              border: `1px solid ${tab === t ? "#f5c451" : "rgba(255,255,255,0.08)"}`,
              color: tab === t ? "#f5c451" : "rgba(175,185,215,0.4)",
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── ETF List ─── */}
      <div className="panel px-5 py-4 space-y-3">
        {displayed.map((etf: GoldETFData) => {
          const typeColor = TYPE_COLOR[etf.type];
          const rvBar = Math.min((etf.relativeVolume - 1) / 2, 1);
          const rvPct = Math.max(0, rvBar) * 100;
          return (
            <div key={etf.symbol} className="rounded-xl px-4 py-3"
              style={{ background: etf.flowColor + "06", border: `1px solid ${etf.flowColor}18` }}>
              <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  <span>{TYPE_ICON[etf.type]}</span>
                  <div>
                    <div className="text-[9px] font-black" style={{ color: typeColor }}>{etf.symbol}</div>
                    <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{etf.name}</div>
                  </div>
                  <span className="text-[6px] px-1.5 py-0.5 rounded-full" style={{ color: typeColor + "99", background: typeColor + "18" }}>
                    {etf.aum}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[7px] px-2 py-0.5 rounded-full font-bold"
                    style={{ color: etf.flowColor, background: etf.flowColor + "18", border: `1px solid ${etf.flowColor}30` }}>
                    {etf.flowLabel}
                  </span>
                  <div className="text-right">
                    <div className="text-[8px] font-black" style={{ color: etf.change1DPct >= 0 ? "#34d399" : "#f87171" }}>
                      {etf.change1DPct >= 0 ? "+" : ""}{etf.change1DPct.toFixed(2)}%
                    </div>
                    <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                      1M: {etf.change1MPct >= 0 ? "+" : ""}{etf.change1MPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                  <span>Volume: {etf.volume.toLocaleString()} shares</span>
                  <span>20D avg: {etf.avgVolume20D.toLocaleString()}</span>
                  <span style={{ color: etf.relativeVolume >= 1.3 ? etf.flowColor : "rgba(175,185,215,0.3)" }}>
                    {etf.relativeVolume.toFixed(2)}× avg
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[6px] w-14 shrink-0" style={{ color: "rgba(175,185,215,0.25)" }}>
                    {etf.relativeVolume > 1 ? "Above avg" : "Below avg"}
                  </div>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                    {rvPct > 0 && (
                      <div className="h-full rounded-full" style={{ width: `${rvPct}%`, background: etf.flowColor + "70" }} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Institutional Note ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>🏦 Institutional Interpretation</div>
        <p className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.institutionalNote}</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[
            { case: "GLD volume > 2× average + price rising", action: "Institutional accumulation confirmed. High-conviction buy signal. Often precedes 3-7% rally." },
            { case: "GDX volume spike before GLD", action: "Miners leading — sophisticated money positioning in gold exposure before spot moves. Bullish." },
            { case: "GLD outflows 3+ consecutive days", action: "ETF redemptions = physical gold returned to market. Bearish near-term. Watch for stabilization." },
            { case: "NUGT/JNUG volume spike", action: "Retail leveraged buying — often marks short-term tops. Contrarian bearish signal if extreme." },
          ].map(item => (
            <div key={item.case} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[7px] font-bold mb-0.5" style={{ color: "#c084fc" }}>{item.case}</div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.4)" }}>{item.action}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Volume vs 20D avg (flow proxy) · Not financial advice · Updates every 15 min
      </div>
    </div>
  );
}
