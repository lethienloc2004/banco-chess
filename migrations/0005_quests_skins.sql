-- Quests, coins and piece skins.
ALTER TABLE users ADD COLUMN coins INTEGER NOT NULL DEFAULT 0;
-- Equipped skin (NULL = the default pieces); other players see it in online games.
ALTER TABLE users ADD COLUMN skin TEXT;
-- Days in a row with at least one daily quest claimed.
ALTER TABLE users ADD COLUMN streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN streak_day TEXT;

-- period: 'd:YYYY-MM-DD' (daily), 'w:YYYY-Www' (weekly), 'a' (achievement), 's:<season>:<start>' (holiday)
CREATE TABLE IF NOT EXISTS quest_progress (
  user_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  period TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, quest_id, period)
);

CREATE TABLE IF NOT EXISTS user_skins (
  user_id TEXT NOT NULL,
  skin_id TEXT NOT NULL,
  acquired INTEGER NOT NULL,
  PRIMARY KEY (user_id, skin_id)
);

-- Reported events already counted (a bot game, a puzzle on a given day…), so replays do not count twice.
CREATE TABLE IF NOT EXISTS quest_events (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
