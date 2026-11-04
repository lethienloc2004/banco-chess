-- Bàn Cờ database schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  google_sub TEXT UNIQUE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  rating INTEGER NOT NULL DEFAULT 1200,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0,
  notice TEXT,
  banned_until INTEGER,
  ban_reason TEXT,
  created INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_name ON users(name);
CREATE INDEX IF NOT EXISTS users_rating ON users(rating);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,          -- <room id>-<game number>
  room TEXT NOT NULL,
  kind TEXT NOT NULL,
  rated INTEGER NOT NULL DEFAULT 0,
  p0_id TEXT, p0_name TEXT,
  p1_id TEXT, p1_name TEXT,
  status TEXT NOT NULL,         -- playing | over
  winner INTEGER,               -- 0, 1 or NULL (draw / cancelled)
  reason TEXT,
  initial TEXT NOT NULL,        -- real start position (jieqi identities included)
  moves TEXT NOT NULL DEFAULT '[]',
  created INTEGER NOT NULL,
  ended INTEGER
);
CREATE INDEX IF NOT EXISTS games_status ON games(status, created);
CREATE INDEX IF NOT EXISTS games_p0 ON games(p0_id);
CREATE INDEX IF NOT EXISTS games_p1 ON games(p1_id);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT,
  reporter_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',   -- open | resolved | dismissed
  resolution TEXT,
  resolved_by TEXT,
  created INTEGER NOT NULL,
  resolved INTEGER
);
CREATE INDEX IF NOT EXISTS reports_status ON reports(status, created);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  active INTEGER NOT NULL DEFAULT 1,
  created INTEGER NOT NULL,
  expires INTEGER,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT NOT NULL,
  admin_name TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  created INTEGER NOT NULL
);
