-- Email sign-in with one-time codes, and "members only" online play.
-- A member is a player with a verified email (email code or Google).
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
UPDATE users SET email_verified = 1 WHERE google_sub IS NOT NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_email ON users(email);

-- Pending sign-in codes: only a keyed hash of the code is stored.
CREATE TABLE IF NOT EXISTS otp_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL
);

-- Fixed-window counters for rate limits (per email, per IP address).
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
