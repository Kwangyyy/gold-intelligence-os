import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getMarketSnapshot } from "@/lib/marketSnapshot";
import { buildTechnicalScore } from "@/lib/technical";
import { buildMultiTimeframe } from "@/lib/timeframes";
import { buildSmc } from "@/lib/smc";
import { buildPortfolio } from "@/lib/portfolio";
import { runCouncil, type CouncilContext } from "@/lib/council";
import { planExecution } from "@/lib/execution";
import { getCouncilVotes } from "@/lib/councilJournal";
import { computeAgentAccuracy } from "@/lib/councilLearning";
import { formatCouncilAlert, sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const MIN_CONFIDENCE = 55;
const DEDUP_MS = 6 * 60 * 60_000; // don't repeat the same call within 6h
const ALERT_FILE = path.join(process.cwd(), ".data", "council-alert.json");

async function lastAlert(): Promise<{ sig: string; ts: number } | null> {
  try {
    return JSON.parse(await fs.readFile(ALERT_FILE, "utf8"));
  } catch {
    return null;
  }
}
async function saveAlert(sig: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(ALERT_FILE), { recursive: true });
    await fs.writeFile(ALERT_FILE, JSON.stringify({ sig, ts: Date.now() }), "utf8");
  } catch {
    /* best effort */
  }
}

// Convene the council, and — if the decision is actionable and new — push a
// Telegram alert. Safe to call from Vercel Cron (GET) or a manual button.
// Dedup prevents repeat alerts for the same standing decision.
export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const chatOverride = req.nextUrl.searchParams.get("chatId") || undefined;

  try {
    const [snapshot, technical, mtf, smc] = await Promise.all([
      getMarketSnapshot(),
      buildTechnicalScore("H1"),
      buildMultiTimeframe(),
      buildSmc("H1"),
    ]);
    const portfolio = buildPortfolio(snapshot.price);

    const reliability: Record<string, number> = {};
    try {
      for (const a of computeAgentAccuracy(await getCouncilVotes()).agents) reliability[a.id] = a.reliability;
    } catch {
      /* neutral */
    }

    const ctx: CouncilContext = { snapshot, technical, mtf, smc, portfolio };
    const result = runCouncil(ctx, reliability);
    const plan = planExecution(result, { price: snapshot.price, atr: snapshot.atr, balance: portfolio.balance, riskPct: 1 });

    const actionable = result.decision !== "WAIT" && (result.decision === "CLOSE" || result.confidence >= MIN_CONFIDENCE);
    if (!actionable && !force) {
      return NextResponse.json({ sent: false, decision: result.decision, reason: "no actionable decision" });
    }

    const sig = `${result.decision}|${Math.round(snapshot.price / 5)}`;
    const prev = await lastAlert();
    if (!force && prev && prev.sig === sig && Date.now() - prev.ts < DEDUP_MS) {
      return NextResponse.json({ sent: false, decision: result.decision, reason: "deduped (already alerted)" });
    }

    // Reasons: for a directional call use the agreeing agents' top reasons; for
    // risk actions use the risk flags.
    const dirId = result.decision === "BUY" ? "BUY" : result.decision === "SELL" ? "SELL" : null;
    const reasons = dirId
      ? result.agents.filter((a) => a.vote === dirId).map((a) => a.reasons[0]?.th).filter(Boolean) as string[]
      : result.riskFlags.map((f) => f.th);

    const text = formatCouncilAlert({
      symbol: result.symbol,
      price: result.price,
      decision: result.decision,
      confidence: result.confidence,
      buyVotes: result.quorum.buy,
      sellVotes: result.quorum.sell,
      threshold: result.quorum.threshold,
      riskGate: result.agents.find((a) => a.id === "risk")?.gate ?? "pass",
      plan: { action: plan.action, direction: plan.direction, entry: plan.entry, sl: plan.sl, takeProfits: plan.takeProfits, lots: plan.lots, riskPct: plan.riskPct },
      reasons,
      riskFlags: result.riskFlags.map((f) => f.th),
    });

    const chatId = chatOverride || process.env.TELEGRAM_CHANNEL_ID || "";
    if (!chatId) {
      return NextResponse.json({ sent: false, decision: result.decision, reason: "Telegram not configured (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID)", preview: text });
    }

    const send = await sendTelegramMessage(chatId, text);
    if (send.ok) await saveAlert(sig);
    return NextResponse.json({ sent: send.ok, decision: result.decision, confidence: result.confidence, error: send.error });
  } catch (e) {
    return NextResponse.json({ sent: false, error: String(e) }, { status: 500 });
  }
}
