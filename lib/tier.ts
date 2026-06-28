"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Subscription tiers (PRD §8). This is a FRONT-END PREVIEW of the tiered product —
// not real authentication, billing, or security. Default is "pro" so the demo is
// fully explorable; switching down demonstrates the upgrade/gating UX.
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

interface TierContextValue {
  tier: Tier;
  setTier: (t: Tier) => void;
}

const TierContext = createContext<TierContextValue | null>(null);

export function TierProvider({ children }: { children: ReactNode }) {
  const [tier, setTierState] = useState<Tier>("pro");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("gios.tier") : null;
    if (saved === "free" || saved === "premium" || saved === "pro") setTierState(saved);
  }, []);

  const setTier = useCallback((t: Tier) => {
    setTierState(t);
    if (typeof window !== "undefined") window.localStorage.setItem("gios.tier", t);
  }, []);

  const value = useMemo<TierContextValue>(() => ({ tier, setTier }), [tier, setTier]);
  return createElement(TierContext.Provider, { value }, children);
}

export function useTier(): TierContextValue {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error("useTier must be used within TierProvider");
  return ctx;
}
