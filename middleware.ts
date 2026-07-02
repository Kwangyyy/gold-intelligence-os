import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccess, minTierFor, type Tier } from "@/lib/tierConfig";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/pending", "/rejected", "/api/auth"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow auth routes and public paths
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const tier = (token?.tier as string | undefined) ?? "free";

  // Pending users → /pending page only
  if (tier === "pending") {
    if (pathname === "/pending") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/pending";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Rejected users → /rejected page only
  if (tier === "rejected") {
    if (pathname === "/rejected") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/rejected";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Normal tier access gating
  const required = minTierFor(pathname);
  if (required === "free") return NextResponse.next();
  if (canAccess(tier as Tier, pathname)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/locked";
  url.search = `?from=${encodeURIComponent(pathname)}&need=${required}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js).*)"],
};
