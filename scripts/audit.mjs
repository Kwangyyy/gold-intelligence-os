#!/usr/bin/env node
// Data-integrity audit for the whole API surface.
//
// Every bug worth finding in this codebase so far was found by sweeping all the
// routes at once and comparing them against reality, not by reading any single
// file: pages quoting delayed futures while the chart showed spot, three COT
// features that contained no COT, price fallbacks left at 2024 constants,
// option chains generated with Math.random, fetches with no timeout. None of
// that is visible to tsc or eslint, and all of it is visible here.
//
//   node scripts/audit.mjs                     # against localhost:3100
//   node scripts/audit.mjs https://your.app    # against a deploy
//
// Exits non-zero if any check fails, so it can gate a deploy.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3100";
const TIMEOUT_MS = 90_000;

// ── which routes to sweep ────────────────────────────────────────────────────
// Skipped: anything that mutates, needs a session, or is not JSON.
const SKIP = /^(auth|admin|mt5|cron|telegram|council|user|broadcast|pwa-icon|journal|paper|ai-ea|signal-log|price-alerts|ea-monitor|ea-enhance|sr-indicator|ai)(\/|$)/;

function routes(dir = "app/api", prefix = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    const route = prefix ? `${prefix}/${name}` : name;
    if (readdirSync(p).includes("route.ts")) out.push(route);
    out.push(...routes(p, route));
  }
  return out.filter((r) => !SKIP.test(r)).sort();
}

const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return { status: r.status, body: await r.text() };
};

const failures = [];
const fail = (check, detail) => failures.push(`${check}: ${detail}`);

// ── 1. static: no route may fabricate numbers or fetch without a deadline ────
function staticChecks() {
  const files = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith(".ts")) files.push(p);
    }
  };
  walk("app/api");
  walk("lib");

  for (const f of files) {
    const src = readFileSync(f, "utf8");
    src.split("\n").forEach((line, i) => {
      // Strip the \r first: these files are CRLF, and in JS regex `\r` is a line
      // terminator, so `//.*$` fails to match and every comment mentioning
      // Math.random got reported as using it.
      const code = line.replace(/\r/g, "").replace(/\/\/.*/, "");
      if (!/Math\.random\s*\(/.test(code)) return;
      // Random identifiers are fine — it is random *data* that is the problem.
      if (/toString\(36\)|randomUUID|\bid\b\s*[:=]/.test(code)) return;
      fail("no-random", `${f}:${i + 1} fabricates a value with Math.random`);
    });
    // fetch( … ) with no abort signal: one hung upstream takes the route down
    for (const m of src.matchAll(/await fetch\(/g)) {
      let depth = 0, j = src.indexOf("(", m.index);
      const start = j;
      for (; j < src.length; j++) {
        if (src[j] === "(") depth++;
        else if (src[j] === ")" && --depth === 0) break;
      }
      const call = src.slice(start, j);
      if (!call.includes("signal")) {
        const line = src.slice(0, m.index).split("\n").length;
        fail("fetch-timeout", `${f}:${line} outbound fetch has no AbortSignal`);
      }
    }
    // price constants from when gold traded near $3,300
    src.split("\n").forEach((line, i) => {
      const code = line.replace(/\r/g, "").replace(/\/\/.*/, "");
      if (/Round Number|peakPrice|troughPrice|mmNet/.test(code)) return;
      if (/\b(price|spot|goldPrice|comexSpot|basePrice)\b\s*[:=?]{1,2}\s*[34]\d{3}\b/i.test(code)) {
        fail("no-stale-price", `${f}:${i + 1} hardcoded gold price fallback`);
      }
    });
  }
}

// ── 2. live: prices must match the market the chart plots ───────────────────
const PRICE_KEYS = new Set([
  "price", "spot", "spotprice", "currentspot", "goldprice", "currentprice",
  "goldusd", "comexspot", "entry", "lastprice",
]);

// Routes that legitimately quote instruments other than gold — DXY, silver,
// equities, individual futures contracts — so a `price` field there is not
// supposed to equal spot gold.
const MULTI_ASSET = new Set([
  "intermarket", "intermarket-heatmap", "market/symbols", "commodity-matrix",
  "correlation", "relative-strength", "risk-parity", "multi-momentum",
  "macro-heat", "gold-beta", "mining-stocks", "leaderboard", "futures-curve",
  "carry-trade", "flow-tracker", "market-breadth", "global-yields",
  "yield-curve", "yield-spread", "currency-stress", "dollar-milkshake",
  "global-gold-price", "gold-currencies", "position-dashboard", "scanner/multi",
]);

// Routes that cannot be deterministic by nature: an LLM writes the copy, or the
// payload quotes many live instruments that genuinely tick between two calls.
// Also anything whose upstream rate-limits a second call seconds later.
const NON_DETERMINISTIC = new Set([
  "brief", "forecast", "trade-ideas", "weekly-brief", "news-sentiment",
  "gold-news-catalyst", "market-summary", "trade-setup", "plan",
  "market/symbols", "intermarket", "intermarket-heatmap", "leaderboard",
  "econ-impact", "calendar", "calendar-live", "ai-model/data",
]);

// Top level only. Nested objects like `keyLevel`, `nearestResistance` and
// `strongestSupport` also carry a `price`, but those are support and resistance
// levels — they are *supposed* to sit away from spot, and checking them
// reported a working route as broken.
function topPrices(o) {
  const out = [];
  if (!o || typeof o !== "object") return out;
  for (const [k, v] of Object.entries(o)) {
    if (PRICE_KEYS.has(k.toLowerCase()) && typeof v === "number" && v > 100 && v < 30000) out.push([k, v]);
  }
  return out;
}

// ── 3. live: two calls seconds apart must agree ─────────────────────────────
const VOLATILE = /"(timestamp|generatedAt|asOf|at|ts|lastUpdate|updatedAt|time)"\s*:\s*"[^"]*"/g;
const normalise = (b) => b.replace(VOLATILE, '"_":""').replace(/(\d{4})\.\d+/g, "$1");

