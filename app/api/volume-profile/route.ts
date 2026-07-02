import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface VolumeBar {
  date: string;
  close: number;
  volume: number;
  obv: number;
  pvt: number;
  adLine: number;
  volumeColor: "up" | "down" | "neutral";
}

export interface VolumeLevel {
  priceMin: number;
  priceMax: number;
  totalVolume: number;
  pct: number;  // % of total volume at this level
}

export interface VolumeProfilePayload {
  goldPrice: number;
  change1DPct: number;
  obvTrend: "rising" | "falling" | "flat";
  obvSignal: "bullish" | "neutral" | "bearish";
  pvtTrend: "rising" | "falling" | "flat";
  adLineTrend: "rising" | "falling" | "flat";
  adLineSignal: "bullish" | "neutral" | "bearish";
  volumeMA20: number;
  currentVolume: number;
  volumeRatio: number;  // current / MA20
  volumeExpansion: boolean;
  highVolumeDay: boolean;
  pocPrice: number;  // Point of Control — price with most volume (30D)
  pocPct: number;    // how far current price is from POC
  recentBars: VolumeBar[];
  volumeLevels: VolumeLevel[];  // price-by-volume (30D)
  interpretation: string;
  confluences: string[];
  timestamp: string;
}

let CACHE: { data: VolumeProfilePayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent("GC=F")}?range=3mo&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const j = await res.json();
    const r = j.chart?.result?.[0];
    if (!r) throw new Error("No result");

    const meta = r.meta ?? {};
    const q = r.indicators?.quote?.[0] ?? {};
    const timestamps: number[] = r.timestamp ?? [];
    const opens: number[] = q.open ?? [];
    const highs: number[] = q.high ?? [];
    const lows: number[] = q.low ?? [];
    const closes: number[] = q.close ?? [];
    const volumes: number[] = q.volume ?? [];

    const n = closes.length;
    const goldPrice: number = meta.regularMarketPrice ?? closes[n - 1] ?? 3350;
    const prevClose: number = meta.chartPreviousClose ?? closes[n - 2] ?? goldPrice;
    const change1DPct = ((goldPrice - prevClose) / prevClose) * 100;

    // OBV (On Balance Volume)
    const obv: number[] = [0];
    for (let i = 1; i < n; i++) {
      if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + (volumes[i] ?? 0));
      else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - (volumes[i] ?? 0));
      else obv.push(obv[i - 1]);
    }

    // PVT (Price-Volume Trend)
    const pvt: number[] = [0];
    for (let i = 1; i < n; i++) {
      const roc = closes[i - 1] > 0 ? ((closes[i] - closes[i - 1]) / closes[i - 1]) : 0;
      pvt.push(pvt[i - 1] + roc * (volumes[i] ?? 0));
    }

    // A/D Line (Accumulation/Distribution)
    const adLine: number[] = [0];
    for (let i = 1; i < n; i++) {
      const h = highs[i] ?? closes[i];
      const l = lows[i] ?? closes[i];
      const c = closes[i];
      const clv = (h !== l) ? ((c - l) - (h - c)) / (h - l) : 0;
      adLine.push(adLine[i - 1] + clv * (volumes[i] ?? 0));
    }

    // Volume MA20
    const vol20 = volumes.slice(Math.max(0, n - 20)).filter(v => v > 0);
    const volumeMA20 = vol20.length > 0 ? vol20.reduce((a, b) => a + b) / vol20.length : 0;
    const currentVolume = volumes[n - 1] ?? 0;
    const volumeRatio = volumeMA20 > 0 ? currentVolume / volumeMA20 : 1;
    const volumeExpansion = volumeRatio > 1.3;
    const highVolumeDay = volumeRatio > 1.8;

    // Trends (compare last 5 vs prior 5)
    const trendLen = 5;
    function trend(arr: number[]): "rising" | "falling" | "flat" {
      if (arr.length < trendLen * 2) return "flat";
      const recent = arr.slice(-trendLen).reduce((a, b) => a + b) / trendLen;
      const prior = arr.slice(-trendLen * 2, -trendLen).reduce((a, b) => a + b) / trendLen;
      const d = (recent - prior) / Math.abs(prior || 1);
      if (d > 0.02) return "rising";
      if (d < -0.02) return "falling";
      return "flat";
    }

    const obvTrend = trend(obv);
    const pvtTrend = trend(pvt);
    const adLineTrend = trend(adLine);

    function signalFromTrend(t: string, priceChange: number): "bullish" | "neutral" | "bearish" {
      if (t === "rising") return priceChange >= 0 ? "bullish" : "bullish"; // volume trend bullish regardless of price (divergence if price falling)
      if (t === "falling") return "bearish";
      return "neutral";
    }

    const obvSignal = signalFromTrend(obvTrend, change1DPct);
    const adLineSignal = signalFromTrend(adLineTrend, change1DPct);

    // Build recent bars (last 20 days)
    const recentBars: VolumeBar[] = [];
    const startIdx = Math.max(0, n - 20);
    for (let i = startIdx; i < n; i++) {
      const ts = timestamps[i];
      const date = ts ? new Date(ts * 1000).toISOString().split("T")[0] : "";
      recentBars.push({
        date,
        close: closes[i] ?? 0,
        volume: volumes[i] ?? 0,
        obv: obv[i] ?? 0,
        pvt: pvt[i] ?? 0,
        adLine: adLine[i] ?? 0,
        volumeColor: closes[i] > (closes[i - 1] ?? closes[i]) ? "up" : closes[i] < (closes[i - 1] ?? closes[i]) ? "down" : "neutral",
      });
    }

    // Price-by-volume (30D): bucket into 15 price bins
    const days30Start = Math.max(0, n - 30);
    const h30 = Math.max(...highs.slice(days30Start));
    const l30 = Math.min(...lows.slice(days30Start).filter(x => x > 0));
    const binSize = (h30 - l30) / 15;
    const binVols = new Array(15).fill(0);
    for (let i = days30Start; i < n; i++) {
      const midPrice = ((highs[i] ?? closes[i]) + (lows[i] ?? closes[i])) / 2;
      const bin = Math.min(14, Math.floor((midPrice - l30) / binSize));
      if (bin >= 0) binVols[bin] += (volumes[i] ?? 0);
    }
    const totalVol30 = binVols.reduce((a, b) => a + b, 1);
    const volumeLevels: VolumeLevel[] = binVols.map((v, i) => ({
      priceMin: l30 + i * binSize,
      priceMax: l30 + (i + 1) * binSize,
      totalVolume: v,
      pct: (v / totalVol30) * 100,
    }));

    // POC (Point of Control): bin with highest volume
    const pocIdx = binVols.indexOf(Math.max(...binVols));
    const pocPrice = (l30 + (pocIdx + 0.5) * binSize);
    const pocPct = pocPrice > 0 ? ((goldPrice - pocPrice) / pocPrice) * 100 : 0;

    // Interpretation
    const bullishSignals = [obvTrend === "rising", pvtTrend === "rising", adLineTrend === "rising", volumeExpansion && change1DPct > 0].filter(Boolean).length;
    const bearishSignals = [obvTrend === "falling", pvtTrend === "falling", adLineTrend === "falling", volumeExpansion && change1DPct < 0].filter(Boolean).length;

    const interpretation = bullishSignals >= 3
      ? "Strong bullish volume signals: rising OBV, PVT, and A/D Line confirm institutional accumulation."
      : bearishSignals >= 3
      ? "Multiple bearish volume signals: distribution pattern suggests smart money is selling."
      : obvTrend !== adLineTrend
      ? "Mixed volume signals: divergence between OBV and A/D Line — watch for resolution."
      : "Volume analysis is neutral — no strong accumulation or distribution signal.";

    const confluences: string[] = [];
    if (volumeExpansion) confluences.push(`Volume ${(volumeRatio * 100 - 100).toFixed(0)}% above 20D avg — ${change1DPct > 0 ? "strong buying" : "strong selling"} pressure`);
    if (Math.abs(pocPct) < 0.5) confluences.push(`Price near Point of Control ($${pocPrice.toFixed(1)}) — key value area`);
    else confluences.push(`Price ${pocPct > 0 ? "above" : "below"} POC by ${Math.abs(pocPct).toFixed(1)}% — ${pocPct > 0 ? "breakout from" : "below"} high-volume node`);
    if (obvTrend === "rising" && change1DPct < 0) confluences.push("OBV rising vs price falling — potential bullish divergence (accumulation on dip)");
    if (obvTrend === "falling" && change1DPct > 0) confluences.push("OBV falling vs price rising — potential bearish divergence (distribution on rally)");

    const payload: VolumeProfilePayload = {
      goldPrice, change1DPct, obvTrend, obvSignal, pvtTrend,
      adLineTrend, adLineSignal, volumeMA20, currentVolume,
      volumeRatio, volumeExpansion, highVolumeDay, pocPrice, pocPct,
      recentBars, volumeLevels, interpretation, confluences,
      timestamp: new Date().toISOString(),
    };

    CACHE = { data: payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("volume-profile error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
