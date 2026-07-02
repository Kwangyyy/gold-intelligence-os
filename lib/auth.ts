import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import {
  getUserTier, isAdmin,
  isPendingUser, isRejectedUser, hasAnyRecord,
  addPendingUser,
} from "./userTier";
import { notifyNewUserRegistered } from "./notify";
import type { Tier } from "./tierConfig";

const TIER_REFRESH_MS = 5 * 60_000; // re-check Redis at most every 5 minutes

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, trigger }) {
      const email = token.email as string | undefined;
      if (!email) return token;

      const checkedAt = (token.tierCheckedAt as number | undefined) ?? 0;
      const isFirstSignIn = trigger === "signIn";
      const needsRefresh = isFirstSignIn || Date.now() - checkedAt > TIER_REFRESH_MS;

      if (!needsRefresh) return token;

      // 1. Super-admin / dynamic admin → always pro, skip queue
      if (await isAdmin(email)) {
        token.tier    = "pro" satisfies Tier;
        token.isAdmin = true;
        token.pending = false;
        token.tierCheckedAt = Date.now();
        return token;
      }

      // 2. Rejected → block (shown as "pending" to avoid leaking info)
      if (await isRejectedUser(email)) {
        token.tier    = "rejected" as Tier;
        token.isAdmin = false;
        token.pending = false;
        token.tierCheckedAt = Date.now();
        return token;
      }

      // 3. Already in pending queue
      if (await isPendingUser(email)) {
        token.tier    = "pending" as Tier;
        token.isAdmin = false;
        token.pending = true;
        token.tierCheckedAt = Date.now();
        return token;
      }

      // 4. Existing approved user → return their tier
      if (await hasAnyRecord(email)) {
        token.tier    = await getUserTier(email);
        token.isAdmin = false;
        token.pending = false;
        token.tierCheckedAt = Date.now();
        return token;
      }

      // 5. FIRST TIME LOGIN — add to pending queue + notify admin
      await addPendingUser({
        email,
        name:         (token.name as string)    ?? email,
        picture:      (token.picture as string) ?? "",
        registeredAt: new Date().toISOString(),
      });
      notifyNewUserRegistered({
        email,
        name: (token.name as string) ?? email,
      }).catch(() => {});  // fire-and-forget, never block sign-in

      token.tier    = "pending" as Tier;
      token.isAdmin = false;
      token.pending = true;
      token.tierCheckedAt = Date.now();
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      if (session.user) {
        (session.user as { tier?: Tier }).tier        = (token.tier as Tier) ?? "free";
        (session.user as { isAdmin?: boolean }).isAdmin = (token.isAdmin as boolean) ?? false;
        (session.user as { pending?: boolean }).pending = (token.pending as boolean) ?? false;
      }
      return session;
    },
  },
};
