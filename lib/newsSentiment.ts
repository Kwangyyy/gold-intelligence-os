// Gold News Sentiment — fetches Google News RSS and merges with Gemini analysis.

import { analyzeNewsSentiment } from "./gemini";

export type Sentiment = "bullish" | "bearish" | "neutral";

export interface NewsItem {
  title:     string;
  source:    string;
  pubDate:   string;
  url:       string;
  sentiment: Sentiment;
  impact:    number;      // 1–3
  summaryTh: string;
  reason:    string;
}

export interface NewsResult {
  items:            NewsItem[];
  overallSentiment: Sentiment;
  overallScore:     number;   // 0–100
  bullishCount:     number;
  bearishCount:     number;
  neutralCount:     number;
  highImpactCount:  number;
  aiSummaryEn:      string;
  aiSummaryTh:      string;
  timestamp:        string;
  itemCount:        number;
}

// ── RSS helpers ───────────────────────────────────────────────────────────────

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
}

function clean(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRSS(xml: string) {
  const out: { title: string; source: string; pubDate: string; url: string }[] = [];
  const re  = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const b      = m[1];
    const title  = clean(tag(b, "title"));
    const link   = clean(tag(b, "link")) || clean(tag(b, "guid"));
    const date   = clean(tag(b, "pubDate"));
    const source = clean(tag(b, "source")) || guessSource(title);
    if (title.length > 15) out.push({ title, source, pubDate: date, url: link });
  }
  return out;
}

function guessSource(title: string): string {
  // Google News often appends "- Source" at the end
  const m = title.match(/ - ([^-]+)$/);
  return m ? m[1].trim() : "Unknown";
}

// ── Main builder ──────────────────────────────────────────────────────────────

const RSS_URLS = [
  "https://news.google.com/rss/search?q=gold+XAU+price+market&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=XAUUSD+gold+bullion&hl=en-US&gl=US&ceid=US:en",
];

async function fetchRSS(): Promise<{ title: string; source: string; pubDate: string; url: string }[]> {
  let combined: { title: string; source: string; pubDate: string; url: string }[] = [];

  for (const url of RSS_URLS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      combined.push(...parseRSS(xml));
    } catch { /* ignore timeout/network */ }
    if (combined.length >= 18) break;
  }

  // Deduplicate by title prefix
  const seen = new Set<string>();
  return combined
    .filter(item => {
      const key = item.title.slice(0, 45).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 16);
}

export async function fetchNewsSentiment(): Promise<NewsResult> {
  const rawItems = await fetchRSS();
  if (rawItems.length === 0) throw new Error("ไม่สามารถดึงข่าวได้ โปรดลองใหม่");

  const headlines = rawItems.map(i => i.title);
  const result    = await analyzeNewsSentiment(headlines);

  const items: NewsItem[] = rawItems.map((raw, i) => {
    const a = result.analyses.find(x => x.index === i) ?? {
      sentiment: "neutral" as Sentiment, impact: 1,
      summaryTh: raw.title.slice(0, 80), reason: "—",
    };
    return {
      title:     raw.title,
      source:    raw.source,
      pubDate:   raw.pubDate,
      url:       raw.url,
      sentiment: a.sentiment as Sentiment,
      impact:    Math.min(3, Math.max(1, a.impact)),
      summaryTh: a.summaryTh,
      reason:    a.reason,
    };
  });

  // Sort: high impact first, then by sentiment strength
  items.sort((a, b) => {
    if (b.impact !== a.impact) return b.impact - a.impact;
    const rank = { bullish: 2, bearish: 1, neutral: 0 };
    return rank[b.sentiment] - rank[a.sentiment];
  });

  const bullishCount    = items.filter(i => i.sentiment === "bullish").length;
  const bearishCount    = items.filter(i => i.sentiment === "bearish").length;
  const neutralCount    = items.filter(i => i.sentiment === "neutral").length;
  const highImpactCount = items.filter(i => i.impact >= 3).length;
  const score           = Math.min(100, Math.max(0, result.overallScore));
  const overallSentiment: Sentiment = score > 55 ? "bullish" : score < 45 ? "bearish" : "neutral";

  return {
    items,
    overallSentiment,
    overallScore:     score,
    bullishCount,
    bearishCount,
    neutralCount,
    highImpactCount,
    aiSummaryEn:      result.aiSummaryEn,
    aiSummaryTh:      result.aiSummaryTh,
    timestamp:        new Date().toISOString(),
    itemCount:        items.length,
  };
}
