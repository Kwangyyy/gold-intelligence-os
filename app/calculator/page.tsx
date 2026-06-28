"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";

const MARGIN_PER_LOT = 400;   // USD, ~1:500 leverage
const PNL_PER_LOT   = 100;    // USD per lot per $1 price move (XAUUSD)

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function RiskPreset({ value, active, onClick }: { value: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
      style={active
        ? { background: "rgba(245,196,81,0.18)", border: "1px solid rgba(245,196,81,0.5)", color: "#f5c451" }
        : { background: "rgba(71,85,105,0.12)", border: "1px solid rgba(71,85,105,0.25)", color: "#475569" }}>
      {value}%
    </button>
  );
}

function InputRow({ label, sub, value, onChange, prefix, suffix, readOnly, highlight }: {
  label: string; sub?: string; value: string; onChange?: (v: string) => void;
  prefix?: string; suffix?: string; readOnly?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold text-silver/60">{label}</span>
        {sub && <span className="text-[10px] text-silver/30">{sub}</span>}
      </div>
      <div className="flex items-center overflow-hidden rounded-xl"
        style={{ border: `1px solid ${highlight ? "rgba(245,196,81,0.4)" : "rgba(71,85,105,0.3)"}`, background: highlight ? "rgba(245,196,81,0.05)" : "rgba(15,20,40,0.6)" }}>
        {prefix && <span className="pl-3 pr-1 text-xs text-silver/35">{prefix}</span>}
        <input
          type="number" value={value} readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm font-mono font-bold outline-none"
          style={{ color: highlight ? "#f5c451" : "#e2e8f0", cursor: readOnly ? "default" : "text" }}
        />
        {suffix && <span className="pr-3 text-xs text-silver/35">{suffix}</span>}
      </div>
    </div>
  );
}

function ResultCard({ label, value, sub, color, big }: { label: string; value: string; sub?: string; color?: string; big?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl p-4"
      style={{ background: "rgba(15,20,40,0.7)", border: "1px solid rgba(71,85,105,0.2)" }}>
      <span className="text-[9px] uppercase tracking-widest text-silver/35">{label}</span>
      <span className={`font-mono font-black ${big ? "text-2xl" : "text-lg"}`} style={{ color: color ?? "#e2e8f0" }}>{value}</span>
      {sub && <span className="text-[10px] text-silver/30">{sub}</span>}
    </div>
  );
}

