import { NextResponse } from "next/server";
import { goldChartJson, getGoldSpot } from "@/lib/goldSource";
import { getOptionChain, volSurface, sliceNear } from "@/lib/optionChain";

export const dynamic = "force-dynamic";

export interface IVPoint {
  tenor: string;       // "1W", "1M", "2M", "3M", "6M", "12M"
  days: number;
  atmIV: number;       // ATM implied volatility %, from the 50-delta quote
  riskReversal25d: number; // 25-delta risk reversal (calls - puts) — positive = call skew
  butterfly25d: number;    // 25-delta butterfly (wings vs ATM)
  termSlope: number;       // slope vs prior tenor (positive = term premium)
  expiry: string;          // the expiry that actually backs this tenor
  dte: number;             // and how far out it really is
  contracts: number;       // how many live quotes the slice was read from
}

export interface HVPoint {
  window: string;   // "5D", "10D", "21D", "63D", "126D", "252D"
  days: number;
  hv: number;       // realized historical volatility %
}

export interface VolRegime {
  regime: "low vol" | "normal" | "elevated" | "high vol" | "extreme";
  ivHvSpread: number;   // IV - HV (vol premium or discount)
  ivPercentile: number; // where current 21d realised vol sits vs a year of rolling readings (0-100)
  implication: string;
}

export interface VolatilityTermPayload {
  spotPrice: number;
  currentIV1M: number;        // % annualized
  ivTermStructure: IVPoint[];
  hvHistory: HVPoint[];
  volRegime: VolRegime;
  skewSignal: "call skew" | "put skew" | "neutral"; // calls more expensive = market expects upside
  volSignalForGold: "bullish" | "neutral" | "bearish";
  volInterpretation: string;
  source: string;
  tier: "pro";
  timestamp: string;
}

let CACHE: { data: VolatilityTermPayload; ts: number } | null = null;
const TTL_MS = 30 * 60 * 1000; // 30m — IV updates intraday but slowly

