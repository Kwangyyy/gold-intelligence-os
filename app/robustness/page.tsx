"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/lib/i18n";
import type { Bilingual } from "@/lib/types";
import type { RobustnessReport, Verdict } from "@/lib/robustness";

const STRATEGIES: { id: string; label: string; icon: string }[] = [
  { id: "ema_cross", label: "EMA Cross", icon: "📈" },
  { id: "triple_ema", label: "Triple EMA", icon: "📊" },
  { id: "rsi", label: "RSI", icon: "🔄" },
  { id: "macd", label: "MACD", icon: "⚡" },
  { id: "bb_bounce", label: "Bollinger", icon: "🎯" },
  { id: "macd_rsi", label: "MACD+RSI", icon: "🔬" },
  { id: "ema_rsi", label: "EMA+RSI", icon: "🧠" },
];

const VERDICT: Record<Verdict, { color: string; th: string; en: string; icon: string }> = {
  robust: { color: "#34d399", th: "ทนทาน (ใช้ได้)", en: "ROBUST", icon: "✓" },
  fragile: { color: "#f5c451", th: "เปราะ (ระวัง)", en: "FRAGILE", icon: "⚠" },
  overfit: { color: "#f87171", th: "โอเวอร์ฟิต (อย่าใช้)", en: "OVERFIT", icon: "✕" },
  no_edge: { color: "#94a3b8", th: "ไม่มีเอดจ์", en: "NO EDGE", icon: "—" },
};

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="px-3 py-2" style={{ background: "rgba(6,9,26,0.6)" }}>
      <div className="text-[9px] uppercase tracking-widest text-silver/35">{label}</div>
      <div className="font-mono text-sm font-bold" style={{ color: color ?? "rgba(175,185,215,0.9)" }}>{value}</div>
    </div>
  );
}

