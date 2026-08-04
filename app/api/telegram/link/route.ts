import { NextResponse } from "next/server";
import { createLinkCode, listSubscribers } from "@/lib/telegramSubscribers";
import { getApiUser, unauthorized } from "@/lib/apiAuth";
import { botUrl, botDeepLink } from "@/lib/telegramBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issue a one-time code tying this signed-in account to a Telegram chat.
 *
 * The web issues it because the web is where a subscription is bought, so the
 * web holds the truth about what someone is entitled to. The bot only learns
 * which account it is talking to; it never decides the tier.
 *
 * POST, not GET: it mints a credential. A GET would be prefetched by browsers
 * and link scanners, quietly burning codes nobody asked for.
 */
export async function POST() {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const code = await createLinkCode(user.email);
  return NextResponse.json({
    // One tap does both: Telegram delivers "?start=<code>" to the bot as
    // "/start <code>", so subscribing and linking happen together and nobody
    // copies a code between two apps.
    deepLink: botDeepLink(code),
    botUrl: botUrl(),
    code,
    expiresInMin: 15,
    tier: user.tier,
  });
}

/** Whether this account already has a chat linked, for the page to render. */
export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const subs = await listSubscribers();
  const mine = subs.find((s) => s.email === user.email);
  return NextResponse.json({
    linked: !!mine,
    linkedAt: mine?.linkedAt ?? null,
    name: mine?.name ?? null,
    tier: user.tier,
    botUrl: botUrl(),
  });
}
