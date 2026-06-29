"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { SignalEntry, SignalOutcome } from "@/lib/signalLog";

const fmt   = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const tsStr = (ms: number) => new Date(ms).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });

const OUTCOME_CFG: Record<SignalOutcome, { label: string; bg: string; border: string; color: string }> = {
  tp1:     { label: "TP1 ✓",  bg: "rgba(52,211,153,0.15)",  border: "rgba(52,211,153,0.4)",  color: "#34d399" },
  tp2:     { label: "TP2 ✓✓", bg: "rgba(16,185,129,0.15)",  border: "rgba(16,185,129,0.4)",  color: "#10b981" },
  sl:      { label: "SL ✗",   bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.4)", color: "#f87171" },
  be:      { label: "B/E →",  bg: "rgba(245,196,81,0.12)",  border: "rgba(245,196,81,0.35)", color: "#f5c451" },
  pending: { label: "Pending", bg: "rgba(71,85,105,0.12)",   border: "rgba(71,85,105,0.3)",  color: "#475569" },
};

function DirBadge({ dir }: { dir: SignalEntry["direction"] }) {
  const cfg = dir === "buy"
    ? { bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.4)", color: "#34d399", label: "▲ BUY" }
    : dir === "sell"
    ? { bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.4)", color: "#f87171", label: "▼ SELL" }
    : { bg: "rgba(245,196,81,0.1)", border: "rgba(245,196,81,0.3)", color: "#f5c451", label: "◆ WAIT" };
  return (
    <span className="rounded-lg px-2 py-0.5 text-[11px] font-black"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function ConfBar({ v }: { v: number }) {
  const color = v >= 75 ? "#34d399" : v >= 58 ? "#f5c451" : "#f87171";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="font-mono text-[11px]" style={{ color }}>{v}%</span>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: SignalOutcome }) {
  const c = OUTCOME_CFG[outcome];
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-black whitespace-nowrap"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.label}
    </span>
  );
}

