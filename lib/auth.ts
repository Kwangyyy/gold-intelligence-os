import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { getUserTier, isAdmin } from "./userTier";
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
    async jwt({ token }) {
      const checkedAt = (token.tierCheckedAt as number | undefined) ?? 0;
      if (token.email && Date.now() - checkedAt > TIER_REFRESH_MS) {
        token.tier    = await getUserTier(token.email as string);
        token.isAdmin = await isAdmin(token.email as string);
        token.tierCheckedAt = Date.now();
      }
      if (!token.tier) token.tier = "free" satisfies Tier;
      if (token.isAdmin === undefined) token.isAdmin = false;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      if (session.user) {
        (session.user as { tier?: Tier }).tier       = (token.tier as Tier) ?? "free";
        (session.user as { isAdmin?: boolean }).isAdmin = (token.isAdmin as boolean) ?? false;
      }
      return session;
    },
  },
};
