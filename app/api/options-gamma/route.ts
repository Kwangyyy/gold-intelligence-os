import { NextResponse } from "next/server";
import { getGoldSpot } from "@/lib/goldSource";
import { getOptionChain, chooseExpiry, gammaFlipOf, maxPainOf } from "@/lib/optionChain";

export const revalidate = 900; // spot moves; the chain itself is cached in the lib

// Dealer gamma positioning, built from the real CBOE GLD option chain.
//
// This route used to model the chain instead of fetching it: a bell curve around
// spot, a bump for round numbers, then `Math.round(base * (0.85 + Math.random() *
// 0.3))`. Two requests seconds apart returned 463 and 419 contracts of call OI at
// the same strike with the market shut. It is a Pro feature, and /api/oi-levels
// was already pulling the genuine chain a few files away.

interface StrikeLevel {
  strike: number;       // gold-equivalent price
  strikeGld: number;    // the raw GLD strike it came from
  callOI: number;
  putOI: number;
  netGamma: number;     // call gamma − put gamma, OI-weighted
  gammaDollars: number; // $mm per 1% move
  isMaxPain: boolean;
  isMagnet: boolean;
  isWall: boolean;
}

interface OptionsGammaData {
  spotPrice: number;
  maxPain: number;
  maxPainDistance: number;
  netDealerGamma: number;
  gammaFlipLevel: number;
  regime: "long_gamma" | "short_gamma";
  strikes: StrikeLevel[];
  keyStrikes: { strike: number; role: string; note: string }[];
  interpretation: string;
  expiryInfo: string;
  source: string;
  timestamp: string;
}

