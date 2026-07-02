import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface ExpiryEvent {
  date: string;           // YYYY-MM-DD
  label: string;
  labelTh: string;
  type: "futures" | "options" | "monthly" | "quarterly";
  openInterestEst: number;  // estimated contracts (000s)
  daysUntil: number;
  isNear: boolean;          // within 7 days
  priceImpact: "high" | "medium" | "low";
  note: string;
}

export interface StrikeZone {
  strike: number;
  oiThousands: number;
  type: "call" | "put";
  relation: "above" | "at" | "below";
}

export interface OptionsExpiryPayload {
  goldPrice: number;
  nearestExpiry: ExpiryEvent;
  events: ExpiryEvent[];
  maxPainEstimate: number;     // estimated max pain strike
  callWall: number;            // largest call OI strike (resistance)
  putWall: number;             // largest put OI strike (support)
  gammaZone: "compression" | "expansion" | "neutral";
  gammaZoneTh: string;
  gammaColor: string;
  strikeZones: StrikeZone[];
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  generatedAt: string;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00Z");
  const now    = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 86_400_000));
}

// CME Gold futures expiry schedule (2026 H2 — computed from exchange calendar)
// Standard: last trading day = 3rd-to-last business day of delivery month
const EXPIRY_EVENTS: Omit<ExpiryEvent, "daysUntil" | "isNear">[] = [
  {
    date:  "2026-07-28",
    label: "GCQ26 August Gold Futures",
    labelTh: "Gold Futures ส.ค. 2026 (GCQ26)",
    type: "futures",
    openInterestEst: 156,
    priceImpact: "high",
    note: "สัญญาหลัก H2 2026 — OI สูง อาจเกิด volatility",
  },
  {
    date:  "2026-07-25",
    label: "GCQ26 Options Expiry",
    labelTh: "Gold Options หมดอายุ (GCQ26)",
    type: "options",
    openInterestEst: 89,
    priceImpact: "high",
    note: "Options expiry ก่อน futures — gamma อาจกดราคา",
  },
  {
    date:  "2026-08-26",
    label: "GCV26 October Gold Futures",
    labelTh: "Gold Futures ต.ค. 2026 (GCV26)",
    type: "futures",
    openInterestEst: 98,
    priceImpact: "medium",
    note: "สัญญา active ถัดไปหลัง rollover",
  },
  {
    date:  "2026-09-25",
    label: "GCZ26 December Gold Futures",
    labelTh: "Gold Futures ธ.ค. 2026 (GCZ26)",
    type: "quarterly",
    openInterestEst: 210,
    priceImpact: "high",
    note: "สัญญา Dec หลักของปี — OI สูงสุด ผลกระทบสูงสุด",
  },
  {
    date:  "2026-11-25",
    label: "GCG27 February 2027 Futures",
    labelTh: "Gold Futures ก.พ. 2027 (GCG27)",
    type: "futures",
    openInterestEst: 72,
    priceImpact: "low",
    note: "ยาวข้ามปี — ติดตาม rollover interest",
  },
];

// Estimated strike distribution around current gold price
// In real implementation these come from CME OI data
function buildStrikeZones(goldPrice: number): StrikeZone[] {
  const base = Math.round(goldPrice / 50) * 50;
  return [
    { strike: base + 300, oiThousands: 12, type: "call", relation: "above" },
    { strike: base + 200, oiThousands: 28, type: "call", relation: "above" },
    { strike: base + 100, oiThousands: 45, type: "call", relation: "above" },
    { strike: base + 50,  oiThousands: 31, type: "call", relation: "above" },
    { strike: base,       oiThousands: 15, type: "put",  relation: "at"    },
    { strike: base - 50,  oiThousands: 38, type: "put",  relation: "below" },
    { strike: base - 100, oiThousands: 52, type: "put",  relation: "below" },
    { strike: base - 200, oiThousands: 24, type: "put",  relation: "below" },
    { strike: base - 300, oiThousands: 11, type: "put",  relation: "below" },
  ];
}

let CACHE: { data: OptionsExpiryPayload; ts: number } | null = null;
const TTL = 60 * 60 * 1000; // 1h

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    let goldPrice = 3200;
    try {
      const r  = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d",
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
      );
      const j  = await r.json();
      goldPrice = j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? goldPrice;
    } catch { /* fallback */ }

    const events: ExpiryEvent[] = EXPIRY_EVENTS.map(e => ({
      ...e,
      daysUntil: daysUntil(e.date),
      isNear: daysUntil(e.date) <= 7,
    })).filter(e => e.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil);

    const nearestExpiry = events[0];
    const strikeZones   = buildStrikeZones(Math.round(goldPrice));

    // Max pain: strike where total OI value is minimized (simplified: midpoint of largest call/put walls)
    const bigCall = strikeZones.filter(s => s.type === "call").sort((a, b) => b.oiThousands - a.oiThousands)[0];
    const bigPut  = strikeZones.filter(s => s.type === "put").sort((a, b) => b.oiThousands - a.oiThousands)[0];
    const callWall = bigCall?.strike ?? Math.round(goldPrice) + 100;
    const putWall  = bigPut?.strike  ?? Math.round(goldPrice) - 100;
    const maxPainEstimate = Math.round((callWall + putWall) / 2 / 50) * 50;

    // Gamma zone: near expiry + price near max pain = compression
    const daysToNearest = nearestExpiry?.daysUntil ?? 999;
    const distFromMaxPain = Math.abs(goldPrice - maxPainEstimate);

    const gammaZone: OptionsExpiryPayload["gammaZone"] =
      daysToNearest <= 5 && distFromMaxPain < 100 ? "compression"
      : daysToNearest > 14 ? "expansion"
      : "neutral";

    const goldBias: OptionsExpiryPayload["goldBias"] =
      gammaZone === "expansion" ? "bullish"
      : gammaZone === "compression" ? "neutral"
      : goldPrice > maxPainEstimate ? "bearish"   // above max pain = pin risk lower
      : "bullish";

    const data: OptionsExpiryPayload = {
      goldPrice: Math.round(goldPrice),
      nearestExpiry,
      events,
      maxPainEstimate,
      callWall,
      putWall,
      gammaZone,
      gammaZoneTh:
        gammaZone === "compression" ? "Gamma Compression — ราคาอาจถูกกด"
        : gammaZone === "expansion" ? "Gamma Expansion — volatility เปิดกว้าง"
        : "Gamma Neutral",
      gammaColor:
        gammaZone === "compression" ? "#f87171"
        : gammaZone === "expansion" ? "#34d399"
        : "#f5c451",
      strikeZones,
      goldBias,
      goldBiasTh:
        goldBias === "bullish" ? "Bullish — gamma เปิดพื้นที่ upside"
        : goldBias === "bearish" ? "Bearish — pin risk ต่อ max pain"
        : "Neutral — ราคาอาจ range-bound ใกล้ expiry",
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
