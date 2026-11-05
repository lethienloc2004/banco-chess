/**
 * Chess clock for local games (vs bot / two players on one device).
 * Like most online sites, the clocks start once both sides have made their
 * first move; after that the side to move loses time and gains the increment
 * when it completes a move (Fischer increment).
 */
import { afterMove, timeLeft, type Clock } from './shared/protocol';

export interface ClockState { tc: Clock; remaining: [number, number]; plies: number }

export class GameClock {
  remaining: [number, number];
  plies: number;
  paused = false;
  private running: 0 | 1 | null = null;
  private since = 0;

  constructor(readonly tc: Clock, state?: Omit<ClockState, 'tc'>, sideToMove: 0 | 1 = 0, now = Date.now()) {
    const ms = tc.base * 1000;
    this.remaining = state ? [...state.remaining] : [ms, ms];
    this.plies = state?.plies ?? 0;
    // A resumed game continues from now (time spent away is not counted).
    this.firstSide = (this.plies % 2 === 0 ? sideToMove : sideToMove ^ 1) as 0 | 1;
    if (this.plies >= 2) { this.running = sideToMove; this.since = now; }
  }

  /** Side whose clock is ticking, or null before both have moved / after the game. */
  get active(): 0 | 1 | null {
    return this.running;
  }

  /** Which side made the first move (move counts per side follow from it). */
  private firstSide: 0 | 1;

  private ownMoves(side: 0 | 1, plies: number): number {
    return side === this.firstSide ? Math.ceil(plies / 2) : Math.floor(plies / 2);
  }

  left(side: 0 | 1, now = Date.now()): number {
    const ticking = this.running === side && !this.paused;
    return ticking ? timeLeft(this.tc, this.remaining[side], now - this.since) : this.remaining[side];
  }

  /** The side that has run out of time, if any. */
  flagged(now = Date.now()): 0 | 1 | null {
    return this.running !== null && this.left(this.running, now) <= 0 ? this.running : null;
  }

  /** Call after `side` completed a move; `plies` = number of moves played so far. */
  moved(side: 0 | 1, plies: number, now = Date.now()) {
    if (this.running === side) {
      const elapsed = this.paused ? 0 : now - this.since;
      this.remaining[side] = Math.max(0, afterMove(this.tc, this.remaining[side], elapsed, this.ownMoves(side, plies)));
    }
    this.plies = plies;
    this.running = plies >= 2 ? ((side ^ 1) as 0 | 1) : null;
    this.since = now;
  }

  /** After a take-back: times are kept, the side to move continues. */
  rewind(plies: number, sideToMove: 0 | 1, now = Date.now()) {
    this.settle(now);
    this.plies = plies;
    this.running = plies >= 2 ? sideToMove : null;
    this.since = now;
  }

  pause(now = Date.now()) {
    if (this.paused) return;
    this.settle(now);
    this.paused = true;
  }

  resume(now = Date.now()) {
    if (!this.paused) return;
    this.paused = false;
    this.since = now;
  }

  /** Freeze the clocks (game over). */
  stop(now = Date.now()) {
    this.settle(now);
    this.running = null;
  }

  /** Charge the running side for the time spent so far (pause, take-back, game end). */
  private settle(now: number) {
    if (this.running !== null && !this.paused) {
      this.remaining[this.running] = Math.max(0, timeLeft(this.tc, this.remaining[this.running], now - this.since));
    }
    this.since = now;
  }

  save(now = Date.now()): ClockState {
    const remaining: [number, number] = [this.left(0, now), this.left(1, now)];
    return { tc: this.tc, remaining: [Math.max(0, remaining[0]), Math.max(0, remaining[1])], plies: this.plies };
  }
}
