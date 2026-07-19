# Mobile Game Tracker

Daily tracking dashboard for mobile-game performance, built as an equity-research
read-through for **Entravision (EVC)** — Century Games (Whiteout Survival, Kingshot,
Frozen City) is a major Smadex DSP customer, so their UA activity proxies Smadex
revenue — and **Gravity (GRVY)**, whose earnings hinge on the Ragnarok mobile
portfolio across US/KR/TW/TH/PH/ID/JP.

Next.js (App Router) + TypeScript + Tailwind + Recharts, Postgres (Neon / Vercel
Postgres), deployed on Vercel with a daily cron. Snapshot-per-day schema: the app
builds its own historical dataset from day one.

## What the numbers are (and aren't)

| Series | Nature | Source |
|---|---|---|
| Free / grossing chart ranks | **Real** | App Store charts endpoint (games top-200; Apple's RSS no longer carries grossing) · Google Play top-200 games via `google-play-scraper` |
| Review counts / ratings | **Real** (cumulative) | iTunes lookup API · Google Play app pages |
| Review velocity (Δ reviews/day) | **Proxy for downloads** | derived day-over-day from the above |
| Install brackets (Android) | **Real but coarse** ("100,000,000+") | Google Play |
| Active Meta ad creatives | **Proxy for UA spend** — a count, not dollars; EU-visible ads only | Meta Ad Library API |
| Chart-presence breadth | **Proxy** (countries with any top-chart rank) | derived |
| Estimated daily revenue band | **Modeled** — power law calibrated on your anchors; labeled MODELED everywhere | derived |
| Imported third-party estimates | Whatever you import; shown with source | CSV upload |

Hard rule enforced in the collectors: **a failed fetch writes nothing.** Failures
land in `collection_log`; a missing day stays missing. No placeholder or
interpolated values are ever stored.

## Deploy (one time, ~10 minutes)

1. **Create the Vercel project.** vercel.com → *Add New → Project* → import the
   `Mobile-Game-Tracker` GitHub repo. Framework auto-detects as Next.js. Deploy
   (the first deploy works before the DB exists; pages show a setup hint).
2. **Add Postgres.** Project → *Storage* → create a **Neon** (Vercel Postgres)
   database. This injects `DATABASE_URL` automatically. (Any external Neon free-tier
   DB works too — paste its **pooled** connection string as `DATABASE_URL`.)
3. **Set env vars** (Project → Settings → Environment Variables):
   - `CRON_SECRET` — `openssl rand -hex 32`. Vercel Cron automatically sends it as
     `Authorization: Bearer …` to `/api/collect`, which rejects anything else.
   - `ADMIN_TOKEN` — any string; required for admin mutations once set. Enter it
     once in the Admin page (stored in your browser's localStorage).
   - `META_AD_LIBRARY_TOKEN` — optional, see below. Without it the meta job is
     skipped (and logged as skipped), everything else still runs.
4. **Redeploy** so env vars take effect.
5. **Initialize.** Open `https://<your-app>.vercel.app/admin` → *Initialize
   database* (creates tables, seeds 13 Century/Gravity titles with verified store
   IDs) → *Collect now (all)*. In 1–3 minutes the Overview fills with live ranks.
6. **Cron** is preconfigured in `vercel.json`: `/api/collect` daily at 02:20 UTC
   (after both stores have rolled their daily charts). Hobby-plan compatible
   (1 cron, 1×/day). The collect route sets `maxDuration = 300`; with Vercel's
   default Fluid compute that's within Hobby limits. Writes are incremental, so
   even a mid-run timeout keeps everything fetched up to that point.

### Meta Ad Library token setup

1. developers.facebook.com → *My Apps* → *Create App* (type: anything, e.g. "Other
   → Business"). No review needed for the Ad Library API.
2. Confirm your identity at facebook.com/ID (required once for Ad Library access).
3. Get a token: easiest is *Tools → Graph API Explorer* → select your app →
   *Generate Access Token*. For something long-lived, exchange it for a 60-day
   token (Graph API Explorer → the (i) icon → "Open in Access Token Tool" →
   Extend), or create a System User token in Business Manager (non-expiring).
4. Put it in Vercel as `META_AD_LIBRARY_TOKEN` and redeploy.

**Caveat baked into the product:** for ordinary commercial ads, Meta's Ad Library
only exposes ads that reach the **EU** (DSA transparency). The tracker queries
reach in NL/DE/FR and counts ACTIVE creatives per title. Treat it as a
creative-volume/UA-breadth signal, not spend, and not non-EU coverage. Century
Games advertises heavily in the EU, so the signal is meaningful for the EVC thesis;
titles that skip the EU will read as zero.

## Calibration workflow (rank → revenue)

The estimator is a per-(store, market) power law: `revenue(rank) = A · rank^(−B)`.

1. Find an anchor: any public "game X grossed ~$Y/day in market Z around date D"
   (Sensor Tower/AppMagic press figures, company disclosures, earnings calls).
2. Look up the game's grossing rank in that store+market around that date (its
   detail page → grossing chart, or your own memory of the chart).
3. Admin → *Revenue calibration anchors* → add store, market, date, rank, daily USD.
4. Effects are immediate — estimates are computed at read time, so recalibrating
   reprices all history. Anchors are market-level (the rank→revenue curve belongs
   to the market, not the title) and apply to every tracked game.

Behavior by anchor count, shown in the UI next to every estimate:
- **0 anchors:** no estimate at all — the band chart stays empty rather than guess.
- **1 anchor:** slope fixed at B = 0.75 (published grossing-curve fits cluster
  ~0.6–0.9); A solved from your point; band ±60%.
- **2+ anchors:** A and B fit by least squares in log-log space (B clamped to
  [0.3, 1.5]); band from residual spread, floored at ±35%.

More anchors, spread across the rank range (one top-10, one ~50, one ~150), tighten
the fit materially. Both stores' grossing ranks here are **games-chart** ranks
(iOS top-200 games via the App Store charts endpoint, Android top-200 games), so
calibrate anchors against games-chart positions.

## Pages

- **Overview** — card per game: 30-day grossing-rank sparkline (inverted, up =
  better), latest free rank, review velocity, countries charting, red/green WoW badge.
- **Game detail** (`/games/[id]`) — grossing + free rank by country, review
  velocity, modeled revenue band with methodology note, Meta creative count,
  imported estimates; iOS/Android/both toggle; CSV button on every chart plus a
  full-history CSV.
- **Compare** — overlay up to 8 games' best grossing rank; presets *All Century
  Games* / *All Gravity*; store + market filters.
- **Signals** — auto-flags: grossing rank moved >20 places WoW, new chart entries,
  ad creatives ±50% WoW, chart breadth ±2 countries. Computed from raw snapshots
  at read time (threshold changes re-flag history consistently).
- **Admin** — game CRUD with built-in store-ID search (never guess an ID), anchors,
  CSV import (`game_id,date,metric,value,country,source`), collection logs,
  manual *Collect now* (whole run or per-job).

## Operations notes

- **Serverless budget:** charts are 1 fetch per (store, country, chart) covering
  all games (≈28/day); iOS details are batched per country; Android details run at
  concurrency 4. A full run is minutes. If you ever track far more markets, hit
  the per-job endpoints (`/api/collect?job=charts|details|meta`) from separate
  crons instead of `all`.
- **Datacenter-IP flakiness:** every fetch retries 3× with backoff+jitter; per-item
  failures are isolated, logged to `collection_log` (visible in Admin), and skipped.
- **Cron auth:** `/api/collect` requires `Authorization: Bearer $CRON_SECRET`
  (or `x-cron-secret` for curl). The Admin *Collect now* uses `/api/admin/collect`
  gated by `ADMIN_TOKEN`.
- **Missed a day?** Nothing backfills chart ranks (they're ephemeral) — that's by
  design; the dataset records what was actually observed.

## Local development

```bash
npm install
cp .env.example .env   # fill DATABASE_URL at minimum
npm run db:migrate && npm run db:seed
npm run dev
```

## Schema (snapshot-per-day)

`games` (config, UI-editable) · `rank_snapshots` (game/date/store/country/chart/rank,
unique per day) · `app_snapshots` (review counts, ratings, install brackets) ·
`ad_snapshots` (active creative counts) · `anchors` (calibration points) ·
`estimates_import` (third-party figures) · `collection_log`. Estimates and signals
are never stored — always derived from snapshots at read time.
