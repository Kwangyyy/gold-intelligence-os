import { NextResponse } from "next/server";
import { getGoldSpot } from "@/lib/goldSource";
import { getOptionChain, dteOf, chooseExpiry, gammaFlipOf, maxPainOf } from "@/lib/optionChain";
import { yahooChartJson } from "@/lib/goldSource";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Option Open-Interest levels + an expected-range (SD) model, in the spirit of
// CME QuikStrike "Vol2Vol / Expected Range".
//
// DATA SOURCE, stated plainly: CME's own QuikStrike tool is behind a login and
// cmegroup.com's CmeWS endpoints answer 403 to server-side callers, so COMEX
// gold-option (OG) strikes are not reachable. We use CBOE's public delayed
// option chain for GLD — the most liquid listed gold proxy — and convert each
// GLD strike into a gold-equivalent price with the live GLD→gold ratio.
// It is a proxy, not COMEX OG, and the UI says so.

export interface OiStrike {
  strikeGld: number;   // raw GLD strike
  strike: number;      // gold-equivalent price
  calls: number;
  puts: number;
  total: number;
  iv: number;
  netGamma: number;    // call gamma − put gamma, OI-weighted (dealer-hedging pressure)
  gex: number;         // dollar gamma exposure, $mm per 1% move (calls +, puts −)
  side: "call" | "put" | "mixed";
  sd: 0 | 1 | 2 | 3;   // which expected-range band the strike sits in
  pctFromSpot: number;
}

export interface OiExpiry {
  date: string;
  dte: number;
  totalOi: number;
}

export interface OiLevelsPayload {
  source: string;
  sourceNote: string;
  sourceNoteTh: string;
  gold: number;        // gold spot (COMEX GC=F)
  gld: number;         // GLD last
  ratio: number;       // gold / gld
  expiry: string;
  dte: number;
  atmIv: number;
  iv30: number;
  expectedRange: {
    sd1: { low: number; high: number };
    sd2: { low: number; high: number };
    sd3: { low: number; high: number };
  };
  strikes: OiStrike[];
  expiries: OiExpiry[];
  callWall: number;    // gold-equivalent price of the largest call-OI strike
  putWall: number;
  maxPain: number;
  totalCallOi: number;
  totalPutOi: number;
  pcRatio: number;
  totalGex: number;      // net dealer gamma, $mm per 1% move
  gammaFlip: number;     // gold price where cumulative net gamma changes sign
  gammaRegime: "long" | "short";
  gexNote: string;
  gexNoteTh: string;
  insight: string;
  insightTh: string;
  asOf: string;
}

// Both legs of the ratio come from the same feed at the same moment. Mixing a
// live gold print with CBOE's *previous* GLD close skewed strikes by ~2%.
async function fetchYahooPrice(symbol: string): Promise<number> {
  try {
    const j = await yahooChartJson(symbol, "2d", "1d");
    return Number(j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0) || 0;
  } catch {
    return 0;
  }
}

