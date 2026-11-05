/**
 * Client side of the online server: configuration, account (guest / Google),
 * REST calls and auto-reconnecting WebSockets.
 */
import type { Announcement, LobbyClientMsg, LobbyServerMsg, LobbyStats, PublicUser } from './shared/protocol';
import type { SeasonConfig } from './shared/quests';
import { settings, store } from './state';

/** Same origin by default; set VITE_API_URL to use a server elsewhere. */
const API = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

export interface ServerConfig { googleClientId: string | null; emailLogin?: boolean; announcement: Announcement | null; seasons?: SeasonConfig; dev: boolean }

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly data: Record<string, unknown> = {}) { super(code); }
}

type Listener = () => void;

class Net {
  available = false;
  config: ServerConfig | null = null;
  me: PublicUser | null = null;
  banned: { until: number; reason: string | null } | null = null;
  token: string | null = store.get<string>('token');
  private listeners = new Set<Listener>();
  private ready: Promise<boolean> | null = null;

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach(fn => fn());
  }

  /** Connect to the server once; resolves false when it is unreachable. */
  init(): Promise<boolean> {
    this.ready ??= this.doInit();
    return this.ready;
  }

  private async doInit(): Promise<boolean> {
    try {
      this.config = await this.api<ServerConfig>('/config', { timeout: 6000, auth: false });
    } catch {
      this.available = false;
      this.ready = null; // allow a retry later
      return false;
    }
    try {
      if (this.token) await this.refreshMe().catch(async e => { if (e instanceof ApiError && e.status === 401) await this.newGuest(); else throw e; });
      else await this.newGuest();
      this.available = true;
    } catch {
      this.available = false;
      this.ready = null;
    }
    this.emit();
    return this.available;
  }

  async refreshMe() {
    const r = await this.api<{ user: PublicUser; banned: Net['banned'] }>('/me');
    this.me = r.user;
    this.banned = r.banned;
    this.emit();
  }

  private setSession(token: string, user: PublicUser) {
    this.token = token;
    this.me = user;
    this.banned = null;
    store.set('token', token);
    this.emit();
  }

  async newGuest() {
    const r = await this.api<{ token: string; user: PublicUser }>('/auth/guest', { method: 'POST', auth: false, body: { lang: settings.lang } });
    this.setSession(r.token, r.user);
  }

  async loginGoogle(credential: string) {
    const r = await this.api<{ token: string; user: PublicUser }>('/auth/google', { method: 'POST', body: { credential } });
    this.setSession(r.token, r.user);
    await this.refreshMe();
  }

  /** Signed in with a verified email (code or Google): may play online. */
  get member(): boolean {
    return !!this.me?.member;
  }

  /** Ask the server to email a sign-in code. */
  async startEmail(email: string): Promise<{ resendIn: number; devCode?: string }> {
    return this.api<{ resendIn: number; devCode?: string }>('/auth/email/start', { method: 'POST', auth: false, body: { email, lang: settings.lang } });
  }

  /** Check the code; signs in (or up) and keeps the current guest's name and rating when the email is new. */
  async verifyEmail(email: string, code: string) {
    const r = await this.api<{ token: string; user: PublicUser }>('/auth/email/verify', { method: 'POST', body: { email, code, lang: settings.lang } });
    this.setSession(r.token, r.user);
    await this.refreshMe();
  }

  async loginDevAdmin() {
    const r = await this.api<{ token: string; user: PublicUser }>('/auth/dev-admin', { method: 'POST', auth: false });
    this.setSession(r.token, r.user);
  }

  async logout() {
    await this.newGuest();
  }

  async rename(name: string) {
    const r = await this.api<{ user: PublicUser }>('/me', { method: 'PATCH', body: { name } });
    this.me = { ...this.me!, ...r.user };
    this.emit();
  }

  async api<T>(path: string, o: { method?: string; body?: unknown; timeout?: number; auth?: boolean } = {}): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeout ?? 15000);
    try {
      const res = await fetch(`${API}/api${path}`, {
        method: o.method ?? 'GET',
        headers: {
          ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(o.auth !== false && this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
        signal: ctrl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data as Record<string, unknown>);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  wsUrl(path: string): string {
    const base = API || location.origin;
    return `${base.replace(/^http/, 'ws')}/api${path}?token=${encodeURIComponent(this.token ?? '')}`;
  }
}

export const net = new Net();

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'failed' | 'closed';

/** WebSocket that reconnects with backoff and keeps itself alive with pings. */
export class ReSocket<In, Out> {
  status: SocketStatus = 'connecting';
  private ws: WebSocket | null = null;
  private attempts = 0;
  private everOpened = false;
  private closed = false;
  private timer = 0;
  private ping = 0;

  constructor(
    private path: string,
    private onMessage: (msg: In) => void,
    private onStatus: (s: SocketStatus) => void = () => {},
  ) {
    this.connect();
  }

  private set(s: SocketStatus) {
    this.status = s;
    this.onStatus(s);
  }

  private connect() {
    if (this.closed) return;
    const ws = new WebSocket(net.wsUrl(this.path));
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.everOpened = true;
      this.set('open');
      clearInterval(this.ping);
      this.ping = window.setInterval(() => this.send({ t: 'ping' } as Out), 25_000);
    };
    ws.onmessage = e => {
      try { this.onMessage(JSON.parse(e.data as string) as In); } catch { /* ignore bad frame */ }
    };
    ws.onclose = e => {
      clearInterval(this.ping);
      if (this.closed || ws !== this.ws) return;
      if (e.code === 4003) { this.set('failed'); return; } // banned / kicked
      this.attempts++;
      // A room that never accepted us (not found) fails fast.
      if (!this.everOpened && this.attempts >= 4) { this.set('failed'); return; }
      this.set('reconnecting');
      const delay = Math.min(10_000, 500 * 2 ** Math.min(this.attempts, 5));
      this.timer = window.setTimeout(() => this.connect(), delay);
    };
  }

  /** Reconnect now (e.g. after the tab becomes visible again). */
  kick() {
    if (this.closed || this.status === 'open') return;
    clearTimeout(this.timer);
    this.attempts = 0;
    this.everOpened = this.everOpened && true;
    this.connect();
  }

  send(msg: Out) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.ping);
    this.ws?.close();
    this.set('closed');
  }
}

