import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLiveData } from "@/lib/mt5Store";
import { getGoldSpot } from "@/lib/goldSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Freshest available gold price.
//
// Why this exists: Yahoo's COMEX futures feed (GC=F) is delayed about ten
// minutes — measured repeatedly at 600-611s behind wall clock, which is the
// standard delay for unlicensed exchange data. No amount of polling fixes that,
// so the chart looked stale no matter how often it refreshed.
//
// Priority, best first:
//   1. MT5   — the user's own broker feed. Genuinely real-time and, more
//              importantly, the exact price they trade against.
//   2. GLD   — the ETF quotes real-time on Yahoo (measured 0s delay). Converting
//              it with a ratio sampled at MATCHING timestamps gives a live gold
//              estimate. It is an estimate: GLD can drift from spot intraday.
//   3. GC=F  — the delayed futures print. Correct, just old.

export interface GoldLive {
  price: number;
  source: "mt5" | "paxg" | "gld" | "futures";
  sourceLabel: string;
  sourceLabelTh: string;
  delaySec: number;      // how old the underlying print is
  isRealtime: boolean;
  futures: number;       // the delayed GC=F print, for reference
  futuresDelaySec: number;
  gld?: number;
  ratio?: number;
  asOf: string;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

interface Quote { price: number; time: number; ts: number[]; closes: (number | null)[] }

async function yahoo(symbol: string): Promise<Quote | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
      { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(9_000) },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    const m = res?.meta;
    if (!m?.regularMarketPrice) return null;
    return {
      price: Number(m.regularMarketPrice),
      time: Number(m.regularMarketTime ?? 0),
      ts: res?.timestamp ?? [],
      closes: res?.indicators?.quote?.[0]?.close ?? [],
    };
  } catch { return null; }
}

let CACHE: { data: GoldLive; ts: number } | null = null;
const TTL = 4_000;   // the whole point is freshness; just enough to absorb bursts

export async function GET() {
  // MT5 first — but only for a signed-in user with a connected account.
  let mt5Price = 0, mt5Age = 0;
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (email) {
      const live = await getUserLiveData(email);
      const pos = live?.data?.positions?.find(p => /XAU|GOLD/i.test(p.symbol));
      if (pos?.currentPrice && live?.data) {
        mt5Price = pos.currentPrice;
        mt5Age = Math.max(0, Math.round((Date.now() - live.data.lastUpdate) / 1000));
      }
    }
  } catch { /* fall through to the public feeds */ }

  if (CACHE && Date.now() - CACHE.ts < TTL && !mt5Price) {
    return NextResponse.json(CACHE.data, { headers: { "Cache-Control": "no-store" } });
  }

  const [gc, gld] = await Promise.all([yahoo("GC=F"), yahoo("GLD")]);
  const now = Math.floor(Date.now() / 1000);
  const futures = gc?.price ?? 0;
  const futuresDelay = gc?.time ? Math.max(0, now - gc.time) : 0;

  const build = (d: Partial<GoldLive> & Pick<GoldLive, "price" | "source" | "sourceLabel" | "sourceLabelTh" | "delaySec">): GoldLive => ({
    isRealtime: d.delaySec <= 90,
    futures: +futures.toFixed(2),
    futuresDelaySec: futuresDelay,
    asOf: new Date().toISOString(),
    ...d,
    price: +d.price.toFixed(2),
  });

  // 1. broker feed
  if (mt5Price > 0) {
    const data = build({
      price: mt5Price, source: "mt5", delaySec: mt5Age,
      sourceLabel: "MT5 broker feed (real-time)",
      sourceLabelTh: "ฟีดโบรกเกอร์ MT5 ของคุณ (เรียลไทม์)",
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  }

  // 2. PAXG — a token redeemable 1:1 for a troy ounce of LBMA gold, quoted in
  //    real time by Binance and within a couple of dollars of the spot print.
  //    Preferred over the GLD derivation below because it needs no conversion.
  try {
    const p = await getGoldSpot();
    if (p.source === "paxg" && p.price > 0) {
      const data = build({
        price: p.price, source: "paxg", delaySec: p.delaySec,
        sourceLabel: `PAXG/USDT spot-equivalent, real-time (futures feed is ${futuresDelay}s delayed)`,
        sourceLabelTh: `PAXG/USDT เทียบเท่าราคา spot แบบเรียลไทม์ (ฟีด futures หน่วง ${futuresDelay} วิ)`,
      });
      return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    }
  } catch { /* fall through to the GLD derivation */ }

  // 3. GLD-derived. The ratio must come from two prints taken at the SAME moment;
  //    pairing a live GLD against a ten-minute-old future would bake that gap
  //    straight into the ratio and bias the result by roughly the move since.
  if (gld && gc && futuresDelay > 120) {
    let gldAtFuturesTime = 0;
    let best = Infinity;
    for (let i = 0; i < gld.ts.length; i++) {
      const c = gld.closes[i];
      if (c == null) continue;
      const d = Math.abs(gld.ts[i] - gc.time);
      if (d < best) { best = d; gldAtFuturesTime = c; }
    }
    if (gldAtFuturesTime > 0 && best <= 180) {
      const ratio = futures / gldAtFuturesTime;
      const gldAge = gld.time ? Math.max(0, now - gld.time) : 0;
      const data = build({
        price: ratio * gld.price,
        source: "gld", delaySec: gldAge,
        sourceLabel: `Live estimate from GLD × ${ratio.toFixed(4)} (futures feed is ${futuresDelay}s delayed)`,
        sourceLabelTh: `ประมาณจาก GLD × ${ratio.toFixed(4)} แบบเรียลไทม์ (ฟีด futures หน่วง ${futuresDelay} วิ)`,
        gld: +gld.price.toFixed(2),
        ratio: +ratio.toFixed(4),
      });
      CACHE = { data, ts: Date.now() };
      return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    }
  }

  // 3. delayed futures
  const data = build({
    price: futures, source: "futures", delaySec: futuresDelay,
    sourceLabel: `COMEX GC=F (delayed ${futuresDelay}s)`,
    sourceLabelTh: `COMEX GC=F (หน่วง ${futuresDelay} วิ)`,
  });
  CACHE = { data, ts: Date.now() };
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