async function liveChecks(list) {
  const spot = Number(
    JSON.parse((await get("https://data-api.binance.vision/api/v3/ticker/price?symbol=PAXGUSDT")).body).price,
  );
  console.log(`  reference spot: ${spot.toFixed(2)}\n`);

  for (const r of list) {
    const twice = !NON_DETERMINISTIC.has(r);
    let a, b;
    try {
      a = await get(`${BASE}/api/${r}`);
      if (twice) b = await get(`${BASE}/api/${r}`);
    } catch (e) {
      fail("reachable", `${r} — ${String(e).slice(0, 60)}`);
      continue;
    }
    if (a.status >= 500) { fail("no-5xx", `${r} returned ${a.status}`); continue; }
    if (!a.body.trimStart().startsWith("{") && !a.body.trimStart().startsWith("[")) continue;

    let json;
    try { json = JSON.parse(a.body); } catch { fail("json", `${r} did not return JSON`); continue; }

    if (!MULTI_ASSET.has(r)) {
      for (const [k, v] of topPrices(json)) {
        if (Math.abs(v - spot) > spot * 0.02) {
          fail("price-matches-spot", `${r}.${k} = ${v} against spot ${spot.toFixed(0)}`);
        }
      }
    }
    if (b && normalise(a.body) !== normalise(b.body)) {
      fail("deterministic", `${r} returned different data on two consecutive calls`);
    }
  }
}

// ── run ──────────────────────────────────────────────────────────────────────
const list = routes();
console.log(`auditing ${list.length} routes against ${BASE}\n`);
staticChecks();
await liveChecks(list);

if (!failures.length) {
  console.log(`\n✓ all checks passed (${list.length} routes)`);
  process.exit(0);
}
const byCheck = {};
for (const f of failures) {
  const [check, ...rest] = f.split(": ");
  (byCheck[check] ??= []).push(rest.join(": "));
}
console.log(`\n✗ ${failures.length} failures\n`);
for (const [check, items] of Object.entries(byCheck)) {
  console.log(`  ${check} (${items.length})`);
  for (const i of items.slice(0, 12)) console.log(`      ${i}`);
  if (items.length > 12) console.log(`      … ${items.length - 12} more`);
}
process.exit(1);
