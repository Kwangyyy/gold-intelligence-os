import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface DailyPair {
  date: string;
  gold: number;
  dxy: number;
  goldReturn: number;  // %
  dxyReturn: number;   // %
}

export interface RollingCorr {
  window: number;       // days
  correlation: number;  // -1 to 1
  label: string;
}

export interface DXYCorrPayload {
  goldPrice: number;
  dxyPrice: number;
  goldChange1d: number;
  dxyChange1d: number;
  currentCorrelation: number;  // 30-day rolling
  correlationLabel: string;
  correlationLabelTh: string;
  rollingCorrelations: RollingCorr[];
  history: DailyPair[];        // last 90 days
  divergence: {
    active: boolean;
    goldDir: "up" | "down";
    dxyDir: "up" | "down";
    daysSince: number;
    signal: string;
    signalTh: string;
  };
  generatedAt: string;
}

function pearson(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;
  const n = x.length;
  const mx = x.reduce((a, v) => a + v, 0) / n;
  const my = y.reduce((a, v) => a + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    num  += (x[i] - mx) * (y[i] - my);
    dx2  += (x[i] - mx) ** 2;
    dy2  += (y[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom > 0 ? num / denom : 0;
}

async function fetchCloses(symbol: string, range: string): Promise<{ ts: number; close: number }[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const closes: (number|null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const timestamps: number[] = result.timestamp ?? [];
  const out: { ts: number; close: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) out.push({ ts: timestamps[i], close: closes[i]! });
  }
  return out;
}

let CACHE: { data: DXYCorrPayload; ts: number } | null = null;
const TTL = 20 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const [goldBars, dxyBars] = await Promise.all([
      fetchCloses("GC%3DF",    "90d"),
      fetchCloses("DX-Y.NYB",  "90d"),
    ]);

    // Align on same date
    const goldMap = new Map(goldBars.map(b => [new Date(b.ts * 1000).toISOString().slice(0, 10), b.close]));
    const dxyMap  = new Map(dxyBars.map(b => [new Date(b.ts * 1000).toISOString().slice(0, 10), b.close]));

    const dates = [...new Set([...goldMap.keys(), ...dxyMap.keys()])].filter(d => goldMap.has(d) && dxyMap.has(d)).sort();
    const aligned = dates.map(d => ({ date: d, gold: goldMap.get(d)!, dxy: dxyMap.get(d)! }));

    // Compute returns
    const history: DailyPair[] = aligned.map((b, i) => {
      const prevG = i > 0 ? aligned[i-1].gold : b.gold;
      const prevD = i > 0 ? aligned[i-1].dxy  : b.dxy;
      return {
        date: b.date, gold: +b.gold.toFixed(2), dxy: +b.dxy.toFixed(3),
        goldReturn: +((b.gold - prevG) / prevG * 100).toFixed(3),
        dxyReturn:  +((b.dxy  - prevD) / prevD * 100).toFixed(3),
      };
    });

    const goldRets = history.slice(1).map(b => b.goldReturn);
    const dxyRets  = history.slice(1).map(b => b.dxyReturn);

    // Rolling correlations for different windows
    const windows = [10, 20, 30, 60];
    const rollingCorrelations: RollingCorr[] = windows.map(w => {
      const gSlice = goldRets.slice(-w);
      const dSlice = dxyRets.slice(-w);
      const corr = pearson(gSlice, dSlice);
      const label = corr < -0.7 ? "Strong Inverse" : corr < -0.4 ? "Moderate Inverse" : corr < -0.1 ? "Weak Inverse" : corr < 0.1 ? "None" : corr < 0.4 ? "Weak Positive" : corr < 0.7 ? "Moderate Positive" : "Strong Positive";
      return { window: w, correlation: +corr.toFixed(3), label };
    });

    const currentCorr = rollingCorrelations.find(r => r.window === 30)?.correlation ?? 0;
    const corrLabel = currentCorr < -0.6 ? "Strong Inverse" : currentCorr < -0.3 ? "Moderate Inverse" : currentCorr < 0.1 ? "Weak/None" : currentCorr < 0.3 ? "Weak Positive" : "Positive";
    const corrLabelTh = currentCorr < -0.6 ? "ผกผันสูง" : currentCorr < -0.3 ? "ผกผันปานกลาง" : currentCorr < 0.1 ? "อ่อน/ไม่มี" : "บวก";

    // Divergence detection (last 5 days)
    const last5Gold = goldRets.slice(-5).reduce((a, v) => a + v, 0);
    const last5DXY  = dxyRets.slice(-5).reduce((a, v) => a + v, 0);
    const goldDir: "up" | "down" = last5Gold >= 0 ? "up" : "down";
    const dxyDir:  "up" | "down" = last5DXY  >= 0 ? "up" : "down";
    const diverge = goldDir === dxyDir; // same direction = divergence from typical inverse relation

    let divSignal = "", divSignalTh = "";
    if (diverge) {
      if (goldDir === "up" && dxyDir === "up") {
        divSignal = "Divergence: Both Gold and DXY rising — safe-haven demand driving gold despite dollar strength.";
        divSignalTh = "Divergence: ทองและ USD ขึ้นพร้อมกัน — demand safe-haven แข็งแกร่งมาก";
      } else {
        divSignal = "Divergence: Both falling — risk-off mood fading, watch for reversal.";
        divSignalTh = "Divergence: ทองและ USD ลงพร้อมกัน — momentum ขาลง ระวัง reversal";
      }
    } else {
      if (goldDir === "up") {
        divSignal = "Normal: Gold up / DXY down — classic inverse relationship holding.";
        divSignalTh = "ปกติ: ทองขึ้น USD ลง — inverse relationship ทำงานปกติ";
      } else {
        divSignal = "Normal: Gold down / DXY up — inverse relationship holding.";
        divSignalTh = "ปกติ: ทองลง USD ขึ้น — inverse relationship ทำงานปกติ";
      }
    }

    const goldPrice = aligned.at(-1)?.gold ?? 3000;
    const dxyPrice  = aligned.at(-1)?.dxy  ?? 104;
    const goldChange1d = history.at(-1)?.goldReturn ?? 0;
    const dxyChange1d  = history.at(-1)?.dxyReturn  ?? 0;

    const data: DXYCorrPayload = {
      goldPrice: +goldPrice.toFixed(2),
      dxyPrice:  +dxyPrice.toFixed(3),
      goldChange1d, dxyChange1d,
      currentCorrelation: currentCorr,
      correlationLabel: corrLabel,
      correlationLabelTh: corrLabelTh,
      rollingCorrelations,
      history: history.slice(-60),
      divergence: { active: diverge, goldDir, dxyDir, daysSince: 5, signal: divSignal, signalTh: divSignalTh },
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
