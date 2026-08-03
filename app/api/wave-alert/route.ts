import { NextResponse, type NextRequest } from "next/server";
import { checkWaveAlert } from "@/lib/waveAlert";
import { getApiAdmin, isCronRequest, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Push to the channel when the wave count changes at a degree worth reporting.
 *
 * Same two callers as the event watcher — a scheduler holding CRON_SECRET, or an
 * admin — because this can push to Telegram. Driven from ordinary traffic as
 * well; see lib/eventWatchRun.
 *
 * `?dry=1` reports what it would say and sends nothing.
 */
export async function GET(req: NextRequest) {
  const viaCron = isCronRequest(req);
  const isAdmin = !viaCron && (await getApiAdmin());
  if (!viaCron && !isAdmin) return unauthorized();

  try {
    return NextResponse.json(await checkWaveAlert(req.nextUrl.searchParams.get("dry") === "1"));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
