"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { EaListing } from "@/app/api/ea-monitor/route";

export default function EaMonitorPage() {
  const [items,   setItems]   = useState<EaListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [newCount,setNewCount]= useState(0);
  const [filter,  setFilter]  = useState<"all"|"new">("all");

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/ea-monitor", { cache:"no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setItems(d.items); setNewCount(d.newCount);
    } catch(e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = filter === "new" ? items.filter(i => i.isNew) : items;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between mb-1">
        <PageHeader title="EA Market Monitor 🔍"
          subtitle="ติดตาม EA ใหม่จาก MQL5 Market + myfxbook อัตโนมัติ" />
        <button onClick={load} className="mt-1 text-xs text-silver/30 hover:text-silver/60 transition-colors">↻ refresh</button>
      </div>

      {newCount > 0 && (
        <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-400">
          🆕 พบ <b>{newCount}</b> EA ใหม่ที่ยังไม่เคยเห็น!
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        {[["all","ทั้งหมด"],["new","🆕 ใหม่เท่านั้น"]] .map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v as "all"|"new")}
            className="rounded-lg px-3 py-1 text-xs font-bold transition-all"
            style={filter === v
              ? { background:"rgba(245,196,81,0.12)", border:"1px solid rgba(245,196,81,0.35)", color:"#f5c451" }
              : { background:"rgba(71,85,105,0.1)", border:"1px solid rgba(71,85,105,0.2)", color:"#475569" }}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-silver/30 self-center">{filtered.length} รายการ</span>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>}

      {loading && (
        <div className="mt-10 flex flex-col items-center gap-3 text-silver/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <span className="text-sm">กำลังดึงข้อมูล EA markets…</span>
        </div>
      )}

      {!loading && (
        <div className="panel overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-base-border/20 text-[9px] uppercase tracking-widest text-silver/30">
                <th className="px-4 pb-2 pt-3 text-left">EA Name</th>
                <th className="px-4 pb-2 pt-3 text-center hidden sm:table-cell">Source</th>
                <th className="px-4 pb-2 pt-3 text-center hidden md:table-cell">Rating</th>
                <th className="px-4 pb-2 pt-3 text-right hidden md:table-cell">Price</th>
                <th className="px-4 pb-2 pt-3 text-center">Status</th>
                <th className="px-4 pb-2 pt-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-silver/30 text-sm">ไม่พบรายการ</td></tr>
              )}
              {filtered.map(item => (
                <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-silver/80 truncate max-w-[280px]">{item.title}</div>
                    <div className="text-[9px] text-silver/30 mt-0.5">{item.pubDate?.slice(0, 16)}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ background:"rgba(71,85,105,0.15)", color:"#64748b" }}>{item.source}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center hidden md:table-cell font-mono text-silver/60">{item.rating}</td>
                  <td className="px-4 py-2.5 text-right hidden md:table-cell font-mono text-silver/60">{item.price}</td>
                  <td className="px-4 py-2.5 text-center">
                    {item.isNew ? (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-black"
                        style={{ background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)", color:"#34d399" }}>
                        NEW
                      </span>
                    ) : (
                      <span className="text-silver/20 text-[9px]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={item.url} target="_blank" rel="noopener"
                      className="text-[10px] font-bold text-silver/40 hover:text-gold transition-colors">
                      ดูรายละเอียด →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-center text-[10px] text-silver/20">
        ข้อมูลจาก MQL5 Market RSS + myfxbook · ตรวจสอบ EA ใหม่ทุกครั้งที่เปิดหน้านี้
      </div>
    </div>
  );
}
