"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { IntermarketAsset } from "@/app/api/intermarket/route";

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const REL_CFG = {
  inverse:  { label: "Inverse",  color: "#f87171", icon: "↕" },
  positive: { label: "Positive", color: "#34d399", icon: "↑↑" },
  mixed:    { label: "Mixed",    color: "#f5c451", icon: "≈" },
};

function SignalPill({ asset, goldPct }: { asset: IntermarketAsset; goldPct: number }) {
  if (asset.id === "XAUUSD") return null;
  const rel = asset.relationship;
  const mover = asset.changePct;

  let signal = "neutral";
  let sColor = "#475569";
  let sLabel = "Neutral";

  if (rel === "inverse") {
    if (mover > 0.3)       { signal = "bearish"; sColor = "#f87171"; sLabel = "↓ Gold Bearish" }
    else if (mover < -0.3) { signal = "bullish"; sColor = "#34d399"; sLabel = "↑ Gold Bullish" }
  } else if (rel === "positive") {
    if (mover > 0.3)       { signal = "bullish"; sColor = "#34d399"; sLabel = "↑ Gold Bullish" }
    else if (mover < -0.3) { signal = "bearish"; sColor = "#f87171"; sLabel = "↓ Gold Bearish" }
  }

  if (signal === "neutral") return null;
  return (
    <span className="rounded px-1.5 py-0.5 text-[9px] font-black whitespace-nowrap"
      style={{ background: `${sColor}18`, border: `1px solid ${sColor}40`, color: sColor }}>
      {sLabel}
    </span>
  );
}

function AssetRow({ asset, goldPct }: { asset: IntermarketAsset; goldPct: number }) {
  const isGold    = asset.id === "XAUUSD";
  const rel       = REL_CFG[asset.relationship];
  const upColor   = asset.changePct >= 0 ? "#34d399" : "#f87171";
  const decimals  = asset.id.includes("Y") || asset.id === "VIX" ? 3
    : asset.id === "XAUUSD" || asset.id === "SILVER" || asset.id === "SP500" ? 2 : 4;

  return (
    <tr className="border-b border-base-border/10 hover:bg-white/[0.015] transition-colors"
      style={isGold ? { background: "rgba(245,196,81,0.04)" } : undefined}>
      <td className="px-4 py-3">
        <div className="font-bold text-sm" style={{ color: isGold ? "#f5c451" : "#e2e8f0" }}>{asset.label}</div>
        <div className="text-[10px] text-silver/30 mt-0.5">{asset.note}</div>
      </td>
      <td className="px-4 py-3 font-mono text-silver/80 text-right">{fmt(asset.price, decimals)}</td>
      <td className="px-4 py-3 font-mono text-right font-bold" style={{ color: upColor }}>
        {asset.changePct >= 0 ? "+" : ""}{asset.changePct.toFixed(2)}%
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-[10px] font-bold" style={{ color: rel.color }}>
          {rel.icon} {rel.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <SignalPill asset={asset} goldPct={goldPct} />
      </td>
    </tr>
  );
}

function BullBearMeter({ assets }: { assets: IntermarketAsset[] }) {
  const tradeable = assets.filter(a => a.id !== "XAUUSD" && a.price > 0);
  let bullish = 0, bearish = 0;

  for (const a of tradeable) {
    const m = a.changePct;
    if (Math.abs(m) < 0.2) continue;
    const signal = a.relationship === "inverse" ? -m : a.relationship === "positive" ? m : 0;
    if (signal > 0) bullish++;
    else if (signal < 0) bearish++;
  }

  const total = bullish + bearish || 1;
  const bullPct = Math.round((bullish / total) * 100);
  const sentiment = bullPct >= 65 ? { label: "Bullish for Gold", color: "#34d399" }
    : bullPct <= 35 ? { label: "Bearish for Gold", color: "#f87171" }
    : { label: "Neutral / Mixed", color: "#f5c451" };

  return (
    <div className="panel p-5 mb-5">
      <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">
        Intermarket Sentiment → Gold
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="text-2xl font-black" style={{ color: sentiment.color }}>{sentiment.label}</div>
        <div className="text-sm text-silver/40">{bullish} bullish · {bearish} bearish signals</div>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {bullish > 0 && (
          <div style={{ width: `${bullPct}%`, background: "#34d399" }} className="h-full rounded-l-full transition-all" />
        )}
        {bearish > 0 && (
          <div style={{ width: `${100 - bullPct}%`, background: "#f87171" }} className="h-full rounded-r-full transition-all" />
        )}
      </div>
      <div className="mt-2 flex gap-4 text-[10px] text-silver/30">
        <span className="text-emerald-400">■ Bullish {bullish}</span>
        <span className="text-red-400">■ Bearish {bearish}</span>
      </div>
    </div>
  );
}

export default function IntermarketPage() {
  const [assets, setAssets]   = useState<IntermarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/intermarket");
      const d = await r.json();
      if (d.error) setError(d.error);
      else setAssets(d);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);

  const goldAsset = assets.find(a => a.id === "XAUUSD");
  const goldPct   = goldAsset?.changePct ?? 0;
  const others    = assets.filter(a => a.id !== "XAUUSD");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-1">
        <PageHeader title="Intermarket Dashboard 🌐"
          subtitle="DXY · Yields · VIX · Oil · Silver vs Gold — เพื่อวิเคราะห์ macro environment" />
        <button onClick={load} className="mt-1 text-xs text-silver/30 hover:text-silver/60 transition-colors">↻ refresh</button>
      </div>

      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3 text-silver/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <span className="text-sm">กำลังดึงข้อมูล intermarket…</span>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {!loading && assets.length > 0 && (
        <>
          <BullBearMeter assets={assets} />

          {/* Legend */}
          <div className="mb-3 flex gap-4 text-[10px] text-silver/35">
            <span><span style={{ color: REL_CFG.inverse.color }}>↕ Inverse</span> = asset ขึ้น → Gold ลง</span>
            <span><span style={{ color: REL_CFG.positive.color }}>↑↑ Positive</span> = asset ขึ้น → Gold ขึ้น</span>
            <span><span style={{ color: REL_CFG.mixed.color }}>≈ Mixed</span> = ขึ้นอยู่กับ context</span>
          </div>

          {/* Gold row */}
          {goldAsset && (
            <div className="panel overflow-hidden mb-3">
              <table className="w-full text-xs">
                <tbody><AssetRow asset={goldAsset} goldPct={goldPct} /></tbody>
              </table>
            </div>
          )}

          {/* Other assets */}
          <div className="panel overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-base-border/20 text-[10px] uppercase tracking-widest text-silver/30">
                  <th className="px-4 pb-2 pt-3 text-left">Asset</th>
                  <th className="px-4 pb-2 pt-3 text-right">Price</th>
                  <th className="px-4 pb-2 pt-3 text-right">Change</th>
                  <th className="px-4 pb-2 pt-3 text-left hidden sm:table-cell">Relation to Gold</th>
                  <th className="px-4 pb-2 pt-3 text-left">Signal</th>
                </tr>
              </thead>
              <tbody>
                {others.map(a => <AssetRow key={a.id} asset={a} goldPct={goldPct} />)}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-center text-[10px] text-silver/20">
            อัปเดตอัตโนมัติทุก 60 วินาที · ข้อมูลจาก Yahoo Finance · สัญญาณเป็นเพียง indication ไม่ใช่คำแนะนำ
          </div>
        </>
      )}
    </div>
  );
}
