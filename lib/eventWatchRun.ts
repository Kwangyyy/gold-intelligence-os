// One scan-and-send, callable from more than the cron route.
//
// Why this was pulled out of the route: GitHub Actions is the only scheduler on
// the free tier and it does not keep to its schedule. The workflow asks for
// every 15 minutes; measured over fourteen consecutive runs the real gaps were
// 58, 60, 63, 67, 70, 71, 75, 84, 94, 95, 100, 124 and 161 minutes — averaging
// about 85. For a watcher meant to catch a missile strike or a Trump statement,
// an hour and a half is a different product from fifteen minutes.
//
// Real traffic is the scheduler that is already reliable. The chart polls
// /api/gold-live every five seconds, so whenever anyone has the app open the
// watch runs on time, and the GitHub schedule becomes the floor for when nobody
// does rather than the only clock.
//
// Route handlers may only export handlers, which is why this lives here.

import { scanEvents, alreadySent, markSent, CATEGORY_LABEL, type WatchedEvent } from "./eventWatch";
import { getGoldSpot } from "./goldSource";
import { broadcastToSubscribers } from "./telegram";
import { kvGet, kvSet } from "./kvStore";
import { checkWaveAlert } from "./waveAlert";
import { waitUntil } from "@vercel/functions";

// Only alert on things that would change a decision. The scanner sees a hundred
// headlines a poll; most are coverage, not events.
export const ALERT_THRESHOLD = 45;

