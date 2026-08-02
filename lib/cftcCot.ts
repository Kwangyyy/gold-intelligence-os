// Commitment of Traders for COMEX gold, from the CFTC itself.
//
// Three pages in this app showed COT positioning and none of them fetched
// anything: smart-money carried a snapshot hardcoded at 2026-06-24, cot-extremes
// had a literal history table with a comment saying real data "would be"
// fetched, and cot-live stamped `asOf: today` on numbers it had modelled from
// price action. They disagreed with each other, and the freshest-looking one was
// the most fictional.
//
// The CFTC publishes the real thing free and unauthenticated via Socrata. This
// is the disaggregated futures-only report; gold is contract code 088691
// (GOLD - COMMODITY EXCHANGE INC.).
//
// Cadence to be aware of: positions are as of Tuesday's close and publish
// Friday 15:30 ET. So the newest report is always 3-7 days old — that is the
// data, not a staleness bug, and the UI should say the report date rather than
// implying "now".

import { cachedJson } from "./kvStore";

const SOCRATA = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";
const GOLD_CODE = "088691";
const TTL_MS = 6 * 60 * 60 * 1000; // weekly data; 6h is generous

export interface CotWeek {
  date: string;            // YYYY-MM-DD, the Tuesday the positions were held
  openInterest: number;
  largeSpecLong: number;   // non-commercial = managed money + other reportables
  largeSpecShort: number;
  largeSpecNet: number;
  commercialLong: number;
  commercialShort: number;
  commercialNet: number;
  smallSpecLong: number;   // non-reportable
  smallSpecShort: number;
  smallSpecNet: number;
}

interface SocrataRow {
  report_date_as_yyyy_mm_dd?: string;
  open_interest_all?: string;
  noncomm_positions_long_all?: string;
  noncomm_positions_short_all?: string;
  comm_positions_long_all?: string;
  comm_positions_short_all?: string;
  nonrept_positions_long_all?: string;
  nonrept_positions_short_all?: string;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Weekly gold COT, oldest first. Returns [] if the CFTC is unreachable — callers
 * decide whether to degrade or fail, but nobody should invent numbers.
 *
 * Shared across instances: this is one report a week, and every serverless cold
 * start was re-pulling 156 rows of it.
 */
export async function getGoldCot(weeks = 156): Promise<CotWeek[]> {
  const all = await cachedJson<CotWeek[]>("gios:cot:gold", TTL_MS / 1000, async () => {
    const url =
      `${SOCRATA}?cftc_contract_market_code=${GOLD_CODE}` +
      `&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=156`;
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!r.ok) throw new Error(`CFTC ${r.status}`);
    const rows = (await r.json()) as SocrataRow[];
    if (!Array.isArray(rows) || !rows.length) throw new Error("CFTC: empty");

    return rows
      .map((row) => {
        const largeSpecLong = n(row.noncomm_positions_long_all);
        const largeSpecShort = n(row.noncomm_positions_short_all);
        const commercialLong = n(row.comm_positions_long_all);
        const commercialShort = n(row.comm_positions_short_all);
        const smallSpecLong = n(row.nonrept_positions_long_all);
        const smallSpecShort = n(row.nonrept_positions_short_all);
        return {
          date: (row.report_date_as_yyyy_mm_dd ?? "").slice(0, 10),
          openInterest: n(row.open_interest_all),
          largeSpecLong,
          largeSpecShort,
          largeSpecNet: largeSpecLong - largeSpecShort,
          commercialLong,
          commercialShort,
          commercialNet: commercialLong - commercialShort,
          smallSpecLong,
          smallSpecShort,
          smallSpecNet: smallSpecLong - smallSpecShort,
        };
      })
      .filter((w) => w.date && w.openInterest > 0)
      .reverse(); // oldest first
  }).catch(() => [] as CotWeek[]);

  return all.slice(-weeks);
}

/** Where `value` sits within `series`, 0-100. */
export function percentileOf(series: number[], value: number): number {
  const clean = series.filter((v) => Number.isFinite(v));
  if (!clean.length) return 50;
  const below = clean.filter((v) => v <= value).length;
  return Math.round((below / clean.length) * 100);
}

/** How many days old the report is — always 3+, since positions are Tuesday's. */
export function reportAgeDays(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** One troy ounce per 100-oz COMEX contract lot, expressed in tonnes. */
export const CONTRACTS_TO_TONNES = (100 * 31.1034768) / 1_000_000;
