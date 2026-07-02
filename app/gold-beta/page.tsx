"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { GoldBetaPayload, BetaEntry } from "@/app/api/gold-beta/route";

function BetaBar({ beta, maxBeta = 3 }: { beta: number; maxBeta?: number }) {
  const pct = Math.min(Math.abs(beta) / maxBeta * 100, 100);
  const color = beta < 0 ? "#f87171" : beta > 1.5 ? "#c084fc" : beta > 0.8 ? "#34d399" : "#f5c451";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color + "80" }} />
      </div>
      <span className="text-[8px] font-black w-8 text-right" style={{ color }}>{beta.toFixed(2)}</span>
    </div>
  );
}

function CorrBar({ corr }: { corr: number }) {
  const pct = Math.abs(corr) * 100;
  const color = corr > 0.7 ? "#34d399" : corr > 0.3 ? "#f5c451" : corr < -0.3 ? "#f87171" : "#9ca3af";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color + "80" }} />
      </div>
      <span className="text-[8px] font-black w-8 text-right" style={{ color }}>{corr.toFixed(2)}</span>
    </div>
  );
}

export default function GoldBetaPage() {
  const { tier } = useTier();
  const [data, setData] = useState<GoldBetaPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/gold-beta", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/gold-beta")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Computing gold betas…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="⚡ Gold Beta & Proxies"
        subtitle="Rolling 30/90D beta and correlation vs gold for major assets"
      />

      {/* ── Summary ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="panel px-4 py-4 space-y-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Price</div>
          <div className="text-2xl font-black" style={{ color: "#f5c451" }}>
            ${data.goldPrice?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"}
          </div>
        </div>
        <div className="panel px-4 py-4 space-y-1">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold/Silver Ratio</div>
          <div className="text-2xl font-black" style={{ color: "#9ca3af" }}>
            {data.silverGoldRatio?.toFixed(1) ?? "—"}
          </div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            {(data.silverGoldRatio ?? 0) > 85 ? "High → silver cheap vs gold" : (data.silverGoldRatio ?? 0) < 65 ? "Low → silver expensive" : "Normal range"}
          </div>
        </div>
      </div>

      {/* ── Best Proxy / Hedge ────────────────────────────────── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          💡 Key Insights
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
            <div className="text-[7px]" style={{ color: "rgba(52,211,153,0.6)" }}>BEST PROXY</div>
            <div className="text-[9px] font-bold mt-0.5" style={{ color: "#34d399" }}>{data.bestProxy}</div>
          </div>
          <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
            <div className="text-[7px]" style={{ color: "rgba(248,113,113,0.6)" }}>BEST HEDGE</div>
            <div className="text-[9px] font-bold mt-0.5" style={{ color: "#f87171" }}>{data.bestHedge}</div>
          </div>
        </div>
        <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
          {data.hedgingInsight}
        </div>
      </div>

      {/* ── Beta Table ────────────────────────────────────────── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 Rolling Beta & Correlation vs Gold
        </div>

        {/* Header */}
        <div className="grid grid-cols-12 gap-1 px-2 text-[7px] uppercase tracking-widest"
          style={{ color: "rgba(175,185,215,0.25)" }}>
          <div className="col-span-4">Asset</div>
          <div className="col-span-3">Beta 30D / 90D</div>
          <div className="col-span-3">Corr 30D</div>
          <div className="col-span-2">Class</div>
        </div>

        {data.betaEntries.map((b: BetaEntry) => (
          <div key={b.symbol} className="rounded-xl px-3 py-3 grid grid-cols-12 gap-1 items-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="col-span-4 flex items-center gap-1.5">
              <span className="text-base shrink-0">{b.icon}</span>
              <div>
                <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {b.symbol}
                </div>
                <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                  {b.interpretation.split("—")[0]}
                </div>
              </div>
            </div>
            <div className="col-span-3 space-y-0.5">
              <BetaBar beta={b.beta30D} />
              <div className="text-[6px]" style={{ color: "rgba(175,185,215,0.25)" }}>
                90D: {b.beta90D.toFixed(2)}
              </div>
            </div>
            <div className="col-span-3">
              <CorrBar corr={b.correlation30D} />
            </div>
            <div className="col-span-2">
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>
                {b.assetClass}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Beta Interpretation ───────────────────────────────── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
          📚 Beta Guide
        </div>
        {[
          { range: "β > 1.5",    color: "#c084fc", desc: "Amplified — miners (GDX/GDXJ) move 1.5–2.5× gold moves, with additional volatility" },
          { range: "β ≈ 0.8–1.1",color: "#34d399", desc: "Proxy — GLD/IAU track gold closely with minimal tracking error" },
          { range: "β ≈ 0–0.5",  color: "#f5c451", desc: "Partial — moves somewhat with gold, but weaker sensitivity" },
          { range: "β < 0",      color: "#f87171", desc: "Inverse — TLT/bonds show negative beta (rising yields hurt gold, rising bond prices help)" },
        ].map(item => (
          <div key={item.range} className="flex items-center gap-3 text-[8px]">
            <span className="font-black w-16 shrink-0" style={{ color: item.color }}>{item.range}</span>
            <span style={{ color: "rgba(175,185,215,0.45)" }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · Computed from live Yahoo Finance closes · 30D/90D windows
      </div>
    </div>
  );
}
