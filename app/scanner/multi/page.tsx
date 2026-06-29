"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { CATEGORY_COLOR, type SymbolCategory } from "@/lib/symbolConfig";
import type { MultiScanRow } from "@/app/api/scanner/multi/route";

type Bias = "buy" | "sell" | "neutral";
type SortKey = "signal" | "buy" | "sell" | "symbol";

const BG: Record<Bias, string>    = { buy:"rgba(52,211,153,0.12)",  sell:"rgba(248,113,113,0.12)",  neutral:"rgba(71,85,105,0.1)"  };
const BD: Record<Bias, string>    = { buy:"rgba(52,211,153,0.35)",  sell:"rgba(248,113,113,0.35)",  neutral:"rgba(71,85,105,0.2)"  };
const COL: Record<Bias, string>   = { buy:"#34d399", sell:"#f87171", neutral:"#475569" };
const LBL: Record<Bias, string>   = { buy:"BUY", sell:"SELL", neutral:"—" };

const CATS: (SymbolCategory | "all")[] = ["all", "metal", "forex", "crypto", "energy", "index"];
const CAT_LABEL: Record<string, string> = {
  all:"All (42)", metal:"Metals", forex:"Forex", crypto:"Crypto", energy:"Energy", index:"Indices",
};

function BiasPill({ bias, score }: { bias: Bias; score: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[38px]">
      <span className="rounded px-1.5 py-0.5 text-[9px] font-black whitespace-nowrap"
        style={{ background: BG[bias], border:`1px solid ${BD[bias]}`, color: COL[bias] }}>
        {LBL[bias]}
      </span>
      <span className="text-[9px] font-mono" style={{ color: COL[bias] }}>{score}</span>
    </div>
  );
}

function ScoreMeter({ score }: { score: number }) {
  const bias: Bias = score > 55 ? "buy" : score < 45 ? "sell" : "neutral";
  return (
    <div className="flex flex-col items-center gap-1 min-w-[52px]">
      <div className="flex h-2 w-12 rounded-full overflow-hidden" style={{ background:"rgba(71,85,105,0.2)" }}>
        <div style={{ width:`${score}%`, background: COL[bias] }} className="h-full rounded-full transition-all duration-500" />
      </div>
      <span className="text-[10px] font-black font-mono" style={{ color: COL[bias] }}>{score}</span>
    </div>
  );
}

