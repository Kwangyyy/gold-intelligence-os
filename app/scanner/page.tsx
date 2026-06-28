"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanResult, SignalDir, TfScan } from "@/lib/scanner";
import { INDICATOR_META } from "@/lib/scanner";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { useI18n } from "@/lib/i18n";

const POLL_MS = 120_000; // 2-min auto-refresh

// ── Signal colour helpers ────────────────────────────────────────────────────

const SIG_BG: Record<SignalDir, string> = {
  buy:     "rgba(16,185,129,0.18)",
  sell:    "rgba(239,68,68,0.18)",
  neutral: "rgba(71,85,105,0.18)",
};
const SIG_BORDER: Record<SignalDir, string> = {
  buy:     "rgba(52,211,153,0.45)",
  sell:    "rgba(248,113,113,0.45)",
  neutral: "rgba(100,116,139,0.25)",
};
const SIG_TEXT: Record<SignalDir, string> = {
  buy:     "#34d399",
  sell:    "#f87171",
  neutral: "#64748b",
};
const SIG_LABEL: Record<SignalDir, string> = {
  buy: "BUY", sell: "SELL", neutral: "—",
};

// ── Sub-components ───────────────────────────────────────────────────────────

function SignalPill({ signal, value, compact = false }: {
  signal: SignalDir; value: string; compact?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition-all"
      style={{ background: SIG_BG[signal], border: `1px solid ${SIG_BORDER[signal]}` }}
    >
      <span className="text-[10px] font-bold leading-none" style={{ color: SIG_TEXT[signal] }}>
        {SIG_LABEL[signal]}
      </span>
      {!compact && (
        <span className="mt-0.5 text-[9px] leading-none" style={{ color: SIG_TEXT[signal], opacity: 0.65 }}>
          {value}
        </span>
      )}
    </div>
  );
}

function ScoreBar({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const bias: SignalDir = score > 55 ? "buy" : score < 45 ? "sell" : "neutral";
  const pct  = score; // 0-100
  const col  = SIG_TEXT[bias];
  const h    = size === "sm" ? 3 : 5;
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height: h, background: "rgba(71,85,105,0.2)" }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: col }} />
    </div>
  );
}

function TfSummaryCard({ scan }: { scan: TfScan }) {
  const bias  = scan.bias;
  const col   = SIG_TEXT[bias];
  const label = bias === "buy" ? "BULLISH" : bias === "sell" ? "BEARISH" : "NEUTRAL";
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ background: SIG_BG[bias], border: `1px solid ${SIG_BORDER[bias]}` }}
    >
      <div className="text-xs font-bold text-silver/60 mb-1">{scan.tf}</div>
      <div className="text-sm font-extrabold mb-1.5" style={{ color: col }}>{label}</div>
      <ScoreBar score={scan.score} />
      <div className="mt-1.5 flex justify-center gap-2 text-[10px]">
        <span style={{ color: SIG_TEXT.buy }}>↑{scan.bullCount}</span>
        <span style={{ color: SIG_TEXT.neutral }}>—{scan.neutCount}</span>
        <span style={{ color: SIG_TEXT.sell }}>↓{scan.bearCount}</span>
      </div>
    </div>
  );
}

