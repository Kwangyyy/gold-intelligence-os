"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useTier, canAccess } from "@/lib/tier";
import type { MomentumCompositePayload, MomentumFactor, TimeframeScore } from "@/app/api/momentum-composite/route";

const SIG_LABEL = {
  strong_bull: "Strong Bull",
  bull: "Bullish",
  neutral: "Neutral",
  bear: "Bearish",
  strong_bear: "Strong Bear",
};

const ACC_LABEL = {
  accelerating: "⬆ Accelerating",
  stable: "→ Stable",
  decelerating: "⬇ Decelerating",
};

export default function MomentumCompositePage() {
  const { tier } = useTier();
  const [data, setData] = useState<MomentumCompositePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/momentum-composite", { cache: "no-store" });
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canAccess(tier, "/momentum-composite")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <div className="text-sm font-bold" style={{ color: "#f5c451" }}>Pro tier required</div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>Computing momentum composite…</div>
    </div>
  );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="📡 Momentum Composite"
        subtitle="Multi-factor momentum: RSI, MACD, ROC, EMA alignment, 52W position — across short/medium/long-term"
      />

      {/* ── Composite Score ─── */}
      <div className="panel px-5 py-5 flex items-center gap-5"
        style={{ border: `1px solid ${data.compositeColor}30`, background: data.compositeColor + "05" }}>
        <div className="text-center shrink-0 w-28">
          <div className="text-4xl font-black" style={{ color: data.compositeColor }}>{data.compositeScore}</div>
          <div className="text-[7px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>/ 100</div>
          <div className="text-[10px] font-black uppercase mt-1" style={{ color: data.compositeColor }}>{data.compositeLabel}</div>
          <div className="h-2 rounded-full mt-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full rounded-full" style={{ width: `${data.compositeScore}%`, background: data.compositeColor + "90" }} />
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>
            {data.compositeDescription}
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="text-[7px] px-2 py-1 rounded-full"
              style={{ color: data.accelerationColor, background: data.accelerationColor + "15", border: `1px solid ${data.accelerationColor}30` }}>
              {ACC_LABEL[data.accelerationSignal]} ({data.acceleration >= 0 ? "+" : ""}{data.acceleration.toFixed(1)}%)
            </div>
            <div className="text-[7px] px-2 py-1 rounded-full"
              style={{ color: data.overboughtColor, background: data.overboughtColor + "15", border: `1px solid ${data.overboughtColor}30` }}>
              {data.overboughtOversold === "overbought" ? "Overbought" : data.overboughtOversold === "oversold" ? "Oversold" : "Neutral Zone"}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.3)" }}>Gold</div>
          <div className="text-lg font-black" style={{ color: "#f5c451" }}>
            ${data.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* ── Timeframe Breakdown ─── */}
      <div className="grid grid-cols-3 gap-3">
        {data.timeframes.map((tf: TimeframeScore) => (
          <div key={tf.label} className="panel px-4 py-4 space-y-1 text-center">
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>{tf.label}</div>
            <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.25)" }}>{tf.period}</div>
            <div className="text-2xl font-black" style={{ color: tf.color }}>{tf.score}</div>
            <div className="text-[7px] font-bold uppercase tracking-wide" style={{ color: tf.color }}>{SIG_LABEL[tf.signal]}</div>
            <div className="text-[6px]" style={{ color: "rgba(175,185,215,0.3)" }}>{tf.description}</div>
          </div>
        ))}
      </div>

      {/* ── Factor Breakdown ─── */}
      <div className="panel px-5 py-5 space-y-2.5">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
          🔬 Momentum Factors
        </div>
        {data.factors.map((f: MomentumFactor) => (
          <div key={f.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: f.color + "06", border: `1px solid ${f.color}15` }}>
            <div className="w-10 text-center shrink-0">
              <div className="text-[10px] font-black" style={{ color: f.color }}>{f.score}</div>
              <div className="text-[6px]" style={{ color: "rgba(175,185,215,0.25)" }}>w{f.weight}%</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[8px] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{f.name}</span>
                <span className="text-[6px] px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0"
                  style={{ color: f.color, background: f.color + "18", border: `1px solid ${f.color}25` }}>
                  {SIG_LABEL[f.signal]}
                </span>
              </div>
              <div className="h-1 rounded-full mb-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full" style={{ width: `${f.score}%`, background: f.color + "70" }} />
              </div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.35)" }}>{f.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── OB/OS Note ─── */}
      {data.overboughtOversold !== "neutral" && (
        <div className="panel px-5 py-4 space-y-1"
          style={{ border: `1px solid ${data.overboughtColor}25`, background: data.overboughtColor + "05" }}>
          <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: data.overboughtColor }}>
            {data.overboughtOversold === "overbought" ? "⚠ Overbought Warning" : "⬇ Oversold Opportunity"}
          </div>
          <div className="text-[8px] leading-relaxed" style={{ color: "rgba(175,185,215,0.5)" }}>{data.overboughtDesc}</div>
        </div>
      )}

      {/* ── Trading Bias ─── */}
      <div className="panel px-5 py-4 space-y-2">
        <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>🎯 Actionable Momentum Bias</div>
        <div className="text-[9px] leading-relaxed" style={{ color: "rgba(175,185,215,0.6)" }}>{data.tradingBias}</div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[
            { rule: "Score > 70 — Strong Bull", action: "Trend-following long. EMAs act as dynamic support. Add on dips to EMA20." },
            { rule: "Score 55-70 — Bullish", action: "Long bias with wider stops. Avoid shorting into momentum. Look for continuation setups." },
            { rule: "Score 45-55 — Neutral", action: "Reduce size, wait for directional momentum confirmation. Trade range or sit out." },
            { rule: "Score < 45 — Bearish", action: "Either short or reduce long exposure. Watch for RSI divergence as early reversal signal." },
          ].map(item => (
            <div key={item.rule} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[7px] font-bold mb-0.5" style={{ color: "#c084fc" }}>{item.rule}</div>
              <div className="text-[7px]" style={{ color: "rgba(175,185,215,0.4)" }}>{item.action}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[8px] text-right" style={{ color: "rgba(175,185,215,0.2)" }}>
        {new Date(data.timestamp).toLocaleString()} · GC=F 1Y daily · RSI/MACD/EMA/ROC computed · Not financial advice
      </div>
    </div>
  );
}
