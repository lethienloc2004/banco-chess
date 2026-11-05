/** Bàn Cờ Cloudflare Worker: REST API, WebSocket routing and static assets. */
import type { GameKind } from '../src/engine/types';
import { CLOCKS, REPORT_REASONS, cleanName, type Seat } from '../src/shared/protocol';
import { adminRoute } from './admin';
import { randomId, roomId, signToken, verifyGoogleIdToken, verifyToken } from './auth';
import { createUser, currentAnnouncement, getUser, isBanned, publicUser, touchUser, type UserRow } from './db';
import type { Env } from './env';
import type { InitBody } from './room';
import { CORS, fail, json } from './http';

export { GameRoom } from './room';
export { Lobby } from './lobby';

const KINDS: GameKind[] = ['chess', 'xiangqi', 'jieqi', 'hiddenchess'];

async function readJson<T>(req: Request): Promise<T | null> {
  try { return (await req.json()) as T; } catch { return null; }
}

/** Resolve the user from `Authorization: Bearer` or `?token=` (WebSockets). */
export async function authUser(req: Request, env: Env): Promise<UserRow | null> {
  const url = new URL(req.url);
  const header = req.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('token');
  const uid = await verifyToken(token, env.AUTH_SECRET);
  return uid ? getUser(env.DB, uid) : null;
}

function guestName(): string {
  const n = new Uint16Array(1);
  crypto.getRandomValues(n);
  return `Khách ${1000 + (n[0] % 9000)}`;
}

