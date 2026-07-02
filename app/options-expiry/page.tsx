"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { ExpiryEvent, OptionsExpiryPayload, StrikeZone } from "@/app/api/options-expiry/route";

function EventCard({ e }: { e: ExpiryEvent }) {
  const impactColor = e.priceImpact === "high" ? "#f87171" : e.priceImpact === "medium" ? "#f97316" : "#9ca3af";
  const typeIcon = e.type === "futures" ? "📦" : e.type === "options" ? "📊" : e.type === "quarterly" ? "🏛" : "📅";
  return (
    <div className={`rounded-xl px-4 py-3 space-y-1.5 ${e.isNear ? "ring-1" : ""}`}
      style={{
        background: e.isNear ? "rgba(248,113,113,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${e.isNear ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.05)"}`,
      }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{typeIcon}</span>
          <div>
            <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>{e.labelTh}</div>
            <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.35)" }}>{e.date}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          {e.isNear ? (
            <div className="text-[9px] font-black text-red-400 animate-pulse">⚠ {e.daysUntil}d</div>
          ) : (
            <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{e.daysUntil}d</div>
          )}
          <div className="text-[8px] font-bold" style={{ color: impactColor }}>
            {e.priceImpact === "high" ? "🔴 HIGH" : e.priceImpact === "medium" ? "🟡 MED" : "⚪ LOW"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[8px]">
        <span style={{ color: "rgba(175,185,215,0.3)" }}>OI ~{e.openInterestEst}K contracts</span>
      </div>
      <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.4)" }}>{e.note}</div>
    </div>
  );
}

function StrikeChart({ zones, goldPrice, maxPain, callWall, putWall }: {
  zones: StrikeZone[]; goldPrice: number; maxPain: number; callWall: number; putWall: number;
}) {
  const sorted = [...zones].sort((a, b) => b.strike - a.strike);
  const maxOI  = Math.max(...zones.map(z => z.oiThousands));
  return (
    <div className="space-y-1.5">
      {sorted.map(z => {
        const barPct = (z.oiThousands / maxOI) * 100;
        const isCall = z.type === "call";
        const isMaxP = z.strike === maxPain;
        const isCW   = z.strike === callWall;
        const isPW   = z.strike === putWall;
        const isGP   = Math.abs(z.strike - goldPrice) < 30;
        return (
          <div key={`${z.strike}-${z.type}`} className="flex items-center gap-2">
            <div className="w-14 text-right text-[8px] font-bold" style={{
              color: isGP ? "#f5c451" : isMaxP ? "#c084fc" : isCW ? "#f87171" : isPW ? "#34d399" : "rgba(175,185,215,0.4)"
            }}>
              ${z.strike.toLocaleString()}
              {isGP && " ●"}
              {isMaxP && " MP"}
            </div>
            <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-full"
                style={{
                  width: `${barPct}%`,
                  background: isCall ? "rgba(248,113,113,0.6)" : "rgba(52,211,153,0.6)",
                  float: isCall ? "right" : "left",
                }} />
            </div>
            <div className="w-12 text-[8px]" style={{ color: isCall ? "#f87171" : "#34d399" }}>
              {isCall ? "📞" : "🛡"} {z.oiThousands}K
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 pt-1 text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
        <span><span style={{ color: "#34d399" }}>■</span> Put (support)</span>
        <span><span style={{ color: "#f87171" }}>■</span> Call (resistance)</span>
        <span><span style={{ color: "#c084fc" }}>MP</span> Max Pain ${maxPain.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function OptionsExpiryPage() {
  const [data, setData]       = useState<OptionsExpiryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/options-expiry", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="📆 Options Expiry Calendar"
        subtitle="ปฏิทิน CME Gold Options/Futures Expiry — Max Pain & Gamma Zone"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📆 กำลังโหลดข้อมูล expiry…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="panel px-5 py-5 space-y-3">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Price</div>
                <div className="text-xl font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Max Pain</div>
                <div className="text-xl font-black" style={{ color: "#c084fc" }}>${data.maxPainEstimate.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Call Wall 🔴</div>
                <div className="text-xl font-black" style={{ color: "#f87171" }}>${data.callWall.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Put Wall 🟢</div>
                <div className="text-xl font-black" style={{ color: "#34d399" }}>${data.putWall.toLocaleString()}</div>
              </div>
            </div>

            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: `${data.gammaColor}10`, border: `1px solid ${data.gammaColor}30` }}>
              <div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gamma Zone</div>
                <div className="text-sm font-bold" style={{ color: data.gammaColor }}>{data.gammaZoneTh}</div>
              </div>
              <div className="text-right">
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Signal</div>
                <div className="text-sm font-bold" style={{ color: data.gammaColor }}>{data.goldBiasTh}</div>
              </div>
            </div>

            {data.nearestExpiry?.isNear && (
              <div className="rounded-xl px-4 py-2 text-xs font-bold text-red-400 animate-pulse"
                style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                ⚠ Expiry ภายใน {data.nearestExpiry.daysUntil} วัน — {data.nearestExpiry.labelTh}
              </div>
            )}
          </div>

          {/* Strike chart */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Open Interest by Strike (ประมาณการ)
            </div>
            <StrikeChart
              zones={data.strikeZones}
              goldPrice={data.goldPrice}
              maxPain={data.maxPainEstimate}
              callWall={data.callWall}
              putWall={data.putWall}
            />
          </div>

          {/* Expiry Calendar */}
          <div className="space-y-3">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>
              ปฏิทิน Expiry 2026-2027
            </div>
            {data.events.map(e => <EventCard key={`${e.date}-${e.type}`} e={e} />)}
          </div>

          {/* Education */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 ทำความเข้าใจ Gamma & Max Pain
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ <span className="font-bold" style={{ color: "#c084fc" }}>Max Pain</span>: strike ที่ทำให้ผู้ถือ options ขาดทุนรวมสูงสุด — ราคามักวิ่งเข้าหาใกล้ expiry</li>
              <li>→ <span className="font-bold" style={{ color: "#f87171" }}>Call Wall</span>: แนวต้านที่ dealer ต้องขาย futures เมื่อราคาขึ้นผ่าน → gamma hedge</li>
              <li>→ <span className="font-bold" style={{ color: "#34d399" }}>Put Wall</span>: แนวรับ dealer ต้องซื้อ futures เมื่อราคาลงต่ำกว่า → support</li>
              <li>→ Gamma Compression ใกล้ expiry → range-bound | Gamma Expansion ไกล expiry → trending</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ OI ประมาณการ; Expiry CME calendar H2 2026 | Gold: Yahoo Finance
            </p>
            <button onClick={load}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{ background: "rgba(245,196,81,0.1)", border: "1px solid rgba(245,196,81,0.25)", color: "#f5c451" }}>
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
