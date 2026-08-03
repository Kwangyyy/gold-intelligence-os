import { NextResponse, type NextRequest } from "next/server";
import { addSubscriber, removeSubscriber, isSubscribed, listSubscribers, webhookSecret } from "@/lib/telegramSubscribers";
import { sendTelegramMessage } from "@/lib/telegram";
import { kvSet } from "@/lib/kvStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where Telegram delivers what readers type at the bot.
 *
 * This endpoint has to be public — Telegram calls it, and it cannot hold a
 * session. So the shared secret is the whole of the access control: Telegram
 * sends it in a header it was given at registration, and anything arriving
 * without it is discarded before a single field of the body is read. Without
 * that check this is an open endpoint that acts on whatever it is posted,
 * including a forged chat id subscribing someone else.
 *
 * Always answers 200. Telegram retries anything else, and a retry loop over a
 * message we could not parse achieves nothing.
 */

const HELP = [
  "🤖 <b>Gold Intelligence — แจ้งเตือน</b>",
  "",
  "/start — รับแจ้งเตือนข่าวและโครงสร้างคลื่น",
  "/stop — หยุดรับแจ้งเตือน",
  "/status — ดูว่าตอนนี้สมัครอยู่หรือไม่",
  "",
  "<i>วิเคราะห์ประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน</i>",
].join("\n");

interface Update {
  message?: {
    chat?: { id?: number; type?: string; first_name?: string; username?: string; title?: string };
    text?: string;
  };
}

export async function POST(req: NextRequest) {
  // Every outcome is recorded, because from outside this endpoint is opaque:
  // a bot that does not answer looks identical whether Telegram never called,
  // called and was refused, or called and the reply failed. Those need
  // different fixes and guessing between them wastes an evening.
  const secret = await webhookSecret();
  const presented = req.headers.get("x-telegram-bot-api-secret-token");
  // No stored secret means the webhook was never registered, or the store lost
  // it. Either way there is nothing to verify against, and accepting anyway
  // would leave the endpoint open. Recorded distinctly so the page can say which
  // of the two it is instead of just "refused".
  if (secret == null || presented !== secret) {
    await kvSet(
      "gios:tg:last-reject",
      { at: Date.now(), hadHeader: presented != null, noStoredSecret: secret == null },
      7 * 86_400,
    ).catch(() => {});
    // Deliberately terse and deliberately 401. Nothing about the bot, the list
    // or the expected shape leaks to whoever is probing.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chat = update.message?.chat;
  const chatId = chat?.id;
  const text = (update.message?.text ?? "").trim().toLowerCase();
  if (!chatId || !text.startsWith("/")) return NextResponse.json({ ok: true });

  // "/start@GoldBot" is what group chats send.
  const cmd = text.split(/[\s@]/)[0];
  const name = chat?.first_name ?? (chat?.username ? `@${chat.username}` : chat?.title ?? "unknown");

  let reply: string;
  if (cmd === "/start") {
    const added = await addSubscriber(chatId, name);
    reply = added
      ? [
          "✅ <b>สมัครเรียบร้อย</b>",
          "",
          "คุณจะได้รับแจ้งเตือนเมื่อ:",
          "• มีข่าวหรือเหตุการณ์ที่อาจกระทบราคาทอง",
          "• โครงสร้างคลื่นระดับใหญ่เปลี่ยน",
          "",
          "พิมพ์ /stop เพื่อหยุดรับได้ทุกเมื่อ",
          "",
          "<i>วิเคราะห์ประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน</i>",
        ].join("\n")
      : "คุณสมัครอยู่แล้วครับ — พิมพ์ /stop หากต้องการหยุดรับ";
  } else if (cmd === "/stop") {
    const removed = await removeSubscriber(chatId);
    reply = removed
      ? "🔕 หยุดรับแจ้งเตือนแล้ว — พิมพ์ /start เมื่อต้องการกลับมารับอีกครั้ง"
      : "คุณยังไม่ได้สมัครรับแจ้งเตือนครับ — พิมพ์ /start เพื่อเริ่ม";
  } else if (cmd === "/status") {
    reply = (await isSubscribed(chatId))
      ? `🔔 กำลังรับแจ้งเตือนอยู่ (ผู้รับทั้งหมด ${(await listSubscribers()).length} คน)`
      : "🔕 ยังไม่ได้รับแจ้งเตือน — พิมพ์ /start เพื่อเริ่ม";
  } else {
    reply = HELP;
  }

  // The reply was fire-and-forget before. If it failed, the reader saw silence
  // and the log said nothing had gone wrong.
  const sent = await sendTelegramMessage(String(chatId), reply);
  await kvSet(
    "gios:tg:last-update",
    { at: Date.now(), cmd, replied: sent.ok, replyError: sent.error ?? null },
    7 * 86_400,
  ).catch(() => {});
  return NextResponse.json({ ok: true });
}
