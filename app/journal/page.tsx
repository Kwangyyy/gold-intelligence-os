"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  computeTrade,
  computeStats,
  exportCSV,
  loadTrades,
  saveTrades,
  type JournalStats,
  type TradeDirection,
  type TradeEntry,
  type TradeResult,
  type TradeSetup,
} from "@/lib/journal";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";

interface AiReview {
  rating: number;
  strengths: string[];
  weaknesses: string[];
  bestSetup: string;
  recommendations: string[];
  summaryTh: string;
  summaryEn: string;
}

interface SummaryPayload {
  totalClosed: number;
  winRate: number;
  totalPnL: number;
  avgRR: number;
  profitFactor: number;
  bySetup: Record<string, { trades: number; wins: number; pnl: number }>;
  byDirection: { buy: { trades: number; wins: number; pnl: number }; sell: { trades: number; wins: number; pnl: number } };
  recentNotes: string[];
}

function buildSummary(trs: TradeEntry[], st: JournalStats): SummaryPayload {
  const bySetup: Record<string, { trades: number; wins: number; pnl: number }> = {};
  const byDirection = { buy: { trades: 0, wins: 0, pnl: 0 }, sell: { trades: 0, wins: 0, pnl: 0 } };
  const recentNotes: string[] = [];
  for (const tr of trs) {
    if (tr.result === "running") continue;
    if (!bySetup[tr.setup]) bySetup[tr.setup] = { trades: 0, wins: 0, pnl: 0 };
    bySetup[tr.setup].trades++;
    if (tr.result === "win") bySetup[tr.setup].wins++;
    bySetup[tr.setup].pnl += tr.pnlUSD ?? 0;
    byDirection[tr.direction].trades++;
    if (tr.result === "win") byDirection[tr.direction].wins++;
    byDirection[tr.direction].pnl += tr.pnlUSD ?? 0;
    if (tr.notes && recentNotes.length < 8) recentNotes.push(tr.notes.slice(0, 80));
  }
  return { totalClosed: st.closedTrades, winRate: st.winRate, totalPnL: st.totalPnL, avgRR: st.avgRR, profitFactor: st.profitFactor, bySetup, byDirection, recentNotes };
}

const PAGE_SIZE = 20;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  return n >= 0 ? `+${n.toFixed(dec)}` : n.toFixed(dec);
}

