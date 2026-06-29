import { NextResponse } from "next/server";
import { checkAndTrigger } from "@/lib/priceAlertStore";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { price } = await req.json();
    if (!price || typeof price !== "number") {
      return NextResponse.json({ error: "price required" }, { status: 400 });
    }

    const fired = await checkAndTrigger(price);

    // Send Telegram for each triggered alert that has a chatId
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const a of fired) {
      if (!a.chatId) { results.push({ id: a.id, ok: false, error: "no chatId" }); continue; }
      const dir = a.condition === "above" ? "⬆️ ขึ้นถึง" : "⬇️ ลงถึง";
      const text = [
        `🔔 <b>Gold Price Alert</b>`,
        ``,
        `📍 ราคา XAUUSD <b>${dir} $${price.toFixed(2)}</b>`,
        `🎯 Target: <b>$${a.targetPrice.toFixed(2)}</b> (${a.condition === "above" ? "Above" : "Below"})`,
        a.note ? `📝 Note: ${a.note}` : "",
        ``,
        `<i>⏰ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</i>`,
        `<i>⚠️ นี่คือการแจ้งเตือนเท่านั้น ไม่ใช่คำแนะนำซื้อขาย</i>`,
      ].filter(Boolean).join("\n");

      const res = await sendTelegramMessage(a.chatId, text);
      results.push({ id: a.id, ok: res.ok, error: res.error });
    }

    return NextResponse.json({ fired: fired.length, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
