// Supported trading instruments — price fetch via Yahoo Finance tickers.
// pipValuePerLot = USD P&L per 1 pip move per 1 standard lot (retail broker standard).

export type SymbolCategory = "metal" | "forex" | "crypto" | "energy" | "index";

export interface SymbolConfig {
  id: string;               // our identifier e.g. "XAUUSD"
  label: string;            // display name
  yahooTicker: string;      // Yahoo Finance symbol
  category: SymbolCategory;
  icon: string;
  decimals: number;         // price display precision
  pipSize: number;          // 1 pip in price units (0.0001 for EUR/USD, 1.0 for XAUUSD)
  pipValuePerLot: number;   // USD per pip per 1 standard lot
  minLot: number;
  lotUnit: string;          // displayed unit label
}

export const SYMBOLS: SymbolConfig[] = [
  // ── Metals ──────────────────────────────────────────────────────────────────
  {
    id: "XAUUSD", label: "Gold / USD", yahooTicker: "GC=F",
    category: "metal", icon: "🥇", decimals: 2,
    pipSize: 1, pipValuePerLot: 100, minLot: 0.01, lotUnit: "oz",
  },
  {
    id: "XAGUSD", label: "Silver / USD", yahooTicker: "SI=F",
    category: "metal", icon: "🥈", decimals: 3,
    pipSize: 0.001, pipValuePerLot: 5, minLot: 0.01, lotUnit: "oz",
  },

  // ── Forex ────────────────────────────────────────────────────────────────────
  {
    id: "EURUSD", label: "EUR / USD", yahooTicker: "EURUSD=X",
    category: "forex", icon: "🇪🇺", decimals: 5,
    pipSize: 0.0001, pipValuePerLot: 10, minLot: 0.01, lotUnit: "units",
  },
  {
    id: "GBPUSD", label: "GBP / USD", yahooTicker: "GBPUSD=X",
    category: "forex", icon: "🇬🇧", decimals: 5,
    pipSize: 0.0001, pipValuePerLot: 10, minLot: 0.01, lotUnit: "units",
  },
  {
    id: "USDJPY", label: "USD / JPY", yahooTicker: "JPY=X",
    category: "forex", icon: "🇯🇵", decimals: 3,
    pipSize: 0.01, pipValuePerLot: 9.1, minLot: 0.01, lotUnit: "units",
  },
  {
    id: "AUDUSD", label: "AUD / USD", yahooTicker: "AUDUSD=X",
    category: "forex", icon: "🇦🇺", decimals: 5,
    pipSize: 0.0001, pipValuePerLot: 10, minLot: 0.01, lotUnit: "units",
  },
  {
    id: "USDCHF", label: "USD / CHF", yahooTicker: "CHF=X",
    category: "forex", icon: "🇨🇭", decimals: 5,
    pipSize: 0.0001, pipValuePerLot: 10, minLot: 0.01, lotUnit: "units",
  },
  {
    id: "USDCAD", label: "USD / CAD", yahooTicker: "CAD=X",
    category: "forex", icon: "🇨🇦", decimals: 5,
    pipSize: 0.0001, pipValuePerLot: 7.5, minLot: 0.01, lotUnit: "units",
  },

  // ── Crypto ───────────────────────────────────────────────────────────────────
  {
    id: "BTCUSD", label: "BTC / USD", yahooTicker: "BTC-USD",
    category: "crypto", icon: "₿", decimals: 2,
    pipSize: 1, pipValuePerLot: 1, minLot: 0.001, lotUnit: "BTC",
  },
  {
    id: "ETHUSD", label: "ETH / USD", yahooTicker: "ETH-USD",
    category: "crypto", icon: "⟠", decimals: 2,
    pipSize: 0.1, pipValuePerLot: 0.1, minLot: 0.01, lotUnit: "ETH",
  },

  // ── Energy ───────────────────────────────────────────────────────────────────
  {
    id: "USOUSD", label: "WTI Crude Oil", yahooTicker: "CL=F",
    category: "energy", icon: "🛢️", decimals: 2,
    pipSize: 0.01, pipValuePerLot: 10, minLot: 0.01, lotUnit: "bbl",
  },
  {
    id: "NATGAS", label: "Natural Gas", yahooTicker: "NG=F",
    category: "energy", icon: "🔥", decimals: 3,
    pipSize: 0.001, pipValuePerLot: 10, minLot: 0.01, lotUnit: "MMBtu",
  },

  // ── Indices ──────────────────────────────────────────────────────────────────
  {
    id: "US500", label: "S&P 500", yahooTicker: "^GSPC",
    category: "index", icon: "📈", decimals: 2,
    pipSize: 0.1, pipValuePerLot: 10, minLot: 0.01, lotUnit: "pts",
  },
  {
    id: "US100", label: "Nasdaq 100", yahooTicker: "^NDX",
    category: "index", icon: "💻", decimals: 2,
    pipSize: 0.1, pipValuePerLot: 1, minLot: 0.01, lotUnit: "pts",
  },
];

export const SYMBOL_MAP: Record<string, SymbolConfig> = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));

export const CATEGORY_LABEL: Record<SymbolCategory, string> = {
  metal: "Metals",
  forex: "Forex",
  crypto: "Crypto",
  energy: "Energy",
  index: "Indices",
};

export const CATEGORY_COLOR: Record<SymbolCategory, string> = {
  metal:  "#f5c451",
  forex:  "#60a5fa",
  crypto: "#f97316",
  energy: "#34d399",
  index:  "#a78bfa",
};
