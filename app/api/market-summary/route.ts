import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface SignalItem {
  module: string;
  moduleTh: string;
  icon: string;
  signal: string;
  signalTh: string;
  bias: "bullish" | "bearish" | "neutral";
  score: number;      // 0-100
  highlight: string;
  highlightTh: string;
}

export interface MarketSummaryPayload {
  compositeScore: number;      // 0-100
  compositeLabel: string;
  compositeLabelTh: string;
  compositeColor: string;
  overallBias: "bullish" | "bearish" | "neutral";
  signals: SignalItem[];
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  summaryEn: string;
  summaryTh: string;
  actionableTh: string;
  generatedAt: string;
}

async function safeGet(path: string, base: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000); // fail fast so one slow upstream can't hang the whole request
  try {
    const r = await fetch(`${base}${path}`, {
      headers: { "Cache-Control": "no-cache" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

let CACHE: { data: MarketSummaryPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3100";

  const [
    trendData,
    momentumData,
    fearData,
    pivotData,
    dxyData,
    regimeData,
    sentimentData,
    econData,
  ] = await Promise.all([
    safeGet("/api/trend-strength", base),
    safeGet("/api/momentum", base),
    safeGet("/api/fear-greed", base),
    safeGet("/api/pivots", base),
    safeGet("/api/dxy-correlation", base),
    safeGet("/api/market-regime", base),
    safeGet("/api/news-sentiment", base),
    safeGet("/api/econ-impact", base),
  ]);

  const signals: SignalItem[] = [];

  // 1. Trend Strength
  if (trendData && !trendData.error) {
    const adxVal = trendData.timeframes?.[0]?.adx ?? 0;
    const align  = trendData.alignmentScore ?? 50;
    const bias: SignalItem["bias"] = align > 60 ? "bullish" : align < 40 ? "bearish" : "neutral";
    signals.push({
      module: "Trend Strength", moduleTh: "ความแข็งแกร่งเทรนด์",
      icon: "📈", signal: `ADX ${adxVal?.toFixed(0) ?? "?"} | Alignment ${align}`,
      signalTh: `ADX ${adxVal?.toFixed(0) ?? "?"} | Alignment ${align}`,
      bias, score: align,
      highlight: `${adxVal > 25 ? "Strong trend" : "Weak trend"}. Multi-TF alignment: ${align}%.`,
      highlightTh: `${adxVal > 25 ? "เทรนด์แข็งแกร่ง" : "เทรนด์อ่อน"} การเรียงตัว MTF: ${align}%`,
    });
  }

  // 2. Momentum
  if (momentumData && !momentumData.error) {
    const goldAsset = (momentumData.assets ?? []).find((a: { symbol: string }) => a.symbol === "GC=F");
    const goldScore = goldAsset?.momentumScore ?? 50;
    const goldReturn = goldAsset?.return5d ?? 0;
    const bias: SignalItem["bias"] = goldScore > 60 ? "bullish" : goldScore < 40 ? "bearish" : "neutral";
    signals.push({
      module: "Momentum", moduleTh: "โมเมนตัม",
      icon: "📡", signal: `Gold momentum score: ${goldScore} | 5d: ${goldReturn > 0 ? "+" : ""}${goldReturn?.toFixed(2)}%`,
      signalTh: `คะแนน momentum ทอง: ${goldScore} | 5 วัน: ${goldReturn > 0 ? "+" : ""}${goldReturn?.toFixed(2)}%`,
      bias, score: goldScore,
      highlight: `Gold ${goldScore > 65 ? "strong momentum up" : goldScore < 35 ? "strong momentum down" : "neutral momentum"}.`,
      highlightTh: `ทอง ${goldScore > 65 ? "momentum แข็งแกร่งขาขึ้น" : goldScore < 35 ? "momentum ขาลงแรง" : "momentum เป็นกลาง"}`,
    });
  }

  // 3. Fear & Greed
  if (fearData && !fearData.error) {
    const fg = fearData.score ?? 50;
    const bias: SignalItem["bias"] = fg < 40 ? "bullish" : fg > 65 ? "bearish" : "neutral";
    signals.push({
      module: "Fear & Greed", moduleTh: "Fear & Greed Index",
      icon: "😱", signal: `${fearData.label} (${fg})`,
      signalTh: `${fearData.labelTh} (${fg})`,
      bias, score: 100 - fg,
      highlight: fearData.goldImplication ?? "",
      highlightTh: fearData.goldImplicationTh ?? "",
    });
  }

  // 4. DXY Correlation
  if (dxyData && !dxyData.error) {
    const corr = dxyData.currentCorrelation ?? 0;
    const div  = dxyData.divergence?.active ?? false;
    const bias: SignalItem["bias"] = div ? "bullish" : corr < -0.3 ? "bullish" : corr > 0.2 ? "bearish" : "neutral";
    const score = div ? 75 : corr < -0.5 ? 70 : 50;
    signals.push({
      module: "DXY Correlation", moduleTh: "สหสัมพันธ์ DXY",
      icon: "💱", signal: `Corr ${corr.toFixed(2)} ${div ? "| ⚡ Divergence!" : ""}`,
      signalTh: `Corr ${corr.toFixed(2)} ${div ? "| ⚡ Divergence!" : ""}`,
      bias, score,
      highlight: div ? "Gold-DXY divergence: safe-haven buying." : `Inverse correlation ${corr.toFixed(2)}.`,
      highlightTh: div ? "Gold-DXY divergence: demand safe-haven" : `Inverse correlation ${corr.toFixed(2)}`,
    });
  }

  // 5. Market Regime
  if (regimeData && !regimeData.error) {
    const regime = regimeData.regime ?? "unknown";
    const bias: SignalItem["bias"] = regime.includes("bull") || regime.includes("up") ? "bullish"
      : regime.includes("bear") || regime.includes("down") ? "bearish" : "neutral";
    signals.push({
      module: "Market Regime", moduleTh: "สภาวะตลาด",
      icon: "🎯", signal: regimeData.regimeLabel ?? regime,
      signalTh: regimeData.regimeLabelTh ?? regime,
      bias, score: bias === "bullish" ? 70 : bias === "bearish" ? 30 : 50,
      highlight: `Regime: ${regimeData.regimeLabel ?? regime}`,
      highlightTh: `Regime: ${regimeData.regimeLabelTh ?? regime}`,
    });
  }

  // 6. News Sentiment
  if (sentimentData && !sentimentData.error) {
    const net = sentimentData.netScore ?? 0;
    const bias: SignalItem["bias"] = net > 0.5 ? "bullish" : net < -0.5 ? "bearish" : "neutral";
    const score = Math.max(0, Math.min(100, 50 + net * 20));
    signals.push({
      module: "News Sentiment", moduleTh: "Sentiment ข่าว",
      icon: "📰", signal: `Net score: ${net > 0 ? "+" : ""}${net.toFixed(2)} | ${sentimentData.trend ?? ""}`,
      signalTh: `คะแนนสุทธิ: ${net > 0 ? "+" : ""}${net.toFixed(2)} | ${sentimentData.trendTh ?? ""}`,
      bias, score,
      highlight: sentimentData.summary ?? "",
      highlightTh: sentimentData.summaryTh ?? "",
    });
  }

  // 7. Econ Impact
  if (econData && !econData.error) {
    const totalRisk = econData.totalRiskScore ?? 0;
    const netBias   = econData.netBias ?? "mixed";
    const bias: SignalItem["bias"] = netBias === "bullish" ? "bullish" : netBias === "bearish" ? "bearish" : "neutral";
    const score = bias === "bullish" ? 65 : bias === "bearish" ? 35 : 50;
    signals.push({
      module: "Economic Events", moduleTh: "ข่าวเศรษฐกิจ",
      icon: "⚡", signal: `Risk score: ${totalRisk} | Bias: ${netBias}`,
      signalTh: `ความเสี่ยงรวม: ${totalRisk} | Bias: ${netBias}`,
      bias, score,
      highlight: `Weekly econ risk ${totalRisk > 15 ? "HIGH" : totalRisk > 8 ? "MEDIUM" : "LOW"}. Net bias: ${netBias}.`,
      highlightTh: `ความเสี่ยงสัปดาห์ ${totalRisk > 15 ? "สูง" : totalRisk > 8 ? "ปานกลาง" : "ต่ำ"} Bias: ${netBias}`,
    });
  }

  // 8. Pivot location
  if (pivotData && !pivotData.error) {
    const currentPrice = pivotData.currentPrice ?? 0;
    const pivot        = pivotData.daily?.classical?.find((l: { label: string }) => l.label === "PP");
    if (pivot) {
      const above = currentPrice > pivot.price;
      const bias: SignalItem["bias"] = above ? "bullish" : "bearish";
      signals.push({
        module: "Pivot Points", moduleTh: "Pivot Points",
        icon: "🎯", signal: `Price ${above ? "above" : "below"} Daily PP ${pivot.price.toFixed(0)}`,
        signalTh: `ราคา${above ? "อยู่เหนือ" : "อยู่ต่ำกว่า"} Daily PP ${pivot.price.toFixed(0)}`,
        bias, score: above ? 65 : 35,
        highlight: `Current $${currentPrice.toFixed(0)} vs Daily Pivot $${pivot.price.toFixed(0)} — ${above ? "bullish structure" : "bearish structure"}.`,
        highlightTh: `ราคา $${currentPrice.toFixed(0)} เทียบ PP $${pivot.price.toFixed(0)} — โครงสร้าง${above ? "ขาขึ้น" : "ขาลง"}`,
      });
    }
  }

  if (!signals.length) {
    return NextResponse.json({ error: "No data available from sub-APIs" }, { status: 503 });
  }

  const bullCount    = signals.filter(s => s.bias === "bullish").length;
  const bearCount    = signals.filter(s => s.bias === "bearish").length;
  const neutralCount = signals.filter(s => s.bias === "neutral").length;
  const compositeScore = Math.round(signals.reduce((a, s) => a + s.score, 0) / signals.length);
  const overallBias: SignalItem["bias"] = compositeScore > 57 ? "bullish" : compositeScore < 43 ? "bearish" : "neutral";
  const compositeLabel = compositeScore > 65 ? "Strong Bullish" : compositeScore > 57 ? "Bullish" : compositeScore > 43 ? "Neutral" : compositeScore > 35 ? "Bearish" : "Strong Bearish";
  const compositeLabelTh = compositeScore > 65 ? "ขาขึ้นแรง" : compositeScore > 57 ? "ขาขึ้น" : compositeScore > 43 ? "เป็นกลาง" : compositeScore > 35 ? "ขาลง" : "ขาลงแรง";
  const compositeColor = compositeScore > 57 ? "#34d399" : compositeScore < 43 ? "#f87171" : "#f5c451";

  const summaryEn = `Gold market composite shows ${compositeLabel.toLowerCase()} (${compositeScore}/100). ${bullCount}/${signals.length} modules bullish, ${bearCount} bearish, ${neutralCount} neutral. ${overallBias === "bullish" ? "Bias favors buyers." : overallBias === "bearish" ? "Bias favors sellers." : "No clear directional edge."}`;
  const summaryTh = `ภาพรวมตลาดทองคำ: ${compositeLabelTh} (${compositeScore}/100) · ${bullCount} โมดูล bullish, ${bearCount} bearish, ${neutralCount} เป็นกลาง · ${overallBias === "bullish" ? "Bias เอื้อฝ่ายซื้อ" : overallBias === "bearish" ? "Bias เอื้อฝ่ายขาย" : "ไม่มีทิศทางชัดเจน"}`;
  const actionableTh = overallBias === "bullish"
    ? `📗 สัญญาณรวม BULLISH — พิจารณา Long ในจุด Pullback · ตั้ง SL ใต้แนวรับหลัก`
    : overallBias === "bearish"
    ? `📕 สัญญาณรวม BEARISH — พิจารณา Short ในจุด Rally · ตั้ง SL เหนือแนวต้านหลัก`
    : `📒 สัญญาณรวม NEUTRAL — รอสัญญาณชัดเจนก่อนเทรด · งดเปิดสถานะใหม่`;

  const data: MarketSummaryPayload = {
    compositeScore, compositeLabel, compositeLabelTh, compositeColor, overallBias,
    signals, bullCount, bearCount, neutralCount,
    summaryEn, summaryTh, actionableTh,
    generatedAt: new Date().toISOString(),
  };

  CACHE = { data, ts: Date.now() };
  return NextResponse.json(data);
}
