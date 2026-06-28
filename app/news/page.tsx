"use client";

import { useCallback, useEffect, useState } from "react";
import type { NewsResult, NewsItem, Sentiment } from "@/lib/newsSentiment";
import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { useI18n } from "@/lib/i18n";

// ── Colour helpers ────────────────────────────────────────────────────────────

const SENT_BG: Record<Sentiment, string> = {
  bullish: "rgba(16,185,129,0.15)",
  bearish: "rgba(239,68,68,0.15)",
  neutral: "rgba(71,85,105,0.15)",
};
const SENT_BORDER: Record<Sentiment, string> = {
  bullish: "rgba(52,211,153,0.4)",
  bearish: "rgba(248,113,113,0.4)",
  neutral: "rgba(100,116,139,0.25)",
};
const SENT_TEXT: Record<Sentiment, string> = {
  bullish: "#34d399",
  bearish: "#f87171",
  neutral: "#64748b",
};
const SENT_LABEL: Record<Sentiment, string> = {
  bullish: "▲ BULLISH",
  bearish: "▼ BEARISH",
  neutral: "— NEUTRAL",
};
const IMPACT_STARS = ["", "★", "★★", "★★★"];
const IMPACT_COLOR = ["", "#64748b", "#f5c451", "#ef4444"];

// ── Sentiment arc gauge ───────────────────────────────────────────────────────

