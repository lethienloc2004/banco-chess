import { describe, expect, it } from 'vitest';
import { Chess, START_FEN } from '../src/engine/chess';

// Reference perft counts from the Chess Programming Wiki.
const CASES: [string, string, number[]][] = [
  ['start', START_FEN, [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];

describe('chess perft', () => {
  for (const [name, fen, counts] of CASES) {
    it(name, () => {
      const c = new Chess(fen);
      counts.forEach((n, i) => expect(c.perft(i + 1)).toBe(n));
      expect(c.fen()).toBe(new Chess(fen).fen());
    });
  }
});

describe('chess notation and outcomes', () => {
  it('SAN with check and mate', () => {
    const c = new Chess();
    const play = (san: string) => {
      const m = c.legalMoves().find(x => c.san(x) === san);
      expect(m, san).toBeDefined();
      c.make(m!);
    };
    ['f3', 'e5', 'g4'].forEach(play);
    expect(c.legalMoves().map(m => c.san(m))).toContain('Qh4#');
    play('Qh4#');
    expect(c.outcome()).toEqual({ winner: 1, reason: 'checkmate' });
  });

  it('stalemate and insufficient material', () => {
    expect(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').outcome()).toEqual({ winner: null, reason: 'stalemate' });
    expect(new Chess('8/8/4k3/8/8/2B5/4K3/8 w - - 0 1').outcome()).toEqual({ winner: null, reason: 'material' });
  });

  it('hash is restored by unmake and matches recomputation', () => {
    const c = new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const before = c.hash();
    for (const m of c.legalMoves()) {
      c.make(m);
      expect(c.hash()).toBe(new Chess(c.fen()).hash());
      c.unmake();
      expect(c.hash()).toBe(before);
    }
  });
});

describe('draw rules', () => {
  it('bishops on same-coloured squares are a dead draw, opposite colours are not', () => {
    // White bishop c1 (dark), black bishop f8 (dark).
    expect(new Chess('5b1k/8/8/8/8/8/8/2B4K w - - 0 1').outcome()).toEqual({ winner: null, reason: 'material' });
    // White bishop c1 (dark), black bishop c8 (light).
    expect(new Chess('2b4k/8/8/8/8/8/8/2B4K w - - 0 1').outcome()).toBeNull();
    // Two knights are not automatically drawn.
    expect(new Chess('7k/8/8/8/8/8/8/1NN4K w - - 0 1').outcome()).toBeNull();
  });

  it('repetition key ignores an en passant square that cannot be used', () => {
    const a = new Chess('4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1'); // no black pawn can take
    const b = new Chess('4k3/8/8/8/4P3/8/8/4K3 b - - 0 1');
    expect(a.repetitionKey()).toBe(b.repetitionKey());
    const c = new Chess('4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1'); // d4 pawn can take on e3
    const d = new Chess('4k3/8/8/8/3pP3/8/8/4K3 b - - 0 1');
    expect(c.repetitionKey()).not.toBe(d.repetitionKey());
  });
});
