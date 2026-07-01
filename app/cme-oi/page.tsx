"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { CmeOiData } from "@/app/api/cme-oi/route";

const fmtK = (n: number) => {
  if (!n) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n/1_000).toFixed(0)}K`;
  return n.toLocaleString("en-US");
};

function OiCard({ d }: { d: CmeOiData }) {
  const chColor = d.oiChange > 0 ? "#34d399" : d.oiChange < 0 ? "#f87171" : "#64748b";
  const signal  = d.oiChange > 5000 ? "🟢 OI เพิ่ม — แรงซื้อแข็งแกร่ง" : d.oiChange < -5000 ? "🔴 OI ลด — position ปิดตัว" : "⚪ OI ทรง — sideways";

  return (
    <div className="rounded-2xl p-4" style={{ background:"rgba(13,18,30,0.7)", border:"1px solid rgba(71,85,105,0.18)" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-base font-black text-white">{d.icon} {d.name} ({d.symbol})</div>
          <div className="text-[10px] text-silver/30 mt-0.5">CME Group · {d.date}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold text-silver/70">{fmtK(d.openInterest)}</div>
          <div className="text-[9px] text-silver/30 uppercase">Open Interest</div>
        </div>
      </div>

      <div className="flex gap-4 mb-3 text-xs">
        <div>
          <div className="text-[9px] text-silver/30 uppercase tracking-widest">เปลี่ยนแปลง</div>
          <div className="font-black font-mono" style={{ color: chColor }}>
            {d.oiChange >= 0 ? "+" : ""}{fmtK(d.oiChange)} ({d.oiChangePct >= 0 ? "+" : ""}{d.oiChangePct.toFixed(1)}%)
          </div>
        </div>
        <div>
          <div className="text-[9px] text-silver/30 uppercase tracking-widest">Volume</div>
          <div className="font-mono text-silver/60">{fmtK(d.volume)}</div>
        </div>
        <div>
          <div className="text-[9px] text-silver/30 uppercase tracking-widest">Settle</div>
          <div className="font-mono text-silver/60">{d.settle > 0 ? d.settle.toFixed(2) : "—"}</div>
        </div>
      </div>

      <div className="rounded-lg px-3 py-1.5 text-[11px]"
        style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", color:"#94a3b8" }}>
        {signal}
      </div>
    </div>
  );
}

export default function CmeOiPage() {
  const [data,    setData]    = useState<CmeOiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/cme-oi", { cache:"no-store" });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setData(Array.isArray(d) ? d : []);
    } catch(e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function sendTelegram() {
    setSending(true); setSendMsg("");
    try {
      const r = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: buildTelegramMsg(data),
        }),
      });
      const d = await r.json();
      setSendMsg(d.ok ? "✅ ส่ง Telegram สำเร็จ!" : `❌ ${d.error}`);
    } catch(e) { setSendMsg(`❌ ${e}`); }
    finally { setSending(false); }
  }

  function buildTelegramMsg(data: CmeOiData[]): string {
    const now = new Date().toLocaleDateString("th-TH", { day:"numeric", month:"short", year:"numeric" });
    let msg = `📊 *CME Open Interest — ${now}*\n\n`;
    for (const d of data) {
      const ch = d.oiChange >= 0 ? `+${fmtK(d.oiChange)}` : fmtK(d.oiChange);
      msg += `${d.icon} *${d.name}*: OI ${fmtK(d.openInterest)} (${ch})\n`;
    }
    msg += "\n_Gold Intelligence OS · EA Profit Lab_";
    return msg;
  }

  useEffect(() => { load(); }, []);

  const gold = data.find(d => d.symbol === "GC");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-1">
        <PageHeader title="CME Open Interest 📊"
          subtitle="ข้อมูล Open Interest จาก CME Group — Gold, Silver, Platinum, Copper" />
        <div className="flex gap-2 mt-1">
          <button onClick={load} className="text-xs text-silver/30 hover:text-silver/60 transition-colors">↻ refresh</button>
          <button onClick={sendTelegram} disabled={sending || !data.length}
            className="rounded-lg px-3 py-1 text-[11px] font-bold transition-all disabled:opacity-40"
            style={{ background:"rgba(245,196,81,0.1)", border:"1px solid rgba(245,196,81,0.3)", color:"#f5c451" }}>
            {sending ? "กำลังส่ง…" : "📢 ส่ง Telegram"}
          </button>
        </div>
      </div>

      {sendMsg && (
        <div className="mb-4 rounded-xl p-3 text-sm"
          style={{ background: sendMsg.startsWith("✅") ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
            border: `1px solid ${sendMsg.startsWith("✅") ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
            color:  sendMsg.startsWith("✅") ? "#34d399" : "#f87171" }}>
          {sendMsg}
        </div>
      )}

      {loading && (
        <div className="mt-10 flex flex-col items-center gap-3 text-silver/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <span className="text-sm">ดึงข้อมูล CME…</span>
        </div>
      )}

      {error && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>}

      {!loading && data.length > 0 && (
        <>
          {/* Gold highlight */}
          {gold && gold.openInterest > 0 && (
            <div className="panel p-4 mb-5">
              <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-2">🥇 Gold OI Insight</div>
              <div className="text-sm text-silver/70">
                {gold.oiChange > 10000
                  ? "Managed money เพิ่ม position — ความเชื่อมั่นขาขึ้น"
                  : gold.oiChange < -10000
                  ? "Position ปิดตัว — อาจมีการ take profit หรือหมดความสนใจ"
                  : "OI ทรงตัว — sideways / รอ catalyst ใหม่"}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.map(d => <OiCard key={d.symbol} d={d} />)}
          </div>

          <div className="mt-4 text-center text-[10px] text-silver/20">
            ข้อมูลจาก CME Group · อัปเดตทุก 1 ชั่วโมง · ใช้เพื่อประกอบการวิเคราะห์ ไม่ใช่สัญญาณซื้อขาย
          </div>
        </>
      )}
    </div>
  );
}
