"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { CotRow } from "@/app/api/cot/route";

const fmt = (n: number) => Math.abs(n).toLocaleString("en-US");
const fmtK = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("en-US");
};

function NetBar({ long, short, max }: { long: number; short: number; max: number }) {
  const longPct  = max > 0 ? (long  / max) * 100 : 0;
  const shortPct = max > 0 ? (short / max) * 100 : 0;
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/[0.04] gap-px">
      <div style={{ width: `${longPct}%`, background: "#34d399" }} className="h-full rounded-l-full transition-all" />
      <div style={{ width: `${shortPct}%`, background: "#f87171" }} className="h-full rounded-r-full transition-all" />
    </div>
  );
}

function NetIndicator({ net, change }: { net: number; change: number }) {
  const color  = net > 0 ? "#34d399" : "#f87171";
  const chColor = change > 0 ? "#34d399" : change < 0 ? "#f87171" : "#475569";
  const arrow  = change > 0 ? "▲" : change < 0 ? "▼" : "—";
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono font-bold text-sm" style={{ color }}>
        {net > 0 ? "+" : ""}{fmtK(net)}
      </span>
      <span className="text-[10px] font-bold" style={{ color: chColor }}>
        {arrow} {fmtK(Math.abs(change))}
      </span>
    </div>
  );
}

function SentimentBadge({ net }: { net: number }) {
  if (net > 0) return (
    <span className="rounded-md px-2 py-0.5 text-[10px] font-black"
      style={{ background: "rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)", color:"#34d399" }}>
      NET LONG
    </span>
  );
  return (
    <span className="rounded-md px-2 py-0.5 text-[10px] font-black"
      style={{ background: "rgba(248,113,113,0.12)", border:"1px solid rgba(248,113,113,0.3)", color:"#f87171" }}>
      NET SHORT
    </span>
  );
}

function CotCard({ row }: { row: CotRow }) {
  const oi   = row.openInterest || 1;
  const maxMM = Math.max(row.mmLong, row.mmShort, 1);

  const bullish = row.mmNet > 0 && row.mmChange > 0;
  const bearish = row.mmNet < 0 && row.mmChange < 0;
  const border  = bullish ? "rgba(52,211,153,0.2)" : bearish ? "rgba(248,113,113,0.2)" : "rgba(71,85,105,0.12)";

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background:"rgba(13,18,30,0.7)", border:`1px solid ${border}`, backdropFilter:"blur(8px)" }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl font-black text-white">{row.icon} {row.name}</div>
          <div className="text-[10px] text-silver/30 mt-0.5">COT as of {row.date}</div>
        </div>
        <SentimentBadge net={row.mmNet} />
      </div>

      {/* Managed Money */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-2">
          Managed Money (Hedge Funds)
        </div>
        <NetBar long={row.mmLong} short={row.mmShort} max={maxMM} />
        <div className="mt-2 flex justify-between text-[11px]">
          <span className="text-emerald-400">▲ Long {fmtK(row.mmLong)}</span>
          <span className="text-red-400">▼ Short {fmtK(row.mmShort)}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[10px] text-silver/30">Net:</span>
          <NetIndicator net={row.mmNet} change={row.mmChange} />
        </div>
      </div>

      {/* Commercial / NC */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[9px] uppercase tracking-widest text-silver/25 mb-1.5">Commercial (Hedgers)</div>
          <div className="font-mono text-xs font-bold" style={{ color: row.commNet > 0 ? "#34d399" : "#f87171" }}>
            {row.commNet > 0 ? "+" : ""}{fmtK(row.commNet)}
          </div>
          <div className="text-[9px] text-silver/25 mt-0.5">
            L {fmtK(row.commLong)} · S {fmtK(row.commShort)}
          </div>
        </div>
        <div className="rounded-xl p-3" style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[9px] uppercase tracking-widest text-silver/25 mb-1.5">Non-Commercial</div>
          <div className="font-mono text-xs font-bold" style={{ color: row.ncNet > 0 ? "#34d399" : "#f87171" }}>
            {row.ncNet > 0 ? "+" : ""}{fmtK(row.ncNet)}
          </div>
          <div className="text-[9px] text-silver/25 mt-0.5">
            L {fmtK(row.ncLong)} · S {fmtK(row.ncShort)}
          </div>
        </div>
      </div>

      {/* Open Interest */}
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.04]">
        <span className="text-silver/30">Open Interest</span>
        <span className="font-mono text-silver/60 font-bold">{fmtK(row.openInterest)}</span>
      </div>
    </div>
  );
}

