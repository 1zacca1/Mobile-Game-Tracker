// Snapshot-per-day schema. Every collector writes one row per (game, date, …)
// dimension; re-running a day upserts rather than duplicating. Nothing is ever
// interpolated at write time — a missing day stays missing.
export const SCHEMA_SQL = [
  `create table if not exists games (
    id serial primary key,
    name text not null,
    company text not null,
    appstore_id text,
    play_id text,
    meta_search text,
    markets text[] not null default '{us,kr,tw,th,ph,id,jp}',
    active boolean not null default true,
    created_at timestamptz not null default now()
  )`,
  // Store chart positions. source records which real endpoint produced the row.
  `create table if not exists rank_snapshots (
    id bigserial primary key,
    game_id int not null references games(id) on delete cascade,
    date date not null,
    store text not null check (store in ('ios','android')),
    country text not null,
    chart text not null check (chart in ('free','grossing')),
    rank int not null,
    source text not null,
    created_at timestamptz not null default now(),
    unique (game_id, date, store, country, chart)
  )`,
  // App-level metadata snapshots: review counts (velocity = day-over-day delta),
  // ratings, Android install brackets.
  `create table if not exists app_snapshots (
    id bigserial primary key,
    game_id int not null references games(id) on delete cascade,
    date date not null,
    store text not null check (store in ('ios','android')),
    country text not null,
    review_count bigint,
    rating numeric,
    installs_text text,
    source text not null,
    created_at timestamptz not null default now(),
    unique (game_id, date, store, country)
  )`,
  // Meta Ad Library active-creative counts. PROXY data, not spend.
  `create table if not exists ad_snapshots (
    id bigserial primary key,
    game_id int not null references games(id) on delete cascade,
    date date not null,
    active_ads int not null,
    region text not null default 'EU',
    source text not null default 'meta_ad_library',
    created_at timestamptz not null default now(),
    unique (game_id, date, region)
  )`,
  // Calibration anchor points for the rank->revenue power law, entered in admin.
  `create table if not exists anchors (
    id serial primary key,
    store text not null check (store in ('ios','android')),
    country text not null,
    anchor_date date not null,
    rank int not null,
    daily_revenue_usd numeric not null,
    note text,
    created_at timestamptz not null default now()
  )`,
  // Manually imported third-party estimates (CSV upload in admin).
  `create table if not exists estimates_import (
    id bigserial primary key,
    game_id int references games(id) on delete cascade,
    date date not null,
    metric text not null,
    value numeric not null,
    country text not null default 'ww',
    source text not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists collection_log (
    id bigserial primary key,
    run_at timestamptz not null default now(),
    job text not null,
    status text not null,
    detail text,
    duration_ms int
  )`,
  `create index if not exists rank_snapshots_game_date on rank_snapshots (game_id, date)`,
  `create index if not exists app_snapshots_game_date on app_snapshots (game_id, date)`,
];
