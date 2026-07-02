import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  isAdmin,
  addAdmin,
  removeAdmin,
  setUserTier,
  listAllUsers,
  listDynamicAdmins,
  SUPER_ADMIN_EMAILS,
} from "@/lib/userTier";
import type { Tier } from "@/lib/tierConfig";

export const dynamic = "force-dynamic";

async function guardAdmin(): Promise<{ email: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  const email   = session?.user?.email;
  if (!email || !(await isAdmin(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { email };
}

// GET /api/admin/users — list all users + admins
export async function GET() {
  const guard = await guardAdmin();
  if (guard instanceof NextResponse) return guard;

  const [users, dynamicAdmins] = await Promise.all([listAllUsers(), listDynamicAdmins()]);

  return NextResponse.json({
    superAdmins: SUPER_ADMIN_EMAILS,
    dynamicAdmins,
    users,
  });
}

// POST /api/admin/users — perform an admin action
// Body: { action: "add_admin" | "remove_admin" | "set_tier", email, tier? }
export async function POST(req: NextRequest) {
  const guard = await guardAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: { action?: string; email?: string; tier?: Tier };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, email, tier } = body;
  if (!email || !action) return NextResponse.json({ error: "email and action required" }, { status: 400 });

  const cleanEmail = email.trim().toLowerCase();

  switch (action) {
    case "add_admin": {
      await addAdmin(cleanEmail);
      return NextResponse.json({ ok: true, message: `${cleanEmail} added as admin` });
    }

    case "remove_admin": {
      const result = await removeAdmin(cleanEmail);
      if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
      return NextResponse.json({ ok: true, message: `${cleanEmail} removed from admins` });
    }

    case "set_tier": {
      if (!tier || !["free", "premium", "pro"].includes(tier)) {
        return NextResponse.json({ error: "tier must be free | premium | pro" }, { status: 400 });
      }
      await setUserTier(cleanEmail, tier);
      return NextResponse.json({ ok: true, message: `${cleanEmail} tier set to ${tier}` });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