export default function RobustnessPage() {
  const { lang } = useI18n();
  const L = useCallback((b: Bilingual) => b[lang], [lang]);

  const [strategy, setStrategy] = useState("ema_cross");
  const [data, setData] = useState<RobustnessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const run = useCallback(async (s: string) => {
    setLoading(true);
    setErr("");
    setData(null);
    try {
      const res = await fetch(`/api/backtest/robustness?strategy=${s}&interval=1d`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json as RobustnessReport);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const v = data ? VERDICT[data.verdict] : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="🛡️ Robustness — ตรวจ Overfitting"
        subtitle={
          lang === "th"
            ? "Walk-Forward + Monte Carlo · แยกกลยุทธ์ที่ 'มีเอดจ์จริง' ออกจาก 'ฟิตกับอดีต' (XAUUSD รายวัน 2 ปี)"
            : "Walk-Forward + Monte Carlo · separates a real edge from a curve fit (XAUUSD daily, 2y)"
        }
      />

      {/* Strategy picker */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            onClick={() => { setStrategy(s.id); run(s.id); }}
            disabled={loading}
            className="rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-40"
            style={
              strategy === s.id
                ? { background: "rgba(245,196,81,0.16)", border: "1px solid rgba(245,196,81,0.45)", color: "#f5c451" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(175,185,215,0.7)" }
            }
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="panel mb-5 px-5 py-4 text-sm" style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}>{err}</div>
      )}

      {loading && (
        <div className="panel flex items-center gap-3 px-5 py-8 text-sm text-silver/50">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          {lang === "th" ? "กำลังรัน Walk-Forward + Monte Carlo… (re-optimize 4 รอบ + จำลอง 1000 ครั้ง)" : "Running Walk-Forward + Monte Carlo… (4 re-optimisations + 1000 sims)"}
        </div>
      )}

      {data && v && (
        <>
          {/* Verdict hero */}
          <div className="mb-5 rounded-2xl p-5" style={{ border: `1px solid ${v.color}40`, background: `${v.color}0c` }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black" style={{ background: `${v.color}1a`, border: `2px solid ${v.color}55`, color: v.color }}>
                  {v.icon}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-silver/40">{data.strategyName} · {data.bars} bars</div>
                  <div className="text-2xl font-black" style={{ color: v.color }}>{lang === "th" ? v.th : v.en}</div>
                </div>
              </div>
            </div>
            <ul className="mt-3 space-y-1">
              {data.verdictReasons.map((r, i) => (
                <li key={i} className="flex gap-1.5 text-[11px] text-silver/60">
                  <span style={{ color: v.color }} className="mt-0.5 shrink-0">•</span><span>{L(r)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* In-sample vs Out-of-sample */}
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(6,9,26,0.5)" }}>
              <div className="mb-2 text-[10px] uppercase tracking-widest text-silver/40">
                {lang === "th" ? "ผลในอดีต (In-Sample) — น่าดึงดูดแต่ยังเชื่อไม่ได้" : "In-Sample — looks good, don't trust yet"}
              </div>
              <div className="mb-1 text-xs text-silver/50">{data.baseline.paramsLabel}</div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <Metric label="Return" value={`${data.baseline.returnPct}%`} color={data.baseline.returnPct >= 0 ? "#34d399" : "#f87171"} />
                <Metric label="PF" value={`${data.baseline.profitFactor}`} />
                <Metric label="Max DD" value={`${data.baseline.maxDD}%`} color="#f87171" />
                <Metric label="Sharpe" value={`${data.baseline.sharpe}`} />
                <Metric label="Win%" value={`${data.baseline.winRate}%`} />
                <Metric label="Trades" value={`${data.baseline.trades}`} />
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ border: `1px solid ${data.walkForward.pass ? "#34d39940" : "#f8717140"}`, background: "rgba(6,9,26,0.5)" }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-silver/40">
                  {lang === "th" ? "Walk-Forward (Out-of-Sample) — ตัวจริง" : "Walk-Forward (Out-of-Sample) — the real test"}
                </div>
                <span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ background: data.walkForward.pass ? "#34d39918" : "#f8717118", border: `1px solid ${data.walkForward.pass ? "#34d39945" : "#f8717145"}`, color: data.walkForward.pass ? "#34d399" : "#f87171" }}>
                  {data.walkForward.pass ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <Metric label={`WFE (≥${data.walkForward.wfeTarget}%)`} value={`${data.walkForward.wfe}%`} color={data.walkForward.wfe >= data.walkForward.wfeTarget ? "#34d399" : "#f87171"} />
                <Metric label="OOS Return" value={`${data.walkForward.oosReturnPct}%`} color={data.walkForward.oosReturnPct >= 0 ? "#34d399" : "#f87171"} />
                <Metric label="OOS PF" value={`${data.walkForward.oosProfitFactor}`} />
                <Metric label="OOS Max DD" value={`${data.walkForward.oosMaxDD}%`} color="#f87171" />
                <Metric label="Folds +" value={`${data.walkForward.foldsPositive}/${data.walkForward.folds.length}`} />
                <Metric label="OOS Trades" value={`${data.walkForward.oosTrades}`} />
              </div>
            </div>
          </div>

          {/* Fold table */}
          {data.walkForward.folds.length > 0 && (
            <div className="mb-5 overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-silver/40" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <th className="px-3 py-2 text-left font-semibold">{lang === "th" ? "รอบ" : "Fold"}</th>
                    <th className="px-3 py-2 text-left font-semibold">{lang === "th" ? "พารามิเตอร์ (จาก train)" : "Params (from train)"}</th>
                    <th className="px-3 py-2 text-right font-semibold">IS %</th>
                    <th className="px-3 py-2 text-right font-semibold">OOS %</th>
                    <th className="px-3 py-2 text-right font-semibold">OOS PF</th>
                    <th className="px-3 py-2 text-right font-semibold">WFE</th>
                  </tr>
                </thead>
                <tbody>
                  {data.walkForward.folds.map((f) => (
                    <tr key={f.fold} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <td className="px-3 py-2 text-silver/60">#{f.fold}</td>
                      <td className="px-3 py-2 font-mono text-silver/70">{f.paramsLabel}</td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: f.isReturnPct >= 0 ? "#34d399" : "#f87171" }}>{f.isReturnPct}%</td>
                      <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: f.oosReturnPct >= 0 ? "#34d399" : "#f87171" }}>{f.oosReturnPct}%</td>
                      <td className="px-3 py-2 text-right font-mono text-silver/70">{f.oosProfitFactor}</td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: f.wfe >= data.walkForward.wfeTarget ? "#34d399" : "#f5c451" }}>{f.wfe}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Monte Carlo */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(96,165,250,0.25)", background: "rgba(6,9,26,0.5)" }}>
            <div className="mb-1 text-sm font-bold" style={{ color: "#93c5fd" }}>
              🎲 Monte Carlo · {data.monteCarlo.simulations.toLocaleString()} {lang === "th" ? "รอบ" : "sims"}
            </div>
            <div className="mb-3 text-[10px] text-silver/35">
              {lang === "th"
                ? "สุ่มสลับลำดับ/สุ่มซ้ำเทรด เพื่อดูการกระจายผลและ Drawdown แย่สุดที่เป็นไปได้ (ความเชื่อมั่น 95%)"
                : "Bootstraps the trade sequence to show the outcome distribution and worst-case drawdown (95% confidence)"}
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-4" style={{ background: "rgba(255,255,255,0.05)" }}>
              <Metric label="Return P5" value={`${data.monteCarlo.returnPctP5}%`} color={data.monteCarlo.returnPctP5 >= 0 ? "#34d399" : "#f87171"} />
              <Metric label="Return P50" value={`${data.monteCarlo.returnPctP50}%`} />
              <Metric label="Return P95" value={`${data.monteCarlo.returnPctP95}%`} color="#34d399" />
              <Metric label="Prob Profit" value={`${(data.monteCarlo.probProfit * 100).toFixed(0)}%`} color={data.monteCarlo.probProfit >= 0.65 ? "#34d399" : "#f5c451"} />
              <Metric label="Max DD P50" value={`${data.monteCarlo.maxDDP50}%`} color="#f5c451" />
              <Metric label="Max DD P95" value={`${data.monteCarlo.maxDDP95}%`} color="#f87171" />
              <Metric label="P(DD>20%)" value={`${(data.monteCarlo.probDDover20 * 100).toFixed(0)}%`} color="#fb923c" />
              <Metric label="Trades" value={`${data.monteCarlo.tradesPerSim}`} />
            </div>
          </div>

          {/* Multiple-testing / Deflated Sharpe */}
          {data.multipleTesting && (
            <div className="mt-4 rounded-2xl p-4" style={{ border: `1px solid ${data.multipleTesting.pass ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, background: "rgba(6,9,26,0.5)" }}>
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-bold" style={{ color: "#c084fc" }}>🎯 {lang === "th" ? "แก้ Multiple-Testing (Deflated Sharpe)" : "Multiple-Testing (Deflated Sharpe)"}</div>
                <span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ background: data.multipleTesting.pass ? "#34d39918" : "#f8717118", border: `1px solid ${data.multipleTesting.pass ? "#34d39945" : "#f8717145"}`, color: data.multipleTesting.pass ? "#34d399" : "#f87171" }}>
                  {data.multipleTesting.pass ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="mb-3 text-[10px] text-silver/35">
                {lang === "th"
                  ? `ทดสอบ ${data.multipleTesting.trials} ชุดค่าแล้วเก็บตัวที่ดีสุด → Sharpe สูงเพราะฟลุ๊คได้ ถ้าไม่ชนะค่าที่คาดจากการสุ่ม แปลว่าเอดจ์อาจไม่จริง`
                  : `Keeping the best of ${data.multipleTesting.trials} trials inflates Sharpe. If it doesn't beat what luck would produce, the edge may be a curve fit`}
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-4" style={{ background: "rgba(255,255,255,0.05)" }}>
                <Metric label={lang === "th" ? "ชุดที่ทดสอบ" : "Trials"} value={`${data.multipleTesting.trials}`} />
                <Metric label={lang === "th" ? "Sharpe จริง" : "Observed SR"} value={`${data.multipleTesting.observedSharpe}`} color="#93c5fd" />
                <Metric label={lang === "th" ? "คาดจากฟลุ๊ค" : "Expected (luck)"} value={`${data.multipleTesting.expectedMaxSharpe}`} color="#f5c451" />
                <Metric label={lang === "th" ? "ความเชื่อมั่น" : "Deflated Prob"} value={`${(data.multipleTesting.deflatedProb * 100).toFixed(0)}%`} color={data.multipleTesting.pass ? "#34d399" : "#f87171"} />
              </div>
            </div>
          )}

          <div className="mt-6 rounded-xl px-4 py-3 text-[10px]" style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.12)", color: "rgba(175,185,215,0.4)" }}>
            ⚠️ {lang === "th"
              ? "เครื่องมือนี้ช่วยคัดกลยุทธ์ที่ฟิตกับอดีตออกไป ไม่ใช่การรับประกันผลอนาคต · backtest บนข้อมูล Yahoo รวมต้นทุน spread/commission โดยประมาณแล้ว"
              : "This filters out curve-fit strategies; it does not guarantee future results · backtest on Yahoo data, now includes estimated spread/commission costs"}
          </div>
        </>
      )}

      {!data && !loading && !err && (
        <div className="panel flex flex-col items-center gap-2 py-16 text-center">
          <div className="text-4xl opacity-30">🛡️</div>
          <div className="text-sm text-silver/50">{lang === "th" ? "เลือกกลยุทธ์ด้านบนเพื่อเริ่มตรวจ overfitting" : "Pick a strategy above to run the overfitting check"}</div>
        </div>
      )}
    </div>
  );
}
