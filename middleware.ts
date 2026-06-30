import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccess, minTierFor, type Tier } from "@/lib/tierConfig";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const required = minTierFor(pathname);
  if (required === "free") return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const tier = (token?.tier as Tier | undefined) ?? "free";

  if (canAccess(tier, pathname)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/locked";
  url.search = `?from=${encodeURIComponent(pathname)}&need=${required}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw\\.js).*)"],
};
