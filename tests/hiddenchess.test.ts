import { describe, expect, it } from 'vitest';
import { BISHOP, Chess, HIDDEN, KING, PAWN, START_TYPE, isHidden, pieceType } from '../src/engine/chess';
import { Match } from '../src/game';
import { rngFloat } from '../src/engine/rand';

const byUci = (c: Chess, u: string) => {
  const m = c.legalMoves().find(x => c.uci(x) === u);
  if (m === undefined) throw new Error('illegal ' + u + ' in ' + c.fen());
  return m;
};

describe('hidden chess', () => {
  it('starts with 30 face-down pieces on start squares and the usual 20 moves', () => {
    const c = new Chess(Chess.hiddenStart(rngFloat(1)));
    let hidden = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      const p = c.board[sq];
      if (!p) continue;
      expect(START_TYPE[sq]).toBeGreaterThan(0);
      if (pieceType(p) === KING) expect(isHidden(p)).toBe(false);
      else { expect(isHidden(p)).toBe(true); hidden++; }
    }
    expect(hidden).toBe(30);
    expect(c.legalMoves().length).toBe(20);
    expect(c.insufficientMaterial()).toBe(false);
  });

  it('reveals a piece when it moves; unmake restores everything; FEN keeps hidden markers', () => {
    const c = new Chess(Chess.hiddenStart(rngFloat(2)));
    const before = c.fen(), key = c.hash();
    const real = c.board[0x14]; // e2
    c.make(byUci(c, 'e2e4'));
    expect(c.board[0x34]).toBe(real & ~HIDDEN);
    expect(new Chess(c.fen()).fen()).toBe(c.fen());
    expect(c.hash()).toBe(new Chess(c.fen()).hash());
    c.unmake();
    expect(c.fen()).toBe(before);
    expect(c.hash()).toBe(key);
  });

  it('en passant only after a real pawn double step', () => {
    // White face-down piece on e2 is really a knight; black pawn on d4.
    const c = new Chess('4k3/8/8/8/3p4/8/4~N3/4K3 w - - 0 1');
    c.make(byUci(c, 'e2e4'));
    expect(c.ep).toBe(-1);
    const d = new Chess('4k3/8/8/8/3p4/8/4~P3/4K3 w - - 0 1');
    d.make(byUci(d, 'e2e4'));
    expect(d.legalMoves().some(m => d.uci(m) === 'd4e3')).toBe(true);
  });

  it('castling with a face-down corner piece reveals it', () => {
    const c = new Chess('4k3/8/8/8/8/8/8/4K2~B w K - 0 1'); // corner piece is really a bishop
    const m = byUci(c, 'e1g1');
    c.make(m);
    expect(pieceType(c.board[5])).toBe(BISHOP); // f1
    expect(isHidden(c.board[5])).toBe(false);
    c.unmake();
    expect(isHidden(c.board[7])).toBe(true);
  });

  it('a pawn revealed on its own back rank steps forward one square', () => {
    const c = new Chess('4k3/8/8/8/8/8/8/1P2K3 w - - 0 1');
    const moves = c.legalMoves().filter(m => (m & 127) === 1).map(m => c.uci(m));
    expect(moves).toEqual(['b1b2']);
    expect(pieceType(c.board[1])).toBe(PAWN);
  });

  it('masked replay with server reveals matches the real game; bot sampling keeps the multiset', () => {
    const start = Chess.hiddenStart(rngFloat(5));
    const real = new Match('hiddenchess', start);
    const log: { m: number; r?: number; c?: number }[] = [];
    const r = rngFloat(9);
    for (let i = 0; i < 80 && !real.outcome(); i++) {
      const ms = real.legalMoves();
      const mv = ms[Math.floor(r() * ms.length)];
      log.push({ m: mv, ...real.revealOf(mv) });
      real.play(mv);
    }
    const replay = Match.restoreRevealed('hiddenchess', new Chess(start).masked(), log);
    expect(replay.moves).toEqual(real.moves);
    expect(replay.notes).toEqual(real.notes);
    expect(replay.captured).toEqual(real.captured);
    const c = new Chess(start);
    const multiset = () => Array.from(c.board).filter(isHidden).map(pieceType).sort().join();
    const before = multiset();
    c.determinize(rngFloat(3));
    expect(multiset()).toBe(before);
  });

  it('random playouts never crash and keep both kings', () => {
    const r = rngFloat(4);
    for (let g = 0; g < 30; g++) {
      const c = new Chess(Chess.hiddenStart(r));
      for (let ply = 0; ply < 200 && c.legalMoves().length && !c.isRuleDraw(); ply++) {
        const ms = c.legalMoves();
        c.make(ms[Math.floor(r() * ms.length)]);
      }
      expect(Array.from(c.board).filter(p => pieceType(p) === KING).length).toBe(2);
    }
  });
});
