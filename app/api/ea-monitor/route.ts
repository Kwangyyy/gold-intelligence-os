import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

export interface EaListing {
  id:       string;
  title:    string;
  url:      string;
  price:    string;
  rating:   string;
  reviews:  string;
  source:   string;
  pubDate:  string;
  isNew:    boolean;
}

const SEEN_KEY = "gios:ea-monitor-seen";

function getRedis(): Redis | null {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) return null;
  return new Redis({ url: u, token: t });
}

declare global { var __eaSeen: Set<string> | undefined; }
function memSeen(): Set<string> {
  if (!globalThis.__eaSeen) globalThis.__eaSeen = new Set();
  return globalThis.__eaSeen;
}

// Parse MQL5 Market RSS
async function fetchMQL5RSS(): Promise<EaListing[]> {
  const url = "https://www.mql5.com/en/market/product/list/expert?rss=1";
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml,application/xml" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`MQL5 RSS: ${r.status}`);
  const xml = await r.text();

  const items: EaListing[] = [];
  const re  = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title   = clean(tag(block, "title"));
    const link    = clean(tag(block, "link"));
    const pubDate = clean(tag(block, "pubDate"));
    if (!title || !link) continue;

    const idStr = link.split("/").pop() ?? link;
    items.push({
      id:      `mql5-${idStr}`,
      title,
      url:     link,
      price:   extractPrice(block),
      rating:  extractRating(block),
      reviews: extractReviews(block),
      source:  "MQL5 Market",
      pubDate,
      isNew:   false,
    });
    if (items.length >= 20) break;
  }
  return items;
}

// Parse myfxbook EA section via community feed
async function fetchMyfxbookRSS(): Promise<EaListing[]> {
  const url = "https://www.myfxbook.com/community/systems?filterType=ea&orderBy=date&rss=true";
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const items: EaListing[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const block   = m[1];
      const title   = clean(tag(block, "title"));
      const link    = clean(tag(block, "link"));
      const pubDate = clean(tag(block, "pubDate"));
      if (!title || !link) continue;
      items.push({
        id:      `myfx-${link.split("/").pop()}`,
        title, url: link, price: "Free", rating: "—", reviews: "—",
        source:  "myfxbook", pubDate, isNew: false,
      });
      if (items.length >= 10) break;
    }
    return items;
  } catch { return []; }
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${name}>`, "i"))
         ?? block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].trim() : "";
}
function clean(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#\d+;/g,"").trim();
}
function extractPrice(block: string): string {
  const m = block.match(/\$[\d,]+\.?\d*/);
  return m ? m[0] : "—";
}
function extractRating(block: string): string {
  const m = block.match(/rating['":\s]+([0-9.]+)/i);
  return m ? m[1] : "—";
}
function extractReviews(block: string): string {
  const m = block.match(/review[s'":\s]+(\d+)/i);
  return m ? m[1] : "—";
}

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";

  try {
    const [mql5, myfx] = await Promise.allSettled([fetchMQL5RSS(), fetchMyfxbookRSS()]);
    const all: EaListing[] = [
      ...(mql5.status  === "fulfilled" ? mql5.value  : []),
      ...(myfx.status  === "fulfilled" ? myfx.value  : []),
    ];

    // Mark new items (not seen before)
    const redis = getRedis();
    const seenIds = redis
      ? new Set<string>(await redis.smembers(SEEN_KEY) as string[])
      : memSeen();

    const newIds: string[] = [];
    for (const item of all) {
      if (!seenIds.has(item.id)) {
        item.isNew = true;
        newIds.push(item.id);
      }
    }

    // Save new IDs as seen
    if (newIds.length > 0) {
      if (redis) {
        await redis.sadd(SEEN_KEY, newIds[0], ...newIds.slice(1));
        await redis.expire(SEEN_KEY, 60 * 60 * 24 * 30); // 30 days
      } else {
        for (const id of newIds) (memSeen()).add(id);
      }
    }

    return NextResponse.json({ ok: true, items: all, newCount: newIds.length },
      { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