export async function GET(req: Request) {
  const wanted = new URL(req.url).searchParams.get("expiry") ?? "";

  try {
    // Gold must be on the SAME basis the chart plots (spot-equivalent), not
    // COMEX futures. Futures carry a basis of roughly $47 over spot, so a
    // futures-derived ratio would place every strike about 1% too high and the
    // OI walls would line up against nothing on a spot-priced chart.
    const [chain, spot, gldLive] = await Promise.all([
      getOptionChain(),
      getGoldSpot(),
      fetchYahooPrice("GLD"),
    ]);
    const goldRaw = spot.price;
    const { rows, iv30, gldClose } = chain;

    // Gold-equivalent conversion. GLD holds ~1/10 oz per share (minus fee drag),
    // so the ratio is derived live rather than hard-coded — and from one feed,
    // so a stale GLD close can't bias every strike upward.
    const gld = gldLive || gldClose;
    const gold = goldRaw || gld * 10.8;
    const ratio = gld > 0 ? gold / gld : 10.8;

    // Expiries with real open interest, nearest first.
    const byExp = new Map<string, number>();
    for (const r of rows) byExp.set(r.expiry, (byExp.get(r.expiry) ?? 0) + r.oi);
    const expiries: OiExpiry[] = [...byExp.entries()]
      .map(([date, totalOi]) => ({ date, dte: dteOf(date), totalOi: Math.round(totalOi) }))
      .filter((e) => e.dte >= 0 && e.totalOi > 0)
      .sort((a, b) => a.dte - b.dte);
    if (!expiries.length) throw new Error("no live expiries");

    // Expiry choice lives in lib/optionChain so options-gamma cannot pick a
    // different one off the same chain and contradict this page.
    const picked = chooseExpiry(rows, wanted);
    if (!picked) throw new Error("no live expiries");
    const chosen = expiries.find((e) => e.date === picked.date) ?? expiries[0];

    const legs = rows.filter((r) => r.expiry === chosen.date);

    // Aggregate per strike.
    const agg = new Map<number, { calls: number; puts: number; iv: number; netGamma: number }>();
    for (const l of legs) {
      const a = agg.get(l.strike) ?? { calls: 0, puts: 0, iv: 0, netGamma: 0 };
      if (l.isCall) { a.calls += l.oi; a.netGamma += l.gamma * l.oi; }
      else          { a.puts  += l.oi; a.netGamma -= l.gamma * l.oi; }
      if (l.iv > 0 && l.oi > 0) a.iv = a.iv ? (a.iv + l.iv) / 2 : l.iv;
      agg.set(l.strike, a);
    }

    // ATM implied vol drives the expected range.
    const atmStrike = [...agg.keys()].reduce(
      (best, k) => (Math.abs(k - gld) < Math.abs(best - gld) ? k : best),
      [...agg.keys()][0],
    );
    const atmIv = agg.get(atmStrike)?.iv || iv30 || 0.2;

    // Lognormal expected range over the remaining life, same construction as
    // an expected-range/Vol2Vol screen: S·exp(±z·σ·√T).
    const T = Math.max(chosen.dte, 1) / 365;
    const band = (z: number) => ({
      low: +(gold * Math.exp(-z * atmIv * Math.sqrt(T))).toFixed(1),
      high: +(gold * Math.exp(z * atmIv * Math.sqrt(T))).toFixed(1),
    });
    const expectedRange = { sd1: band(1), sd2: band(2), sd3: band(3) };
    const sdOf = (goldPrice: number): 0 | 1 | 2 | 3 => {
      if (goldPrice >= expectedRange.sd1.low && goldPrice <= expectedRange.sd1.high) return 1;
      if (goldPrice >= expectedRange.sd2.low && goldPrice <= expectedRange.sd2.high) return 2;
      if (goldPrice >= expectedRange.sd3.low && goldPrice <= expectedRange.sd3.high) return 3;
      return 0;
    };

    // Keep the strikes that matter: inside 3SD, with real OI, biggest first.
    // GEX: dollar gamma per 1% move = Γ × OI × 100 (multiplier) × S² × 0.01, in $mm.
    // Calls count positive and puts negative, i.e. the usual dealer-short-puts view.
    const gexScale = (g: number) => +((g * 100 * gld * gld * 0.01) / 1e6).toFixed(2);
    const all: OiStrike[] = [...agg.entries()]
      .map(([strikeGld, a]) => {
        const strike = +(strikeGld * ratio).toFixed(1);
        const total = a.calls + a.puts;
        return {
          strikeGld,
          strike,
          calls: Math.round(a.calls),
          puts: Math.round(a.puts),
          total: Math.round(total),
          iv: +a.iv.toFixed(4),
          netGamma: +a.netGamma.toFixed(2),
          gex: gexScale(a.netGamma),
          side: (a.calls > a.puts * 1.5 ? "call" : a.puts > a.calls * 1.5 ? "put" : "mixed") as OiStrike["side"],
          sd: sdOf(strike),
          pctFromSpot: +(((strike - gold) / gold) * 100).toFixed(2),
        };
      })
      .filter((s) => s.total > 0);

    // Strikes must be inside the 3SD range AND within a sane distance of spot.
    // The 3SD test alone is not enough: on a longer expiry 3SD reaches ±25%, and
    // strikes that far out are chart clutter rather than levels price can reach.
    const strikes = all
      .filter(
        (s) =>
          s.strike >= expectedRange.sd3.low &&
          s.strike <= expectedRange.sd3.high &&
          Math.abs(s.pctFromSpot) <= 12,
      )
      .sort((a, b) => b.total - a.total)
      .slice(0, 40)
      .sort((a, b) => b.strike - a.strike);

    // Walls are read from strikes inside the expected range. Taken across the
    // whole chain the "wall" landed on a deep-wing strike 12% away, which is
    // not a level price will actually interact with.
    const wallPool = strikes.length ? strikes : all;
    const callWallRow = wallPool.reduce((m, s) => (s.calls > m.calls ? s : m), wallPool[0]);
    const putWallRow = wallPool.reduce((m, s) => (s.puts > m.puts ? s : m), wallPool[0]);

    // Max pain: the strike at which the least intrinsic value is owed to holders.
    const maxPain = maxPainOf([...agg.entries()].map(([strike, a]) => ({ strike, calls: a.calls, puts: a.puts })));

    const totalCallOi = Math.round(all.reduce((s, x) => s + x.calls, 0));
    const totalPutOi = Math.round(all.reduce((s, x) => s + x.puts, 0));
    const pcRatio = totalCallOi > 0 ? +(totalPutOi / totalCallOi).toFixed(2) : 0;

    // Gamma profile. The flip is approximated by walking strikes low→high and
    // finding where the running net gamma changes sign — the standard chart-level
    // approximation, not a full re-pricing of the book at every spot.
    const gexSorted = [...all].sort((a, b) => a.strike - b.strike);
    const totalGex = +gexSorted.reduce((s, x) => s + x.gex, 0).toFixed(2);
    const gammaFlip = gammaFlipOf(gexSorted, gold);
    const gammaRegime: "long" | "short" = totalGex >= 0 ? "long" : "short";

    const cw = +(callWallRow.strike).toFixed(0);
    const pw = +(putWallRow.strike).toFixed(0);
    const mp = +(maxPain * ratio).toFixed(0);

    const data: OiLevelsPayload = {
      source: "CBOE delayed option chain · GLD",
      sourceNote:
        "CME QuikStrike is login-gated and cmegroup.com blocks server-side calls, so this uses CBOE's public GLD chain converted to gold-equivalent prices. A liquid proxy for COMEX OG, not the OG chain itself.",
      sourceNoteTh:
        "CME QuikStrike ต้อง login และ cmegroup.com บล็อกการเรียกจากเซิร์ฟเวอร์ จึงใช้ option chain ของ GLD จาก CBOE (ล่าช้า) แปลงเป็นราคาทองเทียบเท่า — เป็นตัวแทนที่สภาพคล่องสูง ไม่ใช่ COMEX OG โดยตรง",
      gold: +gold.toFixed(2),
      gld: +gld.toFixed(2),
      ratio: +ratio.toFixed(4),
      expiry: chosen.date,
      dte: chosen.dte,
      atmIv: +atmIv.toFixed(4),
      iv30: +iv30.toFixed(4),
      expectedRange,
      strikes,
      expiries: expiries.slice(0, 14),
      callWall: cw,
      putWall: pw,
      maxPain: mp,
      totalCallOi,
      totalPutOi,
      pcRatio,
      totalGex,
      gammaFlip: +gammaFlip.toFixed(0),
      gammaRegime,
      gexNote:
        gammaRegime === "long"
          ? "Net long gamma: dealer hedging sells rallies and buys dips, which tends to compress realised range."
          : "Net short gamma: dealer hedging chases direction, which tends to amplify moves and widen realised range.",
      gexNoteTh:
        gammaRegime === "long"
          ? "Gamma สุทธิเป็นบวก — การ hedge ของ dealer จะขายตอนขึ้น/ซื้อตอนลง มักกดให้ราคาแกว่งในกรอบแคบ"
          : "Gamma สุทธิเป็นลบ — การ hedge ของ dealer จะไล่ตามทิศทาง มักขยายความผันผวนและทำให้ราคาวิ่งแรง",
      insight:
        `Expiry ${chosen.date} (${chosen.dte}d). ATM IV ${(atmIv * 100).toFixed(1)}% ⇒ 1SD $${expectedRange.sd1.low}–$${expectedRange.sd1.high}. ` +
        `Call wall $${cw}, put wall $${pw}, max pain $${mp}. P/C ${pcRatio}.`,
      insightTh:
        `หมดอายุ ${chosen.date} (อีก ${chosen.dte} วัน) · ATM IV ${(atmIv * 100).toFixed(1)}% ⇒ กรอบ 1SD $${expectedRange.sd1.low}–$${expectedRange.sd1.high} · ` +
        `กำแพง Call $${cw} · กำแพง Put $${pw} · Max Pain $${mp} · P/C ${pcRatio}`,
      asOf: new Date().toISOString(),
    };

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