function SymbolRow({ row }: { row: MultiScanRow }) {
  const catColor = CATEGORY_COLOR[row.category];
  const chColor  = row.changePct >= 0 ? "#34d399" : "#f87171";
  const priceStr = row.price > 0 ? row.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : "—";

  return (
    <tr className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${row.error ? "opacity-40" : ""}`}>
      {/* Symbol */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{row.icon}</span>
          <div>
            <div className="text-xs font-bold text-white">{row.id}</div>
            <div className="text-[9px] text-silver/35">{row.label}</div>
          </div>
          <span className="ml-1 rounded px-1 py-0.5 text-[8px] font-bold"
            style={{ background:`${catColor}12`, border:`1px solid ${catColor}30`, color:catColor }}>
            {row.category}
          </span>
        </div>
      </td>
      {/* Price */}
      <td className="px-3 py-2.5 text-right hidden sm:table-cell">
        <div className="font-mono text-xs text-silver/70">{priceStr}</div>
        <div className="text-[9px] font-bold" style={{ color: chColor }}>
          {row.changePct >= 0 ? "+" : ""}{row.changePct.toFixed(2)}%
        </div>
      </td>
      {/* TF Biases */}
      <td className="px-2 py-2.5 hidden md:table-cell">
        <div className="flex items-center gap-2 justify-center">
          <BiasPill bias={row.h1Bias} score={row.h1Score} />
          <BiasPill bias={row.h4Bias} score={row.h4Score} />
          <BiasPill bias={row.d1Bias} score={row.d1Score} />
        </div>
      </td>
      {/* Overall */}
      <td className="px-3 py-2.5">
        <ScoreMeter score={row.overallScore} />
      </td>
      {/* Signal */}
      <td className="px-3 py-2.5">
        <span className="rounded-lg px-2 py-1 text-[11px] font-black whitespace-nowrap"
          style={{ background:BG[row.overallBias], border:`1px solid ${BD[row.overallBias]}`, color:COL[row.overallBias] }}>
          {row.overallBias === "buy" ? "▲ BUY" : row.overallBias === "sell" ? "▼ SELL" : "— NEUTRAL"}
        </span>
      </td>
      {/* Action */}
      <td className="px-3 py-2.5">
        <Link href={`/chart?s=${row.id}`}
          className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-silver/50 hover:text-gold transition-colors"
          style={{ border:"1px solid rgba(71,85,105,0.2)" }}>
          📈 Chart
        </Link>
      </td>
    </tr>
  );
}

function SummaryBar({ rows }: { rows: MultiScanRow[] }) {
  const buy  = rows.filter(r => r.overallBias === "buy").length;
  const sell = rows.filter(r => r.overallBias === "sell").length;
  const neut = rows.filter(r => r.overallBias === "neutral").length;
  const total = rows.length || 1;

  return (
    <div className="panel p-4 mb-5">
      <div className="flex items-center gap-4 mb-3">
        <div className="text-[10px] uppercase tracking-widest text-silver/35">Market Overview</div>
        <div className="flex items-center gap-3 ml-auto text-xs">
          <span className="text-emerald-400 font-bold">▲ {buy} BUY</span>
          <span className="text-red-400 font-bold">▼ {sell} SELL</span>
          <span className="text-silver/40">— {neut} NEUTRAL</span>
        </div>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        <div style={{ width:`${(buy/total)*100}%`, background:"#34d399" }} className="h-full rounded-l-full transition-all" />
        <div style={{ width:`${(neut/total)*100}%`, background:"rgba(71,85,105,0.4)" }} className="h-full transition-all" />
        <div style={{ width:`${(sell/total)*100}%`, background:"#f87171" }} className="h-full rounded-r-full transition-all" />
      </div>
      <div className="mt-2 text-[10px] text-silver/25 text-center">
        {rows.length} symbols · H1 × H4 × D1 weighted score · เรียงจาก signal แรงที่สุด
      </div>
    </div>
  );
}

export default function MultiScannerPage() {
  const [rows,    setRows]    = useState<MultiScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [cat,     setCat]     = useState<SymbolCategory | "all">("all");
  const [sort,    setSort]    = useState<SortKey>("signal");
  const [search,  setSearch]  = useState("");
  const [lastAt,  setLastAt]  = useState<Date | null>(null);

  const load = useCallback(async (selectedCat: SymbolCategory | "all") => {
    setLoading(true); setError("");
    try {
      const url = selectedCat === "all" ? "/api/scanner/multi" : `/api/scanner/multi?cat=${selectedCat}`;
      const r   = await fetch(url, { cache: "no-store" });
      const d   = await r.json();
      if (d.error) throw new Error(d.error);
      setRows(d);
      setLastAt(new Date());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(cat); }, [cat, load]);

  const filtered = rows.filter(r =>
    !search || r.id.toLowerCase().includes(search.toLowerCase()) || r.label.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "signal")  return Math.abs(b.overallScore - 50) - Math.abs(a.overallScore - 50);
    if (sort === "buy")     return b.overallScore - a.overallScore;
    if (sort === "sell")    return a.overallScore - b.overallScore;
    return a.id.localeCompare(b.id);
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-1">
        <PageHeader
          title="Multi-Symbol Scanner 🌐"
          subtitle="สแกน 42 symbols × 3 timeframes (H1/H4/D1) พร้อมกัน — เรียงจาก signal แรงที่สุด"
        />
        <button onClick={() => load(cat)}
          className="mt-1 text-xs text-silver/30 hover:text-silver/60 transition-colors">
          ↻ refresh
        </button>
      </div>

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className="rounded-lg px-3 py-1 text-xs font-bold transition-all capitalize"
            style={cat === c
              ? { background:"rgba(245,196,81,0.15)", border:"1px solid rgba(245,196,81,0.4)", color:"#f5c451" }
              : { background:"rgba(71,85,105,0.1)", border:"1px solid rgba(71,85,105,0.2)", color:"#475569" }}>
            {CAT_LABEL[c] ?? c}
          </button>
        ))}
        {/* Sort */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-silver/30">เรียงโดย:</span>
          {(["signal","buy","sell","symbol"] as SortKey[]).map(s => (
            <button key={s} onClick={() => setSort(s)}
              className="rounded px-2 py-0.5 text-[10px] font-bold transition-all capitalize"
              style={sort === s
                ? { background:"rgba(168,85,247,0.15)", border:"1px solid rgba(168,85,247,0.35)", color:"#a78bfa" }
                : { background:"rgba(71,85,105,0.08)", border:"1px solid rgba(71,85,105,0.15)", color:"#475569" }}>
              {s === "signal" ? "Signal Strength" : s === "buy" ? "Most Bullish" : s === "sell" ? "Most Bearish" : "A→Z"}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา…"
            className="ml-2 w-24 rounded-lg border border-base-border/30 bg-white/[0.03] px-2 py-0.5 text-[10px] text-silver/60 placeholder-silver/20 outline-none focus:border-gold/40 transition-colors" />
        </div>
      </div>

      {/* Summary bar */}
      {!loading && rows.length > 0 && <SummaryBar rows={rows} />}

      {loading && (
        <div className="mt-10 flex flex-col items-center gap-3 text-silver/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <span className="text-sm">กำลังสแกน {cat === "all" ? "42" : ""} symbols…</span>
          <span className="text-[11px] text-silver/20">อาจใช้เวลา 10-20 วินาที</span>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-base-border/20 text-[9px] uppercase tracking-widest text-silver/30">
                <th className="px-3 pb-2 pt-3 text-left">Symbol</th>
                <th className="px-3 pb-2 pt-3 text-right hidden sm:table-cell">Price</th>
                <th className="px-2 pb-2 pt-3 text-center hidden md:table-cell">
                  <span className="text-silver/20">H1</span>
                  <span className="mx-1 text-silver/15">·</span>
                  <span className="text-silver/20">H4</span>
                  <span className="mx-1 text-silver/15">·</span>
                  <span className="text-silver/20">D1</span>
                </th>
                <th className="px-3 pb-2 pt-3 text-center">Score</th>
                <th className="px-3 pb-2 pt-3 text-left">Signal</th>
                <th className="px-3 pb-2 pt-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => <SymbolRow key={r.id} row={r} />)}
            </tbody>
          </table>
        </div>
      )}

      {!loading && sorted.length === 0 && !error && (
        <div className="mt-10 text-center text-silver/30 text-sm">ไม่พบ symbol ที่ตรงกัน</div>
      )}

      {lastAt && !loading && (
        <div className="mt-3 text-center text-[10px] text-silver/20">
          สแกนเมื่อ {lastAt.toLocaleTimeString("th-TH")} · แต่ละ symbol cache 5 นาที
        </div>
      )}
    </div>
  );
}
