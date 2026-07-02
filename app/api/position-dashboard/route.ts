import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface PositionSource {
  name: string;
  icon: string;
  value: number;       // normalized 0-100 (0 = max short, 50 = neutral, 100 = max long)
  netLong: boolean;
  signal: "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish";
  detail: string;
  timeframe: string;
  weight: number;      // weight in composite (sums to 1)
}

export interface HistoricalBand {
  label: string;
  minVal: number;
  maxVal: number;
  color: string;
}

export interface PositionDashboardPayload {
  goldPrice: number;
  compositeScore: number;    // 0-100
  compositeSignal: "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish";
  compositeColor: string;
  compositeLabel: string;
  sources: PositionSource[];
  crowdedLong: boolean;
  crowdedShort: boolean;
  contrarianNote: string | null;
  goldChange1DPct: number;
  historicalBands: HistoricalBand[];
  interpretation: string;
  keyRisk: string;
  timestamp: string;
}

let CACHE: { data: PositionDashboardPayload; ts: number } | null = null;
const TTL = 30 * 60 * 1000;

async function fetchYahooClose(symbol: string): Promise<{ price: number; change1D: number; closes: number[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta ?? {};
    const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
    const price: number = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const prev: number = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
    return { price, change1D: price - prev, closes };
  } catch { return null; }
}

function signalFromScore(s: number): PositionSource["signal"] {
  if (s >= 80) return "very_bullish";
  if (s >= 60) return "bullish";
  if (s >= 40) return "neutral";
  if (s >= 20) return "bearish";
  return "very_bearish";
}

function compositeLabel(s: number): string {
  if (s >= 80) return "Extremely Long — Crowded";
  if (s >= 65) return "Net Long — Bullish Positioning";
  if (s >= 55) return "Slightly Long";
  if (s >= 45) return "Neutral / Mixed";
  if (s >= 35) return "Slightly Short";
  if (s >= 20) return "Net Short — Bearish Positioning";
  return "Extremely Short — Potential Squeeze";
}

