import { NextResponse } from "next/server";
import { geminiEnabled, generateCouncilBriefing, type CouncilBriefingInput, type CouncilBriefing } from "@/lib/gemini";

export const dynamic = "force-dynamic";

// PRD Module H enrichment — a natural-language briefing over an already-decided
// council result. Kept OUT of the /api/council hot path: the page fetches this
// lazily after the deterministic decision renders. Cached so identical
// situations don't re-bill Gemini.
const CACHE = new Map<string, { data: CouncilBriefing; ts: number }>();
const TTL = 10 * 60_000;
const TIMEOUT = 15_000;

export async function POST(req: Request) {
  if (!geminiEnabled()) return NextResponse.json({ enabled: false });

  let input: CouncilBriefingInput;
  try {
    input = (await req.json()) as CouncilBriefingInput;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const key = `${input.decision}|${input.buyVotes}|${input.sellVotes}|${input.riskGate}|${Math.round((input.confidence || 0) / 5)}`;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json({ enabled: true, briefing: cached.data, cached: true });
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const briefing = await generateCouncilBriefing(input, ctrl.signal);
    CACHE.set(key, { data: briefing, ts: Date.now() });
    return NextResponse.json({ enabled: true, briefing });
  } catch (e) {
    return NextResponse.json({ enabled: true, error: String(e) }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
