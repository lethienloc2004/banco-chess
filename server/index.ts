/** Bàn Cờ Cloudflare Worker: REST API, WebSocket routing and static assets. */
import type { GameKind } from '../src/engine/types';
import { CLOCKS, LEADERBOARD_MIN_GAMES, LEADERBOARD_SIZE, REPORT_REASONS, cleanName, type BoardEntry, type KindStats, type Leaderboard, type PlayerProfile, type ProfileGame } from '../src/shared/protocol';
import { adminRoute } from './admin';
import { randomId, roomId, signToken, verifyGoogleIdToken, verifyToken } from './auth';
import { KINDS, RANKED, createUser, currentAnnouncement, getUser, isBanned, isMember, playerOf, publicUser, rankOf, ratingsOf, touchUser, type RatingRow, type UserRow } from './db';
import { LIMITS, OTP_MAX_ATTEMPTS, OTP_RESEND_MS, OTP_TTL_MS, emailLoginEnabled, hashCode, newCode, normalizeEmail, rateHit, sameHash, sendCode } from './otp';
import type { Env } from './env';
import type { InitBody } from './room';
import { CORS, fail, json } from './http';

export { GameRoom } from './room';
export { Lobby } from './lobby';

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

function guestName(lang = 'vi'): string {
  const n = new Uint16Array(1);
  crypto.getRandomValues(n);
  return `${lang === 'en' ? 'Guest' : 'Khách'} ${1000 + (n[0] % 9000)}`;
}

/** A default guest name ("Khách 1234") becomes a member name ("Kỳ thủ 1234") on sign-in; chosen names stay. */
function promoteGuestName(name: string, lang = 'vi'): string | null {
  const m = name.match(/^(?:Khách|Guest) (\d{4})$/);
  return m ? `${lang === 'en' ? 'Player' : 'Kỳ thủ'} ${m[1]}` : null;
}

/** Default name for an account created by email sign-in (never derived from the email, which stays private). */
function memberName(lang = 'vi'): string {
  const n = new Uint16Array(1);
  crypto.getRandomValues(n);
  return `${lang === 'en' ? 'Player' : 'Kỳ thủ'} ${1000 + (n[0] % 9000)}`;
}

