import { NextResponse, type NextRequest } from "next/server";
import { scanEvents, alreadySent, markSent, CATEGORY_LABEL, type WatchedEvent } from "@/lib/eventWatch";
import { getGoldSpot } from "@/lib/goldSource";
import { sendTelegramMessage, describeChat } from "@/lib/telegram";
import { getApiAdmin, isCronRequest, unauthorized } from "@/lib/apiAuth";
import { kvGet, kvSet } from "@/lib/kvStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Only alert on things that would change a decision. The scanner sees a hundred
// headlines a poll; most are coverage, not events.
const ALERT_THRESHOLD = 45;

// One message, several stories. On a quiet day this sends nothing; on a day
// like the current Iran/US escalation the scanner legitimately finds nearly
// thirty gold-relevant headlines in twelve hours, and thirty separate pushes
// would train the reader to ignore the channel. The cooldown is what keeps a
// real story from becoming spam — not filtering the story out.
const MAX_PER_ALERT = 4;
const COOLDOWN_MS = 30 * 60_000;
const COOLDOWN_KEY = "gios:event-watch:last-alert";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatAlert(events: WatchedEvent[], gold: number): string {
  const now = new Date().toLocaleString("th-TH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
  });

  const lines = [
    `🚨 <b>เหตุการณ์ที่อาจกระทบทองคำ</b>`,
    `💵 XAUUSD <code>${gold.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</code> · 🕐 ${now}`,
    ``,
  ];

  for (const e of events) {
    const arrow = e.goldBias === "bullish" ? "▲ หนุนทอง" : e.goldBias === "bearish" ? "▼ กดทอง" : "• ไม่ชัด";
    lines.push(`${CATEGORY_LABEL[e.category]} · <b>${arrow}</b> · แรง ${e.severity}/100`);
    lines.push(`<a href="${esc(e.link)}">${esc(e.title)}</a>`);
    lines.push(`<i>${esc(e.source)}</i>`);
    lines.push("");
  }

  lines.push(
    `<i>รวบรวมจากพาดหัวข่าว (Google News) — เป็นสัญญาณว่ามีการรายงาน ไม่ใช่ข้อเท็จจริงที่ตรวจสอบแล้ว กดลิงก์อ่านต้นทางก่อนตัดสินใจ</i>`,
  );
  return lines.join("\n");
}

/**
 * Two callers, as with the council alert: a scheduler holding CRON_SECRET, and
 * an admin looking at the page. Anything else is refused before any work — this
 * endpoint can push to the Telegram channel.
 *
 * `?dry=1` scans and reports without sending, so the threshold can be tuned
 * against live headlines without spamming subscribers.
 */
export async function GET(req: NextRequest) {
  const viaCron = isCronRequest(req);
  const isAdmin = !viaCron && (await getApiAdmin());
  if (!viaCron && !isAdmin) return unauthorized();

  const dry = req.nextUrl.searchParams.get("dry") === "1";

  try {
    const events = await scanEvents();
    const candidates = events.filter((e) => e.severity >= ALERT_THRESHOLD);

    const sent = await alreadySent();
    const unseen = candidates.filter((e) => !sent.has(e.id));
    const fresh = unseen.slice(0, MAX_PER_ALERT);

    const last = await kvGet<number>(COOLDOWN_KEY);
    const cooling = !dry && last != null && Date.now() - last < COOLDOWN_MS;
    if (cooling && fresh.length) {
      return NextResponse.json({
        sent: false,
        reason: `cooling down — ${Math.ceil((COOLDOWN_MS - (Date.now() - last!)) / 60_000)} min left`,
        waiting: unseen.length,
        topWaiting: unseen.slice(0, 3).map((e) => ({ title: e.title, severity: e.severity })),
        scanned: events.length,
      });
    }

    if (dry || !fresh.length) {
      return NextResponse.json({
        scanned: events.length,
        aboveThreshold: candidates.length,
        newSinceLastAlert: fresh.length,
        wouldSend: dry ? fresh : [],
        events: events.slice(0, 20),
        sent: false,
        reason: dry ? "dry run" : "nothing new above threshold",
      });
    }

    const chatId = process.env.TELEGRAM_CHANNEL_ID || "";
    if (!chatId) {
      return NextResponse.json({
        sent: false,
        reason: "Telegram not configured (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID)",
        newSinceLastAlert: fresh.length,
        preview: formatAlert(fresh, 0),
      });
    }

    const spot = await getGoldSpot().catch(() => null);
    const send = await sendTelegramMessage(chatId, formatAlert(fresh, spot?.price ?? 0));

    // Only mark as sent if it actually went out, so a Telegram outage does not
    // silently swallow the alert.
    if (send.ok) {
      await markSent(fresh.map((e) => e.id));
      await kvSet(COOLDOWN_KEY, Date.now(), Math.ceil(COOLDOWN_MS / 1000));
    }

    return NextResponse.json({
      sent: send.ok,
      error: send.error,
      alerted: fresh.map((e) => ({ title: e.title, severity: e.severity, category: e.category })),
      scanned: events.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
