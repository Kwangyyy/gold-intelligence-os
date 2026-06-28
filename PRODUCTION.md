# Gold Intelligence OS — Production Readiness Plan

This document is an honest map of what exists today and what each remaining PRD area
needs to become a real, production product. Effort estimates assume one experienced
full-stack developer; costs are rough monthly figures (USD) at small scale.

---

## 1. What's built today (front-end demo)

A complete, navigable Next.js front-end — **12 pages**, TH/EN, Beginner/Pro, and a
Free/Premium/Pro tier preview — running on live gold data with rule-based analytics:

| Area | Status | Data source |
| --- | --- | --- |
| Market Overview, price/OHLC/ATR/session | ✅ real | Yahoo `GC=F` (no key) |
| Multi-Timeframe, Technical, SMC, S/R, Correlation | ✅ real calc | Yahoo candles |
| AI Recommendation, News impact, AI Copilot | ⚠️ real but **rate-limited** | Google Gemini free tier |
| Economic calendar (news) | 🟡 mock | `lib/mockNews.ts` |
| Trade Plan, Risk sizing, What-if | ✅ real calc | derived |
| Portfolio / EA Monitor | 🟡 simulated | `lib/portfolio.ts` (seeded; floating P/L tracks real price) |
| Alerts | ✅ client-side | browser notifications only |
| Auth / roles / billing | 🟡 preview only | `localStorage` tier switch — **not security** |

Legend: ✅ production-shaped · 🟡 demo/mock · ⚠️ works but constrained.

---

## 2. Gaps to production, by area

### 2.1 Reliability of the price feed (do first — cheap)
The unofficial Yahoo endpoint is fine for a demo but has no SLA, can rate-limit, and
may change. **Move to a proper market-data provider** and keep Yahoo as a fallback.
- Options: Twelve Data, Finnhub, Polygon, or a broker feed. Free tiers exist; paid
  XAUUSD real-time ≈ **$10–50/mo**.
- Effort: **0.5–1 day** (swap the fetch in `app/api/market/xauusd/route.ts` +
  `lib/timeframes.ts`, add `MARKET_API_KEY`).
- For true real-time (<1s, PRD §17), add a **WebSocket** feed + a WS server pushing to
  clients instead of 10s polling. Effort: **3–5 days**, cost depends on provider.

### 2.2 AI layer beyond the free tier (do early)
Gemini works but the free daily quota is exhausted by normal use; the app already
degrades to rule-based fallbacks.
- Fix: enable **billing** on the Google AI Studio key (pay-as-you-go), or budget for it.
  `gemini-2.5-flash-lite` is very cheap (~$0.10–0.40 per 1M tokens). Realistic cost at
  modest traffic: **$5–50/mo**. The model is already swappable via `GEMINI_MODEL`.
- Add server-side **rate-limiting + per-user quotas** so one user can't drain it.
- Effort: **0.5 day** (billing + a simple token-bucket limiter).

### 2.3 Real economic calendar (Module 6) — replaces the mock
- Provider: Trading Economics, Financial Modeling Prep, or Finnhub economic calendar.
  Paid ≈ **$0–80/mo** depending on coverage/real-time.
- Effort: **1–2 days** — replace `lib/mockNews.ts` with a fetch behind the existing
  `NewsRisk` types; the News Risk card and the Gemini "impact" analysis stay unchanged.

### 2.4 Real MT5 / EA data (Module 13) — replaces the simulated portfolio
This is the biggest integration. There is no browser-safe way to read MT5 directly.
- Architecture: an **MT5 bridge** — an Expert Advisor or a Python service
  (`MetaTrader5` package) running on a VPS next to the terminal, pushing account/positions/
  EA stats to your backend (REST or WebSocket), which the `/portfolio` page consumes.
- Needs: a **Windows VPS** (~$10–30/mo), the bridge code, auth between bridge and backend,
  and per-user account mapping.
- Effort: **1–2 weeks**. Replace `lib/portfolio.ts` with the live feed; the
  `PortfolioSnapshot` type is already the contract.
- Safety: keep the PRD rule — **AI advises, never trades**. No order execution from the app.

### 2.5 Institutional flow (Module 8) — currently absent (declined to fake)
- COT: free from **CFTC** (weekly, parseable). SPDR holdings: scrape/official feed.
  ETF flows / central-bank data: paid or manual.
