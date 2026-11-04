/** D1 queries. */
import type { Announcement, PublicUser, Role } from '../src/shared/protocol';

export interface UserRow {
  id: string;
  name: string;
  google_sub: string | null;
  email: string | null;
  role: Role;
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

export function publicUser(u: UserRow, self = false): PublicUser {
  return {
    id: u.id, name: u.name, rating: u.rating, games: u.games, wins: u.wins, role: u.role,
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
