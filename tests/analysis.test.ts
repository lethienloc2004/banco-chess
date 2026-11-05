import { describe, expect, it } from 'vitest';
import { classify, isMateScore, mateIn, moveAccuracy, summarize, toWhite, winPercent, type PlyEval } from '../src/analysis';
import { MATE } from '../src/engine/types';
import { Match } from '../src/game';

const ev = (white: number): PlyEval => ({ white, best: null, pv: [], depth: 1 });

describe('analysis maths', () => {
  it('converts engine scores to White/Red view, keeping mates', () => {
    expect(toWhite(50, 0)).toBe(50);
    expect(toWhite(50, 1)).toBe(-50);
    const w = toWhite(MATE - 3, 0);
    expect(isMateScore(w)).toBe(true);
    expect(mateIn(w)).toBe(2);
    // Black to move and getting mated in 2 plies: White mates in 1.
    expect(mateIn(toWhite(-(MATE - 2), 1))).toBe(1);
    expect(mateIn(toWhite(MATE - 1, 1))).toBe(-1);
  });

  it('winning chances are symmetric and bounded', () => {
    expect(winPercent(0)).toBeCloseTo(50);
    expect(winPercent(300) + winPercent(-300)).toBeCloseTo(100);
    expect(winPercent(9999)).toBeLessThanOrEqual(100);
    expect(winPercent(-9999)).toBeGreaterThanOrEqual(0);
  });

  it('accuracy is 100 for keeping the advantage and drops with the loss', () => {
    expect(moveAccuracy(60, 70)).toBe(100);
    expect(moveAccuracy(60, 55)).toBeGreaterThan(moveAccuracy(60, 30));
    expect(moveAccuracy(90, 5)).toBeLessThan(10);
  });

  it('classifies by centipawn loss', () => {
    expect(classify(30, 25)).toBe('best');
    expect(classify(30, 0)).toBe('good');
    expect(classify(30, -60)).toBe('inaccuracy');
    expect(classify(30, -200)).toBe('mistake');
    expect(classify(30, -900)).toBe('blunder');
    // Converting a forced mate into a huge material lead is fine.
    expect(classify(9990, 1800)).toBe('best');
    // Walking into a mate is a blunder.
    expect(classify(0, -9990)).toBe('blunder');
  });

  it('summarizes both sides', () => {
    // Black blunders a piece, White later gives some of it back.
    const evals = [ev(20), ev(25), ev(400), ev(390), ev(100), ev(-100)];
    const s = summarize(evals, 5, 0);
    expect(s.quality).toEqual(['best', 'blunder', 'best', 'best', 'mistake']);
    expect(s.counts[1].blunder).toBe(1);
    expect(s.counts[0].mistake).toBe(1);
    expect(s.accuracy[0]!).toBeGreaterThan(s.accuracy[1]!);
    // Missing evaluations leave gaps but do not break the rest.
    const gap = summarize([ev(0), undefined, ev(0)], 2, 0);
    expect(gap.quality).toEqual([null, null]);
    expect(gap.accuracy).toEqual([null, null]);
  });
});

describe('movesWithReveals', () => {
  it('replays a jieqi game exactly, reveals included', () => {
    const m = new Match('jieqi');
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 30 && !m.outcome(); i++) {
      const legal = m.legalMoves();
      m.play(legal[Math.floor(rnd() * legal.length)]);
    }
    const moves = m.movesWithReveals();
    expect(moves.length).toBe(m.moves.length);
    expect(moves.some(x => x.r)).toBe(true);
    const back = Match.restoreRevealed('jieqi', m.initial, moves);
    expect(back.moves).toEqual(m.moves);
    expect(back.notes).toEqual(m.notes);
  });
});
