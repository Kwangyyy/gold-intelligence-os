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
  pipSize: number;          // 1 pip in price units
  pipValuePerLot: number;   // USD per pip per 1 standard lot
  minLot: number;
  lotUnit: string;
}

export const SYMBOLS: SymbolConfig[] = [
  // ── Metals ──────────────────────────────────────────────────────────────────
  { id:"XAUUSD", label:"Gold / USD",      yahooTicker:"GC=F",       category:"metal",  icon:"🥇", decimals:2,  pipSize:1,      pipValuePerLot:100,  minLot:0.01,  lotUnit:"oz"    },
  { id:"XAGUSD", label:"Silver / USD",    yahooTicker:"SI=F",       category:"metal",  icon:"🥈", decimals:3,  pipSize:0.001,  pipValuePerLot:5,    minLot:0.01,  lotUnit:"oz"    },
  { id:"XPTUSD", label:"Platinum / USD",  yahooTicker:"PL=F",       category:"metal",  icon:"⚪", decimals:2,  pipSize:0.1,    pipValuePerLot:5,    minLot:0.01,  lotUnit:"oz"    },
  { id:"COPPER",  label:"Copper",          yahooTicker:"HG=F",       category:"metal",  icon:"🔶", decimals:4,  pipSize:0.0001, pipValuePerLot:2.5,  minLot:0.01,  lotUnit:"lbs"   },

  // ── Forex — Majors ───────────────────────────────────────────────────────────
  { id:"EURUSD", label:"EUR / USD",       yahooTicker:"EURUSD=X",   category:"forex",  icon:"🇪🇺", decimals:5, pipSize:0.0001, pipValuePerLot:10,   minLot:0.01,  lotUnit:"units" },
  { id:"GBPUSD", label:"GBP / USD",       yahooTicker:"GBPUSD=X",   category:"forex",  icon:"🇬🇧", decimals:5, pipSize:0.0001, pipValuePerLot:10,   minLot:0.01,  lotUnit:"units" },
  { id:"USDJPY", label:"USD / JPY",       yahooTicker:"JPY=X",      category:"forex",  icon:"🇯🇵", decimals:3, pipSize:0.01,   pipValuePerLot:9.1,  minLot:0.01,  lotUnit:"units" },
  { id:"USDCHF", label:"USD / CHF",       yahooTicker:"CHF=X",      category:"forex",  icon:"🇨🇭", decimals:5, pipSize:0.0001, pipValuePerLot:10,   minLot:0.01,  lotUnit:"units" },
  { id:"AUDUSD", label:"AUD / USD",       yahooTicker:"AUDUSD=X",   category:"forex",  icon:"🇦🇺", decimals:5, pipSize:0.0001, pipValuePerLot:10,   minLot:0.01,  lotUnit:"units" },
  { id:"NZDUSD", label:"NZD / USD",       yahooTicker:"NZDUSD=X",   category:"forex",  icon:"🇳🇿", decimals:5, pipSize:0.0001, pipValuePerLot:10,   minLot:0.01,  lotUnit:"units" },
  { id:"USDCAD", label:"USD / CAD",       yahooTicker:"CAD=X",      category:"forex",  icon:"🇨🇦", decimals:5, pipSize:0.0001, pipValuePerLot:7.5,  minLot:0.01,  lotUnit:"units" },

  // ── Forex — Minors / Crosses ─────────────────────────────────────────────────
  { id:"EURGBP", label:"EUR / GBP",       yahooTicker:"EURGBP=X",   category:"forex",  icon:"🇪🇺", decimals:5, pipSize:0.0001, pipValuePerLot:13,   minLot:0.01,  lotUnit:"units" },
  { id:"EURJPY", label:"EUR / JPY",       yahooTicker:"EURJPY=X",   category:"forex",  icon:"🇪🇺", decimals:3, pipSize:0.01,   pipValuePerLot:9.1,  minLot:0.01,  lotUnit:"units" },
  { id:"GBPJPY", label:"GBP / JPY",       yahooTicker:"GBPJPY=X",   category:"forex",  icon:"🇬🇧", decimals:3, pipSize:0.01,   pipValuePerLot:9.1,  minLot:0.01,  lotUnit:"units" },
  { id:"AUDJPY", label:"AUD / JPY",       yahooTicker:"AUDJPY=X",   category:"forex",  icon:"🇦🇺", decimals:3, pipSize:0.01,   pipValuePerLot:9.1,  minLot:0.01,  lotUnit:"units" },
  { id:"CADJPY", label:"CAD / JPY",       yahooTicker:"CADJPY=X",   category:"forex",  icon:"🇨🇦", decimals:3, pipSize:0.01,   pipValuePerLot:9.1,  minLot:0.01,  lotUnit:"units" },
  { id:"CHFJPY", label:"CHF / JPY",       yahooTicker:"CHFJPY=X",   category:"forex",  icon:"🇨🇭", decimals:3, pipSize:0.01,   pipValuePerLot:9.1,  minLot:0.01,  lotUnit:"units" },
  { id:"EURCHF", label:"EUR / CHF",       yahooTicker:"EURCHF=X",   category:"forex",  icon:"🇪🇺", decimals:5, pipSize:0.0001, pipValuePerLot:10,   minLot:0.01,  lotUnit:"units" },
  { id:"EURCAD", label:"EUR / CAD",       yahooTicker:"EURCAD=X",   category:"forex",  icon:"🇪🇺", decimals:5, pipSize:0.0001, pipValuePerLot:7.5,  minLot:0.01,  lotUnit:"units" },
  { id:"GBPCHF", label:"GBP / CHF",       yahooTicker:"GBPCHF=X",   category:"forex",  icon:"🇬🇧", decimals:5, pipSize:0.0001, pipValuePerLot:10,   minLot:0.01,  lotUnit:"units" },
  { id:"GBPCAD", label:"GBP / CAD",       yahooTicker:"GBPCAD=X",   category:"forex",  icon:"🇬🇧", decimals:5, pipSize:0.0001, pipValuePerLot:7.5,  minLot:0.01,  lotUnit:"units" },

  // ── Crypto ───────────────────────────────────────────────────────────────────
  { id:"BTCUSD",  label:"Bitcoin / USD",   yahooTicker:"BTC-USD",    category:"crypto", icon:"₿",   decimals:2,  pipSize:1,      pipValuePerLot:1,    minLot:0.001, lotUnit:"BTC"   },
  { id:"ETHUSD",  label:"Ethereum / USD",  yahooTicker:"ETH-USD",    category:"crypto", icon:"⟠",   decimals:2,  pipSize:0.1,    pipValuePerLot:0.1,  minLot:0.01,  lotUnit:"ETH"   },
  { id:"BNBUSD",  label:"BNB / USD",       yahooTicker:"BNB-USD",    category:"crypto", icon:"🟡",  decimals:2,  pipSize:0.1,    pipValuePerLot:0.1,  minLot:0.01,  lotUnit:"BNB"   },
  { id:"SOLUSD",  label:"Solana / USD",    yahooTicker:"SOL-USD",    category:"crypto", icon:"◎",   decimals:3,  pipSize:0.001,  pipValuePerLot:0.001,minLot:0.01,  lotUnit:"SOL"   },
  { id:"XRPUSD",  label:"XRP / USD",       yahooTicker:"XRP-USD",    category:"crypto", icon:"✕",   decimals:4,  pipSize:0.0001, pipValuePerLot:10,   minLot:1,     lotUnit:"XRP"   },
  { id:"ADAUSD",  label:"Cardano / USD",   yahooTicker:"ADA-USD",    category:"crypto", icon:"◈",   decimals:4,  pipSize:0.0001, pipValuePerLot:10,   minLot:1,     lotUnit:"ADA"   },
  { id:"DOGEUSD", label:"Dogecoin / USD",  yahooTicker:"DOGE-USD",   category:"crypto", icon:"🐕",  decimals:5,  pipSize:0.00001,pipValuePerLot:10,   minLot:100,   lotUnit:"DOGE"  },
  { id:"LINKUSD", label:"Chainlink / USD", yahooTicker:"LINK-USD",   category:"crypto", icon:"🔗",  decimals:3,  pipSize:0.001,  pipValuePerLot:0.001,minLot:0.1,   lotUnit:"LINK"  },
  { id:"AVAXUSD", label:"Avalanche / USD", yahooTicker:"AVAX-USD",   category:"crypto", icon:"🏔️",  decimals:3,  pipSize:0.001,  pipValuePerLot:0.001,minLot:0.01,  lotUnit:"AVAX"  },

  // ── Energy ───────────────────────────────────────────────────────────────────
  { id:"USOUSD",  label:"WTI Crude Oil",   yahooTicker:"CL=F",       category:"energy", icon:"🛢️",  decimals:2,  pipSize:0.01,   pipValuePerLot:10,   minLot:0.01,  lotUnit:"bbl"   },
  { id:"BRENTOIL",label:"Brent Crude",     yahooTicker:"BZ=F",       category:"energy", icon:"🛢️",  decimals:2,  pipSize:0.01,   pipValuePerLot:10,   minLot:0.01,  lotUnit:"bbl"   },
  { id:"NATGAS",  label:"Natural Gas",     yahooTicker:"NG=F",       category:"energy", icon:"🔥",  decimals:3,  pipSize:0.001,  pipValuePerLot:10,   minLot:0.01,  lotUnit:"MMBtu" },

  // ── Indices ──────────────────────────────────────────────────────────────────
  { id:"US500",  label:"S&P 500",          yahooTicker:"^GSPC",      category:"index",  icon:"🇺🇸",  decimals:2,  pipSize:0.1,    pipValuePerLot:10,   minLot:0.01,  lotUnit:"pts"   },
  { id:"US100",  label:"Nasdaq 100",       yahooTicker:"^NDX",       category:"index",  icon:"💻",  decimals:2,  pipSize:0.1,    pipValuePerLot:1,    minLot:0.01,  lotUnit:"pts"   },
  { id:"US30",   label:"Dow Jones",        yahooTicker:"^DJI",       category:"index",  icon:"🏛️",  decimals:2,  pipSize:0.1,    pipValuePerLot:5,    minLot:0.01,  lotUnit:"pts"   },
  { id:"UK100",  label:"FTSE 100",         yahooTicker:"^FTSE",      category:"index",  icon:"🇬🇧",  decimals:2,  pipSize:0.1,    pipValuePerLot:1.3,  minLot:0.01,  lotUnit:"pts"   },
  { id:"DE40",   label:"DAX 40",           yahooTicker:"^GDAXI",     category:"index",  icon:"🇩🇪",  decimals:2,  pipSize:0.1,    pipValuePerLot:1,    minLot:0.01,  lotUnit:"pts"   },
  { id:"JP225",  label:"Nikkei 225",       yahooTicker:"^N225",      category:"index",  icon:"🇯🇵",  decimals:2,  pipSize:1,      pipValuePerLot:0.09, minLot:0.01,  lotUnit:"pts"   },
  { id:"HK50",   label:"Hang Seng",        yahooTicker:"^HSI",       category:"index",  icon:"🇭🇰",  decimals:2,  pipSize:1,      pipValuePerLot:1.3,  minLot:0.01,  lotUnit:"pts"   },
  { id:"AU200",  label:"ASX 200",          yahooTicker:"^AXJO",      category:"index",  icon:"🇦🇺",  decimals:2,  pipSize:0.1,    pipValuePerLot:0.65, minLot:0.01,  lotUnit:"pts"   },
  { id:"FR40",   label:"CAC 40",           yahooTicker:"^FCHI",      category:"index",  icon:"🇫🇷",  decimals:2,  pipSize:0.1,    pipValuePerLot:1,    minLot:0.01,  lotUnit:"pts"   },
];

export const SYMBOL_MAP: Record<string, SymbolConfig> = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));

export const CATEGORY_LABEL: Record<SymbolCategory, string> = {
  metal:  "Metals",
  forex:  "Forex",
  crypto: "Crypto",
  energy: "Energy",
  index:  "Indices",
};

export const CATEGORY_COLOR: Record<SymbolCategory, string> = {
  metal:  "#f5c451",
  forex:  "#60a5fa",
  crypto: "#f97316",
  energy: "#34d399",
  index:  "#a78bfa",
};