function OverallGauge({ score, bias }: { score: number; bias: SignalDir }) {
  const col   = SIG_TEXT[bias];
  const label = bias === "buy" ? "BULLISH" : bias === "sell" ? "BEARISH" : "NEUTRAL";
  // SVG arc gauge
  const r = 42; const cx = 54; const cy = 54;
  const start = Math.PI * 0.75;
  const end   = Math.PI * 2.25;
  const pct   = score / 100;
  const angle = start + (end - start) * pct;
  const arcX  = (a: number) => cx + r * Math.cos(a);
  const arcY  = (a: number) => cy + r * Math.sin(a);
  const largeArc = angle - start > Math.PI ? 1 : 0;
  return (
    <div className="flex flex-col items-center">
      <svg width={108} height={72} viewBox="0 0 108 72">
        {/* Track */}
        <path d={`M ${arcX(start)} ${arcY(start)} A ${r} ${r} 0 1 1 ${arcX(end)} ${arcY(end)}`}
          fill="none" stroke="rgba(71,85,105,0.25)" strokeWidth={7} strokeLinecap="round" />
        {/* Fill */}
        {score > 0 && (
          <path d={`M ${arcX(start)} ${arcY(start)} A ${r} ${r} 0 ${largeArc} 1 ${arcX(angle)} ${arcY(angle)}`}
            fill="none" stroke={col} strokeWidth={7} strokeLinecap="round" />
        )}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={18} fontWeight="800"
          fill={col} fontFamily="ui-monospace,monospace">{score}</text>
      </svg>
      <span className="text-sm font-extrabold -mt-1" style={{ color: col }}>{label}</span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const { lang } = useI18n();
  const [data, setData]       = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [auto, setAuto]       = useState(true);
  const [lastAt, setLastAt]   = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/scanner", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "failed");
      setData(json as ScanResult);
      setLastAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (auto) timer.current = setInterval(() => fetch_(true), POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [auto, fetch_]);

  const l = lang as "th" | "en";

  // Group indicators by category for visual separation
  const categories = Array.from(new Set(INDICATOR_META.map(m => m.category)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={l === "th" ? "Signal Scanner" : "Signal Scanner"}
        subtitle={l === "th"
          ? "สแกน 12 indicators × 6 Timeframes แบบ real-time"
          : "12 indicators × 6 timeframes — live heatmap"}
      />

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {data && (
          <div className="flex items-center gap-2 text-xs text-silver/45">
            <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            {lastAt && `อัปเดต ${lastAt.toLocaleTimeString("th-TH")} · cache 3 นาที`}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAuto(v => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
              ${auto ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-base-border text-silver/50"}`}
          >
            {auto ? "🔄 Auto ON" : "🔄 Auto OFF"}
          </button>
          <button
            onClick={() => fetch_()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/5 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-40"
          >
            {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />}
            {loading ? "กำลังสแกน…" : "🔍 สแกนใหม่"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-400">
          ⚠ {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-4 animate-pulse">
          <div className="panel h-28 bg-base-panel/60" />
          <div className="panel h-96 bg-base-panel/40" />
        </div>
      )}

      {data && (
        <div className={`space-y-5 transition-opacity duration-300 ${loading ? "opacity-60" : "opacity-100"}`}>

          {/* ── Overall + Price ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 sm:p-5"
            style={{
              background: "linear-gradient(135deg, rgba(12,8,26,0.95) 0%, rgba(7,9,22,0.95) 100%)",
              border: "1px solid rgba(168,85,247,0.22)",
              boxShadow: "0 0 0 1px rgba(245,196,81,0.05) inset",
            }}
          >
            <div className="flex flex-wrap items-center gap-6">
              <OverallGauge score={data.overallScore} bias={data.overallBias} />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-widest text-silver/40 mb-1">XAUUSD Overall Signal</div>
                <div className="text-3xl font-black font-mono mb-1" style={{ color: "#f5c451" }}>
                  {data.price > 0 ? `$${data.price.toFixed(2)}` : "—"}
                </div>
                <div className="flex gap-4 text-xs text-silver/50">
                  <span>📊 12 indicators</span>
                  <span>⏱ 6 timeframes</span>
                  <span>🔢 72 signals</span>
                </div>
              </div>
              {/* Mini TF bias row */}
              <div className="flex gap-1.5 flex-wrap">
                {data.tfs.map(t => (
                  <div key={t.tf} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-silver/40">{t.tf}</span>
                    <div
                      className="h-6 w-11 rounded flex items-center justify-center text-[10px] font-bold"
                      style={{ background: SIG_BG[t.bias], border: `1px solid ${SIG_BORDER[t.bias]}`, color: SIG_TEXT[t.bias] }}
                    >
                      {t.bias === "buy" ? "↑" : t.bias === "sell" ? "↓" : "—"}
                    </div>
                    <span className="text-[9px] font-mono text-silver/35">{t.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Heatmap Matrix ───────────────────────────────────────────────── */}
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              border: "1px solid rgba(168,85,247,0.18)",
              background: "linear-gradient(160deg, #0d0a1c 0%, #07091b 100%)",
            }}
          >
            {/* Header row */}
            <div className="grid text-[11px] font-bold text-silver/50 px-4 py-2.5 border-b border-base-border/30"
              style={{ gridTemplateColumns: "160px repeat(6, 1fr) 88px" }}>
              <span>INDICATOR</span>
              {data.tfs.map(t => (
                <span key={t.tf} className="text-center" style={{ color: SIG_TEXT[t.bias] }}>{t.tf}</span>
              ))}
              <span className="text-center text-silver/35">SUMMARY</span>
            </div>

            {/* Rows grouped by category */}
            {categories.map((cat, ci) => {
              const inds = INDICATOR_META.filter(m => m.category === cat);
              return (
                <div key={cat}>
                  {/* Category separator */}
                  <div className="px-4 py-1 text-[9px] uppercase tracking-widest"
                    style={{ color: "rgba(168,85,247,0.5)", background: "rgba(168,85,247,0.05)", borderTop: ci > 0 ? "1px solid rgba(168,85,247,0.08)" : undefined }}>
                    {cat}
                  </div>

                  {inds.map(ind => {
                    // Count bulls/bears across TFs for this indicator
                    const cells = data.tfs.map(t => t.signals.find(s => s.key === ind.key));
                    const bullC = cells.filter(c => c?.signal === "buy").length;
                    const bearC = cells.filter(c => c?.signal === "sell").length;
                    const summBias: SignalDir = bullC > bearC ? "buy" : bearC > bullC ? "sell" : "neutral";

                    return (
                      <div
                        key={ind.key}
                        className="grid items-center gap-1.5 px-4 py-1.5 transition-colors hover:bg-white/[0.015]"
                        style={{ gridTemplateColumns: "160px repeat(6, 1fr) 88px", borderTop: "1px solid rgba(71,85,105,0.1)" }}
                      >
                        {/* Indicator name */}
                        <span className="text-xs font-medium text-silver/70 truncate pr-2">{ind.name}</span>

                        {/* Signal cells per TF */}
                        {data.tfs.map(t => {
                          const sig = t.signals.find(s => s.key === ind.key);
                          if (!sig || !t.available) {
                            return (
                              <div key={t.tf} className="flex items-center justify-center rounded-lg px-1 py-1.5"
                                style={{ background: "rgba(71,85,105,0.08)", border: "1px solid rgba(71,85,105,0.12)" }}>
                                <span className="text-[10px] text-silver/20">—</span>
                              </div>
                            );
                          }
                          return <SignalPill key={t.tf} signal={sig.signal} value={sig.value} />;
                        })}

                        {/* Summary */}
                        <div
                          className="flex items-center justify-center rounded-lg px-2 py-1"
                          style={{ background: SIG_BG[summBias], border: `1px solid ${SIG_BORDER[summBias]}` }}
                        >
                          <span className="text-[10px] font-bold" style={{ color: SIG_TEXT[summBias] }}>
                            {bullC > 0 && <span style={{ color: SIG_TEXT.buy }}>↑{bullC} </span>}
                            {bearC > 0 && <span style={{ color: SIG_TEXT.sell }}>↓{bearC}</span>}
                            {bullC === 0 && bearC === 0 && <span style={{ color: SIG_TEXT.neutral }}>—</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Score row */}
            <div
              className="grid items-center gap-1.5 px-4 py-3 mt-1"
              style={{
                gridTemplateColumns: "160px repeat(6, 1fr) 88px",
                borderTop: "1px solid rgba(245,196,81,0.15)",
                background: "rgba(245,196,81,0.03)",
              }}
            >
              <span className="text-[11px] font-bold text-gold/70">SCORE</span>
              {data.tfs.map(t => (
                <div key={t.tf} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-black" style={{ color: SIG_TEXT[t.bias] }}>
                    {t.score}
                  </span>
                  <ScoreBar score={t.score} size="sm" />
                </div>
              ))}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-black" style={{ color: SIG_TEXT[data.overallBias] }}>
                  {data.overallScore}
                </span>
                <ScoreBar score={data.overallScore} size="sm" />
              </div>
            </div>
          </div>

          {/* ── TF Summary Cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {data.tfs.map(t => <TfSummaryCard key={t.tf} scan={t} />)}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-base-border/30 bg-base-panel/30 px-4 py-3">
            <span className="text-[10px] text-silver/40 font-semibold">สัญลักษณ์:</span>
            {(["buy", "neutral", "sell"] as SignalDir[]).map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="h-4 w-8 rounded flex items-center justify-center text-[9px] font-bold"
                  style={{ background: SIG_BG[s], border: `1px solid ${SIG_BORDER[s]}`, color: SIG_TEXT[s] }}>
                  {SIG_LABEL[s]}
                </span>
                <span className="text-[10px] text-silver/40">
                  {s === "buy" ? "สัญญาณซื้อ" : s === "sell" ? "สัญญาณขาย" : "เป็นกลาง"}
                </span>
              </div>
            ))}
            <span className="ml-auto text-[10px] text-silver/30">Score 0-100 · &gt;55 = bullish · &lt;45 = bearish</span>
          </div>

          <Disclaimer />
        </div>
      )}
    </div>
  );
}
