// Telegram alert helper — server-side only (reads TELEGRAM_BOT_TOKEN from env)
// TELEGRAM_CHANNEL_ID — channel to broadcast AI signals (e.g. "@mychannel" or "-100xxxxxxxxxx")

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<{ ok: boolean; error?: string; errorCode?: number; to?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!chatId) return { ok: false, error: "chatId is required" };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(6_000),
    });
    const json = await res.json();
    // The code matters, not just the text: 403 means this reader blocked the bot
    // and should be dropped from the list, while a 429 or a network blip means
    // try again later. Treating them alike either loses subscribers or keeps
    // spending the send budget on people who left.
    if (!json.ok) {
      return { ok: false, error: json.description ?? "Telegram error", errorCode: json.error_code };
    }
    // Which chat Telegram actually delivered to. "It says it sent and nothing
    // arrived" is otherwise unanswerable: the API reporting ok means the message
    // reached *a* chat, and the only question left is which one.
    return { ok: true, to: chatLabel(json.result?.chat) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

function chatLabel(chat: { title?: string; username?: string; type?: string } | undefined): string {
  if (!chat) return "unknown";
  const name = chat.title ?? (chat.username ? `@${chat.username}` : "unnamed");
  return `${name} (${chat.type ?? "?"})`;
}

/**
 * Who the configured channel id points at, without sending anything.
 *
 * Answers the question a failed delivery actually raises. The bot token stays
 * server-side and the id is not echoed back — only the human-readable name, so
 * the answer can be compared against the channel on screen.
 */
export async function describeChat(chatId: string): Promise<{ ok: boolean; chat?: string; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!chatId) return { ok: false, error: "TELEGRAM_CHANNEL_ID not set" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`, {
      signal: AbortSignal.timeout(6_000),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.description ?? "Telegram error" };
    return { ok: true, chat: chatLabel(json.result) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// Broadcast a signal to the configured Telegram channel
export async function broadcastSignal(setup: Parameters<typeof formatSignalMessage>[0] & {
  symbol?: string;
  tp2?: number | null;
  rr1?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) return { ok: false, error: "TELEGRAM_CHANNEL_ID not set" };

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dirEmoji = setup.direction === "buy" ? "🟢" : setup.direction === "sell" ? "🔴" : "⏸";
  const dirLabel = setup.direction === "buy" ? "▲ BUY" : setup.direction === "sell" ? "▼ SELL" : "WAIT";
  const sym = setup.symbol ?? "XAUUSD";
  // dateStyle "short" renders the Buddhist year two-digit — "1/8/69" reads as
  // 1969 at a glance. Spell the month and year out instead.
  const now = new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

  const lines = [
    `${dirEmoji} <b>${sym} ${dirLabel}</b>  ·  <b>${setup.setupType}</b>`,
    `📊 Confidence: <b>${setup.confidence}%</b>`,
    `🕐 ${now} (ICT)`,
    ``,
    ...(setup.direction !== "wait" ? [
      `💰 Entry : <code>${fmt(setup.entry)}</code>`,
      `🛡 SL    : <code>${fmt(setup.sl)}</code>`,
      `🎯 TP1   : <code>${fmt(setup.tp1)}</code>`,
      ...(setup.tp2 ? [`🎯 TP2   : <code>${fmt(setup.tp2)}</code>`] : []),
      setup.rr1 ? `📐 R:R   : <b>1:${setup.rr1.toFixed(1)}</b>` : "",
    ] : [`💬 ${setup.biasTh}`]),
    ``,
    `📝 <b>เหตุผล</b>`,
    ...setup.reasoningTh.slice(0, 3).map(r => `  • ${r}`),
    ...(setup.risksTh.length > 0 ? [`\n⚠️ <b>ความเสี่ยง</b>`, ...setup.risksTh.slice(0, 2).map(r => `  • ${r}`)] : []),
    ``,
    `🤖 <i>Gold Intelligence OS</i> | <a href="https://gold-intelligence-os.vercel.app">เปิดแพลตฟอร์ม</a>`,
  ].filter(l => l !== "");

  return sendTelegramMessage(channelId, lines.join("\n").replace(/\n{3,}/g, "\n\n"));
}

// ── AI Council alert ─────────────────────────────────────────────────────────
export interface CouncilAlertInput {
  symbol: string;
  price: number;
  decision: string;
  confidence: number;
  buyVotes: number;
  sellVotes: number;
  threshold: number;
  riskGate: string;
  plan?: {
    action: string;
    direction: "buy" | "sell" | null;
    entry: number | null;
    sl: number | null;
    takeProfits: number[];
    lots: number;
    riskPct: number;
  } | null;
  reasons?: string[];
  riskFlags?: string[];
}

export function formatCouncilAlert(a: CouncilAlertInput): string {
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const emoji =
    a.decision === "BUY" ? "🟢" : a.decision === "SELL" ? "🔴" : a.decision === "CLOSE" ? "⛔" : a.decision === "REDUCE_LOT" ? "🟠" : "⏸";
  // dateStyle "short" renders the Buddhist year two-digit — "1/8/69" reads as
  // 1969 at a glance. Spell the month and year out instead.
  const now = new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

  const lines: string[] = [
    `🏛 <b>AI Council · ${a.symbol}</b>`,
    `${emoji} <b>${a.decision}</b>  ·  Confidence <b>${a.confidence}%</b>`,
    `🗳 BUY ${a.buyVotes}/6 · SELL ${a.sellVotes}/6 (need ${a.threshold}) · Risk: <b>${a.riskGate}</b>`,
    `💵 ${a.symbol.startsWith("XAU") ? "$" : ""}${fmt(a.price)}  ·  🕐 ${now} (ICT)`,
  ];

  if (a.plan && (a.plan.action === "OPEN" || a.plan.action === "REDUCE") && a.plan.direction && a.plan.entry) {
    lines.push(
      ``,
      `📦 <b>${a.plan.action} ${a.plan.direction.toUpperCase()}</b> · ${a.plan.lots} lots · risk ${a.plan.riskPct}%`,
      `💰 Entry <code>${fmt(a.plan.entry)}</code>${a.plan.sl != null ? ` · 🛡 SL <code>${fmt(a.plan.sl)}</code>` : ""}`,
      ...(a.plan.takeProfits.length ? [`🎯 TP <code>${a.plan.takeProfits.map(fmt).join(" / ")}</code>`] : []),
    );
  }

  if (a.reasons?.length) {
    lines.push(``, `📝 <b>เหตุผล</b>`, ...a.reasons.slice(0, 3).map((r) => `  • ${r}`));
  }
  if (a.riskFlags?.length) {
    lines.push(``, `⚠️ ${a.riskFlags.slice(0, 2).join(" · ")}`);
  }
  lines.push(
    ``,
    `🤖 <i>Gold Intelligence OS</i> | <a href="https://gold-intelligence-os.vercel.app/council">เปิดสภา AI</a>`,
    `<i>วิเคราะห์ประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน</i>`,
  );
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function formatSignalMessage(setup: {
  direction: string;
  confidence: number;
  entry: number;
  sl: number;
  tp1: number;
  setupType: string;
  biasTh: string;
  reasoningTh: string[];
  risksTh: string[];
}): string {
  const dirEmoji = setup.direction === "buy" ? "🟢" : setup.direction === "sell" ? "🔴" : "⏸";
  const dirLabel = setup.direction === "buy" ? "BUY" : setup.direction === "sell" ? "SELL" : "WAIT";
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const lines: string[] = [
    `${dirEmoji} <b>GOLD ${dirLabel} Signal · ${setup.setupType}</b>`,
    `📊 Confidence: <b>${setup.confidence}%</b>`,
    ``,
    setup.direction !== "wait" ? [
      `💰 Entry : <code>$${fmt(setup.entry)}</code>`,
      `🛡 SL    : <code>$${fmt(setup.sl)}</code>`,
      `🎯 TP    : <code>$${fmt(setup.tp1)}</code>`,
    ].join("\n") : `💬 ${setup.biasTh}`,
    ``,
    `📝 <b>เหตุผล</b>`,
    ...setup.reasoningTh.slice(0, 3).map(r => `  • ${r}`),
    setup.risksTh.length > 0 ? `\n⚠️ <b>ความเสี่ยง</b>\n${setup.risksTh.slice(0, 2).map(r => `  • ${r}`).join("\n")}` : "",
    ``,
    `🤖 <i>Gold Intelligence OS</i>`,
  ].filter(l => l !== undefined);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

// ── fan-out to self-service subscribers ─────────────────────────────────────

/**
 * Send one message to everyone who subscribed, and to the channel.
 *
 * Two failure modes are handled rather than ignored, because both are silent:
 *
 * A reader who blocked the bot answers 403 forever. Left on the list they are
 * retried on every alert, and over time the send budget goes mostly to people
 * who left. Those are dropped. A 429 or a timeout is not — that is Telegram
 * asking for a moment, and dropping a live subscriber over it is unrecoverable
 * because they would have to subscribe again without ever knowing why.
 *
 * Telegram allows roughly 30 messages a second to different chats. Sends go out
 * in small batches with a pause, which costs nothing at this size and means the
 * limit is not something to discover in production later.
 */
export async function broadcastToSubscribers(
  text: string,
): Promise<{ sent: number; failed: number; dropped: number; channel: boolean }> {
  const { listSubscribers, removeSubscriber } = await import("./telegramSubscribers");

  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  const channel = channelId ? (await sendTelegramMessage(channelId, text)).ok : false;

  const subs = await listSubscribers();
  let sent = 0, failed = 0, dropped = 0;

  const BATCH = 20;
  for (let i = 0; i < subs.length; i += BATCH) {
    const slice = subs.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (s) => ({ s, r: await sendTelegramMessage(String(s.chatId), text) })),
    );
    for (const { s, r } of results) {
      if (r.ok) { sent++; continue; }
      failed++;
      // 403: blocked or kicked. 400 "chat not found": the chat is gone.
      if (r.errorCode === 403 || (r.errorCode === 400 && /chat not found/i.test(r.error ?? ""))) {
        await removeSubscriber(s.chatId);
        dropped++;
      }
    }
    if (i + BATCH < subs.length) await new Promise((r) => setTimeout(r, 1000));
  }

  return { sent, failed, dropped, channel };
}
