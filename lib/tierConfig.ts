// Tier definitions shared by client components, server routes, and middleware.
// No "use client" / Node-only imports here — must stay Edge-runtime safe.

export type Tier = "free" | "premium" | "pro";

export const TIER_RANK: Record<Tier, number> = { free: 0, premium: 1, pro: 2 };

// Minimum tier required per route (mapped from PRD §8 permissions).
export const ROUTE_MIN_TIER: Record<string, Tier> = {
  "/": "free",
  "/chart": "free",
  "/technical": "premium",
  "/indicators": "premium",
  "/plan": "premium",
  "/risk": "premium",
  "/levels": "premium",
  "/correlation": "pro",
  "/smc": "pro",
  "/whatif": "pro",
  "/portfolio": "pro",
  "/alerts": "pro",
  "/chat": "pro",
  "/content": "pro",
  "/calendar": "premium",
  "/journal": "premium",
  "/ea-builder": "pro",
  "/backtest": "pro",
  "/ai-ea":        "pro",
  "/sr-indicator": "pro",
  "/cme-oi":       "pro",
  "/ea-monitor":   "pro",
  "/ai-model":         "pro",
  "/ai-model/history": "pro",
  "/trade-ideas":      "pro",
  "/market-regime":   "premium",
  "/forecast":        "pro",
  "/patterns":        "premium",
  "/sessions":        "premium",
  "/brief":   "pro",
  "/scanner":     "premium",
  "/seasonality": "pro",
  "/paper":       "free",
  "/news":        "premium",
};

export function minTierFor(route: string): Tier {
  return ROUTE_MIN_TIER[route] ?? "free";
}

export function canAccess(tier: Tier, route: string): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minTierFor(route)];
}
