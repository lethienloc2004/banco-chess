import { describe, expect, it } from 'vitest';
import { GameClock } from '../src/clock';
import { Match } from '../src/game';
import { KING, ROOK } from '../src/engine/xiangqi';

describe('local game clock', () => {
  it('starts after both first moves, adds increment, flags', () => {
    const c = new GameClock({ base: 10, inc: 2 }, undefined, 0, 0);
    expect(c.active).toBeNull();
    c.moved(0, 1, 5_000); // white's first move: no clock yet
    expect(c.active).toBeNull();
    c.moved(1, 2, 9_000); // black's first move: white's clock starts
    expect(c.active).toBe(0);
    expect(c.left(0, 12_000)).toBe(7_000);
    c.moved(0, 3, 12_000); // white spent 3s, gains 2s
    expect(c.remaining[0]).toBe(9_000);
    expect(c.active).toBe(1);
    expect(c.flagged(12_000 + 9_999)).toBeNull();
    expect(c.flagged(12_000 + 10_000)).toBe(1);
  });

  it('pause stops time and resume continues; save/restore keeps times', () => {
    const c = new GameClock({ base: 60, inc: 0 }, { remaining: [30_000, 40_000], plies: 4 }, 0, 0);
    c.pause(5_000);
    expect(c.left(0, 50_000)).toBe(25_000);
    c.resume(50_000);
    expect(c.left(0, 51_000)).toBe(24_000);
    const saved = c.save(51_000);
    expect(saved.remaining).toEqual([24_000, 40_000]);
    const back = new GameClock(saved.tc, saved, 0, 100_000);
    expect(back.left(0, 101_000)).toBe(23_000); // time away is not counted
  });
});

describe('timeout result (FIDE 6.9 / xiangqi)', () => {
  const chess = (fen: string) => new Match('chess', fen);
  it('normally a loss', () => {
    expect(new Match('chess').timeoutResult(0)).toEqual({ winner: 1, reason: 'timeout' });
  });
  it('draw when the opponent has only a king', () => {
    expect(chess('4k3/8/8/8/8/8/8/3QK3 w - - 0 1').timeoutResult(0)).toEqual({ winner: null, reason: 'timeout-material' });
    expect(chess('4k3/8/8/8/8/8/8/3QK3 w - - 0 1').timeoutResult(1)).toEqual({ winner: 0, reason: 'timeout' });
  });
  it('king + knight: draw against a lone king, win if the other side has a piece to block', () => {
    expect(chess('4k3/8/8/8/8/8/8/3NK3 b - - 0 1').timeoutResult(1)).toEqual({ winner: null, reason: 'timeout-material' });
    expect(chess('4k3/4p3/8/8/8/8/8/3NK3 b - - 0 1').timeoutResult(1)).toEqual({ winner: 0, reason: 'timeout' });
  });
  it('bishops on one colour need a blocker the bishops cannot cover', () => {
    // White bishop c1 (dark) vs black bishop f8 (dark): no mate possible.
    expect(chess('5b1k/8/8/8/8/8/8/2B4K b - - 0 1').timeoutResult(1)).toEqual({ winner: null, reason: 'timeout-material' });
    // Black bishop c8 is on light squares: a mate pattern exists.
    expect(chess('2b4k/8/8/8/8/8/8/2B4K b - - 0 1').timeoutResult(1)).toEqual({ winner: 0, reason: 'timeout' });
  });
  it('xiangqi: draw when the opponent has nothing that can attack', () => {
    const board = new Array(90).fill(0);
    board[4] = KING; board[8 * 9] = ROOK; board[9 * 9 + 5] = KING | 8;
    const m = new Match('xiangqi', { board, side: 0, halfmove: 0, jieqi: false });
    expect(m.timeoutResult(0)).toEqual({ winner: null, reason: 'timeout-material' });
    expect(m.timeoutResult(1)).toEqual({ winner: 0, reason: 'timeout' });
  });
});

import { formatClock } from '../src/ui/util';
describe('clock display', () => {
  it('formats minutes and tenths under 10 seconds', () => {
    expect(formatClock(180_000)).toBe('3:00');
    expect(formatClock(179_001)).toBe('3:00');
    expect(formatClock(61_000)).toBe('1:01');
    expect(formatClock(10_000)).toBe('0:10');
    expect(formatClock(2_500)).toBe('0:02.5');
    expect(formatClock(0)).toBe('0:00.0');
    expect(formatClock(-50)).toBe('0:00.0');
  });
});

import { CLOCKS, afterMove, clockLabel, timeLeft } from '../src/shared/protocol';
describe('delay and multi-stage time controls', () => {
  it('US (simple) delay: the first seconds of each move are free and not banked', () => {
    const tc = CLOCKS['5d3']!;
    expect(timeLeft(tc, 60_000, 2_000)).toBe(60_000);
    expect(timeLeft(tc, 60_000, 5_000)).toBe(58_000);
    expect(afterMove(tc, 60_000, 2_000, 10)).toBe(60_000);
    expect(afterMove(tc, 60_000, 5_000, 10)).toBe(58_000);
    expect(afterMove(tc, 1_000, 4_500, 10)).toBeLessThanOrEqual(0); // flag: 1 s + 3 s delay < 4.5 s
  });
  it('Bronstein delay: time used is given back, up to the delay', () => {
    const tc = CLOCKS['5b3']!;
    expect(timeLeft(tc, 60_000, 2_000)).toBe(58_000); // the clock runs normally during the move
    expect(afterMove(tc, 60_000, 2_000, 10)).toBe(60_000);
    expect(afterMove(tc, 60_000, 5_000, 10)).toBe(58_000);
  });
  it('FIDE classical: +30 s every move and +30 min after move 40', () => {
    const tc = CLOCKS.classical!;
    expect(afterMove(tc, 600_000, 60_000, 39)).toBe(570_000);
    expect(afterMove(tc, 600_000, 60_000, 40)).toBe(570_000 + 1_800_000);
    expect(afterMove(tc, 600_000, 60_000, 41)).toBe(570_000);
  });
  it('labels', () => {
    expect(clockLabel(CLOCKS['3+2']!)).toBe('3+2');
    expect(clockLabel(CLOCKS['5d3']!)).toBe('5 d3');
    expect(clockLabel(CLOCKS['5b3']!)).toBe('5 b3');
    expect(clockLabel(CLOCKS.classical!)).toBe('90/40+30 +30s');
  });
  it('local clock applies the move-40 bonus to the right player', () => {
    const c = new GameClock(CLOCKS.classical!, { remaining: [600_000, 600_000], plies: 78 }, 0, 0);
    c.moved(0, 79, 10_000); // white's 40th move
    expect(c.remaining[0]).toBe(600_000 - 10_000 + 30_000 + 1_800_000);
    c.moved(1, 80, 20_000); // black's 40th move
    expect(c.remaining[1]).toBe(600_000 - 10_000 + 30_000 + 1_800_000);
    c.moved(0, 81, 30_000); // white's 41st: no bonus
    expect(c.remaining[0]).toBe(2_420_000 - 10_000 + 30_000);
  });
  it('local clock with US delay does not lose time within the delay', () => {
    const c = new GameClock(CLOCKS['5d3']!, { remaining: [60_000, 60_000], plies: 2 }, 0, 0);
    expect(c.left(0, 2_500)).toBe(60_000);
    expect(c.flagged(60_000 + 2_999)).toBeNull();
    expect(c.flagged(60_000 + 3_001)).toBe(0);
  });
});
