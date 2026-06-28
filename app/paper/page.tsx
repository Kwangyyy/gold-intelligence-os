"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  STARTING_BALANCE, MIN_LOT, MAX_LOT,
  calcPnl, calcMargin, calcRisk, calcReward, suggestTp,
  calcSnapshot, calcTradeStats, checkSLTP,
  type PaperTrade, type PaperAccount, type TradeType,
} from "@/lib/paper";
import type { TradeSetup } from "@/lib/gemini";
import { PaperChart } from "@/components/PaperChart";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { useI18n } from "@/lib/i18n";

const STORAGE_KEY = "gios.paper.v2";
const POLL_MS     = 5_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt      = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const sign     = (n: number)        => n >= 0 ? "+" : "";
const pnlColor = (n: number)        => n > 0 ? "#34d399" : n < 0 ? "#f87171" : "#64748b";
const dirColor = (d: TradeSetup["direction"]) =>
  d === "buy" ? "#34d399" : d === "sell" ? "#f87171" : "#f5c451";
const confBar  = (c: number) =>
  c >= 75 ? "#34d399" : c >= 58 ? "#f5c451" : "#ef4444";

function defaultAccount(): PaperAccount { return { balance: STARTING_BALANCE, trades: [] }; }

function loadAccount(): PaperAccount {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as PaperAccount;
      if (typeof p.balance === "number" && Array.isArray(p.trades)) return p;
    }
  } catch {}
  return defaultAccount();
}
function saveAccount(acc: PaperAccount) { localStorage.setItem(STORAGE_KEY, JSON.stringify(acc)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-widest text-silver/35 mb-0.5">{label}</span>
      <span className="text-base font-black font-mono" style={{ color: color ?? "#e2e8f0" }}>{value}</span>
      {sub && <span className="text-[10px] text-silver/25 mt-0.5">{sub}</span>}
    </div>
  );
}

