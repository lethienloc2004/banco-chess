/** Admin API: statistics, games, reports, users, announcements, audit log. */
import type { GameKind } from '../src/engine/types';
import { cleanName, elo, type LobbyStats, type Ratings } from '../src/shared/protocol';
import { KINDS, audit, currentAnnouncement, defaultRatings, getUser, publicUser, ratingsIn, ratingsOf, setRating, type UserRow } from './db';
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
interface GameRecord {
  id: string; room: string; kind: GameKind; status: string; rated: number;
  p0_id: string | null; p1_id: string | null; winner: 0 | 1 | null; reason: string | null;
  r0: number | null; r1: number | null; d0: number | null; d1: number | null;
}

/** What a correction did to the two players' ratings. */
export interface Refund { d0: number; d1: number; estimated: boolean }

const scoreOf = (winner: 0 | 1 | null): 0 | 0.5 | 1 => (winner === 0 ? 1 : winner === 1 ? 0 : 0.5);

/**
 * Void a finished game or change its result. For a rated game the rating
 * change is undone (void) or recomputed from the ratings before the game
 * (new result), together with the game, win and draw counts. Games rated
 * before the change was stored get an estimate from the current ratings.
 */
async function correctFinished(db: D1Database, g: GameRecord, to: 'void' | 0 | 1 | null): Promise<Refund | null> {
  const winner = to === 'void' ? null : to;
  const reason = to === 'void' ? 'cancelled' : 'admin';
  const wasCounted = g.reason !== 'cancelled';
  if (!g.rated || !g.p0_id || !g.p1_id || !wasCounted) {
    await db.prepare('UPDATE games SET winner = ?, reason = ?, rated = 0 WHERE id = ?').bind(winner, reason, g.id).run();
    return null;
  }
  const old = scoreOf(g.winner);
  let { r0, r1, d0, d1 } = g;
  let estimated = false;
  if (r0 === null || r1 === null || d0 === null || d1 === null) {
    // Older game: assume the change was what Elo gives at today's ratings.
    const cur = await ratingsIn(db, g.kind, [g.p0_id, g.p1_id]);
    const c0 = cur.get(g.p0_id)!, c1 = cur.get(g.p1_id)!;
    const [n0, n1] = elo(c0, c1, old);
    d0 = n0 - c0; d1 = n1 - c1; r0 = c0 - d0; r1 = c1 - d1;
    estimated = true;
  }
  const wins = (sc: number) => (sc === 1 ? 1 : 0), draws = (sc: number) => (sc === 0.5 ? 1 : 0);
  let delta: [number, number], games: number, nd: [number | null, number | null], newScore: number | null;
  if (to === 'void') {
    delta = [-d0, -d1]; games = -1; nd = [null, null]; newScore = null;
  } else {
    newScore = scoreOf(to);
    const [n0, n1] = elo(r0, r1, newScore);
    nd = [n0 - r0, n1 - r1];
    delta = [nd[0]! - d0, nd[1]! - d1]; games = 0;
  }
  const side = (uid: string, i: 0 | 1, dRating: number) => {
    const o = i === 0 ? old : 1 - old, n = newScore === null ? null : i === 0 ? newScore : 1 - newScore;
    const dw = (n === null ? 0 : wins(n)) - wins(o), dd = (n === null ? 0 : draws(n)) - draws(o);
    return [
      // A rating reset since then leaves no row: nothing to give back.
      db.prepare('UPDATE ratings SET rating = rating + ?, games = MAX(0, games + ?), wins = MAX(0, wins + ?), draws = MAX(0, draws + ?) WHERE user_id = ? AND kind = ?')
        .bind(dRating, games, dw, dd, uid, g.kind),
      db.prepare('UPDATE users SET games = MAX(0, games + ?), wins = MAX(0, wins + ?) WHERE id = ?').bind(games, dw, uid),
    ];
  };
  await db.batch([
    ...side(g.p0_id, 0, delta[0]),
    ...side(g.p1_id, 1, delta[1]),
    db.prepare('UPDATE games SET winner = ?, reason = ?, rated = ?, r0 = ?, r1 = ?, d0 = ?, d1 = ? WHERE id = ?')
      .bind(winner, reason, to === 'void' ? 0 : 1, r0, r1, nd[0], nd[1], g.id),
  ]);
  return { d0: delta[0], d1: delta[1], estimated };
}

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
    const g = await db.prepare('SELECT * FROM games WHERE id = ?').bind(gameAction[1]).first<GameRecord>();
    if (!g || !body) return fail(404, 'not-found');
    const ids = splitGameId(g.id);
    let refund: Refund | null = null;
    if (g.status === 'playing' && ids) {
      // Live game: the room ends it (never rated).
      const res = await room(env, ids.room).fetch('https://room/admin', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) return fail(409, 'not-playing');
    } else {
      // Finished game: correct the record and the ratings it moved.
      refund = await correctFinished(db, g, body.action === 'cancel' ? 'void' : body.winner ?? null);
    }
    await audit(db, admin, 'game.' + body.action, g.id, { ...body, refund });
    return json({ ok: true, refund });
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
    if (filter === 'hidden') where.push('board_hidden = 1');
    const rows = await db.prepare(
      `SELECT * FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY last_seen DESC LIMIT 100`,
    ).bind(...args).all<UserRow>();
    // Rating in every game for the listed users.
    const ids = rows.results.map(u => u.id);
    const ratings = new Map<string, Ratings>(ids.map(id => [id, defaultRatings()]));
    if (ids.length) {
      const rr = await db.prepare(`SELECT user_id, kind, rating FROM ratings WHERE user_id IN (${ids.map(() => '?').join(', ')})`)
        .bind(...ids).all<{ user_id: string; kind: GameKind; rating: number }>();
      for (const r of rr.results) { const m = ratings.get(r.user_id); if (m && r.kind in m) m[r.kind] = r.rating; }
    }
    return json({ users: rows.results.map(u => ({ ...u, ratings: ratings.get(u.id) })) });
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
    return json({ user: { ...u, ratings: await ratingsOf(db, u.id) }, games: games.results, reports: reports.results });
  }

  const userAction = path.match(/^\/users\/([\w-]+)\/action$/);
  if (userAction && method === 'POST') {
    const body = await readJson<{ action: string; days?: number | null; reason?: string; name?: string; role?: string; rating?: number; kind?: GameKind | 'all'; hidden?: boolean }>(req);
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
        await db.prepare('UPDATE users SET warnings = warnings + 1, notice = ? WHERE id = ?').bind(reason || '#warning', u.id).run();
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
        const kinds = body.kind === 'all' || !body.kind ? KINDS : KINDS.includes(body.kind) ? [body.kind] : null;
        if (!kinds) return fail(400, 'bad-kind');
        await db.batch(kinds.map(k => setRating(db, u.id, k, rating, now)));
        break;
      }
      case 'reset': {
        // Back to 1200 and 0 games in one game or all of them.
        const kinds = body.kind === 'all' || !body.kind ? KINDS : KINDS.includes(body.kind) ? [body.kind] : null;
        if (!kinds) return fail(400, 'bad-kind');
        await db.prepare(`DELETE FROM ratings WHERE user_id = ? AND kind IN (${kinds.map(() => '?').join(', ')})`).bind(u.id, ...kinds).run();
        break;
      }
      case 'board':
        await db.prepare('UPDATE users SET board_hidden = ? WHERE id = ?').bind(body.hidden ? 1 : 0, u.id).run();
        break;
      case 'delete':
        if (u.id === admin.id) return fail(400, 'self');
        await lobby(env).fetch('https://lobby/kick', { method: 'POST', body: JSON.stringify({ uid: u.id }) });
        await db.batch([
          db.prepare('DELETE FROM ratings WHERE user_id = ?').bind(u.id),
          db.prepare('DELETE FROM quest_progress WHERE user_id = ?').bind(u.id),
          db.prepare('DELETE FROM quest_events WHERE user_id = ?').bind(u.id),
          db.prepare('DELETE FROM user_skins WHERE user_id = ?').bind(u.id),
          db.prepare('DELETE FROM users WHERE id = ?').bind(u.id),
        ]);
        break;
      default:
        return fail(400, 'bad-action');
    }
    await audit(db, admin, 'user.' + body.action, u.id, body);
    const after = await getUser(db, u.id);
    return json({ user: after ? publicUser(after, await ratingsOf(db, after.id)) : null });
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
