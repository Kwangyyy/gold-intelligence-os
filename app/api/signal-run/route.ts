import { NextResponse, type NextRequest } from "next/server";
import { runScheduledSignal } from "@/lib/signalRun";
import { getApiAdmin, isCronRequest, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Log a signal now, if it is time and nothing is open.
 *
 * Same two callers as the other pushable endpoints — a scheduler holding
 * CRON_SECRET, or an admin — because this writes to the record the app will
 * later be judged on. Traffic drives it too; see lib/eventWatchRun.
 *
 * `?force=1` ignores the hourly throttle and the open-position rule. For
 * checking the path works, not for filling the log: forcing entries would put
 * trades in the record that the policy would not have taken.
 */
export async function GET(req: NextRequest) {
  const viaCron = isCronRequest(req);
  const isAdmin = !viaCron && (await getApiAdmin());
  if (!viaCron && !isAdmin) return unauthorized();

  try {
    return NextResponse.json(await runScheduledSignal(req.nextUrl.searchParams.get("force") === "1"));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
