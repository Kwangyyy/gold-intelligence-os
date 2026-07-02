import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SignalStrength = "strong_bull" | "bull" | "neutral" | "bear" | "strong_bear";

export interface MacroFactor {
  name: string;
  category: string;
  value: number | string;
  signal: SignalStrength;
  weight: number;        // weight in composite (sum to 100)
  bullScore: number;     // 0-100 for gold
  description: string;
}

export interface MacroCategoryScore {
  category: string;
  icon: string;
  score: number;         // 0-100 gold bull
  signal: SignalStrength;
  factors: MacroFactor[];
}

export interface MacroDashboardPayload {
  goldPrice: number;
  compositeScore: number;   // 0-100
  compositeSignal: SignalStrength;
  compositeColor: string;
  compositeLabel: string;
  categories: MacroCategoryScore[];
  topBullishFactors: string[];
  topBearishFactors: string[];
  macroSummary: string;
  goldOutlook: string;
  timestamp: string;
}

let CACHE: { data: MacroDashboardPayload; ts: number } | null = null;
const TTL = 20 * 60 * 1000; // 20min

async function fetchYahoo(symbol: string, range = "3mo", interval = "1d") {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const price: number = r.meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const prev: number = r.meta?.chartPreviousClose ?? closes[closes.length - 2] ?? price;
    return { price, prev, closes };
  } catch { return null; }
}

function pctChange(a: number, b: number) { return b > 0 ? ((a - b) / b) * 100 : 0; }

function ema(arr: number[], period: number): number {
  const k = 2 / (period + 1);
  let e = arr[0];
  for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}

function scoreToSignal(s: number): SignalStrength {
  if (s >= 70) return "strong_bull";
  if (s >= 55) return "bull";
  if (s >= 45) return "neutral";
  if (s >= 30) return "bear";
  return "strong_bear";
}

function signalColor(s: SignalStrength) {
  return { strong_bull: "#34d399", bull: "#86efac", neutral: "#94a3b8", bear: "#fbbf24", strong_bear: "#f87171" }[s];
}