function adminEmails(env: Env): string[] {
  return (env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

async function session(env: Env, user: UserRow) {
  return json({ token: await signToken(user.id, env.AUTH_SECRET), user: publicUser(user, true) });
}

function seatOf(u: UserRow): Seat {
  return { id: u.id, name: u.name, rating: u.rating };
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api/, '');
  const method = req.method;

  if (path === '/config' && method === 'GET') {
    return json({ googleClientId: env.GOOGLE_CLIENT_ID || null, announcement: await currentAnnouncement(env.DB), dev: env.DEV === '1' });
  }

  // ----- Auth -----
  if (path === '/auth/guest' && method === 'POST') {
    const user = await createUser(env.DB, randomId('u_'), guestName());
    return session(env, user);
  }

  if (path === '/auth/google' && method === 'POST') {
    if (!env.GOOGLE_CLIENT_ID) return fail(400, 'google-disabled');
    const body = await readJson<{ credential: string }>(req);
    const claims = body?.credential ? await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID) : null;
    if (!claims) return fail(401, 'bad-credential');
    const email = claims.email_verified ? claims.email?.toLowerCase() ?? null : null;
    const makeAdmin = !!email && adminEmails(env).includes(email);
    let user = await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(claims.sub).first<UserRow>();
    if (!user) {
      // Attach Google to the current guest account so rating and history are kept.
      const current = await authUser(req, env);
      if (current && !current.google_sub) {
        await env.DB.prepare('UPDATE users SET google_sub = ?, email = ? WHERE id = ?').bind(claims.sub, email, current.id).run();
        user = (await getUser(env.DB, current.id))!;
      } else {
        user = await createUser(env.DB, randomId('u_'), cleanName(claims.name ?? '') ?? guestName(), { google_sub: claims.sub, email });
      }
    }
    if (makeAdmin && user.role !== 'admin') {
      await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(user.id).run();
      user.role = 'admin';
    }
    return session(env, user);
  }

  if (path === '/auth/dev-admin' && method === 'POST') {
    // Local development only (DEV=1 in .dev.vars): an admin account without Google.
    if (env.DEV !== '1') return fail(404, 'not-found');
    let user = await env.DB.prepare("SELECT * FROM users WHERE id = 'u_dev_admin'").first<UserRow>();
    user ??= await createUser(env.DB, 'u_dev_admin', 'Quản trị (dev)', { role: 'admin' });
    return session(env, user);
  }

  const me = await authUser(req, env);
  if (!me) return fail(401, 'unauthorized');

  if (path === '/me' && method === 'GET') {
    await touchUser(env.DB, me.id);
    return json({ user: publicUser(me, true), banned: isBanned(me) ? { until: me.banned_until, reason: me.ban_reason } : null });
  }
  if (path === '/me' && method === 'PATCH') {
    const body = await readJson<{ name?: string }>(req);
    const name = cleanName(body?.name ?? '');
    if (!name) return fail(400, 'bad-name');
    await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, me.id).run();
    return json({ user: publicUser({ ...me, name }, true) });
  }
  if (path === '/me/notice' && method === 'DELETE') {
    await env.DB.prepare('UPDATE users SET notice = NULL WHERE id = ?').bind(me.id).run();
    return json({ ok: true });
  }
  if (path === '/me/games' && method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id, kind, rated, p0_id, p0_name, p1_id, p1_name, status, winner, reason, created, ended FROM games WHERE p0_id = ? OR p1_id = ? ORDER BY created DESC LIMIT 30',
    ).bind(me.id, me.id).all();
    return json({ games: rows.results });
  }

  if (isBanned(me)) return fail(403, 'banned');

  // ----- Rooms -----
  if (path === '/rooms' && method === 'POST') {
    const body = await readJson<{ kind: GameKind; side: 0 | 1 | 'random'; clock: string }>(req);
    if (!body || !KINDS.includes(body.kind)) return fail(400, 'bad-request');
    const side = body.side === 'random' ? (Math.random() < 0.5 ? 0 : 1) : body.side === 1 ? 1 : 0;
    const clock = CLOCKS[body.clock] ?? null;
    const id = roomId();
    const seats: InitBody['seats'] = [null, null];
    seats[side] = seatOf(me);
    const init: InitBody = { id, kind: body.kind, rated: false, seats, clock };
    const res = await env.ROOMS.get(env.ROOMS.idFromName(id)).fetch('https://room/init', { method: 'POST', body: JSON.stringify(init) });
    if (!res.ok) return fail(500, 'room-failed');
    return json({ id });
  }

  const ws = path.match(/^\/rooms\/([\w-]{4,20})\/ws$/);
  if (ws && req.headers.get('Upgrade') === 'websocket') {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(ws[1]));
    return stub.fetch('https://room/ws', { headers: { Upgrade: 'websocket', 'X-User': encodeURIComponent(JSON.stringify(seatOf(me))) } });
  }

  if (path === '/lobby/ws' && req.headers.get('Upgrade') === 'websocket') {
    const stub = env.LOBBY.get(env.LOBBY.idFromName('main'));
    return stub.fetch('https://lobby/ws', { headers: { Upgrade: 'websocket', 'X-User': encodeURIComponent(JSON.stringify(seatOf(me))) } });
  }

  // ----- Reports -----
  if (path === '/reports' && method === 'POST') {
    const body = await readJson<{ room: string; gameNo: number; target: string; reason: string; note?: string }>(req);
    if (!body || !REPORT_REASONS.includes(body.reason as never) || !body.target || body.target === me.id) return fail(400, 'bad-request');
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ? AND created > ?')
      .bind(me.id, Date.now() - 3600_000).first<{ n: number }>();
    if ((recent?.n ?? 0) >= 10) return fail(429, 'too-many');
    await env.DB.prepare('INSERT INTO reports (game_id, reporter_id, target_id, reason, note, created) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(`${body.room}-${body.gameNo}`, me.id, body.target, body.reason, String(body.note ?? '').slice(0, 500), Date.now()).run();
    return json({ ok: true });
  }

  if (path.startsWith('/admin/')) {
    if (me.role !== 'admin') return fail(403, 'forbidden');
    return adminRoute(req, env, me, path.slice('/admin'.length), readJson);
  }

  return fail(404, 'not-found');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
      // A fresh deployment without the session secret: tell the app instead of failing obscurely.
      if (!env.AUTH_SECRET) return fail(503, 'not-configured');
      try {
        return await handleApi(req, env, url);
      } catch (err) {
        console.error(err);
        return fail(500, 'server-error');
      }
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
