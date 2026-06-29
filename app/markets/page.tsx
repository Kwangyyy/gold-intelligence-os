"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SYMBOLS, CATEGORY_LABEL, CATEGORY_COLOR, type SymbolCategory } from "@/lib/symbolConfig";
import type { SymbolPrice } from "@/app/api/market/symbols/route";

const POLL_MS = 15_000;
const ALL_CATS: (SymbolCategory | "all")[] = ["all", "metal", "forex", "crypto", "energy", "index"];

function pFmt(price: number, decimals: number) {
  return price.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function ChangeChip({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold font-mono"
      style={{ background: up ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", color: up ? "#34d399" : "#f87171" }}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-base-border/20 bg-white/[0.015] px-4 py-3 animate-pulse">
      <div className="h-8 w-8 rounded-lg bg-white/5" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-white/5" />
        <div className="h-2 w-16 rounded bg-white/5" />
      </div>
      <div className="h-4 w-20 rounded bg-white/5" />
      <div className="h-4 w-14 rounded bg-white/5" />
    </div>
  );
}

export default function MarketsPage() {
  const [prices, setPrices]   = useState<SymbolPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat]         = useState<SymbolCategory | "all">("all");
  const [ts, setTs]           = useState(0);
  const [secsAgo, setSecsAgo] = useState(0);

  async function fetchPrices() {
    try {
      const r = await fetch("/api/market/symbols");
      const d: SymbolPrice[] = await r.json();
      setPrices(d);
      setTs(Date.now());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchPrices();
    const poll = setInterval(fetchPrices, POLL_MS);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecsAgo(ts > 0 ? Math.floor((Date.now() - ts) / 1000) : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [ts]);

  const priceMap = Object.fromEntries(prices.map(p => [p.id, p]));

  const filtered = SYMBOLS.filter(s => cat === "all" || s.category === cat);

  const gainers  = [...prices].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
  const losers   = [...prices].sort((a, b) => a.changePct - b.changePct).slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-1">
        <PageHeader title="Markets" subtitle="Live prices — Metals · Forex · Crypto · Energy · Indices" />
        <div className="flex items-center gap-1.5 mt-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[11px] text-silver/35">{ts > 0 ? `${secsAgo}s ago` : "Loading…"}</span>
          <button onClick={fetchPrices} className="text-[10px] text-silver/25 hover:text-silver/50 transition-colors ml-1">↻</button>
        </div>
      </div>

      {/* ── Top Movers ──────────────────────────────────────────────── */}
      {prices.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2">
          <div className="panel p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Top Gainers</div>
            {gainers.map(p => {
              const sym = SYMBOLS.find(s => s.id === p.id);
              return sym ? (
                <div key={p.id} className="flex items-center justify-between py-1 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>{sym.icon}</span>
                    <span className="text-silver/60 font-medium">{sym.id}</span>
                  </span>
                  <ChangeChip pct={p.changePct} />
                </div>
              ) : null;
            })}
          </div>
          <div className="panel p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-red-400/70">Top Losers</div>
            {losers.map(p => {
              const sym = SYMBOLS.find(s => s.id === p.id);
              return sym ? (
                <div key={p.id} className="flex items-center justify-between py-1 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>{sym.icon}</span>
                    <span className="text-silver/60 font-medium">{sym.id}</span>
                  </span>
                  <ChangeChip pct={p.changePct} />
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* ── Category filter ─────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ALL_CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
            style={cat === c
              ? { background: c === "all" ? "rgba(245,196,81,0.15)" : `${CATEGORY_COLOR[c as SymbolCategory]}22`, border: `1px solid ${c === "all" ? "rgba(245,196,81,0.4)" : CATEGORY_COLOR[c as SymbolCategory]}66`, color: c === "all" ? "#f5c451" : CATEGORY_COLOR[c as SymbolCategory] }
              : { background: "rgba(71,85,105,0.1)", border: "1px solid rgba(71,85,105,0.2)", color: "#475569" }}>
            {c === "all" ? "All" : CATEGORY_LABEL[c as SymbolCategory]}
          </button>
        ))}
      </div>

      {/* ── Symbol list ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : (
          filtered.map(sym => {
            const p = priceMap[sym.id];
            const catColor = CATEGORY_COLOR[sym.category];
            return (
              <div key={sym.id}
                className="flex items-center gap-3 rounded-xl border border-base-border/20 bg-white/[0.015] px-4 py-3 transition-colors hover:bg-white/[0.03]">
                {/* Icon + category dot */}
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ background: `${catColor}18`, border: `1px solid ${catColor}33` }}>
                  {sym.icon}
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-base-bg"
                    style={{ background: catColor }} />
                </div>

                {/* Name */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-silver/85">{sym.id}</span>
                    <span className="hidden text-[10px] text-silver/30 sm:block">{sym.label}</span>
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: `${catColor}99` }}>
                    {CATEGORY_LABEL[sym.category]}
                  </span>
                </div>

                {/* Price */}
                <div className="text-right">
                  {p ? (
                    <>
                      <div className="font-mono text-sm font-black text-silver/90">
                        {pFmt(p.price, sym.decimals)}
                      </div>
                      <div className="text-[10px] font-mono text-silver/35">
                        {p.change >= 0 ? "+" : ""}{pFmt(p.change, sym.decimals)}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-silver/20">—</span>
                  )}
                </div>

                {/* Change % */}
                <div className="w-20 text-right">
                  {p ? <ChangeChip pct={p.changePct} /> : <span className="text-xs text-silver/20">—</span>}
                </div>

                {/* High / Low */}
                <div className="hidden text-right sm:block">
                  <div className="text-[10px] text-emerald-400/70">H: {p ? pFmt(p.high, sym.decimals) : "—"}</div>
                  <div className="text-[10px] text-red-400/70">L: {p ? pFmt(p.low, sym.decimals) : "—"}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 text-[10px] text-silver/20 text-center">
        Data from Yahoo Finance · refresh ทุก {POLL_MS / 1000}s · delayed ~15 min สำหรับ index
      </div>
    </div>
  );
}
