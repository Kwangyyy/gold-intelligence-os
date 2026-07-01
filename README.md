# Gold Intelligence OS — Market Overview Dashboard

Module 1 of **Gold Intelligence OS** by EA Profit Lab: a real-time XAUUSD market
overview dashboard. This is a single-module deep-dive (the foundation other modules
plug into), bilingual (TH/EN), built with Next.js + TypeScript + TailwindCSS.

## What's real vs. stubbed

| Area | Source |
| --- | --- |
| Price, prev close, OHLC, daily change/% | **Live** — Yahoo Finance `GC=F` (COMEX gold futures, a close proxy for XAUUSD spot), proxied server-side. No API key. |
| ATR, daily range, volatility status, market condition, market score | Derived from the live data (`lib/marketLogic.ts`) |
| Session + London/NY open countdowns | Computed from the UTC clock |
| AI recommendation + reasoning (PRD §12 output) | **Live — Google Gemini** (`lib/gemini.ts`). Reads the market data and writes the recommendation + reasoning in TH/EN. Falls back to the rule-based stub if the key is missing or the call fails. |
| News impact analysis ("why this matters for gold") | **Live — Google Gemini**, per upcoming event, bilingual. |
| Spread | Simulated (mock) |
| News risk level + next-event countdown | Mock economic calendar (`lib/mockNews.ts`) — event data only; the *analysis* is Gemini. |

## Beginner / Pro mode

A global **Beginner / Pro** toggle (top nav, next to language; persisted to `localStorage`
via `lib/mode.ts`) addresses the PRD's "too complex for beginners" risk:
- **Beginner** — the Overview shows a simplified, action-first view (price + recommendation
  + news risk, then a plain "what to do" card with risk and the suggested action). Complex
  pages (Technical, Smart Money, S/R, Correlation, Trade Plan) show a one-line 💡 explainer
  (`components/BeginnerHint.tsx`).
- **Pro** — the full detailed view everywhere.

The Overview page ends with a **Module Hub** (`components/ModuleHub.tsx`) — a grid linking
every tool with an icon and a one-line description, so every page is discoverable from
the landing page.

## Subscription tiers (preview)

A **Free / Premium / Pro** plan switcher in the top nav (`lib/tier.ts`) previews the PRD §8
permission model. Each route has a minimum tier (`ROUTE_MIN_TIER`); `TierGuard` (in the
layout) shows an upgrade prompt instead of the page when the current tier is too low, and
locked pages show a 🔒 in the nav and Module Hub. **Default is Pro** so the demo is fully
explorable — switch down to see the gating. This is a front-end preview only — **not real
authentication, billing, or security** (that needs a backend + auth provider).

## Environment

Create `.env.local` (gitignored):

```
GEMINI_API_KEY=your_google_ai_studio_key
# optional, defaults to gemini-2.5-flash
GEMINI_MODEL=gemini-2.5-flash-lite
```

> **Free-tier quota:** Google AI Studio free keys have per-minute and per-day limits.
> The dashboard calls Gemini periodically (cached ~2 min) and each chat message is one
> call, so heavy use can hit `429 quota exceeded`. The app degrades gracefully (rule-based
> recommendation, "try again" chat message). `gemini-2.5-flash-lite` has higher free
> limits than `gemini-2.5-flash`; enable billing for production volume.

Without a key, the AI fields automatically fall back to the rule-based stub — the
app still runs. The AI source is shown in the UI as a "Powered by Gemini" /
"Rule-based fallback" badge. Gemini output is cached server-side (~2 min,
stale-while-revalidate) so the 10s dashboard poll never waits on the model.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. The dashboard polls `/api/market/xauusd` every 10s.
Hit that endpoint directly to see the raw `MarketSnapshot` JSON.

## Pages

- `/` — **Market Overview** (Module 1): live price, 5 hero cards, stats grid, session
  clock, Gemini recommendation + reasoning, news risk.
- `/technical` — **Multi-Timeframe Analysis** (Module 2): a matrix across M1→MN with
  Trend / EMA / RSI / MACD / ADX / ATR / Structure / Signal / Confidence per timeframe,
  plus a weighted **Overall Bias**. All indicators computed from real Yahoo candles
  (`lib/indicators.ts`, `lib/timeframes.ts`). H4 is aggregated from 60m candles
  (Yahoo has no native 4h). Per-timeframe candles are cached server-side (1 min intraday,
  2 min hourly, 1 hour daily+).
- `/indicators` — **Technical Intelligence** (Module 3): single-timeframe deep dive
  (M15→W1 selectable) with the full indicator suite (EMA 20/50/100/200, SMA, MACD, ADX,
  SuperTrend, PSAR, Ichimoku, VWAP, RSI, Stochastic, CCI, Momentum, ROC, Bollinger, ATR,
  Keltner, Pivot, Donchian, Fibonacci). Produces a 0–100 **Technical Score** plus
  Trend / Momentum / Volatility sub-scores, **Reversal Risk** and **Breakout Probability**
  (transparent heuristics), and a per-indicator bull/bear/neutral read
  (`lib/technical.ts`).
- `/chat` — **AI Copilot** (Module 16): a chat grounded in the live market snapshot +
  multi-timeframe data. The route (`app/api/ai/chat/route.ts`) fetches the platform's own
  `/api/market/xauusd` and `/api/technical/mtf` endpoints, builds a context block, and
  sends it to Gemini as a system instruction (`chatWithContext` in `lib/gemini.ts`). The
  model answers in the user's language, separates fact from opinion, always flags risk,
  and never promises profit. Falls back gracefully if the AI is unavailable.
