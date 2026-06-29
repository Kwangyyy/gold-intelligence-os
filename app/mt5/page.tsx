"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { MT5Account, MT5Position } from "@/lib/mt5Store";

const fmt  = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const ago  = (ms: number) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};
const openDur = (unixSec: number) => {
  const s = Math.floor(Date.now() / 1000) - unixSec;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

type AccountData = (MT5Account & { connected: true }) | { connected: false };

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="panel p-4">
      <div className="text-[9px] uppercase tracking-widest text-silver/35 mb-1">{label}</div>
      <div className="font-mono text-xl font-black" style={{ color: color ?? "#e2e8f0" }}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-silver/30">{sub}</div>}
    </div>
  );
}

function PositionRow({ p }: { p: MT5Position }) {
  const pnlColor = p.profit >= 0 ? "#34d399" : "#f87171";
  const isBuy    = p.type === "buy";
  return (
    <tr className="border-b border-base-border/10 hover:bg-white/[0.015] transition-colors">
      <td className="px-3 py-2.5 font-bold text-silver/80">{p.symbol}</td>
      <td className="px-3 py-2.5">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-black"
          style={isBuy
            ? { background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399" }
            : { background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
          {isBuy ? "▲ BUY" : "▼ SELL"}
        </span>
      </td>
      <td className="px-3 py-2.5 font-mono text-silver/60">{p.lots}</td>
      <td className="px-3 py-2.5 font-mono text-silver/60">{fmt(p.openPrice, 5)}</td>
      <td className="px-3 py-2.5 font-mono text-silver/80">{fmt(p.currentPrice, 5)}</td>
      <td className="px-3 py-2.5 font-mono text-red-400/60">{p.sl > 0 ? fmt(p.sl, 5) : "—"}</td>
      <td className="px-3 py-2.5 font-mono text-emerald-400/60">{p.tp > 0 ? fmt(p.tp, 5) : "—"}</td>
      <td className="px-3 py-2.5 font-mono font-black" style={{ color: pnlColor }}>
        {p.profit >= 0 ? "+" : ""}{fmt(p.profit)}
      </td>
      <td className="px-3 py-2.5 text-silver/35 text-[10px]">{openDur(p.openTime)}</td>
      {p.comment && <td className="px-3 py-2.5 text-silver/30 text-[10px] max-w-[100px] truncate">{p.comment}</td>}
    </tr>
  );
}

export default function MT5Page() {
  const [data, setData]       = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r  = await fetch("/api/mt5/account");
      const d  = await r.json();
      setData(d);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const connected  = data?.connected === true;
  const acc        = connected ? (data as MT5Account & { connected: true }) : null;
  const positions  = acc?.positions ?? [];
  const totalProfit = positions.reduce((s, p) => s + p.profit, 0);
  const marginLvl  = acc?.marginLevel ?? 0;
  const mlColor    = marginLvl === 0 ? "#475569" : marginLvl > 1000 ? "#34d399" : marginLvl > 300 ? "#f5c451" : "#f87171";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-1">
        <PageHeader title="MT5 Bridge 🔌"
          subtitle="ข้อมูล account + positions จาก MetaTrader 5 แบบ real-time" />
        {acc && (
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400/80">Connected</span>
            <span className="text-[10px] text-silver/30">{ago(acc.lastUpdate)}</span>
          </div>
        )}
      </div>

      {/* ── Not connected state ─────────────────────────────────── */}
      {!loading && !connected && (
        <div className="mt-6 panel p-8 text-center">
          <div className="text-4xl mb-4 opacity-30">🔌</div>
          <div className="text-lg font-bold text-silver/50 mb-2">ยังไม่ได้เชื่อมต่อ MT5</div>
          <p className="text-sm text-silver/30 mb-6 max-w-md mx-auto">
            ติดตั้ง EA Bridge บน MetaTrader 5 เพื่อส่งข้อมูล account + positions มาแสดงที่นี่แบบ real-time
          </p>
          <div className="flex flex-col items-center gap-3">
            <a href="/api/mt5/ea"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
              style={{ background: "rgba(245,196,81,0.15)", border: "1px solid rgba(245,196,81,0.4)", color: "#f5c451" }}>
              ⬇ ดาวน์โหลด GoldIntelligenceOS_Bridge.mq5
            </a>
            <div className="rounded-xl border border-base-border/20 p-4 text-left text-xs text-silver/40 max-w-sm">
              <div className="font-bold text-silver/60 mb-2">วิธีติดตั้ง:</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>ดาวน์โหลด .mq5 file ด้านบน</li>
                <li>ใส่ใน MT5 → File → Open Data Folder → MQL5/Experts</li>
                <li>Compile ใน MetaEditor (F7)</li>
                <li>Drag EA ไปบนชาร์ตใดก็ได้</li>
                <li>ตรวจสอบว่า WebRequest อนุญาต URL นี้ใน MT5 Options</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3 text-silver/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <span className="text-sm">กำลังเชื่อมต่อ…</span>
        </div>
      )}

      {/* ── Account stats ────────────────────────────────────────── */}
      {connected && acc && (
        <>
          <div className="mb-3 flex items-center gap-3 text-[11px] text-silver/40">
            <span className="font-bold text-silver/60">{acc.server}</span>
            <span>·</span>
            <span>#{acc.account}</span>
            <span>·</span>
            <span>1:{acc.leverage}</span>
            <span>·</span>
            <span>{acc.currency}</span>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <StatCard label="Balance" value={`${acc.currency} ${fmt(acc.balance)}`} color="#e2e8f0" />
            <StatCard label="Equity" value={`${acc.currency} ${fmt(acc.equity)}`}
              color={acc.equity >= acc.balance ? "#34d399" : "#f87171"} />
            <StatCard label="Floating P/L" value={`${totalProfit >= 0 ? "+" : ""}${fmt(totalProfit)}`}
              color={totalProfit >= 0 ? "#34d399" : "#f87171"}
              sub={`${positions.length} open position${positions.length !== 1 ? "s" : ""}`} />
            <StatCard label="Margin" value={fmt(acc.margin)} sub="used" />
            <StatCard label="Free Margin" value={fmt(acc.freeMargin)} color="#60a5fa" />
            <StatCard label="Margin Level" value={marginLvl > 0 ? `${fmt(marginLvl, 0)}%` : "—"}
              color={mlColor}
              sub={marginLvl === 0 ? "no positions" : marginLvl > 1000 ? "safe" : marginLvl > 300 ? "caution" : "⚠ low!"} />
          </div>

          {/* ── Equity vs Balance bar ─────────────────────────────── */}
          <div className="mb-5 panel p-4">
            <div className="mb-2 flex justify-between text-[10px] text-silver/40">
              <span>Equity vs Balance</span>
              <span style={{ color: totalProfit >= 0 ? "#34d399" : "#f87171" }}>
                {totalProfit >= 0 ? "+" : ""}{fmt(totalProfit)} ({fmt(acc.balance > 0 ? (totalProfit / acc.balance) * 100 : 0)}%)
              </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.abs((acc.equity / acc.balance) * 100))}%`,
                  background: acc.equity >= acc.balance ? "#34d399" : "#f87171",
                }} />
              <div className="absolute inset-y-0 left-0 w-px bg-white/20"
                style={{ left: `${Math.min(100, (acc.balance / Math.max(acc.balance, acc.equity)) * 100)}%` }} />
            </div>
          </div>

          {/* ── Positions table ───────────────────────────────────── */}
          <div className="panel overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-base-border/20">
              <span className="text-[11px] font-bold text-silver/60">Open Positions ({positions.length})</span>
              <button onClick={load} className="text-[10px] text-silver/30 hover:text-silver/60 transition-colors">↻</button>
            </div>
            {positions.length === 0 ? (
              <div className="py-10 text-center text-sm text-silver/30">ไม่มี open positions</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-base-border/20 text-[10px] uppercase tracking-widest text-silver/30">
                      {["Symbol","Type","Lots","Open","Current","SL","TP","P/L","Duration"].map(h => (
                        <th key={h} className="px-3 pb-2 pt-3 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(p => <PositionRow key={p.ticket} p={p} />)}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-base-border/30">
                      <td colSpan={7} className="px-3 py-2.5 text-[10px] text-silver/30 font-bold">Total</td>
                      <td className="px-3 py-2.5 font-mono font-black text-xs"
                        style={{ color: totalProfit >= 0 ? "#34d399" : "#f87171" }}>
                        {totalProfit >= 0 ? "+" : ""}{fmt(totalProfit)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="mt-3 text-center text-[10px] text-silver/20">
            อัปเดตอัตโนมัติทุก 15 วินาที · ข้อมูลล่าสุด: {ago(acc.lastUpdate)} · หมดอายุหลัง 5 นาที
          </div>
        </>
      )}
    </div>
  );
}
