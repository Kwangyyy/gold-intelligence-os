import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface AssetRow {
  symbol: string;
  name: string;
  nameTh: string;
  icon: string;
  category: "gold" | "equity" | "crypto" | "commodity" | "bond" | "forex";
  price: number;
  priceStr: string;     // formatted with currency/unit
  ret1d: number;
  ret1w: number;
  ret1m: number;
  retYtd: number;
  rankYtd: number;      // 1 = best
  isGold: boolean;
}

export interface LeaderboardPayload {
  goldRankYtd: number;
  goldRankOf: number;
  goldRetYtd: number;
  goldPrice: number;
  bestAsset: string;
  bestAssetFlag: string;
  bestRetYtd: number;
  rows: AssetRow[];     // sorted by YTD desc
  generatedAt: string;
}

const ASSETS = [
  { sym: "GC=F",      name: "Gold",         nameTh: "ทองคำ",        icon: "🪙", cat: "gold"      as const, fmt: (p: number) => `$${p.toFixed(0)}/oz`  },
  { sym: "SI=F",      name: "Silver",       nameTh: "เงิน",         icon: "🥈", cat: "commodity" as const, fmt: (p: number) => `$${p.toFixed(2)}/oz`  },
  { sym: "CL=F",      name: "Crude Oil",    nameTh: "น้ำมันดิบ",   icon: "🛢️", cat: "commodity" as const, fmt: (p: number) => `$${p.toFixed(2)}/bbl` },
  { sym: "SPY",       name: "S&P 500 ETF",  nameTh: "S&P 500",      icon: "🇺🇸", cat: "equity"    as const, fmt: (p: number) => `$${p.toFixed(2)}`    },
  { sym: "QQQ",       name: "Nasdaq 100",   nameTh: "Nasdaq 100",   icon: "💻", cat: "equity"    as const, fmt: (p: number) => `$${p.toFixed(2)}`    },
  { sym: "TLT",       name: "20Y Bond ETF", nameTh: "พันธบัตร 20Y", icon: "📜", cat: "bond"      as const, fmt: (p: number) => `$${p.toFixed(2)}`    },
  { sym: "BTC-USD",   name: "Bitcoin",      nameTh: "Bitcoin",       icon: "₿",  cat: "crypto"   as const, fmt: (p: number) => `$${p.toFixed(0)}`    },
  { sym: "GLD",       name: "Gold ETF",     nameTh: "GLD ETF",       icon: "🔶", cat: "gold"     as const, fmt: (p: number) => `$${p.toFixed(2)}`    },
  { sym: "DX-Y.NYB",  name: "US Dollar",   nameTh: "ดอลลาร์ (DXY)", icon: "💵", cat: "forex"    as const, fmt: (p: number) => p.toFixed(2)           },
];

type YChart = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; previousClose?: number };
      timestamp?: number[];
      indicators?: { adjclose?: Array<{ adjclose?: (number | null)[] }>; quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
};

async function fetchAsset(sym: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    const j = await r.json() as YChart;
    const res = j?.chart?.result?.[0];
    if (!res) return null;
    const meta   = res.meta ?? {};
    const ts     = res.timestamp ?? [];
    const closes = (res.indicators?.adjclose?.[0]?.adjclose
                 ?? res.indicators?.quote?.[0]?.close ?? [])
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

    if (!closes.length) return null;

    const price    = meta.regularMarketPrice ?? closes[closes.length - 1];
    const prevClose = meta.previousClose ?? closes[closes.length - 2] ?? price;

    // Find YTD start: first trading day in Jan of current year
    const now = new Date();
    const ytdStart = new Date(now.getFullYear(), 0, 1).getTime() / 1000;
    let ytdIdx = 0;
    for (let i = 0; i < ts.length; i++) {
      if (ts[i] >= ytdStart) { ytdIdx = i; break; }
    }
    const ytdPrice = closes[ytdIdx] ?? closes[0];

    const n = closes.length;
    const price1w = closes[Math.max(0, n - 6)]  ?? closes[0];
    const price1m = closes[Math.max(0, n - 22)] ?? closes[0];

    const ret = (from: number, to: number) => from > 0 ? ((to - from) / from) * 100 : 0;

    return {
      price:   parseFloat(price.toFixed(4)),
      prevClose,
      ret1d:   parseFloat(ret(prevClose, price).toFixed(2)),
      ret1w:   parseFloat(ret(price1w, price).toFixed(2)),
      ret1m:   parseFloat(ret(price1m, price).toFixed(2)),
      retYtd:  parseFloat(ret(ytdPrice, price).toFixed(2)),
    };
  } catch { return null; }
}

let CACHE: { data: LeaderboardPayload; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.data);

  try {
    const results = await Promise.all(ASSETS.map(a => fetchAsset(a.sym)));

    const rows: AssetRow[] = [];
    for (let i = 0; i < ASSETS.length; i++) {
      const d = results[i];
      if (!d) continue;
      const a = ASSETS[i];
      rows.push({
        symbol: a.sym,
        name:   a.name,
        nameTh: a.nameTh,
        icon:   a.icon,
        category: a.cat,
        price:    d.price,
        priceStr: a.fmt(d.price),
        ret1d:    d.ret1d,
        ret1w:    d.ret1w,
        ret1m:    d.ret1m,
        retYtd:   d.retYtd,
        rankYtd:  0,
        isGold:   a.sym === "GC=F",
      });
    }

    // Sort by YTD desc and assign ranks
    rows.sort((a, b) => b.retYtd - a.retYtd);
    rows.forEach((r, i) => { r.rankYtd = i + 1; });

    const goldRow = rows.find(r => r.isGold);
    const best    = rows[0];

    const data: LeaderboardPayload = {
      goldRankYtd:   goldRow?.rankYtd ?? 0,
      goldRankOf:    rows.length,
      goldRetYtd:    goldRow?.retYtd ?? 0,
      goldPrice:     goldRow?.price  ?? 3200,
      bestAsset:     best?.name   ?? "",
      bestAssetFlag: best?.icon   ?? "",
      bestRetYtd:    best?.retYtd ?? 0,
      rows,
      generatedAt: new Date().toISOString(),
    };

    CACHE = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