- `/portfolio` — **Portfolio & EA Monitor** (Modules 13 & 14): **simulated** account
  (no live MT5 link) — balance/equity/floating/drawdown/margin, today/week/month P/L, an
  equity curve, open positions, per-EA stats (win rate, profit factor, recovery, grid), net
  exposure, and a **Portfolio Health Score** (`lib/portfolio.ts`). Account structure is
  seeded per day; open XAUUSD positions' floating P/L tracks the **real** gold price.
  Clearly labelled as a demo account in the UI.
- `/alerts` — **Alert Center** (Module 18): create alerts on price above/below, market score
  above/below, AI-recommendation change, or high-impact news within 30 min. The page polls
  the live feed every 15s, evaluates each alert (`lib/alerts.ts`), fires a **browser
  notification**, and logs a triggered timeline. Alerts + history persist in `localStorage`;
  triggered alerts can be re-armed or deleted. (Telegram/Discord/LINE/email channels are
  future work.) No AI / backend.
- `/plan` — **Trading Plan Generator** (Module 11): composes a concrete plan from the AI
  recommendation + S/R levels + ATR — direction, entry zone, stop loss, TP1/2/3 (from real
  resistances/supports), risk:reward, invalidation, rationale, and an alternative scenario;
  plus interactive position sizing (balance × risk% → lot size and per-TP reward via
  `lib/risk.ts`). Emits a "No Trade" plan when the bias is wait/no-trade/high-news-risk
  (`lib/plan.ts`). No AI / Gemini quota used.
- `/whatif` — **What-if Scenarios** (Module 15): simulates gold's reaction to 9 events
  (CPI hot/cool, Fed hawkish/dovish, DXY +1%, US10Y spike, geopolitical risk, breakout,
  breakdown) as ATR-scaled moves, then shows the target price, **your P/L** for a chosen
  position, a drawdown-risk label, and per-scenario suggested action + alternative plan
  (`lib/scenarios.ts`). Heuristic, not a prediction. No AI.
- `/risk` — **Risk Management Assistant** (Module 12): XAUUSD position-size calculator
  (1 lot = 100 oz, $1 move = $100/lot). Computes lot size from balance × risk%, SL distance,
  required margin, RR-based take-profits, a trade risk label (escalated by margin use and
  imminent news), **portfolio heat**, and a **volatility (ATR) adjustment** that warns when
  the stop is tighter than one ATR. Prefills entry/SL/ATR/news from the live market feed
  (`lib/risk.ts`). Pure client-side math — no AI.
- `/correlation` — **Intermarket Correlation** (Module 7): correlates gold's daily returns
  with DXY, US 10Y/2Y yields, silver, oil, Bitcoin, Nasdaq, S&P 500, VIX, USD/JPY, EUR/USD
  (date-aligned Pearson over ~40 days). Classifies each as supportive or pressure for gold
  from `correlation × recent move`, produces a 0–100 **Gold Support Score**, and flags
  **divergences** where a strong driver opposes gold's current move (`lib/correlation.ts`).
  No AI / Gemini quota used.
- `/smc` — **Smart Money Concept** (Module 4): market structure (BOS / CHoCH) from fractal
  swings, order blocks (last opposite candle before the impulse, with mitigation status),
  fair value gaps (3-candle imbalance, filled status), liquidity pools from equal highs/lows
  with sweep+reversal detection, and premium/discount of the current dealing range. Outputs
  an SMC bias, key order block, liquidity target, invalidation, and possible sweep zone
  (`lib/smc.ts`). Timeframe selectable (M15→W1). No AI / Gemini quota used.
- `/levels` — **Support & Resistance** (Module 5): multi-source confluence levels
  (pivots, daily/weekly/monthly H-L, Fibonacci, EMA dynamic, Donchian, swings/order-block
  proxies, volume POC). Candidates are clustered into zones, ranked by confluence strength,
  and split into R1–R3 / S1–S3 around the live price, with the highest-confluence **key
  level** highlighted and explained (`lib/levels.ts`). No AI / Gemini quota used.

## Structure

- `app/api/market/xauusd/route.ts` — server proxy + analytics → one typed payload
- `app/api/technical/mtf/route.ts` — multi-timeframe indicators → `MultiTimeframe` payload
- `app/api/technical/score/route.ts?tf=H1` — full indicator suite + scores → `TechnicalScore` payload
- `app/api/ai/chat/route.ts` — POST `{messages}` → Gemini reply grounded in live data
- `app/api/technical/levels/route.ts` — multi-source S/R confluence → `SupportResistance` payload
- `app/api/technical/smc/route.ts?tf=H1` — structure/OB/FVG/liquidity → `SmcAnalysis` payload
- `app/api/correlation/route.ts` — intermarket correlations → `IntermarketCorrelation` payload
- `app/api/plan/route.ts` — composed trading plan → `TradePlan` payload
- `app/api/portfolio/route.ts` — simulated account/EA snapshot → `PortfolioSnapshot` payload
- `lib/types.ts` — `MarketSnapshot` contract
- `lib/marketLogic.ts` — pure derivations + stubbed recommendation
- `lib/mockNews.ts` — mock economic calendar + news-risk logic
- `lib/i18n.ts` — TH/EN dictionary + `LanguageProvider`
- `components/` — hero cards, stats grid, session clock, reasoning panel, disclaimer

## Notes

- Price uses COMEX `GC=F` futures, typically within a few dollars of XAUUSD spot.
- All recommendations include risk level, opposite risk, invalidation, and a risk
  disclaimer (PRD §12/§13). No guaranteed-profit phrasing is used.
- WebSocket real-time feed, a real economic-calendar API, and an LLM-backed AI
  Committee are intentionally out of scope for this build.
