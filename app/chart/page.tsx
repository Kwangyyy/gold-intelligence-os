"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { GoldChart } from "@/components/GoldChart";
import { BeginnerHint } from "@/components/BeginnerHint";
import { Disclaimer } from "@/components/Disclaimer";
import { PageHeader } from "@/components/PageHeader";
import { SYMBOLS, CATEGORY_COLOR, type SymbolCategory } from "@/lib/symbolConfig";

// TradingView symbol mapping for each instrument
const TV_SYMBOL: Record<string, string> = {
  // Metals
  XAUUSD:   "OANDA:XAUUSD",
  XAGUSD:   "OANDA:XAGUSD",
  XPTUSD:   "TVC:PLATINUM",
  COPPER:   "TVC:COPPER",
  // Forex Majors
  EURUSD:   "OANDA:EURUSD",
  GBPUSD:   "OANDA:GBPUSD",
  USDJPY:   "OANDA:USDJPY",
  USDCHF:   "OANDA:USDCHF",
  AUDUSD:   "OANDA:AUDUSD",
  NZDUSD:   "OANDA:NZDUSD",
  USDCAD:   "OANDA:USDCAD",
  // Forex Crosses
  EURGBP:   "OANDA:EURGBP",
  EURJPY:   "OANDA:EURJPY",
  GBPJPY:   "OANDA:GBPJPY",
  AUDJPY:   "OANDA:AUDJPY",
  CADJPY:   "OANDA:CADJPY",
  CHFJPY:   "OANDA:CHFJPY",
  EURCHF:   "OANDA:EURCHF",
  EURCAD:   "OANDA:EURCAD",
  GBPCHF:   "OANDA:GBPCHF",
  GBPCAD:   "OANDA:GBPCAD",
  // Crypto
  BTCUSD:   "COINBASE:BTCUSD",
  ETHUSD:   "COINBASE:ETHUSD",
  BNBUSD:   "BINANCE:BNBUSDT",
  SOLUSD:   "COINBASE:SOLUSD",
  XRPUSD:   "COINBASE:XRPUSD",
  ADAUSD:   "COINBASE:ADAUSD",
  DOGEUSD:  "BINANCE:DOGEUSDT",
  LINKUSD:  "COINBASE:LINKUSD",
  AVAXUSD:  "COINBASE:AVAXUSD",
  // Energy
  USOUSD:   "TVC:USOIL",
  BRENTOIL: "TVC:UKOIL",
  NATGAS:   "TVC:NATURALGAS",
  // Indices
  US500:    "FOREXCOM:SPXUSD",
  US100:    "FOREXCOM:NSXUSD",
  US30:     "FOREXCOM:DJI",
  UK100:    "TVC:UKX",
  DE40:     "XETR:DAX",
  JP225:    "TVC:NI225",
  HK50:     "TVC:HSI",
  AU200:    "TVC:ASX200",
  FR40:     "EURONEXT:PX1",
};

const CATEGORIES: SymbolCategory[] = ["metal", "forex", "crypto", "energy", "index"];
const CAT_LABEL: Record<SymbolCategory, string> = {
  metal: "Metals", forex: "Forex", crypto: "Crypto", energy: "Energy", index: "Indices",
};

export default function ChartPage() {
  const { t } = useI18n();
  const [selectedId, setSelectedId]   = useState("XAUUSD");
  const [catFilter, setCatFilter]     = useState<SymbolCategory | "all">("all");
  const [search, setSearch]           = useState("");

  const selected = SYMBOLS.find(s => s.id === selectedId)!;
  const tvSym    = TV_SYMBOL[selectedId] ?? "OANDA:XAUUSD";

  const filtered = SYMBOLS.filter(s => {
    if (catFilter !== "all" && s.category !== catFilter) return false;
    if (search && !s.label.toLowerCase().includes(search.toLowerCase()) && !s.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={`กราฟ ${selected.icon} ${selected.id}`}
        subtitle={`${selected.label} · TradingView Advanced Chart · เพิ่ม indicator ได้จากแถบเครื่องมือ`}
      />

      <BeginnerHint hintKey="hintChart" />

      {/* ── Symbol picker ─────────────────────────────────────── */}
      <div className="mb-4 panel p-3">
        {/* Category filter + search */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setCatFilter("all")}
            className="rounded-lg px-3 py-1 text-xs font-bold transition-all"
            style={catFilter === "all"
              ? { background:"rgba(168,85,247,0.15)", border:"1px solid rgba(168,85,247,0.4)", color:"#a78bfa" }
              : { background:"rgba(71,85,105,0.1)", border:"1px solid rgba(71,85,105,0.2)", color:"#475569" }}>
            All
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className="rounded-lg px-3 py-1 text-xs font-bold transition-all capitalize"
              style={catFilter === cat
                ? { background:`${CATEGORY_COLOR[cat]}18`, border:`1px solid ${CATEGORY_COLOR[cat]}60`, color:CATEGORY_COLOR[cat] }
                : { background:"rgba(71,85,105,0.1)", border:"1px solid rgba(71,85,105,0.2)", color:"#475569" }}>
              {CAT_LABEL[cat]}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา…"
            className="ml-auto w-32 rounded-lg border border-base-border/30 bg-white/[0.03] px-3 py-1 text-xs text-silver/70 placeholder-silver/25 outline-none focus:border-gold/40 transition-colors" />
        </div>

        {/* Symbol grid */}
        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto [scrollbar-width:thin]">
          {filtered.map(s => {
            const active = s.id === selectedId;
            const color  = CATEGORY_COLOR[s.category];
            return (
              <button key={s.id} onClick={() => setSelectedId(s.id)}
                className="rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all whitespace-nowrap"
                style={active
                  ? { background:`${color}20`, border:`1px solid ${color}60`, color }
                  : { background:"rgba(71,85,105,0.08)", border:"1px solid rgba(71,85,105,0.18)", color:"#64748b" }}>
                {s.icon} {s.id}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <span className="text-xs text-silver/25 py-2">ไม่พบ symbol</span>
          )}
        </div>
      </div>

      {/* ── TradingView Chart ──────────────────────────────────── */}
      <GoldChart key={tvSym} tvSymbol={tvSym} />

      <p className="mt-3 text-center text-[11px] text-silver/35">{t("chartSource")}</p>
      <div className="mt-6">
        <Disclaimer />
      </div>
    </main>
  );
}