function OutcomeMenu({
  id, current, onSave,
}: { id: string; current: SignalOutcome; onSave: (id: string, o: SignalOutcome) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pick(o: SignalOutcome) {
    setSaving(true);
    await onSave(id, o);
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} disabled={saving}
        className="rounded px-2 py-0.5 text-[10px] text-silver/30 hover:text-silver/70 border border-white/5 hover:border-white/15 transition-all disabled:opacity-40">
        {saving ? "…" : "✎"}
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-20 flex flex-col gap-1 rounded-xl border border-base-border/40 p-2 shadow-2xl"
          style={{ background: "#0d0818", minWidth: 110 }}>
          {(["tp1","tp2","be","sl","pending"] as SignalOutcome[]).map(o => {
            const c = OUTCOME_CFG[o];
            return (
              <button key={o} onClick={() => pick(o)}
                className="rounded-lg px-2 py-1 text-left text-[11px] font-bold transition-colors hover:opacity-90"
                style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SignalLogPage() {
  const [signals, setSignals]   = useState<SignalEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "buy" | "sell" | "wait">("all");
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/signal-log?limit=200");
      setSignals(await r.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setOutcome(id: string, outcome: SignalOutcome) {
    await fetch("/api/signal-log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, outcome }),
    });
    setSignals(prev => prev.map(s => s.id === id ? { ...s, outcome, outcomeTs: Date.now() } : s));
  }

  async function clearLog() {
    if (!confirm("ลบ Signal Log ทั้งหมด?")) return;
    setClearing(true);
    await fetch("/api/signal-log", { method: "DELETE" });
    setSignals([]);
    setClearing(false);
  }

  // ── Stats ─────────────────────────────────────────────────────
  const tradeable  = signals.filter(s => s.direction !== "wait");
  const resolved   = tradeable.filter(s => s.outcome !== "pending");
  const wins       = resolved.filter(s => s.outcome === "tp1" || s.outcome === "tp2");
  const losses     = resolved.filter(s => s.outcome === "sl");
  const breakevens = resolved.filter(s => s.outcome === "be");
  const winRate    = resolved.length ? Math.round((wins.length / resolved.length) * 100) : null;
  const pendingCnt = tradeable.filter(s => s.outcome === "pending").length;

  const buys  = signals.filter(s => s.direction === "buy").length;
  const sells = signals.filter(s => s.direction === "sell").length;
  const shown = filter === "all" ? signals : signals.filter(s => s.direction === filter);

  const winRateColor = winRate === null ? "#475569"
    : winRate >= 60 ? "#34d399" : winRate >= 45 ? "#f5c451" : "#f87171";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-1">
        <PageHeader title="Signal Log 📡" subtitle="ประวัติ AI signals — กด ✎ เพื่อ mark ผลลัพธ์ (TP1 / TP2 / SL / B/E)" />
        <button onClick={clearLog} disabled={clearing || signals.length === 0}
          className="mt-1 rounded-lg border border-red-500/25 px-3 py-1.5 text-[10px] text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-30">
          {clearing ? "กำลังลบ…" : "🗑 ล้าง"}
        </button>
      </div>

      {/* ── Summary cards ──────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="panel p-4">
          <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">Win Rate</div>
          <div className="font-mono text-2xl font-black" style={{ color: winRateColor }}>
            {winRate !== null ? `${winRate}%` : "—"}
          </div>
          {resolved.length > 0 && (
            <div className="mt-0.5 text-[10px] text-silver/30">{resolved.length} resolved</div>
          )}
        </div>
        <div className="panel p-4">
          <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">TP Hits</div>
          <div className="font-mono text-2xl font-black text-emerald-400">{wins.length}</div>
          <div className="mt-0.5 text-[10px] text-silver/30">TP1 + TP2</div>
        </div>
        <div className="panel p-4">
          <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">SL Hits</div>
          <div className="font-mono text-2xl font-black text-red-400">{losses.length}</div>
          <div className="mt-0.5 text-[10px] text-silver/30">stopped out</div>
        </div>
        <div className="panel p-4">
          <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">Breakeven</div>
          <div className="font-mono text-2xl font-black text-gold">{breakevens.length}</div>
          <div className="mt-0.5 text-[10px] text-silver/30">closed at entry</div>
        </div>
        <div className="panel p-4">
          <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">Pending</div>
          <div className="font-mono text-2xl font-black text-silver/50">{pendingCnt}</div>
          <div className="mt-0.5 text-[10px] text-silver/30">ยังไม่ mark</div>
        </div>
      </div>

      {/* ── Win rate progress bar ──────────────────────────────── */}
      {resolved.length > 0 && (
        <div className="mb-5 panel p-4">
          <div className="mb-2 flex items-center justify-between text-[10px] text-silver/40">
            <span>ผลลัพธ์ {resolved.length} trades ที่ resolved</span>
            <span style={{ color: winRateColor }} className="font-bold">{winRate}% win rate</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full gap-0.5">
            {wins.length > 0 && (
              <div className="h-full rounded-l-full transition-all" title={`TP: ${wins.length}`}
                style={{ width: `${(wins.length / resolved.length) * 100}%`, background: "#34d399" }} />
            )}
            {breakevens.length > 0 && (
              <div className="h-full transition-all" title={`B/E: ${breakevens.length}`}
                style={{ width: `${(breakevens.length / resolved.length) * 100}%`, background: "#f5c451" }} />
            )}
            {losses.length > 0 && (
              <div className="h-full rounded-r-full transition-all" title={`SL: ${losses.length}`}
                style={{ width: `${(losses.length / resolved.length) * 100}%`, background: "#f87171" }} />
            )}
          </div>
          <div className="mt-2 flex gap-4 text-[10px] text-silver/30">
            <span className="text-emerald-400">■ TP {wins.length}</span>
            <span className="text-gold">■ B/E {breakevens.length}</span>
            <span className="text-red-400">■ SL {losses.length}</span>
          </div>
        </div>
      )}

      {/* ── Filter tabs ────────────────────────────────────────── */}
      <div className="mb-4 flex gap-1.5 flex-wrap">
        {(["all","buy","sell","wait"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all capitalize"
            style={filter === f
              ? { background: f === "buy" ? "rgba(52,211,153,0.18)" : f === "sell" ? "rgba(248,113,113,0.18)" : f === "wait" ? "rgba(245,196,81,0.15)" : "rgba(168,85,247,0.15)", border: `1px solid ${f === "buy" ? "rgba(52,211,153,0.45)" : f === "sell" ? "rgba(248,113,113,0.45)" : f === "wait" ? "rgba(245,196,81,0.4)" : "rgba(168,85,247,0.4)"}`, color: f === "buy" ? "#34d399" : f === "sell" ? "#f87171" : f === "wait" ? "#f5c451" : "#a78bfa" }
              : { background: "rgba(71,85,105,0.1)", border: "1px solid rgba(71,85,105,0.2)", color: "#475569" }}>
            {f === "all" ? `All (${signals.length})` : f === "buy" ? `Buy (${buys})` : f === "sell" ? `Sell (${sells})` : `Wait`}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-silver/30 hover:text-silver/60 transition-colors">↻ refresh</button>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="panel overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-silver/30">กำลังโหลด…</div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-3xl mb-3 opacity-30">📡</div>
            <div className="text-sm text-silver/30">ยังไม่มี signal — ไปที่ Paper Trader เพื่อ generate signal แรก</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-base-border/30 text-[10px] uppercase tracking-widest text-silver/35">
                  {["เวลา","Symbol","Dir","Conf","Entry","SL","TP1","R:R","Source","Outcome",""].map(h => (
                    <th key={h} className="px-3 pb-2 pt-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={s.id}
                    className="border-b border-base-border/10 transition-colors hover:bg-white/[0.015]"
                    style={i === 0 ? { background: "rgba(168,85,247,0.04)" } : undefined}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-silver/40 text-[10px]">{tsStr(s.ts)}</td>
                    <td className="px-3 py-2.5 font-bold text-silver/70">{s.symbol}</td>
                    <td className="px-3 py-2.5"><DirBadge dir={s.direction} /></td>
                    <td className="px-3 py-2.5"><ConfBar v={s.confidence} /></td>
                    <td className="px-3 py-2.5 font-mono text-silver/70">{fmt(s.entry)}</td>
                    <td className="px-3 py-2.5 font-mono text-red-400/70">{s.sl > 0 ? fmt(s.sl) : "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-emerald-400/70">{s.tp1 > 0 ? fmt(s.tp1) : "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-silver/50">{s.rr1 > 0 ? `1:${s.rr1.toFixed(1)}` : "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={s.source === "gemini"
                          ? { background: "rgba(96,165,250,0.12)", color: "#60a5fa" }
                          : { background: "rgba(71,85,105,0.2)", color: "#64748b" }}>
                        {s.source === "gemini" ? "AI" : "Rule"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {s.direction !== "wait"
                        ? <OutcomeBadge outcome={s.outcome ?? "pending"} />
                        : <span className="text-silver/20 text-[10px]">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.direction !== "wait" && (
                        <OutcomeMenu id={s.id} current={s.outcome ?? "pending"} onSave={setOutcome} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 text-[10px] text-silver/20 text-center">
        {shown.length} / {signals.length} signals · กด ✎ เพื่อ mark ผลลัพธ์แต่ละ signal
      </div>
    </div>
  );
}
