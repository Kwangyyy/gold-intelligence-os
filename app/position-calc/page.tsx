"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { PositionCalcResult } from "@/app/api/position-calc/route";

function NumInput({ label, value, onChange, step = 1, min = 0, note }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; note?: string;
}) {
  return (
    <div>
      <label className="block text-[9px] uppercase tracking-widest mb-1"
        style={{ color: "rgba(175,185,215,0.4)" }}>{label}</label>
      <input type="number" value={value} min={min} step={step}
        onChange={e => onChange(+e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm font-mono font-bold outline-none"
        style={{
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#f5c451",
        }} />
      {note && <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>{note}</div>}
    </div>
  );
}

function RRBadge({ rr, label }: { rr: number | null; label: string }) {
  if (!rr) return null;
  const color = rr >= 3 ? "#34d399" : rr >= 2 ? "#86efac" : rr >= 1.5 ? "#f5c451" : "#f87171";
  return (
    <div className="panel px-3 py-2.5 text-center">
      <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>{label}</div>
      <div className="text-lg font-black" style={{ color }}>{rr}:1</div>
      <div className="text-[8px]" style={{ color: rr >= 2 ? color : "rgba(175,185,215,0.3)" }}>
        {rr >= 3 ? "ยอดเยี่ยม" : rr >= 2 ? "ดี" : rr >= 1.5 ? "พอได้" : "ต่ำ"}
      </div>
    </div>
  );
}

export default function PositionCalcPage() {
  const [account,    setAccount]    = useState(10000);
  const [riskPct,    setRiskPct]    = useState(1);
  const [entry,      setEntry]      = useState(0);
  const [sl,         setSl]         = useState(0);
  const [tp1,        setTp1]        = useState(0);
  const [tp2,        setTp2]        = useState(0);
  const [tp3,        setTp3]        = useState(0);
  const [dir,        setDir]        = useState<"long" | "short">("long");
  const [data,       setData]       = useState<PositionCalcResult | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [spotLoaded, setSpotLoaded] = useState(false);

  // Pre-fill spot price
  useEffect(() => {
    if (spotLoaded) return;
    fetch("/api/position-calc").then(r => r.json()).then((d: PositionCalcResult) => {
      const spot = d.goldSpot;
      setEntry(spot);
      setSl(+(spot - 20).toFixed(0));
      setTp1(+(spot + 40).toFixed(0));
      setTp2(+(spot + 80).toFixed(0));
      setData(d);
      setSpotLoaded(true);
    }).catch(() => {});
  }, [spotLoaded]);

  const calc = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        account: String(account), risk: String(riskPct),
        entry: String(entry), sl: String(sl), tp1: String(tp1),
        dir,
        ...(tp2 > 0 ? { tp2: String(tp2) } : {}),
        ...(tp3 > 0 ? { tp3: String(tp3) } : {}),
      });
      const res  = await fetch(`/api/position-calc?${params}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } finally { setLoading(false); }
  }, [account, riskPct, entry, sl, tp1, tp2, tp3, dir]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="📐 Position Size Calculator"
        subtitle="คำนวณ lot size, risk:reward, และขนาดสถานะที่เหมาะสมสำหรับ XAUUSD"
      />

      <div className="space-y-5">

        {/* Account & Risk */}
        <div className="panel px-5 py-4">
          <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
            บัญชีและความเสี่ยง
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Account Size ($)" value={account} onChange={setAccount} step={100} min={100}
              note="ขนาดบัญชีรวมทั้งหมด" />
            <NumInput label="Risk per trade (%)" value={riskPct} onChange={setRiskPct} step={0.1} min={0.1}
              note="แนะนำ 0.5–2% ต่อเทรด" />
          </div>
          <div className="mt-3 p-2 rounded-lg text-center"
            style={{ background: "rgba(245,196,81,0.05)", border: "1px solid rgba(245,196,81,0.15)" }}>
            <span className="text-xs font-bold" style={{ color: "#f5c451" }}>
              Risk Amount: ${(account * riskPct / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Direction */}
        <div className="panel px-5 py-4">
          <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
            ทิศทางเทรด
          </div>
          <div className="flex gap-2">
            {(["long", "short"] as const).map(d => (
              <button key={d} onClick={() => setDir(d)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: dir === d ? (d === "long" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)") : "rgba(255,255,255,0.03)",
                  border: `1px solid ${dir === d ? (d === "long" ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.5)") : "rgba(255,255,255,0.06)"}`,
                  color: dir === d ? (d === "long" ? "#34d399" : "#f87171") : "rgba(175,185,215,0.5)",
                }}>
                {d === "long" ? "⬆ Long (BUY)" : "⬇ Short (SELL)"}
              </button>
            ))}
          </div>
        </div>

        {/* Price inputs */}
        <div className="panel px-5 py-4">
          <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
            ราคาเป้าหมาย
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Entry Price ($)" value={entry} onChange={setEntry} step={0.5} />
            <NumInput label="Stop Loss ($)" value={sl} onChange={setSl} step={0.5}
              note={dir === "long" ? "ต้องต่ำกว่า Entry" : "ต้องสูงกว่า Entry"} />
            <NumInput label="Take Profit 1 ($)" value={tp1} onChange={setTp1} step={0.5} />
            <NumInput label="Take Profit 2 ($)" value={tp2} onChange={setTp2} step={0.5}
              note="0 = ไม่ใช้" />
            <NumInput label="Take Profit 3 ($)" value={tp3} onChange={setTp3} step={0.5}
              note="0 = ไม่ใช้" />
          </div>
        </div>

        {/* Calculate button */}
        <button onClick={calc} disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-black transition-all"
          style={{
            background: "linear-gradient(90deg, rgba(245,196,81,0.2) 0%, rgba(168,85,247,0.15) 100%)",
            border: "1px solid rgba(245,196,81,0.4)", color: "#f5c451",
            opacity: loading ? 0.6 : 1,
          }}>
          {loading ? "กำลังคำนวณ…" : "📐 คำนวณ Position Size"}
        </button>

        {/* Results */}
        {data && (
          <div className="space-y-4">

            {/* Verdict */}
            <div className="panel px-5 py-4" style={{ borderLeft: `4px solid ${data.verdictColor}` }}>
              <div className="text-xs font-black mb-1" style={{ color: data.verdictColor }}>
                {data.verdictTh}
              </div>
              <div className="flex gap-6 text-xs mt-2">
                <div>
                  <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Lot Size</div>
                  <div className="font-mono font-black text-lg" style={{ color: "#f5c451" }}>{data.lotSize}</div>
                </div>
                <div>
                  <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Position (oz)</div>
                  <div className="font-mono font-black text-lg" style={{ color: "#c084fc" }}>{data.positionSizeOz}</div>
                </div>
                <div>
                  <div className="text-[8px] mb-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>Risk $</div>
                  <div className="font-mono font-black text-lg" style={{ color: "#f87171" }}>${data.riskAmount}</div>
                </div>
              </div>
            </div>

            {/* R:R badges */}
            <div className="grid grid-cols-3 gap-2">
              <RRBadge rr={data.rr1} label="R:R → TP1" />
              {data.rr2 && <RRBadge rr={data.rr2} label="R:R → TP2" />}
              {data.rr3 && <RRBadge rr={data.rr3} label="R:R → TP3" />}
            </div>

            {/* Profit grid */}
            <div className="panel px-5 py-4">
              <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
                กำไร/ขาดทุนโดยประมาณ
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span style={{ color: "rgba(175,185,215,0.5)" }}>ขาดทุนสูงสุด (SL โดน)</span>
                  <span className="font-mono font-bold" style={{ color: "#f87171" }}>${data.maxLossIfStopped}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "rgba(175,185,215,0.5)" }}>กำไร TP1 (${data.takeProfit1})</span>
                  <span className="font-mono font-bold" style={{ color: "#34d399" }}>+${data.profitAtTp1}</span>
                </div>
                {data.profitAtTp2 != null && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "rgba(175,185,215,0.5)" }}>กำไร TP2 (${data.takeProfit2})</span>
                    <span className="font-mono font-bold" style={{ color: "#34d399" }}>+${data.profitAtTp2}</span>
                  </div>
                )}
                {data.profitAtTp3 != null && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "rgba(175,185,215,0.5)" }}>กำไร TP3 (${data.takeProfit3})</span>
                    <span className="font-mono font-bold" style={{ color: "#34d399" }}>+${data.profitAtTp3}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Position info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="panel px-4 py-3">
                <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>SL Distance</div>
                <div className="text-sm font-mono font-bold" style={{ color: "#f5c451" }}>${data.stopPips}</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>{data.stopPips} จุด</div>
              </div>
              <div className="panel px-4 py-3">
                <div className="text-[8px] mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Margin Required</div>
                <div className="text-sm font-mono font-bold" style={{ color: "#c084fc" }}>${data.marginRequired}</div>
                <div className="text-[8px]" style={{ color: "rgba(175,185,215,0.3)" }}>Leverage ~{data.leverageUsed}x</div>
              </div>
            </div>

            {/* Gold spot */}
            <div className="flex justify-between items-center px-1">
              <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
                Gold Spot: ${data.goldSpot.toLocaleString()} | คำนวณล่าสุด {new Date().toLocaleTimeString("th-TH")}
              </p>
            </div>
          </div>
        )}

        {/* Education */}
        <div className="panel px-5 py-4" style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.10)" }}>
          <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(168,85,247,0.4)" }}>
            💡 Position Sizing Best Practices
          </div>
          <ul className="space-y-1.5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
            <li>→ Risk ≤ 1-2% ต่อเทรด = capital preservation หลัก</li>
            <li>→ R:R ≥ 2:1 = ขาดทุน 3 ครั้ง ชนะ 2 ครั้ง ยังเป็น +EV</li>
            <li>→ 1 Standard Lot ทอง = 100 oz — มูลค่า ~$320,000 ที่ $3,200</li>
            <li>→ ไม่ควร risk เงินที่กู้มา หรือเงินที่ขาดไม่ได้</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
