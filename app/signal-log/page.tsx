"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { SignalEntry } from "@/lib/signalLog";

const fmt  = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const tsStr = (ms: number) => new Date(ms).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });

function DirBadge({ dir }: { dir: SignalEntry["direction"] }) {
  const cfg = dir === "buy"
    ? { bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.4)", color: "#34d399", label: "▲ BUY" }
    : dir === "sell"
    ? { bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.4)", color: "#f87171", label: "▼ SELL" }
    : { bg: "rgba(245,196,81,0.1)",  border: "rgba(245,196,81,0.3)",  color: "#f5c451", label: "◆ WAIT" };
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
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="font-mono text-[11px]" style={{ color }}>{v}%</span>
    </div>
  );
}

export default function SignalLogPage() {
  const [signals, setSignals] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all" | "buy" | "sell" | "wait">("all");
  const [clearing, setClearing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/signal-log?limit=200");
      setSignals(await r.json());
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function clearLog() {
    if (!confirm("ลบ Signal Log ทั้งหมด?")) return;
    setClearing(true);
    await fetch("/api/signal-log", { method: "DELETE" });
    setSignals([]);
    setClearing(false);
  }

  const shown   = filter === "all" ? signals : signals.filter(s => s.direction === filter);
  const buys    = signals.filter(s => s.direction === "buy").length;
  const sells   = signals.filter(s => s.direction === "sell").length;
  const waits   = signals.filter(s => s.direction === "wait").length;
  const avgConf = signals.length ? Math.round(signals.reduce((s, x) => s + x.confidence, 0) / signals.length) : 0;
  const geminiC = signals.filter(s => s.source === "gemini").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-1">
        <PageHeader title="Signal Log 📡" subtitle="ประวัติ AI signals ทั้งหมด — เก็บใน Redis สูงสุด 200 รายการ" />
        <button onClick={clearLog} disabled={clearing || signals.length === 0}
          className="mt-1 rounded-lg border border-red-500/25 px-3 py-1.5 text-[10px] text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-30">
          {clearing ? "กำลังลบ…" : "🗑 ล้าง Log"}
        </button>
      </div>

      {/* ── Summary cards ────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Signals", value: signals.length.toString(), color: "#e2e8f0" },
          { label: "BUY / SELL / WAIT", value: `${buys} / ${sells} / ${waits}`, color: "#a78bfa" },
          { label: "Avg Confidence", value: `${avgConf}%`, color: avgConf >= 70 ? "#34d399" : avgConf >= 55 ? "#f5c451" : "#f87171" },
          { label: "Gemini / Rule-based", value: `${geminiC} / ${signals.length - geminiC}`, color: "#60a5fa" },
        ].map(c => (
          <div key={c.label} className="panel p-4">
            <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">{c.label}</div>
            <div className="font-mono text-lg font-black" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── Direction filter ─────────────────────────────────────── */}
      <div className="mb-4 flex gap-1.5">
        {(["all","buy","sell","wait"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all capitalize"
            style={filter === f
              ? { background: f === "buy" ? "rgba(52,211,153,0.18)" : f === "sell" ? "rgba(248,113,113,0.18)" : f === "wait" ? "rgba(245,196,81,0.15)" : "rgba(168,85,247,0.15)", border: `1px solid ${f === "buy" ? "rgba(52,211,153,0.45)" : f === "sell" ? "rgba(248,113,113,0.45)" : f === "wait" ? "rgba(245,196,81,0.4)" : "rgba(168,85,247,0.4)"}`, color: f === "buy" ? "#34d399" : f === "sell" ? "#f87171" : f === "wait" ? "#f5c451" : "#a78bfa" }
              : { background: "rgba(71,85,105,0.1)", border: "1px solid rgba(71,85,105,0.2)", color: "#475569" }}>
            {f === "all" ? `All (${signals.length})` : f === "buy" ? `Buy (${buys})` : f === "sell" ? `Sell (${sells})` : `Wait (${waits})`}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-silver/30 hover:text-silver/60 transition-colors">↻ refresh</button>
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
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
                  {["เวลา","Symbol","Direction","Confidence","Setup","Entry","SL","TP1","R:R","Source"].map(h => (
                    <th key={h} className="px-3 pb-2 pt-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={s.id}
                    className="border-b border-base-border/10 transition-colors hover:bg-white/[0.015]"
                    style={i === 0 ? { background: "rgba(168,85,247,0.04)" } : undefined}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-silver/40">{tsStr(s.ts)}</td>
                    <td className="px-3 py-2.5 font-bold text-silver/70">{s.symbol}</td>
                    <td className="px-3 py-2.5"><DirBadge dir={s.direction} /></td>
                    <td className="px-3 py-2.5"><ConfBar v={s.confidence} /></td>
                    <td className="px-3 py-2.5 max-w-[120px] truncate text-silver/50">{s.setupType}</td>
                    <td className="px-3 py-2.5 font-mono text-silver/70">{fmt(s.entry)}</td>
                    <td className="px-3 py-2.5 font-mono text-red-400/70">{s.sl > 0 ? fmt(s.sl) : "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-emerald-400/70">{s.tp1 > 0 ? fmt(s.tp1) : "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-silver/50">{s.rr1 > 0 ? `1:${s.rr1.toFixed(1)}` : "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={s.source === "gemini"
                          ? { background: "rgba(96,165,250,0.12)", color: "#60a5fa" }
                          : { background: "rgba(71,85,105,0.2)", color: "#64748b" }}>
                        {s.source === "gemini" ? "Gemini" : "Rule"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 text-[10px] text-silver/20 text-center">
        แสดง {shown.length} / {signals.length} signals · เก็บสูงสุด 200 รายการ
      </div>
    </div>
  );
}