function signalLabel(s: SignalStrength) {
  return { strong_bull: "Strongly Bullish", bull: "Bullish", neutral: "Neutral", bear: "Bearish", strong_bear: "Strongly Bearish" }[s];
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [gold, dxy, tlt, spy, tip, hyg, vix, oil, btc, usdjpy] = await Promise.all([
      fetchYahoo("GC=F",    "6mo"),
      fetchYahoo("DX-Y.NYB","3mo"),
      fetchYahoo("TLT",     "3mo"),
      fetchYahoo("SPY",     "3mo"),
      fetchYahoo("TIP",     "3mo"),
      fetchYahoo("HYG",     "3mo"),
      fetchYahoo("^VIX",    "1mo"),
      fetchYahoo("CL=F",    "3mo"),
      fetchYahoo("BTC-USD", "3mo"),
      fetchYahoo("JPY=X",   "3mo"),
    ]);

    const goldPrice = gold?.price ?? 3350;
    const goldChange3M = gold ? pctChange(gold.price, gold.closes[0] ?? gold.price) : 0;

    // ── 1. DOLLAR (DXY) — inverse for gold ──
    const dxyChange3M = dxy ? pctChange(dxy.price, dxy.closes[0] ?? dxy.price) : 0;
    const dxyRsi = dxy ? rsi(dxy.closes) : 50;
    const dxyScore = Math.round(Math.max(0, Math.min(100,
      // Falling DXY = bullish gold
      50 - dxyChange3M * 4 + (50 - dxyRsi) * 0.4
    )));

    // ── 2. REAL YIELDS (TIP proxy) ──
    const tipChange3M = tip ? pctChange(tip.price, tip.closes[0] ?? tip.price) : 0;
    // Rising TIP = rising real rates = bearish gold (inverse)
    const realYieldScore = Math.round(Math.max(0, Math.min(100, 50 - tipChange3M * 5)));

    // ── 3. RISK APPETITE (SPY + HYG) ──
    const spyChange1M = spy ? pctChange(spy.price, spy.closes[spy.closes.length - 21] ?? spy.closes[0] ?? spy.price) : 0;
    const hygChange1M = hyg ? pctChange(hyg.price, hyg.closes[hyg.closes.length - 21] ?? hyg.closes[0] ?? hyg.price) : 0;
    // Strong equities usually bearish gold (risk-on), but sometimes decoupled
    const riskScore = Math.round(Math.max(0, Math.min(100,
      50 - spyChange1M * 2 - hygChange1M * 1.5
    )));

    // ── 4. FEAR / VIX ──
    const vixLevel = vix?.price ?? 20;
    const vixChange1M = vix ? pctChange(vix.price, vix.closes[0] ?? vix.price) : 0;
    // High VIX = safe-haven demand for gold
    const fearScore = Math.round(Math.max(0, Math.min(100,
      30 + (vixLevel / 50) * 40 + Math.max(0, vixChange1M) * 0.5
    )));

    // ── 5. INFLATION (TIP vs TLT spread as real-rate proxy) ──
    const tltChange3M = tlt ? pctChange(tlt.price, tlt.closes[0] ?? tlt.price) : 0;
    // Falling bonds (rising nominal yields) + rising TIP = rising real rates = bearish
    // Falling bonds + falling TIP = inflation rising (but real rates too) = mixed
    const inflationScore = Math.round(Math.max(0, Math.min(100,
      50 + tipChange3M * 3 - tltChange3M * 2
    )));

    // ── 6. MOMENTUM (Gold's own technicals) ──
    const goldRsi = gold ? rsi(gold.closes) : 50;
    const goldEma20 = gold ? ema(gold.closes.slice(-20), 20) : goldPrice;
    const goldEma50 = gold ? ema(gold.closes.slice(-50), 50) : goldPrice;
    const aboveEmas = goldPrice > goldEma20 && goldPrice > goldEma50 ? 1 : goldPrice > goldEma20 || goldPrice > goldEma50 ? 0 : -1;
    const momentumScore = Math.round(Math.max(0, Math.min(100,
      goldRsi * 0.5 + 25 + aboveEmas * 12
    )));

    // ── 7. CRYPTO CORRELATION (BTC safe-haven contest) ──
    const btcChange1M = btc ? pctChange(btc.price, btc.closes[btc.closes.length - 21] ?? btc.closes[0] ?? btc.price) : 0;
    // Strong BTC often competes with gold for safe-haven flows
    const cryptoScore = Math.round(Math.max(0, Math.min(100, 50 - btcChange1M * 0.8)));

    // ── 8. GEOPOLITICAL / YEN (JPY safe-haven) ──
    const jpyChange = usdjpy ? pctChange(usdjpy.price, usdjpy.closes[0] ?? usdjpy.price) : 0;
    // Falling USDJPY = strengthening yen = safe-haven demand = bullish gold
    const geoScore = Math.round(Math.max(0, Math.min(100, 50 - jpyChange * 3)));

    // ── 9. OIL / COMMODITY TREND ──
    const oilChange3M = oil ? pctChange(oil.price, oil.closes[0] ?? oil.price) : 0;
    // Rising oil = inflation fears = bullish gold
    const commodityScore = Math.round(Math.max(0, Math.min(100, 50 + oilChange3M * 1.5)));

    // ── 10. BOND MARKET (TLT level vs MA as rate direction) ──
    const tltEma50 = tlt ? ema(tlt.closes.slice(-50), 50) : 100;
    const tltAboveMa = tlt && tlt.price > tltEma50;
    // TLT above MA = yields falling = supportive for gold
    const bondScore = Math.round(Math.max(0, Math.min(100, tltAboveMa ? 65 - tltChange3M * 2 : 40 - tltChange3M * 2)));

    // ── Build Factors ──
    const factors: MacroFactor[] = [
      {
        name: "US Dollar Index (DXY)", category: "Currency", value: `${(dxy?.price ?? 104).toFixed(1)} (${dxyChange3M >= 0 ? "+" : ""}${dxyChange3M.toFixed(1)}% 3M)`,
        signal: scoreToSignal(dxyScore), weight: 15, bullScore: dxyScore,
        description: dxyChange3M < -2 ? "Dollar weakening — direct tailwind for gold" : dxyChange3M > 2 ? "Dollar strengthening — headwind for gold" : "Dollar range-bound — neutral gold impact",
      },
      {
        name: "Real Yields (TIP proxy)", category: "Rates", value: `TIP ${(tip?.price ?? 110).toFixed(1)} (${tipChange3M >= 0 ? "+" : ""}${tipChange3M.toFixed(1)}% 3M)`,
        signal: scoreToSignal(realYieldScore), weight: 15, bullScore: realYieldScore,
        description: tipChange3M < -2 ? "Real yields falling — most bullish macro input for gold" : tipChange3M > 2 ? "Real yields rising — primary headwind for gold" : "Real yields stable — neutral for gold",
      },
      {
        name: "Inflation Expectations", category: "Inflation", value: `TIP/TLT spread proxy (${inflationScore}/100)`,
        signal: scoreToSignal(inflationScore), weight: 12, bullScore: inflationScore,
        description: inflationScore > 60 ? "Inflation signals elevated — gold benefits as inflation hedge" : inflationScore < 40 ? "Inflation expectations subdued — reduces gold hedge demand" : "Inflation outlook mixed",
      },
      {
        name: "Risk Appetite (SPY+HYG)", category: "Risk", value: `SPY ${spyChange1M >= 0 ? "+" : ""}${spyChange1M.toFixed(1)}% / HYG ${hygChange1M >= 0 ? "+" : ""}${hygChange1M.toFixed(1)}% 1M`,
        signal: scoreToSignal(riskScore), weight: 12, bullScore: riskScore,
        description: spyChange1M > 5 ? "Strong equity rally — risk-on, gold demand may soften" : spyChange1M < -5 ? "Equity selloff — flight to gold safety likely" : "Equities mixed — selective gold support",
      },
      {
        name: "Fear Gauge (VIX)", category: "Risk", value: `${vixLevel.toFixed(1)} (${vixChange1M >= 0 ? "+" : ""}${vixChange1M.toFixed(1)}% 1M)`,
        signal: scoreToSignal(fearScore), weight: 10, bullScore: fearScore,
        description: vixLevel > 30 ? "Extreme fear — strong safe-haven buying expected" : vixLevel > 20 ? "Elevated fear — moderate gold demand" : "VIX low — complacency, gold less sought as hedge",
      },
      {
        name: "Gold Momentum (RSI/EMA)", category: "Momentum", value: `RSI(14) ${goldRsi.toFixed(0)}, ${aboveEmas === 1 ? "above" : aboveEmas === -1 ? "below" : "mixed"} EMA20/50`,
        signal: scoreToSignal(momentumScore), weight: 10, bullScore: momentumScore,
        description: aboveEmas === 1 && goldRsi > 50 ? "Gold in uptrend with strong momentum" : aboveEmas === -1 ? "Gold below key EMAs — downtrend caution" : "Gold momentum neutral, watching for breakout",
      },
      {
        name: "Bond Market Direction (TLT)", category: "Rates", value: `${tltAboveMa ? "Above" : "Below"} 50D MA (${tltChange3M >= 0 ? "+" : ""}${tltChange3M.toFixed(1)}% 3M)`,
        signal: scoreToSignal(bondScore), weight: 10, bullScore: bondScore,
        description: tltAboveMa ? "Bonds rallying (yields falling) — supportive for gold" : "Bonds under pressure (yields rising) — headwind for gold",
      },
      {
        name: "Commodity Trend (Oil)", category: "Commodity", value: `WTI ${(oil?.price ?? 75).toFixed(1)} (${oilChange3M >= 0 ? "+" : ""}${oilChange3M.toFixed(1)}% 3M)`,
        signal: scoreToSignal(commodityScore), weight: 8, bullScore: commodityScore,
        description: oilChange3M > 10 ? "Oil surge signals inflation risk — gold benefits" : oilChange3M < -10 ? "Oil falling — deflationary signal, mixed for gold" : "Oil trend neutral",
      },
      {
        name: "Crypto Competition (BTC)", category: "Crypto", value: `BTC ${btcChange1M >= 0 ? "+" : ""}${btcChange1M.toFixed(1)}% 1M`,
        signal: scoreToSignal(cryptoScore), weight: 4, bullScore: cryptoScore,
        description: btcChange1M > 20 ? "Strong BTC rally may divert safe-haven flows from gold" : btcChange1M < -20 ? "Crypto selloff may push flows back toward gold" : "Crypto neutral for gold",
      },
      {
        name: "JPY Safe-Haven Signal", category: "Currency", value: `USDJPY ${(usdjpy?.price ?? 150).toFixed(1)} (${jpyChange >= 0 ? "+" : ""}${jpyChange.toFixed(1)}% 3M)`,
        signal: scoreToSignal(geoScore), weight: 4, bullScore: geoScore,
        description: jpyChange < -3 ? "Yen strengthening — safe-haven demand rising alongside gold" : jpyChange > 3 ? "Yen weakening — safe-haven flows reduced" : "JPY neutral — gold uncorrelated with yen currently",
      },
    ];

    // ── Weighted Composite Score ──
    const totalWeight = factors.reduce((a, b) => a + b.weight, 0);
    const compositeScore = Math.round(
      factors.reduce((s, f) => s + f.bullScore * f.weight, 0) / totalWeight
    );
    const compositeSignal = scoreToSignal(compositeScore);
    const compositeColor = signalColor(compositeSignal);
    const compositeLabel = signalLabel(compositeSignal);

    // ── Category Grouping ──
    const catDefs = [
      { key: "Currency",   icon: "💱" },
      { key: "Rates",      icon: "📉" },
      { key: "Inflation",  icon: "🔥" },
      { key: "Risk",       icon: "⚡" },
      { key: "Momentum",   icon: "📡" },
      { key: "Commodity",  icon: "🛢️" },
      { key: "Crypto",     icon: "₿" },
    ];
    const categories: MacroCategoryScore[] = catDefs.map(cd => {
      const catFactors = factors.filter(f => f.category === cd.key);
      const catScore = catFactors.length
        ? Math.round(catFactors.reduce((s, f) => s + f.bullScore, 0) / catFactors.length)
        : 50;
      return { category: cd.key, icon: cd.icon, score: catScore, signal: scoreToSignal(catScore), factors: catFactors };
    }).filter(c => c.factors.length > 0);

    const sortedBull = [...factors].sort((a, b) => b.bullScore - a.bullScore);
    const topBullishFactors = sortedBull.slice(0, 3).map(f => `${f.name}: ${f.description}`);
    const topBearishFactors = sortedBull.slice(-3).reverse().map(f => `${f.name}: ${f.description}`);

    const macroSummary = compositeScore >= 65
      ? `Macro environment is broadly supportive of gold. Dollar weakness, elevated fear, and real yield dynamics are aligning bullishly.`
      : compositeScore >= 50
      ? `Macro conditions are moderately positive for gold. Some headwinds from risk appetite and yields partially offset supportive factors.`
      : compositeScore >= 40
      ? `Mixed macro signals — gold facing resistance from risk-on sentiment or rising yields. Selective opportunities exist.`
      : `Macro environment unfavorable for gold. Strong dollar, low volatility, and risk-on positioning suppress demand.`;

    const goldOutlook = compositeScore >= 65
      ? `Strong macro tailwinds suggest continued gold strength. Focus on pullbacks as buying opportunities near key support levels.`
      : compositeScore >= 50
      ? `Cautiously bullish macro backdrop. Wait for macro confirmation before adding exposure.`
      : compositeScore >= 40
      ? `Neutral-to-cautious macro setup. Reduce exposure on rallies; keep stops tight.`
      : `Macro headwinds dominant. Risk management priority; consider smaller position sizes.`;

    const payload: MacroDashboardPayload = {
      goldPrice, compositeScore, compositeSignal, compositeColor, compositeLabel,
      categories, topBullishFactors, topBearishFactors, macroSummary, goldOutlook,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("macro-dashboard error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
