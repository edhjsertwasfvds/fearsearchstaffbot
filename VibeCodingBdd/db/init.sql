CREATE TABLE IF NOT EXISTS admins (
  admin_id BIGINT PRIMARY KEY,
  steamid TEXT NOT NULL UNIQUE,
  group_id INTEGER,
  group_display_name TEXT,
  group_name TEXT,
  immunity INTEGER,
  is_frozen BOOLEAN DEFAULT FALSE,
  avatar_full TEXT,
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  steamid TEXT PRIMARY KEY,
  name TEXT,
  last_activity TIMESTAMPTZ,
  avatar_full TEXT,
  discord_nickname TEXT,
  discord_id TEXT,
  rank INTEGER,
  kills INTEGER,
  deaths INTEGER,
  playtime INTEGER,
  ban_is_banned BOOLEAN,
  vip_is_vip BOOLEAN,
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  admins_total INTEGER NOT NULL DEFAULT 0,
  profiles_ok INTEGER NOT NULL DEFAULT 0,
  profiles_failed INTEGER NOT NULL DEFAULT 0,
  error_text TEXT
);
