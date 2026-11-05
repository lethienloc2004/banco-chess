import { describe, expect, it } from 'vitest';
import { Match } from '../src/game';
import { PUZZLES, PUZZLE_KINDS } from '../src/puzzles';
import { isMated, mateMoves } from '../src/puzzles/solver';
import type { SearchPosition } from '../src/engine/types';

// Every puzzle must be a real, unique forced mate. Heavy (mate-in-3), so allow time.
describe('puzzles', () => {
  for (const kind of PUZZLE_KINDS) {
    it(`${kind}: every puzzle is a unique forced mate`, { timeout: 600_000 }, () => {
      expect(PUZZLES[kind].length).toBeGreaterThan(0);
      const ids = new Set<string>();
      for (const p of PUZZLES[kind]) {
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
});