// One message, several stories. On a quiet day this sends nothing; on a day of
// real escalation the scanner legitimately finds nearly thirty gold-relevant
// headlines in twelve hours, and thirty separate pushes would train the reader
// to ignore the channel. The cooldown is what keeps a real story from becoming
// spam — not filtering the story out.
export const MAX_PER_ALERT = 4;
export const COOLDOWN_MS = 30 * 60_000;
export const COOLDOWN_KEY = "gios:event-watch:last-alert";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatAlert(events: WatchedEvent[], gold: number): string {
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

export interface WatchResult {
  scanned: number;
  aboveThreshold: number;
  newSinceLastAlert: number;
  wouldSend: WatchedEvent[];
  events: WatchedEvent[];
  sent: boolean;
  reason?: string;
  error?: string;
  to?: string;
  alerted?: { title: string; severity: number; category: string }[];
  waiting?: number;
  preview?: string;
  lastTrafficScan?: { at: number; sent: boolean; scanned: number; waveSent?: boolean; agoMin: number } | null;
  /** Channel plus subscribers, and how many were dropped for blocking the bot. */
  delivery?: { sent: number; failed: number; dropped: number; channel: boolean };
}

/** Scan the feeds and, unless `dry`, push anything new to the channel. */
export async function runEventWatch(dry = false): Promise<WatchResult> {
  const events = await scanEvents();
  const trafficScan = await lastTrafficScan();
  const candidates = events.filter((e) => e.severity >= ALERT_THRESHOLD);

  const sent = await alreadySent();
  const unseen = candidates.filter((e) => !sent.has(e.id));
  const fresh = unseen.slice(0, MAX_PER_ALERT);

  const base = {
    lastTrafficScan: trafficScan,
    scanned: events.length,
    aboveThreshold: candidates.length,
    newSinceLastAlert: fresh.length,
    wouldSend: dry ? fresh : [],
    events: events.slice(0, 20),
  };

  const last = await kvGet<number>(COOLDOWN_KEY);
  const cooling = !dry && last != null && Date.now() - last < COOLDOWN_MS;
  if (cooling && fresh.length) {
    return {
      ...base,
      wouldSend: [],
      events: [],
      sent: false,
      reason: `cooling down — ${Math.ceil((COOLDOWN_MS - (Date.now() - last!)) / 60_000)} min left`,
      waiting: unseen.length,
    };
  }

  if (dry || !fresh.length) {
    return { ...base, sent: false, reason: dry ? "dry run" : "nothing new above threshold" };
  }

  const chatId = process.env.TELEGRAM_CHANNEL_ID || "";
  if (!chatId) {
    return {
      ...base,
      sent: false,
      reason: "Telegram not configured (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID)",
      preview: formatAlert(fresh, 0),
    };
  }

  const spot = await getGoldSpot().catch(() => null);
  // Channel plus everyone who subscribed to the bot themselves.
  const fan = await broadcastToSubscribers(formatAlert(fresh, spot?.price ?? 0));
  const send = { ok: fan.channel || fan.sent > 0, error: undefined as string | undefined, to: undefined as string | undefined };

  // Only mark as sent if it actually went out, so a Telegram outage does not
  // silently swallow the alert.
  if (send.ok) {
    await markSent(fresh.map((e) => e.id));
    await kvSet(COOLDOWN_KEY, Date.now(), Math.ceil(COOLDOWN_MS / 1000));
  }

  return {
    ...base,
    events: [],
    wouldSend: [],
    sent: send.ok,
    error: send.error,
    // Named, not merely claimed: a delivery report that does not say where it
    // went cannot distinguish "sent" from "sent somewhere else".
    to: send.to,
    delivery: fan,
    alerted: fresh.map((e) => ({ title: e.title, severity: e.severity, category: e.category })),
  };
}

// How often traffic is allowed to trigger a scan. This is the interval the
// workflow asks GitHub for and does not get; here it is actually honoured,
// because the trigger is a request that already happened.
const TRAFFIC_KEY = "gios:event-watch:last-scan";
const TRAFFIC_EVERY = 15 * 60_000;

// Written *after* a traffic-driven scan finishes, which is the whole point of
// having it: the throttle above is claimed before the scan, so it proves only
// that something started. On a serverless host, work left running after the
// response has been sent may be frozen mid-flight, and this is the only way to
// tell a scan that completed from one that was killed on the way. Reported by
// the endpoint so it can be checked from outside.
const TRAFFIC_DONE_KEY = "gios:event-watch:last-traffic-scan";

let inFlight = false;

/**
 * Run the watch off the back of ordinary traffic, at most every 15 minutes.
 *
 * Returns immediately and never throws. The caller is serving a user — a five
 * second poll for the live price must not wait on seven RSS feeds, and must not
 * fail because one of them did.
 */
export function triggerFromTraffic(): void {
  if (inFlight) return;
  inFlight = true;
  const work = (async () => {
    try {
      const last = await kvGet<number>(TRAFFIC_KEY);
      if (last != null && Date.now() - last < TRAFFIC_EVERY) return;
      // Claimed before the scan, not after, so two instances waking together do
      // not both scan. A crash mid-scan costs one interval, which is the right
      // way round: scanning twice sends the same story twice.
      await kvSet(TRAFFIC_KEY, Date.now(), Math.ceil(TRAFFIC_EVERY / 1000));
      const r = await runEventWatch(false);
      // The wave check rides the same clock. It reads candles the wave chart has
      // usually already cached, and keeping one throttle for both means the two
      // pushes cannot arrive on different schedules and contradict each other
      // about what the price was when they were written.
      const w = await checkWaveAlert(false).catch(() => null);
      await kvSet(
        TRAFFIC_DONE_KEY,
        { at: Date.now(), sent: r.sent, scanned: r.scanned, waveSent: !!w?.sent },
        86_400,
      );
    } catch {
      // Nothing here is worth surfacing to whoever happened to load a chart.
    } finally {
      inFlight = false;
    }
  })();

  // Hand the work to the platform, or it does not finish.
  //
  // Simply letting the promise run was the first attempt, and measuring it
  // showed why that fails: a serverless instance is frozen the moment the
  // response is sent, so the scan was killed part-way and the completion marker
  // was still null after several requests. The app looked like it had a
  // fifteen-minute watcher and had nothing. waitUntil is the platform's answer
  // to exactly this — it keeps the instance alive for the promise without the
  // caller waiting on it.
  try {
    waitUntil(work);
  } catch {
    // Not on Vercel — locally the process lives on regardless.
  }
}

/** When traffic last drove a scan to completion, for checking that it does. */
export async function lastTrafficScan(): Promise<WatchResult["lastTrafficScan"]> {
  const v = await kvGet<{ at: number; sent: boolean; scanned: number; waveSent?: boolean }>(TRAFFIC_DONE_KEY).catch(() => null);
  if (!v) return null;
  return { ...v, agoMin: Math.round((Date.now() - v.at) / 60_000) };
}
