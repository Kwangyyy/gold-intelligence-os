// Candle source for the gold charts.
//
// Why not Yahoo GC=F any more: it is COMEX *futures*, and Yahoo reports it about
// ten minutes late (measured 603s and 611s). Futures also carry a basis over
// spot — roughly $47 while this was written — so the chart sat both stale and
// about one percent above the spot price the user actually trades. Against a
// TradingView OANDA:XAUUSD chart that reads as simply wrong.
//
// Binance PAXG/USDT instead: PAXG is a token redeemable 1:1 for a troy ounce of
// LBMA gold, so it tracks spot closely — $1.76 from the OANDA spot print when
// compared side by side — and Binance serves it in real time (13s old), free,
// with native 1m…1M intervals so nothing has to be aggregated.
//
// Trade-off, stated plainly: PAXG is a token, not spot XAU. It can sit at a
// small premium or discount, and it trades through weekends when the gold market
// is shut, so weekend bars exist that a broker chart will not show. History only
// goes back to the token's 2019 launch, which shortens the weekly and monthly
// views. Yahoo remains the fallback when Binance is unreachable.

export type GoldTF = "1m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "1d" | "1w" | "1M";

export interface Candles {
  t: number[];  // unix seconds
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  source: "paxg" | "yahoo";
  delaySec: number;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

// api.binance.com answers 451 to US datacenter IPs, so on Vercel it silently
// failed and everything fell back to delayed Yahoo futures — the deploy behaved
// differently from local for purely geographic reasons. data-api.binance.vision
// is Binance's public market-data domain and is not geo-restricted, so it leads.
const BINANCE_HOSTS = [
  "data-api.binance.vision",
  "api-gcp.binance.com",
  "api.binance.com",
];

async function binanceJson(path: string): Promise<unknown> {
  let lastErr: unknown = new Error("no host tried");
  for (const host of BINANCE_HOSTS) {
    try {
      const r = await fetch(`https://${host}${path}`, {
        headers: { "User-Agent": UA },
        cache: "no-store",
        signal: AbortSignal.timeout(9_000),
      });
      if (!r.ok) { lastErr = new Error(`${host} ${r.status}`); continue; }
      return await r.json();
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// Binance has a native interval for every timeframe we offer.
const BINANCE_IV: Record<GoldTF, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h",
  "2h": "2h", "4h": "4h", "1d": "1d", "1w": "1w", "1M": "1M",
};

// Yahoo fallback: no native 2h/4h, so those are folded from 60m bars.
const YAHOO_CFG: Record<GoldTF, { range: string; interval: string; aggregate: number }> = {
  "1m": { range: "5d",  interval: "1m",  aggregate: 1 },
  "5m": { range: "1mo", interval: "5m",  aggregate: 1 },
  "15m":{ range: "1mo", interval: "15m", aggregate: 1 },
  "30m":{ range: "1mo", interval: "30m", aggregate: 1 },
  "1h": { range: "6mo", interval: "60m", aggregate: 1 },
  "2h": { range: "1y",  interval: "60m", aggregate: 2 },
  "4h": { range: "2y",  interval: "60m", aggregate: 4 },
  "1d": { range: "5y",  interval: "1d",  aggregate: 1 },
  "1w": { range: "10y", interval: "1wk", aggregate: 1 },
  "1M": { range: "max", interval: "1mo", aggregate: 1 },
};

async function fromBinance(tf: GoldTF, limit: number): Promise<Candles> {
  const rows = (await binanceJson(
    `/api/v3/klines?symbol=PAXGUSDT&interval=${BINANCE_IV[tf]}&limit=${Math.min(limit, 1000)}`,
  )) as (string | number)[][];
  if (!Array.isArray(rows) || !rows.length) throw new Error("Binance: empty");

  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = [];
  for (const k of rows) {
    t.push(Math.floor(Number(k[0]) / 1000));
    o.push(Number(k[1])); h.push(Number(k[2])); l.push(Number(k[3])); c.push(Number(k[4]));
    v.push(Number(k[5]));
  }
  return { t, o, h, l, c, v, source: "paxg", delaySec: Math.max(0, Math.floor(Date.now() / 1000) - t[t.length - 1]) };
}

function aggregate(src: Omit<Candles, "source" | "delaySec">, n: number) {
  if (n <= 1) return src;
  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = [];
  for (let i = 0; i < src.c.length; i += n) {
    const hs = src.h.slice(i, i + n), ls = src.l.slice(i, i + n), cs = src.c.slice(i, i + n), vs = src.v.slice(i, i + n);
    if (!cs.length) break;
    t.push(src.t[i]); o.push(src.o[i]);
    h.push(Math.max(...hs)); l.push(Math.min(...ls));
    c.push(cs[cs.length - 1]); v.push(vs.reduce((a, b) => a + b, 0));
  }
  return { t, o, h, l, c, v };
}

async function fromYahoo(tf: GoldTF): Promise<Candles> {
  const cfg = YAHOO_CFG[tf];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=${cfg.range}&interval=${cfg.interval}`;
  const r = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  const q = res?.indicators?.quote?.[0];
  const rawT: number[] = res?.timestamp ?? [];
  if (!rawT.length) throw new Error("Yahoo: empty");

  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = [];
  for (let i = 0; i < rawT.length; i++) {
    if (q?.open?.[i] == null || q?.close?.[i] == null || q?.high?.[i] == null || q?.low?.[i] == null) continue;
    t.push(rawT[i]); o.push(q.open[i]); h.push(q.high[i]); l.push(q.low[i]); c.push(q.close[i]);
    v.push(q.volume?.[i] ?? 0);
  }
  const agg = aggregate({ t, o, h, l, c, v }, cfg.aggregate);
  const last = agg.t[agg.t.length - 1] ?? 0;
  return { ...agg, source: "yahoo", delaySec: Math.max(0, Math.floor(Date.now() / 1000) - last) };
}

// PAXG trades 24/7, so roughly 29% of its bars fall on a weekend when the gold
// market is shut — measured on 1000 hourly bars: 288 weekend bars, averaging a
// 0.078% range on a fifth of the weekday volume. Keeping them means the chart
// shows bars a broker never printed, never gaps on Monday, and lets thin
// weekend ticks shape the wave count. Dropped by default for that reason.
//
// XAUUSD week: closes Friday 21:00 UTC, reopens Sunday 22:00 UTC.
function isMarketOpen(tsSec: number): boolean {
  const d = new Date(tsSec * 1000);
  const day = d.getUTCDay();     // 0 = Sunday … 6 = Saturday
  const hour = d.getUTCHours();
  if (day === 6) return false;             // Saturday — shut all day
  if (day === 0) return hour >= 22;        // Sunday — reopens 22:00
  if (day === 5) return hour < 21;         // Friday — shuts 21:00
  return true;
}

function dropWeekend(c: Candles): Candles {
  const keep: number[] = [];
  for (let i = 0; i < c.t.length; i++) if (isMarketOpen(c.t[i])) keep.push(i);
  if (keep.length === c.t.length) return c;
  const pick = <T,>(a: T[]) => keep.map((i) => a[i]);
  return { ...c, t: pick(c.t), o: pick(c.o), h: pick(c.h), l: pick(c.l), c: pick(c.c), v: pick(c.v) };
}

/**
 * Candles for a timeframe, real-time when Binance is reachable.
 * `includeWeekend` keeps the 24/7 bars; the default matches broker hours.
 */
export async function getGoldCandles(tf: GoldTF, limit = 1000, includeWeekend = false): Promise<Candles> {
  let out: Candles;
  try {
    // Weekend bars are a chunk of the window, so ask for the maximum and trim
    // afterwards rather than coming up short once they are removed.
    out = await fromBinance(tf, includeWeekend ? limit : 1000);
  } catch {
    out = await fromYahoo(tf);
  }
  // Daily needs the cut too — PAXG prints Saturday and Sunday daily bars
  // (measured: 56 of 200). Weekly is safe, every bar opens on a Monday. Monthly
  // must be left alone: its bar opens on the 1st, and whenever the 1st lands on
  // a weekend the filter would delete an entire legitimate month.
  const filterable = tf !== "1w" && tf !== "1M";
  return includeWeekend || !filterable ? out : dropWeekend(out);
}

// ── Yahoo-shaped adapter ─────────────────────────────────────────────────────
// Around a hundred routes were written against Yahoo's chart JSON. Rather than
// rewrite each one's parsing (and risk breaking analytics that already work),
// this returns the identical shape built from the spot feed, so a route only has
// to swap its fetch line and everything downstream keeps working.

const TF_FOR_INTERVAL: Record<string, GoldTF> = {
  "1m": "1m", "2m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
  "60m": "1h", "1h": "1h", "90m": "1h", "2h": "2h", "4h": "4h",
  "1d": "1d", "5d": "1d", "1wk": "1w", "1mo": "1M", "3mo": "1M",
};

// Roughly how many bars a Yahoo range implies, so callers that slice by count
// still see a comparable window.
const BARS_FOR_RANGE: Record<string, number> = {
  "1d": 24, "5d": 120, "1mo": 300, "3mo": 500, "6mo": 700,
  "1y": 800, "2y": 900, "5y": 1000, "10y": 1000, ytd: 800, max: 1000,
};

const TF_MINUTES: Record<GoldTF, number> = {
  "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60,
  "2h": 120, "4h": 240, "1d": 1440, "1w": 10080, "1M": 43200,
};

// Callers pass range tokens Yahoo never accepted ("2mo", "60d"). Rather than
// silently handing all of them the same default, derive the bar count from the
// span the token names and the timeframe's bar length.
function barsForRange(range: string, tf: GoldTF): number {
  const known = BARS_FOR_RANGE[range];
  if (known) return known;
  const m = /^(\d+)(d|wk|mo|y)$/.exec(range);
  if (!m) return 500;
  const days = Number(m[1]) * ({ d: 1, wk: 7, mo: 30, y: 365 }[m[2] as "d" | "wk" | "mo" | "y"]);
  return Math.min(1000, Math.max(30, Math.ceil((days * 1440) / TF_MINUTES[tf])));
}

export interface YahooShapedChart {
  chart: {
    result: [{
      meta: {
        symbol: string; currency: string;
        regularMarketPrice: number; chartPreviousClose: number; previousClose: number;
        regularMarketDayHigh: number; regularMarketDayLow: number; regularMarketTime: number;
        regularMarketVolume?: number;
      };
      timestamp: number[];
      indicators: { quote: [{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }] };
    }];
  };
}

/** Yahoo-chart-shaped gold data, sourced from the real-time spot feed. */
export async function goldChartJson(range = "1mo", interval = "1d"): Promise<YahooShapedChart> {
  const tf = TF_FOR_INTERVAL[interval] ?? "1d";
  const want = barsForRange(range, tf);
  const c = await getGoldCandles(tf, Math.min(want, 1000));
  const start = Math.max(0, c.c.length - want);
  const t = c.t.slice(start), o = c.o.slice(start), h = c.h.slice(start),
        l = c.l.slice(start), cl = c.c.slice(start), v = c.v.slice(start);

  let price = cl[cl.length - 1] ?? 0;
  try {
    const spot = await getGoldSpot();
    if (spot.price > 0) price = spot.price;
  } catch { /* last close stands in */ }

  return {
    chart: {
      result: [{
        meta: {
          symbol: "XAUUSD", currency: "USD",
          regularMarketPrice: price,
          chartPreviousClose: cl[cl.length - 2] ?? price,
          previousClose: cl[cl.length - 2] ?? price,
          regularMarketDayHigh: Math.max(h[h.length - 1] ?? price, price),
          regularMarketDayLow: Math.min(l[l.length - 1] ?? price, price),
          regularMarketTime: t[t.length - 1] ?? Math.floor(Date.now() / 1000),
        },
        timestamp: t,
        indicators: { quote: [{ open: o, high: h, low: l, close: cl, volume: v }] },
      }],
    },
  };
}

/**
 * Drop-in replacement for `fetch(<Yahoo GC=F chart url>)`.
 *
 * Dozens of routes fetch the gold chart in their own shape — inside a
 * `Promise.all`, through a timeout wrapper, guarded by `res.ok`, reading
 * `res.status` in the error message. Swapping the fetch call alone leaves all
 * of that untouched, so the migration off delayed futures cannot disturb
 * control flow it does not understand. Returns a real Response, so `.ok`,
 * `.status`, and `.json()` all behave.
 */
export async function goldFetch(url: string): Promise<Response> {
  let range = "1mo", interval = "1d";
  try {
    const q = new URL(url).searchParams;
    range = q.get("range") ?? range;
    interval = q.get("interval") ?? interval;
  } catch { /* keep the defaults */ }
  const json = await goldChartJson(range, interval);
  return new Response(JSON.stringify(json), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// Gold tickers that appear in the app's symbol tables. Anything else is a
// genuinely different instrument and still belongs to Yahoo.
const GOLD_TICKERS = new Set(["GC=F", "GC%3DF", "XAUUSD", "XAUUSD=X", "XAU=", "GOLD"]);

/**
 * Yahoo-chart-shaped data for any ticker, with gold transparently served from
 * the real-time spot feed. Multi-asset routes that loop over a symbol table can
 * call this instead of fetching Yahoo directly and gold stops being the one
 * quote on the page that is ten minutes late and $60 too high.
 */
export async function yahooChartJson(
  ticker: string,
  range = "1mo",
  interval = "1d",
): Promise<YahooShapedChart | null> {
  if (GOLD_TICKERS.has(ticker.toUpperCase())) return goldChartJson(range, interval);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) return null;
  return (await r.json()) as YahooShapedChart;
}

/** Latest spot-equivalent gold price, real-time. */
export async function getGoldSpot(): Promise<{ price: number; source: "paxg" | "yahoo"; delaySec: number }> {
  try {
    const j = (await binanceJson("/api/v3/ticker/price?symbol=PAXGUSDT")) as { price?: string };
    const price = Number(j?.price);
    if (!price) throw new Error("no price");
    return { price, source: "paxg", delaySec: 0 };
  } catch {
    const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1m&range=1d", {
      headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    const j = await r.json();
    const m = j?.chart?.result?.[0]?.meta;
    const now = Math.floor(Date.now() / 1000);
    return {
      price: Number(m?.regularMarketPrice ?? 0),
      source: "yahoo",
      delaySec: m?.regularMarketTime ? Math.max(0, now - Number(m.regularMarketTime)) : 0,
    };
  }
}
