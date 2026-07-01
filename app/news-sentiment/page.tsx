"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { NewsSentimentPayload, SentimentArticle } from "@/app/api/news-sentiment/route";

const SENT_STYLE = {
  bullish: { color: "#34d399", bg: "rgba(52,211,153,0.08)", icon: "📈" },
  bearish: { color: "#f87171", bg: "rgba(248,113,113,0.08)", icon: "📉" },
  neutral: { color: "#f5c451", bg: "rgba(245,196,81,0.06)",  icon: "⟷"  },
};

const IMPACT_COLOR = { high: "#f87171", medium: "#f5c451", low: "rgba(175,185,215,0.3)" };

function SentimentSparkline({ scores }: { scores: number[] }) {
  if (!scores.length) return null;
  const w = 280, h = 60;
  const minS = Math.min(...scores, -20), maxS = Math.max(...scores, 20);
  const range = maxS - minS || 1;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((s - minS) / range) * h;
    return `${x},${y}`;
  });
  const midY = h - ((0 - minS) / range) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 60 }}>
      {/* Zero line */}
      <line x1="0" y1={midY} x2={w} y2={midY} stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
      {/* Gradient fill */}
      <defs>
        <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#f5c451" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#f87171" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <polyline points={pts.join(" ")} fill="none" stroke="#f5c451" strokeWidth="2" strokeLinecap="round" />
      {/* Last dot */}
      {pts.length > 0 && (
        <circle
          cx={parseFloat(pts[pts.length - 1].split(",")[0])}
          cy={parseFloat(pts[pts.length - 1].split(",")[1])}
          r="3" fill="#f5c451" />
      )}
    </svg>
  );
}

function ArticleRow({ a }: { a: SentimentArticle }) {
  const [open, setOpen] = useState(false);
  const s = SENT_STYLE[a.sentiment];
  const absScore = Math.abs(a.sentimentScore);
  return (
    <div className="panel px-4 py-3 cursor-pointer"
      style={{ borderColor: `${s.color}20`, background: open ? s.bg : undefined }}
      onClick={() => setOpen(o => !o)}>
      <div className="flex items-start gap-3">
        <div className="text-base shrink-0 mt-0.5">{s.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-xs leading-snug" style={{ color: "rgba(175,185,215,0.85)" }}>{a.title}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>{a.source}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded"
              style={{ background: `${IMPACT_COLOR[a.goldImpact]}15`, color: IMPACT_COLOR[a.goldImpact] }}>
              {a.goldImpact} impact
            </span>
            {a.keyThemes.slice(0, 2).map(t => (
              <span key={t} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(175,185,215,0.4)" }}>{t}</span>
            ))}
          </div>
          {/* Score bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden relative" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="absolute inset-y-0" style={{
                left: a.sentimentScore >= 0 ? "50%" : `${50 - absScore / 2}%`,
                width: `${absScore / 2}%`,
                background: s.color,
                opacity: 0.7,
              }} />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
            </div>
            <span className="text-[9px] font-mono font-bold w-8 text-right" style={{ color: s.color }}>
              {a.sentimentScore > 0 ? "+" : ""}{a.sentimentScore}
            </span>
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-white/5 text-[10px]" style={{ color: "rgba(175,185,215,0.55)" }}>
          <p>{a.summaryTh}</p>
          <p className="mt-1 text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>{a.summary}</p>
          <div className="mt-1.5 text-[9px]" style={{ color: "rgba(175,185,215,0.3)" }}>
            {new Date(a.publishedAt).toLocaleString("th-TH")}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewsSentimentPage() {
  const [data, setData]       = useState<NewsSentimentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/news-sentiment", { cache: "no-store" });
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
        title="📰 News Sentiment"
        subtitle="Gold news sentiment analysis — คลิกที่บทความเพื่อดูรายละเอียด"
      />

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: "rgba(175,185,215,0.3)" }}>📰 วิเคราะห์ sentiment…</div>
        </div>
      )}
      {err && <div className="panel px-5 py-4 text-sm text-red-400">{err}</div>}

      {data && !loading && (
        <div className="space-y-5">
          {/* Overview */}
          <div className="grid grid-cols-4 gap-2">
            <div className="panel px-3 py-3 text-center">
              <div className="text-[7px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Overall</div>
              <div className="text-lg font-black" style={{ color: SENT_STYLE[data.overallSentiment].color }}>
                {SENT_STYLE[data.overallSentiment].icon}
              </div>
              <div className="text-[9px] font-bold" style={{ color: SENT_STYLE[data.overallSentiment].color }}>
                {data.overallSentiment}
              </div>
            </div>
            <div className="panel px-3 py-3 text-center">
              <div className="text-[7px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Score</div>
              <div className="text-lg font-black" style={{ color: data.overallScore > 0 ? "#34d399" : data.overallScore < 0 ? "#f87171" : "#f5c451" }}>
                {data.overallScore > 0 ? "+" : ""}{data.overallScore}
              </div>
            </div>
            <div className="panel px-3 py-3 text-center col-span-2">
              <div className="text-[7px] uppercase tracking-widest mb-1" style={{ color: "rgba(175,185,215,0.3)" }}>Distribution</div>
              <div className="flex justify-center gap-3 text-[10px]">
                <span style={{ color: "#34d399" }}>📈 {data.bullishCount}</span>
                <span style={{ color: "#f5c451" }}>⟷ {data.neutralCount}</span>
                <span style={{ color: "#f87171" }}>📉 {data.bearishCount}</span>
              </div>
              <div className="text-[8px] mt-0.5" style={{ color: "rgba(175,185,215,0.3)" }}>
                Trend: <span style={{ color: data.trend === "improving" ? "#34d399" : data.trend === "deteriorating" ? "#f87171" : "#f5c451" }}>
                  {data.trendTh}
                </span>
              </div>
            </div>
          </div>

          {/* Sparkline */}
          <div className="panel px-5 py-4">
            <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: "rgba(175,185,215,0.3)" }}>
              Cumulative Sentiment Trend (newest → oldest)
            </div>
            <SentimentSparkline scores={data.cumulativeScores} />
            <div className="flex justify-between text-[8px] mt-1" style={{ color: "rgba(175,185,215,0.2)" }}>
              <span>Most recent</span><span>Older news</span>
            </div>
          </div>

          {/* Articles */}
          <div>
            <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(175,185,215,0.3)" }}>
              {data.articles.length} Articles — Score bar: เส้นกลาง = 0 · ขวา = Bullish · ซ้าย = Bearish
            </div>
            <div className="space-y-2">
              {data.articles.map((a, i) => <ArticleRow key={i} a={a} />)}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px]" style={{ color: "rgba(175,185,215,0.25)" }}>
              {data.articles.length} articles · อัปเดต {new Date(data.generatedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
