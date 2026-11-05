-- Admin control of the holiday events: follow the calendar, force on or off,
-- and optionally sell the holiday skin in the shop all year round.
CREATE TABLE IF NOT EXISTS season_settings (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'auto',
  since TEXT,
  shop INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL,
  updated_by TEXT
);
