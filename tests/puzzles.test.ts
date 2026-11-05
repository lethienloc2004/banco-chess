import { describe, expect, it } from 'vitest';
import { Match } from '../src/game';
import { HOLIDAY_PUZZLES, PUZZLES, PUZZLE_KINDS, findPuzzle } from '../src/puzzles';
import { SEASONS, holidayOf, holidayPuzzles } from '../src/shared/quests';
import { isMated, mateMoves } from '../src/puzzles/solver';
import type { SearchPosition } from '../src/engine/types';

// Every puzzle must be a real, unique forced mate. Heavy (mate-in-3), so allow time.
describe('puzzles', () => {
  for (const [set, name] of [[PUZZLES, ''], [HOLIDAY_PUZZLES, 'holiday ']] as const) for (const kind of PUZZLE_KINDS) {
    it(`${name}${kind}: every puzzle is a unique forced mate`, { timeout: 600_000 }, () => {
      expect(set[kind].length).toBeGreaterThan(0);
      const ids = new Set<string>();
      for (const p of set[kind]) {
        expect(ids.has(p.id), p.id).toBe(false);
        ids.add(p.id);
        const match = new Match(kind, p.start);
        const pos = match.pos as unknown as SearchPosition;
        expect(pos.inCheck(), `${p.id} starts in check`).toBe(false);
        // No faster mate, and exactly one first move that works.
        if (p.mate > 1) expect(mateMoves(pos, p.mate - 1).length, `${p.id} has a faster mate`).toBe(0);
        expect(mateMoves(pos, p.mate), `${p.id} first move`).toEqual([p.line[0]]);
        // The stored line is legal and ends in checkmate.
        expect(p.line.length, p.id).toBe(p.mate * 2 - 1);
        for (const m of p.line) {
          expect(match.pos.legalMoves(), `${p.id} illegal move in line`).toContain(m);
          match.play(m);
        }
        expect(isMated(pos), `${p.id} line ends in mate`).toBe(true);
      }
    });
  }

  it('every holiday has six holiday puzzles of its own', () => {
    const all = new Set<string>();
    for (const season of SEASONS) {
      const list = holidayPuzzles(season.id);
      expect(list.length).toBe(6);
      for (const p of list) {
        const f = findPuzzle(p.id);
        expect(f?.holiday, p.id).toBe(true);
        expect(f?.kind).toBe(p.kind);
        expect(f?.puzzle.mate).toBe(p.mate);
        expect(holidayOf(p.id)?.id).toBe(season.id);
        expect(all.has(p.id)).toBe(false);
        all.add(p.id);
      }
    }
    // Holiday positions are new, not copies of the normal puzzles.
    const normal = new Set([...PUZZLES.chess, ...PUZZLES.xiangqi].map(p => JSON.stringify(p.start)));
    for (const kind of PUZZLE_KINDS) for (const p of HOLIDAY_PUZZLES[kind]) expect(normal.has(JSON.stringify(p.start)), p.id).toBe(false);
  });
});
