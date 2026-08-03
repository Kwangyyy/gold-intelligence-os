// Watches the news for things that move gold, and decides what is worth waking
// someone up for.
//
// Gold reprices on events, not on schedules: a strike on an oil facility, a
// tariff announcement, a Fed speaker turning hawkish. The app already had a
// gold-headline feed for sentiment scoring, but nothing watching the categories
// that actually cause the gap — conflict, US policy statements, central banks —
// and nothing that could push an alert.
//
// Source is Google News RSS, which is free, needs no key, and returns 100 items
// per query in under a second. It aggregates rather than reports, so an item is
// a signal that something is being covered, not a verified fact. Alerts say
// where the headline came from and link out; nothing here should be traded
// without reading the source.

import { kvGet, kvSet } from "./kvStore";

export type EventCategory = "conflict" | "policy" | "centralBank" | "macro";

export interface WatchedEvent {
  id: string;             // stable across polls: hash of the normalised title
  title: string;
  source: string;         // the outlet, as Google News appends it
  link: string;
  publishedAt: string;    // ISO
  category: EventCategory;
  severity: number;       // 0-100, how much this ought to move gold
  goldBias: "bullish" | "bearish" | "unclear";
  matched: string[];      // the terms that fired, so the score is auditable
}

interface Feed {
  category: EventCategory;
  query: string;
}

// `when:` is Google News' own recency filter, and it matters more than the
// keywords do. Without it the feed returns 100 items spanning a week and only a
// handful are from today — the first version of this scanned 600 headlines and
// found five events, because it was filtering by date *after* fetching a
// backlog. With `when:1d` every item is fresh and the yield is 10-50x.
//
// The Trump feed is deliberately broad. Narrowing it to "Trump tariffs OR Trump
// says Fed" returned items two days old; he says something newsworthy hourly,
// and the severity score is what decides whether it is gold-relevant, not the
// query. Political filler scores zero and never reaches the threshold.
const FEEDS: Feed[] = [
  { category: "conflict", query: "war OR missile strike OR invasion OR airstrike OR military escalation when:1d" },
  { category: "conflict", query: "(Iran OR Israel OR Russia OR Ukraine OR Taiwan) (strike OR attack OR escalation OR threat) when:1d" },
  { category: "policy", query: "Trump when:1d" },
  { category: "policy", query: "(tariff OR sanctions OR executive order OR trade war) when:1d" },
  { category: "centralBank", query: "(Federal Reserve OR Powell OR FOMC OR rate decision) when:2d" },
  { category: "centralBank", query: "central bank gold buying OR gold reserves purchase when:7d" },
  { category: "macro", query: "(inflation OR CPI OR debt ceiling OR credit downgrade OR recession) when:2d" },
];

// Terms that carry weight, with the direction they usually push gold. Gold is a
// haven: escalation and uncertainty lift it, resolution and hawkish real rates
// press it. These are rules of thumb applied to a headline, not a model.
const BULLISH: Record<string, number> = {
  "nuclear": 40, "invasion": 35, "invades": 35, "airstrike": 32, "air strike": 32,
  "missile strike": 32, "bombard": 30, "attack": 22, "strike on": 28,
  "escalat": 26, "war": 24, "military action": 28, "troops deployed": 24,
  "sanction": 20, "emergency": 20, "crisis": 18, "default": 30,
  "threat": 18, "threaten": 18, "warns": 14, "fears": 14, "casualt": 26,
  "energy site": 24, "oil facility": 26, "refinery": 20, "tanker": 18,
  "retaliat": 26, "mobiliz": 20, "evacuat": 22, "killed": 20, "seized": 20,
  "downgrade": 24, "shutdown": 16, "rate cut": 22, "dovish": 20,
  "inflation surge": 24, "hotter than expected": 20, "safe haven": 18,
  "central bank buying": 22, "gold reserves": 16, "tariff": 18,
};

const BEARISH: Record<string, number> = {
  "ceasefire": 30, "peace deal": 32, "truce": 26, "de-escalat": 26,
  "deescalat": 26, "agreement reached": 22, "resolution": 16,
  "rate hike": 24, "hawkish": 22, "stronger dollar": 18,
  "cooler than expected": 20, "inflation eases": 22, "risk-on": 16,
  "sanctions lifted": 22, "talks resume": 14,
};

// Words that mean the headline is about the *word*, not the event — a film
// review, a sports metaphor, an anniversary piece.
const NOISE = /\b(movie|film|game|season|trailer|recipe|anniversary|documentary|review|obituary|book|podcast|fantasy|nfl|nba|soccer)\b/i;