- Effort: **3–5 days** for COT + SPDR; more for the rest. Build only with real sources —
  fabricated institutional data would mislead users.

### 2.6 Real auth, roles & subscriptions (PRD §8, §18, §19–20)
The tier switch is a preview, not security. Production needs:
- **Auth provider**: Auth.js (NextAuth), Clerk, or Supabase Auth. JWT + refresh +
  optional 2FA (PRD §18). Clerk ≈ **$0–25/mo** at small scale.
- **Database**: Postgres (the PRD's tables) — Supabase/Neon/RDS. **$0–25/mo**.
  Redis for sessions/caching/rate-limits — **$0–10/mo**.
- **Server-side route protection**: move the tier check from `TierGuard` (client) to
  middleware + per-API authorization. The client gate becomes UX only.
- **Billing**: Stripe subscriptions + webhooks to set the user's plan. Stripe takes a
  per-transaction fee, no fixed cost.
- Effort: **2–3 weeks** for auth + DB + RBAC + billing end to end.

### 2.7 Alert delivery channels (Module 18)
Browser notifications work; the PRD also wants Telegram/Discord/LINE/email. These need a
**backend** that stores alerts and evaluates them server-side (so they fire when the app
is closed):
- A scheduled worker (cron/queue) polls data, evaluates alerts, and sends via the channel
  APIs (Telegram Bot, Discord webhook, LINE Messaging, email via Resend/SES).
- Effort: **3–5 days**. Reuses `lib/alerts.ts` evaluation logic server-side.

### 2.8 Content Studio & Admin (Modules 19–20)
- Content Studio: straightforward once Gemini billing is on — generate posts/briefs from
  the existing snapshots. Effort: **2–4 days**.
- Admin panel: depends on auth + DB being in place. Effort: **1 week**.

---

## 3. Recommended phased rollout

**Phase A — Make the demo trustworthy (1 week)**
Paid price feed + Yahoo fallback · Gemini billing + rate-limiting · real economic calendar.
Outcome: every number is reliable and the AI always answers.

**Phase B — Accounts & monetization (2–3 weeks)**
Auth provider · Postgres + Redis · server-side RBAC (replace client gate) · Stripe plans.
Outcome: real users, real tiers, revenue.

**Phase C — Live trading data (2–3 weeks)**
MT5 bridge on a VPS · live `/portfolio` · server-side alerts + Telegram/LINE delivery.
Outcome: the copy-trade / EA-monitoring value proposition becomes real.

**Phase D — Depth & growth (ongoing)**
Institutional flow (real sources) · WebSocket real-time price · Content Studio · Admin ·
screenshot analysis (vision model) · the full AI Investment Committee.

---

## 4. Cross-cutting production work

- **Hosting**: Vercel for the Next.js app (**$0–20/mo**) + a small always-on backend/VPS
  for the bridge, workers, and WebSocket (**$10–40/mo**).
- **Secrets**: move all keys to the host's env/secret manager. `.env.local` is gitignored;
  **rotate the Gemini key** that was shared in chat.
- **Observability**: error tracking (Sentry), uptime, and logging — PRD §17 targets 99.9%.
- **Compliance (PRD §13)**: the risk disclaimer + no-guaranteed-profit wording are already
  enforced in the UI and prompts; keep an audit log once the DB exists.
- **Testing**: the analytics in `lib/*` are pure functions — add unit tests (the math is
  already verified ad-hoc) before they back paid features.

---

## 5. Rough budget at small scale

| Item | Monthly |
| --- | --- |
| Market data (real-time XAUUSD) | $10–50 |
| Economic calendar | $0–80 |
| Gemini (pay-as-you-go) | $5–50 |
| Auth (Clerk or self-host Auth.js) | $0–25 |
| Postgres + Redis | $0–35 |
| Hosting (Vercel + VPS for MT5 bridge/workers) | $10–60 |
| **Total** | **~$25–300/mo** |

Starts near the low end; scales with users and data depth. Stripe fees are per-transaction.

---

*This plan reflects the codebase as of the current build. The front-end is feature-complete
against the PRD's analysis/planning surface; the work above is what turns the demo into a
revenue-ready product.*
