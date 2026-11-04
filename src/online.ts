/**
 * Online play over WebRTC (PeerJS). The PeerJS cloud server is only used so
 * the two browsers can find each other; moves then travel peer-to-peer.
 */
import type { DataConnection, Peer, PeerOptions } from 'peerjs';
import type { GameKind } from './engine/types';
import type { XiangqiJSON } from './engine/xiangqi';

export type NetMsg =
  | { t: 'hello'; v: 1 }
  | { t: 'start'; kind: GameKind; initial: string | XiangqiJSON; moves: number[]; hostSide: 0 | 1; resigned: number | null }
  | { t: 'move'; ply: number; move: number }
  | { t: 'resign'; side: number }
  | { t: 'rematch' };

export type NetStatus = 'opening' | 'waiting' | 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error';
export type NetError = 'room-not-found' | 'network' | 'server' | 'unknown';

const ID_PREFIX = 'banco-';

export function newRoomId(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

/** `?peer=host:port` lets developers and tests use a local PeerServer. */
function peerOptions(): PeerOptions {
  const custom = new URLSearchParams(location.search).get('peer');
  if (!custom) return { debug: 1 };
  const [host, port] = custom.split(':');
  return { host, port: Number(port) || 9000, path: '/', secure: location.protocol === 'https:' && host !== 'localhost', debug: 1 };
}

export class OnlineSession {
  status: NetStatus = 'opening';
  error: NetError | null = null;
  onMessage: (msg: NetMsg) => void = () => {};
  onStatus: (s: NetStatus) => void = () => {};
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private closed = false;
  private retryTimer = 0;
  private attempts = 0;

  private constructor(readonly role: 'host' | 'guest', readonly room: string) {}

  /** Create (or re-create after a reload) a room and wait for the friend. */
  static host(room: string): OnlineSession {
    const s = new OnlineSession('host', room);
    void s.openHost();
    return s;
  }

  static join(room: string): OnlineSession {
    const s = new OnlineSession('guest', room);
    void s.openGuest();
    return s;
  }

  private setStatus(st: NetStatus, err: NetError | null = null) {
    if (this.closed) return;
    this.status = st;
    this.error = err;
    this.onStatus(st);
  }

  private async createPeer(id?: string): Promise<Peer> {
    const { Peer } = await import('peerjs');
    return id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
  }

  private async openHost() {
    const peer = await this.createPeer(ID_PREFIX + this.room);
    if (this.closed) { peer.destroy(); return; }
    this.peer = peer;
    peer.on('open', () => { this.attempts = 0; this.setStatus(this.conn?.open ? 'connected' : 'waiting'); });
    peer.on('connection', conn => {
      // Accept the newest connection: the friend may have reloaded the page.
      this.conn?.close();
      this.attach(conn);
    });
    peer.on('disconnected', () => { if (!this.closed) setTimeout(() => !this.closed && peer.reconnect(), 1500); });
    peer.on('error', err => {
      // After a reload the old room id can stay registered for a short while.
      if (err.type === 'unavailable-id' && this.attempts++ < 20) {
        peer.destroy();
        this.retryTimer = window.setTimeout(() => void this.openHost(), 3000);
        this.setStatus('opening');
        return;
      }
      this.setStatus('error', err.type === 'network' ? 'network' : err.type === 'server-error' ? 'server' : 'unknown');
    });
  }

  private async openGuest() {
    const peer = this.peer ?? (await this.createPeer());
    if (this.closed) { peer.destroy(); return; }
    if (!this.peer) {
      this.peer = peer;
      peer.on('error', err => {
        if (err.type === 'peer-unavailable') {
          // Host not there (yet): keep trying for a while, then give up.
          if (this.attempts++ < 6) { this.retryTimer = window.setTimeout(() => this.connectGuest(), 2500); return; }
          this.setStatus('error', 'room-not-found');
          return;
        }
        this.setStatus('error', err.type === 'network' ? 'network' : err.type === 'server-error' ? 'server' : 'unknown');
      });
      peer.on('open', () => this.connectGuest());
      peer.on('disconnected', () => { if (!this.closed) setTimeout(() => !this.closed && peer.reconnect(), 1500); });
    } else this.connectGuest();
  }

  private connectGuest() {
    if (this.closed || !this.peer) return;
    this.setStatus(this.status === 'connected' || this.status === 'reconnecting' ? 'reconnecting' : 'connecting');
    const conn = this.peer.connect(ID_PREFIX + this.room, { reliable: true });
    this.attach(conn);
  }

  private attach(conn: DataConnection) {
    this.conn = conn;
    conn.on('open', () => {
      this.attempts = 0;
      this.setStatus('connected');
      if (this.role === 'guest') this.send({ t: 'hello', v: 1 });
    });
    conn.on('data', data => {
      if (conn === this.conn && data && typeof data === 'object' && 't' in data) this.onMessage(data as NetMsg);
    });
    conn.on('close', () => {
      if (conn !== this.conn || this.closed) return;
      if (this.role === 'host') this.setStatus('waiting');
      else {
        this.setStatus('reconnecting');
        this.retryTimer = window.setTimeout(() => this.connectGuest(), 2000);
      }
    });
    conn.on('error', () => { /* followed by close */ });
  }

  send(msg: NetMsg) {
    if (this.conn?.open) void this.conn.send(msg);
  }

  retry() {
    this.attempts = 0;
    this.error = null;
    if (this.role === 'guest') void this.openGuest();
    else { this.peer?.destroy(); this.peer = null; void this.openHost(); }
  }

  close() {
    this.closed = true;
    clearTimeout(this.retryTimer);
    this.conn?.close();
    this.peer?.destroy();
  }
}
