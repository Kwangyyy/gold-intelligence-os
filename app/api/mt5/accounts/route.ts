// Per-user MT5 account management. Session-gated (Google login).
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listAccounts, createAccount, renameAccount, regenerateToken, deleteAccount,
  getLiveData, accountLimit, type MT5AccountMeta,
} from "@/lib/mt5Store";
import type { Tier } from "@/lib/tierConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const session = await getServerSession(authOptions);
  const email   = session?.user?.email;
  if (!email) return null;
  const tier    = (session.user as { tier?: Tier }).tier ?? "free";
  const isAdmin = (session.user as { isAdmin?: boolean }).isAdmin ?? false;
  return { email, tier, isAdmin };
}

// GET — list the user's accounts + tier limit + live snapshot per account
export async function GET() {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metas = await listAccounts(u.email);
  const accounts = await Promise.all(metas.map(async (m: MT5AccountMeta) => {
    const data = await getLiveData(u.email, m.id);
    return { ...m, connected: !!data, data };
  }));

  return NextResponse.json({
    tier: u.tier,
    isAdmin: u.isAdmin,
    limit: accountLimit(u.tier, u.isAdmin),
    used: accounts.length,
    accounts,
  });
}

// POST — create a new account (enforces tier limit)
export async function POST(req: Request) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { label?: string };
  try { body = await req.json(); } catch { body = {}; }

  const result = await createAccount(u.email, body.label ?? "", u.tier, u.isAdmin);
  if (!result.ok) return NextResponse.json({ error: result.reason, limit: result.limit }, { status: 403 });
  return NextResponse.json({ ok: true, account: result.account });
}

// PATCH — rename or regenerate token. Body: { action, id, label? }
export async function PATCH(req: Request) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string; id?: string; label?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { action, id, label } = body;
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  if (action === "rename") {
    const ok = await renameAccount(u.email, id, label ?? "");
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (action === "regenerate") {
    const token = await regenerateToken(u.email, id);
    return token ? NextResponse.json({ ok: true, token }) : NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// DELETE — remove an account. ?id=
export async function DELETE(req: Request) {
  const u = await requireUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteAccount(u.email, id);
  return NextResponse.json({ ok: true });
}
