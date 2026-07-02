import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface MinerEntry {
  symbol: string;
  name: string;
  icon: string;
  price: number;
  change1D: number;
  change1DPct: number;
  ratio: number;          // price / goldPrice
  ratioChange1W: number;  // % change in ratio over 1 week
  betaVsGold: number;     // 30D rolling beta
  outperforming: boolean; // ratio trending up
  description: string;
}

export interface MinerRatioPayload {
  goldPrice: number;
  gdxGldRatio: number;       // GDX / GLD ratio
  gdxjGdxRatio: number;      // GDXJ / GDX (junior vs senior)
  gdxPriceVsGold: number;    // GDX price normalized to gold
  signalBias: "miners_lead" | "gold_leads" | "diverging" | "aligned";
  signalColor: string;
  signalDescription: string;
  miners: MinerEntry[];
  huiGoldRatio: number | null;  // HUI / gold (if available)
  historicalContext: string;
  keyInsight: string;
  timestamp: string;
}

let CACHE: { data: MinerRatioPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

async function fetchPricesAndReturns(symbols: string[]): Promise<Map<string, { price: number; change1D: number; close90D: number[] }>> {
  const results = new Map<string, { price: number; change1D: number; close90D: number[] }>();
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=3mo&interval=1d`;
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
        if (!res.ok) return;
        const j = await res.json();
        const r = j.chart?.result?.[0];
        if (!r) return;
        const meta = r.meta ?? {};
        const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter(Boolean);
        const price: number = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
        const prevClose: number = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
        results.set(sym, { price, change1D: price - prevClose, close90D: closes });
      } catch { /* skip */ }
    })
  );
  return results;
}

function computeBeta(assetCloses: number[], goldCloses: number[]): number {
  const n = Math.min(assetCloses.length, goldCloses.length, 30);
  if (n < 5) return 1;
  const aR: number[] = [], gR: number[] = [];
  for (let i = 1; i < n; i++) {
    aR.push(Math.log(assetCloses[assetCloses.length - n + i] / assetCloses[assetCloses.length - n + i - 1]));
    gR.push(Math.log(goldCloses[goldCloses.length - n + i] / goldCloses[goldCloses.length - n + i - 1]));
  }
  const meanG = gR.reduce((a, b) => a + b, 0) / gR.length;
  let cov = 0, varG = 0;
  for (let i = 0; i < aR.length; i++) { cov += (aR[i] - (aR.reduce((a, b) => a + b, 0) / aR.length)) * (gR[i] - meanG); varG += (gR[i] - meanG) ** 2; }
  return varG === 0 ? 1 : cov / varG;
}

function ratioChange1W(assetCloses: number[], goldCloses: number[]): number {
  if (assetCloses.length < 6 || goldCloses.length < 6) return 0;
  const ratioNow = assetCloses[assetCloses.length - 1] / goldCloses[goldCloses.length - 1];
  const ratio1W = assetCloses[assetCloses.length - 6] / goldCloses[goldCloses.length - 6];
  return ((ratioNow - ratio1W) / ratio1W) * 100;
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const symbols = ["GC=F", "GLD", "GDX", "GDXJ", "NEM", "GOLD", "AEM", "AGI"];
    const data = await fetchPricesAndReturns(symbols);

    const goldFut = data.get("GC=F");
    const gld = data.get("GLD");
    const gdx = data.get("GDX");
    const gdxj = data.get("GDXJ");

    const goldPrice = goldFut?.price ?? gld?.price ?? 3350;
    const goldCloses = goldFut?.close90D ?? gld?.close90D ?? [];

    // GDX / GLD ratio
    const gdxGldRatio = gdx && gld && gld.price > 0 ? gdx.price / gld.price : 0;
    // GDXJ / GDX ratio
    const gdxjGdxRatio = gdxj && gdx && gdx.price > 0 ? gdxj.price / gdx.price : 0;
    // GDX price normalized to gold (GDX × (gold/100) as proxy)
    const gdxPriceVsGold = gdx && goldPrice > 0 ? (gdx.price / goldPrice) * 100 : 0;

    // Signal: are miners leading or lagging gold?
    const gdxRatioTrend = gdx && gld ? ratioChange1W(gdx.close90D, gld.close90D) : 0;
    const gdxChange1DPct = gdx && gdx.price > 0 ? (gdx.change1D / (gdx.price - gdx.change1D)) * 100 : 0;
    const goldChange1DPct = goldFut && goldFut.price > 0 ? (goldFut.change1D / (goldFut.price - goldFut.change1D)) * 100 : 0;

    let signalBias: MinerRatioPayload["signalBias"] = "aligned";
    let signalColor = "#f5c451";
    let signalDescription = "";

    if (gdxChange1DPct > goldChange1DPct + 1) {
      signalBias = "miners_lead"; signalColor = "#34d399";
      signalDescription = "Miners outperforming gold today — historically bullish for gold continuation.";
    } else if (gdxChange1DPct < goldChange1DPct - 1) {
      signalBias = "gold_leads"; signalColor = "#f5c451";
      signalDescription = "Gold leading miners today — watch for catch-up or potential warning sign.";
    } else if (gdxRatioTrend > 2) {
      signalBias = "miners_lead"; signalColor = "#34d399";
      signalDescription = "Miners trending up vs gold over 1 week — bullish for gold's next move.";
    } else if (gdxRatioTrend < -2) {
      signalBias = "diverging"; signalColor = "#f87171";
      signalDescription = "Miners underperforming gold — potential warning signal; watch for correction.";
    } else {
      signalBias = "aligned";
      signalDescription = "Miners and gold moving in sync — no divergence signal currently.";
    }

    const MINER_META: Record<string, { name: string; icon: string; description: string }> = {
      GDX:  { name: "VanEck Gold Miners ETF",   icon: "⛏️", description: "Senior gold miners ETF — diversified exposure to major producers" },
      GDXJ: { name: "Junior Gold Miners ETF",   icon: "🔨", description: "Junior/mid-tier miners — higher leverage to gold price moves" },
      NEM:  { name: "Newmont Corporation",       icon: "🏔️", description: "World's largest gold miner by production" },
      GOLD: { name: "Barrick Gold",              icon: "🏅", description: "Major gold & copper producer; low-cost operations" },
      AEM:  { name: "Agnico Eagle Mines",        icon: "🦅", description: "Premium senior gold miner; strong ESG record" },
      AGI:  { name: "Alamos Gold",               icon: "🌄", description: "Mid-tier producer with strong growth pipeline" },
    };

    const miners: MinerEntry[] = [];
    for (const [sym, meta] of Object.entries(MINER_META)) {
      const d = data.get(sym);
      if (!d || d.price === 0) continue;
      const beta = computeBeta(d.close90D, goldCloses);
      const rc = ratioChange1W(d.close90D, goldCloses);
      miners.push({
        symbol: sym,
        name: meta.name,
        icon: meta.icon,
        price: d.price,
        change1D: d.change1D,
        change1DPct: d.price > 0 ? (d.change1D / (d.price - d.change1D)) * 100 : 0,
        ratio: goldPrice > 0 ? d.price / goldPrice : 0,
        ratioChange1W: rc,
        betaVsGold: beta,
        outperforming: rc > 0,
        description: meta.description,
      });
    }

    const historicalContext = `Historically, the GDX/GLD ratio averages ~0.25–0.35. ${gdxGldRatio > 0.33 ? "Current ratio above average — miners may be extended vs gold." : gdxGldRatio < 0.20 ? "Ratio below historical average — miners may be undervalued vs gold." : "Ratio in normal historical range."}`;

    const highBetaMiner = miners.filter(m => m.betaVsGold > 1.5).sort((a, b) => b.betaVsGold - a.betaVsGold)[0];
    const keyInsight = highBetaMiner
      ? `${highBetaMiner.symbol} has the highest beta (${highBetaMiner.betaVsGold.toFixed(1)}x) — for every 1% gold move, expect ~${highBetaMiner.betaVsGold.toFixed(1)}% from ${highBetaMiner.symbol}. ${gdxjGdxRatio > 0.65 ? "GDXJ/GDX ratio elevated — junior miners in favor." : "GDXJ/GDX ratio low — senior miners preferred."}`
      : "Monitor the GDX/GLD ratio for early signals of gold's next move — miners often lead by 1-3 days.";

    const payload: MinerRatioPayload = {
      goldPrice, gdxGldRatio, gdxjGdxRatio, gdxPriceVsGold,
      signalBias, signalColor, signalDescription,
      miners, huiGoldRatio: null, historicalContext, keyInsight,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("miner-ratio error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
