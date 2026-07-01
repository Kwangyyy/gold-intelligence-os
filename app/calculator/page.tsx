"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { SYMBOLS, CATEGORY_COLOR, type SymbolConfig } from "@/lib/symbolConfig";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function RiskPreset({ value, active, onClick }: { value: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
      style={active
        ? { background: "rgba(245,196,81,0.18)", border: "1px solid rgba(245,196,81,0.5)", color: "#f5c451" }
        : { background: "rgba(71,85,105,0.12)", border: "1px solid rgba(71,85,105,0.25)", color: "#475569" }}>
      {value}%
    </button>
  );
}

function InputRow({ label, value, onChange, prefix, suffix, readOnly, step }: {
  label: string; value: string; onChange?: (v: string) => void;
  prefix?: string; suffix?: string; readOnly?: boolean; step?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[11px] font-semibold text-silver/60">{label}</span>}
      <div className="flex items-center overflow-hidden rounded-xl border border-base-border/35 bg-base-panel/60">
        {prefix && <span className="pl-3 pr-1 text-xs text-silver/35">{prefix}</span>}
        <input type="number" value={value} readOnly={readOnly} step={step}
          onChange={e => onChange?.(e.target.value)}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm font-mono font-bold text-silver outline-none"
          style={{ cursor: readOnly ? "default" : "text" }} />
        {suffix && <span className="pr-3 text-xs text-silver/35">{suffix}</span>}
      </div>
    </div>
  );
}

function ResultCard({ label, value, sub, color, big }: { label: string; value: string; sub?: string; color?: string; big?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl p-4"
      style={{ background: "rgba(15,20,40,0.7)", border: "1px solid rgba(71,85,105,0.2)" }}>
      <span className="text-[9px] uppercase tracking-widest text-silver/35">{label}</span>
      <span className={`font-mono font-black ${big ? "text-2xl" : "text-lg"}`} style={{ color: color ?? "#e2e8f0" }}>{value}</span>
      {sub && <span className="text-[10px] text-silver/30">{sub}</span>}
    </div>
  );
}

