-- A separate Elo rating (and leaderboard) for each game.
CREATE TABLE IF NOT EXISTS ratings (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,           -- chess | xiangqi | jieqi | hiddenchess
  rating INTEGER NOT NULL DEFAULT 1200,
  games INTEGER NOT NULL DEFAULT 0,   -- rated games of this kind
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  peak INTEGER NOT NULL DEFAULT 1200,
  updated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind)
);
CREATE INDEX IF NOT EXISTS ratings_board ON ratings(kind, games, rating);

-- Nobody loses their rating: the old single rating is copied to every game,
-- and game counts come from the rated game history of that game.
INSERT OR IGNORE INTO ratings (user_id, kind, rating, games, wins, draws, peak, updated)
SELECT u.id, k.kind, u.rating,
  (SELECT COUNT(*) FROM games g WHERE g.rated = 1 AND g.status = 'over' AND g.kind = k.kind AND (g.p0_id = u.id OR g.p1_id = u.id)),
  (SELECT COUNT(*) FROM games g WHERE g.rated = 1 AND g.status = 'over' AND g.kind = k.kind
     AND ((g.p0_id = u.id AND g.winner = 0) OR (g.p1_id = u.id AND g.winner = 1))),
  (SELECT COUNT(*) FROM games g WHERE g.rated = 1 AND g.status = 'over' AND g.kind = k.kind AND g.winner IS NULL
     AND (g.p0_id = u.id OR g.p1_id = u.id)),
  MAX(u.rating, 1200), u.last_seen
FROM users u
CROSS JOIN (SELECT 'chess' AS kind UNION ALL SELECT 'xiangqi' UNION ALL SELECT 'jieqi' UNION ALL SELECT 'hiddenchess') k
WHERE u.rating <> 1200
   OR EXISTS (SELECT 1 FROM games g WHERE g.rated = 1 AND g.kind = k.kind AND (g.p0_id = u.id OR g.p1_id = u.id));
