-- Admin tools for the leaderboard.
-- Ratings before a rated game and the change it caused, so an admin who voids
-- or corrects the result can give the points back exactly.
ALTER TABLE games ADD COLUMN r0 INTEGER;
ALTER TABLE games ADD COLUMN r1 INTEGER;
ALTER TABLE games ADD COLUMN d0 INTEGER;
ALTER TABLE games ADD COLUMN d1 INTEGER;
-- Kept off every leaderboard without being banned (e.g. while a cheating report is checked).
ALTER TABLE users ADD COLUMN board_hidden INTEGER NOT NULL DEFAULT 0;
