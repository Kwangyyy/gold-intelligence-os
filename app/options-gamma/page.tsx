"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface StrikeLevel {
  strike: number;
  callOI: number;
  putOI: number;
  netGamma: number;
  gammaDollars: number;
  isMaxPain: boolean;
  isMagnet: boolean;
  isWall: boolean;
}

interface KeyStrike {
  strike: number;
  role: string;
  note: string;
}

interface OptionsGammaData {
  spotPrice: number;
  maxPain: number;
  maxPainDistance: number;
  netDealerGamma: number;
  gammaFlipLevel: number;
  regime: "long_gamma" | "short_gamma";
  strikes: StrikeLevel[];
  keyStrikes: KeyStrike[];
  interpretation: string;
  expiryInfo: string;
  timestamp: string;
}

const REGIME_META = {
  long_gamma:  { label: "Long Gamma",  color: "#34d399", desc: "Dealers hedge by selling rallies & buying dips → dampens volatility" },
  short_gamma: { label: "Short Gamma", color: "#f87171", desc: "Dealers hedge by buying rallies & selling dips → amplifies moves" },
};

function OIBar({ call, put, max }: { call: number; put: number; max: number }) {
  const callW = (call / max) * 80;
  const putW  = (put  / max) * 80;
  return (
    <div className="flex items-center gap-1">
      <div className="flex justify-end" style={{ width: "80px" }}>
        <div className="h-1.5 rounded-l-sm" style={{ width: `${putW}px`, background: "#f87171" }} />
      </div>
      <div className="w-px h-2.5" style={{ background: "rgba(255,255,255,0.08)" }} />
      <div style={{ width: "80px" }}>
        <div className="h-1.5 rounded-r-sm" style={{ width: `${callW}px`, background: "#34d399" }} />
      </div>
    </div>
  );
}

