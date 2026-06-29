import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// CFTC Disaggregated COT Report — Futures-and-Options-Combined
// https://publicreporting.cftc.gov/resource/kh3c-gbw2.json
// Gold (COMEX) code: 088691  Silver: 084691  BTC: 133741

export interface CotRow {
  id: string;
  name: string;
  icon: string;
  date: string;
  // Managed Money (large specs / hedge funds)
  mmLong: number;
  mmShort: number;
  mmNet: number;
  mmNetPrev: number;
  mmChange: number;
  // Commercial (hedgers)
  commLong: number;
  commShort: number;
  commNet: number;
  // Non-Commercial (large speculators)
  ncLong: number;
  ncShort: number;
  ncNet: number;
  // Open Interest
  openInterest: number;
}

interface CftcRecord {
  report_date_as_yyyy_mm_dd?: string;
  // Non-commercial
  noncomm_positions_long_all?: string;
  noncomm_positions_short_all?: string;
  // Commercial
  comm_positions_long_all?: string;
  comm_positions_short_all?: string;
  // Open interest
  open_interest_all?: string;
  // Managed money (disaggregated)
  m_money_positions_long_all?: string;
  m_money_positions_short_all?: string;
}

const INSTRUMENTS = [
  { id: "XAUUSD", name: "Gold",   icon: "🥇", code: "088691" },
  { id: "XAGUSD", name: "Silver", icon: "🥈", code: "084691" },
  { id: "USOUSD", name: "WTI",    icon: "🛢", code: "067651" },
  { id: "EURUSD", name: "EUR/USD",icon: "💶", code: "099741" },
  { id: "BTCUSD", name: "Bitcoin",icon: "₿",  code: "133741" },
];

const BASE = "https://publicreporting.cftc.gov/resource/kh3c-gbw2.json";

let CACHE: { data: CotRow[]; ts: number } | null = null;
const TTL = 4 * 60 * 60 * 1000; // 4 hours (COT updates weekly on Fridays)

async function fetchCot(code: string): Promise<CftcRecord[]> {
  const url = `${BASE}?cftc_commodity_code=${code}&$limit=2&$order=report_date_as_yyyy_mm_dd+DESC`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!r.ok) throw new Error(`CFTC ${r.status}`);
  return r.json();
}

function toNum(v: string | undefined): number {
  return v ? parseInt(v.replace(/,/g, ""), 10) || 0 : 0;
}

async function buildRow(inst: typeof INSTRUMENTS[0]): Promise<CotRow> {
  const records = await fetchCot(inst.code);
  const cur  = records[0] ?? {};
  const prev = records[1] ?? {};

  const mmLong  = toNum(cur.m_money_positions_long_all);
  const mmShort = toNum(cur.m_money_positions_short_all);
  const mmNet   = mmLong - mmShort;

  const mmLongP  = toNum(prev.m_money_positions_long_all);
  const mmShortP = toNum(prev.m_money_positions_short_all);
  const mmNetPrev = mmLongP - mmShortP;

  return {
    id:   inst.id,
    name: inst.name,
    icon: inst.icon,
    date: cur.report_date_as_yyyy_mm_dd?.slice(0, 10) ?? "—",
    mmLong, mmShort, mmNet,
    mmNetPrev,
    mmChange: mmNet - mmNetPrev,
    commLong:  toNum(cur.comm_positions_long_all),
    commShort: toNum(cur.comm_positions_short_all),
    commNet:   toNum(cur.comm_positions_long_all) - toNum(cur.comm_positions_short_all),
    ncLong:    toNum(cur.noncomm_positions_long_all),
    ncShort:   toNum(cur.noncomm_positions_short_all),
    ncNet:     toNum(cur.noncomm_positions_long_all) - toNum(cur.noncomm_positions_short_all),
    openInterest: toNum(cur.open_interest_all),
  };
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) {
    return NextResponse.json(CACHE.data, { headers: { "Cache-Control": "public, max-age=14400" } });
  }

  const results = await Promise.allSettled(INSTRUMENTS.map(buildRow));
  const data: CotRow[] = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : {
      id: INSTRUMENTS[i].id, name: INSTRUMENTS[i].name, icon: INSTRUMENTS[i].icon,
      date: "—", mmLong: 0, mmShort: 0, mmNet: 0, mmNetPrev: 0, mmChange: 0,
      commLong: 0, commShort: 0, commNet: 0, ncLong: 0, ncShort: 0, ncNet: 0, openInterest: 0,
    }
  );

  CACHE = { data, ts: Date.now() };
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=14400" } });
}
