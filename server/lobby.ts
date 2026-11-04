/**
 * Lobby Durable Object (single instance): who is online, random matchmaking
 * queues per game, and live announcements.
 */
import { DurableObject } from 'cloudflare:workers';
import type { GameKind } from '../src/engine/types';
import { RANKED_CLOCK, type Announcement, type LobbyClientMsg, type LobbyServerMsg, type LobbyStats, type Seat } from '../src/shared/protocol';
import { roomId } from './auth';
import { currentAnnouncement } from './db';
import type { Env } from './env';
import type { InitBody } from './room';

interface Attachment extends Seat { queue: GameKind | null; since: number }

const KINDS: GameKind[] = ['chess', 'xiangqi', 'jieqi'];

export class Lobby extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const user = JSON.parse(decodeURIComponent(request.headers.get('X-User') ?? 'null')) as Seat | null;
      if (!user) return new Response('unauthorized', { status: 401 });
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server, [user.id]);
      server.serializeAttachment({ ...user, queue: null, since: 0 } satisfies Attachment);
      const announcement = await currentAnnouncement(this.env.DB);
      this.send(server, { t: 'hello', stats: this.stats(), announcement });
      this.broadcastStats();
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/stats') return Response.json(this.stats());
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const { announcement } = (await request.json()) as { announcement: Announcement | null };
      this.broadcast({ t: 'announcement', announcement });
      return Response.json({ ok: true });
    }
    if (url.pathname === '/kick' && request.method === 'POST') {
      const { uid } = (await request.json()) as { uid: string };
      for (const ws of this.ctx.getWebSockets(uid)) {
        this.send(ws, { t: 'kicked' });
        ws.close(4003, 'banned');
      }
      this.broadcastStats();
      return Response.json({ ok: true });
    }
    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 500) return;
    let msg: LobbyClientMsg;
    try { msg = JSON.parse(raw) as LobbyClientMsg; } catch { return; }
    const att = ws.deserializeAttachment() as Attachment;
    if (msg.t === 'ping') return this.send(ws, { t: 'pong' });
    if (msg.t === 'cancel') {
      att.queue = null;
      ws.serializeAttachment(att);
      this.broadcastStats();
      return;
    }
    if (msg.t === 'queue' && KINDS.includes(msg.kind)) {
      // One queue entry per user: drop it from their other tabs.
      for (const other of this.ctx.getWebSockets(att.id)) {
        if (other === ws) continue;
        const o = other.deserializeAttachment() as Attachment;
        if (o.queue) { o.queue = null; other.serializeAttachment(o); }
      }
      att.queue = msg.kind;
      att.since = Date.now();
      ws.serializeAttachment(att);
      this.send(ws, { t: 'queued', kind: msg.kind });
      await this.tryMatch(msg.kind);
      this.broadcastStats();
    }
  }

  async webSocketClose(ws: WebSocket) {
    try { ws.close(1000, 'bye'); } catch { /* closed */ }
    this.broadcastStats();
  }

  async webSocketError() {
    this.broadcastStats();
  }

  private open(): WebSocket[] {
    return this.ctx.getWebSockets().filter(w => w.readyState === WebSocket.OPEN);
  }

  /** Pair the longest-waiting player with the closest rating in the same queue. */
  private async tryMatch(kind: GameKind) {
    for (;;) {
      const waiting = this.open()
        .map(ws => ({ ws, a: ws.deserializeAttachment() as Attachment }))
        .filter(x => x.a.queue === kind)
        .sort((x, y) => x.a.since - y.a.since);
      if (waiting.length < 2) return;
      const first = waiting[0];
      const others = waiting.filter(x => x.a.id !== first.a.id);
      if (!others.length) return;
      others.sort((x, y) => Math.abs(x.a.rating - first.a.rating) - Math.abs(y.a.rating - first.a.rating));
      const second = others[0];
      const id = roomId();
      const white = Math.random() < 0.5 ? first : second;
      const black = white === first ? second : first;
      const seat = (a: Attachment): Seat => ({ id: a.id, name: a.name, rating: a.rating });
      const body: InitBody = { id, kind, rated: true, seats: [seat(white.a), seat(black.a)], clock: RANKED_CLOCK };
      const res = await this.env.ROOMS.get(this.env.ROOMS.idFromName(id)).fetch('https://room/init', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) return;
      for (const x of [first, second]) {
        x.a.queue = null;
        x.ws.serializeAttachment(x.a);
        this.send(x.ws, { t: 'matched', room: id });
      }
    }
  }

  private stats(): LobbyStats {
    const users = new Set<string>();
    const queued: Record<GameKind, Set<string>> = { chess: new Set(), xiangqi: new Set(), jieqi: new Set() };
    for (const ws of this.open()) {
      const a = ws.deserializeAttachment() as Attachment;
      users.add(a.id);
      if (a.queue) queued[a.queue].add(a.id);
    }
    return { online: users.size, queued: { chess: queued.chess.size, xiangqi: queued.xiangqi.size, jieqi: queued.jieqi.size } };
  }

  private send(ws: WebSocket, msg: LobbyServerMsg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* gone */ }
  }

  private broadcast(msg: LobbyServerMsg) {
    const data = JSON.stringify(msg);
    for (const ws of this.open()) { try { ws.send(data); } catch { /* gone */ } }
  }

  private broadcastStats() {
    this.broadcast({ t: 'stats', stats: this.stats() });
  }
}