function fmtPnl(n: number | null): string {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

const RESULT_STYLE: Record<TradeResult, string> = {
  win: "text-emerald-400",
  loss: "text-red-400",
  breakeven: "text-silver/60",
  running: "text-amber-400",
};

const RESULT_LABEL: Record<TradeResult, { th: string; en: string }> = {
  win: { th: "ชนะ", en: "Win" },
  loss: { th: "แพ้", en: "Loss" },
  breakeven: { th: "เสมอ", en: "B/E" },
  running: { th: "เปิดอยู่", en: "Running" },
};

const SETUP_OPTS: TradeSetup[] = ["smc", "sr", "breakout", "trend", "news", "pattern", "other"];
const SETUP_LABEL: Record<TradeSetup, string> = {
  smc: "SMC", sr: "S/R", breakout: "Breakout", trend: "Trend",
  news: "News", pattern: "Pattern", other: "Other",
};

// ── Mini equity curve SVG ───────────────────────────────────────────────────

function EquityCurve({ data }: { data: number[] }) {
  if (data.length < 2) return (
    <div className="flex h-28 items-center justify-center text-xs text-silver/30">ต้องการอย่างน้อย 2 ไม้ที่ปิดแล้ว</div>
  );
  const W = 600; const H = 100;
  const min = Math.min(0, ...data);
  const max = Math.max(0, ...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => (i / (data.length - 1)) * W);
  const ys = data.map((v) => H - ((v - min) / range) * H);
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const zeroY = H - ((0 - min) / range) * H;
  const fill = `M${xs[0]},${zeroY} ` + xs.map((x, i) => `L${x},${ys[i]}`).join(" ") + ` L${xs[xs.length - 1]},${zeroY} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ecgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5c451" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f5c451" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
      <path d={fill} fill="url(#ecgrad)" />
      <polyline points={pts} fill="none" stroke="#f5c451" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Stats bar ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="panel flex flex-col gap-1 p-4">
      <div className="stat-label">{label}</div>
      <div className={`text-2xl font-bold ${color ?? "text-gold"}`}>{value}</div>
      {sub && <div className="text-xs text-silver/40">{sub}</div>}
    </div>
  );
}

// ── Trade form (add & edit) ─────────────────────────────────────────────────

interface FormState {
  direction: TradeDirection;
  entryPrice: string;
  exitPrice: string;
  stopLoss: string;
  takeProfit: string;
  lotSize: string;
  openTime: string;
  closeTime: string;
  setup: TradeSetup;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  direction: "buy",
  entryPrice: "",
  exitPrice: "",
  stopLoss: "",
  takeProfit: "",
  lotSize: "0.01",
  openTime: "",
  closeTime: "",
  setup: "smc",
  notes: "",
};

function now8(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function tradeToForm(tr: TradeEntry): FormState {
  const toLocal = (iso: string | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  return {
    direction: tr.direction,
    entryPrice: String(tr.entryPrice),
    exitPrice: tr.exitPrice != null ? String(tr.exitPrice) : "",
    stopLoss: tr.stopLoss != null ? String(tr.stopLoss) : "",
    takeProfit: tr.takeProfit != null ? String(tr.takeProfit) : "",
    lotSize: String(tr.lotSize),
    openTime: toLocal(tr.openTime),
    closeTime: toLocal(tr.closeTime),
    setup: tr.setup,
    notes: tr.notes ?? "",
  };
}

function TradeForm({
  initialTrade,
  onSave,
  onClose,
}: {
  initialTrade?: TradeEntry;
  onSave: (entry: TradeEntry) => void;
  onClose: () => void;
}) {
  const isEdit = !!initialTrade;
  const [form, setForm] = useState<FormState>(
    initialTrade ? tradeToForm(initialTrade) : { ...DEFAULT_FORM, openTime: now8() }
  );
  const id = useId();

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const entry = computeTrade({
      symbol: "XAUUSD",
      direction: form.direction,
      entryPrice: parseFloat(form.entryPrice) || 0,
      exitPrice: form.exitPrice ? parseFloat(form.exitPrice) : undefined,
      stopLoss: form.stopLoss ? parseFloat(form.stopLoss) : undefined,
      takeProfit: form.takeProfit ? parseFloat(form.takeProfit) : undefined,
      lotSize: parseFloat(form.lotSize) || 0.01,
      openTime: new Date(form.openTime).toISOString(),
      closeTime: form.closeTime ? new Date(form.closeTime).toISOString() : undefined,
      setup: form.setup,
      notes: form.notes,
    });
    onSave({ ...entry, id: initialTrade?.id ?? uid() });
    onClose();
  }

  const labelCls = "block text-[11px] uppercase tracking-widest text-silver/40 mb-1";
  const inputCls = "w-full rounded-lg border border-base-border bg-base-panel px-3 py-2 text-sm text-silver focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20";

  return (
    <div className="panel mb-4 border-gold/30 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gradient-royal">
          {isEdit ? "แก้ไขไม้เทรด" : "บันทึกไม้เทรด"}
        </h2>
        <button onClick={onClose} className="text-silver/40 hover:text-silver text-lg leading-none">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Direction */}
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>ทิศทาง</label>
          <div className="flex gap-2">
            {(["buy", "sell"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("direction", d)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                  form.direction === d
                    ? d === "buy"
                      ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
                      : "border-red-500/60 bg-red-500/20 text-red-400"
                    : "border-base-border text-silver/50 hover:text-silver"
                }`}
              >
                {d === "buy" ? "▲ BUY" : "▼ SELL"}
              </button>
            ))}
          </div>
        </div>

        {/* Setup */}
        <div>
          <label className={labelCls}>Setup</label>
          <select value={form.setup} onChange={(e) => set("setup", e.target.value as TradeSetup)} className={inputCls}>
            {SETUP_OPTS.map((s) => <option key={s} value={s}>{SETUP_LABEL[s]}</option>)}
          </select>
        </div>

        {/* Lot size */}
        <div>
          <label className={labelCls}>ขนาดล็อต</label>
          <input id={`${id}-lots`} type="number" step="0.01" min="0.01" value={form.lotSize} onChange={(e) => set("lotSize", e.target.value)} required className={inputCls} />
        </div>

        {/* Entry */}
        <div>
          <label className={labelCls}>ราคาเข้า *</label>
          <input type="number" step="0.01" value={form.entryPrice} onChange={(e) => set("entryPrice", e.target.value)} required className={inputCls} placeholder="3250.00" />
        </div>

        {/* Exit */}
        <div>
          <label className={labelCls}>ราคาออก</label>
          <input type="number" step="0.01" value={form.exitPrice} onChange={(e) => set("exitPrice", e.target.value)} className={inputCls} placeholder="ยังเปิดอยู่" />
        </div>

        {/* SL */}
        <div>
          <label className={labelCls}>Stop Loss</label>
          <input type="number" step="0.01" value={form.stopLoss} onChange={(e) => set("stopLoss", e.target.value)} className={inputCls} />
        </div>

        {/* TP */}
        <div>
          <label className={labelCls}>Take Profit</label>
          <input type="number" step="0.01" value={form.takeProfit} onChange={(e) => set("takeProfit", e.target.value)} className={inputCls} />
        </div>

        {/* Open time */}
        <div>
          <label className={labelCls}>เวลาเปิด *</label>
          <input type="datetime-local" value={form.openTime} onChange={(e) => set("openTime", e.target.value)} required className={inputCls} />
        </div>

        {/* Close time */}
        <div>
          <label className={labelCls}>เวลาปิด</label>
          <input type="datetime-local" value={form.closeTime} onChange={(e) => set("closeTime", e.target.value)} className={inputCls} />
        </div>

        {/* Notes */}
        <div className="col-span-2 sm:col-span-3">
          <label className={labelCls}>หมายเหตุ / เหตุผล</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="เหตุผลเข้า, บทเรียน…" />
        </div>

        {/* Submit */}
        <div className="col-span-2 flex justify-end gap-2 sm:col-span-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-base-border px-4 py-2 text-sm text-silver/50 hover:text-silver transition-colors">
            ยกเลิก
          </button>
          <button type="submit" className="btn-primary px-6 py-2 text-sm">
            {isEdit ? "บันทึกการแก้ไข" : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Trade row ───────────────────────────────────────────────────────────────

function TradeRow({
  t: trade,
  onDelete,
  onEdit,
  lang,
}: {
  t: TradeEntry;
  onDelete: () => void;
  onEdit: () => void;
  lang: "th" | "en";
}) {
  const pnlColor = trade.pnlUSD == null ? "text-amber-400" : trade.pnlUSD > 0 ? "text-emerald-400" : trade.pnlUSD < 0 ? "text-red-400" : "text-silver/50";

  return (
    <tr className="border-t border-base-border/40 hover:bg-base-panel/30 transition-colors text-xs">
      <td className="py-2 px-2 text-silver/50">{trade.openTime.slice(0, 10)}</td>
      <td className={`py-2 px-2 font-bold ${trade.direction === "buy" ? "text-emerald-400" : "text-red-400"}`}>
        {trade.direction === "buy" ? "▲" : "▼"} {trade.direction.toUpperCase()}
      </td>
      <td className="py-2 px-2 text-silver">{trade.entryPrice.toFixed(2)}</td>
      <td className="py-2 px-2 text-silver/70">{trade.exitPrice?.toFixed(2) ?? "—"}</td>
      <td className="py-2 px-2 text-silver/50">{trade.stopLoss?.toFixed(2) ?? "—"}</td>
      <td className="py-2 px-2 text-silver/50">{trade.takeProfit?.toFixed(2) ?? "—"}</td>
      <td className="py-2 px-2 text-silver/70">{trade.lotSize}</td>
      <td className={`py-2 px-2 font-semibold ${pnlColor}`}>
        {trade.pnlUSD != null ? fmtPnl(trade.pnlUSD) : "—"}
      </td>
      <td className="py-2 px-2 text-silver/60">{trade.rr != null ? `1:${trade.rr}` : "—"}</td>
      <td className="py-2 px-2 text-silver/50">{SETUP_LABEL[trade.setup]}</td>
      <td className={`py-2 px-2 font-medium ${RESULT_STYLE[trade.result]}`}>
        {lang === "th" ? RESULT_LABEL[trade.result].th : RESULT_LABEL[trade.result].en}
      </td>
      <td className="py-2 px-2 max-w-[120px] truncate text-silver/40" title={trade.notes}>{trade.notes || "—"}</td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="rounded border border-base-border px-2 py-0.5 text-[11px] text-silver/50 hover:text-neon hover:border-neon/40 transition-colors"
          >
            ✎
          </button>
          <button onClick={onDelete} className="text-silver/30 hover:text-red-400 transition-colors text-base">✕</button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function JournalPage() {
  const { t, lang } = useI18n();
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [aiData, setAiData] = useState<AiReview | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  async function importFromMT5() {
    setImporting(true);
    setImportMsg("");
    try {
      const r = await fetch("/api/mt5/import-journal");
      const d = await r.json() as { trades: TradeEntry[]; count?: number; message?: string };
      if (!d.trades?.length) {
        setImportMsg(d.message ?? "ไม่มี trade history จาก MT5 Bridge");
        return;
      }
      const existing = loadTrades();
      const existingIds = new Set(existing.map(t => t.id));
      const newTrades = d.trades.filter(t => !existingIds.has(t.id));
      if (newTrades.length === 0) {
        setImportMsg("ไม่มี trade ใหม่ — ทุก trade import แล้ว");
        return;
      }
      const merged = [...existing, ...newTrades].sort(
        (a, b) => new Date(b.openTime).getTime() - new Date(a.openTime).getTime()
      );
      saveTrades(merged);
      setTrades(merged);
      setImportMsg(`✓ Import ${newTrades.length} trades จาก MT5`);
    } catch (e) {
      setImportMsg("Error: " + String(e));
    } finally {
      setImporting(false);
      setTimeout(() => setImportMsg(""), 5000);
    }
  }

  useEffect(() => {
    setTrades(loadTrades());
    setMounted(true);
  }, []);

  const addTrade = useCallback((entry: TradeEntry) => {
    setTrades((prev) => {
      const next = [entry, ...prev];
      saveTrades(next);
      return next;
    });
  }, []);

  const updateTrade = useCallback((entry: TradeEntry) => {
    setTrades((prev) => {
      const next = prev.map((tr) => tr.id === entry.id ? entry : tr);
      saveTrades(next);
      return next;
    });
    setEditId(null);
  }, []);

  const deleteTrade = useCallback((id: string) => {
    if (!confirm(t("journalConfirmDelete"))) return;
    setTrades((prev) => {
      const next = prev.filter((tr) => tr.id !== id);
      saveTrades(next);
      return next;
    });
  }, [t]);

  const stats: JournalStats = computeStats(trades);

  async function runAiReview() {
    setAiLoading(true);
    setAiError(false);
    try {
      const res = await fetch("/api/journal/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSummary(trades, stats)),
      });
      if (!res.ok) throw new Error();
      setAiData(await res.json());
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  }

  if (!mounted) return null;

  const pnlColor = stats.totalPnL > 0 ? "text-emerald-400" : stats.totalPnL < 0 ? "text-red-400" : "text-silver";
  const totalPages = Math.max(1, Math.ceil(trades.length / PAGE_SIZE));
  const pageTrades = trades.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const editingTrade = editId ? trades.find((tr) => tr.id === editId) : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={t("journalTitle")}
        subtitle={t("journalSubtitle")}
        right={
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <button
                onClick={importFromMT5} disabled={importing}
                className="rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-40"
                style={{ borderColor: "rgba(96,165,250,0.3)", color: "#60a5fa" }}
                title="Import closed trades จาก MT5 Bridge"
              >
                {importing ? "กำลัง import…" : "🔌 Import MT5"}
              </button>
              {trades.length > 0 && (
                <button
                  onClick={() => exportCSV(trades)}
                  className="rounded-lg border border-base-border px-3 py-1.5 text-xs text-silver/60 hover:text-silver hover:border-silver/30 transition-colors"
                >
                  {t("journalExport")}
                </button>
              )}
              <button
                onClick={() => { setShowForm(true); setEditId(null); }}
                className="btn-primary px-4 py-1.5 text-sm"
              >
                + {t("journalAddTrade")}
              </button>
            </div>
            {importMsg && (
              <div className="text-[11px]" style={{ color: importMsg.startsWith("✓") ? "#34d399" : "#f5c451" }}>
                {importMsg}
              </div>
            )}
          </div>
        }
      />

      {/* Add form */}
      {showForm && !editId && (
        <TradeForm onSave={addTrade} onClose={() => setShowForm(false)} />
      )}

      {/* Edit form */}
      {editId && editingTrade && (
        <TradeForm
          initialTrade={editingTrade}
          onSave={updateTrade}
          onClose={() => setEditId(null)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard
          label={t("journalTotalTrades")}
          value={String(stats.totalTrades)}
          sub={`${stats.closedTrades} ปิดแล้ว`}
          color="text-silver"
        />
        <StatCard
          label={t("journalWinRate")}
          value={`${stats.winRate}%`}
          sub={`${stats.winCount}W / ${stats.lossCount}L`}
          color={stats.winRate >= 50 ? "text-emerald-400" : "text-red-400"}
        />
        <StatCard
          label={t("journalTotalPnL")}
          value={`${fmtPnl(stats.totalPnL)} $`}
          color={pnlColor}
        />
        <StatCard
          label={t("journalAvgRR")}
          value={stats.avgRR > 0 ? `1:${stats.avgRR}` : "—"}
          color={stats.avgRR >= 1.5 ? "text-emerald-400" : "text-silver"}
        />
        <StatCard
          label={t("journalProfitFactor")}
          value={stats.profitFactor > 0 ? String(stats.profitFactor) : "—"}
          color={stats.profitFactor >= 1.5 ? "text-emerald-400" : stats.profitFactor > 0 && stats.profitFactor < 1 ? "text-red-400" : "text-silver"}
        />
        <StatCard
          label={t("journalMaxDD")}
          value={stats.maxDrawdown > 0 ? `-$${stats.maxDrawdown.toFixed(2)}` : "—"}
          color={stats.maxDrawdown > 500 ? "text-red-400" : "text-silver"}
        />
      </div>

      {/* Equity curve */}
      {stats.equityCurve.length >= 2 && (
        <div className="panel p-4">
          <div className="stat-label mb-3">{t("journalEquityCurve")}</div>
          <EquityCurve data={stats.equityCurve} />
          <div className="mt-2 flex justify-between text-[10px] text-silver/30">
            <span>{t("journalBestTrade")}: {fmt(stats.bestTrade)} $</span>
            <span>{t("journalWorstTrade")}: {fmt(stats.worstTrade)} $</span>
          </div>
        </div>
      )}

      {/* AI Review panel */}
      {stats.closedTrades >= 3 && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="stat-label">{t("journalAiBtn")}</div>
              <p className="text-[11px] text-silver/40 mt-0.5">วิเคราะห์ pattern การเทรดด้วย AI Gemini</p>
            </div>
            <button
              onClick={runAiReview}
              disabled={aiLoading}
              className={`rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors ${
                aiLoading ? "opacity-50 border-royal/30 text-royal/60" : "border-royal/50 text-royal hover:bg-royal/10"
              }`}
            >
              {aiLoading ? t("journalAiLoading") : aiData ? t("journalAiRefresh") : t("journalAiBtn")}
            </button>
          </div>

          {aiError && (
            <p className="text-xs text-red-400">{t("journalAiError")}</p>
          )}

          {aiData && !aiError && (
            <div className="space-y-4">
              {/* Rating + summary */}
              <div className="flex items-start gap-4">
                <div className={`text-5xl font-bold tabular-nums ${aiData.rating >= 7 ? "text-emerald-400" : aiData.rating >= 5 ? "text-gold" : "text-red-400"}`}>
                  {aiData.rating}
                  <span className="text-lg font-normal text-silver/30">/10</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-silver/60 uppercase tracking-wider mb-1">{t("journalAiRating")}</div>
                  <p className="text-xs text-silver/70 leading-relaxed">{lang === "th" ? aiData.summaryTh : aiData.summaryEn}</p>
                  {aiData.bestSetup && aiData.bestSetup !== "—" && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-silver/40">{t("journalAiBestSetup")}:</span>
                      <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">{aiData.bestSetup}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-400/80">{t("journalAiStrengths")}</div>
                  <ul className="space-y-1.5">
                    {aiData.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-xs text-silver/70">
                        <span className="shrink-0 text-emerald-400">✓</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-red-400/80">{t("journalAiWeaknesses")}</div>
                  <ul className="space-y-1.5">
                    {aiData.weaknesses.map((w, i) => (
                      <li key={i} className="flex gap-2 text-xs text-silver/70">
                        <span className="shrink-0 text-red-400">✗</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-royal/80">{t("journalAiRecs")}</div>
                <ol className="space-y-1.5">
                  {aiData.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs text-silver/70">
                      <span className="shrink-0 font-semibold text-royal">{i + 1}.</span>{r}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trade table */}
      {trades.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-4xl">📒</span>
          <p className="text-sm text-silver/40">{t("journalNoTrades")}</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-2 px-6 py-2 text-sm">
            + {t("journalAddTrade")}
          </button>
        </div>
      ) : (
        <>
          <div className="panel overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-base-border/60">
                  {[t("journalDate"), t("journalDir"), t("journalEntry"), t("journalExit"), t("journalSL"), t("journalTP"), t("journalLots"), t("journalPnL"), t("journalRR"), t("journalSetup"), t("journalResult"), t("journalNotes"), ""].map((h, i) => (
                    <th key={i} className="px-2 py-3 text-[10px] font-semibold uppercase tracking-widest text-silver/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageTrades.map((tr) => (
                  <TradeRow
                    key={tr.id}
                    t={tr}
                    onDelete={() => deleteTrade(tr.id)}
                    onEdit={() => { setEditId(tr.id); setShowForm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    lang={lang}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-silver/50">
              <span>
                {t("journalPageOf").replace("{p}", String(page)).replace("{t}", String(totalPages))}
                {" "}· {trades.length} รายการ
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-base-border px-3 py-1.5 hover:text-silver disabled:opacity-30 transition-colors"
                >
                  {t("journalPrev")}
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-base-border px-3 py-1.5 hover:text-silver disabled:opacity-30 transition-colors"
                >
                  {t("journalNext")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Disclaimer />
    </div>
  );
}