/** The always-on lobby connection: online count, announcements, matchmaking. */
class LobbyClient {
  stats: LobbyStats | null = null;
  announcement: Announcement | null = null;
  private sock: ReSocket<LobbyServerMsg, LobbyClientMsg> | null = null;
  private listeners = new Set<(m: LobbyServerMsg) => void>();

  start() {
    if (this.sock || !net.available) return;
    this.announcement = net.config?.announcement ?? null;
    this.sock = new ReSocket<LobbyServerMsg, LobbyClientMsg>('/lobby/ws', msg => {
      if (msg.t === 'hello') { this.stats = msg.stats; this.announcement = msg.announcement; }
      if (msg.t === 'stats') this.stats = msg.stats;
      if (msg.t === 'announcement') this.announcement = msg.announcement;
      this.listeners.forEach(fn => fn(msg));
    });
  }

  restart() {
    this.sock?.close();
    this.sock = null;
    this.start();
  }

  on(fn: (m: LobbyServerMsg) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  send(msg: LobbyClientMsg) {
    this.sock?.send(msg);
  }

  get connected(): boolean {
    return this.sock?.status === 'open';
  }
}

export const lobby = new LobbyClient();

/** Load Google Identity Services and render its button into `el`. */
export async function renderGoogleButton(el: HTMLElement, onCredential: (credential: string) => void) {
  const clientId = net.config?.googleClientId;
  if (!clientId) return false;
  type GIS = { accounts: { id: { initialize(o: object): void; renderButton(el: HTMLElement, o: object): void } } };
  const w = window as unknown as { google?: GIS };
  if (!w.google) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('gis'));
      document.head.appendChild(s);
    });
  }
  w.google!.accounts.id.initialize({ client_id: clientId, callback: (r: { credential: string }) => onCredential(r.credential) });
  w.google!.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with' });
  return true;
}
