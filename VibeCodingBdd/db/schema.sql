create table if not exists punishments (
  id bigint primary key,
  type smallint not null check (type in (1, 2)),
  steamid text not null,
  name text not null,
  admin text not null,
  admin_steamid text not null,
  admin_avatar text,
  avatar text,
  reason text not null,
  status integer not null,
  duration integer not null,
  created bigint not null,
  expires bigint not null,
  unban_price integer,
  raw_json jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_punishments_type_created
  on punishments(type, created desc);
create index if not exists idx_punishments_steamid
  on punishments(steamid);
create index if not exists idx_punishments_admin_steamid
  on punishments(admin_steamid);

create table if not exists sync_jobs (
  job_id text primary key,
  type smallint not null check (type in (1, 2)),
  page integer not null,
  shard smallint not null,
  status text not null check (status in ('queued', 'running', 'done', 'failed')),
  attempts integer not null default 0,
  locked_by text,
  lock_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_jobs_lookup
  on sync_jobs(type, status, updated_at desc);
create index if not exists idx_sync_jobs_shard_status
  on sync_jobs(shard, status);

create table if not exists sync_state (
  type smallint primary key check (type in (1, 2)),
  last_seen_created bigint not null default 0,
  next_page_hint integer not null default 1,
  cooldown_until timestamptz,
  target_rps numeric(6, 2) not null default 4.0,
  active_workers integer not null default 20,
  pages_per_tick integer not null default 8,
  updated_at timestamptz not null default now()
);

create table if not exists sync_metrics (
  id bigserial primary key,
  metric text not null,
  value numeric not null,
  tags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_metrics_metric_created
  on sync_metrics(metric, created_at desc);
