import { describe, expect, it } from 'vitest';
import { Match } from '../src/game';
import { Xiangqi, KING, ROOK, HIDDEN, isHidden, pieceType } from '../src/engine/xiangqi';
import { rngFloat } from '../src/engine/rand';

const byIccs = (m: Match, s: string) => {
  const x = m.pos as Xiangqi;
  const mv = x.legalMoves().find(v => x.iccs(v) === s);
  if (mv === undefined) throw new Error('illegal ' + s);
  return mv;
};

describe('xiangqi repetition rules', () => {
  it('perpetual check loses', () => {
    const board = new Array(90).fill(0);
    board[4] = KING; // red general e0
    board[8 * 9 + 0] = ROOK; // red chariot a8
    board[9 * 9 + 5] = KING | 8; // black general f9
    const m = new Match('xiangqi', { board, side: 0, halfmove: 0, jieqi: false });
    for (let i = 0; i < 2; i++) for (const s of ['a8a9', 'f9f8', 'a9a8', 'f8f9']) m.play(byIccs(m, s));
    expect(m.outcome()).toEqual({ winner: 1, reason: 'perpetual-check' });
  });

  it('plain repetition is a draw', () => {
    const m = new Match('xiangqi');
    for (let i = 0; i < 2; i++) for (const s of ['b0c2', 'b9c7', 'c2b0', 'c7b9']) m.play(byIccs(m, s));
    expect(m.outcome()).toEqual({ winner: null, reason: 'repetition' });
  });
});

describe('jieqi with server reveals', () => {
  it('a masked replay matches the real game', () => {
    const real = new Match('jieqi', new Xiangqi(true, rngFloat(11)).toJSON());
    const masked = new Xiangqi(true, rngFloat(11));
    const maskedJSON = masked.masked();
    // The masked view must not leak identities: hidden pieces show their start type.
    const realBoard = (real.pos as Xiangqi).board;
    let differs = 0;
    maskedJSON.board.forEach((p, sq) => { if (isHidden(p) && pieceType(p) !== pieceType(realBoard[sq])) differs++; });
    expect(differs).toBeGreaterThan(0);

    const log: { m: number; r?: number; c?: number }[] = [];
    const r = rngFloat(5);
    for (let i = 0; i < 60 && !real.outcome(); i++) {
      const moves = real.legalMoves();
      const mv = moves[Math.floor(r() * moves.length)];
      log.push({ m: mv, ...real.revealOf(mv) });
      real.play(mv);
    }
    const replay = Match.restoreRevealed('jieqi', maskedJSON, log);
    expect(replay.moves).toEqual(real.moves);
    expect(replay.notes).toEqual(real.notes);
    expect(replay.captured).toEqual(real.captured);
    // Revealed pieces agree; still-hidden ones stay masked.
    const a = (real.pos as Xiangqi).board, b = (replay.pos as Xiangqi).board;
    for (let sq = 0; sq < 90; sq++) {
      if (isHidden(a[sq])) expect(isHidden(b[sq])).toBe(true);
      else expect(b[sq]).toBe(a[sq]);
    }
    expect(HIDDEN).toBe(16);
  });
});
