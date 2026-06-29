"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { SYMBOLS, CATEGORY_COLOR, type SymbolConfig } from "@/lib/symbolConfig";

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

function InputRow({ label, value, onChange, prefix, suffix, readOnly }: {
  label: string; value: string; onChange?: (v: string) => void;
  prefix?: string; suffix?: string; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-silver/60">{label}</span>
      <div className="flex items-center overflow-hidden rounded-xl border border-base-border/35 bg-base-panel/60">
        {prefix && <span className="pl-3 pr-1 text-xs text-silver/35">{prefix}</span>}
        <input type="number" value={value} readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm font-mono font-bold text-silver outline-none"
          style={{ cursor: readOnly ? "default" : "text" }} />
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
  const [symId, setSymId]      = useState("XAUUSD");
  const [balance, setBalance]  = useState("10000");
  const [riskPct, setRiskPct]  = useState("1");
  const [entry, setEntry]      = useState("");
  const [sl, setSl]            = useState("");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [useLive, setUseLive]  = useState(false);
  const [priceTs, setPriceTs]  = useState(0);
  const [showSymPicker, setShowSymPicker] = useState(false);

  const sym: SymbolConfig = SYMBOLS.find(s => s.id === symId) ?? SYMBOLS[0];
  const catColor = CATEGORY_COLOR[sym.category];

  // Fetch live price for selected symbol
  useEffect(() => {
    setLivePrice(null); setUseLive(false); setEntry(""); setSl("");
    async function fetchPrice() {
      try {
        const r = await fetch("/api/market/symbols");
        const d: { id: string; price: number }[] = await r.json();
        const found = d.find(p => p.id === symId);
        if (found) { setLivePrice(found.price); setPriceTs(Date.now()); }
      } catch {}
    }
    fetchPrice();
    const id = setInterval(fetchPrice, 15_000);
    return () => clearInterval(id);
  }, [symId]);

  useEffect(() => {
    if (useLive && livePrice) setEntry(livePrice.toFixed(sym.decimals));
  }, [useLive, livePrice, sym.decimals]);

  const bal  = parseFloat(balance)  || 0;
  const risk = parseFloat(riskPct)  || 0;
  const ent  = parseFloat(entry)    || 0;
  const stop = parseFloat(sl)       || 0;

  const riskUsd    = bal > 0 && risk > 0 ? bal * (risk / 100) : 0;
  const slDistRaw  = ent > 0 && stop > 0 ? Math.abs(ent - stop) : 0;
  const slPips     = slDistRaw > 0 ? slDistRaw / sym.pipSize : 0;
  const lotSize    = slPips > 0 && riskUsd > 0 ? riskUsd / (slPips * sym.pipValuePerLot) : 0;
  const lotRnd     = Math.max(sym.minLot, Math.round(lotSize / sym.minLot) * sym.minLot);
  const marginEst  = lotRnd * 400; // rough estimate ~1:500
  const isBuy      = ent > 0 && stop > 0 && stop < ent;

  const hasResult  = lotSize > 0;
  const secsAgo    = priceTs > 0 ? Math.floor((Date.now() - priceTs) / 1000) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Position Size Calculator" subtitle="คำนวณ Lot Size สำหรับทุก instrument" />

      {/* ── Symbol Picker ──────────────────────────────────────────── */}
      <div className="mb-5">
        <button onClick={() => setShowSymPicker(v => !v)}
          className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all"
          style={{ background: `${catColor}15`, border: `1px solid ${catColor}40` }}>
          <span className="text-xl">{sym.icon}</span>
          <div className="text-left">
            <div className="text-sm font-black" style={{ color: catColor }}>{sym.id}</div>
            <div className="text-[10px] text-silver/40">{sym.label}</div>
          </div>
          <span className="ml-2 text-silver/30 text-xs">{showSymPicker ? "▲" : "▼"}</span>
        </button>

        {showSymPicker && (
          <div className="mt-2 rounded-2xl border border-base-border/30 bg-base-panel p-3"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            {(["metal","forex","crypto","energy","index"] as const).map(cat => (
              <div key={cat} className="mb-3">
                <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: CATEGORY_COLOR[cat] }}>
                  {cat === "metal" ? "Metals" : cat === "forex" ? "Forex" : cat === "crypto" ? "Crypto" : cat === "energy" ? "Energy" : "Indices"}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {SYMBOLS.filter(s => s.category === cat).map(s => (
                    <button key={s.id} onClick={() => { setSymId(s.id); setShowSymPicker(false); }}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-all"
                      style={symId === s.id
                        ? { background: `${CATEGORY_COLOR[cat]}18`, border: `1px solid ${CATEGORY_COLOR[cat]}44`, color: CATEGORY_COLOR[cat] }
                        : { background: "rgba(15,20,40,0.5)", border: "1px solid rgba(71,85,105,0.2)", color: "#64748b" }}>
                      <span>{s.icon}</span>
                      <span className="font-bold">{s.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* ── Inputs ──────────────────────────────────────────────── */}
        <div className="panel flex flex-col gap-5 p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-silver/40">ข้อมูล Account</div>

          <InputRow label="Balance" prefix="$" value={balance} onChange={setBalance} suffix="USD" />

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
          <div className="text-xs font-bold uppercase tracking-widest text-silver/40">Entry &amp; SL ({sym.id})</div>

          {/* Entry with live price */}
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
                  Live {livePrice.toFixed(sym.decimals)}
                  {secsAgo !== null && <span className="text-silver/30 ml-0.5">{secsAgo}s</span>}
                </button>
              )}
            </div>
            <InputRow label="" value={entry} onChange={v => { setUseLive(false); setEntry(v); }} readOnly={useLive} />
          </div>

          <InputRow label="Stop Loss" value={sl} onChange={setSl} />

          {slDistRaw > 0 && (
            <div className="rounded-lg border border-base-border/20 bg-white/[0.02] px-3 py-2 text-xs text-silver/50">
              SL: <span className="font-mono font-bold text-silver/80">{fmt(slDistRaw, sym.decimals)}</span> =
              <span className="font-mono font-bold text-silver/80"> {fmt(slPips, 0)} pips</span>
              · Risk: <span className="font-mono font-bold" style={{ color: "#f5c451" }}>${fmt(riskUsd)}</span>
            </div>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {hasResult ? (
            <>
              <div className="rounded-2xl p-6 text-center"
                style={{ background: `${catColor}0d`, border: `1px solid ${catColor}40` }}>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: `${catColor}80` }}>Lot Size</div>
                <div className="text-5xl font-black font-mono" style={{ color: catColor }}>{fmt(lotRnd, sym.minLot < 0.01 ? 3 : 2)}</div>
                <div className="text-xs text-silver/40 mt-1">lots ({sym.lotUnit})</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ResultCard label="Risk Amount" value={`$${fmt(riskUsd)}`}
                  sub={`${risk}% of $${fmt(bal, 0)}`} color="#f5c451" />
                <ResultCard label="SL (pips)" value={fmt(slPips, 0)}
                  sub={`${fmt(slDistRaw, sym.decimals)} price pts`} />
                <ResultCard label="Pip Value/Lot" value={`$${sym.pipValuePerLot}`}
                  sub={`per pip · ${sym.id}`} color={catColor} />
                <ResultCard label="Margin Est." value={`$${fmt(marginEst, 0)}`}
                  sub="~1:500 leverage" color="#a78bfa" />
              </div>

              {/* TP reference */}
              <div className="rounded-xl border border-base-border/20 bg-white/[0.015] px-4 py-3">
                {[1.5, 2, 3].map(rr => {
                  const tpDist = slDistRaw * rr;
                  const tp = isBuy ? ent + tpDist : ent - tpDist;
                  const reward = lotRnd * (slPips * rr) * sym.pipValuePerLot;
                  return (
                    <div key={rr} className="flex items-center justify-between text-xs py-1">
                      <span className="text-silver/40">TP R:R 1:{rr}</span>
                      <span className="font-mono font-bold text-silver/70">{fmt(tp, sym.decimals)}</span>
                      <span className="font-mono text-emerald-400/80">+${fmt(reward)}</span>
                    </div>
                  );
                })}
              </div>

              {risk > 2 && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-xs text-red-400/80">
                  ⚠️ Risk {risk}% ต่อไม้ — 5 ไม้ติดต่อกัน = เสีย {fmt(5 * risk, 1)}% ของทุน
                </div>
              )}
            </>
          ) : (
            <div className="panel flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="text-4xl opacity-30">{sym.icon}</div>
              <div className="text-sm text-silver/30">ใส่ Balance, Risk%, Entry และ SL<br />เพื่อคำนวณ Lot Size สำหรับ {sym.id}</div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-base-border/15 bg-white/[0.012] px-4 py-3">
        <div className="text-[10px] text-silver/30 font-mono">
          {sym.id}: pipSize={sym.pipSize} · pipValue=${sym.pipValuePerLot}/lot · minLot={sym.minLot} {sym.lotUnit}
        </div>
      </div>

      <div className="mt-6"><Disclaimer /></div>
    </div>
  );
}
