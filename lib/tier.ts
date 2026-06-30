"use client";

import { useSession } from "next-auth/react";
import type { Tier } from "./tierConfig";

export { TIER_RANK, ROUTE_MIN_TIER, minTierFor, canAccess } from "./tierConfig";
export type { Tier } from "./tierConfig";

// Tier now comes from the signed-in user's session (set server-side in
// lib/auth.ts via lib/userTier.ts), not localStorage. Logged-out users are
// always "free". There is no client-side setTier anymore — tier can only
// change by editing the record in Redis (see lib/userTier.ts), since there's
// no self-serve billing flow yet.
export function useTier(): { tier: Tier } {
  const { data: session } = useSession();
  const tier = (session?.user as { tier?: Tier } | undefined)?.tier;
  return { tier: tier ?? "free" };
}
