import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface FearComponent {
  name: string;
  icon: string;
  value: number;
  rawValue: string;
  score: number;       // 0-100 normalized fear score
  signal: "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";
  signalColor: string;
  contribution: number; // weight × score
  weight: number;
  description: string;
  change1D: number;     // change in score vs yesterday
}

export interface FearIndexPayload {
  compositeScore: number;     // 0-100 (100 = extreme fear)
  compositeSignal: "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";
  compositeColor: string;
  compositeLabel: string;
  compositeDescription: string;
  goldImplication: string;
  goldImplicationColor: string;
  components: FearComponent[];
  goldPrice: number;
  goldChange1DPct: number;
  goldBenefiting: boolean;     // is gold going up while fear is elevated?
  historicalContext: string;
  timestamp: string;
}

let CACHE: { data: FearIndexPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

async function fetchPrice(symbol: string, range = "3mo"): Promise<{ price: number; prevClose: number; closes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta ?? {};
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const price: number = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const prevClose: number = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
    return { price, prevClose, closes };
  } catch { return null; }
}

function toSignal(score: number): FearComponent["signal"] {
  if (score >= 80) return "extreme_fear";
  if (score >= 60) return "fear";
  if (score >= 40) return "neutral";
  if (score >= 20) return "greed";
  return "extreme_greed";
}

function signalColor(sig: FearComponent["signal"]): string {
  const c = { extreme_fear: "#f87171", fear: "#fb923c", neutral: "#f5c451", greed: "#86efac", extreme_greed: "#34d399" };
  return c[sig];
}

