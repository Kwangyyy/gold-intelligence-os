import { NextResponse } from "next/server";
import { getApiAdmin, unauthorized } from "@/lib/apiAuth";
import { kvDurable } from "@/lib/kvStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Reveals *whether* each server secret is configured — never its value, and
  // admin only. Booleans, so this is safe to read from the browser.
  if (!(await getApiAdmin())) return unauthorized();

  const botSet = !!process.env.TELEGRAM_BOT_TOKEN;
  const channelSet = !!process.env.TELEGRAM_CHANNEL_ID;
  // Vercel only attaches `Authorization: Bearer <CRON_SECRET>` to a cron
  // invocation when the variable exists, and isCronRequest() rejects every
  // request when it does not. Unset means the daily council alert has been
  // answering 401 to its own scheduler — invisible from outside, since an
  // unauthenticated probe gets 401 either way. Hence this flag.
  const cronSecretSet = !!process.env.CRON_SECRET;

  const blockers: string[] = [];
  if (!cronSecretSet) blockers.push("CRON_SECRET is unset — the daily cron gets 401 and no alert is ever sent");
  if (!botSet) blockers.push("TELEGRAM_BOT_TOKEN is unset — nothing can be sent");
  if (!channelSet) blockers.push("TELEGRAM_CHANNEL_ID is unset — there is no channel to send to");
  if (!kvDurable()) blockers.push("UPSTASH_REDIS_REST_URL/_TOKEN unset — dedup and rate-limit are per-instance only, so alerts can repeat");

  return NextResponse.json({
    botSet,
    channelSet,
    cronSecretSet,
    dedupDurable: kvDurable(),
    dailyAlertReady: cronSecretSet && botSet && channelSet,
    blockers,
  });
}
