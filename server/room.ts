/**
 * GameRoom Durable Object: the authoritative state of one online room.
 * It validates every move with the same rules engine as the app, keeps the
 * clocks, hides jieqi identities from clients and records results in D1.
 */
import { DurableObject } from 'cloudflare:workers';
import { Match } from '../src/game';
import type { GameKind, Outcome } from '../src/engine/types';
import { Xiangqi, type XiangqiJSON } from '../src/engine/xiangqi';
import { Chess } from '../src/engine/chess';
import {
  AUTO_ABANDON_MS, CLAIM_AFTER_MS, EMOTES, afterMove, elo, timeLeft,
  type ClientMsg, type Clock, type MoveRec, type RoomState, type Seat, type ServerMsg, type RoomStatus,
} from '../src/shared/protocol';
import type { Env } from './env';

interface Stored {
  id: string;
  kind: GameKind;
  rated: boolean;
  status: RoomStatus;
  seats: [Seat | null, Seat | null];
  initial: string | XiangqiJSON;
  moves: MoveRec[];
  result: Outcome | null;
  ratingChange: [number, number] | null;
  clock: Clock | null;
  remaining: [number, number];
  turnStart: number | null;
  drawOffer: 0 | 1 | null;
  rematch: [boolean, boolean];
  disconnectedAt: [number | null, number | null];
  gameNo: number;
  created: number;
  lastActivity: number;
}

interface Attachment { uid: string; side: 0 | 1 | null; lastEmote: number }

export interface InitBody {
  id: string;
  kind: GameKind;
  rated: boolean;
  seats: [Seat | null, Seat | null];
  clock: Clock | null;
}

const DAY = 86400_000;

/** With a US delay the flag falls `delay` seconds later than the bare remaining time. */
function flagDelay(tc: Clock): number {
  return tc.delayType === 'simple' && tc.delay ? tc.delay * 1000 : 0;
}

export class GameRoom extends DurableObject<Env> {
  private s: Stored | null = null;
  private match: Match | null = null;

  private async load(): Promise<Stored | null> {
    if (!this.s) this.s = (await this.ctx.storage.get<Stored>('room')) ?? null;
    return this.s;
  }

  private async save() {
    if (this.s) await this.ctx.storage.put('room', this.s);
  }

  private getMatch(): Match {
    const s = this.s!;
    if (!this.match) this.match = Match.restore({ kind: s.kind, initial: s.initial, moves: s.moves.map(x => x.m) });
    return this.match;
  }

  private gameId(): string {
    return `${this.s!.id}-${this.s!.gameNo}`;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      if (await this.load()) return Response.json({ error: 'exists' }, { status: 409 });
      const body = (await request.json()) as InitBody;
      const now = Date.now();
      const ms = body.clock ? body.clock.base * 1000 : 0;
      this.s = {
        id: body.id, kind: body.kind, rated: body.rated, status: 'waiting', seats: body.seats,
        initial: new Match(body.kind).initial, moves: [], result: null, ratingChange: null,
        clock: body.clock, remaining: [ms, ms], turnStart: null, drawOffer: null, rematch: [false, false],
        disconnectedAt: [null, null], gameNo: 1, created: now, lastActivity: now,
      };
      if (body.seats[0] && body.seats[1]) await this.startGame();
      await this.save();
      await this.scheduleAlarm();
      return Response.json({ ok: true });
    }

