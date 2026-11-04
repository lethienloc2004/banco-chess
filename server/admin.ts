/** Admin API: statistics, games, reports, users, announcements, audit log. */
import { cleanName, type LobbyStats } from '../src/shared/protocol';
import { audit, currentAnnouncement, getUser, publicUser, type UserRow } from './db';
import type { Env } from './env';
import { fail, json } from './http';

type ReadJson = <T>(req: Request) => Promise<T | null>;

const DAY = 86400_000;

function lobby(env: Env) {
  return env.LOBBY.get(env.LOBBY.idFromName('main'));
}

function room(env: Env, id: string) {
  return env.ROOMS.get(env.ROOMS.idFromName(id));
}

/** Game ids are "<room>-<n>"; room ids never contain "-". */
function splitGameId(id: string): { room: string; gameNo: number } | null {
  const m = id.match(/^([\w]+)-(\d+)$/);
  return m ? { room: m[1], gameNo: Number(m[2]) } : null;
}

export async function adminRoute(req: Request, env: Env, admin: UserRow, path: string, readJson: ReadJson): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  const db = env.DB;
  const now = Date.now();

  // ----- Overview -----
  if (path === '/stats' && method === 'GET') {
    const since = now - DAY;
    const [users, newUsers, live, today, openReports, byKind, week, banned] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>(),
      db.prepare('SELECT COUNT(*) AS n FROM users WHERE created > ?').bind(since).first<{ n: number }>(),
      db.prepare("SELECT COUNT(*) AS n FROM games WHERE status = 'playing'").first<{ n: number }>(),
      db.prepare('SELECT COUNT(*) AS n FROM games WHERE created > ?').bind(since).first<{ n: number }>(),
      db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").first<{ n: number }>(),
      db.prepare('SELECT kind, COUNT(*) AS n FROM games WHERE created > ? GROUP BY kind').bind(since).all<{ kind: string; n: number }>(),
      db.prepare('SELECT CAST((created - ?) / ? AS INTEGER) AS d, COUNT(*) AS n FROM games WHERE created > ? GROUP BY d')
        .bind(now - 7 * DAY, DAY, now - 7 * DAY).all<{ d: number; n: number }>(),
      db.prepare('SELECT COUNT(*) AS n FROM users WHERE banned_until > ?').bind(now).first<{ n: number }>(),
    ]);
    const lobbyStats = (await (await lobby(env).fetch('https://lobby/stats')).json()) as LobbyStats;
    const perDay = Array.from({ length: 7 }, (_, d) => week.results.find(r => r.d === d)?.n ?? 0);
    return json({
      online: lobbyStats.online, queued: lobbyStats.queued, users: users?.n ?? 0, newUsers: newUsers?.n ?? 0,
      liveGames: live?.n ?? 0, gamesToday: today?.n ?? 0, openReports: openReports?.n ?? 0, banned: banned?.n ?? 0,
      byKind: Object.fromEntries(byKind.results.map(r => [r.kind, r.n])), perDay,
    });
  }

  // ----- Games -----
  if (path === '/games' && method === 'GET') {
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q')?.trim();
    const where: string[] = [];
    const args: unknown[] = [];
    if (status === 'playing' || status === 'over') { where.push('status = ?'); args.push(status); }
    if (q) { where.push('(p0_name LIKE ? OR p1_name LIKE ? OR p0_id = ? OR p1_id = ? OR id LIKE ?)'); args.push(`%${q}%`, `%${q}%`, q, q, `${q}%`); }
    const rows = await db.prepare(
      `SELECT id, room, kind, rated, p0_id, p0_name, p1_id, p1_name, status, winner, reason, created, ended,
        json_array_length(moves) AS plies FROM games ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created DESC LIMIT 100`,
    ).bind(...args).all();
    return json({ games: rows.results });
  }

  const gameMatch = path.match(/^\/games\/([\w-]+)$/);
  if (gameMatch && method === 'GET') {
    const g = await db.prepare('SELECT * FROM games WHERE id = ?').bind(gameMatch[1]).first<Record<string, unknown>>();
    if (!g) return fail(404, 'not-found');
    let moves = JSON.parse(String(g.moves));
    if (g.status === 'playing') {
      // Live game: the room has the latest moves.
      const info = await room(env, String(g.room)).fetch('https://room/info');
      if (info.ok) {
        const s = (await info.json()) as { gameNo: number; moves: unknown[]; online: boolean[] };
        if (`${g.room}-${s.gameNo}` === g.id) { moves = s.moves; g.online = s.online; }
      }
    }
    return json({ game: { ...g, initial: JSON.parse(String(g.initial)), moves } });
  }

  const gameAction = path.match(/^\/games\/([\w-]+)\/action$/);
  if (gameAction && method === 'POST') {
    const body = await readJson<{ action: 'cancel' | 'result'; winner?: 0 | 1 | null }>(req);
    const g = await db.prepare('SELECT * FROM games WHERE id = ?').bind(gameAction[1]).first<{ id: string; room: string; status: string }>();
    if (!g || !body) return fail(404, 'not-found');
    const ids = splitGameId(g.id);
    if (g.status === 'playing' && ids) {
      const res = await room(env, ids.room).fetch('https://room/admin', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) return fail(409, 'not-playing');
    } else {
      // Finished game: correct the record (ratings are not recomputed).
      const winner = body.action === 'cancel' ? null : body.winner ?? null;
      const reason = body.action === 'cancel' ? 'cancelled' : 'admin';
      await db.prepare('UPDATE games SET winner = ?, reason = ?, rated = 0 WHERE id = ?').bind(winner, reason, g.id).run();
    }
    await audit(db, admin, 'game.' + body.action, g.id, body);
    return json({ ok: true });
  }

  // ----- Reports -----
  if (path === '/reports' && method === 'GET') {
    const status = url.searchParams.get('status') ?? 'open';
    const rows = await db.prepare(
      `SELECT r.*, a.name AS reporter_name, t.name AS target_name, t.banned_until AS target_banned_until, t.warnings AS target_warnings
       FROM reports r LEFT JOIN users a ON a.id = r.reporter_id LEFT JOIN users t ON t.id = r.target_id
       WHERE r.status = ? ORDER BY r.created DESC LIMIT 100`,
    ).bind(status).all();
    return json({ reports: rows.results });
  }

  const reportAction = path.match(/^\/reports\/(\d+)$/);
  if (reportAction && method === 'POST') {
    const body = await readJson<{ status: 'resolved' | 'dismissed'; resolution?: string }>(req);
    if (!body || (body.status !== 'resolved' && body.status !== 'dismissed')) return fail(400, 'bad-request');
    await db.prepare('UPDATE reports SET status = ?, resolution = ?, resolved_by = ?, resolved = ? WHERE id = ?')
      .bind(body.status, String(body.resolution ?? '').slice(0, 500), admin.id, now, Number(reportAction[1])).run();
    await audit(db, admin, 'report.' + body.status, reportAction[1], body);
    return json({ ok: true });
  }

  // ----- Users -----
  if (path === '/users' && method === 'GET') {
    const q = url.searchParams.get('q')?.trim();
    const filter = url.searchParams.get('filter');
    const where: string[] = [];
    const args: unknown[] = [];
    if (q) { where.push('(name LIKE ? OR email LIKE ? OR id = ?)'); args.push(`%${q}%`, `%${q}%`, q); }
    if (filter === 'banned') { where.push('banned_until > ?'); args.push(now); }
    if (filter === 'admins') where.push("role = 'admin'");
    const rows = await db.prepare(
      `SELECT * FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY last_seen DESC LIMIT 100`,
    ).bind(...args).all<UserRow>();
    return json({ users: rows.results });
  }

  const userMatch = path.match(/^\/users\/([\w-]+)$/);
  if (userMatch && method === 'GET') {
    const u = await getUser(db, userMatch[1]);
    if (!u) return fail(404, 'not-found');
    const [games, reports] = await Promise.all([
      db.prepare('SELECT id, kind, rated, p0_id, p0_name, p1_id, p1_name, status, winner, reason, created FROM games WHERE p0_id = ? OR p1_id = ? ORDER BY created DESC LIMIT 50')
        .bind(u.id, u.id).all(),
      db.prepare('SELECT * FROM reports WHERE target_id = ? ORDER BY created DESC LIMIT 50').bind(u.id).all(),
    ]);
    return json({ user: u, games: games.results, reports: reports.results });
  }

  const userAction = path.match(/^\/users\/([\w-]+)\/action$/);
  if (userAction && method === 'POST') {
    const body = await readJson<{ action: string; days?: number | null; reason?: string; name?: string; role?: string; rating?: number }>(req);
    const u = await getUser(db, userAction[1]);
    if (!u || !body) return fail(404, 'not-found');
    const reason = String(body.reason ?? '').slice(0, 300);
    switch (body.action) {
      case 'ban': {
        if (u.id === admin.id) return fail(400, 'self');
        const until = body.days ? now + body.days * DAY : 8.64e15; // no days = permanent
        await db.prepare('UPDATE users SET banned_until = ?, ban_reason = ? WHERE id = ?').bind(until, reason, u.id).run();
        await lobby(env).fetch('https://lobby/kick', { method: 'POST', body: JSON.stringify({ uid: u.id }) });
        break;
      }
      case 'unban':
        await db.prepare('UPDATE users SET banned_until = NULL, ban_reason = NULL WHERE id = ?').bind(u.id).run();
        break;
      case 'warn':
        await db.prepare('UPDATE users SET warnings = warnings + 1, notice = ? WHERE id = ?').bind(reason || 'Cảnh cáo từ quản trị viên.', u.id).run();
        break;
      case 'rename': {
        const name = cleanName(body.name ?? '');
        if (!name) return fail(400, 'bad-name');
        await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, u.id).run();
        break;
      }
      case 'role':
        if (body.role !== 'admin' && body.role !== 'user') return fail(400, 'bad-role');
        if (u.id === admin.id && body.role !== 'admin') return fail(400, 'self');
        await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(body.role, u.id).run();
        break;
      case 'rating': {
        const rating = Math.round(Number(body.rating ?? 1200));
        if (!Number.isFinite(rating) || rating < 100 || rating > 3500) return fail(400, 'bad-rating');
        await db.prepare('UPDATE users SET rating = ? WHERE id = ?').bind(rating, u.id).run();
        break;
      }
      case 'delete':
        if (u.id === admin.id) return fail(400, 'self');
        await lobby(env).fetch('https://lobby/kick', { method: 'POST', body: JSON.stringify({ uid: u.id }) });
        await db.prepare('DELETE FROM users WHERE id = ?').bind(u.id).run();
        break;
      default:
        return fail(400, 'bad-action');
    }
    await audit(db, admin, 'user.' + body.action, u.id, body);
    const after = await getUser(db, u.id);
    return json({ user: after ? publicUser(after) : null });
  }

  // ----- Announcements -----
  if (path === '/announcements' && method === 'GET') {
    const rows = await db.prepare('SELECT * FROM announcements ORDER BY id DESC LIMIT 50').all();
    return json({ announcements: rows.results });
  }
  if (path === '/announcements' && method === 'POST') {
    const body = await readJson<{ text: string; level?: string; hours?: number | null }>(req);
    const text = String(body?.text ?? '').trim().slice(0, 300);
    if (!text) return fail(400, 'bad-text');
    const level = body?.level === 'warn' ? 'warn' : 'info';
    const expires = body?.hours ? now + body.hours * 3600_000 : null;
    const res = await db.prepare('INSERT INTO announcements (text, level, created, expires, created_by) VALUES (?, ?, ?, ?, ?) RETURNING id')
      .bind(text, level, now, expires, admin.id).first<{ id: number }>();
    const announcement = { id: res!.id, text, level: level as 'info' | 'warn', created: now, expires };
    await lobby(env).fetch('https://lobby/broadcast', { method: 'POST', body: JSON.stringify({ announcement }) });
    await audit(db, admin, 'announcement.create', String(res!.id), { text, level, expires });
    return json({ announcement });
  }
  const annMatch = path.match(/^\/announcements\/(\d+)$/);
  if (annMatch && method === 'DELETE') {
    await db.prepare('UPDATE announcements SET active = 0 WHERE id = ?').bind(Number(annMatch[1])).run();
    await lobby(env).fetch('https://lobby/broadcast', { method: 'POST', body: JSON.stringify({ announcement: await currentAnnouncement(db) }) });
    await audit(db, admin, 'announcement.delete', annMatch[1]);
    return json({ ok: true });
  }

  // ----- Audit log -----
  if (path === '/audit' && method === 'GET') {
    const rows = await db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all();
    return json({ audit: rows.results });
  }

  return fail(404, 'not-found');
}
