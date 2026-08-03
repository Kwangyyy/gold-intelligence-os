import { NextResponse, type NextRequest } from "next/server";
import { listSubscribers, ensureWebhookSecret } from "@/lib/telegramSubscribers";
import { kvGet, kvDurable } from "@/lib/kvStore";
import { getApiAdmin, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Point Telegram at the webhook, and report where it is pointed.
 *
 * Registering a webhook means calling Telegram with the bot token. Doing it from
 * here keeps the token in the environment rather than in a terminal, a browser
 * URL, or a chat message — a token pasted anywhere is a token that has to be
 * revoked, which has already happened once on this project.
 *
 * Admin only. GET reports, POST registers.
 */

const api = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

function siteUrl(req: NextRequest): string {
  const env = process.env.NEXTAUTH_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (env) return env.startsWith("http") ? env : `https://${env}`;
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  if (!(await getApiAdmin())) return unauthorized();
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 400 });
  }
  try {
    const info = await (await fetch(api("getWebhookInfo"), { signal: AbortSignal.timeout(6_000) })).json();
    const subs = await listSubscribers();
    return NextResponse.json({
      expectedUrl: `${siteUrl(req)}/api/telegram/webhook`,
      // Telegram's own view: where it is delivering, and whether it is failing.
      // pendingUpdateCount stuck above zero means deliveries are not landing.
      registeredUrl: info?.result?.url || null,
      pendingUpdateCount: info?.result?.pending_update_count ?? null,
      lastError: info?.result?.last_error_message ?? null,
      lastErrorAt: info?.result?.last_error_date
        ? new Date(info.result.last_error_date * 1000).toISOString()
        : null,
      // Without a durable store the shared secret is regenerated per instance,
      // so the one Telegram was given never matches the one that checks it and
      // every delivery is refused. Invisible from outside and the first thing to
      // rule out.
      durableStore: kvDurable(),
      lastAccepted: await kvGet("gios:tg:last-update"),
      lastRejected: await kvGet("gios:tg:last-reject"),
      subscribers: subs.length,
      // Names only. Chat ids identify a person's Telegram account and there is
      // no reason for a dashboard to hand them out.
      names: subs.map((s) => s.name),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getApiAdmin())) return unauthorized();
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 400 });
  }
  try {
    const url = `${siteUrl(req)}/api/telegram/webhook`;
    const res = await fetch(api("setWebhook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        secret_token: await ensureWebhookSecret(),
        // Only what the bot acts on. Asking for everything would have Telegram
        // deliver every edit and reaction for nothing.
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const json = await res.json();
    return NextResponse.json({
      ok: !!json.ok,
      url,
      description: json.description ?? null,
      error: json.ok ? null : json.description ?? "setWebhook failed",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
