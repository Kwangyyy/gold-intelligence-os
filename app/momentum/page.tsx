"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MomentumPayload, AssetMomentum } from "@/app/api/momentum/route";

const TREND_LABEL: Record<AssetMomentum["trend"], { icon: string; label: string; color: string }> = {
  strong_up:   { icon: "🚀", label: "Strong Up",   color: "#34d399" },
  up:          { icon: "↑",  label: "Up",           color: "#6ee7b7" },
  flat:        { icon: "→",  label: "Flat",         color: "#f5c451" },
  down:        { icon: "↓",  label: "Down",         color: "#fca5a5" },
  strong_down: { icon: "💀", label: "Strong Down",  color: "#f87171" },
};

function MomentumBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="relative h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
      <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      {/* Center line */}
      <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />
    </div>
  );
}

function AssetCard({ asset, rank }: { asset: AssetMomentum; rank: number }) {
  const tl = TREND_LABEL[asset.trend];
  const isGold = asset.name.includes("Gold");
  return (
    <div className="panel px-4 py-3.5 transition-all"
      style={{ borderColor: isGold ? "rgba(245,196,81,0.3)" : undefined, background: isGold ? "rgba(245,196,81,0.03)" : undefined }}>
      <div className="flex items-start gap-3 mb-2">
        {/* Rank */}
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
          style={{ background: `${asset.color}15`, color: asset.color }}>
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: isGold ? "#f5c451" : "rgba(175,185,215,0.8)" }}>
              {asset.name}
            </span>
            <span className="text-[9px]" style={{ color: tl.color }}>{tl.icon} {tl.label}</span>
          </div>
          <div className="text-[9px] mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>{asset.nameTh} · ${asset.price.toLocaleString()}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-black" style={{ color: asset.color }}>{asset.momentumScore}</div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>score</div>
        </div>
      </div>
      <MomentumBar score={asset.momentumScore} color={asset.color} />
      {/* Returns row */}
      <div className="mt-2 grid grid-cols-4 gap-1 text-center">
        {[
          { label: "1D", val: asset.change1d },
          { label: "5D", val: asset.change5d },
          { label: "20D", val: asset.change20d },
          { label: "60D", val: asset.change60d },
        ].map(({ label, val }) => (
          <div key={label}>
            <div className="text-[7px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.25)" }}>{label}</div>
            <div className="text-[10px] font-bold" style={{ color: val >= 0 ? "#34d399" : "#f87171" }}>
              {val >= 0 ? "+" : ""}{val.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
      {/* RSI */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[8px]" style={{ color: "rgba(175,185,215,0.25)" }}>RSI14</span>
        <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-full rounded-full" style={{
            width: `${asset.rsi14}%`,
            background: asset.rsi14 > 70 ? "#f87171" : asset.rsi14 < 30 ? "#34d399" : asset.color,
            opacity: 0.7,
          }} />
        </div>
        <span className="text-[9px] font-mono" style={{
          color: asset.rsi14 > 70 ? "#f87171" : asset.rsi14 < 30 ? "#34d399" : "rgba(175,185,215,0.5)",
        }}>
          {asset.rsi14.toFixed(0)}
          {asset.rsi14 > 70 ? " OB" : asset.rsi14 < 30 ? " OS" : ""}
        </span>
      </div>
    </div>
  );
}

function RelativeMatrix({ assets }: { assets: AssetMomentum[] }) {
  const maxRange = 30;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[9px]">
        <thead>
          <tr>
            <th className="text-left pb-2 pr-3" style={{ color: "rgba(175,185,215,0.3)" }}>Asset</th>
            {["-60D", "-20D", "-5D", "-1D"].map(h => (
              <th key={h} className="pb-2 px-1 text-right" style={{ color: "rgba(175,185,215,0.25)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map(a => (
            <tr key={a.symbol}>
              <td className="pr-3 py-1 font-bold" style={{ color: a.color }}>{a.name.split(" ")[0]}</td>
              {[a.change60d, a.change20d, a.change5d, a.change1d].map((val, i) => {
                const abs = Math.min(Math.abs(val) / maxRange, 1);
                const bg  = val >= 0 ? `rgba(52,211,153,${abs * 0.6})` : `rgba(248,113,113,${abs * 0.6})`;
                return (
                  <td key={i} className="py-1 px-1 text-right font-mono rounded"
                    style={{ color: val >= 0 ? "#34d399" : "#f87171", background: bg }}>
                    {val >= 0 ? "+" : ""}{val.toFixed(1)}%
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

export default function MomentumPage() {
  const [data, setData]       = useState<MomentumPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/momentum", { cache: "no-store" });
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
        title="📡 Momentum Tracker"
        subtitle="Multi-asset momentum ranking — Gold vs DXY vs Bonds vs Equities vs Oil vs Silver"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>📡 กำลังโหลด momentum data…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Gold rank highlight */}
          <div className="panel px-5 py-4 flex items-center gap-4"
            style={{ border: "1px solid rgba(245,196,81,0.2)", background: "rgba(245,196,81,0.04)" }}>
            <div className="text-3xl">🥇</div>
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.35)" }}>Gold Momentum Rank</div>
              <div className="text-base font-black text-amber-400">
                #{data.goldRank} of {data.assets.length}
              </div>
              <p className="text-[10px] mt-1" style={{ color: "rgba(175,185,215,0.6)" }}>{data.goldSignalTh}</p>
            </div>
          </div>

          {/* Asset cards */}
          <div className="space-y-3">
            {data.assets.map((a, i) => (
              <AssetCard key={a.symbol} asset={a} rank={i + 1} />
            ))}
          </div>

          {/* Relative return matrix */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Relative Return Matrix — heat color
            </div>
            <RelativeMatrix assets={data.assets} />
          </div>

          {/* Context tips */}
          <div className="panel px-5 py-4" style={{ background: "rgba(245,196,81,0.04)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-3 text-amber-400/60">💡 อ่าน Momentum อย่างไร</div>
            <ul className="space-y-2 text-xs" style={{ color: "rgba(175,185,215,0.6)" }}>
              <li>→ Gold ขึ้น + DXY ลง = setup bullish ที่แข็งแกร่งที่สุด</li>
              <li>→ Gold ขึ้น + Bonds ขึ้น = risk-off sentiment — ทั้งคู่เป็น safe haven</li>
              <li>→ Gold ขึ้น + S&P500 ลง = ความกังวลตลาด, demand gold สูง</li>
              <li>→ RSI เกิน 70 = overbought — ระวัง pullback ก่อน long ใหม่</li>
              <li>→ Score &gt; 65 = strong uptrend · Score &lt; 35 = strong downtrend</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              อัปเดต {new Date(data.updatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
