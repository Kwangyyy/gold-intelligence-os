"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { ETFFlowsPayload, ETFEntry } from "@/app/api/etf-flows/route";

function WeeklyFlowChart({ flows }: { flows: number[] }) {
  const max = Math.max(...flows.map(Math.abs), 10);
  const W = 120, H = 40, barW = 22, gap = 4;
  const weeks = ["W-3", "W-2", "W-1", "Now"];
  return (
    <svg viewBox={`0 0 ${W} ${H + 12}`} width={W} height={H + 12}>
      {flows.map((v, i) => {
        const h = Math.abs(v) / max * (H / 2 - 2);
        const x = i * (barW + gap) + 2;
        const positive = v >= 0;
        const color = positive ? "#34d399" : "#f87171";
        return (
          <g key={i}>
            <rect
              x={x} y={positive ? H / 2 - h : H / 2}
              width={barW} height={Math.max(1, h)}
              fill={color} opacity={0.8} rx={2}
            />
            <text x={x + barW / 2} y={H + 10} textAnchor="middle" fontSize="6" fill="rgba(175,185,215,0.35)">
              {weeks[i]}
            </text>
          </g>
        );
      })}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
    </svg>
  );
}

function VolumeBar({ ratio }: { ratio: number }) {
  const pct = Math.min(100, ratio * 50);
  const color = ratio > 2 ? "#34d399" : ratio > 1.2 ? "#86efac" : ratio < 0.5 ? "#f87171" : "#9ca3af";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[9px] font-bold w-8 text-right" style={{ color }}>
        {ratio.toFixed(2)}x
      </span>
    </div>
  );
}

function ETFCard({ e }: { e: ETFEntry }) {
  const changeColor = e.changePct >= 0 ? "#34d399" : "#f87171";
  const pos52Color  = e.pos52w >= 80 ? "#f5c451" : e.pos52w >= 50 ? "#86efac" : "#818cf8";

  return (
    <div className="panel px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-black" style={{ color: "rgba(245,196,81,0.9)" }}>{e.symbol}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
              style={{ background: e.flowSignalColor + "22", color: e.flowSignalColor }}>
              {e.flowSignalTh}
            </span>
          </div>
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.4)" }}>{e.nameTh}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-black" style={{ color: "rgba(175,185,215,0.9)" }}>
            ${e.price.toFixed(2)}
          </div>
          <div className="text-[9px] font-bold" style={{ color: changeColor }}>
            {e.changePct >= 0 ? "▲" : "▼"} {Math.abs(e.changePct).toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>52W Position</div>
          <div className="text-[10px] font-bold" style={{ color: pos52Color }}>
            {e.pos52w}%
          </div>
          <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            of 52W range
          </div>
        </div>
        <div>
          <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Vol vs 20d avg</div>
          <VolumeBar ratio={e.volumeRatio} />
          <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
            {(e.volume / 1e6).toFixed(1)}M shares
          </div>
        </div>
        <div>
          <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>52W Range</div>
          <div className="text-[9px]" style={{ color: "rgba(175,185,215,0.55)" }}>
            <span style={{ color: "#f87171" }}>${e.low52.toFixed(0)}</span>
            <span style={{ color: "rgba(175,185,215,0.3)" }}> – </span>
            <span style={{ color: "#34d399" }}>${e.high52.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Weekly flow chart */}
      {e.weeklyFlows.length > 0 && (
        <div>
          <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Weekly flow index (last 4 weeks)</div>
          <WeeklyFlowChart flows={e.weeklyFlows} />
        </div>
      )}
    </div>
  );
}

export default function ETFFlowsPage() {
  const [data, setData]       = useState<ETFFlowsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/etf-flows", { cache: "no-store" });
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
        title="📈 Gold ETF Flows"
        subtitle="ติดตาม flow เงินเข้า/ออก GLD, IAU, SGOL — สัญญาณความต้องการทองของสถาบัน"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>
            📈 กำลังโหลดข้อมูล ETF…
          </div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">

          {/* Summary */}
          <div className="panel px-5 py-5">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>
                  Composite ETF Flow
                </div>
                <div className="text-lg font-black mb-1" style={{ color: data.compositeFlowColor }}>
                  {data.compositeFlowTh}
                </div>
                <div className="text-xs font-bold" style={{ color: data.goldBiasColor }}>
                  {data.goldBiasTh}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Gold Spot</div>
                <div className="text-lg font-black" style={{ color: "#f5c451" }}>${data.goldPrice.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* ETF cards */}
          {data.entries.map(e => (
            <ETFCard key={e.symbol} e={e} />
          ))}

          {/* How to interpret */}
          <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
              💡 วิธีอ่าน ETF Flows
            </div>
            <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
              <li>→ <span className="font-bold" style={{ color: "#34d399" }}>Volume สูง + ราคาขึ้น</span> = สถาบันสร้าง ETF shares ใหม่ (ซื้อทองหนุนหลัง) → Bullish</li>
              <li>→ <span className="font-bold" style={{ color: "#f87171" }}>Volume สูง + ราคาลง</span> = สถาบันคืน ETF shares (ขายทองออก) → Bearish</li>
              <li>→ GLD: ~0.0933 oz/share | IAU: ~0.0099 oz/share | SGOL: ~0.0963 oz/share</li>
              <li>→ ETF Premium/Discount: ถ้า implied gold ≠ spot → ตลาด arbitrage จะดึงกลับ</li>
            </ul>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              ⚠ ข้อมูลจาก Yahoo Finance — อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
