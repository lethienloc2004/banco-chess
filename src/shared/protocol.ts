/** Types and constants shared by the browser app and the Cloudflare server. */
import type { GameKind, Outcome } from '../engine/types';
import type { XiangqiJSON } from '../engine/xiangqi';

export type Role = 'user' | 'admin';

export interface PublicUser {
  id: string;
  name: string;
  rating: number;
  games: number;
  wins: number;
  role: Role;
  google: boolean;
  email?: string | null;
  /** One-off message from an admin (warning), shown until acknowledged. */
  notice?: string | null;
}

export interface Seat {
  id: string;
  name: string;
  rating: number;
}

export interface SeatView extends Seat {
  online: boolean;
}

/** Time control in seconds: base time per side + increment per move. */
export interface Clock { base: number; inc: number }

export const CLOCKS: Record<string, Clock | null> = {
  none: null,
  '3+2': { base: 180, inc: 2 },
  '5+3': { base: 300, inc: 3 },
  '10+5': { base: 600, inc: 5 },
  '15+10': { base: 900, inc: 10 },
};
export const RANKED_CLOCK: Clock = { base: 600, inc: 5 };

/** A move as sent to clients; r / c reveal jieqi identities (mover / captured). */
export interface MoveRec { m: number; r?: number; c?: number }

export type RoomStatus = 'waiting' | 'playing' | 'over';

export interface RoomState {
  id: string;
  kind: GameKind;
  rated: boolean;
  status: RoomStatus;
  seats: [SeatView | null, SeatView | null];
  /** Which side the receiving client plays; null for spectators. */
  you: 0 | 1 | null;
  /** Start position. For jieqi the face-down identities are masked. */
  initial: string | XiangqiJSON;
  moves: MoveRec[];
  result: Outcome | null;
  ratingChange: [number, number] | null;
  clock: Clock | null;
  /** Remaining time per side in ms at `turnStart`. */
  remaining: [number, number];
  turnStart: number | null;
  serverNow: number;
  drawOffer: 0 | 1 | null;
  rematch: [boolean, boolean];
  disconnectedAt: [number | null, number | null];
  gameNo: number;
}

export type ServerMsg =
  | { t: 'state'; state: RoomState }
  | { t: 'move'; ply: number; mv: MoveRec; remaining: [number, number]; turnStart: number | null; serverNow: number }
  | { t: 'presence'; seats: [SeatView | null, SeatView | null]; disconnectedAt: [number | null, number | null] }
  | { t: 'offer'; kind: 'draw' | 'rematch'; side: 0 | 1 | null; rematch?: [boolean, boolean] }
  | { t: 'emote'; side: 0 | 1 | null; e: string }
  | { t: 'error'; code: ErrorCode }
  | { t: 'pong' };

export type ClientMsg =
  | { t: 'move'; ply: number; m: number }
  | { t: 'resign' }
  | { t: 'draw' }
  | { t: 'decline' }
  | { t: 'rematch' }
  | { t: 'emote'; e: string }
  | { t: 'claim' }
  | { t: 'ping' };

export interface Announcement {
  id: number;
  text: string;
  level: 'info' | 'warn';
  created: number;
  expires: number | null;
}

export interface LobbyStats {
  online: number;
  queued: Record<GameKind, number>;
}

export type LobbyServerMsg =
  | { t: 'hello'; stats: LobbyStats; announcement: Announcement | null }
  | { t: 'stats'; stats: LobbyStats }
  | { t: 'queued'; kind: GameKind }
  | { t: 'matched'; room: string }
  | { t: 'announcement'; announcement: Announcement | null }
  | { t: 'kicked' }
  | { t: 'error'; code: ErrorCode }
  | { t: 'pong' };

export type LobbyClientMsg =
  | { t: 'queue'; kind: GameKind }
  | { t: 'cancel' }
  | { t: 'ping' };

export type ErrorCode =
  | 'banned' | 'not-your-turn' | 'illegal' | 'over' | 'not-player' | 'too-early' | 'bad-request' | 'unauthorized' | 'not-found';

export const EMOTES = ['👍', '😄', '😮', '😢', '🔥', '🤝', '👏', '🤔'];

/** Seconds a player must be gone before the opponent can claim the win. */
export const CLAIM_AFTER_MS = 60_000;
/** After this long disconnected the game is decided automatically. */
export const AUTO_ABANDON_MS = 5 * 60_000;

export const REPORT_REASONS = ['cheating', 'abuse', 'stalling', 'name', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export function cleanName(raw: string): string | null {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const len = [...name].length;
  return len >= 2 && len <= 20 ? name : null;
}

/** Expected-score Elo update. Returns the new ratings. */
export function elo(a: number, b: number, scoreA: number, k = 32): [number, number] {
  const ea = 1 / (1 + 10 ** ((b - a) / 400));
  const delta = Math.round(k * (scoreA - ea));
  return [a + delta, b - delta];
}
