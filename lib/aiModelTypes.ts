// Shared types and constants for AI Model Training feature
// Exported from lib/ so both API route and page can import safely

export const FEATURE_NAMES = [
  "RSI14", "MACD_hist", "EMA_diff%", "BB_pctB",
  "ATR%", "Momentum%", "Stoch_K", "Stoch_D",
  "Body%", "Return_1", "Return_2", "Return_3",
  "DayOfWeek", "VolRatio",
] as const;

export interface ModelDataPayload {
  features:     number[][];
  labels:       number[];
  featureNames: readonly string[];
  labelCounts:  { buy: number; sell: number; hold: number };
  n:            number;
  dates:        string[];
  lastFeature:  number[];
  priceRange:   { min: number; max: number };
  closes:       number[];
}
