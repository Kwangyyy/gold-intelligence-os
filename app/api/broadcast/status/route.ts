import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    botSet:     !!process.env.TELEGRAM_BOT_TOKEN,
    channelSet: !!process.env.TELEGRAM_CHANNEL_ID,
  });
}