function stripTags(s: string): string {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

/** Stable id from the headline, so the same story is not alerted twice. */
function idOf(title: string): string {
  const norm = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  let h = 0;
  for (let i = 0; i < norm.length; i++) h = (Math.imul(31, h) + norm.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Words that undo the term following them.
//
// The scorer counted keywords without reading direction, so "Trump cancels
// attack on Iran to reach nuclear deal" matched +nuclear and +attack and was
// filed as 62-point *bullish* for gold — a de-escalation headline sent as a
// reason gold should rise. Three of the ten stories in one scan were that same
// mistake: a called-off strike, a paused strike, and a nuclear deal.
//
// A cue flips whatever term follows it rather than merely suppressing it: a
// cancelled attack is not neutral news, it is the opposite of an attack. That
// works both ways, so "ceasefire collapses" flips a bearish term to bullish.
// Cues that come *before* what they undo: "cancels the attack".
const NEGATORS_BEFORE =
  /\b(cancel(s|led|ed|ling|ing)?|calls? off|called off|calling off|holds? off|held off|holding off|halt(s|ed|ing)?|paus(e|es|ed|ing)|suspend(s|ed|ing)?|avert(s|ed|ing)?|avoid(s|ed|ing)?|delay(s|ed|ing)?|postpon(e|es|ed|ing)|rules? out|ruled out|backs? away from|stands? down|stood down|withdraw(s|n|ing)?|lift(s|ed|ing)?|no longer|refrain(s|ed)? from|scrap(s|ped|ping)?|abandon(s|ed|ing)?)\b/;

// Cues that come *after*: "the ceasefire collapses". English puts the reversing
// verb on either side of its object, and looking only backwards left
// "Gaza ceasefire collapses" scoring as bearish for gold — a truce breaking
// down filed as a reason gold should fall.
const NEGATORS_AFTER =
  /\b(collaps(e|es|ed|ing)|breaks? down|breaking down|broke down|broken down|reject(ed|s)?|fail(s|ed|ing)?|falter(s|ed)?|unravel(s|led|ing)?|calls? off|called off|cancel(l)?ed|cancel(l)?ing|scrapped|off the table|in doubt|abandoned)\b/;

// How far to look for a cue. Long enough for "calls off the planned" and short
// enough that a cue in an unrelated clause cannot reach across.
const NEGATION_WINDOW = 45;

/** Is this occurrence of `term` undone by a cue on either side of it? */
function negatedAt(t: string, at: number, term: string): boolean {
  const before = t.slice(Math.max(0, at - NEGATION_WINDOW), at);
  const after = t.slice(at + term.length, at + term.length + NEGATION_WINDOW);
  return NEGATORS_BEFORE.test(before) || NEGATORS_AFTER.test(after);
}

// Some terms mean the opposite depending on the word beside them. "nuclear
// strike" and "nuclear deal" share a keyword and nothing else.
const PHRASE_FLIPS = [
  "nuclear deal", "nuclear agreement", "nuclear talks", "nuclear accord",
  "peace talks", "peace plan", "trade deal", "sanctions relief",
];

// Named wars of the past, used as a yardstick. "would have been the biggest
// since World War II" measures how large something was; it does not report a
// war starting. Counting it as one put a de-escalation headline back on the
// bullish side even after the cancelled attack had been caught.
//
// These suppress the term rather than flipping it — a historical analogy argues
// neither way. World War III is deliberately absent: that one is a forecast.
const HISTORICAL_WARS = [
  "world war ii", "world war 2", "wwii", "ww2",
  "world war i", "wwi", "cold war", "vietnam war", "korean war",
];

/** Does `term` appear anywhere outside the given phrases? */
function hasStandalone(t: string, term: string, phrases: string[]): boolean {
  let masked = t;
  for (const p of phrases) masked = masked.split(p).join(" ".repeat(p.length));
  return masked.includes(term);
}

/**
 * Exported so the direction rules can be tested against real headlines rather
 * than checked by eye. Getting the sign wrong is silent — a de-escalation
 * headline sent as a reason gold should rise still looks like a working alert.
 */
export function scoreForTest(title: string, category: EventCategory) {
  return score(title, category);
}

function score(title: string, category: EventCategory) {
  const t = title.toLowerCase();
  const matched: string[] = [];
  let bull = 0, bear = 0;

  const flipped = PHRASE_FLIPS.filter((p) => t.includes(p));
  const historical = HISTORICAL_WARS.filter((p) => t.includes(p));

  for (const [term, w] of Object.entries(BULLISH)) {
    const at = t.indexOf(term);
    if (at < 0) continue;
    // Only skip when *every* occurrence sits inside a historical reference —
    // "war in Ukraine, the worst since World War II" is still reporting a war.
    if (historical.some((p) => p.includes(term)) && !hasStandalone(t, term, historical)) {
      matched.push(`=${term}`);
      continue;
    }
    // A term inside one of the reversing phrases is about that phrase.
    const inFlip = flipped.some((p) => p.includes(term));
    if (inFlip || negatedAt(t, at, term)) { bear += w; matched.push(`~${term}`); }
    else { bull += w; matched.push(`+${term}`); }
  }
  for (const [term, w] of Object.entries(BEARISH)) {
    const at = t.indexOf(term);
    if (at < 0) continue;
    if (negatedAt(t, at, term)) { bull += w; matched.push(`~${term}`); }
    else { bear += w; matched.push(`-${term}`); }
  }

  // Conflict headlines start with a floor: "Explosions reported in <city>"
  // carries no keyword above but is exactly the kind of thing that gaps gold.
  const floor = category === "conflict" ? 12 : 0;
  const net = bull - bear;
  const severity = Math.min(100, Math.max(floor, Math.abs(net)));
  const goldBias: WatchedEvent["goldBias"] =
    net >= 10 ? "bullish" : net <= -10 ? "bearish" : "unclear";

  return { severity, goldBias, matched };
}

async function fetchFeed(f: Feed): Promise<WatchedEvent[]> {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(f.query) +
    "&hl=en-US&gl=US&ceid=US:en";

  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
  });
  if (!r.ok) throw new Error(`news ${r.status}`);
  const xml = await r.text();

  const out: WatchedEvent[] = [];
  for (const block of xml.split("<item>").slice(1)) {
    const title = decode(stripTags((block.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? ""));
    if (!title || NOISE.test(title)) continue;

    const link = stripTags((block.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? "");
    const pub = stripTags((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? [])[1] ?? "");
    const src = decode(stripTags((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) ?? [])[1] ?? ""));

    const when = Date.parse(pub);
    // Belt and braces on top of `when:` — the feed occasionally carries an
    // older item, and an alert about yesterday is noise.
    if (!Number.isFinite(when) || Date.now() - when > 12 * 3_600_000) continue;

    const { severity, goldBias, matched } = score(title, f.category);
    out.push({
      id: idOf(title),
      title,
      source: src || "Google News",
      link,
      publishedAt: new Date(when).toISOString(),
      category: f.category,
      severity,
      goldBias,
      matched,
    });
  }
  return out;
}

// Words that carry no meaning for telling two stories apart.
const STOP = new Set([
  "the","a","an","of","in","on","to","for","and","or","as","at","by","with",
  "from","is","are","was","were","be","its","his","her","their","after","over",
  "amid","says","say","said","new","latest","live","news","report","reports",
  "us","u","update",
]);

function keywords(title: string): Set<string> {
  return new Set(
    title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/**
 * One story, many outlets. "Israel on highest alert as US strike on Iran looms"
 * and "Israel raises alert as US prepares potential major strike on Iran" are
 * the same event, and exact-title dedup treats them as two — which on a busy
 * news day meant forty-two alerts for perhaps six things happening.
 *
 * Groups by how much significant vocabulary two headlines share, and keeps the
 * highest-scoring one as the representative.
 */
function cluster(events: WatchedEvent[], overlap = 0.5): WatchedEvent[] {
  const kept: { rep: WatchedEvent; words: Set<string> }[] = [];
  for (const e of events) {
    const w = keywords(e.title);
    const hit = kept.find((k) => {
      const shared = [...w].filter((x) => k.words.has(x)).length;
      const smaller = Math.min(w.size, k.words.size) || 1;
      return shared / smaller >= overlap;
    });
    if (!hit) {
      kept.push({ rep: e, words: w });
    } else if (e.severity > hit.rep.severity) {
      hit.rep = e;
    }
  }
  return kept.map((k) => k.rep);
}

/**
 * Everything currently on the radar, most severe first. Never throws: a feed
 * that fails contributes nothing rather than taking the others down.
 */
export async function scanEvents(): Promise<WatchedEvent[]> {
  const batches = await Promise.allSettled(FEEDS.map(fetchFeed));
  const seen = new Map<string, WatchedEvent>();
  for (const b of batches) {
    if (b.status !== "fulfilled") continue;
    for (const e of b.value) {
      // The same story appears under several queries; keep the strongest read.
      const prev = seen.get(e.id);
      if (!prev || e.severity > prev.severity) seen.set(e.id, e);
    }
  }
  const ranked = [...seen.values()].sort((a, b) => b.severity - a.severity);
  // Cluster after ranking, so each story is represented by its strongest headline.
  return cluster(ranked);
}

// ── alert bookkeeping ────────────────────────────────────────────────────────
// Which stories have already been sent. Durable, so a new serverless instance
// does not re-alert the morning's headlines. Keyed by day so the set cannot
// grow without bound.
const SENT_KEY = "gios:event-watch:sent";
const SENT_TTL_SEC = 36 * 3600;

export async function alreadySent(): Promise<Set<string>> {
  const ids = await kvGet<string[]>(SENT_KEY);
  return new Set(ids ?? []);
}

export async function markSent(ids: string[]): Promise<void> {
  const current = await alreadySent();
  for (const id of ids) current.add(id);
  // Cap it: 500 ids is far more than a day produces, and bounds the payload.
  await kvSet(SENT_KEY, [...current].slice(-500), SENT_TTL_SEC);
}

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  conflict: "⚔️ ความขัดแย้ง",
  policy: "🏛 นโยบาย/ทรัมป์",
  centralBank: "🏦 ธนาคารกลาง",
  macro: "📊 มหภาค",
};
