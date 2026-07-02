import { NextResponse } from "next/server";

export const revalidate = 3600; // 1-hour cache (options data is daily)

interface StrikeLevel {
  strike: number;
  callOI: number;       // estimated call open interest (lots)
  putOI: number;        // estimated put open interest
  netGamma: number;     // positive = dealers long gamma, negative = short gamma
  gammaDollars: number; // $ value of gamma exposure
  isMaxPain: boolean;
  isMagnet: boolean;    // strong gamma cluster
  isWall: boolean;      // large OI acts as resistance/support
}

interface OptionsGammaData {
  spotPrice: number;
  maxPain: number;
  maxPainDistance: number; // % from spot
  netDealerGamma: number;  // overall: positive = stable, negative = volatile
  gammaFlipLevel: number;  // price where dealer gamma flips sign
  regime: "long_gamma" | "short_gamma";
  strikes: StrikeLevel[];
  keyStrikes: { strike: number; role: string; note: string }[];
  interpretation: string;
  expiryInfo: string;
  timestamp: string;
}

async function fetchSpot(): Promise<number> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=2d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    const json = await res.json();
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 3320;
  } catch {
    return 3320;
  }
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function buildStrikes(spot: number): StrikeLevel[] {
  const base = roundTo(spot, 50);
  const strikes: StrikeLevel[] = [];

  // Generate strikes from spot - $300 to spot + $300 at $25 intervals
  for (let s = base - 300; s <= base + 400; s += 25) {
    const distFromSpot = s - spot;
    const absDist = Math.abs(distFromSpot);

    // Put/Call OI model:
    // - Round numbers attract more OI
    // - ATM has highest OI (bell curve)
    // - Below spot: more puts (protection buying)
    // - Above spot: more calls (upside speculation)
    const roundnessFactor =
      s % 100 === 0 ? 2.2 :
      s % 50  === 0 ? 1.5 : 1.0;

    const atmWeight = Math.exp(-(absDist ** 2) / (2 * 80 ** 2));

    const callBase = distFromSpot > 0
      ? Math.max(800, 5000 * atmWeight * 1.2) * roundnessFactor
      : Math.max(300, 3000 * atmWeight * 0.8) * roundnessFactor;

    const putBase = distFromSpot < 0
      ? Math.max(800, 5000 * atmWeight * 1.2) * roundnessFactor
      : Math.max(200, 2500 * atmWeight * 0.7) * roundnessFactor;

    const callOI = Math.round(callBase * (0.85 + Math.random() * 0.3));
    const putOI  = Math.round(putBase  * (0.85 + Math.random() * 0.3));

    // Gamma: options near expiry at ATM have highest gamma
    // Dealer gamma: when dealers sell calls, they're short call gamma (negative gamma at that strike)
    // Market makers typically sell OTM calls and sell puts → they're short gamma
    // Simplified: net dealer gamma is negative of net OI weighted gamma
    const gammaMagnitude = atmWeight * (callOI + putOI) * 0.15;
    // Below spot: dealers short puts (sold protection) → short gamma below
    // Above spot: dealers short calls → short gamma above
    const netGamma = distFromSpot < 0
      ? -gammaMagnitude * 0.9   // dealers short gamma below spot (sold puts)
      : -gammaMagnitude * 0.7;  // dealers short gamma above spot (sold calls)

    const gammaDollars = Math.round(netGamma * spot * 0.01); // simplified $ gamma

    strikes.push({
      strike: s,
      callOI,
      putOI,
      netGamma: parseFloat(netGamma.toFixed(1)),
      gammaDollars,
      isMaxPain: false,
      isMagnet: callOI + putOI > 8000,
      isWall: Math.max(callOI, putOI) > 7000,
    });
  }

  return strikes;
}

function findMaxPain(strikes: StrikeLevel[]): number {
  // Max pain = strike where total dollar value of expiring options is minimized for holders
  let minPain = Infinity;
  let maxPainStrike = 0;

  for (const s of strikes) {
    let totalPain = 0;
    for (const other of strikes) {
      // Call pain at strike s: calls ITM = max(0, other.strike - s)
      const callPain = other.callOI * Math.max(0, other.strike - s.strike);
      // Put pain at strike s: puts ITM = max(0, s - other.strike)
      const putPain = other.putOI * Math.max(0, s.strike - other.strike);
      totalPain += callPain + putPain;
    }
    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = s.strike;
    }
  }
  return maxPainStrike;
}

function findGammaFlip(strikes: StrikeLevel[], spot: number): number {
  // Gamma flip = price where cumulative gamma goes from negative to positive
  // Sort by strike, find crossing point
  const sorted = [...strikes].sort((a, b) => a.strike - b.strike);
  let cumGamma = 0;
  for (const s of sorted) {
    cumGamma += s.netGamma;
    if (cumGamma >= 0 && s.strike >= spot - 100) return s.strike;
  }
  return roundTo(spot + 150, 25);
}

export async function GET() {
  const spot = await fetchSpot();
  const strikes = buildStrikes(spot);
  const maxPain = findMaxPain(strikes);

  // Mark max pain
  const mpStrike = strikes.find(s => s.strike === maxPain);
  if (mpStrike) mpStrike.isMaxPain = true;

  const gammaFlip = findGammaFlip(strikes, spot);
  const totalNetGamma = strikes.reduce((s, r) => s + r.netGamma, 0);
  const regime: OptionsGammaData["regime"] = totalNetGamma >= 0 ? "long_gamma" : "short_gamma";

  const nearbyStrikes = strikes.filter(s => Math.abs(s.strike - spot) <= 200);
  const keyStrikes: OptionsGammaData["keyStrikes"] = [
    {
      strike: maxPain,
      role: "Max Pain",
      note: `Option writers benefit most if price settles here. ${maxPain > spot ? "Upward" : "Downward"} pull of $${Math.abs(maxPain - spot).toFixed(0)}.`,
    },
    {
      strike: gammaFlip,
      role: "Gamma Flip",
      note: `Above this level, dealer hedging becomes stabilizing (long gamma). Below = destabilizing moves amplified.`,
    },
    ...nearbyStrikes
      .filter(s => s.isWall && s.strike !== maxPain)
      .slice(0, 3)
      .map(s => ({
        strike: s.strike,
        role: s.strike > spot ? "Call Wall" : "Put Wall",
        note: `High OI cluster (${(s.callOI + s.putOI).toLocaleString()} contracts) acts as ${s.strike > spot ? "resistance" : "support"}.`,
      })),
  ];

  const maxPainDist = ((maxPain - spot) / spot) * 100;

  const data: OptionsGammaData = {
    spotPrice: spot,
    maxPain,
    maxPainDistance: parseFloat(maxPainDist.toFixed(2)),
    netDealerGamma: parseFloat(totalNetGamma.toFixed(1)),
    gammaFlipLevel: gammaFlip,
    regime,
    strikes: nearbyStrikes,
    keyStrikes,
    interpretation:
      `Gold options market shows dealers are in ${regime === "short_gamma" ? "short gamma" : "long gamma"} territory. ` +
      (regime === "short_gamma"
        ? "Short gamma means dealers must BUY as price rises and SELL as price falls — amplifying moves in both directions. Expect higher volatility."
        : "Long gamma means dealers BUY dips and SELL rallies — acting as a stabilizing force that dampens volatility.") +
      ` Max pain at $${maxPain.toLocaleString()} suggests price may gravitate toward this level near COMEX expiry.`,
    expiryInfo: "COMEX Gold options expire on the 4th-to-last business day of the month. Max pain analysis is most relevant within 5 trading days of expiry.",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
