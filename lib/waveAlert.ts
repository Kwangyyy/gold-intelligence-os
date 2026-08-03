// Tell the channel when the wave count changes, and only when that means
// something.
//
// Which degrees to watch was measured, not guessed. Replaying the counter across
// forty days of 4H bars, recomputing from scratch at every bar:
//
//   degree         changes   one per      reversed within 12h
//   Primary              0   never        0
//   Intermediate        10   4.0 days     0
//   Minor               39   1.0 days     9
//   Minute               3   13.3 days    1
//
// Intermediate is the one worth a push: a change every four days, and in forty
// days not one of them was taken back. Minor changes daily and reverses a
// quarter of the time — alerting on it would mean a message most days, several
// of which the chart would contradict by morning. Primary is watched because
// when it does move, it is the most important thing the app can say.
//
// The replay recomputed on closed bars. Live, the count is formed on a bar still
// printing, which is noisier than that measurement can show — hence the
// confirmation below.

import { countMultiSource, lineageOf, type DegreeLevel } from "./waveHierarchy";
import { getGoldCandles } from "./goldSource";
import { getGoldSpot } from "./goldSource";
import { sendTelegramMessage } from "./telegram";
import { kvGet, kvSet } from "./kvStore";

const WATCHED = ["Primary", "Intermediate"] as const;

const STATE_KEY = "gios:wave-alert:state";

interface DegreeState {
  label: string;
  structure: string;
  complete: boolean;
  confidence: number;
}
export type Snapshot = Record<string, DegreeState>;

export interface Stored {
  /** What the channel was last told. */
  alerted: Snapshot | null;
  /** A change waiting to be seen a second time before it is believed. */
  pending: { snap: Snapshot; seen: number } | null;
  lineage?: string;
}

function snapshotOf(levels: DegreeLevel[]): Snapshot {
  const out: Snapshot = {};
  for (const deg of WATCHED) {
    const l = levels.find((x) => x.degree === deg);
    if (!l) continue;
    out[deg] = {
      label: l.currentLabel,
      structure: l.structure,
      complete: l.patternComplete,
      confidence: l.confidence,
    };
  }
  return out;
}

/** Only the things a reader would call a change. Confidence drifting does not. */
function changedDegrees(a: Snapshot | null, b: Snapshot): string[] {
  if (!a) return [];
  return WATCHED.filter((d) => {
    const x = a[d], y = b[d];
    if (!x || !y) return !!x !== !!y;
    return x.label !== y.label || x.structure !== y.structure || x.complete !== y.complete;
  });
}

const sameSnap = (a: Snapshot, b: Snapshot) =>
  WATCHED.every((d) => !changedDegrees({ [d]: a[d] } as Snapshot, { [d]: b[d] } as Snapshot).length);

const TH_STRUCTURE: Record<string, string> = {
  impulse: "อิมพัลส์ 5 คลื่น",
  terminal: "ไดอะโกนอล (terminal)",
  flat: "แฟลต",
  zigzag: "ซิกแซก",
  unclear: "ยังไม่ชัด",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatWaveAlert(
  changed: string[],
  before: Snapshot | null,
  now: Snapshot,
  lineage: string,
  gold: number,
): string {
  const when = new Date().toLocaleString("th-TH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
  });

  const lines = [
    `〰️ <b>โครงสร้างคลื่นเปลี่ยน</b>`,
    `💵 XAUUSD <code>${gold.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</code> · 🕐 ${when}`,
    ``,
  ];

  for (const deg of changed) {
    const b = before?.[deg], n = now[deg];
    if (!n) continue;
    lines.push(`<b>${esc(deg)}</b>`);
    if (b) lines.push(`เดิม: ${esc(b.label)} · ${esc(TH_STRUCTURE[b.structure] ?? b.structure)}${b.complete ? " (จบแล้ว)" : ""}`);
    lines.push(`ตอนนี้: <b>${esc(n.label)}</b> · ${esc(TH_STRUCTURE[n.structure] ?? n.structure)}${n.complete ? " (จบแล้ว)" : ""}`);
    lines.push(`กฎที่ผ่าน ${n.confidence}%`);
    lines.push("");
  }

  lines.push(`ลำดับชั้น: <code>${esc(lineage)}</code>`);
  lines.push("");
  lines.push(
    `<i>การนับคลื่นเป็นการตีความ ไม่ใช่การพยากรณ์ — นับแบบอื่นที่ถูกกฎก็มีได้ ดูกราฟและกฎประกอบก่อนตัดสินใจ</i>`,
  );
  return lines.join("\n");
}

