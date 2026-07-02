import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CurrencyGold {
  code: string;
  name: string;
  flag: string;
  goldPrice: number;         // gold priced in this currency
  change1DPct: number;
  change1WPct: number;
  change1MPct: number;
  usdRate: number;           // units of currency per USD
  goldStrength: "strong" | "neutral" | "weak"; // gold vs this currency
  color: string;
}

export interface GoldCurrenciesPayload {
  goldUSD: number;
  goldUSDChange1D: number;
  goldUSDChange1DPct: number;
  currencies: CurrencyGold[];
  strongestCurrency: string;  // currency where gold gained least (strongest vs gold)
  weakestCurrency: string;    // currency where gold gained most (weakest vs gold)
  currencyDrivenMove: boolean; // is the gold move currency-driven or "true" gold strength?
  analysis: string;
  timestamp: string;
}

let CACHE: { data: GoldCurrenciesPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

async function fetchClose(symbol: string, range = "1mo"): Promise<{ price: number; change1D: number; closes: number[] } | null> {
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
    const prev: number = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
    return { price, change1D: price - prev, closes };
  } catch { return null; }
}

function pctChange(closes: number[], nDays: number): number {
  if (closes.length < nDays + 1) return 0;
  const now = closes[closes.length - 1];
  const past = closes[closes.length - 1 - nDays];
  return ((now - past) / past) * 100;
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    // Fetch gold (USD) and 6 FX pairs
    const [goldData, eurusd, gbpusd, usdjpy, usdchf, audusd, usdcnh] = await Promise.all([
      fetchClose("GC=F", "1mo"),
      fetchClose("EURUSD=X", "1mo"),
      fetchClose("GBPUSD=X", "1mo"),
      fetchClose("JPY=X", "1mo"),     // USDJPY
      fetchClose("CHF=X", "1mo"),     // USDCHF
      fetchClose("AUDUSD=X", "1mo"),
      fetchClose("CNY=X", "1mo"),     // USDCNY
    ]);

    const goldUSD = goldData?.price ?? 3350;
    const goldPrev = goldData ? goldData.price - goldData.change1D : goldUSD;
    const goldUSDChange1D = goldData?.change1D ?? 0;
    const goldUSDChange1DPct = goldPrev > 0 ? (goldUSDChange1D / goldPrev) * 100 : 0;
    const goldCloses = goldData?.closes ?? [];

    // EUR (multiply gold price by 1/EURUSD to get EUR per oz)
    // gold_EUR = gold_USD / EURUSD
    // gold_GBP = gold_USD / GBPUSD
    // gold_JPY = gold_USD * USDJPY
    // gold_CHF = gold_USD * USDCHF
    // gold_AUD = gold_USD / AUDUSD
    // gold_CNY = gold_USD * USDCNY

    const fxConfigs = [
      {
        code: "EUR", name: "Euro", flag: "🇪🇺",
        fxData: eurusd,
        toGoldFn: (g: number, fx: number) => g / fx,  // gold_EUR = USD / EURUSD
        fxDefault: 1.08,
      },
      {
        code: "GBP", name: "British Pound", flag: "🇬🇧",
        fxData: gbpusd,
        toGoldFn: (g: number, fx: number) => g / fx,  // gold_GBP = USD / GBPUSD
        fxDefault: 0.79,
      },
      {
        code: "JPY", name: "Japanese Yen", flag: "🇯🇵",
        fxData: usdjpy,
        toGoldFn: (g: number, fx: number) => g * fx,  // gold_JPY = USD * USDJPY
        fxDefault: 149,
      },
      {
        code: "CHF", name: "Swiss Franc", flag: "🇨🇭",
        fxData: usdchf,
        toGoldFn: (g: number, fx: number) => g * fx,  // gold_CHF = USD * USDCHF
        fxDefault: 0.89,
      },
      {
        code: "AUD", name: "Australian Dollar", flag: "🇦🇺",
        fxData: audusd,
        toGoldFn: (g: number, fx: number) => g / fx,  // gold_AUD = USD / AUDUSD
        fxDefault: 0.65,
      },
      {
        code: "CNY", name: "Chinese Yuan", flag: "🇨🇳",
        fxData: usdcnh,
        toGoldFn: (g: number, fx: number) => g * fx,  // gold_CNY = USD * USDCNY
        fxDefault: 7.24,
      },
    ];

    const currencies: CurrencyGold[] = fxConfigs.map(cfg => {
      const fxPrice = cfg.fxData?.price ?? cfg.fxDefault;
      const fxPrev = cfg.fxData ? fxPrice - cfg.fxData.change1D : fxPrice;
      const fxCloses = cfg.fxData?.closes ?? [];

      const goldLocal = cfg.toGoldFn(goldUSD, fxPrice);
      const goldLocalPrev = cfg.toGoldFn(goldPrev, fxPrev);
      const change1DPct = goldLocalPrev > 0 ? ((goldLocal - goldLocalPrev) / goldLocalPrev) * 100 : 0;

      // 1W and 1M changes
      const goldCloses5 = goldCloses.slice(-6);
      const goldCloses21 = goldCloses.slice(-22);
      const fxCloses5 = fxCloses.slice(-6);
      const fxCloses21 = fxCloses.slice(-22);

      let change1WPct = 0, change1MPct = 0;
      if (goldCloses5.length >= 2 && fxCloses5.length >= 2) {
        const gNow = goldCloses5[goldCloses5.length - 1];
        const g1W = goldCloses5[0];
        const fNow = fxCloses5[fxCloses5.length - 1];
        const f1W = fxCloses5[0];
        const l1W = cfg.toGoldFn(g1W, f1W);
        const lNow = cfg.toGoldFn(gNow, fNow);
        change1WPct = l1W > 0 ? ((lNow - l1W) / l1W) * 100 : 0;
      }
      if (goldCloses21.length >= 2 && fxCloses21.length >= 2) {
        const gNow = goldCloses21[goldCloses21.length - 1];
        const g1M = goldCloses21[0];
        const fNow = fxCloses21[fxCloses21.length - 1];
        const f1M = fxCloses21[0];
        const l1M = cfg.toGoldFn(g1M, f1M);
        const lNow = cfg.toGoldFn(gNow, fNow);
        change1MPct = l1M > 0 ? ((lNow - l1M) / l1M) * 100 : 0;
      }

      const goldStrength: CurrencyGold["goldStrength"] =
        change1DPct > 0.3 ? "strong" : change1DPct < -0.3 ? "weak" : "neutral";
      const color = goldStrength === "strong" ? "#34d399" : goldStrength === "weak" ? "#f87171" : "#f5c451";

      return {
        code: cfg.code,
        name: cfg.name,
        flag: cfg.flag,
        goldPrice: goldLocal,
        change1DPct,
        change1WPct,
        change1MPct,
        usdRate: fxPrice,
        goldStrength,
        color,
      };
    });

    // Include USD
    currencies.unshift({
      code: "USD",
      name: "US Dollar",
      flag: "🇺🇸",
      goldPrice: goldUSD,
      change1DPct: goldUSDChange1DPct,
      change1WPct: pctChange(goldCloses, 5),
      change1MPct: pctChange(goldCloses, 21),
      usdRate: 1,
      goldStrength: goldUSDChange1DPct > 0.3 ? "strong" : goldUSDChange1DPct < -0.3 ? "weak" : "neutral",
      color: goldUSDChange1DPct > 0 ? "#34d399" : "#f87171",
    });

    // Analysis
    const allChanges = currencies.map(c => c.change1DPct);
    const maxChange = Math.max(...allChanges);
    const minChange = Math.min(...allChanges);
    const weakestCurrency = currencies[allChanges.indexOf(maxChange)]?.code ?? "USD"; // gold highest vs this = weakest
    const strongestCurrency = currencies[allChanges.indexOf(minChange)]?.code ?? "USD"; // gold lowest vs this = strongest

    // Is the USD move driving gold or is it universal?
    const nonUSDChanges = currencies.filter(c => c.code !== "USD").map(c => c.change1DPct);
    const avgNonUSD = nonUSDChanges.reduce((a, b) => a + b, 0) / nonUSDChanges.length;
    const currencyDrivenMove = Math.abs(goldUSDChange1DPct - avgNonUSD) > 0.5;

    const analysis = currencyDrivenMove
      ? `Today's gold move appears currency-driven: gold is ${goldUSDChange1DPct > 0 ? "up" : "down"} ${Math.abs(goldUSDChange1DPct).toFixed(2)}% in USD but only ${Math.abs(avgNonUSD).toFixed(2)}% on average in other currencies. Dollar moves are the primary driver.`
      : `Gold is moving broadly: ${goldUSDChange1DPct > 0 ? "up" : "down"} ${Math.abs(goldUSDChange1DPct).toFixed(2)}% in USD and similarly in other currencies (avg ${Math.abs(avgNonUSD).toFixed(2)}%). This reflects true gold buying/selling pressure across all currencies.`;

    const payload: GoldCurrenciesPayload = {
      goldUSD, goldUSDChange1D, goldUSDChange1DPct,
      currencies, strongestCurrency, weakestCurrency,
      currencyDrivenMove, analysis,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("gold-currencies error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