function compositeColor(s: number): string {
  if (s >= 75) return "#34d399";
  if (s >= 55) return "#86efac";
  if (s >= 45) return "#f5c451";
  if (s >= 30) return "#fb923c";
  return "#f87171";
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch live market data to infer positioning
    const [gold, gdx, gld, vix, dxy, hyg] = await Promise.all([
      fetchYahooClose("GC=F"),
      fetchYahooClose("GDX"),
      fetchYahooClose("GLD"),
      fetchYahooClose("^VIX"),
      fetchYahooClose("DX-Y.NYB"),
      fetchYahooClose("HYG"),
    ]);

    const goldPrice = gold?.price ?? 3350;
    const goldChange1DPct = gold ? (gold.change1D / (gold.price - gold.change1D)) * 100 : 0;

    // ── Derive positioning signals from live data ──────────────

    // 1. ETF Flows (GLD AUM proxy via price momentum)
    // If GLD is making new 20D highs, ETF buyers active → long
    const gldCloses = gld?.closes ?? [];
    const gld20High = gldCloses.length >= 20 ? Math.max(...gldCloses.slice(-20)) : (gld?.price ?? 0);
    const gld5DAvg = gldCloses.length >= 5 ? gldCloses.slice(-5).reduce((a, b) => a + b, 0) / 5 : (gld?.price ?? 0);
    const etfScore = gld && gld.price > 0
      ? Math.min(85, Math.max(15, 50 + ((gld.price - gld5DAvg) / gld5DAvg) * 200))
      : 50;

    // 2. COT-proxy: Miner ETF vs Gold ratio signals speculative vs commercial positioning
    // When GDX/GLD ratio is rising, spec longs increasing → bullish positioning
    const gdxPrice = gdx?.price ?? 40;
    const gldPrice = gld?.price ?? 185;
    const gdxGldRatio = gldPrice > 0 ? gdxPrice / gldPrice : 0.22;
    const gdxGldScore = Math.min(90, Math.max(10, 50 + (gdxGldRatio - 0.22) * 500));

    // 3. VIX-implied demand: High VIX → fear → safe haven long gold
    const vixLevel = vix?.price ?? 18;
    const vixScore = vixLevel > 25 ? 72 : vixLevel > 20 ? 62 : vixLevel < 14 ? 40 : 50;

    // 4. Momentum / Price positioning: price vs 20D MA
    const goldCloses = gold?.closes ?? [];
    const gold20MA = goldCloses.length >= 20 ? goldCloses.slice(-20).reduce((a, b) => a + b, 0) / 20 : goldPrice;
    const priceScore = Math.min(88, Math.max(12, 50 + ((goldPrice - gold20MA) / gold20MA) * 300));

    // 5. Credit market (HYG proxy): When HYG is strong, risk-on → gold longs lighter
    const hygPrice = hyg?.price ?? 79;
    const hygChange = hyg ? (hyg.change1D / (hyg.price - hyg.change1D)) * 100 : 0;
    const creditScore = Math.max(15, Math.min(85, 55 - hygChange * 8)); // inverse relationship

    // 6. Dollar (DXY): Strong dollar → shorts on gold by spec traders
    const dxyPrice = dxy?.price ?? 104;
    const dxyScore = Math.min(80, Math.max(20, 50 + (104 - dxyPrice) * 4));

    const sources: PositionSource[] = [
      {
        name: "Gold ETF Flows",
        icon: "📈",
        value: etfScore,
        netLong: etfScore > 50,
        signal: signalFromScore(etfScore),
        detail: `GLD ${gld && gld.price > gld5DAvg ? "above" : "below"} 5D avg ($${gld5DAvg.toFixed(1)}) — ${etfScore > 60 ? "inflow trend" : etfScore < 40 ? "outflow trend" : "neutral flow"}`,
        timeframe: "Daily",
        weight: 0.25,
      },
      {
        name: "Miner Sentiment (GDX/GLD)",
        icon: "⛏️",
        value: gdxGldScore,
        netLong: gdxGldScore > 50,
        signal: signalFromScore(gdxGldScore),
        detail: `GDX/GLD ratio ${gdxGldRatio.toFixed(3)} — ${gdxGldRatio > 0.24 ? "miners outperforming (spec long active)" : gdxGldRatio < 0.20 ? "miners lagging (positioning light)" : "near historical average"}`,
        timeframe: "Weekly",
        weight: 0.20,
      },
      {
        name: "Fear/VIX Signal",
        icon: "😱",
        value: vixScore,
        netLong: vixScore > 50,
        signal: signalFromScore(vixScore),
        detail: `VIX at ${vixLevel.toFixed(1)} — ${vixLevel > 25 ? "elevated fear drives safe-haven gold demand" : vixLevel < 14 ? "complacency; investors underweight gold hedges" : "moderate risk appetite"}`,
        timeframe: "Daily",
        weight: 0.15,
      },
      {
        name: "Price Momentum",
        icon: "🎯",
        value: priceScore,
        netLong: priceScore > 50,
        signal: signalFromScore(priceScore),
        detail: `Gold ${goldPrice > gold20MA ? "+" : ""}${((goldPrice - gold20MA) / gold20MA * 100).toFixed(1)}% vs 20D MA ($${gold20MA.toFixed(0)}) — ${priceScore > 60 ? "momentum buyers active" : priceScore < 40 ? "momentum sellers dominating" : "balanced"}`,
        timeframe: "Daily",
        weight: 0.20,
      },
      {
        name: "Credit Market Signal",
        icon: "💳",
        value: creditScore,
        netLong: creditScore > 50,
        signal: signalFromScore(creditScore),
        detail: `HYG ${hygChange >= 0 ? "+" : ""}${hygChange.toFixed(2)}% — ${hygChange > 0.3 ? "risk-on, light gold positioning" : hygChange < -0.3 ? "credit stress, flight to gold" : "stable credit conditions"}`,
        timeframe: "Daily",
        weight: 0.10,
      },
      {
        name: "Dollar Positioning",
        icon: "💵",
        value: dxyScore,
        netLong: dxyScore > 50,
        signal: signalFromScore(dxyScore),
        detail: `DXY at ${dxyPrice.toFixed(1)} — ${dxyPrice > 106 ? "strong dollar depressing gold longs" : dxyPrice < 102 ? "weak dollar supporting gold longs" : "dollar in neutral zone"}`,
        timeframe: "Daily",
        weight: 0.10,
      },
    ];

    // Weighted composite
    const compositeScore = Math.round(
      sources.reduce((sum, s) => sum + s.value * s.weight, 0)
    );
    const compositeSignal = signalFromScore(compositeScore);
    const crowdedLong = compositeScore >= 78;
    const crowdedShort = compositeScore <= 22;

    const contrarianNote = crowdedLong
      ? "⚠️ Crowded long — extreme positioning often precedes corrections. Consider tightening stops."
      : crowdedShort
      ? "⚡ Extreme short squeeze risk — positioning at extremes often snaps back violently."
      : null;

    const historicalBands: HistoricalBand[] = [
      { label: "Crowded Long (sell warning)", minVal: 78, maxVal: 100, color: "#ef4444" },
      { label: "Bullish Zone",                minVal: 60, maxVal: 78,  color: "#34d399" },
      { label: "Neutral Zone",                minVal: 40, maxVal: 60,  color: "#f5c451" },
      { label: "Bearish Zone",                minVal: 22, maxVal: 40,  color: "#fb923c" },
      { label: "Crowded Short (buy squeeze)", minVal: 0,  maxVal: 22,  color: "#c084fc" },
    ];

    const interpretation = compositeScore >= 78
      ? "Positioning is extremely stretched long — historically a contrarian sell signal. Watch for profit-taking."
      : compositeScore >= 60
      ? "Net long positioning supportive of gold — trend followers and momentum traders are long."
      : compositeScore <= 22
      ? "Extreme short squeeze candidate — positioning at bearish extreme, snapback risk is high."
      : compositeScore <= 40
      ? "Net short positioning — bearish consensus. Watch for capitulation rally."
      : "Balanced positioning — no strong contrarian signal. Follow the trend and technical levels.";

    const keyRisk = crowdedLong
      ? "Any negative surprise (strong CPI, Fed hawkishness, DXY spike) could trigger wave of longs unwinding"
      : crowdedShort
      ? "Any positive catalyst (weak jobs data, Fed dovish pivot, geopolitical flare) could spark short squeeze"
      : "Positioning supports trend continuation — key risk is unexpected macro data reversal";

    const payload: PositionDashboardPayload = {
      goldPrice, compositeScore, compositeSignal,
      compositeColor: compositeColor(compositeScore),
      compositeLabel: compositeLabel(compositeScore),
      sources, crowdedLong, crowdedShort, contrarianNote,
      goldChange1DPct, historicalBands, interpretation, keyRisk,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("position-dashboard error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
