import { NextResponse } from "next/server";
import { sendTelegramMessage, formatSignalMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, setup, testMode } = body as {
      chatId: string;
      setup?: Parameters<typeof formatSignalMessage>[0];
      testMode?: boolean;
    };

    if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured on server" }, { status: 503 });
    }

    const text = testMode
      ? "✅ <b>Gold Intelligence OS</b>\n\nการเชื่อมต่อ Telegram สำเร็จ! คุณจะได้รับ signal alerts ที่นี่ 🎉"
      : setup
      ? formatSignalMessage(setup)
      : null;

    if (!text) return NextResponse.json({ error: "No message content" }, { status: 400 });

    const result = await sendTelegramMessage(chatId, text);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