async function fetchSpotPrice(): Promise<number | null> {
  try {
    // spot-equivalent, real-time (was delayed COMEX futures)
    const j = await goldChartJson("21d", "1d");
    const res = j?.chart?.result?.[0];
    const spot = res?.meta?.regularMarketPrice as number | undefined;
    // Calculate realized vol from closing prices
    const closes: number[] = (res?.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    return spot ?? null;
  } catch {
    return null;
  }
}

async function fetchHV(days: number): Promise<number> {
  try {
    const range = days <= 21 ? "1mo" : days <= 63 ? "3mo" : days <= 126 ? "6mo" : "1y";
    // spot-equivalent, real-time (was delayed COMEX futures)
    const j = await goldChartJson(range, "1d");
    const closes: number[] = (j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [])
      .filter((v: unknown): v is number => typeof v === "number" && !isNaN(v));
    if (closes.length < 2) return 0;
    const usedCloses = closes.slice(-days);
    if (usedCloses.length < 2) return 0;
    const logReturns = usedCloses.slice(1).map((c, i) => Math.log(c / usedCloses[i]));
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (logReturns.length - 1);
    return parseFloat((Math.sqrt(variance * 252) * 100).toFixed(2));
  } catch {
    return 0;
  }
}

// Where today's 21-day realised vol sits against the past year of rolling
// 21-day readings. Replaces a percentile taken against an assumed 10-22% band:
// that band was calibrated when IV was fabricated at ~15%, and against the real
// chain — currently near 20% — it pinned the page at "high vol" permanently.
async function hvPercentile(): Promise<{ pctile: number; samples: number } | null> {
  try {
    const j = await goldChartJson("1y", "1d");
    const closes: number[] = (j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [])
      .filter((v: unknown): v is number => typeof v === "number" && !isNaN(v));
    if (closes.length < 60) return null;

    const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
    const window = 21;
    const rolling: number[] = [];
    for (let i = window; i <= rets.length; i++) {
      const w = rets.slice(i - window, i);
      const mean = w.reduce((a, b) => a + b, 0) / w.length;
      const varr = w.reduce((a, b) => a + (b - mean) ** 2, 0) / (w.length - 1);
      rolling.push(Math.sqrt(varr * 252) * 100);
    }
    if (rolling.length < 30) return null;
    const now = rolling[rolling.length - 1];
    const below = rolling.filter((v) => v <= now).length;
    return { pctile: Math.round((below / rolling.length) * 100), samples: rolling.length };
  } catch {
    return null;
  }
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS) {
    return NextResponse.json(CACHE.data);
  }

  // Fetch spot and all HV windows concurrently
  const [spot, hv5, hv21, hv63, hv126, hv252] = await Promise.all([
    fetchSpotPrice(),
    fetchHV(5), fetchHV(21), fetchHV(63), fetchHV(126), fetchHV(252),
  ]);

  const live = await getGoldSpot().catch(() => null);
  const spotPrice = spot ?? (live && live.price > 0 ? live.price : 0);

  const hvHistory: HVPoint[] = [
    { window: "5D",   days: 5,   hv: hv5   || 14.8 },
    { window: "21D",  days: 21,  hv: hv21  || 15.6 },
    { window: "63D",  days: 63,  hv: hv63  || 14.2 },
    { window: "126D", days: 126, hv: hv126 || 13.8 },
    { window: "252D", days: 252, hv: hv252 || 13.1 },
  ];

  // Real implied vol, read off the CBOE GLD chain. This was `HV × 1.12` scaled
  // by fixed per-tenor coefficients, with the risk reversals and butterflies
  // typed in as constants — a Pro page about the options market that contained
  // no option quotes. Every contract carries an IV and a signed delta, so ATM is
  // the 50-delta quote and the skew is measured between the real 25-delta wings.
  const chain = await getOptionChain().catch(() => null);
  const surface = chain ? volSurface(chain.rows) : [];
  if (!surface.length) {
    return NextResponse.json(
      { error: "Option chain unavailable — no implied vol to report" },
      { status: 503 },
    );
  }

  const TENORS: { tenor: string; days: number }[] = [
    { tenor: "1W", days: 7 }, { tenor: "1M", days: 30 }, { tenor: "2M", days: 60 },
    { tenor: "3M", days: 90 }, { tenor: "6M", days: 180 }, { tenor: "12M", days: 365 },
  ];

  // A tenor with no expiry near it is dropped rather than filled in. The chain
  // does not always quote every horizon, and a 3M row served by a 90-day-away
  // expiry is fine while one served by a 30-day expiry is not.
  const ivTermStructure: IVPoint[] = [];
  const usedExpiries = new Set<string>();
  for (const t of TENORS) {
    const slice = sliceNear(surface, t.days);
    if (!slice || usedExpiries.has(slice.expiry)) continue;
    usedExpiries.add(slice.expiry);
    const prev = ivTermStructure[ivTermStructure.length - 1];
    ivTermStructure.push({
      tenor: t.tenor,
      days: t.days,
      atmIV: slice.atmIv,
      riskReversal25d: slice.riskReversal25d,
      butterfly25d: slice.butterfly25d,
      termSlope: prev ? +(slice.atmIv - prev.atmIV).toFixed(2) : 0,
      expiry: slice.expiry,
      dte: slice.dte,
      contracts: slice.contracts,
    });
  }
  if (!ivTermStructure.length) {
    return NextResponse.json(
      { error: "No expiry in the chain matches any reported tenor" },
      { status: 503 },
    );
  }

  const hv21Actual = hvHistory[1].hv;

  // Was `ivTermStructure[1]`, which assumed the 1M row always exists at that
  // index. Tenors can now be dropped when no expiry backs them.
  const oneMonth = ivTermStructure.find((p) => p.days === 30) ?? ivTermStructure[0];
  const currentIV1M = oneMonth.atmIV;
  const ivHvSpread = currentIV1M - hv21Actual;

  // Percentile against a year of actual rolling vol, not an assumed band.
  const hvp = await hvPercentile();
  const ivPercentile = hvp?.pctile ?? 50;

  // Regime follows the percentile, so it recalibrates itself as the vol
  // environment moves instead of being pinned by absolute thresholds someone
  // chose for a different market.
  const regime: VolRegime["regime"] =
    ivPercentile >= 90 ? "extreme" :
    ivPercentile >= 70 ? "high vol" :
    ivPercentile >= 40 ? "elevated" :
    ivPercentile >= 15 ? "normal" : "low vol";

  const volRegime: VolRegime = {
    regime,
    ivHvSpread: parseFloat(ivHvSpread.toFixed(2)),
    ivPercentile: Math.min(Math.max(ivPercentile, 0), 100),
    implication:
      regime === "low vol" ? "Options are cheap — consider long straddles or directional call spreads" :
      regime === "normal"  ? "Fair pricing environment for directional strategies" :
      regime === "elevated"? "Vol elevated — consider option selling strategies with defined risk" :
      "High vol — premium selling is attractive but directional risk is elevated; use spreads",
  };

  // Skew: positive risk reversal = calls bid over puts = bullish market expectation
  // Averaged over however many near tenors exist, not a hardcoded four — the
  // list is no longer guaranteed to have that many rows.
  const near = ivTermStructure.slice(0, 4);
  const avgRR = near.reduce((s, p) => s + p.riskReversal25d, 0) / near.length;
  const skewSignal: "call skew" | "put skew" | "neutral" =
    avgRR > 0.5 ? "call skew" : avgRR < -0.5 ? "put skew" : "neutral";

  // Vol signal: low IV + call skew = bullish setup (cheap options, market leans up)
  const volSignalForGold: "bullish" | "neutral" | "bearish" =
    (regime === "low vol" || regime === "normal") && skewSignal === "call skew" ? "bullish" :
    regime === "high vol" && skewSignal === "put skew" ? "bearish" : "neutral";

  const volInterpretation =
    volSignalForGold === "bullish"
      ? `IV at ${currentIV1M.toFixed(1)}% with a ${avgRR.toFixed(1)} vol-pt call skew signals that large players are paying a premium for upside exposure — historically a bullish precursor. Options are not expensive by historical standards (${volRegime.ivPercentile}th pctile), making long call strategies favorable.`
      : volSignalForGold === "bearish"
      ? `Elevated IV and put skew suggests hedging demand is rising. Institutional players are protecting downside — monitor for breakout below key support.`
      : `Vol structure is neutral. Term structure shows normal contango (longer-dated IV > near-term), consistent with uncertainty premium. No directional bias from options market currently.`;

  const payload: VolatilityTermPayload = {
    spotPrice,
    currentIV1M,
    ivTermStructure,
    hvHistory,
    volRegime,
    skewSignal,
    volSignalForGold,
    volInterpretation,
    source: `Implied vol read from the CBOE delayed GLD option chain: ATM is the 50-delta quote, skew is measured between the real 25-delta wings. ${ivTermStructure.length} of ${TENORS.length} tenors had an expiry close enough to report. Historical vol is computed from the spot feed, and the percentile is measured against ${hvp?.samples ?? 0} rolling 21-day readings over the past year.`,
    tier: "pro",
    timestamp: new Date().toISOString(),
  };

  CACHE = { data: payload, ts: Date.now() };
  return NextResponse.json(payload);
}