export async function GET() {
  try {
    const [chain, spot] = await Promise.all([getOptionChain(), getGoldSpot()]);
    const gold = spot.price;
    if (!gold) throw new Error("no gold price");

    // GLD holds roughly a tenth of an ounce per share, less accumulated fee
    // drag, so the ratio is derived live rather than assumed.
    const gld = chain.gldClose;
    const ratio = gld > 0 ? gold / gld : 0;
    if (!ratio) throw new Error("no GLD price to convert strikes");

    // Same expiry rule as oi-levels, from the shared lib, so the two pages
    // cannot describe the same chain differently.
    const chosen = chooseExpiry(chain.rows);
    if (!chosen) throw new Error("no live expiries in the chain");
    const legs = chain.rows.filter((r) => r.expiry === chosen.date);
    if (!legs.length) throw new Error("no contracts for the chosen expiry");

    // Aggregate per strike. Dealers are short what the public is long, so a
    // strike's net gamma is call gamma minus put gamma, weighted by open
    // interest — the same convention oi-levels uses.
    const agg = new Map<number, { calls: number; puts: number; netGamma: number }>();
    for (const l of legs) {
      const a = agg.get(l.strike) ?? { calls: 0, puts: 0, netGamma: 0 };
      if (l.isCall) { a.calls += l.oi; a.netGamma += l.gamma * l.oi; }
      else          { a.puts  += l.oi; a.netGamma -= l.gamma * l.oi; }
      agg.set(l.strike, a);
    }

    const all: StrikeLevel[] = [...agg.entries()]
      .map(([strikeGld, a]) => ({
        strikeGld,
        strike: Math.round(strikeGld * ratio),
        callOI: Math.round(a.calls),
        putOI: Math.round(a.puts),
        netGamma: +a.netGamma.toFixed(1),
        // Γ × OI × 100 × S² × 1%, in $mm — dealer hedging demand per 1% move.
        // Scaled on GLD, not gold: these are GLD contracts, and oi-levels uses
        // the same basis, so the two pages' GEX figures are comparable.
        gammaDollars: +((a.netGamma * 100 * gld * gld * 0.01) / 1e6).toFixed(2),
        isMaxPain: false,
        isMagnet: false,
        isWall: false,
      }))
      .filter((s) => s.callOI + s.putOI > 0)
      .sort((a, b) => a.strike - b.strike);
    if (!all.length) throw new Error("no open interest in the chain");

    // Max pain on the GLD strikes, then converted — the strike grid is GLD's.
    const maxPainGld = maxPainOf(all.map((s) => ({ strike: s.strikeGld, calls: s.callOI, puts: s.putOI })));
    const maxPain = Math.round(maxPainGld * ratio);

    const gammaFlip = gammaFlipOf(
      all.map((s) => ({ strike: s.strike, gex: s.gammaDollars })),
      Math.round(gold),
    );

    // Regime is the sign of total dollar gamma, the same quantity oi-levels
    // reports as totalGex — not raw netGamma, which is on a different scale.
    const totalGex = all.reduce((t, s) => t + s.gammaDollars, 0);
    const regime: OptionsGammaData["regime"] = totalGex >= 0 ? "long_gamma" : "short_gamma";

    // Walls and magnets are judged against this chain's own distribution rather
    // than a fixed contract count, which does not transfer between expiries.
    const totals = all.map((s) => s.callOI + s.putOI).sort((a, b) => b - a);
    const wallCut = totals[Math.floor(totals.length * 0.1)] ?? 0;
    const magnetCut = totals[Math.floor(totals.length * 0.25)] ?? 0;
    for (const s of all) {
      s.isWall = wallCut > 0 && s.callOI + s.putOI >= wallCut;
      s.isMagnet = magnetCut > 0 && s.callOI + s.putOI >= magnetCut;
      s.isMaxPain = s.strike === maxPain;
    }

    // Keep the readable window around spot; the far tail is noise on a chart.
    const nearby = all.filter((s) => Math.abs(s.strike - gold) <= gold * 0.06);
    const strikes = nearby.length >= 8 ? nearby : all;

    const callWall = [...strikes].filter((s) => s.strike > gold).sort((a, b) => b.callOI - a.callOI)[0];
    const putWall  = [...strikes].filter((s) => s.strike < gold).sort((a, b) => b.putOI - a.putOI)[0];

    const keyStrikes: OptionsGammaData["keyStrikes"] = [
      {
        strike: maxPain,
        role: "Max Pain",
        note: `Option writers benefit most if price settles here. ${maxPain > gold ? "Upward" : "Downward"} pull of $${Math.abs(maxPain - gold).toFixed(0)}.`,
      },
      {
        strike: gammaFlip,
        role: "Gamma Flip",
        note: "Above this level dealer hedging is stabilising (long gamma). Below it, moves are amplified.",
      },
      ...(callWall ? [{
        strike: callWall.strike,
        role: "Call Wall",
        note: `Largest call OI above spot (${callWall.callOI.toLocaleString()} contracts) — hedging resistance.`,
      }] : []),
      ...(putWall ? [{
        strike: putWall.strike,
        role: "Put Wall",
        note: `Largest put OI below spot (${putWall.putOI.toLocaleString()} contracts) — hedging support.`,
      }] : []),
    ];

    const { date: expiry, dte } = chosen;
    const data: OptionsGammaData = {
      spotPrice: +gold.toFixed(2),
      maxPain,
      maxPainDistance: +(((maxPain - gold) / gold) * 100).toFixed(2),
      netDealerGamma: +totalGex.toFixed(2),
      gammaFlipLevel: gammaFlip,
      regime,
      strikes,
      keyStrikes,
      interpretation:
        `Dealers are in ${regime === "short_gamma" ? "short" : "long"} gamma territory. ` +
        (regime === "short_gamma"
          ? "Short gamma means dealers buy as price rises and sell as it falls, amplifying moves in both directions — expect higher volatility."
          : "Long gamma means dealers buy dips and sell rallies, damping volatility.") +
        ` Max pain sits at $${maxPain.toLocaleString()}, ${Math.abs(maxPain - gold).toFixed(0)} away from spot.`,
      expiryInfo: `GLD options expiring ${expiry} (${dte} days out), the nearest expiry at least 3 days from now.`,
      source: "CBOE delayed GLD option chain · strikes converted to gold-equivalent at the live gold/GLD ratio. A liquid proxy for COMEX OG, not the OG chain itself.",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(data);
  } catch (e) {
    // No invented chain. If CBOE is unreachable the page says so.
    return NextResponse.json(
      { error: `Option chain unavailable: ${String(e)}` },
      { status: 503 },
    );
  }
}
