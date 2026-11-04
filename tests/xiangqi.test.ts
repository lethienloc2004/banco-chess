import { describe, expect, it } from 'vitest';
import { HIDDEN, KING, ROOK, START_TYPE, Xiangqi, isHidden, pieceType } from '../src/engine/xiangqi';
import { rngFloat } from '../src/engine/rand';

const find = (x: Xiangqi, iccs: string) => {
  const m = x.legalMoves().find(m => x.iccs(m) === iccs);
  if (m === undefined) throw new Error('illegal ' + iccs);
  return m;
};

describe('xiangqi', () => {
  it('perft from the start position', () => {
    const x = new Xiangqi();
    // Known values: 44, 1920, 79666.
    expect([1, 2, 3].map(d => x.perft(d))).toEqual([44, 1920, 79666]);
  });

  it('traditional notation', () => {
    const x = new Xiangqi();
    expect(x.notation(find(x, 'h2e2'), 'vi')).toBe('P2-5');
    expect(x.notation(find(x, 'h2e2'), 'en')).toBe('C2=5');
    expect(x.notation(find(x, 'b0c2'), 'vi')).toBe('M8.7');
    x.make(find(x, 'h2e2'));
    expect(x.notation(find(x, 'h7e7'), 'vi')).toBe('P8-5');
    expect(x.notation(find(x, 'a9a8'), 'vi')).toBe('X1.1');
  });

  it('flying general is illegal and stalemate loses', () => {
    // Red general e0, black general d9, red rook on e5 between? Remove blockers.
    const x = Xiangqi.fromJSON({ board: new Array(90).fill(0), side: 0, halfmove: 0, jieqi: false });
    x.board[4] = KING; // red general e0
    x.board[9 * 9 + 3] = KING | 8; // black general d9
    x.board[9 * 2 + 4] = ROOK; // red rook e2 shields the file
    const y = Xiangqi.fromJSON(x.toJSON());
    // King may not step to d0 (faces black general on d-file).
    expect(y.legalMoves().map(m => y.iccs(m))).not.toContain('e0d0');
  });
});

describe('jieqi', () => {
  it('starts with hidden pieces on start squares and moves by position', () => {
    const x = new Xiangqi(true, rngFloat(42));
    let hidden = 0;
    for (let sq = 0; sq < 90; sq++) {
      const p = x.board[sq];
      if (!p) continue;
      expect(START_TYPE[sq]).toBeGreaterThan(0);
      if (pieceType(p) === KING) expect(isHidden(p)).toBe(false);
      else { expect(isHidden(p)).toBe(true); hidden++; }
    }
    expect(hidden).toBe(30);
    expect(x.perft(1)).toBe(44);
  });

  it('reveals on move and restores on unmake', () => {
    const x = new Xiangqi(true, rngFloat(7));
    const before = x.positionKey(), key = x.hash();
    const m = find(x, 'h2e2');
    const piece = x.board[7 + 2 * 9];
    x.make(m);
    expect(x.board[4 + 2 * 9]).toBe(piece & ~HIDDEN);
    expect(x.hash()).toBe(Xiangqi.fromJSON(x.toJSON()).hash());
    x.unmake();
    expect(x.positionKey()).toBe(before);
    expect(x.hash()).toBe(key);
  });

  it('determinize keeps the hidden multiset', () => {
    const x = new Xiangqi(true, rngFloat(3));
    const count = () => Array.from(x.board).filter(isHidden).map(pieceType).sort().join();
    const before = count();
    x.determinize(rngFloat(99));
    expect(count()).toBe(before);
  });

  it('random playouts never crash and keep kings', () => {
    const r = rngFloat(1);
    for (let g = 0; g < 30; g++) {
      const x = new Xiangqi(true, r);
      for (let ply = 0; ply < 200 && !x.outcome(); ply++) {
        const moves = x.legalMoves();
        x.make(moves[Math.floor(r() * moves.length)]);
      }
      expect(Array.from(x.board).filter(p => pieceType(p) === KING).length).toBe(2);
    }
  });
});
