"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { ScalpPayload, ScalpLevel } from "@/app/api/scalp-levels/route";

function LevelLadder({ levels, currentPrice }: { levels: ScalpLevel[]; currentPrice: number }) {
  if (!levels.length) return null;

  const prices  = levels.map(l => l.price);
  const minP    = Math.min(...prices, currentPrice) - 5;
  const maxP    = Math.max(...prices, currentPrice) + 5;
  const range   = maxP - minP || 1;
  const toY     = (p: number) => ((maxP - p) / range) * 260;

  return (
    <div className="relative" style={{ height: 280 }}>
      <svg viewBox={`0 0 400 280`} className="w-full absolute inset-0">
        {/* Level lines */}
        {levels.map((l) => {
          const y = toY(l.price);
          return (
            <g key={`${l.tag}-${l.price}`}>
              <line x1="60" y1={y} x2="320" y2={y} stroke={l.color} strokeWidth={l.strength === "strong" ? 1.5 : 0.8}
                strokeDasharray={l.type === "vwap" ? "4,3" : undefined} opacity={0.7} />
              <text x="10" y={y + 4} fontSize="9" fill={l.color} fontWeight="bold">{l.tag}</text>
              <text x="325" y={y + 4} fontSize="8" fill="rgba(175,185,215,0.5)">{l.price}</text>
            </g>
          );
        })}
        {/* Current price line */}
        {(() => {
          const y = toY(currentPrice);
          return (
            <g>
              <line x1="60" y1={y} x2="320" y2={y} stroke="#f5c451" strokeWidth="2" />
              <rect x="60" y={y - 8} width="80" height="14" fill="#f5c451" rx="3" />
              <text x="100" y={y + 4} fontSize="9" fill="#000" fontWeight="900" textAnchor="middle">{currentPrice}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function LevelRow({ l }: { l: ScalpLevel }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="w-10 text-right">
        <span className="text-[9px] font-black" style={{ color: l.color }}>{l.tag}</span>
      </div>
      <div className="flex-1">
        <div className="text-[10px]" style={{ color: "rgba(175,185,215,0.7)" }}>{l.typeTh}</div>
      </div>
      <div className="font-mono text-[11px] font-black" style={{ color: l.color }}>
        {l.price.toLocaleString()}
      </div>
      <div className="w-16 text-right text-[9px]" style={{ color: l.direction === "above" ? "#f87171" : "#34d399" }}>
        {l.distancePct > 0 ? "+" : ""}{l.distancePct.toFixed(2)}%
      </div>
      <div className="w-14 text-right">
        <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${l.color}18`, color: l.color }}>
          {l.strengthTh}
        </span>
      </div>
    </div>
  );
}

export default function ScalpLevelsPage() {
  const [data, setData]       = useState<ScalpPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/scalp-levels", { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const biasColor = data?.biasIntraday === "bullish" ? "#34d399" : data?.biasIntraday === "bearish" ? "#f87171" : "#f5c451";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="⚡ Intraday Scalp Levels"
        subtitle="Daily pivot + session H/L + VWAP — key intraday zones for scalping"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            ⚡ กำลังคำนวณ Scalp Levels…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Hero stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "ราคา", value: `$${data.currentPrice.toLocaleString()}`, color: "#f5c451" },
              { label: "ATR 1H", value: `$${data.atr1h}`, color: "rgba(175,185,215,0.6)" },
              { label: "แนวรับใกล้", value: data.nearestSupport.toLocaleString(), color: "#34d399" },
              { label: "แนวต้านใกล้", value: data.nearestResistance.toLocaleString(), color: "#f87171" },
            ].map(({ label, value, color }) => (
              <div key={label} className="panel px-3 py-3">
                <div className="text-[7px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>{label}</div>
                <div className="text-sm font-black" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Bias + session */}
          <div className="panel px-5 py-4" style={{ borderLeft: `3px solid ${biasColor}` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black mb-1" style={{ color: biasColor }}>
                  {data.biasIntraday === "bullish" ? "↑" : data.biasIntraday === "bearish" ? "↓" : "→"} {data.biasTh}
                </div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.45)" }}>{data.sessionNoteTh}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Suggested</div>
                <div className="text-[9px]" style={{ color: "#34d399" }}>TP1: {data.suggestedTP1}</div>
                <div className="text-[9px]" style={{ color: "#6ee7b7" }}>TP2: {data.suggestedTP2}</div>
                <div className="text-[9px]" style={{ color: "#f87171" }}>SL: {data.suggestedSL}</div>
              </div>
            </div>
          </div>

          {/* Price ladder SVG */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              แผนผัง Level (เส้นเหลือง = ราคาปัจจุบัน)
            </div>
            <LevelLadder levels={data.levels} currentPrice={data.currentPrice} />
          </div>

          {/* Level table — above */}
          {data.levels.filter(l => l.direction === "above").length > 0 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "#f87171" }}>
                🔴 แนวต้านด้านบน
              </div>
              <div className="space-y-0.5">
                {data.levels.filter(l => l.direction === "above").reverse().map(l => <LevelRow key={l.tag + l.price} l={l} />)}
              </div>
            </div>
          )}

          {/* Current zone */}
          <div className="panel px-5 py-3" style={{ background: "rgba(245,196,81,0.06)", border: "1px solid rgba(245,196,81,0.2)" }}>
            <div className="flex items-center gap-3">
              <span className="text-xl">📍</span>
              <div>
                <div className="text-xs font-black" style={{ color: "#f5c451" }}>ราคาปัจจุบัน: {data.currentPrice.toLocaleString()}</div>
                <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>
                  {data.levels.filter(l => l.direction === "current").map(l => l.tag).join(", ") || "ระหว่าง Level"}
                </div>
              </div>
            </div>
          </div>

          {/* Level table — below */}
          {data.levels.filter(l => l.direction === "below").length > 0 && (
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "#34d399" }}>
                🟢 แนวรับด้านล่าง
              </div>
              <div className="space-y-0.5">
                {data.levels.filter(l => l.direction === "below").map(l => <LevelRow key={l.tag + l.price} l={l} />)}
              </div>
            </div>
          )}

          {/* Scalp zones */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              โซน Scalp
            </div>
            <div className="space-y-2">
              {data.zones.map(z => (
                <div key={z.label} className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ background: `${z.color}0c`, border: `1px solid ${z.color}20` }}>
                  <div className="w-2 h-6 rounded-full" style={{ background: z.color, opacity: 0.6 }} />
                  <div className="flex-1">
                    <div className="text-[10px] font-bold" style={{ color: z.color }}>{z.labelTh}</div>
                    <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
                      {z.from.toLocaleString()} – {z.to.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[9px] font-bold uppercase" style={{ color: z.color }}>
                    {z.bias === "buy" ? "ซื้อ" : z.bias === "sell" ? "ขาย" : "รอดู"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>💡 Tips การ Scalp</div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ ตั้ง SL 1× ATR (1H) ใต้จุดเข้า — ปัจจุบัน ATR = ${data.atr1h}</li>
              <li>→ เข้าที่แนวรับเมื่อ price action ยืนยัน (pin bar / engulfing)</li>
              <li>→ TP1 ที่ Level ถัดไป, TP2 ที่ Level ที่ 2 → R:R ≥ 1:1.5</li>
              <li>→ VWAP เป็นแกนกลาง — เหนือ VWAP = bullish bias, ต่ำกว่า = bearish</li>
              <li>→ หลีกเลี่ยงเทรดช่วง 1 ชั่วโมงก่อน/หลังข่าว USD สำคัญ</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              {data.levels.length} levels · อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