// ── Tab 1: Position Size Calculator ──────────────────────────────────────────
function PositionTab() {
  const [symId, setSymId]         = useState("XAUUSD");
  const [balance, setBalance]     = useState("10000");
  const [riskPct, setRiskPct]     = useState("1");
  const [entry, setEntry]         = useState("");
  const [sl, setSl]               = useState("");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [useLive, setUseLive]     = useState(false);
  const [priceTs, setPriceTs]     = useState(0);
  const [showSymPicker, setShowSymPicker] = useState(false);

  const sym: SymbolConfig = SYMBOLS.find(s => s.id === symId) ?? SYMBOLS[0];
  const catColor = CATEGORY_COLOR[sym.category];

  useEffect(() => {
    setLivePrice(null); setUseLive(false); setEntry(""); setSl("");
    async function fetchPrice() {
      try {
        const r = await fetch("/api/market/symbols");
        const d: { id: string; price: number }[] = await r.json();
        const found = d.find(p => p.id === symId);
        if (found) { setLivePrice(found.price); setPriceTs(Date.now()); }
      } catch {}
    }
    fetchPrice();
    const id = setInterval(fetchPrice, 15_000);
    return () => clearInterval(id);
  }, [symId]);

  useEffect(() => {
    if (useLive && livePrice) setEntry(livePrice.toFixed(sym.decimals));
  }, [useLive, livePrice, sym.decimals]);

  const bal = parseFloat(balance) || 0;
  const risk = parseFloat(riskPct) || 0;
  const ent  = parseFloat(entry) || 0;
  const stop = parseFloat(sl) || 0;

  const riskUsd   = bal > 0 && risk > 0 ? bal * (risk / 100) : 0;
  const slDistRaw = ent > 0 && stop > 0 ? Math.abs(ent - stop) : 0;
  const slPips    = slDistRaw > 0 ? slDistRaw / sym.pipSize : 0;
  const lotSize   = slPips > 0 && riskUsd > 0 ? riskUsd / (slPips * sym.pipValuePerLot) : 0;
  const lotRnd    = Math.max(sym.minLot, Math.round(lotSize / sym.minLot) * sym.minLot);
  const marginEst = lotRnd * 400;
  const isBuy     = ent > 0 && stop > 0 && stop < ent;
  const hasResult = lotSize > 0;
  const secsAgo   = priceTs > 0 ? Math.floor((Date.now() - priceTs) / 1000) : null;

  return (
    <>
      {/* Symbol Picker */}
      <div className="mb-5">
        <button onClick={() => setShowSymPicker(v => !v)}
          className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all"
          style={{ background: `${catColor}15`, border: `1px solid ${catColor}40` }}>
          <span className="text-xl">{sym.icon}</span>
          <div className="text-left">
            <div className="text-sm font-black" style={{ color: catColor }}>{sym.id}</div>
            <div className="text-[10px] text-silver/40">{sym.label}</div>
          </div>
          <span className="ml-2 text-silver/30 text-xs">{showSymPicker ? "▲" : "▼"}</span>
        </button>
        {showSymPicker && (
          <div className="mt-2 rounded-2xl border border-base-border/30 bg-base-panel p-3"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            {(["metal","forex","crypto","energy","index"] as const).map(cat => (
              <div key={cat} className="mb-3">
                <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: CATEGORY_COLOR[cat] }}>
                  {cat === "metal" ? "Metals" : cat === "forex" ? "Forex" : cat === "crypto" ? "Crypto" : cat === "energy" ? "Energy" : "Indices"}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {SYMBOLS.filter(s => s.category === cat).map(s => (
                    <button key={s.id} onClick={() => { setSymId(s.id); setShowSymPicker(false); }}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-all"
                      style={symId === s.id
                        ? { background: `${CATEGORY_COLOR[cat]}18`, border: `1px solid ${CATEGORY_COLOR[cat]}44`, color: CATEGORY_COLOR[cat] }
                        : { background: "rgba(15,20,40,0.5)", border: "1px solid rgba(71,85,105,0.2)", color: "#64748b" }}>
                      <span>{s.icon}</span>
                      <span className="font-bold">{s.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="panel flex flex-col gap-5 p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-silver/40">ข้อมูล Account</div>
          <InputRow label="Balance" prefix="$" value={balance} onChange={setBalance} suffix="USD" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-silver/60">Risk per trade</span>
            <div className="flex gap-1.5 mb-1.5">
              {[0.5, 1, 1.5, 2].map(v => (
                <RiskPreset key={v} value={v} active={riskPct === String(v)} onClick={() => setRiskPct(String(v))} />
              ))}
            </div>
            <InputRow label="" value={riskPct} onChange={setRiskPct} suffix="%" />
          </div>
          <div className="h-px" style={{ background: "rgba(71,85,105,0.2)" }} />
          <div className="text-xs font-bold uppercase tracking-widest text-silver/40">Entry &amp; SL ({sym.id})</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-silver/60">Entry Price</span>
              {livePrice && (
                <button onClick={() => setUseLive(v => !v)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold transition-all"
                  style={useLive
                    ? { background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.35)", color: "#34d399" }
                    : { background: "rgba(71,85,105,0.1)", border: "1px solid rgba(71,85,105,0.25)", color: "#64748b" }}>
                  <span className={`h-1.5 w-1.5 rounded-full ${useLive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                  Live {livePrice.toFixed(sym.decimals)}
                  {secsAgo !== null && <span className="text-silver/30 ml-0.5">{secsAgo}s</span>}
                </button>
              )}
            </div>
            <InputRow label="" value={entry} onChange={v => { setUseLive(false); setEntry(v); }} readOnly={useLive} />
          </div>
          <InputRow label="Stop Loss" value={sl} onChange={setSl} />
          {slDistRaw > 0 && (
            <div className="rounded-lg border border-base-border/20 bg-white/[0.02] px-3 py-2 text-xs text-silver/50">
              SL: <span className="font-mono font-bold text-silver/80">{fmt(slDistRaw, sym.decimals)}</span> =
              <span className="font-mono font-bold text-silver/80"> {fmt(slPips, 0)} pips</span>
              · Risk: <span className="font-mono font-bold" style={{ color: "#f5c451" }}>${fmt(riskUsd)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {hasResult ? (
            <>
              <div className="rounded-2xl p-6 text-center"
                style={{ background: `${catColor}0d`, border: `1px solid ${catColor}40` }}>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: `${catColor}80` }}>Lot Size</div>
                <div className="text-5xl font-black font-mono" style={{ color: catColor }}>{fmt(lotRnd, sym.minLot < 0.01 ? 3 : 2)}</div>
                <div className="text-xs text-silver/40 mt-1">lots ({sym.lotUnit})</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ResultCard label="Risk Amount" value={`$${fmt(riskUsd)}`} sub={`${risk}% of $${fmt(bal, 0)}`} color="#f5c451" />
                <ResultCard label="SL (pips)" value={fmt(slPips, 0)} sub={`${fmt(slDistRaw, sym.decimals)} price pts`} />
                <ResultCard label="Pip Value/Lot" value={`$${sym.pipValuePerLot}`} sub={`per pip · ${sym.id}`} color={catColor} />
                <ResultCard label="Margin Est." value={`$${fmt(marginEst, 0)}`} sub="~1:500 leverage" color="#a78bfa" />
              </div>
              <div className="rounded-xl border border-base-border/20 bg-white/[0.015] px-4 py-3">
                {[1.5, 2, 3].map(rr => {
                  const tpDist = slDistRaw * rr;
                  const tp = isBuy ? ent + tpDist : ent - tpDist;
                  const reward = lotRnd * (slPips * rr) * sym.pipValuePerLot;
                  return (
                    <div key={rr} className="flex items-center justify-between text-xs py-1">
                      <span className="text-silver/40">TP R:R 1:{rr}</span>
                      <span className="font-mono font-bold text-silver/70">{fmt(tp, sym.decimals)}</span>
                      <span className="font-mono text-emerald-400/80">+${fmt(reward)}</span>
                    </div>
                  );
                })}
              </div>
              {risk > 2 && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-xs text-red-400/80">
                  ⚠️ Risk {risk}% ต่อไม้ — 5 ไม้ติดต่อกัน = เสีย {fmt(5 * risk, 1)}% ของทุน
                </div>
              )}
            </>
          ) : (
            <div className="panel flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="text-4xl opacity-30">{sym.icon}</div>
              <div className="text-sm text-silver/30">ใส่ Balance, Risk%, Entry และ SL<br />เพื่อคำนวณ Lot Size สำหรับ {sym.id}</div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-base-border/15 bg-white/[0.012] px-4 py-3">
        <div className="text-[10px] text-silver/30 font-mono">
          {sym.id}: pipSize={sym.pipSize} · pipValue=${sym.pipValuePerLot}/lot · minLot={sym.minLot} {sym.lotUnit}
        </div>
      </div>
    </>
  );
}

// ── Tab 2: Compound Growth Simulator ─────────────────────────────────────────
function CompoundTab() {
  const [balance,  setBalance]  = useState("10000");
  const [monthly,  setMonthly]  = useState("5");
  const [months,   setMonths]   = useState("24");
  const [drawdown, setDrawdown] = useState("10"); // monthly max DD%

  const bal  = parseFloat(balance)  || 10000;
  const rate = parseFloat(monthly)  / 100;
  const n    = Math.min(parseInt(months) || 24, 120);
  const dd   = parseFloat(drawdown) / 100;

  // Build month table
  type Row = { month: number; balance: number; profit: number; cumPct: number };
  const rows: Row[] = [];
  let cur = bal;
  for (let m = 0; m <= n; m++) {
    rows.push({ month: m, balance: cur, profit: cur - bal, cumPct: (cur / bal - 1) * 100 });
    cur = cur * (1 + rate);
  }
  const final = rows[rows.length - 1].balance;
  const totalRoi = (final / bal - 1) * 100;
  const annualRate = (Math.pow(final / bal, 12 / n) - 1) * 100;

  // SVG equity curve
  const W = 500; const H = 120;
  const minB = bal; const maxB = final;
  const rng = maxB - minB || 1;
  const pts = rows.map((r, i) =>
    `${(i / (rows.length - 1)) * W},${H - ((r.balance - minB) / rng) * (H - 8)}`
  ).join(" ");

  // Milestone rows to display (every 3 months + final)
  const display = rows.filter(r => r.month % 3 === 0 || r.month === n);

  const color = "#f5c451";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="lg:col-span-2 panel p-5 flex flex-col gap-4">
        <div className="text-xs font-bold uppercase tracking-widest text-silver/40">ตั้งค่า</div>
        <InputRow label="เงินต้น" prefix="$" value={balance} onChange={setBalance} suffix="USD" />
        <InputRow label="เป้าหมายต่อเดือน" value={monthly} onChange={setMonthly} suffix="%" step="0.5" />
        <InputRow label="ระยะเวลา" value={String(n)} onChange={v => setMonths(v)} suffix="เดือน" />
        <InputRow label="Max Drawdown ต่อเดือน (สมมติ)" value={drawdown} onChange={setDrawdown} suffix="%" />

        <div className="grid grid-cols-2 gap-3 mt-2">
          <ResultCard label="ยอดสุดท้าย" value={`$${fmt(final, 0)}`} color={color} big />
          <ResultCard label="กำไรรวม" value={`+${fmt(totalRoi, 1)}%`} color="#34d399" big />
          <ResultCard label="CAGR (ต่อปี)" value={`${fmt(annualRate, 1)}%`} color="#a78bfa" />
          <ResultCard label="กำไร $" value={`$${fmt(final - bal, 0)}`} color="#34d399" />
        </div>
      </div>

      {/* Chart + Table */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        {/* Equity curve */}
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Equity Curve</div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:"100%", height: H }}>
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5c451" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f5c451" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={`M0,${H} ${pts} ${W},${H} Z`} fill="url(#goldGrad)" />
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          </svg>
          {/* Milestone markers */}
          <div className="mt-2 flex justify-between text-[9px] text-silver/30">
            {[0, Math.floor(n/4), Math.floor(n/2), Math.floor(3*n/4), n].map(m => (
              <span key={m}>เดือน {m}</span>
            ))}
          </div>
        </div>

        {/* Milestone table */}
        <div className="panel p-4 overflow-x-auto">
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">ตารางรายไตรมาส</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-silver/30 text-[10px]">
                <th className="text-left pb-2 font-normal">เดือน</th>
                <th className="text-right pb-2 font-normal">ยอดเงิน</th>
                <th className="text-right pb-2 font-normal">กำไร</th>
                <th className="text-right pb-2 font-normal">ROI</th>
              </tr>
            </thead>
            <tbody>
              {display.map(r => (
                <tr key={r.month} className={`border-t border-white/[0.04] ${r.month === n ? "text-gold font-bold" : ""}`}>
                  <td className="py-1.5 text-silver/60">{r.month === 0 ? "เริ่มต้น" : `เดือน ${r.month}`}</td>
                  <td className="py-1.5 text-right font-mono">${fmt(r.balance, 0)}</td>
                  <td className="py-1.5 text-right font-mono text-emerald-400">{r.profit > 0 ? "+" : ""}${fmt(r.profit, 0)}</td>
                  <td className="py-1.5 text-right font-mono text-emerald-400">{r.cumPct > 0 ? "+" : ""}{fmt(r.cumPct, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Risk of Ruin ───────────────────────────────────────────────────────
function RuinTab() {
  const [winRate,   setWinRate]   = useState("50");
  const [avgRR,     setAvgRR]     = useState("2");
  const [riskPct,   setRiskPct]   = useState("1");
  const [ruinLevel, setRuinLevel] = useState("20");
  const [balance,   setBalance]   = useState("10000");

  const w    = Math.max(0.01, Math.min(0.99, parseFloat(winRate)   / 100));
  const rr   = Math.max(0.1,                 parseFloat(avgRR));
  const f    = Math.max(0.001, Math.min(0.5, parseFloat(riskPct)   / 100));
  const ruin = Math.max(1,     Math.min(99,  parseFloat(ruinLevel) / 100));
  const bal  = parseFloat(balance) || 10000;

  // Expectancy per unit risked
  const expectancy = w * rr - (1 - w);
  // Kelly % (optimal fraction)
  const kelly = Math.max(0, (w - (1 - w) / rr)) * 100;
  // Half-Kelly (safer)
  const halfKelly = kelly / 2;

  // Gambler's Ruin probability
  // edge = p*b - q where p=win, q=loss, b=avg reward per unit risk
  const lossR = (1 - w) / rr;        // loss expressed in reward units
  const winR  = w;
  const edge  = winR - lossR;        // simplified edge per unit

  const numUnits = ruin / f;          // how many losing units to ruin
  let ror = 0;
  if (edge <= 0) {
    ror = 100;
  } else {
    // P(ruin) ≈ ((1-edge)/(1+edge))^numUnits
    const ratio = (1 - edge) / (1 + edge);
    ror = Math.min(99.9, Math.pow(ratio, numUnits) * 100);
  }

  // Max consecutive losses before ruin
  const consLossNeeded = Math.ceil(Math.log(1 - ruin) / Math.log(1 - f));
  const probConsLoss   = Math.pow(1 - w, consLossNeeded) * 100;

  // Simulate equity curve (Monte Carlo - 1 run)
  const simTrades = 200;
  const curve: number[] = [bal];
  let cur = bal;
  let seed = 12345;
  function rand() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 4294967296; }
  for (let i = 0; i < simTrades && cur > bal * (1 - ruin); i++) {
    if (rand() < w) { cur *= 1 + rr * f; } else { cur *= 1 - f; }
    curve.push(Math.max(0, cur));
  }
  const W = 500; const H = 100;
  const minC = Math.min(...curve); const maxC = Math.max(...curve);
  const rngC = maxC - minC || 1;
  const pts = curve.map((v, i) => `${(i / (curve.length - 1)) * W},${H - ((v - minC) / rngC) * H}`).join(" ");
  const finalColor = curve[curve.length - 1] > bal ? "#34d399" : "#f87171";

  // Risk meter color
  const rorColor = ror < 5 ? "#34d399" : ror < 20 ? "#f5c451" : ror < 50 ? "#fb923c" : "#f87171";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="lg:col-span-2 panel p-5 flex flex-col gap-4">
        <div className="text-xs font-bold uppercase tracking-widest text-silver/40">ตั้งค่า Strategy</div>
        <InputRow label="Win Rate" value={winRate} onChange={setWinRate} suffix="%" step="1" />
        <InputRow label="Average R:R (1: ?)" value={avgRR} onChange={setAvgRR} suffix="R" step="0.1" />
        <InputRow label="Risk per trade" value={riskPct} onChange={setRiskPct} suffix="%" step="0.1" />
        <InputRow label="Ruin Level (drawdown %)" value={ruinLevel} onChange={setRuinLevel} suffix="%" step="1" />
        <InputRow label="Account Balance" prefix="$" value={balance} onChange={setBalance} suffix="USD" />

        <div className="h-px" style={{ background: "rgba(71,85,105,0.2)" }} />
        <div className="text-xs font-bold uppercase tracking-widest text-silver/40">ผลลัพธ์</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 rounded-xl p-4 text-center"
            style={{ background: `${rorColor}10`, border: `1px solid ${rorColor}35` }}>
            <div className="text-[10px] uppercase tracking-widest text-silver/40 mb-1">Risk of Ruin</div>
            <div className="text-4xl font-black" style={{ color: rorColor }}>{ror.toFixed(1)}%</div>
            <div className="text-[10px] text-silver/30 mt-1">
              {ror < 5 ? "ปลอดภัย" : ror < 20 ? "พอรับได้" : ror < 50 ? "สูง — ควรลด risk" : "อันตราย — ลด risk ด่วน"}
            </div>
          </div>
          <ResultCard label="Expectancy/trade" value={`${expectancy >= 0 ? "+" : ""}${fmt(expectancy * f * bal)}`} sub="คาดหวังต่อไม้ ($)" color={expectancy >= 0 ? "#34d399" : "#f87171"} />
          <ResultCard label="Kelly Criterion" value={`${fmt(kelly, 1)}%`} sub={`Half-Kelly: ${fmt(halfKelly, 1)}%`} color="#a78bfa" />
          <ResultCard label="ขาดทุนติด ~{ruinLevel}%" value={`${consLossNeeded} ไม้`} sub={`โอกาส ${fmt(probConsLoss, 2)}%`} color="#f5c451" />
          <ResultCard label="เงินหาย ${fmt(bal * ruin, 0)}" value={`${ruinLevel}% DD`} sub={`จาก $${fmt(bal, 0)}`} color="#f87171" />
        </div>
      </div>

      {/* Chart */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        {/* Simulated equity */}
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">Simulated Equity (200 trades)</div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:"100%", height: H }}>
            <line x1="0" y1={H - ((bal - minC) / rngC) * H} x2={W} y2={H - ((bal - minC) / rngC) * H}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 3" />
            <polyline points={pts} fill="none" stroke={finalColor} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <p className="text-[9px] text-silver/25 mt-1">Deterministic simulation · ผลจริงอาจต่างกัน</p>
        </div>

        {/* Strategy evaluation */}
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">ประเมิน Strategy</div>
          <div className="space-y-2 text-xs">
            {[
              { label: "Edge มี (Expectancy > 0)", ok: expectancy > 0 },
              { label: `Win rate ≥ ${fmt(100/(1+rr), 0)}% (break-even for R:R ${rr})`, ok: w * 100 >= 100 / (1 + rr) },
              { label: "Risk per trade ≤ 2%", ok: f * 100 <= 2 },
              { label: "Risk ≤ ½ Kelly", ok: f * 100 <= halfKelly },
              { label: "Risk of Ruin < 5%", ok: ror < 5 },
              { label: "Expectancy > 0.1R", ok: expectancy > 0.1 },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`shrink-0 text-base ${ok ? "text-emerald-400" : "text-red-400"}`}>{ok ? "✓" : "✗"}</span>
                <span className={ok ? "text-silver/60" : "text-red-400/70"}>{label}</span>
              </div>
            ))}
          </div>
          {expectancy > 0 && kelly > 0 && (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-[10px] text-emerald-400/80">
              💡 แนะนำ risk ≤ {fmt(Math.min(halfKelly, 2), 1)}% ต่อไม้ (½ Kelly) เพื่อลด drawdown โดยไม่เสีย edge
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Tab = "pos" | "compound" | "ruin";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "pos",      label: "Position Size",      icon: "📐" },
  { id: "compound", label: "Compound Growth",    icon: "📈" },
  { id: "ruin",     label: "Risk of Ruin",       icon: "🎲" },
];

export default function CalculatorPage() {
  const [tab, setTab] = useState<Tab>("pos");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Trading Calculator" subtitle="Position Size · Compound Growth · Risk of Ruin" />

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 p-1 rounded-xl w-fit"
        style={{ background: "rgba(15,20,40,0.6)", border: "1px solid rgba(71,85,105,0.2)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all"
            style={tab === t.id
              ? { background: "rgba(245,196,81,0.15)", border: "1px solid rgba(245,196,81,0.4)", color: "#f5c451" }
              : { color: "#475569", border: "1px solid transparent" }}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "pos"      && <PositionTab />}
      {tab === "compound" && <CompoundTab />}
      {tab === "ruin"     && <RuinTab />}

      <div className="mt-6"><Disclaimer /></div>
    </div>
  );
}
