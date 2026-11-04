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