function adminEmails(env: Env): string[] {
  return (env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

async function session(env: Env, user: UserRow) {
  return json({ token: await signToken(user.id, env.AUTH_SECRET), user: publicUser(user, await ratingsOf(env.DB, user.id), true) });
}

/** X-User header for a room or the lobby: name plus the rating in every game. */
async function playerHeader(env: Env, u: UserRow): Promise<string> {
  return encodeURIComponent(JSON.stringify(await playerOf(env.DB, u)));
}

/** Top players of one game, plus the caller's own row. */
async function leaderboard(env: Env, kind: GameKind, me: UserRow | null): Promise<Leaderboard> {
  const db = env.DB, now = Date.now();
  const [top, total, mine] = await Promise.all([
    db.prepare(`SELECT r.user_id AS id, u.name, r.rating, r.games, r.wins, r.draws, r.peak FROM ratings r JOIN users u ON u.id = r.user_id
      WHERE r.kind = ? AND ${RANKED} ORDER BY r.rating DESC, r.games DESC, r.updated ASC LIMIT ?`)
      .bind(kind, now, LEADERBOARD_SIZE).all<Omit<BoardEntry, 'rank'>>(),
    db.prepare(`SELECT COUNT(*) AS n FROM ratings r JOIN users u ON u.id = r.user_id WHERE r.kind = ? AND ${RANKED}`).bind(kind, now).first<{ n: number }>(),
    me ? db.prepare('SELECT * FROM ratings WHERE user_id = ? AND kind = ?').bind(me.id, kind).first<RatingRow>() : Promise.resolve(null),
  ]);
  // Equal ratings share a place (1, 2, 2, 4…).
  const entries: BoardEntry[] = [];
  top.results.forEach((r, i) => {
    const prev = entries[i - 1];
    entries.push({ ...r, rank: prev && prev.rating === r.rating ? prev.rank : i + 1 });
  });
  let meRow: BoardEntry | null = null;
  if (me && mine && mine.games >= LEADERBOARD_MIN_GAMES && !isBanned(me, now) && !me.board_hidden) {
    meRow = entries.find(e => e.id === me.id) ?? {
      rank: await rankOf(db, kind, mine.rating, now), id: me.id, name: me.name,
      rating: mine.rating, games: mine.games, wins: mine.wins, draws: mine.draws, peak: mine.peak,
    };
  }
  return { kind, entries, me: meRow, myGames: mine?.games ?? 0, total: total?.n ?? 0, minGames: LEADERBOARD_MIN_GAMES };
}

/** Public profile: rating, place and record in every game, and recent games. */
async function profile(env: Env, id: string): Promise<PlayerProfile | null> {
  const db = env.DB, now = Date.now();
  const u = await getUser(db, id);
  if (!u) return null;
  const [rows, games] = await Promise.all([
    db.prepare('SELECT * FROM ratings WHERE user_id = ?').bind(id).all<RatingRow>(),
    db.prepare(`SELECT id, kind, rated, p0_id, p0_name, p1_id, p1_name, winner, reason, ended FROM games
      WHERE (p0_id = ? OR p1_id = ?) AND status = 'over' AND (reason IS NULL OR reason <> 'cancelled') ORDER BY ended DESC LIMIT 15`)
      .bind(id, id).all<{ id: string; kind: GameKind; rated: number; p0_id: string | null; p0_name: string | null; p1_id: string | null; p1_name: string | null; winner: 0 | 1 | null; reason: string | null; ended: number | null }>(),
  ]);
  const banned = isBanned(u, now);
  const hidden = !!u.board_hidden;
  const stats = {} as Record<GameKind, KindStats>;
  for (const kind of KINDS) {
    const r = rows.results.find(x => x.kind === kind);
    const base = { rating: r?.rating ?? 1200, games: r?.games ?? 0, wins: r?.wins ?? 0, draws: r?.draws ?? 0, peak: r?.peak ?? 1200 };
    const ranked = !banned && !hidden && base.games >= LEADERBOARD_MIN_GAMES;
    stats[kind] = { ...base, rank: ranked ? await rankOf(db, kind, base.rating, now) : null };
  }
  const recent: ProfileGame[] = games.results.map(g => {
    const side: 0 | 1 = g.p0_id === id ? 0 : 1;
    return {
      id: g.id, kind: g.kind, rated: !!g.rated, side,
      opponent: side === 0 ? { id: g.p1_id, name: g.p1_name } : { id: g.p0_id, name: g.p0_name },
      winner: g.winner, reason: g.reason, ended: g.ended,
    };
  });
  return { id: u.id, name: u.name, created: u.created, banned, hidden, stats, recent };
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api/, '');
  const method = req.method;

  if (path === '/config' && method === 'GET') {
    return json({ googleClientId: env.GOOGLE_CLIENT_ID || null, emailLogin: emailLoginEnabled(env), announcement: await currentAnnouncement(env.DB), dev: env.DEV === '1' });
  }

  // ----- Auth -----
  if (path === '/auth/guest' && method === 'POST') {
    const body = await readJson<{ lang?: string }>(req);
    const user = await createUser(env.DB, randomId('u_'), guestName(body?.lang));
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
        const name = promoteGuestName(current.name) ? cleanName(claims.name ?? '') ?? promoteGuestName(current.name)! : current.name;
        await env.DB.prepare('UPDATE users SET google_sub = ?, email = ?, email_verified = ?, name = ? WHERE id = ?').bind(claims.sub, email, email ? 1 : 0, name, current.id).run();
        user = (await getUser(env.DB, current.id))!;
      } else {
        user = await createUser(env.DB, randomId('u_'), cleanName(claims.name ?? '') ?? guestName(), { google_sub: claims.sub, email, email_verified: email ? 1 : 0 });
      }
    }
    if (makeAdmin && user.role !== 'admin') {
      await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(user.id).run();
      user.role = 'admin';
    }
    return session(env, user);
  }

  // ----- Email sign-in / sign-up with a one-time code -----
  if (path === '/auth/email/start' && method === 'POST') {
    if (!emailLoginEnabled(env)) return fail(503, 'email-disabled');
    const body = await readJson<{ email?: string; lang?: string }>(req);
    const email = normalizeEmail(body?.email);
    if (!email) return fail(400, 'bad-email');
    const now = Date.now();
    const pending = await env.DB.prepare('SELECT sent FROM otp_codes WHERE email = ?').bind(email).first<{ sent: number }>();
    if (pending && now - pending.sent < OTP_RESEND_MS) return json({ error: 'wait', retryIn: Math.ceil((OTP_RESEND_MS - (now - pending.sent)) / 1000) }, 429);
    const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
    if (!(await rateHit(env.DB, 'email:' + email, LIMITS.perEmail, now)) || !(await rateHit(env.DB, 'ip:' + ip, env.DEV === '1' ? 1000 : LIMITS.perIp, now))) return fail(429, 'too-many');
    const code = newCode();
    await env.DB.prepare(
      `INSERT INTO otp_codes (email, code_hash, expires, attempts, sent) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires = excluded.expires, attempts = 0, sent = excluded.sent`,
    ).bind(email, await hashCode(email, code, env.AUTH_SECRET), now + OTP_TTL_MS, now).run();
    const sent = await sendCode(env, email, code, body?.lang ?? 'vi');
    if (sent === 'failed') return fail(502, 'send-failed');
    // Local development without Brevo: hand the code back so it can be typed in (never in production).
    return json({ ok: true, resendIn: OTP_RESEND_MS / 1000, ...(sent === 'logged' ? { devCode: code } : {}) });
  }

  if (path === '/auth/email/verify' && method === 'POST') {
    const body = await readJson<{ email?: string; code?: string; lang?: string }>(req);
    const email = normalizeEmail(body?.email);
    const code = String(body?.code ?? '').replace(/\D/g, '');
    if (!email || code.length !== 6) return fail(400, 'bad-code');
    const now = Date.now();
    const row = await env.DB.prepare('SELECT * FROM otp_codes WHERE email = ?').bind(email).first<{ code_hash: string; expires: number; attempts: number }>();
    if (!row || row.expires < now) return fail(400, 'code-expired');
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await env.DB.prepare('DELETE FROM otp_codes WHERE email = ?').bind(email).run();
      return fail(429, 'too-many-attempts');
    }
    if (!sameHash(row.code_hash, await hashCode(email, code, env.AUTH_SECRET))) {
      await env.DB.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
      return json({ error: 'bad-code', left: OTP_MAX_ATTEMPTS - row.attempts - 1 }, 400);
    }
    await env.DB.prepare('DELETE FROM otp_codes WHERE email = ?').bind(email).run();
    // Same person = same verified email: reuse that account (also one made with Google).
    let user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND (email_verified = 1 OR google_sub IS NOT NULL) ORDER BY created LIMIT 1')
      .bind(email).first<UserRow>();
    if (!user) {
      // Upgrade the guest account in use so its name, rating and games are kept.
      const current = await authUser(req, env);
      if (current && !isMember(current)) {
        const name = promoteGuestName(current.name, body?.lang) ?? current.name;
        await env.DB.prepare('UPDATE users SET email = ?, email_verified = 1, name = ? WHERE id = ?').bind(email, name, current.id).run();
        user = (await getUser(env.DB, current.id))!;
      } else {
        user = await createUser(env.DB, randomId('u_'), memberName(body?.lang), { email, email_verified: 1 });
      }
    } else if (!user.email_verified) {
      await env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(user.id).run();
      user.email_verified = 1;
    }
    if (adminEmails(env).includes(email) && user.role !== 'admin') {
      await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(user.id).run();
      user.role = 'admin';
    }
    return session(env, user);
  }

  if (path === '/auth/dev-admin' && method === 'POST') {
    // Local development only (DEV=1 in .dev.vars): an admin account without Google.
    if (env.DEV !== '1') return fail(404, 'not-found');
    let user = await env.DB.prepare("SELECT * FROM users WHERE id = 'u_dev_admin'").first<UserRow>();
    user ??= await createUser(env.DB, 'u_dev_admin', 'Admin (dev)', { role: 'admin' });
    return session(env, user);
  }

  // ----- Public: leaderboards and profiles (the caller's own row when signed in) -----
  if (path === '/leaderboard' && method === 'GET') {
    const kind = url.searchParams.get('kind') as GameKind;
    if (!KINDS.includes(kind)) return fail(400, 'bad-kind');
    return json(await leaderboard(env, kind, await authUser(req, env)));
  }
  const player = path.match(/^\/players\/([\w-]{1,40})$/);
  if (player && method === 'GET') {
    const p = await profile(env, player[1]);
    return p ? json({ profile: p }) : fail(404, 'not-found');
  }

  const me = await authUser(req, env);
  if (!me) return fail(401, 'unauthorized');

  if (path === '/me' && method === 'GET') {
    await touchUser(env.DB, me.id);
    return json({ user: publicUser(me, await ratingsOf(env.DB, me.id), true), banned: isBanned(me) ? { until: me.banned_until, reason: me.ban_reason } : null });
  }
  if (path === '/me' && method === 'PATCH') {
    const body = await readJson<{ name?: string }>(req);
    const name = cleanName(body?.name ?? '');
    if (!name) return fail(400, 'bad-name');
    await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, me.id).run();
    return json({ user: publicUser({ ...me, name }, await ratingsOf(env.DB, me.id), true) });
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
    if (!isMember(me)) return fail(403, 'login-required');
    const body = await readJson<{ kind: GameKind; side: 0 | 1 | 'random'; clock: string }>(req);
    if (!body || !KINDS.includes(body.kind)) return fail(400, 'bad-request');
    const side = body.side === 'random' ? (Math.random() < 0.5 ? 0 : 1) : body.side === 1 ? 1 : 0;
    const clock = CLOCKS[body.clock] ?? null;
    const id = roomId();
    const seats: InitBody['seats'] = [null, null];
    seats[side] = { id: me.id, name: me.name, rating: (await ratingsOf(env.DB, me.id))[body.kind] };
    const init: InitBody = { id, kind: body.kind, rated: false, seats, clock };
    const res = await env.ROOMS.get(env.ROOMS.idFromName(id)).fetch('https://room/init', { method: 'POST', body: JSON.stringify(init) });
    if (!res.ok) return fail(500, 'room-failed');
    return json({ id });
  }

  const ws = path.match(/^\/rooms\/([\w-]{4,20})\/ws$/);
  if (ws && req.headers.get('Upgrade') === 'websocket') {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(ws[1]));
    return stub.fetch('https://room/ws', { headers: { Upgrade: 'websocket', 'X-User': await playerHeader(env, me) } });
  }

  if (path === '/lobby/ws' && req.headers.get('Upgrade') === 'websocket') {
    const stub = env.LOBBY.get(env.LOBBY.idFromName('main'));
    return stub.fetch('https://lobby/ws', { headers: { Upgrade: 'websocket', 'X-User': await playerHeader(env, me) } });
  }

  // ----- Reports -----
  if (path === '/reports' && method === 'POST') {
    if (!isMember(me)) return fail(403, 'login-required');
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
