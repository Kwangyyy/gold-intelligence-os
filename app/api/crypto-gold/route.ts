import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface PricePoint {
  date: string;
  gold: number;
  btc: number;
  goldNorm: number;   // normalized to 100 at start
  btcNorm: number;
  divergence: number; // btcNorm - goldNorm
}

export interface CryptoGoldPayload {
  goldPrice: number;
  btcPrice: number;
  goldChange1d: number;
  btcChange1d: number;
  goldChange1w: number;
  btcChange1w: number;
  goldChange1m: number;
  btcChange1m: number;
  correlation30d: number;    // rolling 30d Pearson
  divergence30d: number;     // btc 30d % - gold 30d %, normalized
  divergenceSignal: "btc_leads" | "gold_leads" | "converging" | "diverging";
  divergenceSignalTh: string;
  divergenceColor: string;
  safeHavenFlow: "to_gold" | "to_btc" | "to_both" | "risk_on";
  safeHavenFlowTh: string;
  goldBias: "bullish" | "neutral" | "bearish";
  goldBiasTh: string;
  goldBiasColor: string;
  history: PricePoint[];     // last 60 days weekly
  generatedAt: string;
}

type YChart = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; previousClose?: number };
      timestamp?: number[];
      indicators?: {
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
        quote?: Array<{ close?: (number | null)[] }>;
      };
    }>;
  };
};

async function fetchHistory(sym: string): Promise<{ price: number; prevClose: number; closes: number[]; timestamps: number[] }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=3mo&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    const j = await r.json() as YChart;
    const res = j?.chart?.result?.[0];
    if (!res) return { price: 0, prevClose: 0, closes: [], timestamps: [] };
    const price = res.meta?.regularMarketPrice ?? 0;
    const prevClose = res.meta?.previousClose ?? 0;
    const ts = res.timestamp ?? [];
    const raw = res.indicators?.adjclose?.[0]?.adjclose ?? res.indicators?.quote?.[0]?.close ?? [];
    const closes: number[] = [];
    const timestamps: number[] = [];
    ts.forEach((t, i) => {
      const c = raw[i];
      if (c !== null && c !== undefined && !isNaN(c)) {
        closes.push(c);
        timestamps.push(t);
      }
    });
    return { price, prevClose, closes, timestamps };
  } catch { return { price: 0, prevClose: 0, closes: [], timestamps: [] }; }
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return 0;
  const xSlice = xs.slice(-n);
  const ySlice = ys.slice(-n);
  const mx = xSlice.reduce((a, b) => a + b, 0) / n;
  const my = ySlice.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const ex = xSlice[i] - mx;
    const ey = ySlice[i] - my;
    num += ex * ey;
    dx  += ex * ex;
    dy  += ey * ey;
  }
  return dx === 0 || dy === 0 ? 0 : parseFloat((num / Math.sqrt(dx * dy)).toFixed(3));
}

function pct(from: number, to: number): number {
  if (!from) return 0;
  return parseFloat(((to - from) / from * 100).toFixed(2));
}

