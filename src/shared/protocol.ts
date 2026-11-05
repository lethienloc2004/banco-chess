/** Types and constants shared by the browser app and the Cloudflare server. */
import type { GameKind, Outcome } from '../engine/types';
import type { XiangqiJSON } from '../engine/xiangqi';

export type Role = 'user' | 'admin';

/** Elo rating per game: each game has its own rating and leaderboard. */
export type Ratings = Record<GameKind, number>;
export const DEFAULT_RATING = 1200;
/** Rated games needed before a player appears on a leaderboard. */
export const LEADERBOARD_MIN_GAMES = 5;
export const LEADERBOARD_SIZE = 100;

export interface PublicUser {
  id: string;
  name: string;
  ratings: Ratings;
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

/** Who connects to a room or the lobby: the rating used depends on the game. */
export interface Player {
  id: string;
  name: string;
  ratings: Ratings;
}

export interface BoardEntry {
  rank: number;
  id: string;
  name: string;
  rating: number;
  games: number;
  wins: number;
  draws: number;
  peak: number;
}

export interface Leaderboard {
  kind: GameKind;
  entries: BoardEntry[];
  /** The caller's own row (also when outside the top list), null if not ranked yet. */
  me: BoardEntry | null;
  /** Rated games the caller has played in this game (to show progress to ranking). */
  myGames: number;
  /** Ranked players in total. */
  total: number;
  minGames: number;
}

export interface KindStats {
  rating: number;
  games: number;
  wins: number;
  draws: number;
  peak: number;
  /** Position on the leaderboard, null while below the minimum number of games. */
  rank: number | null;
}

export interface ProfileGame {
  id: string;
  kind: GameKind;
  rated: boolean;
  /** Side the profile's player had. */
  side: 0 | 1;
  opponent: { id: string | null; name: string | null };
  winner: 0 | 1 | null;
  reason: string | null;
  ended: number | null;
}

export interface PlayerProfile {
  id: string;
  name: string;
  created: number;
  banned: boolean;
  /** Kept off the leaderboards by an admin. */
  hidden: boolean;
  stats: Record<GameKind, KindStats>;
  recent: ProfileGame[];
}

export interface SeatView extends Seat {
  online: boolean;
}

/**
 * Time control, in seconds.
 * - inc: Fischer increment added after every move.
 * - delay + delayType 'simple' (US delay): the clock waits `delay` seconds each
 *   move before it starts running; unused delay is not banked.
 * - delay + delayType 'bronstein': time used on a move is given back, up to `delay`.
 * - stage: bonus time once a player completes `moves` moves (classical time controls).
 */
export interface Clock {
  base: number;
  inc: number;
  delay?: number;
  delayType?: 'simple' | 'bronstein';
  stage?: { moves: number; add: number };
}

export const CLOCKS: Record<string, Clock | null> = {
  none: null,
  '1+0': { base: 60, inc: 0 },
  '3+2': { base: 180, inc: 2 },
  '5+3': { base: 300, inc: 3 },
  '5d3': { base: 300, inc: 0, delay: 3, delayType: 'simple' },
  '5b3': { base: 300, inc: 0, delay: 3, delayType: 'bronstein' },
  '10+5': { base: 600, inc: 5 },
  '15+10': { base: 900, inc: 10 },
  '30+20': { base: 1800, inc: 20 },
  // FIDE classical: 90 minutes for 40 moves, +30 minutes, 30 s increment from move 1.
  classical: { base: 5400, inc: 30, stage: { moves: 40, add: 1800 } },
};

/** Clock time actually consumed by a move that took `elapsedMs`. */
export function timeUsed(tc: Clock, elapsedMs: number): number {
  return tc.delayType === 'simple' && tc.delay ? Math.max(0, elapsedMs - tc.delay * 1000) : elapsedMs;
}

/** What the mover's clock shows `elapsedMs` into the move. */
export function timeLeft(tc: Clock, remainingMs: number, elapsedMs: number): number {
  return remainingMs - timeUsed(tc, elapsedMs);
}

/**
 * Remaining time after completing a move. `ownMoves` = the mover's move count
 * including this move. A result <= 0 means the flag fell during the move.
 */
export function afterMove(tc: Clock, remainingMs: number, elapsedMs: number, ownMoves: number): number {
  let r = remainingMs - timeUsed(tc, elapsedMs);
  if (r <= 0) return r;
  if (tc.delayType === 'bronstein' && tc.delay) r += Math.min(elapsedMs, tc.delay * 1000);
  r += tc.inc * 1000;
  if (tc.stage && ownMoves === tc.stage.moves) r += tc.stage.add * 1000;
  return r;
}

/** Short label: "5+3", "5 d3", "5 b3", "90/40+30 +30s". */
export function clockLabel(tc: Clock): string {
  const min = (s: number) => (s >= 60 ? String(s / 60) : `${s}s`);
  if (tc.stage) return `${min(tc.base)}/${tc.stage.moves}+${min(tc.stage.add)}${tc.inc ? ` +${tc.inc}s` : ''}`;
  if (tc.delay) return `${min(tc.base)} ${tc.delayType === 'bronstein' ? 'b' : 'd'}${tc.delay}`;
  return `${min(tc.base)}+${tc.inc}`;
}
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
