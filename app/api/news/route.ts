import { NextResponse } from "next/server";
import { fetchNewsSentiment, type NewsResult } from "@/lib/newsSentiment";

export const dynamic = "force-dynamic";

let CACHE: { data: NewsResult; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    if (!refresh && CACHE && Date.now() - CACHE.ts < TTL) {
      return NextResponse.json(CACHE.data);
    }
    const data = await fetchNewsSentiment();
    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "news fetch failed" },
      { status: 500 },
    );
  }
}