export default function OptionsGammaPage() {
  const { t } = useI18n();
  const [data, setData] = useState<OptionsGammaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/options-gamma")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "rgba(175,185,215,0.4)" }}>Computing options gamma exposure…</div>
    </div>
  );
  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-sm" style={{ color: "#f87171" }}>Failed to load</div>
    </div>
  );

  const regimeMeta = REGIME_META[data.regime];
  const maxOI = Math.max(...data.strikes.map(s => Math.max(s.callOI, s.putOI)));
  const sortedStrikes = [...data.strikes].sort((a, b) => b.strike - a.strike);
  const mpDist = data.maxPainDistance;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black" style={{ color: "#f5c451" }}>{t("navOptionsGamma")}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
          Gold Options Gamma Exposure · Max Pain Analysis · Dealer Positioning · COMEX GC Options
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Spot Price",
            value: `$${data.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            color: "#f5c451",
          },
          {
            label: "Max Pain",
            value: `$${data.maxPain.toLocaleString()}`,
            sub: `${mpDist >= 0 ? "+" : ""}${mpDist.toFixed(2)}% from spot`,
            color: mpDist >= 0 ? "#34d399" : "#f87171",
          },
          {
            label: "Gamma Flip",
            value: `$${data.gammaFlipLevel.toLocaleString()}`,
            sub: data.spotPrice > data.gammaFlipLevel ? "Spot BELOW flip" : "Spot ABOVE flip",
            color: data.spotPrice > data.gammaFlipLevel ? "#f87171" : "#34d399",
          },
          {
            label: "Dealer Regime",
            value: regimeMeta.label,
            sub: data.netDealerGamma.toFixed(1) + " net gamma",
            color: regimeMeta.color,
          },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>{item.label}</div>
            <div className="text-sm font-black" style={{ color: item.color }}>{item.value}</div>
            {item.sub && <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{item.sub}</div>}
          </div>
        ))}
      </div>

      {/* Regime banner */}
      <div className="rounded-xl p-4" style={{ background: `rgba(${data.regime === "long_gamma" ? "52,211,153" : "248,113,113"},0.06)`, border: `1px solid rgba(${data.regime === "long_gamma" ? "52,211,153" : "248,113,113"},0.2)` }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl">{data.regime === "long_gamma" ? "😌" : "⚡"}</span>
          <div>
            <div className="text-xs font-bold" style={{ color: regimeMeta.color }}>{regimeMeta.label} Environment</div>
            <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{regimeMeta.desc}</div>
          </div>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.55)" }}>{data.interpretation}</p>
      </div>

      {/* Key strikes */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-[10px] font-bold px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.5)" }}>
          KEY GAMMA STRIKES
        </div>
        {data.keyStrikes.map((ks, i) => {
          const isAbove = ks.strike > data.spotPrice;
          const color = ks.role === "Max Pain" ? "#f5c451" : ks.role === "Gamma Flip" ? "#a78bfa" : isAbove ? "#34d399" : "#f87171";
          return (
            <div key={i} className="flex gap-4 px-4 py-3" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
              <div className="w-20 shrink-0">
                <div className="text-sm font-black" style={{ color }}>${ks.strike.toLocaleString()}</div>
                <div className="text-[9px] mt-0.5 px-1.5 py-0.5 rounded text-center" style={{ background: `${color}18`, color }}>
                  {ks.role}
                </div>
              </div>
              <div className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{ks.note}</div>
            </div>
          );
        })}
      </div>

      {/* OI by strike table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="grid grid-cols-[80px_1fr_80px] text-[9px] font-bold px-4 py-2" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(175,185,215,0.4)" }}>
          <span className="text-right pr-2">PUT OI</span>
          <span className="text-center">STRIKE</span>
          <span className="text-left pl-2">CALL OI</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {sortedStrikes.map((s, i) => {
            const isSpot = Math.abs(s.strike - data.spotPrice) < 12.5;
            const isMaxPain = s.isMaxPain;
            const isFlip = Math.abs(s.strike - data.gammaFlipLevel) < 12.5;
            const callW = (s.callOI / maxOI) * 100;
            const putW  = (s.putOI  / maxOI) * 100;
            return (
              <div
                key={s.strike}
                className="grid grid-cols-[80px_1fr_80px] items-center px-2 py-1.5"
                style={{
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : undefined,
                  background: isSpot ? "rgba(245,196,81,0.06)" : isMaxPain ? "rgba(167,139,250,0.05)" : undefined,
                }}
              >
                {/* Put bar */}
                <div className="flex justify-end gap-1 items-center">
                  <span className="text-[8px] font-mono" style={{ color: "rgba(175,185,215,0.3)" }}>{(s.putOI / 1000).toFixed(1)}k</span>
                  <div className="h-2 rounded-l-sm" style={{ width: `${putW * 0.6}%`, maxWidth: "50px", background: "#f8717166" }} />
                </div>

                {/* Strike label */}
                <div className="text-center">
                  <span
                    className="text-[10px] font-mono font-bold"
                    style={{
                      color: isSpot ? "#f5c451" : isMaxPain ? "#a78bfa" : isFlip ? "#60a5fa" : "rgba(175,185,215,0.6)",
                    }}
                  >
                    {isSpot && <span className="text-[8px] mr-0.5">◄</span>}
                    {s.strike.toLocaleString()}
                    {isMaxPain && <span className="text-[7px] ml-0.5 text-purple-400">MP</span>}
                    {isFlip && !isMaxPain && <span className="text-[7px] ml-0.5 text-blue-400">GF</span>}
                  </span>
                </div>

                {/* Call bar */}
                <div className="flex items-center gap-1">
                  <div className="h-2 rounded-r-sm" style={{ width: `${callW * 0.6}%`, maxWidth: "50px", background: "#34d39966" }} />
                  <span className="text-[8px] font-mono" style={{ color: "rgba(175,185,215,0.3)" }}>{(s.callOI / 1000).toFixed(1)}k</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 text-[8px] px-4 py-2" style={{ background: "rgba(255,255,255,0.02)", color: "rgba(175,185,215,0.3)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <span className="text-right pr-2">🔴 Puts</span>
          <span className="text-center">◄ = Spot | MP = Max Pain | GF = Gamma Flip</span>
          <span className="pl-2">🟢 Calls</span>
        </div>
      </div>

      {/* Education */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(175,185,215,0.6)" }}>UNDERSTANDING OPTIONS GAMMA</div>
        {[
          { icon: "🎯", text: "Max Pain: The strike price where the total dollar value of expiring options is minimized. Market makers profit most when price gravitates here near expiry." },
          { icon: "🔄", text: "Gamma Flip: When dealers switch from short gamma to long gamma. Above the flip = markets stabilize naturally. Below = moves get amplified." },
          { icon: "🧲", text: "Call Walls: Strikes with massive call open interest act as price resistance — dealers must short-hedge there as price rises toward them." },
          { icon: "🛡️", text: "Put Walls: Strikes with massive put OI can act as price support — dealers buy as price falls toward large put strikes (delta hedging)." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(175,185,215,0.45)" }}>{item.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[9px]" style={{ color: "rgba(175,185,215,0.25)" }}>
        {data.expiryInfo} · Options OI modeled from representative COMEX GC patterns · 1-hour cache · Not financial advice
      </p>
    </div>
  );
}