function GoldInsight({ gold }: { gold: CotRow | undefined }) {
  if (!gold) return null;
  const { mmNet, mmChange } = gold;

  const lines: { icon: string; text: string; color: string }[] = [];

  if (mmNet > 100_000) lines.push({ icon: "🟢", text: "Hedge funds ถือ Net Long สูงมาก — ความเชื่อมั่นขาขึ้นแข็งแกร่ง", color: "#34d399" });
  else if (mmNet > 0)  lines.push({ icon: "🟡", text: "Hedge funds ถือ Net Long — sentiment เอียงบวก", color: "#f5c451" });
  else                 lines.push({ icon: "🔴", text: "Hedge funds ถือ Net Short — แรงกดดันขาลง", color: "#f87171" });

  if (mmChange > 10_000)       lines.push({ icon: "📈", text: `เพิ่ม Long สัปดาห์นี้ +${fmtK(mmChange)} contracts — momentum ขาขึ้น`, color: "#34d399" });
  else if (mmChange < -10_000) lines.push({ icon: "📉", text: `ลด Long สัปดาห์นี้ ${fmtK(mmChange)} contracts — smart money เริ่ม exit`, color: "#f87171" });

  if (gold.commNet < -100_000) lines.push({ icon: "⚠️", text: "Commercials (producers) Hedge Short หนักมาก — คาดว่าราคาจะย้อนลง", color: "#fb923c" });

  return (
    <div className="panel p-5 mb-6">
      <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">🥇 Gold COT Insight</div>
      <div className="flex flex-col gap-2.5">
        {lines.map((l, i) => (
          <div key={i} className="flex items-start gap-2.5 text-sm">
            <span>{l.icon}</span>
            <span style={{ color: l.color }}>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CotPage() {
  const [rows,    setRows]    = useState<CotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/cot");
      const d = await r.json();
      if (d.error) setError(d.error);
      else setRows(d);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const gold = rows.find(r => r.id === "XAUUSD");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-1">
        <PageHeader
          title="COT Report 📋"
          subtitle="Commitment of Traders — CFTC Disaggregated · อัปเดตทุกวันศุกร์ · Managed Money positioning"
        />
        <button onClick={load}
          className="mt-1 text-xs text-silver/30 hover:text-silver/60 transition-colors">
          ↻ refresh
        </button>
      </div>

      {loading && (
        <div className="mt-12 flex flex-col items-center gap-3 text-silver/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <span className="text-sm">ดึงข้อมูล CFTC…</span>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          <GoldInsight gold={gold} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rows.map(r => <CotCard key={r.id} row={r} />)}
          </div>

          <div className="mt-6 rounded-xl border border-base-border/10 bg-white/[0.015] p-4 text-[11px] text-silver/30 leading-relaxed">
            <b className="text-silver/50">วิธีอ่าน COT:</b>{" "}
            <b className="text-emerald-400">Managed Money Net Long ↑</b> = Hedge funds เพิ่ม position ขาขึ้น (Bullish signal) ·{" "}
            <b className="text-red-400">Commercial Net Short ↑</b> = ผู้ผลิตทองคำ Hedge ขาย = คาดราคาสูงพอแล้ว ·
            ข้อมูลรายงานย้อนหลัง ~3 วัน (CFTC รายงานทุกวันศุกร์) ·
            <b className="text-silver/40"> ใช้เป็น macro context ประกอบการวิเคราะห์ ไม่ใช่สัญญาณซื้อขายคนเดียว</b>
          </div>
        </>
      )}
    </div>
  );
}
