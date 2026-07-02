import { NextResponse } from "next/server";

export const revalidate = 900;

interface CurrencyGold {
  currency: string;
  code: string;
  flag: string;
  symbol: string;
  goldPriceLocal: number;
  goldPriceUSD: number;
  athLocal: number;
  athDate: string;
  pctFromATH: number;
  change1d: number | null; // % in local currency terms
  isATH: boolean;
  interpretation: string;
}

interface GlobalGoldPriceData {
  goldUSD: number;
  goldChange1dUSD: number;
  currencies: CurrencyGold[];
  nearATH: string[];   // currency codes near ATH
  insight: string;
  timestamp: string;
}

interface FXQuote {
  rate: number | null;
  change: number | null;
}

async function fetchFX(symbol: string): Promise<FXQuote> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return { rate: null, change: null };
    const rate = meta.regularMarketPrice ?? null;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change = rate && prev ? ((rate - prev) / prev) * 100 : null;
    return { rate, change };
  } catch {
    return { rate: null, change: null };
  }
}

async function fetchGoldUSD(): Promise<{ price: number; change: number }> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=5d",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
    );
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? 3320;
    const prev = meta?.chartPreviousClose ?? price;
    return { price, change: ((price - prev) / prev) * 100 };
  } catch {
    return { price: 3320, change: 0 };
  }
}

// All-time highs of gold in local currencies (as of mid-2025)
// Based on actual historical records
const CURRENCY_ATH: Record<string, { ath: number; date: string }> = {
  EUR: { ath: 2985, date: "Apr 2025" },
  GBP: { ath: 2540, date: "Apr 2025" },
  JPY: { ath: 487_000, date: "Apr 2025" },
  CNY: { ath: 24_100, date: "Apr 2025" },
  INR: { ath: 278_000, date: "Apr 2025" },
  AUD: { ath: 5_280, date: "Apr 2025" },
  CHF: { ath: 2_920, date: "Apr 2025" },
  CAD: { ath: 4_590, date: "Apr 2025" },
  TRY: { ath: 107_000, date: "Apr 2025" },
  BRL: { ath: 18_900, date: "Apr 2025" },
  SGD: { ath: 4_420, date: "Apr 2025" },
};

function getInterpretation(code: string, pctFromATH: number, change: number | null): string {
  const atOrNear = pctFromATH > -2;
  const far = pctFromATH < -10;
  if (atOrNear) return `Gold at ATH in ${code} — local currency weakness is amplifying gold's gains. Strong signal.`;
  if (far) return `Gold ${Math.abs(pctFromATH).toFixed(0)}% below ATH in ${code} — relative strength of ${code} limiting gold's local gains.`;
  return `Gold ${Math.abs(pctFromATH).toFixed(0)}% from ATH in ${code} — moderate distance, watching for breakout.`;
}

export async function GET() {
  const CURRENCY_CONFIGS = [
    { code: "EUR", currency: "Euro",            flag: "🇪🇺", symbol: "EURUSD=X",  invert: true  },
    { code: "GBP", currency: "British Pound",   flag: "🇬🇧", symbol: "GBPUSD=X",  invert: true  },
    { code: "JPY", currency: "Japanese Yen",    flag: "🇯🇵", symbol: "JPY=X",      invert: false },
    { code: "CNY", currency: "Chinese Yuan",    flag: "🇨🇳", symbol: "CNYUSD=X",  invert: true  },
    { code: "INR", currency: "Indian Rupee",    flag: "🇮🇳", symbol: "INR=X",      invert: false },
    { code: "AUD", currency: "Australian Dollar", flag: "🇦🇺", symbol: "AUDUSD=X", invert: true  },
    { code: "CHF", currency: "Swiss Franc",     flag: "🇨🇭", symbol: "CHFUSD=X",  invert: true  },
    { code: "CAD", currency: "Canadian Dollar", flag: "🇨🇦", symbol: "CADUSD=X",  invert: true  },
    { code: "SGD", currency: "Singapore Dollar", flag: "🇸🇬", symbol: "SGDUSD=X", invert: true  },
  ];

  const [goldData, ...fxResults] = await Promise.all([
    fetchGoldUSD(),
    ...CURRENCY_CONFIGS.map(c => fetchFX(c.symbol)),
  ]);

  const currencies: CurrencyGold[] = CURRENCY_CONFIGS.map((cfg, i) => {
    const fx = fxResults[i];
    let fxRate = fx.rate;

    // Convert to "units per USD"
    if (fxRate === null) {
      // Fallback rates
      const FB: Record<string, number> = {
        EUR: 0.915, GBP: 0.785, JPY: 155, CNY: 0.138, INR: 83.5,
        AUD: 1.53, CHF: 0.895, CAD: 1.36, SGD: 1.32,
      };
      fxRate = FB[cfg.code] ?? 1;
    }

    // Gold in local currency
    const goldLocal = cfg.invert
      ? goldData.price / fxRate   // e.g., EUR: gold_usd / EUR_per_USD
      : goldData.price * fxRate;  // e.g., JPY: gold_usd * JPY_per_USD

    const ath = CURRENCY_ATH[cfg.code] ?? { ath: goldLocal * 1.05, date: "2025" };
    const pctFromATH = ((goldLocal - ath.ath) / ath.ath) * 100;
    const isATH = pctFromATH >= -1.5;

    // 1D change in local currency terms
    const fxChange = fx.change ?? 0;
    // If EUR/USD falls 0.5%, gold in EUR rises (gold in USD unchanged)
    const change1dLocal = cfg.invert
      ? goldData.change - fxChange  // simplified
      : goldData.change + fxChange;

    return {
      currency: cfg.currency,
      code: cfg.code,
      flag: cfg.flag,
      symbol: cfg.symbol,
      goldPriceLocal: parseFloat(goldLocal.toFixed(cfg.code === "JPY" || cfg.code === "INR" ? 0 : 2)),
      goldPriceUSD: goldData.price,
      athLocal: ath.ath,
      athDate: ath.date,
      pctFromATH: parseFloat(pctFromATH.toFixed(1)),
      change1d: parseFloat(change1dLocal.toFixed(2)),
      isATH,
      interpretation: getInterpretation(cfg.code, pctFromATH, change1dLocal),
    };
  });

  const nearATH = currencies.filter(c => c.isATH).map(c => c.code);

  const data: GlobalGoldPriceData = {
    goldUSD: goldData.price,
    goldChange1dUSD: parseFloat(goldData.change.toFixed(2)),
    currencies,
    nearATH,
    insight:
      `Gold at $${goldData.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD. ` +
      (nearATH.length > 0
        ? `At or near ALL-TIME HIGH in ${nearATH.join(", ")} — currency weakness amplifying gold's global rally.`
        : `Consolidating below ATH in most currencies. ${currencies.filter(c => c.pctFromATH > -5).length} currencies within 5% of ATH.`),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(data);
}
