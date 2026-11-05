import { describe, expect, it } from 'vitest';
import { chooseMove } from '../src/engine/ai';
import { Chess } from '../src/engine/chess';
import { Xiangqi } from '../src/engine/xiangqi';
import { rngFloat } from '../src/engine/rand';

describe('bot', () => {
  it('chess: finds mate in one', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 4';
    const c = new Chess(fen);
    for (const level of ['medium', 'hard'] as const) {
      const m = chooseMove({ kind: 'chess', state: fen, level });
      expect(c.san(m)).toBe('Qxf7#');
    }
  });

  it('chess: takes a hanging queen', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/4p1q1/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq - 0 3';
    const c = new Chess(fen);
    expect(c.san(chooseMove({ kind: 'chess', state: fen, level: 'medium' }))).toBe('Bxg5');
  });

  it('xiangqi: captures an undefended chariot', () => {
    const x = new Xiangqi();
    // Move black chariot a9 to a3-ish square attacked by red cannon? Simpler: put black rook in front of red rook.
    const j = x.toJSON();
    j.board[9 * 5 + 0] = j.board[9 * 9 + 0]; // black chariot a9 -> a5
    j.board[9 * 9 + 0] = 0;
    j.board[9 * 3 + 0] = 0; // remove red pawn a3 so red chariot sees a5
    const y = Xiangqi.fromJSON(j);
    const m = chooseMove({ kind: 'xiangqi', state: j, level: 'medium' });
    expect(y.iccs(m)).toBe('a0a5');
  });

  it('jieqi: returns a legal move quickly at every level', () => {
    const x = new Xiangqi(true, rngFloat(5));
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const t = Date.now();
      const m = chooseMove({ kind: 'jieqi', state: x.toJSON(), level });
      expect(x.legalMoves()).toContain(m);
      expect(Date.now() - t).toBeLessThan(5000);
    }
  });
});

describe('hidden chess bot', () => {
  it('returns a legal move at every level without seeing hidden pieces', async () => {
    const { Chess } = await import('../src/engine/chess');
    const fen = Chess.hiddenStart(rngFloat(8));
    const c = new Chess(fen);
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const t = Date.now();
      const m = chooseMove({ kind: 'hiddenchess', state: fen, level });
      expect(c.legalMoves()).toContain(m);
      expect(Date.now() - t).toBeLessThan(5000);
    }
  });
});
