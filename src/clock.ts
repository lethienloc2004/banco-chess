/**
 * Chess clock for local games (vs bot / two players on one device).
 * Like most online sites, the clocks start once both sides have made their
 * first move; after that the side to move loses time and gains the increment
 * when it completes a move (Fischer increment).
 */
import type { Clock } from './shared/protocol';

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
    if (this.plies >= 2) { this.running = sideToMove; this.since = now; }
  }

  /** Side whose clock is ticking, or null before both have moved / after the game. */
  get active(): 0 | 1 | null {
    return this.running;
  }

  left(side: 0 | 1, now = Date.now()): number {
    const ticking = this.running === side && !this.paused;
    return this.remaining[side] - (ticking ? now - this.since : 0);
  }

  /** The side that has run out of time, if any. */
  flagged(now = Date.now()): 0 | 1 | null {
    return this.running !== null && this.left(this.running, now) <= 0 ? this.running : null;
  }

  /** Call after `side` completed a move; `plies` = number of moves played so far. */
  moved(side: 0 | 1, plies: number, now = Date.now()) {
    if (this.running === side) {
      if (!this.paused) this.remaining[side] -= now - this.since;
      this.remaining[side] += this.tc.inc * 1000;
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

  private settle(now: number) {
    if (this.running !== null && !this.paused) {
      this.remaining[this.running] = Math.max(0, this.remaining[this.running] - (now - this.since));
    }
    this.since = now;
  }

  save(now = Date.now()): ClockState {
    const remaining: [number, number] = [this.left(0, now), this.left(1, now)];
    return { tc: this.tc, remaining: [Math.max(0, remaining[0]), Math.max(0, remaining[1])], plies: this.plies };
  }
}
