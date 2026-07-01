import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface SentimentArticle {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: "bullish" | "bearish" | "neutral";
  sentimentScore: number;  // -100 to +100
  goldImpact: "high" | "medium" | "low";
  keyThemes: string[];
  summary: string;
  summaryTh: string;
}

export interface NewsSentimentPayload {
  articles: SentimentArticle[];
  overallSentiment: "bullish" | "bearish" | "neutral";
  overallScore: number;    // -100 to +100
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  trend: "improving" | "deteriorating" | "stable";
  trendTh: string;
  cumulativeScores: number[];  // running average for chart
  generatedAt: string;
}

// Lightweight rule-based sentiment if Gemini not available
function ruleBased(title: string): { sentiment: "bullish" | "bearish" | "neutral"; score: number; impact: "high" | "medium" | "low"; themes: string[] } {
  const t = title.toLowerCase();
  const bullish = ["rate cut", "dovish", "weak dollar", "inflation", "geopolit", "tension", "safe haven", "rally", "surge", "jump", "rise", "china", "recession", "crisis", "war", "conflict", "fed pause", "hold rate"];
  const bearish = ["rate hike", "hawkish", "strong dollar", "risk on", "selloff", "drop", "fall", "plunge", "taper", "tightening", "jobs", "gdp beat", "economic strength"];
  const highImpact = ["fed", "fomc", "cpi", "nfp", "inflation", "rate", "powell", "gdp"];
  let score = 0;
  const themes: string[] = [];
  bullish.forEach(w => { if (t.includes(w)) { score += 15; themes.push(w); } });
  bearish.forEach(w => { if (t.includes(w)) { score -= 15; themes.push(w); } });
  score = Math.max(-100, Math.min(100, score));
  const impact = highImpact.some(w => t.includes(w)) ? "high" : score !== 0 ? "medium" : "low";
  return { sentiment: score > 5 ? "bullish" : score < -5 ? "bearish" : "neutral", score, impact, themes: themes.slice(0, 3) };
}

let CACHE: { data: NewsSentimentPayload; ts: number } | null = null;
const TTL = 20 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch news from our existing /api/news endpoint
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3100";
    const newsRes = await fetch(`${base}/api/news`, { cache: "no-store" });
    if (!newsRes.ok) throw new Error(`news ${newsRes.status}`);
    const newsData = await newsRes.json();
    const rawArticles: { title?: string; source?: { name?: string }; publishedAt?: string; url?: string; description?: string }[] =
      newsData.articles ?? [];

    const articles: SentimentArticle[] = rawArticles.slice(0, 20).map(a => {
      const title = a.title ?? "No title";
      const rb = ruleBased(title);
      return {
        title,
        source:       a.source?.name ?? "Unknown",
        publishedAt:  a.publishedAt  ?? new Date().toISOString(),
        url:          a.url          ?? "#",
        sentiment:    rb.sentiment,
        sentimentScore: rb.score,
        goldImpact:   rb.impact,
        keyThemes:    rb.themes,
        summary:      a.description ?? title,
        summaryTh:    a.description ?? title,
      };
    });

    if (!articles.length) {
      // Fallback placeholder
      articles.push({
        title: "Gold market quiet — no major news this session",
        source: "System", publishedAt: new Date().toISOString(), url: "#",
        sentiment: "neutral", sentimentScore: 0, goldImpact: "low", keyThemes: [],
        summary: "No news fetched", summaryTh: "ไม่มีข่าว",
      });
    }

    const scores = articles.map(a => a.sentimentScore);
    const overall = scores.reduce((a, v) => a + v, 0) / scores.length;
    const bullish = articles.filter(a => a.sentiment === "bullish").length;
    const bearish = articles.filter(a => a.sentiment === "bearish").length;
    const neutral = articles.filter(a => a.sentiment === "neutral").length;

    // Running cumulative average
    const cumulativeScores: number[] = [];
    let run = 0;
    scores.forEach((s, i) => { run += s; cumulativeScores.push(run / (i + 1)); });

    // Trend: compare first half vs second half
    const firstHalf  = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const avgFirst  = firstHalf.reduce((a, v) => a + v, 0) / (firstHalf.length || 1);
    const avgSecond = secondHalf.reduce((a, v) => a + v, 0) / (secondHalf.length || 1);
    const trend = avgSecond - avgFirst > 5 ? "improving" : avgSecond - avgFirst < -5 ? "deteriorating" : "stable";
    const trendTh = trend === "improving" ? "ดีขึ้น" : trend === "deteriorating" ? "แย่ลง" : "คงที่";

    const overallSentiment: "bullish" | "bearish" | "neutral" = overall > 5 ? "bullish" : overall < -5 ? "bearish" : "neutral";

    const data: NewsSentimentPayload = {
      articles,
      overallSentiment,
      overallScore: +overall.toFixed(1),
      bullishCount: bullish, bearishCount: bearish, neutralCount: neutral,
      trend, trendTh,
      cumulativeScores: cumulativeScores.map(s => +s.toFixed(1)),
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