let CACHE: { data: CryptoGoldPayload; ts: number } | null = null;
const TTL = 10 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldD, btcD] = await Promise.all([
      fetchHistory("GC=F"),
      fetchHistory("BTC-USD"),
    ]);

    const goldPrice = goldD.price || 3200;
    const btcPrice  = btcD.price  || 60000;

    const n = Math.min(goldD.closes.length, btcD.closes.length);
    const gCloses = goldD.closes.slice(-n);
    const bCloses = btcD.closes.slice(-n);
    const gTs     = goldD.timestamps.slice(-n);

    // Build history (weekly sampling — every 7 points)
    const history: PricePoint[] = [];
    const step = Math.max(1, Math.floor(n / 60));
    const base0 = gCloses[0] || goldPrice;
    const bbase0 = bCloses[0] || btcPrice;
    for (let i = 0; i < n; i += step) {
      const g = gCloses[i];
      const b = bCloses[i];
      if (!g || !b) continue;
      const goldNorm = parseFloat(((g / base0) * 100).toFixed(2));
      const btcNorm  = parseFloat(((b / bbase0) * 100).toFixed(2));
      history.push({
        date:       new Date(gTs[i] * 1000).toISOString().slice(0, 10),
        gold:       Math.round(g),
        btc:        Math.round(b),
        goldNorm,
        btcNorm,
        divergence: parseFloat((btcNorm - goldNorm).toFixed(2)),
      });
    }

    // Returns
    const goldChange1d = pct(goldD.prevClose, goldPrice);
    const btcChange1d  = pct(btcD.prevClose,  btcPrice);
    const goldChange1w = pct(gCloses[Math.max(0, n - 6)], goldPrice);
    const btcChange1w  = pct(bCloses[Math.max(0, n - 6)], btcPrice);
    const goldChange1m = pct(gCloses[Math.max(0, n - 22)], goldPrice);
    const btcChange1m  = pct(bCloses[Math.max(0, n - 22)], btcPrice);

    // 30d correlation on daily % returns
    const gRets = gCloses.slice(-31).map((c, i, a) => i === 0 ? 0 : (c - a[i-1]) / a[i-1] * 100).slice(1);
    const bRets = bCloses.slice(-31).map((c, i, a) => i === 0 ? 0 : (c - a[i-1]) / a[i-1] * 100).slice(1);
    const correlation30d = pearsonCorrelation(gRets, bRets);

    const divergence30d = parseFloat((btcChange1m - goldChange1m).toFixed(2));

    // Signal: is BTC diverging from gold?
    let divergenceSignal: CryptoGoldPayload["divergenceSignal"];
    if (divergence30d > 15)       divergenceSignal = "btc_leads";
    else if (divergence30d < -15) divergenceSignal = "gold_leads";
    else if (Math.abs(divergence30d) < 5) divergenceSignal = "converging";
    else divergenceSignal = "diverging";

    // Safe haven flow
    let safeHavenFlow: CryptoGoldPayload["safeHavenFlow"];
    if (goldChange1w > 1 && btcChange1w < -2)    safeHavenFlow = "to_gold";
    else if (btcChange1w > 1 && goldChange1w < -1) safeHavenFlow = "to_btc";
    else if (goldChange1w > 1 && btcChange1w > 1)  safeHavenFlow = "to_both";
    else                                            safeHavenFlow = "risk_on";

    const goldBias: CryptoGoldPayload["goldBias"] =
      safeHavenFlow === "to_gold" ? "bullish"
      : safeHavenFlow === "to_btc" ? "bearish"
      : divergence30d < -20 ? "bullish"   // gold lagging BTC = catch-up trade
      : "neutral";

    const data: CryptoGoldPayload = {
      goldPrice: Math.round(goldPrice),
      btcPrice:  Math.round(btcPrice),
      goldChange1d, btcChange1d,
      goldChange1w, btcChange1w,
      goldChange1m, btcChange1m,
      correlation30d,
      divergence30d,
      divergenceSignal,
      divergenceSignalTh:
        divergenceSignal === "btc_leads" ? "BTC นำ Gold — crypto risk appetite สูง"
        : divergenceSignal === "gold_leads" ? "Gold นำ BTC — safe haven ชัดเจน"
        : divergenceSignal === "converging" ? "BTC/Gold Converging — สหสัมพันธ์สูง"
        : "BTC/Gold Diverging — rotation กำลังเกิดขึ้น",
      divergenceColor:
        divergenceSignal === "gold_leads" ? "#34d399"
        : divergenceSignal === "btc_leads" ? "#818cf8"
        : "#f5c451",
      safeHavenFlow,
      safeHavenFlowTh:
        safeHavenFlow === "to_gold" ? "Safe Haven → ทอง — นักลงทุนหนีเข้าทอง"
        : safeHavenFlow === "to_btc" ? "Risk-On → BTC — เงินไหลเข้า crypto"
        : safeHavenFlow === "to_both" ? "Safe Haven → ทั้งคู่ — ลดดอลลาร์"
        : "Risk-On — ไม่มี safe haven demand",
      goldBias,
      goldBiasTh:
        goldBias === "bullish" ? "Bullish — กระแสเงินเข้าทองชัดเจน"
        : goldBias === "bearish" ? "Bearish — เงินไหลออกจากทอง"
        : "Neutral — ทองและ crypto ไม่ diverge",
      goldBiasColor: goldBias === "bullish" ? "#34d399" : goldBias === "bearish" ? "#f87171" : "#f5c451",
      history,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
