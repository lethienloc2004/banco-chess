/** D1 queries. */
import type { GameKind } from '../src/engine/types';
import { DEFAULT_RATING, LEADERBOARD_MIN_GAMES, type Announcement, type Player, type PublicUser, type Ratings, type Role } from '../src/shared/protocol';

export const KINDS: GameKind[] = ['chess', 'xiangqi', 'jieqi', 'hiddenchess'];

export interface UserRow {
  id: string;
  name: string;
  google_sub: string | null;
  email: string | null;
  role: Role;
  /** Legacy single rating, kept only for the migration to per-game ratings. */
  rating: number;
  games: number;
  wins: number;
  warnings: number;
  notice: string | null;
  banned_until: number | null;
  ban_reason: string | null;
  created: number;
  last_seen: number;
}

export interface RatingRow {
  user_id: string;
  kind: GameKind;
  rating: number;
  games: number;
  wins: number;
  draws: number;
  peak: number;
  updated: number;
}

export function defaultRatings(): Ratings {
  return { chess: DEFAULT_RATING, xiangqi: DEFAULT_RATING, jieqi: DEFAULT_RATING, hiddenchess: DEFAULT_RATING };
}

/** Rating of a user in every game (1200 where they have not played rated yet). */
export async function ratingsOf(db: D1Database, uid: string): Promise<Ratings> {
  const out = defaultRatings();
  const rows = await db.prepare('SELECT kind, rating FROM ratings WHERE user_id = ?').bind(uid).all<{ kind: GameKind; rating: number }>();
  for (const r of rows.results) if (r.kind in out) out[r.kind] = r.rating;
  return out;
}

/** Current rating of each of these users in one game. */
export async function ratingsIn(db: D1Database, kind: GameKind, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>(ids.map(id => [id, DEFAULT_RATING]));
  if (!ids.length) return map;
  const rows = await db.prepare(`SELECT user_id, rating FROM ratings WHERE kind = ? AND user_id IN (${ids.map(() => '?').join(', ')})`)
    .bind(kind, ...ids).all<{ user_id: string; rating: number }>();
  for (const r of rows.results) map.set(r.user_id, r.rating);
  return map;
}

/** Record a finished rated game for one player. */
export function recordRated(db: D1Database, uid: string, kind: GameKind, rating: number, score: 0 | 0.5 | 1, now = Date.now()): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO ratings (user_id, kind, rating, games, wins, draws, peak, updated) VALUES (?, ?, ?, 1, ?, ?, ?, ?)
     ON CONFLICT (user_id, kind) DO UPDATE SET rating = excluded.rating, games = games + 1, wins = wins + excluded.wins,
       draws = draws + excluded.draws, peak = MAX(peak, excluded.rating), updated = excluded.updated`,
  ).bind(uid, kind, rating, score === 1 ? 1 : 0, score === 0.5 ? 1 : 0, Math.max(rating, DEFAULT_RATING), now);
}

/** Set a rating by hand (admin); the game count is kept. */
export function setRating(db: D1Database, uid: string, kind: GameKind, rating: number, now = Date.now()): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO ratings (user_id, kind, rating, peak, updated) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, kind) DO UPDATE SET rating = excluded.rating, peak = MAX(peak, excluded.rating), updated = excluded.updated`,
  ).bind(uid, kind, rating, Math.max(rating, DEFAULT_RATING), now);
}

/** SQL condition for "shown on the leaderboard" (table aliases r = ratings, u = users). */
export const RANKED = `r.games >= ${LEADERBOARD_MIN_GAMES} AND (u.banned_until IS NULL OR u.banned_until <= ?)`;

/** Leaderboard position for a rating: one more than the number of ranked players above it. */
export async function rankOf(db: D1Database, kind: GameKind, rating: number, now = Date.now()): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ratings r JOIN users u ON u.id = r.user_id WHERE r.kind = ? AND ${RANKED} AND r.rating > ?`)
    .bind(kind, now, rating).first<{ n: number }>();
  return (row?.n ?? 0) + 1;
}

export async function playerOf(db: D1Database, u: UserRow): Promise<Player> {
  return { id: u.id, name: u.name, ratings: await ratingsOf(db, u.id) };
}

export function publicUser(u: UserRow, ratings: Ratings, self = false): PublicUser {
  return {
    id: u.id, name: u.name, ratings, games: u.games, wins: u.wins, role: u.role,
    google: !!u.google_sub, email: self ? u.email : undefined, notice: self ? u.notice : undefined,
  };
}

export function isBanned(u: Pick<UserRow, 'banned_until'>, now = Date.now()): boolean {
  return u.banned_until !== null && u.banned_until > now;
}

export async function getUser(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export async function createUser(db: D1Database, id: string, name: string, extra: Partial<UserRow> = {}): Promise<UserRow> {
  const now = Date.now();
  await db.prepare(
    'INSERT INTO users (id, name, google_sub, email, role, created, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, name, extra.google_sub ?? null, extra.email ?? null, extra.role ?? 'user', now, now).run();
  return (await getUser(db, id))!;
}

export async function touchUser(db: D1Database, id: string) {
  await db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(Date.now(), id).run();
}

export async function currentAnnouncement(db: D1Database): Promise<Announcement | null> {
  const now = Date.now();
  return db.prepare(
    'SELECT id, text, level, created, expires FROM announcements WHERE active = 1 AND (expires IS NULL OR expires > ?) ORDER BY id DESC LIMIT 1',
  ).bind(now).first<Announcement>();
}

export async function audit(db: D1Database, admin: UserRow, action: string, target: string, detail: unknown = null) {
  await db.prepare('INSERT INTO audit (admin_id, admin_name, action, target, detail, created) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(admin.id, admin.name, action, target, detail === null ? null : JSON.stringify(detail), Date.now()).run();
}
