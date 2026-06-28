// Telegram alert helper — server-side only (reads TELEGRAM_BOT_TOKEN from env)

export async function sendTelegramMessage(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!chatId) return { ok: false, error: "chatId is required" };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.description ?? "Telegram error" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
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
