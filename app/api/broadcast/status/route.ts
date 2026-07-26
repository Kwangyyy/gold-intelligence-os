import { NextResponse } from "next/server";
import { getApiAdmin, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Reveals which server secrets are configured — admin only.
  if (!(await getApiAdmin())) return unauthorized();

  return NextResponse.json({
    botSet:     !!process.env.TELEGRAM_BOT_TOKEN,
    channelSet: !!process.env.TELEGRAM_CHANNEL_ID,
  });
}
