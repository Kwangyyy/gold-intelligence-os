import { NextRequest, NextResponse } from "next/server";
import { geminiEnabled } from "@/lib/gemini";

export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_KEY = process.env.GEMINI_API_KEY || "";

export async function POST(req: NextRequest) {
  if (!geminiEnabled()) {
    return NextResponse.json({ error: "Gemini not configured" }, { status: 503 });
  }

  let code: string, strategy: string, language: string;
  try {
    const body = await req.json();
    code = String(body.code ?? "");
    strategy = String(body.strategy ?? "");
    language = String(body.language ?? "mql4");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const prompt = `You are an expert MetaTrader ${language === "mql5" ? "5 MQL5" : "4 MQL4"} developer specialized in gold (XAUUSD) trading EAs.

Below is a generated EA code using the "${strategy}" strategy.

Your task:
1. Add clear, professional Thai/English inline comments explaining each major block
2. Improve variable naming if needed
3. Add basic error checking where missing
4. Add a comment block at the top summarizing: strategy logic, recommended settings for XAUUSD, and a brief risk warning
5. Keep the structure and logic intact — do NOT rewrite the strategy

Return ONLY the improved code, no explanation text outside the code.

--- CODE TO IMPROVE ---
${code}
--- END CODE ---`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    // Strip markdown code fences if Gemini wraps the output
    const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    return NextResponse.json({ code: clean }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "AI enhancement failed. Try again." }, { status: 502 });
  }
}
