"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/lib/i18n";
import type { Bilingual } from "@/lib/types";
import type { EaPortfolioReport } from "@/lib/eaPortfolio";

type Report = EaPortfolioReport & { candidateCount?: number; bars?: number; error?: string };

function corrColor(v: number): string {
  // -1 (diversifying, green) → 0 (neutral) → +1 (correlated, red)
  if (v >= 0) return `rgba(248,113,113,${0.12 + v * 0.5})`;
  return `rgba(52,211,153,${0.12 + -v * 0.5})`;
}

function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(6,9,26,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[9px] uppercase tracking-widest text-silver/35">{label}</div>
      <div className="font-mono text-lg font-black" style={{ color: color ?? "rgba(175,185,215,0.9)" }}>{value}</div>
      {sub && <div className="text-[9px] text-silver/35">{sub}</div>}
    </div>
  );
}

function Sparkline({ vals, color }: { vals: number[]; color: string }) {
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const W = 600, H = 60;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function EaPortfolioPage() {
  const { lang } = useI18n();
  const L = useCallback((b: Bilingual) => b[lang], [lang]);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/ea-portfolio", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json as Report);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="💼 EA Portfolio Manager"
        subtitle={lang === "th"
          ? "รวม EA ที่ผ่าน out-of-sample จากแต่ละกลยุทธ์ → จัดสรรทุนแบบ inverse-volatility เพื่อลด Drawdown ด้วยการกระจายความเสี่ยง"
          : "Combines the OOS-valid EA from each family → inverse-volatility allocation to cut drawdown via diversification"}
        right={
          <button onClick={load} disabled={loading}
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-40"
            style={{ background: "rgba(245,196,81,0.12)", border: "1px solid rgba(245,196,81,0.3)", color: "#f5c451" }}>
            {loading ? (lang === "th" ? "⏳ กำลังสร้างพอร์ต…" : "⏳ Building…") : (lang === "th" ? "🔄 สร้างใหม่" : "🔄 Rebuild")}
          </button>
        }
      />

      {err && <div className="panel mb-5 px-5 py-4 text-sm" style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}>{err}</div>}

      {loading && !data && (
        <div className="panel flex items-center gap-3 px-5 py-8 text-sm text-silver/50">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          {lang === "th" ? "กำลังคัด EA robust + จัดสรรพอร์ต… (อาจใช้เวลา 15-30 วินาที)" : "Selecting robust EAs + allocating… (15-30s)"}
        </div>
      )}

      {data && data.strategies.length < 2 && (
        <div className="panel px-5 py-8 text-center text-sm text-silver/50">
          {data.reasons[0] ? L(data.reasons[0]) : (lang === "th" ? "ยังสร้างพอร์ตไม่ได้" : "Cannot build a portfolio yet")}
        </div>
      )}

      {data && data.strategies.length >= 2 && (
        <>
          {/* Portfolio vs best single */}
          <div className="mb-5 rounded-2xl p-5" style={{ border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.06)" }}>
            <div className="mb-3 text-[10px] uppercase tracking-widest text-silver/40">
              {lang === "th" ? `พอร์ต ${data.strategies.length} EA · ${data.bars} แท่งเทียน` : `Portfolio of ${data.strategies.length} EAs · ${data.bars} bars`}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={lang === "th" ? "ผลตอบแทน" : "Return"} value={`${data.portfolio.returnPct}%`} color={data.portfolio.returnPct >= 0 ? "#34d399" : "#f87171"} />
              <Stat label="Max DD" value={`${data.portfolio.maxDD}%`} color="#f5c451"
                sub={lang === "th" ? `เดี่ยวดีสุด ${data.bestSingle.maxDD}%` : `best single ${data.bestSingle.maxDD}%`} />
              <Stat label="Sharpe" value={`${data.portfolio.sharpe}`} color="#34d399" />
              <Stat label={lang === "th" ? "Correlation เฉลี่ย" : "Avg Corr"} value={`${data.avgCorrelation}`}
                color={data.avgCorrelation < 0.3 ? "#34d399" : data.avgCorrelation > 0.6 ? "#f87171" : "#f5c451"} />
            </div>

            {/* diversification benefit */}
            <div className="mt-3 rounded-xl px-3 py-2" style={{ background: "rgba(6,9,26,0.5)", border: "1px solid rgba(52,211,153,0.15)" }}>
              <div className="text-xs font-bold" style={{ color: data.diversification.ddReductionPct > 0 ? "#34d399" : "#f5c451" }}>
                {data.diversification.ddReductionPct > 0
                  ? (lang === "th"
                      ? `🛡️ การกระจายลด Drawdown ได้ ${data.diversification.ddReductionPct}% เทียบกับ EA เดี่ยวที่ดีที่สุด`
                      : `🛡️ Diversification cut drawdown by ${data.diversification.ddReductionPct}% vs the best single EA`)
                  : (lang === "th" ? "การกระจายยังไม่ลด drawdown ชัดเจน" : "Diversification didn't materially cut drawdown")}
              </div>
              <ul className="mt-1 space-y-0.5">
                {data.reasons.map((r, i) => (
                  <li key={i} className="text-[11px] text-silver/50">• {L(r)}</li>
                ))}
              </ul>
            </div>

            <Sparkline vals={data.portfolio.equity} color="#34d399" />
          </div>

          {/* Allocation table */}
          <div className="mb-5 overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-silver/40" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <th className="px-3 py-2 text-left font-semibold">EA</th>
                  <th className="px-3 py-2 text-right font-semibold">{lang === "th" ? "น้ำหนัก" : "Weight"}</th>
                  <th className="px-3 py-2 text-right font-semibold">Return</th>
                  <th className="px-3 py-2 text-right font-semibold">Vol</th>
                  <th className="px-3 py-2 text-right font-semibold">Max DD</th>
                  <th className="px-3 py-2 text-right font-semibold">Sharpe</th>
                </tr>
              </thead>
              <tbody>
                {data.strategies.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <td className="px-3 py-2 text-silver/70">{s.name}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-block rounded-md px-2 py-0.5 font-mono font-bold" style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}>
                        {(s.weight * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: s.returnPct >= 0 ? "#34d399" : "#f87171" }}>{s.returnPct}%</td>
                    <td className="px-3 py-2 text-right font-mono text-silver/60">{s.volPct}%</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: "#f5c451" }}>{s.maxDD}%</td>
                    <td className="px-3 py-2 text-right font-mono text-silver/70">{s.sharpe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Correlation heatmap */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(6,9,26,0.5)" }}>
            <div className="mb-3 text-sm font-bold text-silver/80">
              {lang === "th" ? "🔗 Correlation Matrix (รายเดือน)" : "🔗 Correlation Matrix (monthly)"}
            </div>
            <div className="overflow-x-auto">
              <table className="text-[10px]">
                <tbody>
                  <tr>
                    <td className="px-2 py-1" />
                    {data.strategies.map((s, j) => (
                      <td key={j} className="px-2 py-1 text-center font-mono text-silver/40" title={s.name}>E{j + 1}</td>
                    ))}
                  </tr>
                  {data.correlation.map((row, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 font-mono text-silver/40" title={data.strategies[i].name}>E{i + 1}</td>
                      {row.map((v, j) => (
                        <td key={j} className="px-2 py-1 text-center font-mono font-bold" style={{ background: corrColor(v), color: "rgba(230,235,245,0.9)" }}>
                          {v.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[10px] text-silver/35">
              {lang === "th" ? "เขียว = สัมพันธ์ต่ำ/ลบ (กระจายดี) · แดง = สัมพันธ์สูง (กระจายได้น้อย)" : "green = low/negative corr (good) · red = high corr (poor diversification)"}
            </div>
            <div className="mt-2 space-y-0.5">
              {data.strategies.map((s, i) => (
                <div key={s.id} className="text-[10px] text-silver/40"><span className="font-mono text-silver/60">E{i + 1}</span> = {s.name}</div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl px-4 py-3 text-[10px]" style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.12)", color: "rgba(175,185,215,0.4)" }}>
            ⚠️ {lang === "th"
              ? "การจัดสรรอิงผลตอบแทนรายเดือนจาก backtest ในอดีต ไม่ใช่การรับประกันผลอนาคต · ไม่รวม spread/commission จริง"
              : "Allocation is from historical monthly backtest returns, not a future guarantee · excludes real spread/commission"}
          </div>
        </>
      )}
    </div>
  );
}