function SentimentGauge({ score, sentiment }: { score: number; sentiment: Sentiment }) {
  const col   = SENT_TEXT[sentiment];
  const label = sentiment === "bullish" ? "BULLISH" : sentiment === "bearish" ? "BEARISH" : "NEUTRAL";

  // Arc: from 225° to 315° (270° sweep)
  const R = 70; const CX = 90; const CY = 90;
  const startDeg = 225; const sweepDeg = 270;
  const pct      = score / 100;
  const endDeg   = startDeg + sweepDeg * pct;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcX  = (d: number) => CX + R * Math.cos(toRad(d));
  const arcY  = (d: number) => CY + R * Math.sin(toRad(d));

  const trailEnd = startDeg + sweepDeg;
  const arcLarge = (sweepDeg * pct) > 180 ? 1 : 0;
  const trailLarge = sweepDeg > 180 ? 1 : 0;

  // Zone markers: 0=45→neutral=50→55=bullish
  const neutralStart = startDeg + sweepDeg * 0.40;
  const neutralEnd   = startDeg + sweepDeg * 0.60;

  return (
    <div className="flex flex-col items-center">
      <svg width={180} height={140} viewBox="0 0 180 140">
        {/* Trail */}
        <path
          d={`M ${arcX(startDeg)} ${arcY(startDeg)} A ${R} ${R} 0 ${trailLarge} 1 ${arcX(trailEnd)} ${arcY(trailEnd)}`}
          fill="none" stroke="rgba(71,85,105,0.2)" strokeWidth={14} strokeLinecap="round"
        />
        {/* Bear zone (left) */}
        <path
          d={`M ${arcX(startDeg)} ${arcY(startDeg)} A ${R} ${R} 0 0 1 ${arcX(neutralStart)} ${arcY(neutralStart)}`}
          fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth={14} strokeLinecap="round"
        />
        {/* Bull zone (right) */}
        <path
          d={`M ${arcX(neutralEnd)} ${arcY(neutralEnd)} A ${R} ${R} 0 1 1 ${arcX(trailEnd)} ${arcY(trailEnd)}`}
          fill="none" stroke="rgba(52,211,153,0.15)" strokeWidth={14} strokeLinecap="round"
        />
        {/* Active fill */}
        {score > 0 && (
          <path
            d={`M ${arcX(startDeg)} ${arcY(startDeg)} A ${R} ${R} 0 ${arcLarge} 1 ${arcX(endDeg)} ${arcY(endDeg)}`}
            fill="none" stroke={col} strokeWidth={14} strokeLinecap="round"
          />
        )}
        {/* Score */}
        <text x={CX} y={CY + 8} textAnchor="middle" fontSize={28}
          fontWeight="900" fill={col} fontFamily="ui-monospace,monospace">{score}</text>
        {/* Label */}
        <text x={CX} y={CY + 28} textAnchor="middle" fontSize={10}
          fontWeight="700" fill={col} opacity={0.7}>/100</text>
        {/* Zone labels */}
        <text x={18}  y={128} fontSize={9} fill="rgba(248,113,113,0.5)" fontWeight="600">BEAR</text>
        <text x={CX}  y={140} fontSize={9} fill="rgba(100,116,139,0.4)" textAnchor="middle">NEUTRAL</text>
        <text x={148} y={128} fontSize={9} fill="rgba(52,211,153,0.5)"  fontWeight="600" textAnchor="end">BULL</text>
      </svg>
      <div className="text-sm font-extrabold -mt-1" style={{ color: col }}>{label}</div>
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl px-4 py-2.5"
      style={{ background: "rgba(71,85,105,0.12)", border: "1px solid rgba(71,85,105,0.2)" }}>
      <span className="text-[10px] uppercase tracking-widest text-silver/35">{label}</span>
      <span className="text-xl font-black font-mono mt-0.5" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Mini bar chart for breakdown ──────────────────────────────────────────────

function BreakdownBar({ bullish, bearish, neutral }: { bullish: number; bearish: number; neutral: number }) {
  const total = bullish + bearish + neutral || 1;
  const bPct  = (bullish / total) * 100;
  const brPct = (bearish / total) * 100;
  const nPct  = (neutral / total) * 100;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full gap-0.5">
      <div style={{ width: `${bPct}%`, background: "#34d399" }} />
      <div style={{ width: `${nPct}%`, background: "#334155" }} />
      <div style={{ width: `${brPct}%`, background: "#f87171" }} />
    </div>
  );
}

// ── News card ─────────────────────────────────────────────────────────────────

function NewsCard({ item }: { item: NewsItem }) {
  const sent = item.sentiment;
  const [expanded, setExpanded] = useState(false);

  const ago = (() => {
    if (!item.pubDate) return "";
    const d = new Date(item.pubDate);
    if (isNaN(d.getTime())) return item.pubDate;
    const m = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return (
    <div
      className="group flex flex-col gap-2.5 rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01]"
      style={{ background: SENT_BG[sent], border: `1px solid ${SENT_BORDER[sent]}` }}
      onClick={() => setExpanded(v => !v)}
    >
      {/* Header: source + time + impact */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-silver/45 truncate flex-1">{item.source}</span>
        <span className="text-[10px] text-silver/30 whitespace-nowrap">{ago}</span>
        <span className="text-[11px] font-bold ml-1" style={{ color: IMPACT_COLOR[item.impact] }}>
          {IMPACT_STARS[item.impact]}
        </span>
      </div>

      {/* Headline */}
      <div className="text-xs font-semibold text-silver/80 leading-snug">
        {item.title}
      </div>

      {/* Sentiment badge */}
      <div className="flex items-center gap-2">
        <span className="rounded px-2 py-0.5 text-[10px] font-black"
          style={{ background: "rgba(0,0,0,0.2)", color: SENT_TEXT[sent], border: `1px solid ${SENT_BORDER[sent]}` }}>
          {SENT_LABEL[sent]}
        </span>
        {item.impact === 3 && (
          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
            HIGH IMPACT
          </span>
        )}
      </div>

      {/* AI summary */}
      <div className="text-xs leading-relaxed" style={{ color: SENT_TEXT[sent], opacity: 0.8 }}>
        {item.summaryTh}
      </div>

      {/* Expanded: reason */}
      {expanded && item.reason && item.reason !== "—" && (
        <div className="border-t pt-2 text-[11px] text-silver/40 leading-snug"
          style={{ borderColor: SENT_BORDER[sent] }}>
          {item.reason}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewsPage() {
  useI18n();
  const [data, setData]         = useState<NewsResult | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [lastAt, setLastAt]     = useState<Date | null>(null);
  const [filter, setFilter]     = useState<Sentiment | "all">("all");

  const fetchNews = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError("");
    try {
      const url = forceRefresh ? "/api/news?refresh=1" : "/api/news";
      const res  = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "failed");
      setData(json as NewsResult);
      setLastAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const filtered = data?.items.filter(i => filter === "all" || i.sentiment === filter) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Gold News Sentiment"
        subtitle="AI วิเคราะห์ sentiment ข่าวทองคำ real-time · Gemini AI + Google News RSS"
      />

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {data && lastAt && (
          <div className="flex items-center gap-2 text-xs text-silver/40">
            <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            อัปเดต {lastAt.toLocaleTimeString("th-TH")} · cache 30 นาที
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => fetchNews(true)} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/5 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/10 transition-colors disabled:opacity-40">
            {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />}
            {loading ? "กำลังโหลด…" : "🔄 รีเฟรช"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-400">
          ⚠ {error}
        </div>
      )}

      {loading && !data && (
        <div className="space-y-4 animate-pulse">
          <div className="panel h-40 bg-base-panel/60" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="panel h-36 bg-base-panel/40" />
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className={`space-y-5 transition-opacity duration-300 ${loading ? "opacity-60" : "opacity-100"}`}>

          {/* ── Overview card ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(135deg, rgba(10,7,20,0.97) 0%, rgba(7,9,22,0.97) 100%)",
              border: `1px solid ${SENT_BORDER[data.overallSentiment]}`,
              boxShadow: `0 0 40px -10px ${SENT_TEXT[data.overallSentiment]}22`,
            }}
          >
            <div className="flex flex-wrap items-start gap-6">
              {/* Gauge */}
              <SentimentGauge score={data.overallScore} sentiment={data.overallSentiment} />

              {/* Stats */}
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-widest text-silver/35 mb-3">
                  วิเคราะห์จาก {data.itemCount} ข่าว · XAUUSD Gold Sentiment
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <StatChip label="Bullish" value={data.bullishCount.toString()} color="#34d399" />
                  <StatChip label="Neutral" value={data.neutralCount.toString()} color="#64748b" />
                  <StatChip label="Bearish" value={data.bearishCount.toString()} color="#f87171" />
                  {data.highImpactCount > 0 && (
                    <StatChip label="High Impact" value={data.highImpactCount.toString()} color="#ef4444" />
                  )}
                </div>

                {/* Breakdown bar */}
                <div className="mb-3">
                  <BreakdownBar
                    bullish={data.bullishCount}
                    bearish={data.bearishCount}
                    neutral={data.neutralCount}
                  />
                  <div className="flex justify-between text-[9px] mt-1 text-silver/30">
                    <span style={{ color: "#34d399" }}>Bullish {Math.round(data.bullishCount / data.itemCount * 100)}%</span>
                    <span>Neutral {Math.round(data.neutralCount / data.itemCount * 100)}%</span>
                    <span style={{ color: "#f87171" }}>Bearish {Math.round(data.bearishCount / data.itemCount * 100)}%</span>
                  </div>
                </div>

                {/* AI Summary */}
                <div
                  className="rounded-xl p-3"
                  style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)" }}
                >
                  <div className="text-[10px] uppercase tracking-widest text-purple-400/60 mb-1.5">
                    🤖 AI Market Narrative
                  </div>
                  <p className="text-xs leading-relaxed text-silver/70 mb-2">{data.aiSummaryTh}</p>
                  <p className="text-[11px] leading-relaxed text-silver/40 italic">{data.aiSummaryEn}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Filter tabs ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5">
            {([
              ["all",     `ทั้งหมด (${data.itemCount})`,    "#94a3b8"],
              ["bullish", `▲ Bullish (${data.bullishCount})`, "#34d399"],
              ["neutral", `— Neutral (${data.neutralCount})`, "#64748b"],
              ["bearish", `▼ Bearish (${data.bearishCount})`, "#f87171"],
            ] as [Sentiment | "all", string, string][]).map(([key, label, col]) => (
              <button key={key} onClick={() => setFilter(key)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
                style={filter === key
                  ? { background: `${col}22`, border: `1px solid ${col}66`, color: col }
                  : { background: "transparent", border: "1px solid rgba(71,85,105,0.25)", color: "#475569" }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── News feed grid ───────────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-silver/30">ไม่มีข่าวในหมวดนี้</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item, i) => (
                <NewsCard key={i} item={item} />
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-base-border/30 bg-base-panel/30 px-4 py-3">
            <span className="text-[10px] text-silver/40 font-semibold">Impact:</span>
            {[1, 2, 3].map(imp => (
              <span key={imp} className="flex items-center gap-1 text-[10px]" style={{ color: IMPACT_COLOR[imp] }}>
                {IMPACT_STARS[imp]} {imp === 1 ? "ต่ำ" : imp === 2 ? "กลาง" : "สูง"}
              </span>
            ))}
            <span className="ml-auto text-[10px] text-silver/25">
              คลิกที่ข่าวเพื่อดูรายละเอียดเพิ่มเติม
            </span>
          </div>

          <Disclaimer />
        </div>
      )}
    </div>
  );
}