function TypeBadge({ type }: { type: TradeType }) {
  return (
    <span className="rounded px-2 py-0.5 text-[10px] font-black"
      style={type === "buy"
        ? { background: "rgba(16,185,129,0.18)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }
        : { background: "rgba(239,68,68,0.18)",  color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
      {type.toUpperCase()}
    </span>
  );
}

function ClosedByBadge({ by }: { by: string | null }) {
  if (!by) return null;
  const c: Record<string, string> = { manual: "#64748b", sl: "#f87171", tp: "#34d399" };
  return (
    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
      style={{ background: "rgba(71,85,105,0.2)", color: c[by] ?? "#64748b" }}>{by}</span>
  );
}

// AI Strategy banner
function StrategyBanner({ setup, onApply, onRefresh, loading }: {
  setup: TradeSetup; onApply: () => void; onRefresh: () => void; loading: boolean;
}) {
  const dir = setup.direction;
  const col = dirColor(dir);
  const dirLabel = dir === "buy" ? "▲ BUY Signal" : dir === "sell" ? "▼ SELL Signal" : "⏸ WAIT — ยังไม่มีสัญญาณ";
  const confColor = confBar(setup.confidence);
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 mb-4"
      style={{
        background: "linear-gradient(135deg, rgba(10,7,20,0.97) 0%, rgba(7,9,22,0.97) 100%)",
        border: `1px solid ${dir === "buy" ? "rgba(52,211,153,0.3)" : dir === "sell" ? "rgba(248,113,113,0.3)" : "rgba(245,196,81,0.25)"}`,
      }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-4 mb-4">
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-1">
            AI Trade Strategy · {setup.setupType}
          </div>
          <div className="text-xl font-black" style={{ color: col }}>{dirLabel}</div>
          <div className="text-xs text-silver/50 mt-1">{setup.biasTh}</div>
        </div>

        {/* Confidence */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="text-[10px] uppercase tracking-widest text-silver/35">Confidence</div>
          <div className="text-2xl font-black font-mono" style={{ color: confColor }}>{setup.confidence}%</div>
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(71,85,105,0.25)" }}>
            <div className="h-full rounded-full" style={{ width: `${setup.confidence}%`, background: confColor }} />
          </div>
        </div>
      </div>

      {/* Level pills */}
      {dir !== "wait" && setup.entry > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <LevelPill label="ENTRY" price={setup.entry} color="#f5c451" />
          <LevelPill label="SL"    price={setup.sl}    color="#ef4444" sub={`R: -$${fmt(Math.abs((setup.sl - setup.entry) * 100), 0)}/lot`} />
          <LevelPill label="TP1"   price={setup.tp1}   color="#34d399" sub={`RR 1:${setup.rr1?.toFixed(1) ?? "?"}`} />
          {setup.tp2 && <LevelPill label="TP2" price={setup.tp2} color="#6ee7b7" sub={`RR 1:${setup.rr2?.toFixed(1) ?? "?"}`} />}
          {setup.tp3 && <LevelPill label="TP3" price={setup.tp3} color="#a7f3d0" sub={`RR 1:${setup.rr3?.toFixed(1) ?? "?"}`} />}
        </div>
      )}

      {/* Reasoning + Risks */}
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-2">เหตุผล</div>
          <ul className="space-y-1.5">
            {setup.reasoningTh.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-silver/65">
                <span style={{ color: col }}>✦</span> {r}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-2">ความเสี่ยง</div>
          <ul className="space-y-1.5">
            {setup.risksTh.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-silver/65">
                <span className="text-red-400">⚠</span> {r}
              </li>
            ))}
          </ul>
          {setup.invalidationTh && (
            <div className="mt-2 text-[11px] text-red-400/60 italic">{setup.invalidationTh}</div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {dir !== "wait" && (
          <button onClick={onApply}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all"
            style={{
              background: dir === "buy"
                ? "linear-gradient(90deg,rgba(16,185,129,0.25),rgba(52,211,153,0.1))"
                : "linear-gradient(90deg,rgba(239,68,68,0.25),rgba(248,113,113,0.1))",
              border: `1px solid ${dir === "buy" ? "rgba(52,211,153,0.45)" : "rgba(248,113,113,0.45)"}`,
              color: col,
            }}>
            Apply AI Setup → {dir === "buy" ? "▲ BUY" : "▼ SELL"} @ ${setup.entry.toFixed(2)} · SL ${setup.sl.toFixed(2)} · TP ${setup.tp1.toFixed(2)}
          </button>
        )}
        <button onClick={onRefresh} disabled={loading}
          className="rounded-xl border border-base-border/30 px-3 py-2.5 text-xs text-silver/40 hover:text-silver/70 transition-colors disabled:opacity-40">
          {loading ? "…" : "↻ ใหม่"}
        </button>
      </div>
    </div>
  );
}

function LevelPill({ label, price, color, sub }: { label: string; price: number; color: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg px-3 py-1.5"
      style={{ background: "rgba(71,85,105,0.15)", border: `1px solid ${color}30` }}>
      <span className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color, opacity: 0.7 }}>{label}</span>
      <span className="text-sm font-black font-mono" style={{ color }}>${fmt(price)}</span>
      {sub && <span className="text-[9px] text-silver/35 mt-0.5">{sub}</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaperPage() {
  useI18n();

  // Account
  const [account, setAccount] = useState<PaperAccount>(() => defaultAccount());
  const accountRef = useRef(account);
  useEffect(() => { accountRef.current = account; }, [account]);

  // Price
  const [price, setPrice]       = useState(0);
  const [priceTs, setPriceTs]   = useState(0);
  const [priceStale, setPriceStale] = useState(false);

  // AI Strategy
  const [setup, setSetup]             = useState<TradeSetup | null>(null);
  const [chartCandles, setChartCandles] = useState<{ o: number; h: number; l: number; c: number }[]>([]);
  const [stratLoading, setStratLoading] = useState(true);
  const [stratError, setStratError]   = useState("");

  // Trade form
  const [tradeType, setTradeType]     = useState<TradeType>("buy");
  const [lots, setLots]               = useState(0.1);
  const [useMarket, setUseMarket]     = useState(true);
  const [customEntry, setCustomEntry] = useState("");
  const [slInput, setSlInput]         = useState("");
  const [tpInput, setTpInput]         = useState("");
  const [noteInput, setNoteInput]     = useState("");
  const [formErr, setFormErr]         = useState("");

  // UI
  const [tab, setTab]           = useState<"positions" | "stats" | "history">("positions");
  const [showForm, setShowForm] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // ── Load account ─────────────────────────────────────────────────────────
  useEffect(() => { setAccount(loadAccount()); }, []);

  // ── Fetch AI Strategy ─────────────────────────────────────────────────────
  const fetchStrategy = useCallback(async (forceRefresh = false) => {
    setStratLoading(true);
    setStratError("");
    try {
      const url = forceRefresh ? "/api/paper/strategy?refresh=1" : "/api/paper/strategy";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "strategy failed");
      setSetup(json.setup as TradeSetup);
      setChartCandles(json.candles ?? []);
    } catch (e) {
      setStratError(e instanceof Error ? e.message : "error");
    } finally {
      setStratLoading(false);
    }
  }, []);

  useEffect(() => { fetchStrategy(); }, [fetchStrategy]);

  // ── Price polling + SL/TP auto-close ─────────────────────────────────────
  useEffect(() => {
    let staleTimer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res  = await fetch("/api/price", { cache: "no-store" });
        const json = await res.json() as { price: number };
        const p    = json.price;
        if (p > 0) {
          setPrice(p);
          setPriceTs(Date.now());
          setPriceStale(false);
          clearTimeout(staleTimer);
          staleTimer = setTimeout(() => setPriceStale(true), 30_000);

          // Auto-close SL/TP
          const acc = accountRef.current;
          let newBal = acc.balance;
          let changed = false;
          const updated = acc.trades.map(t => {
            if (t.status !== "open") return t;
            const by = checkSLTP(t, p);
            if (!by) return t;
            const pnl = calcPnl(t, p);
            newBal += pnl;
            changed = true;
            return { ...t, status: "closed" as const, closedAt: new Date().toISOString(), closePrice: p, pnl, closedBy: by };
          });
          if (changed) {
            const next: PaperAccount = { balance: parseFloat(newBal.toFixed(2)), trades: updated };
            saveAccount(next);
            setAccount(next);
          }
        }
      } catch { setPriceStale(true); }
    };

    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => { clearInterval(iv); clearTimeout(staleTimer); };
  }, []);

  // ── Apply AI strategy to form ─────────────────────────────────────────────
  const applyStrategy = useCallback(() => {
    if (!setup || setup.direction === "wait") return;
    setTradeType(setup.direction);
    setUseMarket(true);
    setCustomEntry("");
    setSlInput(setup.sl.toFixed(2));
    setTpInput(setup.tp1.toFixed(2));
    setNoteInput(`AI: ${setup.setupType}`);
    setFormErr("");
    setShowForm(true);
    document.getElementById("trade-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [setup]);

  // ── Open trade ────────────────────────────────────────────────────────────
  const openTrade = useCallback(() => {
    setFormErr("");
    const entry = useMarket ? price : parseFloat(customEntry);
    if (!entry || isNaN(entry) || entry <= 0) { setFormErr("ราคา Entry ไม่ถูกต้อง"); return; }
    if (lots < MIN_LOT || lots > MAX_LOT)      { setFormErr(`Lots ต้องอยู่ระหว่าง ${MIN_LOT}–${MAX_LOT}`); return; }

    const slVal = slInput ? parseFloat(slInput) : null;
    const tpVal = tpInput ? parseFloat(tpInput) : null;
    if (slVal !== null && isNaN(slVal)) { setFormErr("SL ไม่ถูกต้อง"); return; }
    if (tpVal !== null && isNaN(tpVal)) { setFormErr("TP ไม่ถูกต้อง"); return; }
    if (slVal !== null && tradeType === "buy"  && slVal >= entry) { setFormErr("BUY: SL ต้องน้อยกว่า Entry"); return; }
    if (slVal !== null && tradeType === "sell" && slVal <= entry) { setFormErr("SELL: SL ต้องมากกว่า Entry"); return; }
    if (tpVal !== null && tradeType === "buy"  && tpVal <= entry) { setFormErr("BUY: TP ต้องมากกว่า Entry"); return; }
    if (tpVal !== null && tradeType === "sell" && tpVal >= entry) { setFormErr("SELL: TP ต้องน้อยกว่า Entry"); return; }

    const margin = calcMargin(lots);
    const acc    = accountRef.current;
    const snap   = calcSnapshot(acc, price);
    if (margin > snap.freeMargin) {
      setFormErr(`Margin ไม่พอ (ต้องการ $${fmt(margin)}, มี $${fmt(snap.freeMargin)})`);
      return;
    }

    const trade: PaperTrade = {
      id: genId(), type: tradeType, lots, entryPrice: entry,
      sl: slVal, tp: tpVal,
      openedAt: new Date().toISOString(),
      closedAt: null, closePrice: null, pnl: null, closedBy: null,
      note: noteInput, status: "open",
    };

    const next: PaperAccount = { ...acc, trades: [...acc.trades, trade] };
    saveAccount(next);
    setAccount(next);
    setShowForm(false);
    setSlInput(""); setTpInput(""); setNoteInput(""); setCustomEntry("");
    setTab("positions");
  }, [useMarket, price, customEntry, lots, slInput, tpInput, tradeType, noteInput]);

  // ── Close trade ───────────────────────────────────────────────────────────
  const closeTrade = useCallback((id: string) => {
    const acc  = accountRef.current;
    let newBal = acc.balance;
    const updated = acc.trades.map(t => {
      if (t.id !== id || t.status !== "open") return t;
      const pnl = calcPnl(t, price);
      newBal += pnl;
      return { ...t, status: "closed" as const, closedAt: new Date().toISOString(), closePrice: price, pnl, closedBy: "manual" as const };
    });
    const next: PaperAccount = { balance: parseFloat(newBal.toFixed(2)), trades: updated };
    saveAccount(next);
    setAccount(next);
  }, [price]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetAccount = useCallback(() => {
    const fresh = defaultAccount();
    saveAccount(fresh);
    setAccount(fresh);
    setShowReset(false);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const snap       = price > 0 ? calcSnapshot(account, price) : null;
  const stats      = calcTradeStats(account.trades);
  const openTrades = account.trades.filter(t => t.status === "open");
  const closedTrades = [...account.trades.filter(t => t.status === "closed")].reverse();
  const secondsAgo = price > 0 ? Math.floor((Date.now() - priceTs) / 1000) : null;

  // Form preview
  const previewEntry = useMarket ? price : parseFloat(customEntry) || 0;
  const previewSl    = parseFloat(slInput) || 0;
  const previewTp    = parseFloat(tpInput) || 0;
  const previewRisk  = previewEntry && previewSl ? calcRisk(previewEntry, previewSl, lots, tradeType) : null;
  const previewRew   = previewEntry && previewTp ? calcReward(previewEntry, previewTp, lots, tradeType) : null;
  const previewRR    = previewRisk && previewRew && previewRisk < 0
    ? (Math.abs(previewRew) / Math.abs(previewRisk)).toFixed(2) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Paper Trader"
        subtitle="AI วิเคราะห์ตลาด · กราฟแสดงจุด Entry / SL / TP · ฝึกเทรดด้วยเงินจริง $10,000 virtual"
      />

      {/* ── AI Strategy + Chart ────────────────────────────────────────────── */}
      <div className="mb-5">
        {/* Chart */}
        <PaperChart
          candles={chartCandles}
          price={price}
          setup={setup}
          openTrades={openTrades}
          loading={stratLoading && chartCandles.length === 0}
        />

        {stratError && (
          <div className="mt-3 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2.5 text-sm text-red-400">
            ⚠ Strategy: {stratError}
          </div>
        )}

        {/* Strategy banner */}
        {setup ? (
          <div className="mt-3">
            <StrategyBanner
              setup={setup}
              onApply={applyStrategy}
              onRefresh={() => fetchStrategy(true)}
              loading={stratLoading}
            />
          </div>
        ) : stratLoading ? (
          <div className="mt-3 h-24 animate-pulse rounded-2xl" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }} />
        ) : null}
      </div>

      {/* ── Account Summary ────────────────────────────────────────────────── */}
      <div
        className="mb-5 rounded-2xl p-4 sm:p-5"
        style={{
          background: "linear-gradient(135deg, rgba(12,8,26,0.97) 0%, rgba(7,9,22,0.97) 100%)",
          border: "1px solid rgba(168,85,247,0.22)",
        }}
      >
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          {/* Live price */}
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-widest text-silver/35 mb-0.5">
              XAUUSD {priceStale && <span className="text-amber-400">(stale)</span>}
            </span>
            <span className="text-2xl font-black font-mono" style={{ color: "#f5c451" }}>
              {price > 0 ? `$${fmt(price)}` : "—"}
            </span>
            <span className="text-[9px] text-silver/25">
              {secondsAgo !== null ? `${secondsAgo}s ago` : "polling…"}
            </span>
          </div>

          {snap ? (
            <>
              <StatBox label="Balance"     value={`$${fmt(account.balance)}`} />
              <StatBox label="Equity"      value={`$${fmt(snap.equity)}`}
                color={snap.equity >= account.balance ? "#34d399" : "#f87171"} />
              <StatBox label="Float P&L"   value={`${sign(snap.floatingPnl)}$${fmt(Math.abs(snap.floatingPnl))}`}
                color={pnlColor(snap.floatingPnl)} />
              <StatBox label="Free Margin" value={`$${fmt(snap.freeMargin)}`} />
              {snap.usedMargin > 0 && <StatBox label="Margin Used" value={`$${fmt(snap.usedMargin)}`} />}
            </>
          ) : (
            <span className="text-xs text-silver/40 animate-pulse">กำลังโหลด…</span>
          )}

          <div className="ml-auto flex items-start gap-2">
            <button
              id="trade-form"
              onClick={() => { setShowForm(v => !v); setFormErr(""); }}
              className="rounded-xl px-4 py-2 text-sm font-bold transition-colors"
              style={showForm
                ? { background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc" }
                : { background: "rgba(245,196,81,0.15)", border: "1px solid rgba(245,196,81,0.4)", color: "#f5c451" }}>
              {showForm ? "✕ ปิด" : "+ เปิดออเดอร์"}
            </button>
            <button onClick={() => setShowReset(true)}
              className="rounded-xl border border-base-border/30 px-3 py-2 text-xs text-silver/40 hover:text-red-400 transition-colors">
              รีเซ็ต
            </button>
          </div>
        </div>
      </div>

      {/* Reset confirm */}
      {showReset && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4">
          <span className="text-sm text-red-400">รีเซ็ตบัญชีกลับ $10,000?</span>
          <button onClick={resetAccount}
            className="rounded-lg border border-red-400/40 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400">ยืนยัน</button>
          <button onClick={() => setShowReset(false)} className="text-xs text-silver/40">ยกเลิก</button>
        </div>
      )}

      {/* ── Trade Form ─────────────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="mb-5 rounded-2xl p-5"
          style={{ border: "1px solid rgba(245,196,81,0.25)", background: "rgba(12,8,26,0.92)" }}
        >
          <h2 className="mb-4 text-sm font-bold text-gold">เปิดออเดอร์ใหม่</h2>

          {/* BUY / SELL */}
          <div className="mb-4 flex gap-3">
            {(["buy", "sell"] as TradeType[]).map(t => (
              <button key={t} onClick={() => setTradeType(t)}
                className="flex-1 rounded-xl py-3 text-base font-black transition-all"
                style={tradeType === t
                  ? t === "buy"
                    ? { background: "rgba(16,185,129,0.25)", border: "2px solid #34d399", color: "#34d399" }
                    : { background: "rgba(239,68,68,0.25)",  border: "2px solid #f87171", color: "#f87171" }
                  : { background: "rgba(71,85,105,0.12)", border: "1px solid rgba(71,85,105,0.3)", color: "#475569" }}>
                {t === "buy" ? "▲ BUY" : "▼ SELL"}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Lots */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-silver/50">Lot Size</label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[0.01, 0.05, 0.1, 0.5, 1.0].map(l => (
                  <button key={l} onClick={() => setLots(l)}
                    className="rounded px-2 py-1 text-[10px] font-bold transition-colors"
                    style={lots === l
                      ? { background: "rgba(245,196,81,0.2)", border: "1px solid rgba(245,196,81,0.5)", color: "#f5c451" }
                      : { background: "rgba(71,85,105,0.1)",  border: "1px solid rgba(71,85,105,0.2)", color: "#64748b" }}>
                    {l}
                  </button>
                ))}
              </div>
              <input type="number" min={MIN_LOT} max={MAX_LOT} step={0.01} value={lots}
                onChange={e => setLots(parseFloat(e.target.value) || MIN_LOT)}
                className="w-full rounded-lg border border-base-border/40 bg-base-panel/60 px-3 py-2 font-mono text-sm text-silver focus:border-gold/50 focus:outline-none" />
              <div className="mt-1 text-[10px] text-silver/30">Margin: ${fmt(calcMargin(lots))}</div>
            </div>

            {/* Entry */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-silver/50">Entry Price</label>
              <div className="mb-2 flex gap-2">
                {[true, false].map(m => (
                  <button key={String(m)} onClick={() => setUseMarket(m)}
                    className="rounded px-2 py-1 text-[10px] font-bold transition-colors"
                    style={useMarket === m
                      ? { background: "rgba(245,196,81,0.2)", border: "1px solid rgba(245,196,81,0.5)", color: "#f5c451" }
                      : { background: "rgba(71,85,105,0.1)",  border: "1px solid rgba(71,85,105,0.2)", color: "#64748b" }}>
                    {m ? `Market $${price > 0 ? fmt(price) : "…"}` : "Custom"}
                  </button>
                ))}
              </div>
              {!useMarket && (
                <input type="number" step={0.01} placeholder="ราคา Entry" value={customEntry}
                  onChange={e => setCustomEntry(e.target.value)}
                  className="w-full rounded-lg border border-base-border/40 bg-base-panel/60 px-3 py-2 font-mono text-sm text-silver focus:border-gold/50 focus:outline-none" />
              )}
            </div>

            {/* SL */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-silver/50">Stop Loss</label>
              <input type="number" step={0.01} placeholder="ราคา SL" value={slInput}
                onChange={e => setSlInput(e.target.value)}
                className="w-full rounded-lg border border-red-400/20 bg-base-panel/60 px-3 py-2 font-mono text-sm text-red-300 focus:border-red-400/50 focus:outline-none" />
              {previewRisk !== null && (
                <div className="mt-1 text-[10px]" style={{ color: pnlColor(previewRisk) }}>
                  Risk: {sign(previewRisk)}${fmt(Math.abs(previewRisk))}
                </div>
              )}
            </div>

            {/* TP */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-silver/50">Take Profit</label>
              <input type="number" step={0.01} placeholder="ราคา TP" value={tpInput}
                onChange={e => setTpInput(e.target.value)}
                className="w-full rounded-lg border border-emerald-400/20 bg-base-panel/60 px-3 py-2 font-mono text-sm text-emerald-300 focus:border-emerald-400/50 focus:outline-none" />
              {previewEntry > 0 && previewSl > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {[1, 1.5, 2, 3].map(rr => (
                    <button key={rr}
                      onClick={() => setTpInput(suggestTp(previewEntry, previewSl, tradeType, rr).toString())}
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#6ee7b7" }}>
                      1:{rr}
                    </button>
                  ))}
                </div>
              )}
              {previewRew !== null && (
                <div className="mt-1 text-[10px]" style={{ color: pnlColor(previewRew) }}>
                  Reward: {sign(previewRew)}${fmt(Math.abs(previewRew))}
                  {previewRR && <span className="ml-1 text-silver/35">RR 1:{previewRR}</span>}
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-silver/50">Note</label>
              <input type="text" placeholder="เหตุผลการเข้าเทรด…" value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                className="w-full rounded-lg border border-base-border/40 bg-base-panel/60 px-3 py-2 text-sm text-silver/70 focus:border-gold/30 focus:outline-none" />
            </div>
          </div>

          {formErr && (
            <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-400">
              ⚠ {formErr}
            </div>
          )}

          <button onClick={openTrade} disabled={price === 0}
            className="mt-4 w-full rounded-xl py-3 text-sm font-black transition-all disabled:opacity-40"
            style={tradeType === "buy"
              ? { background: "linear-gradient(90deg,rgba(16,185,129,0.3),rgba(52,211,153,0.15))", border: "1px solid rgba(52,211,153,0.5)", color: "#34d399" }
              : { background: "linear-gradient(90deg,rgba(239,68,68,0.3),rgba(248,113,113,0.15))",  border: "1px solid rgba(248,113,113,0.5)", color: "#f87171" }}>
            {tradeType === "buy" ? "▲ เปิด BUY" : "▼ เปิด SELL"} · {lots} lot
            {previewEntry > 0 ? ` @ $${fmt(previewEntry)}` : ""}
          </button>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex gap-1">
        {([
          ["positions", `Positions (${openTrades.length})`],
          ["stats",     "Stats"],
          ["history",   `History (${closedTrades.length})`],
        ] as [typeof tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="rounded-lg px-4 py-2 text-xs font-bold transition-colors"
            style={tab === key
              ? { background: "rgba(245,196,81,0.15)", border: "1px solid rgba(245,196,81,0.4)", color: "#f5c451" }
              : { background: "transparent", border: "1px solid rgba(71,85,105,0.25)", color: "#475569" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Positions ─────────────────────────────────────────────────────── */}
      {tab === "positions" && (
        <div className="panel overflow-hidden">
          {openTrades.length === 0 ? (
            <div className="py-12 text-center text-sm text-silver/30">
              ยังไม่มีออเดอร์เปิด · กด &ldquo;Apply AI Setup&rdquo; หรือ &ldquo;+ เปิดออเดอร์&rdquo;
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-base-border/30 text-[10px] uppercase tracking-widest text-silver/35">
                    {["Type","Lots","Entry","ราคา","SL","TP","P&L $","P&L %","เวลา",""].map(h => (
                      <th key={h} className="px-2 pb-2 pt-1 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map(t => {
                    const fp  = price > 0 ? calcPnl(t, price) : 0;
                    const pct = (fp / account.balance) * 100;
                    const dur = Math.floor((Date.now() - new Date(t.openedAt).getTime()) / 60_000);
                    const ds  = dur < 60 ? `${dur}m` : `${Math.floor(dur / 60)}h ${dur % 60}m`;
                    return (
                      <tr key={t.id} className="border-b border-base-border/15 transition-colors hover:bg-white/[0.015]">
                        <td className="px-2 py-2"><TypeBadge type={t.type} /></td>
                        <td className="px-2 py-2 font-mono text-silver/70">{t.lots}</td>
                        <td className="px-2 py-2 font-mono text-silver/70">{fmt(t.entryPrice)}</td>
                        <td className="px-2 py-2 font-mono font-bold" style={{ color: "#f5c451" }}>
                          {price > 0 ? fmt(price) : "—"}
                        </td>
                        <td className="px-2 py-2 font-mono text-red-400/70">{t.sl ? fmt(t.sl) : "—"}</td>
                        <td className="px-2 py-2 font-mono text-emerald-400/70">{t.tp ? fmt(t.tp) : "—"}</td>
                        <td className="px-2 py-2 font-mono text-sm font-black" style={{ color: pnlColor(fp) }}>
                          {sign(fp)}${fmt(Math.abs(fp))}
                        </td>
                        <td className="px-2 py-2 font-mono" style={{ color: pnlColor(pct) }}>
                          {sign(pct)}{fmt(Math.abs(pct), 2)}%
                        </td>
                        <td className="px-2 py-2 text-silver/30">{ds}</td>
                        <td className="px-2 py-2">
                          <button onClick={() => closeTrade(t.id)}
                            className="rounded border border-red-400/20 px-2 py-1 text-[10px] font-bold text-red-400/70 transition-colors hover:bg-red-400/10">
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      {tab === "stats" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="panel p-5">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-silver/50">Performance</h3>
            {stats.totalTrades === 0 ? (
              <div className="py-8 text-center text-sm text-silver/30">ยังไม่มีออเดอร์ปิด</div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {[
                  { label: "Total Trades",   value: stats.totalTrades.toString() },
                  { label: "Win Rate",       value: `${stats.winRate}%`, color: stats.winRate > 50 ? "#34d399" : "#f87171" },
                  { label: "Wins",           value: stats.wins.toString(),   color: "#34d399" },
                  { label: "Losses",         value: stats.losses.toString(), color: "#f87171" },
                  { label: "Avg Win",        value: `+$${fmt(stats.avgWin)}`,  color: "#34d399" },
                  { label: "Avg Loss",       value: `$${fmt(stats.avgLoss)}`,  color: "#f87171" },
                  { label: "Profit Factor",  value: stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1 ? "#34d399" : "#f87171" },
                  { label: "Total P&L",      value: `${sign(stats.totalPnl)}$${fmt(Math.abs(stats.totalPnl))}`, color: pnlColor(stats.totalPnl) },
                  { label: "Best Trade",     value: `+$${fmt(stats.bestTrade)}`,  color: "#34d399" },
                  { label: "Worst Trade",    value: `-$${fmt(Math.abs(stats.worstTrade))}`, color: "#f87171" },
                ].map(row => (
                  <div key={row.label}>
                    <div className="text-[10px] uppercase tracking-widest text-silver/35">{row.label}</div>
                    <div className="mt-0.5 font-mono text-base font-black" style={{ color: row.color ?? "#e2e8f0" }}>{row.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel flex flex-col items-center justify-center p-5">
            {stats.totalTrades === 0 ? (
              <div className="text-center text-sm text-silver/30">เริ่มเทรดเพื่อดู Stats</div>
            ) : (
              <>
                <div className="mb-3 text-[10px] uppercase tracking-widest text-silver/35">Win Rate</div>
                <svg width={140} height={140} viewBox="0 0 140 140">
                  <circle cx={70} cy={70} r={55} fill="none" stroke="rgba(71,85,105,0.2)" strokeWidth={12} />
                  <circle cx={70} cy={70} r={55} fill="none"
                    stroke={stats.winRate >= 50 ? "#34d399" : "#f87171"}
                    strokeWidth={12} strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 55}`}
                    strokeDashoffset={`${2 * Math.PI * 55 * (1 - stats.winRate / 100)}`}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                  <text x={70} y={66} textAnchor="middle" fontSize={26} fontWeight="900"
                    fill={stats.winRate >= 50 ? "#34d399" : "#f87171"}
                    fontFamily="ui-monospace,monospace">{stats.winRate}%</text>
                  <text x={70} y={84} textAnchor="middle" fontSize={10} fill="rgba(148,163,184,0.5)">
                    {stats.wins}W / {stats.losses}L
                  </text>
                </svg>
                <div className="mt-3 text-center">
                  <div className="text-xl font-black font-mono" style={{ color: pnlColor(stats.totalPnl) }}>
                    {sign(stats.totalPnl)}${fmt(Math.abs(stats.totalPnl))}
                  </div>
                  <div className="mt-0.5 text-[11px] text-silver/30">
                    PF {stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : "—"}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── History ───────────────────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="panel overflow-hidden">
          {closedTrades.length === 0 ? (
            <div className="py-12 text-center text-sm text-silver/30">ยังไม่มีออเดอร์ปิด</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-base-border/30 text-[10px] uppercase tracking-widest text-silver/35">
                    {["Type","Lots","Entry","Close","P&L","ปิดโดย","เวลาเปิด","Note"].map(h => (
                      <th key={h} className="px-2 pb-2 pt-1 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map(t => (
                    <tr key={t.id} className="border-b border-base-border/15 transition-colors hover:bg-white/[0.015]">
                      <td className="px-2 py-2"><TypeBadge type={t.type} /></td>
                      <td className="px-2 py-2 font-mono text-silver/60">{t.lots}</td>
                      <td className="px-2 py-2 font-mono text-silver/60">{fmt(t.entryPrice)}</td>
                      <td className="px-2 py-2 font-mono text-silver/60">{t.closePrice ? fmt(t.closePrice) : "—"}</td>
                      <td className="px-2 py-2 font-mono font-black" style={{ color: pnlColor(t.pnl ?? 0) }}>
                        {t.pnl !== null ? `${sign(t.pnl)}$${fmt(Math.abs(t.pnl))}` : "—"}
                      </td>
                      <td className="px-2 py-2"><ClosedByBadge by={t.closedBy} /></td>
                      <td className="px-2 py-2 whitespace-nowrap text-silver/30">
                        {new Date(t.openedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="max-w-[120px] truncate px-2 py-2 text-silver/40">{t.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mt-6"><Disclaimer /></div>
    </div>
  );
}
