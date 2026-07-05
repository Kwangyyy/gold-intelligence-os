"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { STRATEGY_META, type StrategyId } from "@/lib/eaOptimizer";
import type { OptimizedResult } from "@/lib/eaOptimizer";
import type { RobustOptimizedResult, Verdict } from "@/lib/robustness";

// Results may be plain (in-sample) or robust (with OOS fields).
type EaResult = OptimizedResult & Partial<RobustOptimizedResult>;

const STRATEGIES = Object.entries(STRATEGY_META) as [StrategyId, typeof STRATEGY_META[StrategyId]][];

const VERDICT_STYLE: Record<Verdict, { color: string; th: string }> = {
  robust: { color: "#34d399", th: "ทนทาน" },
  fragile: { color: "#f5c451", th: "เปราะ" },
  overfit: { color: "#f87171", th: "โอเวอร์ฟิต" },
  no_edge: { color: "#94a3b8", th: "ไม่มีเอดจ์" },
};

const DIRECTION_OPTS = [
  { v: "both",      label: "Buy & Sell" },
  { v: "buy_only",  label: "Buy Only" },
  { v: "sell_only", label: "Sell Only" },
] as const;

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-widest text-silver/30">{label}</span>
      <span className="text-sm font-black font-mono" style={{ color }}>{value}</span>
    </div>
  );
}

