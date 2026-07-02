"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { GoldCurrenciesPayload, CurrencyGold } from "@/app/api/gold-currencies/route";

function ChangeCell({ val, suffix = "%" }: { val: number; suffix?: string }) {
  const c = val >= 0.05 ? "#34d399" : val <= -0.05 ? "#f87171" : "#9ca3af";
  return (
    <span className="text-[8px] font-bold" style={{ color: c }}>
      {val >= 0 ? "+" : ""}{val.toFixed(2)}{suffix}
    </span>
  );
}

export default function GoldCurrenciesPage() {
  const { tier } = useTier();
  const [data, setData] = useState<GoldCurrenciesPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/gold-currencies", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/gold-currencies")) {
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
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Loading gold in currencies…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="💱 Gold in Currencies"
        subtitle="Gold priced in USD, EUR, GBP, JPY, CHF, AUD, CNY — identifies currency-driven vs true gold moves"
      />

      {/* ── Currency Signal Banner ─── */}
      <div className="panel px-5 py-4 space-y-2"
        style={{ border: data.currencyDrivenMove ? "1px solid rgba(192,132,252,0.3)" : "1px solid rgba(52,211,153,0.2)" }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{data.currencyDrivenMove ? "💱" : "🌍"}</span>
          <div className="text-[9px] font-bold" style={{ color: data.currencyDrivenMove ? "#c084fc" : "#34d399" }}>
            {data.currencyDrivenMove ? "Currency-Driven Move" : "Universal Gold Move"}
          </div>
        </div>
        <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.analysis}</div>
      </div>

      {/* ── Quick Stats ─── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="panel px-4 py-3 space-y-1">
          <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Weakest Currency vs Gold</div>
          <div className="text-xl font-black" style={{ color: "#f87171" }}>{data.weakestCurrency}</div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>Gold rising most in this currency</div>
        </div>
        <div className="panel px-4 py-3 space-y-1">
          <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Strongest Currency vs Gold</div>
          <div className="text-xl font-black" style={{ color: "#34d399" }}>{data.strongestCurrency}</div>
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>Gold rising least in this currency</div>
        </div>
      </div>

      {/* ── Currency Table ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🌐 Gold Price in 7 Currencies
        </div>
        {/* Header */}
        <div className="grid grid-cols-12 gap-1 px-2 text-[7px] uppercase tracking-widest"
          style={{ color: "rgba(175,185,215,0.25)" }}>
          <div className="col-span-3">Currency</div>
          <div className="col-span-3 text-right">Gold Price</div>
          <div className="col-span-2 text-right">1D %</div>
          <div className="col-span-2 text-right">1W %</div>
          <div className="col-span-2 text-right">1M %</div>
        </div>

        {data.currencies.map((c: CurrencyGold) => (
          <div key={c.code} className="grid grid-cols-12 gap-1 items-center rounded-xl px-3 py-3"
            style={{ background: c.code === "USD" ? "rgba(245,196,81,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${c.color}20` }}>
            <div className="col-span-3 flex items-center gap-2">
              <span className="text-base shrink-0">{c.flag}</span>
              <div>
                <div className="text-[9px] font-bold" style={{ color: c.code === "USD" ? "#f5c451" : "rgba(255,255,255,0.65)" }}>{c.code}</div>
                <div className="text-[6px]" style={{ color: "rgba(175,185,215,0.3)" }}>{c.name}</div>
              </div>
            </div>
            <div className="col-span-3 text-right">
              <div className="text-[9px] font-black" style={{ color: c.color }}>
                {c.code === "JPY" || c.code === "CNY"
                  ? c.goldPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : c.goldPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
            </div>
            <div className="col-span-2 text-right"><ChangeCell val={c.change1DPct} /></div>
            <div className="col-span-2 text-right"><ChangeCell val={c.change1WPct} /></div>
            <div className="col-span-2 text-right"><ChangeCell val={c.change1MPct} /></div>
          </div>
        ))}
      </div>

      {/* ── Visual comparison bars ─── */}
      <div className="panel px-5 py-5 space-y-3">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📊 1-Day Change Comparison
        </div>
        {data.currencies.map((c: CurrencyGold) => {
          const barWidth = Math.min(Math.abs(c.change1DPct) * 30, 100);
          const barColor = c.change1DPct >= 0 ? "#34d399" : "#f87171";
          return (
            <div key={c.code} className="flex items-center gap-3">
              <div className="w-8 text-[8px] font-bold shrink-0 text-right" style={{ color: "rgba(255,255,255,0.5)" }}>{c.flag}</div>
              <div className="w-8 text-[7px] shrink-0" style={{ color: "rgba(175,185,215,0.4)" }}>{c.code}</div>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: barColor + "70" }} />
              </div>
              <ChangeCell val={c.change1DPct} />
            </div>
          );
        })}
      </div>

      {/* ── Education ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          📚 How to Use Multi-Currency Gold
        </div>
        {[
          { tip: "If gold rises in all currencies equally", meaning: "True gold demand — buy the trend with confidence" },
          { tip: "If gold rises only in USD", meaning: "Dollar weakness is driving it — a weaker USD confirms gold but isn't 'pure' demand" },
          { tip: "Gold strong in JPY and EUR but flat in USD", meaning: "Dollar relative strength — watch for catch-up in USD gold" },
          { tip: "Weakest currency", meaning: "Highest gold price gain in that currency — largest currency depreciation vs gold" },
        ].map(item => (
          <div key={item.tip} className="flex gap-2 text-[8px]">
            <span className="font-bold shrink-0" style={{ color: "#f5c451" }}>→</span>
            <div>
              <span className="font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{item.tip}: </span>
              <span style={{ color: "rgba(175,185,215,0.4)" }}>{item.meaning}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · FX from Yahoo Finance · Not financial advice · Updates every 15 min
      </div>
    </div>
  );
}
