import { NextResponse, type NextRequest } from "next/server";
import { addSubscriber, removeSubscriber, isSubscribed, listSubscribers, webhookSecret, consumeLinkCode, linkSubscriber } from "@/lib/telegramSubscribers";
import { getUserTier } from "@/lib/userTier";
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
  "/start — รับแจ้งเตือนข่าว (ทุกคน)",
  "/stop — หยุดรับแจ้งเตือน",
  "/status — ดูว่าตอนนี้สมัครอยู่หรือไม่",
  "/link &lt;รหัส&gt; — ผูกกับบัญชีบนเว็บ (เอารหัสจากหน้าเว็บ)",
  "",
  "<i>วิเคราะห์ประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน</i>",
].join("\n");

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

  // "/start@GoldBot" is what group chats send. A deep link arrives as
  // "/start <payload>", which is how one tap on the website both subscribes and
  // links the account — nobody has to copy a code between two apps.
  const [head, ...rest] = text.split(/\s+/);
  const cmd = head.split("@")[0];
  const arg = rest.join(" ").trim();
  const name = chat?.first_name ?? (chat?.username ? `@${chat.username}` : chat?.title ?? "unknown");

  let reply: string;
  if ((cmd === "/start" && arg) || cmd === "/link") {
    const email = await consumeLinkCode(arg);
    if (!email) {
      reply = [
        "❌ รหัสนี้ใช้ไม่ได้",
        "",
        "รหัสใช้ได้ครั้งเดียวและหมดอายุใน 15 นาที",
        "กลับไปที่หน้าเว็บแล้วกดรับรหัสใหม่ครับ",
      ].join("\n");
    } else {
      await linkSubscriber(chatId, name, email);
      const tier = await getUserTier(email).catch(() => "free" as const);
      reply = [
        "🔗 <b>ผูกบัญชีเรียบร้อย</b>",
        "",
        `บัญชี: ${esc(email)}`,
        `ระดับ: <b>${tier}</b>`,
        "",
        tier === "free"
          ? "ระดับ free ได้รับแจ้งเตือนข่าว — อัปเกรดเป็น Premium เพื่อรับแจ้งเตือนโครงสร้างคลื่นด้วย"
          : "คุณจะได้รับทั้งข่าวและโครงสร้างคลื่น",
        "พิมพ์ /stop เพื่อหยุดรับได้ทุกเมื่อ",
      ].join("\n");
    }
  } else if (cmd === "/start") {
    const added = await addSubscriber(chatId, name);
    reply = added
      ? [
          "✅ <b>สมัครเรียบร้อย</b>",
          "",
          "📰 ข่าวที่อาจกระทบราคาทอง — <b>ทุกคน</b>",
          "〰️ โครงสร้างคลื่นระดับใหญ่เปลี่ยน — <b>Premium ขึ้นไป</b>",
          "",
          "ผูกบัญชีจากหน้าเว็บเพื่อรับตามระดับสมาชิกของคุณ",
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
    const list = await listSubscribers();
    const me = list.find((x) => x.chatId === chatId);
    if (!me) {
      reply = "🔕 ยังไม่ได้รับแจ้งเตือน — พิมพ์ /start เพื่อเริ่ม";
    } else if (me.email) {
      // Read from the account, not from anything stored here, so this says what
      // the reader will actually receive rather than what they once qualified for.
      const tier = await getUserTier(me.email).catch(() => "free" as const);
      reply = `🔔 กำลังรับแจ้งเตือนอยู่
บัญชี: ${esc(me.email)}
ระดับ: <b>${tier}</b>`;
    } else {
      reply = "🔔 กำลังรับแจ้งเตือนอยู่ (ยังไม่ได้ผูกบัญชี — ผูกแล้วจะได้รับตามระดับสมาชิก)";
    }
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