function signalLabel(sig: FearComponent["signal"]): string {
  const l = { extreme_fear: "Extreme Fear", fear: "Fear", neutral: "Neutral", greed: "Greed", extreme_greed: "Extreme Greed" };
  return l[sig];
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [vixD, goldD, hygD, spxD, xluD, xlfD] = await Promise.all([
      fetchPrice("^VIX", "3mo"),         // CBOE Volatility Index
      fetchPrice("GC=F", "3mo"),          // Gold
      fetchPrice("HYG", "3mo"),           // High-yield bonds (credit risk proxy)
      fetchPrice("^GSPC", "3mo"),         // S&P 500
      fetchPrice("XLU", "3mo"),           // Utilities (defensives)
      fetchPrice("XLF", "3mo"),           // Financials (risk)
    ]);

    const goldPrice = goldD?.price ?? 3350;
    const goldPrev = goldD?.prevClose ?? goldPrice;
    const goldChange1DPct = goldPrev > 0 ? ((goldPrice - goldPrev) / goldPrev) * 100 : 0;

    const vix = vixD?.price ?? 18;
    const vixPrev = vixD?.prevClose ?? vix;

    const hyg = hygD?.price ?? 79;
    const hygPrev = hygD?.prevClose ?? hyg;
    const hygChange = hyg && hygPrev > 0 ? ((hyg - hygPrev) / hygPrev) * 100 : 0;

    const spx = spxD?.price ?? 5500;
    const spxPrev = spxD?.prevClose ?? spx;
    const spxChange1D = spxPrev > 0 ? ((spx - spxPrev) / spxPrev) * 100 : 0;

    const xlu = xluD?.price ?? 70;
    const xlf = xlfD?.price ?? 40;
    const xluPrev = xluD?.prevClose ?? xlu;
    const xlfPrev = xlfD?.prevClose ?? xlf;

    // VIX fear component: normalize 10-80 → 0-100
    const vixScore = clamp(((vix - 10) / (80 - 10)) * 100, 0, 100);
    const vixChange = vixPrev > 0 ? vix - vixPrev : 0;

    // HYG credit fear: HYG falling = credit risk rising = fear. -5% = 100, +5% = 0
    const hygScore = clamp(50 - hygChange * 10, 0, 100);

    // SPX momentum: SPX 20D vs 50D MA (if below 50D → fear)
    const spxCloses = spxD?.closes ?? [spx];
    const spx20 = spxCloses.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, spxCloses.length);
    const spx50 = spxCloses.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, spxCloses.length);
    const spxMomentumScore = spx > spx50 ? clamp(50 - ((spx - spx50) / spx50) * 500, 0, 50) : clamp(50 + ((spx50 - spx) / spx50) * 500, 50, 100);

    // XLU/XLF ratio: defensive vs financial (high ratio = fear)
    const xluXlf = xlf > 0 ? xlu / xlf : 1.75;
    const xluXlfPrev = xlfPrev > 0 ? xluPrev / xlfPrev : xluXlf;
    const xluXlfScore = clamp(50 + ((xluXlf - xluXlfPrev) / xluXlfPrev) * 500, 0, 100);

    // Gold itself: gold rising sharply during down markets = panic bid
    // If gold > 0.5% while SPX < -1%: extreme fear
    const goldFearScore = (goldChange1DPct > 1 && spxChange1D < -1) ? 80
      : goldChange1DPct > 0.5 ? 65
      : goldChange1DPct < -0.5 ? 30
      : 50;

    // SPX 1D intraday: large drop = fear
    const spxDayScore = clamp(50 - spxChange1D * 8, 0, 100);

    const components: FearComponent[] = [
      {
        name: "VIX (Implied Volatility)",
        icon: "🌊",
        value: vix,
        rawValue: vix.toFixed(1),
        score: Math.round(vixScore),
        signal: toSignal(vixScore),
        signalColor: signalColor(toSignal(vixScore)),
        contribution: Math.round(vixScore * 0.3),
        weight: 30,
        description: `VIX at ${vix.toFixed(1)} — ${vix > 30 ? "elevated fear" : vix > 20 ? "moderate concern" : "complacency / low fear"} (historical avg ~20)`,
        change1D: Math.round(vixScore - clamp(((vixPrev - 10) / 70) * 100, 0, 100)),
      },
      {
        name: "HYG (Credit Spread Proxy)",
        icon: "💳",
        value: hygChange,
        rawValue: `${hygChange >= 0 ? "+" : ""}${hygChange.toFixed(2)}%`,
        score: Math.round(hygScore),
        signal: toSignal(hygScore),
        signalColor: signalColor(toSignal(hygScore)),
        contribution: Math.round(hygScore * 0.2),
        weight: 20,
        description: `High-yield ETF ${hygChange >= 0 ? "up" : "down"} ${Math.abs(hygChange).toFixed(2)}% — ${hygScore > 60 ? "credit stress widening" : hygScore < 40 ? "credit benign" : "neutral credit environment"}`,
        change1D: 0,
      },
      {
        name: "S&P 500 Momentum (vs 50D MA)",
        icon: "📉",
        value: spxChange1D,
        rawValue: `${spxChange1D >= 0 ? "+" : ""}${spxChange1D.toFixed(2)}% today`,
        score: Math.round(spxMomentumScore),
        signal: toSignal(spxMomentumScore),
        signalColor: signalColor(toSignal(spxMomentumScore)),
        contribution: Math.round(spxMomentumScore * 0.2),
        weight: 20,
        description: `SPX is ${spx > spx50 ? (spx / spx50 - 1) * 100 >= 5 ? "well above" : "above" : "below"} its 50D MA — ${spx > spx50 ? "bullish momentum, low fear" : "bearish momentum, elevated fear"}`,
        change1D: Math.round(spxDayScore - 50),
      },
      {
        name: "XLU/XLF (Safe Haven vs Risk)",
        icon: "🛡️",
        value: xluXlf,
        rawValue: xluXlf.toFixed(3),
        score: Math.round(xluXlfScore),
        signal: toSignal(xluXlfScore),
        signalColor: signalColor(toSignal(xluXlfScore)),
        contribution: Math.round(xluXlfScore * 0.15),
        weight: 15,
        description: `Utilities/Financials ratio: ${xluXlf.toFixed(3)} — ${xluXlfScore > 60 ? "defensive rotation = risk-off" : xluXlfScore < 40 ? "financial leadership = risk-on" : "balanced sector rotation"}`,
        change1D: 0,
      },
      {
        name: "Gold Safe-Haven Demand",
        icon: "🥇",
        value: goldChange1DPct,
        rawValue: `${goldChange1DPct >= 0 ? "+" : ""}${goldChange1DPct.toFixed(2)}%`,
        score: Math.round(goldFearScore),
        signal: toSignal(goldFearScore),
        signalColor: signalColor(toSignal(goldFearScore)),
        contribution: Math.round(goldFearScore * 0.15),
        weight: 15,
        description: `Gold ${goldChange1DPct >= 0 ? "rising" : "falling"} ${Math.abs(goldChange1DPct).toFixed(2)}% while S&P ${spxChange1D >= 0 ? "gains" : "drops"} ${Math.abs(spxChange1D).toFixed(2)}% — ${goldFearScore > 65 ? "panic bid in gold" : goldFearScore < 35 ? "risk-on selling gold" : "normal market behavior"}`,
        change1D: 0,
      },
    ];

    // Weighted composite
    const compositeScore = Math.round(
      components.reduce((s, c) => s + c.score * (c.weight / 100), 0)
    );

    const compositeSignal = toSignal(compositeScore);
    const compositeColor = signalColor(compositeSignal);
    const compositeLabel = signalLabel(compositeSignal);

    const compositeDescription =
      compositeScore >= 75 ? "Market is in extreme fear — typically a contrarian buy signal for gold. Institutions selling indiscriminately, panic at peaks."
      : compositeScore >= 55 ? "Elevated fear environment — flight-to-safety demand supports gold. Watch for peak fear as a buying opportunity."
      : compositeScore >= 45 ? "Neutral market sentiment — mixed signals, no strong fear or greed driver for gold."
      : compositeScore >= 25 ? "Market complacency / greed — risk assets favored, gold may underperform temporarily."
      : "Extreme greed / euphoria — risk-on environment. Gold typically struggles as capital chases returns elsewhere.";

    const goldImplication = compositeScore >= 60
      ? "Elevated fear supports gold's safe-haven role. Gold historically outperforms during fear spikes."
      : compositeScore >= 45
      ? "Neutral environment — gold driven by technical levels and specific macro data rather than fear/greed."
      : "Low-fear / greed environment. Gold may face near-term headwinds as risk appetite suppresses safe-haven demand.";

    const goldImplicationColor = compositeScore >= 60 ? "#34d399" : compositeScore >= 40 ? "#f5c451" : "#f87171";
    const goldBenefiting = goldChange1DPct > 0.3 && compositeScore >= 55;

    const historicalContext = compositeScore >= 75
      ? "VIX > 30 historically marks capitulation zones — gold has rallied 5-15% in the 30 days following extreme fear readings."
      : compositeScore >= 55
      ? "Moderate fear (VIX 20-30) often precedes short-term gold strength as institutional hedging demand rises."
      : compositeScore >= 40
      ? "Calm markets (VIX < 20) — gold tends to track real rates and DXY rather than fear premium."
      : "Low VIX / greed phase — historically gold has under-performed risk assets but maintains long-run store of value.";

    const payload: FearIndexPayload = {
      compositeScore, compositeSignal, compositeColor, compositeLabel, compositeDescription,
      goldImplication, goldImplicationColor,
      components,
      goldPrice, goldChange1DPct, goldBenefiting,
      historicalContext,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("fear-index error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