export type Action = "baseline" | "quiet" | "wait" | "send";

/**
 * What to do about the current count, given what the channel was last told.
 *
 * Pure, and separated out because both ways of getting this wrong are silent.
 * Confirm too eagerly and the channel gets a message every time a forming bar
 * wobbles; confirm too strictly and a real structural change is never announced
 * at all. Neither shows up as an error anywhere.
 */
export function decide(stored: Stored, now: Snapshot): {
  action: Action; changed: string[]; reason: string; store: Stored | null;
} {
  // Nothing to compare against. Record and stay quiet, so the first run after a
  // deploy does not announce a change that never happened.
  if (!stored.alerted) {
    return {
      action: "baseline", changed: [], reason: "first run — baseline recorded",
      store: { alerted: now, pending: null },
    };
  }

  const changed = changedDegrees(stored.alerted, now);
  if (!changed.length) {
    // A candidate that went away before it was confirmed is dropped, which is
    // the whole point of confirming.
    return {
      action: "quiet", changed: [], reason: "no change at a watched degree",
      store: stored.pending ? { ...stored, pending: null } : null,
    };
  }

  if (stored.pending && sameSnap(stored.pending.snap, now)) {
    return { action: "send", changed, reason: "confirmed", store: null };
  }

  return {
    action: "wait", changed, reason: "change seen once — waiting for it to hold",
    store: { ...stored, pending: { snap: now, seen: Date.now() } },
  };
}

export interface WaveAlertResult {
  changed: string[];
  sent: boolean;
  reason: string;
  lineage: string;
  to?: string;
  error?: string;
  preview?: string;
}

/**
 * Check the count and push if a watched degree has moved.
 *
 * A change must be seen twice before it is sent. The replay above found no
 * reversals at Intermediate, but it recomputed on closed bars only — live, the
 * newest bar is still forming and can pull the fit either way for an hour. One
 * extra scan of delay on something that changes every four days is a cheap price
 * for not retracting a push.
 */
export async function checkWaveAlert(dry = false): Promise<WaveAlertResult> {
  const wanted = ["1M", "1w", "1d", "4h"] as const;
  const fetched = await Promise.all(
    wanted.map((c) => getGoldCandles(c, c === "1M" ? 200 : 1000, false).catch(() => null)),
  );
  const spine = fetched
    .filter((c): c is NonNullable<typeof c> => !!c && c.c.length >= 25)
    .map((c) => ({ t: c.t, h: c.h, l: c.l, c: c.c }));
  if (!spine.length) return { changed: [], sent: false, reason: "no candles", lineage: "" };

  const levels = countMultiSource(spine, 4);
  const now = snapshotOf(levels);
  const lineage = lineageOf(levels);

  const stored = (await kvGet<Stored>(STATE_KEY)) ?? { alerted: null, pending: null };
  const call = decide(stored, now);

  if (call.action !== "send") {
    if (!dry && call.store) await kvSet(STATE_KEY, { ...call.store, lineage }, 30 * 86_400);
    return { changed: call.changed, sent: false, reason: call.reason, lineage };
  }
  const changed = call.changed;

  // Show the message a dry run would have sent. The formatting is the part a
  // reader judges the feature by, and it cannot be checked from a boolean.
  if (dry) {
    const spot = await getGoldSpot().catch(() => null);
    return {
      changed, sent: false, reason: "dry run", lineage,
      preview: formatWaveAlert(changed, stored.alerted, now, lineage, spot?.price ?? 0),
    };
  }

  const chatId = process.env.TELEGRAM_CHANNEL_ID || "";
  if (!chatId) return { changed, sent: false, reason: "Telegram not configured", lineage };

  const spot = await getGoldSpot().catch(() => null);
  const send = await sendTelegramMessage(
    chatId,
    formatWaveAlert(changed, stored.alerted, now, lineage, spot?.price ?? 0),
  );

  if (send.ok) await kvSet(STATE_KEY, { alerted: now, pending: null, lineage }, 30 * 86_400);

  return {
    changed,
    sent: send.ok,
    reason: send.ok ? "sent" : "send failed",
    lineage,
    to: send.to,
    error: send.error,
  };
}