export default function CalculatorPage() {
  const [balance, setBalance]  = useState("10000");
  const [riskPct, setRiskPct]  = useState("1");
  const [entry, setEntry]      = useState("");
  const [sl, setSl]            = useState("");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [useLive, setUseLive]  = useState(false);
  const [priceTs, setPriceTs]  = useState(0);

  // Fetch live price
  useEffect(() => {
    async function fetchPrice() {
      try {
        const r = await fetch("/api/market/xauusd");
        const d = await r.json();
        if (d?.price > 0) { setLivePrice(d.price); setPriceTs(Date.now()); }
      } catch {}
    }
    fetchPrice();
    const id = setInterval(fetchPrice, 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (useLive && livePrice) setEntry(livePrice.toFixed(2));
  }, [useLive, livePrice]);

  const bal   = parseFloat(balance)  || 0;
  const risk  = parseFloat(riskPct)  || 0;
  const ent   = parseFloat(entry)    || 0;
  const stop  = parseFloat(sl)       || 0;

  const riskUsd  = bal > 0 && risk > 0 ? bal * (risk / 100) : 0;
  const slDist   = ent > 0 && stop > 0 ? Math.abs(ent - stop) : 0;
  const lotSize  = slDist > 0 && riskUsd > 0 ? riskUsd / (slDist * PNL_PER_LOT) : 0;
  const lotRnd   = Math.max(0.01, Math.round(lotSize * 100) / 100);
  const margin   = lotRnd * MARGIN_PER_LOT;
  const leverage = ent > 0 && lotRnd > 0 ? (lotRnd * 100 * ent) / bal : 0;

  const hasResult = lotSize > 0;
  const secsAgo  = priceTs > 0 ? Math.floor((Date.now() - priceTs) / 1000) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Position Size Calculator"
        subtitle="คำนวณ Lot Size จาก Risk % และระยะ SL สำหรับ XAUUSD"
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* ── Inputs ──────────────────────────────────────────────── */}
        <div className="panel flex flex-col gap-5 p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-silver/40">ข้อมูล Account</div>

          <InputRow label="Balance" prefix="$" value={balance} onChange={setBalance} suffix="USD" />

          {/* Risk % with presets */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-silver/60">Risk per trade</span>
            <div className="flex gap-1.5 mb-1.5">
              {[0.5, 1, 1.5, 2].map(v => (
                <RiskPreset key={v} value={v} active={riskPct === String(v)} onClick={() => setRiskPct(String(v))} />
              ))}
            </div>
            <InputRow label="" value={riskPct} onChange={setRiskPct} suffix="%" />
          </div>

          <div className="h-px" style={{ background: "rgba(71,85,105,0.2)" }} />

          <div className="text-xs font-bold uppercase tracking-widest text-silver/40">Entry &amp; SL</div>

          {/* Entry with live toggle */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-silver/60">Entry Price</span>
              {livePrice && (
                <button onClick={() => setUseLive(v => !v)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold transition-all"
                  style={useLive
                    ? { background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.35)", color: "#34d399" }
                    : { background: "rgba(71,85,105,0.1)", border: "1px solid rgba(71,85,105,0.25)", color: "#64748b" }}>
                  <span className={`h-1.5 w-1.5 rounded-full ${useLive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                  Live {livePrice ? `$${livePrice.toFixed(2)}` : ""}
                  {secsAgo !== null && <span className="text-silver/30 ml-0.5">{secsAgo}s</span>}
                </button>
              )}
            </div>
            <InputRow label="" value={entry} onChange={v => { setUseLive(false); setEntry(v); }} prefix="$" readOnly={useLive} />
          </div>

          <InputRow label="Stop Loss" prefix="$" value={sl} onChange={setSl} suffix="USD" />

          {/* SL distance hint */}
          {slDist > 0 && (
            <div className="rounded-lg border border-base-border/20 bg-white/[0.02] px-3 py-2 text-xs text-silver/50">
              ระยะ SL: <span className="font-mono font-bold text-silver/80">${fmt(slDist)}</span>
              {" · "}
              Risk $: <span className="font-mono font-bold" style={{ color: riskUsd > 0 ? "#f5c451" : "#64748b" }}>${fmt(riskUsd)}</span>
            </div>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {hasResult ? (
            <>
              {/* Lot size — hero */}
              <div className="rounded-2xl p-6 text-center"
                style={{ background: "linear-gradient(135deg,rgba(245,196,81,0.1),rgba(168,85,247,0.08))", border: "1px solid rgba(245,196,81,0.3)" }}>
                <div className="text-[10px] uppercase tracking-widest text-gold/50 mb-1">Lot Size</div>
                <div className="text-5xl font-black font-mono" style={{ color: "#f5c451" }}>{fmt(lotRnd)}</div>
                <div className="text-xs text-silver/40 mt-1">lots (rounded to 0.01)</div>
                {Math.abs(lotRnd - lotSize) / lotSize > 0.05 && (
                  <div className="mt-2 text-[10px] text-silver/30">exact: {lotSize.toFixed(3)} lots</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ResultCard label="Risk Amount" value={`$${fmt(riskUsd)}`}
                  sub={`${risk}% of $${fmt(bal, 0)}`} color="#f5c451" />
                <ResultCard label="Actual Risk" value={`$${fmt(lotRnd * slDist * PNL_PER_LOT)}`}
                  sub="after lot rounding" color={lotRnd * slDist * PNL_PER_LOT > riskUsd * 1.05 ? "#f87171" : "#34d399"} />
                <ResultCard label="Margin Required" value={`$${fmt(margin, 0)}`}
                  sub="~1:500 leverage" color="#a78bfa" />
                <ResultCard label="Leverage Used" value={`1:${fmt(leverage, 0)}`}
                  sub="effective leverage" color={leverage > 200 ? "#f87171" : leverage > 100 ? "#f5c451" : "#34d399"} />
              </div>

              {/* SL size reference */}
              <div className="rounded-xl border border-base-border/20 bg-white/[0.015] px-4 py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-silver/40">TP ที่ R:R 1:1.5</span>
                  <span className="font-mono font-bold text-silver/70">
                    {ent > 0 && stop > 0 ? (stop < ent
                      ? `$${fmt(ent + slDist * 1.5)}`
                      : `$${fmt(ent - slDist * 1.5)}`) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1.5">
                  <span className="text-silver/40">TP ที่ R:R 1:2</span>
                  <span className="font-mono font-bold text-silver/70">
                    {ent > 0 && stop > 0 ? (stop < ent
                      ? `$${fmt(ent + slDist * 2)}`
                      : `$${fmt(ent - slDist * 2)}`) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1.5">
                  <span className="text-silver/40">TP ที่ R:R 1:3</span>
                  <span className="font-mono font-bold text-silver/70">
                    {ent > 0 && stop > 0 ? (stop < ent
                      ? `$${fmt(ent + slDist * 3)}`
                      : `$${fmt(ent - slDist * 3)}`) : "—"}
                  </span>
                </div>
              </div>

              {/* Max consecutive loss warning */}
              {risk > 2 && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-xs text-red-400/80">
                  ⚠️ Risk {risk}% ต่อไม้ — 5 ไม้ติดต่อกัน = เสีย {fmt(5 * risk, 1)}% ของทุน ควรใช้ไม่เกิน 2%
                </div>
              )}
            </>
          ) : (
            <div className="panel flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="text-4xl opacity-30">📐</div>
              <div className="text-sm text-silver/30">ใส่ Balance, Risk%, Entry และ SL<br />เพื่อคำนวณ Lot Size</div>
            </div>
          )}
        </div>
      </div>

      {/* Formula note */}
      <div className="mt-4 rounded-xl border border-base-border/15 bg-white/[0.012] px-4 py-3">
        <div className="text-[10px] text-silver/30 font-mono">
          Lot Size = Risk$ ÷ (SL Distance × 100) &nbsp;|&nbsp; XAUUSD: 1 lot = $100/pip (1:500)
        </div>
      </div>

      <div className="mt-6"><Disclaimer /></div>
    </div>
  );
}
