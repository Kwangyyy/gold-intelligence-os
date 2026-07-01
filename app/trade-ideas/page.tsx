"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { TradeIdea } from "@/lib/gemini";

interface TradeMeta {
  price: number;
  technicalBias: string;
  technicalScore: number;
  aiSignal?: string;
  aiConfidence?: number;
  newsSentiment?: string;
  newsScore?: number;
  generatedAt: string;
}

interface ApiResponse {
  ideas: TradeIdea[];
  meta: TradeMeta;
  cached: boolean;
  error?: string;
}

const DIR_COLOR = { BUY: "#34d399", SELL: "#f87171" } as const;
const CONF_COLOR = { high: "#34d399", medium: "#f5c451", low: "#94a3b8" } as const;
const CONF_TH = { high: "สูง", medium: "ปานกลาง", low: "ต่ำ" } as const;

function SignalPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl px-3 py-2 text-center"
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(175,185,215,0.4)" }}>{label}</div>
      <div className="text-xs font-black" style={{ color }}>{value}</div>
    </div>
  );
}

function RRBar({ rr, color }: { rr: number; color: string }) {
  const pct = Math.min(100, (rr / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono font-bold w-10 text-right" style={{ color }}>1:{rr.toFixed(2)}</span>
    </div>
  );
}

function IdeaCard({ idea, index }: { idea: TradeIdea; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const dirColor = DIR_COLOR[idea.direction];
  const confColor = CONF_COLOR[idea.confidence];

  const risk = Math.abs(idea.entry - idea.sl);
  const tp1Pct = ((Math.abs(idea.tp1 - idea.entry) / idea.entry) * 100).toFixed(2);
  const tp2Pct = ((Math.abs(idea.tp2 - idea.entry) / idea.entry) * 100).toFixed(2);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${dirColor}30`, background: "rgba(6,9,26,0.6)", boxShadow: `0 0 40px ${dirColor}08` }}>

      {/* Header */}
      <div className="px-5 py-4" style={{ background: `${dirColor}08`, borderBottom: `1px solid ${dirColor}20` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black shrink-0"
              style={{ background: `${dirColor}20`, border: `2px solid ${dirColor}50`, color: dirColor }}>
              {idea.direction === "BUY" ? "▲" : "▼"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-black" style={{ color: dirColor }}>{idea.direction}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: `${confColor}18`, border: `1px solid ${confColor}40`, color: confColor }}>
                  {CONF_TH[idea.confidence]} · {idea.confidenceScore}%
                </span>
                <span className="text-[10px] rounded-full px-2 py-0.5"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(175,185,215,0.5)" }}>
                  {idea.timeframe}
                </span>
              </div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: "rgba(175,185,215,0.85)" }}>
                {idea.setup}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "rgba(175,185,215,0.45)" }}>
                {idea.setupTh}
              </div>
            </div>
          </div>
          <span className="text-[11px] shrink-0 font-mono" style={{ color: "rgba(175,185,215,0.3)" }}>#{index + 1}</span>
        </div>
      </div>

      {/* Price levels */}
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: "rgba(255,255,255,0.04)" }}>
        {[
          { label: "Entry",  value: idea.entry, color: "rgba(175,185,215,0.9)" },
          { label: "SL",     value: idea.sl,    color: "#f87171" },
          { label: `TP1 (+${tp1Pct}%)`, value: idea.tp1, color: "#34d399" },
          { label: `TP2 (+${tp2Pct}%)`, value: idea.tp2, color: "#6ee7b7" },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-3" style={{ background: "rgba(6,9,26,0.6)" }}>
            <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.35)" }}>{label}</div>
            <div className="font-mono text-sm font-bold" style={{ color }}>
              ${value.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* R:R */}
      <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>Risk / Reward</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] w-8" style={{ color: "rgba(175,185,215,0.4)" }}>TP1</span>
            <RRBar rr={idea.rr1} color="#34d399" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] w-8" style={{ color: "rgba(175,185,215,0.4)" }}>TP2</span>
            <RRBar rr={idea.rr2} color="#6ee7b7" />
          </div>
        </div>
        <div className="mt-2 text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          Risk = ${risk.toFixed(2)} per unit (1.0 SL)
        </div>
      </div>

      {/* Signal sources */}
      {idea.sources && (
        <div className="px-5 py-3 flex flex-wrap gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {idea.sources.technical && (
            <SignalPill label="Technical" value={idea.sources.technical.toUpperCase()} color="#60a5fa" />
          )}
          {idea.sources.aiModel && (
            <SignalPill label="AI Model" value={idea.sources.aiModel} color="#c084fc" />
          )}
          {idea.sources.news && (
            <SignalPill label="News" value={idea.sources.news.toUpperCase()} color="#f5c451" />
          )}
        </div>
      )}

      {/* Rationale */}
      <div className="px-5 py-3">
        <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>เหตุผล</div>
        <ul className="space-y-1.5">
          {idea.rationale.map((r, i) => (
            <li key={i} className="flex gap-2 text-xs" style={{ color: "rgba(175,185,215,0.75)" }}>
              <span style={{ color: dirColor }} className="mt-0.5 shrink-0">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>

        {/* Expandable: EN rationale */}
        <button onClick={() => setExpanded(v => !v)}
          className="mt-2.5 text-[10px] transition-colors"
          style={{ color: "rgba(175,185,215,0.3)" }}>
          {expanded ? "▲ ซ่อน EN" : "▼ ดู English rationale"}
        </button>

        {expanded && (
          <ul className="mt-2 space-y-1">
            {idea.rationaleEn.map((r, i) => (
              <li key={i} className="flex gap-2 text-[11px]" style={{ color: "rgba(175,185,215,0.45)" }}>
                <span style={{ color: dirColor }}>•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invalidation */}
      <div className="rounded-b-2xl px-5 py-3" style={{ background: "rgba(248,113,113,0.05)", borderTop: "1px solid rgba(248,113,113,0.12)" }}>
        <span className="text-[9px] uppercase tracking-widest mr-2" style={{ color: "rgba(248,113,113,0.5)" }}>⚠ Invalidation</span>
        <span className="text-xs" style={{ color: "rgba(175,185,215,0.55)" }}>{idea.invalidation}</span>
      </div>
    </div>
  );
}

function MetaRow({ meta }: { meta: TradeMeta }) {
  const age = Math.round((Date.now() - new Date(meta.generatedAt).getTime()) / 60000);
  return (
    <div className="mb-5 flex flex-wrap gap-3">
      <div className="panel flex items-center gap-3 px-4 py-2.5 flex-1 min-w-fit">
        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Price</span>
        <span className="font-mono text-sm font-bold" style={{ color: "#f5c451" }}>${meta.price.toFixed(2)}</span>
      </div>
      {meta.technicalBias && (
        <div className="panel flex items-center gap-3 px-4 py-2.5 flex-1 min-w-fit">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>Technical</span>
          <span className="text-xs font-bold" style={{ color: meta.technicalBias.toLowerCase().includes("bull") ? "#34d399" : meta.technicalBias.toLowerCase().includes("bear") ? "#f87171" : "#f5c451" }}>
            {meta.technicalBias} · {meta.technicalScore}/100
          </span>
        </div>
      )}
      {meta.aiSignal && (
        <div className="panel flex items-center gap-3 px-4 py-2.5 flex-1 min-w-fit">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>AI Signal</span>
          <span className="text-xs font-bold" style={{ color: meta.aiSignal === "BUY" ? "#34d399" : meta.aiSignal === "SELL" ? "#f87171" : "#f5c451" }}>
            {meta.aiSignal} · {(meta.aiConfidence ?? 0).toFixed(1)}%
          </span>
        </div>
      )}
      {meta.newsSentiment && (
        <div className="panel flex items-center gap-3 px-4 py-2.5 flex-1 min-w-fit">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(175,185,215,0.3)" }}>News</span>
          <span className="text-xs font-bold" style={{ color: meta.newsScore && meta.newsScore > 55 ? "#34d399" : meta.newsScore && meta.newsScore < 45 ? "#f87171" : "#f5c451" }}>
            {meta.newsSentiment} · {meta.newsScore}/100
          </span>
        </div>
      )}
      <div className="panel flex items-center gap-2 px-4 py-2.5">
        <span className="text-[10px]" style={{ color: "rgba(175,185,215,0.3)" }}>
          {age < 1 ? "เพิ่งสร้าง" : `${age} นาทีที่แล้ว`}
        </span>
      </div>
    </div>
  );
}

export default function TradeIdeasPage() {
  const [data, setData]       = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const load = useCallback(async (bust = false) => {
    setLoading(true); setErr("");
    try {
      const url = bust ? "/api/trade-ideas?bust=1" : "/api/trade-ideas";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="💡 Trade Ideas (AI)"
        subtitle="Gemini สังเคราะห์ ideas จาก AI Model + Technical Score + News Sentiment · อัปเดตทุก 30 นาที"
      />

      {/* Refresh */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs" style={{ color: "rgba(175,185,215,0.3)" }}>
          {data?.cached ? "🗃 cached" : "✨ fresh"} · รวม {data?.ideas.length ?? 0} ideas
        </div>
        <button onClick={() => load(true)}
          disabled={loading}
          className="rounded-xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-40"
          style={{ background: "rgba(245,196,81,0.12)", border: "1px solid rgba(245,196,81,0.3)", color: "#f5c451" }}>
          {loading ? "⏳ กำลังสร้าง…" : "🔄 สร้าง Ideas ใหม่"}
        </button>
      </div>

      {/* Meta row */}
      {data?.meta && <MetaRow meta={data.meta} />}

      {/* Error */}
      {err && (
        <div className="panel mb-5 px-5 py-4 text-sm" style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171" }}>
          {err}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="panel h-64 animate-pulse rounded-2xl" style={{ opacity: 0.4 }} />
          ))}
        </div>
      )}

      {/* Ideas */}
      {!loading && data && data.ideas.length === 0 && (
        <div className="panel flex flex-col items-center gap-3 py-16 text-center">
          <div className="text-4xl opacity-30">🤔</div>
          <div className="text-sm" style={{ color: "rgba(175,185,215,0.5)" }}>
            ยังไม่มี Setup ที่ชัดเจนพอในตอนนี้
          </div>
          <div className="text-xs" style={{ color: "rgba(175,185,215,0.3)" }}>
            Market อาจกำลัง Sideways หรือ signals ขัดแย้งกัน — รอสัญญาณที่ชัดขึ้น
          </div>
        </div>
      )}

      {data?.ideas && data.ideas.length > 0 && (
        <div className="space-y-5">
          {data.ideas.map((idea, i) => (
            <IdeaCard key={i} idea={idea} index={i} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 rounded-xl px-4 py-3 text-[10px]"
        style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.12)", color: "rgba(175,185,215,0.4)" }}>
        ⚠️ Trade Ideas เหล่านี้เป็นการวิเคราะห์โดย AI เพื่อประกอบการตัดสินใจเท่านั้น
        ไม่ใช่การแนะนำการลงทุน การเทรด XAUUSD มีความเสี่ยงสูง
        โปรดศึกษาและตัดสินใจด้วยตัวเองก่อนเสมอ ·
        <a href="/ai-model" className="ml-1 underline opacity-60">AI Model</a> ·
        <a href="/technical" className="ml-1 underline opacity-60">Technical</a> ·
        <a href="/news" className="ml-1 underline opacity-60">News</a>
      </div>
    </div>
  );
}