    const s = await this.load();
    if (!s) return Response.json({ error: 'not-found' }, { status: 404 });

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      const user = JSON.parse(decodeURIComponent(request.headers.get('X-User') ?? 'null')) as Seat | null;
      if (!user) return new Response('unauthorized', { status: 401 });
      let side: 0 | 1 | null = s.seats[0]?.id === user.id ? 0 : s.seats[1]?.id === user.id ? 1 : null;
      if (side === null && s.status === 'waiting') {
        const empty = s.seats[0] ? (s.seats[1] ? null : 1) : 0;
        if (empty !== null) {
          s.seats[empty] = { id: user.id, name: user.name, rating: user.rating };
          side = empty;
          await this.startGame();
        }
      }
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server, [user.id]);
      server.serializeAttachment({ uid: user.id, side, lastEmote: 0 } satisfies Attachment);
      if (side !== null) s.disconnectedAt[side] = null;
      await this.save();
      await this.scheduleAlarm();
      this.send(server, { t: 'state', state: this.view(side) });
      this.broadcastPresence();
      if (side !== null && s.seats[side ^ 1] && s.status === 'playing' && this.ctx.getWebSockets().length > 1) {
        // The opponent may be waiting on the "waiting for friend" screen: give everyone the new state.
        this.broadcastState();
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/info') {
      return Response.json({ ...s, online: [0, 1].map(i => (s.seats[i] ? this.isOnline(s.seats[i]!.id) : false)) });
    }

    if (url.pathname === '/admin' && request.method === 'POST') {
      const { action, winner } = (await request.json()) as { action: 'cancel' | 'result'; winner?: 0 | 1 | null };
      if (s.status !== 'playing') return Response.json({ error: 'not-playing' }, { status: 409 });
      if (action === 'cancel') await this.finish({ winner: null, reason: 'cancelled' }, false);
      else if (winner === 0 || winner === 1) await this.finish({ winner, reason: 'admin' }, false);
      else await this.finish({ winner: null, reason: 'admin' }, false);
      return Response.json({ ok: true });
    }

    return new Response('not found', { status: 404 });
  }

  // ---------- WebSocket events ----------

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const s = await this.load();
    if (!s || typeof raw !== 'string' || raw.length > 2000) return;
    let msg: ClientMsg;
    try { msg = JSON.parse(raw) as ClientMsg; } catch { return; }
    const att = ws.deserializeAttachment() as Attachment;
    const side = att.side;
    const now = Date.now();

    switch (msg.t) {
      case 'ping':
        this.send(ws, { t: 'pong' });
        return;

      case 'move': {
        if (s.status !== 'playing') return this.send(ws, { t: 'error', code: 'over' });
        if (side === null) return this.send(ws, { t: 'error', code: 'not-player' });
        const match = this.getMatch();
        if (match.side !== side) return this.send(ws, { t: 'error', code: 'not-your-turn' });
        if (msg.ply !== s.moves.length) return this.send(ws, { t: 'state', state: this.view(side) });
        if (!Number.isInteger(msg.m) || !match.legalMoves().includes(msg.m)) return this.send(ws, { t: 'error', code: 'illegal' });
        // Clocks start once both sides have made their first move.
        if (s.clock && s.turnStart !== null) {
          const ownMoves = Math.floor(s.moves.length / 2) + 1; // this move included
          const left = afterMove(s.clock, s.remaining[side], now - s.turnStart, ownMoves);
          if (left <= 0) {
            s.remaining[side] = 0;
            await this.finish(this.getMatch().timeoutResult(side));
            return;
          }
          s.remaining[side] = left;
        }
        const rec: MoveRec = { m: msg.m, ...match.revealOf(msg.m) };
        match.play(msg.m);
        s.moves.push(rec);
        s.drawOffer = null;
        s.lastActivity = now;
        s.turnStart = s.clock && s.moves.length >= 2 ? now : null;
        this.broadcast({ t: 'move', ply: s.moves.length - 1, mv: rec, remaining: s.remaining, turnStart: s.turnStart, serverNow: now });
        const outcome = match.outcome();
        if (outcome) await this.finish(outcome);
        else { await this.save(); await this.scheduleAlarm(); }
        return;
      }

      case 'resign':
        if (s.status === 'playing' && side !== null) await this.finish({ winner: (side ^ 1) as 0 | 1, reason: 'resign' });
        return;

      case 'draw':
        if (s.status !== 'playing' || side === null) return;
        if (s.drawOffer === (side ^ 1)) { await this.finish({ winner: null, reason: 'agreement' }); return; }
        if (s.drawOffer === side) return;
        s.drawOffer = side;
        await this.save();
        this.broadcast({ t: 'offer', kind: 'draw', side });
        return;

      case 'decline':
        if (s.status === 'playing' && side !== null && s.drawOffer === (side ^ 1)) {
          s.drawOffer = null;
          await this.save();
          this.broadcast({ t: 'offer', kind: 'draw', side: null });
        }
        return;

      case 'rematch':
        if (s.status !== 'over' || side === null || !s.seats[0] || !s.seats[1]) return;
        s.rematch[side] = true;
        if (s.rematch[0] && s.rematch[1]) await this.newGame();
        else { await this.save(); this.broadcast({ t: 'offer', kind: 'rematch', side, rematch: s.rematch }); }
        return;

      case 'emote':
        if (!EMOTES.includes(msg.e) || now - att.lastEmote < 1500) return;
        att.lastEmote = now;
        ws.serializeAttachment(att);
        this.broadcast({ t: 'emote', side, e: msg.e });
        return;

      case 'claim': {
        if (s.status !== 'playing' || side === null) return;
        const gone = s.disconnectedAt[side ^ 1];
        if (gone !== null && now - gone >= CLAIM_AFTER_MS) await this.finish({ winner: side, reason: 'abandon' });
        else this.send(ws, { t: 'error', code: 'too-early' });
        return;
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    await this.onLeave(ws);
    try { ws.close(1000, 'bye'); } catch { /* already closed */ }
  }

  async webSocketError(ws: WebSocket) {
    await this.onLeave(ws);
  }

  private async onLeave(ws: WebSocket) {
    const s = await this.load();
    if (!s) return;
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att || att.side === null) return;
    if (this.isOnline(att.uid, ws)) return;
    s.disconnectedAt[att.side] = Date.now();
    await this.save();
    await this.scheduleAlarm();
    this.broadcastPresence();
  }

  // ---------- Game lifecycle ----------

  private async startGame() {
    const s = this.s!;
    s.status = 'playing';
    s.lastActivity = Date.now();
    const [a, b] = s.seats;
    await this.env.DB.prepare(
      'INSERT OR REPLACE INTO games (id, room, kind, rated, p0_id, p0_name, p1_id, p1_name, status, initial, moves, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(this.gameId(), s.id, s.kind, s.rated ? 1 : 0, a?.id ?? null, a?.name ?? null, b?.id ?? null, b?.name ?? null,
      'playing', JSON.stringify(s.initial), '[]', Date.now()).run();
  }

  private async finish(result: Outcome, rated = this.s!.rated) {
    const s = this.s!;
    if (s.status === 'over') return;
    const now = Date.now();
    if (s.clock && s.turnStart !== null) {
      const stm = (this.getMatch().side) as 0 | 1;
      s.remaining[stm] = Math.max(0, timeLeft(s.clock, s.remaining[stm], now - s.turnStart));
    }
    s.status = 'over';
    s.result = result;
    s.turnStart = null;
    s.drawOffer = null;
    s.rematch = [false, false];
    s.ratingChange = null;
    s.lastActivity = now;
    const [a, b] = s.seats;
    const counted = a && b && result.reason !== 'cancelled';
    if (counted) {
      const rows = await this.env.DB.prepare('SELECT id, rating FROM users WHERE id IN (?, ?)').bind(a.id, b.id).all<{ id: string; rating: number }>();
      const ra = rows.results.find(r => r.id === a.id)?.rating ?? a.rating;
      const rb = rows.results.find(r => r.id === b.id)?.rating ?? b.rating;
      const score = result.winner === 0 ? 1 : result.winner === 1 ? 0 : 0.5;
      const [na, nb] = rated ? elo(ra, rb, score) : [ra, rb];
      if (rated) s.ratingChange = [na - ra, nb - rb];
      a.rating = na;
      b.rating = nb;
      await this.env.DB.batch([
        this.env.DB.prepare('UPDATE users SET rating = ?, games = games + 1, wins = wins + ? WHERE id = ?').bind(na, result.winner === 0 ? 1 : 0, a.id),
        this.env.DB.prepare('UPDATE users SET rating = ?, games = games + 1, wins = wins + ? WHERE id = ?').bind(nb, result.winner === 1 ? 1 : 0, b.id),
      ]);
    }
    await this.env.DB.prepare('UPDATE games SET status = ?, winner = ?, reason = ?, moves = ?, ended = ?, rated = ? WHERE id = ?')
      .bind('over', result.winner, result.reason, JSON.stringify(s.moves), now, rated && counted ? 1 : 0, this.gameId()).run();
    await this.save();
    await this.scheduleAlarm();
    this.broadcastState();
  }

  private async newGame() {
    const s = this.s!;
    s.seats = [s.seats[1], s.seats[0]]; // swap colours
    s.initial = new Match(s.kind).initial;
    this.match = null;
    s.moves = [];
    s.result = null;
    s.ratingChange = null;
    s.gameNo++;
    const ms = s.clock ? s.clock.base * 1000 : 0;
    s.remaining = [ms, ms];
    s.turnStart = null;
    s.drawOffer = null;
    s.rematch = [false, false];
    s.disconnectedAt = [s.disconnectedAt[1], s.disconnectedAt[0]];
    await this.startGame();
    // Sides changed: update every socket's attachment.
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment;
      att.side = s.seats[0]?.id === att.uid ? 0 : s.seats[1]?.id === att.uid ? 1 : null;
      ws.serializeAttachment(att);
    }
    await this.save();
    await this.scheduleAlarm();
    this.broadcastState();
  }

  // ---------- Timers ----------

  private async scheduleAlarm() {
    const s = this.s;
    if (!s) return;
    const times: number[] = [];
    if (s.status === 'playing') {
      if (s.clock && s.turnStart !== null) times.push(s.turnStart + s.remaining[this.getMatch().side as 0 | 1] + flagDelay(s.clock));
      for (const d of s.disconnectedAt) if (d !== null) times.push(d + AUTO_ABANDON_MS);
      times.push(s.lastActivity + 3 * DAY); // stale game
    } else if (s.status === 'waiting') times.push(s.created + DAY);
    else times.push(s.lastActivity + 7 * DAY);
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 50, Math.min(...times)));
  }

  async alarm() {
    const s = await this.load();
    if (!s) return;
    const now = Date.now();
    if (s.status === 'playing') {
      const stm = this.getMatch().side as 0 | 1;
      if (s.clock && s.turnStart !== null && now >= s.turnStart + s.remaining[stm] + flagDelay(s.clock)) {
        s.remaining[stm] = 0;
        s.turnStart = null;
        await this.finish(this.getMatch().timeoutResult(stm));
        return;
      }
      const gone = s.disconnectedAt.map(d => d !== null && now - d >= AUTO_ABANDON_MS);
      if (gone[0] && gone[1]) { await this.finish({ winner: null, reason: 'cancelled' }, false); return; }
      if (gone[0] || gone[1]) { await this.finish({ winner: gone[0] ? 1 : 0, reason: 'abandon' }); return; }
      if (now >= s.lastActivity + 3 * DAY) { await this.finish({ winner: null, reason: 'cancelled' }, false); return; }
      await this.scheduleAlarm();
      return;
    }
    const deadline = s.status === 'waiting' ? s.created + DAY : s.lastActivity + 7 * DAY;
    if (now >= deadline) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'room closed');
      await this.ctx.storage.deleteAll();
      this.s = null;
      this.match = null;
      return;
    }
    await this.scheduleAlarm();
  }

  // ---------- Views & sending ----------

  private isOnline(uid: string, except?: WebSocket): boolean {
    return this.ctx.getWebSockets(uid).some(w => w !== except && w.readyState === WebSocket.OPEN);
  }

  private seatsView(): RoomState['seats'] {
    const s = this.s!;
    return [0, 1].map(i => (s.seats[i] ? { ...s.seats[i]!, online: this.isOnline(s.seats[i]!.id) } : null)) as RoomState['seats'];
  }

  private view(you: 0 | 1 | null): RoomState {
    const s = this.s!;
    // Players never receive face-down identities: only their start-square types.
    const initial = s.kind === 'jieqi' ? Xiangqi.fromJSON(s.initial as XiangqiJSON).masked()
      : s.kind === 'hiddenchess' ? new Chess(s.initial as string).masked() : s.initial;
    return {
      id: s.id, kind: s.kind, rated: s.rated, status: s.status, seats: this.seatsView(), you, initial,
      moves: s.moves, result: s.result, ratingChange: s.ratingChange, clock: s.clock, remaining: s.remaining,
      turnStart: s.turnStart, serverNow: Date.now(), drawOffer: s.drawOffer, rematch: s.rematch,
      disconnectedAt: s.disconnectedAt, gameNo: s.gameNo,
    };
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* socket gone */ }
  }

  private broadcast(msg: ServerMsg) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(data); } catch { /* gone */ } }
  }

  private broadcastState() {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment;
      this.send(ws, { t: 'state', state: this.view(att.side) });
    }
  }

  private broadcastPresence() {
    this.broadcast({ t: 'presence', seats: this.seatsView(), disconnectedAt: this.s!.disconnectedAt });
  }
}
