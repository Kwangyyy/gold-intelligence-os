import { NextResponse, type NextRequest } from "next/server";
import { runEventWatch } from "@/lib/eventWatchRun";
import { describeChat } from "@/lib/telegram";
import { getApiAdmin, isCronRequest, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Two callers, as with the council alert: a scheduler holding CRON_SECRET, and
 * an admin looking at the page. Anything else is refused before any work — this
 * endpoint can push to the Telegram channel.
 *
 * The scan itself lives in lib/eventWatchRun so ordinary traffic can drive it
 * too. GitHub Actions asks for every fifteen minutes and delivers roughly every
 * eighty-five, so the schedule is the floor for when nobody is using the app,
 * not the clock.
 *
 * `?dry=1` scans and reports without sending, so the threshold can be tuned
 * against live headlines without spamming subscribers.
 * `?whoami=1` says which chat the configured id points at, and sends nothing.
 */
export async function GET(req: NextRequest) {
  const viaCron = isCronRequest(req);
  const isAdmin = !viaCron && (await getApiAdmin());
  if (!viaCron && !isAdmin) return unauthorized();

  const dry = req.nextUrl.searchParams.get("dry") === "1";

  if (req.nextUrl.searchParams.get("whoami") === "1") {
    const who = await describeChat(process.env.TELEGRAM_CHANNEL_ID || "");
    return NextResponse.json({
      botTokenSet: !!process.env.TELEGRAM_BOT_TOKEN,
      channelIdSet: !!process.env.TELEGRAM_CHANNEL_ID,
      ...who,
    });
  }

  try {
    return NextResponse.json(await runEventWatch(dry));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