function ResultCard({ r, selected, onSelect, onExport }: {
  r: EaResult;
  selected: boolean;
  onSelect: () => void;
  onExport: () => void;
}) {
  const res     = r.result;
  const ddColor = res.maxDrawdown > 20 ? "#f87171" : res.maxDrawdown > 10 ? "#f5c451" : "#34d399";
  const pfColor = res.profitFactor > 2 ? "#34d399" : res.profitFactor > 1.5 ? "#f5c451" : "#94a3b8";
  const vstyle  = r.verdict ? VERDICT_STYLE[r.verdict] : null;

  // Mini equity sparkline SVG
  const curve = r.result.balanceCurve;
  const vals  = curve.map(c => c.balance);
  const minV  = Math.min(...vals);
  const maxV  = Math.max(...vals);
  const range = maxV - minV || 1;
  const W = 160; const H = 36;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - minV) / range) * H}`).join(" ");
  const finalV = vals[vals.length - 1];

  return (
    <div
      onClick={onSelect}
      className="cursor-pointer rounded-2xl p-4 transition-all"
      style={{
        background: selected ? "rgba(168,85,247,0.08)" : "rgba(13,18,30,0.7)",
        border: `1px solid ${selected ? "rgba(168,85,247,0.45)" : "rgba(71,85,105,0.18)"}`,
        boxShadow: selected ? "0 0 0 1px rgba(168,85,247,0.15)" : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{ background:"rgba(245,196,81,0.12)", color:"#f5c451", border:"1px solid rgba(245,196,81,0.3)" }}>
              #{r.rank}
            </span>
            <span className="text-xs font-bold text-white">{r.strategyName}</span>
            {vstyle && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: `${vstyle.color}18`, color: vstyle.color, border: `1px solid ${vstyle.color}45` }}>
                {vstyle.th}
              </span>
            )}
          </div>
          <div className="text-[10px] text-silver/40 mt-0.5 font-mono">{r.label}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black" style={{ color: r.score >= 60 ? "#34d399" : r.score >= 40 ? "#f5c451" : "#94a3b8" }}>
            {r.score.toFixed(0)}
          </div>
          <div className="text-[9px] text-silver/30 uppercase tracking-widest">score</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-3">
        <StatBadge label="Profit F." value={res.profitFactor.toFixed(2)}  color={pfColor} />
        <StatBadge label="Win Rate" value={res.winRate.toFixed(0) + "%"}  color="#94a3b8" />
        <StatBadge label="Max DD"   value={res.maxDrawdown.toFixed(1) + "%"} color={ddColor} />
        <StatBadge label="Sharpe"   value={res.sharpeRatio.toFixed(2)}    color="#94a3b8" />
        <StatBadge label="Trades"   value={String(res.totalTrades)}       color="#94a3b8" />
        <StatBadge label="P&L"      value={"$" + res.totalPnl.toFixed(0)} color={finalV > 10000 ? "#34d399" : "#f87171"} />
      </div>

      {/* Out-of-sample validation strip (robust mode) */}
      {r.verdict && (
        <div className="mb-3 flex items-center justify-between rounded-lg px-3 py-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[9px] uppercase tracking-widest text-silver/35">In-sample → Out-of-sample</span>
          <span className="font-mono text-[11px] font-bold">
            <span style={{ color: (r.isReturnPct ?? 0) >= 0 ? "#94a3b8" : "#f87171" }}>{r.isReturnPct}%</span>
            <span className="mx-1 text-silver/30">→</span>
            <span style={{ color: (r.oosReturnPct ?? 0) >= 0 ? "#34d399" : "#f87171" }}>{r.oosReturnPct}%</span>
            <span className="ml-2 text-silver/40">OOS PF {r.oosProfitFactor}</span>
          </span>
        </div>
      )}

      {/* Equity sparkline */}
      {vals.length > 1 && (
        <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <polyline points={pts} fill="none"
            stroke={finalV > 10000 ? "#34d399" : "#f87171"}
            strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={onSelect}
          className="flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all"
          style={selected
            ? { background:"rgba(168,85,247,0.18)", border:"1px solid rgba(168,85,247,0.45)", color:"#c084fc" }
            : { background:"rgba(71,85,105,0.1)", border:"1px solid rgba(71,85,105,0.2)", color:"#64748b" }}>
          {selected ? "✓ เลือกแล้ว" : "เลือก"}
        </button>
        <button
          onClick={onExport}
          className="flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all"
          style={{ background:"rgba(245,196,81,0.1)", border:"1px solid rgba(245,196,81,0.35)", color:"#f5c451" }}>
          ⬇ Export MQL5
        </button>
      </div>
    </div>
  );
}

export default function AiEaPage() {
  const [strategy,  setStrategy]  = useState<StrategyId>("auto");
  const [direction, setDirection] = useState<"both"|"buy_only"|"sell_only">("both");
  const [robust,    setRobust]    = useState(true); // filter overfit via out-of-sample validation
  const [loading,   setLoading]   = useState(false);
  const [results,   setResults]   = useState<EaResult[]>([]);
  const [selected,  setSelected]  = useState<number | null>(null);
  const [error,     setError]     = useState("");
  const [ohlcLen,   setOhlcLen]   = useState(0);

  const [exporting, setExporting] = useState(false);
  const [eaCode,    setEaCode]    = useState("");
  const [eaFilename,setEaFilename]= useState("");
  const [exportErr, setExportErr] = useState("");

  const runOptimize = useCallback(async () => {
    setLoading(true); setError(""); setResults([]); setSelected(null); setEaCode(""); setExportErr("");
    try {
      const r = await fetch(`/api/ai-ea/optimize?strategy=${strategy}&direction=${direction}${robust ? "&robust=1" : ""}`, { cache:"no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setResults(d.results);
      setOhlcLen(d.ohlcLen);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [strategy, direction, robust]);

  const exportEA = useCallback(async (r: EaResult) => {
    setExporting(true); setExportErr(""); setEaCode("");
    try {
      const res = await fetch("/api/ai-ea/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy: r.strategy,
          params:   r.params,
          stats: {
            profitFactor: r.result.profitFactor,
            winRate:      r.result.winRate,
            maxDrawdown:  r.result.maxDrawdown,
            sharpeRatio:  r.result.sharpeRatio,
            totalTrades:  r.result.totalTrades,
          },
        }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setEaCode(d.code);
      setEaFilename(d.filename);
    } catch (e) { setExportErr(String(e)); }
    finally { setExporting(false); }
  }, []);

  const downloadEA = () => {
    if (!eaCode) return;
    const blob = new Blob([eaCode], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = eaFilename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="AI EA Optimizer 🤖"
        subtitle="AI วิเคราะห์พารามิเตอร์ EA อัตโนมัติ — backtest ข้อมูลจริง 2 ปี → เลือกค่าที่ดีสุด → Export MQL5"
      />

      {/* Step 1: Config */}
      <div className="panel p-5 mb-6">
        <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-4">ขั้นตอน 1 — เลือกกลยุทธ์และทิศทาง</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {STRATEGIES.map(([id, meta]) => (
            <button key={id} onClick={() => setStrategy(id)}
              className="rounded-xl px-3 py-2 text-xs font-bold transition-all"
              style={strategy === id
                ? { background:"rgba(168,85,247,0.18)", border:"1px solid rgba(168,85,247,0.45)", color:"#c084fc" }
                : { background:"rgba(71,85,105,0.1)", border:"1px solid rgba(71,85,105,0.2)", color:"#64748b" }}>
              {meta.icon} {meta.nameTh}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] text-silver/35 uppercase tracking-widest">ทิศทาง:</span>
          {DIRECTION_OPTS.map(o => (
            <button key={o.v} onClick={() => setDirection(o.v)}
              className="rounded-lg px-3 py-1 text-[11px] font-bold transition-all"
              style={direction === o.v
                ? { background:"rgba(245,196,81,0.12)", border:"1px solid rgba(245,196,81,0.35)", color:"#f5c451" }
                : { background:"rgba(71,85,105,0.08)", border:"1px solid rgba(71,85,105,0.15)", color:"#475569" }}>
              {o.label}
            </button>
          ))}
        </div>

        {/* Overfit filter toggle */}
        <button onClick={() => setRobust(v => !v)}
          className="mb-5 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all"
          style={robust
            ? { background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.35)" }
            : { background:"rgba(71,85,105,0.08)", border:"1px solid rgba(71,85,105,0.2)" }}>
          <div>
            <div className="text-xs font-bold" style={{ color: robust ? "#34d399" : "#94a3b8" }}>
              🛡️ กรอง Overfit (Walk-Forward validation) {robust ? "— เปิด" : "— ปิด"}
            </div>
            <div className="text-[10px] text-silver/40 mt-0.5">
              optimize บนข้อมูล 70% แล้วตรวจกับ 30% ที่ไม่เคยเห็น · จัดอันดับตามผล out-of-sample จริง
            </div>
          </div>
          <div className="ml-3 flex h-6 w-11 shrink-0 items-center rounded-full transition-all"
            style={{ background: robust ? "rgba(52,211,153,0.4)" : "rgba(71,85,105,0.4)" }}>
            <div className="h-5 w-5 rounded-full bg-white transition-transform" style={{ transform: robust ? "translateX(22px)" : "translateX(2px)" }} />
          </div>
        </button>
        <button
          onClick={runOptimize}
          disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50"
          style={{ background:"rgba(168,85,247,0.15)", border:"1px solid rgba(168,85,247,0.4)", color:"#c084fc" }}>
          {loading
            ? <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-400" />
                กำลัง optimize… {robust ? "+ ตรวจ Overfit (อาจใช้เวลา 10-30 วินาที)" : "(อาจใช้เวลา 5-15 วินาที)"}
              </span>
            : "🚀 Run Optimization"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* Step 2: Results */}
      {results.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-silver/35">
              ขั้นตอน 2 — เลือก parameter set ที่ดีที่สุด
            </div>
            <div className="text-[10px] text-silver/25">ทดสอบบน XAUUSD D1 · {ohlcLen} แท่งเทียน · เงินต้น $10,000</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <ResultCard key={r.rank} r={r}
                selected={selected === r.rank}
                onSelect={() => setSelected(r.rank)}
                onExport={() => { setSelected(r.rank); exportEA(r); }}
              />
            ))}
          </div>

          {/* Best summary */}
          {results[0] && (
            <div className="mt-4 rounded-xl p-4 text-sm"
              style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)" }}>
              <span className="text-emerald-400 font-bold">🏆 ผลที่ดีที่สุด: </span>
              <span className="text-silver/70">{results[0].label}</span>
              <span className="ml-3 text-silver/50">
                PF {results[0].result.profitFactor.toFixed(2)} ·
                WR {results[0].result.winRate.toFixed(0)}% ·
                DD {results[0].result.maxDrawdown.toFixed(1)}% ·
                ${results[0].result.totalPnl.toFixed(0)} P&L
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Export & Deploy */}
      {(exporting || eaCode) && (
        <div className="panel p-5 mb-6">
          <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-4">ขั้นตอน 3 — Export MQL5 และ Deploy ไป MT5</div>

          {exporting && (
            <div className="flex items-center gap-3 text-silver/50 text-sm">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
              AI กำลังสร้างโค้ด MQL5…
            </div>
          )}

          {exportErr && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 mb-3">{exportErr}</div>
          )}

          {eaCode && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-silver/60">📄 {eaFilename}</span>
                <button onClick={downloadEA}
                  className="rounded-lg px-4 py-1.5 text-xs font-bold transition-all"
                  style={{ background:"rgba(245,196,81,0.12)", border:"1px solid rgba(245,196,81,0.35)", color:"#f5c451" }}>
                  ⬇ Download .mq5
                </button>
                <button onClick={() => navigator.clipboard.writeText(eaCode)}
                  className="rounded-lg px-4 py-1.5 text-xs font-bold transition-all"
                  style={{ background:"rgba(71,85,105,0.1)", border:"1px solid rgba(71,85,105,0.2)", color:"#94a3b8" }}>
                  📋 Copy Code
                </button>
              </div>

              {/* Code preview */}
              <pre className="overflow-x-auto rounded-xl p-4 text-[10px] text-emerald-300/80 leading-relaxed max-h-64"
                style={{ background:"rgba(0,0,0,0.5)", border:"1px solid rgba(52,211,153,0.15)" }}>
                {eaCode.slice(0, 2000)}{eaCode.length > 2000 ? "\n\n... (truncated — download full file)" : ""}
              </pre>

              {/* Deploy instructions */}
              <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 p-4 text-xs text-silver/60 leading-relaxed">
                <div className="font-bold text-gold mb-2">📌 วิธี Deploy ไป MetaTrader 5:</div>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Download ไฟล์ <code className="text-gold">{eaFilename}</code></li>
                  <li>วางไฟล์ใน <code className="text-silver/80">MQL5/Experts/</code> ใน MT5 data folder</li>
                  <li>เปิด MetaEditor → กด F7 เพื่อ Compile</li>
                  <li>กลับ MT5 → Navigator → Experts → ลาก EA ไปวางบน chart</li>
                  <li>ตั้งค่า: Lot={selected && results[selected-1]?.params.slPoints ? "0.01" : "0.01"}, SL, TP ตามที่ optimize ไว้</li>
                  <li>เปิด AutoTrading (ปุ่มสีเขียวด้านบน) → ✅ Live!</li>
                </ol>
              </div>
            </>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl border border-base-border/10 bg-white/[0.015] p-4 text-[10px] text-silver/25 leading-relaxed">
        <b className="text-silver/40">⚠ คำเตือน:</b> ผลการ backtest เป็นข้อมูลในอดีต ไม่รับประกันผลในอนาคต
        Past performance ≠ future results · EA ที่สร้างนี้สำหรับศึกษาและทดสอบ ควร forward-test บน demo ก่อน live ·
        การลงทุนมีความเสี่ยง โปรดบริหารความเสี่ยงอย่างเหมาะสม
      </div>
    </div>
  );
}
