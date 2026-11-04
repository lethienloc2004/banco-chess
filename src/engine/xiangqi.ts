/**
 * Xiangqi (cờ tướng) and Jieqi (cờ tướng úp) rules engine.
 *
 * Board: 9 files × 10 ranks, sq = rank * 9 + file. Rank 0 is Red's back rank.
 * Red (0) moves first. Piece = type | color << 3 | HIDDEN.
 *
 * Jieqi: every piece except the generals starts face down on a random start
 * square of its own side. A face-down piece moves like the piece that normally
 * starts on its square, and is turned face up after its first move. Revealed
 * advisors and elephants may leave the palace / cross the river.
 */
import { MATE, type Outcome, type SearchPosition } from './types';
import { rng32, shuffle } from './rand';

export const RED = 0;
export const BLACK = 1;
export const KING = 1, ADVISOR = 2, ELEPHANT = 3, HORSE = 4, ROOK = 5, CANNON = 6, PAWN = 7;
export const HIDDEN = 16;

export const pieceType = (p: number) => p & 7;
export const pieceColor = (p: number) => (p >> 3) & 1;
export const isHidden = (p: number) => (p & HIDDEN) !== 0;
const mk = (type: number, color: number) => type | (color << 3);

export const moveFrom = (m: number) => m & 127;
export const moveTo = (m: number) => (m >> 7) & 127;
const encode = (from: number, to: number) => from | (to << 7);

export const fileOf = (sq: number) => sq % 9;
export const rankOf = (sq: number) => (sq / 9) | 0;
const at = (file: number, rank: number) => rank * 9 + file;
const onBoard = (file: number, rank: number) => file >= 0 && file < 9 && rank >= 0 && rank < 10;
const inPalace = (file: number, rank: number, color: number) =>
  file >= 3 && file <= 5 && (color === RED ? rank >= 0 && rank <= 2 : rank >= 7 && rank <= 9);
const ownSide = (rank: number, color: number) => (color === RED ? rank <= 4 : rank >= 5);
const crossed = (rank: number, color: number) => !ownSide(rank, color);

const BACK = [ROOK, HORSE, ELEPHANT, ADVISOR, KING, ADVISOR, ELEPHANT, HORSE, ROOK];
/** Type of the piece that starts on each square in the standard setup (0 = none). */
export const START_TYPE = new Int8Array(90);
for (let f = 0; f < 9; f++) {
  START_TYPE[at(f, 0)] = BACK[f];
  START_TYPE[at(f, 9)] = BACK[f];
}
for (const f of [1, 7]) { START_TYPE[at(f, 2)] = CANNON; START_TYPE[at(f, 7)] = CANNON; }
for (const f of [0, 2, 4, 6, 8]) { START_TYPE[at(f, 3)] = PAWN; START_TYPE[at(f, 6)] = PAWN; }

export const VALUE = [0, 0, 120, 120, 270, 600, 285, 30];

const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const HORSE_D = [[1, 2], [-1, 2], [1, -2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]];

const rnd = rng32(0x5bd1e995);
const Z_PIECE = Int32Array.from({ length: 32 * 90 }, rnd);
const Z_SIDE = rnd();

interface Undo {
  move: number;
  moved: number;
  captured: number;
  halfmove: number;
  key: number;
}

export interface XiangqiJSON {
  board: number[];
  side: number;
  halfmove: number;
  jieqi: boolean;
}

export const NOTATION = {
  vi: { letters: ['', 'Tg', 'S', 'T', 'M', 'X', 'P', 'B'], adv: '.', ret: '/', trav: '-', front: 't', back: 's' },
  en: { letters: ['', 'K', 'A', 'E', 'H', 'R', 'C', 'P'], adv: '+', ret: '-', trav: '=', front: '+', back: '-' },
};

export class Xiangqi implements SearchPosition {
  board = new Int8Array(90);
  side = RED;
  halfmove = 0;
  kings = [4, 85];
  key = 0;
  readonly jieqi: boolean;
  private stack: Undo[] = [];

  constructor(jieqi = false, random: () => number = Math.random) {
    this.jieqi = jieqi;
    for (let sq = 0; sq < 90; sq++) {
      if (START_TYPE[sq]) this.board[sq] = mk(START_TYPE[sq], rankOf(sq) <= 4 ? RED : BLACK);
    }
    if (jieqi) {
      for (const color of [RED, BLACK]) {
        const squares: number[] = [];
        for (let sq = 0; sq < 90; sq++) {
          const p = this.board[sq];
          if (p && pieceColor(p) === color && pieceType(p) !== KING) squares.push(sq);
        }
        const types = shuffle(squares.map(sq => pieceType(this.board[sq])), random);
        squares.forEach((sq, i) => (this.board[sq] = mk(types[i], color) | HIDDEN));
      }
    }
    this.key = this.computeKey();
  }

  static fromJSON(j: XiangqiJSON): Xiangqi {
    const x = new Xiangqi(j.jieqi);
    x.board = Int8Array.from(j.board);
    x.side = j.side;
    x.halfmove = j.halfmove;
    for (let sq = 0; sq < 90; sq++) {
      const p = x.board[sq];
      if (pieceType(p) === KING) x.kings[pieceColor(p)] = sq;
    }
    x.key = x.computeKey();
    return x;
  }

  toJSON(): XiangqiJSON {
    return { board: Array.from(this.board), side: this.side, halfmove: this.halfmove, jieqi: this.jieqi };
  }

  clone(): Xiangqi {
    return Xiangqi.fromJSON(this.toJSON());
  }

  /**
   * Replace the identity of every face-down piece with a random arrangement of
   * the same multiset. The bot searches such samples, so it never relies on
   * the real hidden identities.
   */
  determinize(random: () => number = Math.random) {
    for (const color of [RED, BLACK]) {
      const squares: number[] = [];
      for (let sq = 0; sq < 90; sq++) {
        const p = this.board[sq];
        if (isHidden(p) && pieceColor(p) === color) squares.push(sq);
      }
      const types = shuffle(squares.map(sq => pieceType(this.board[sq])), random);
      squares.forEach((sq, i) => (this.board[sq] = mk(types[i], color) | HIDDEN));
    }
    this.key = this.computeKey();
  }

  private computeKey(): number {
    let k = this.side ? Z_SIDE : 0;
    for (let sq = 0; sq < 90; sq++) if (this.board[sq]) k ^= Z_PIECE[(this.board[sq] & 31) * 90 + sq];
    return k;
  }

  hash(): number {
    return this.key;
  }

  positionKey(): string {
    return String.fromCharCode(...Array.from(this.board, p => 48 + (p & 31))) + this.side;
  }

  /** How the piece on `sq` moves: face-down pieces move like their start square. */
  moveType(sq: number): number {
    const p = this.board[sq];
    return isHidden(p) ? START_TYPE[sq] : pieceType(p);
  }

  /** Face-down pieces and all pieces in plain xiangqi keep palace/river limits. */
  private restricted(p: number): boolean {
    return !this.jieqi || isHidden(p);
  }

  private pseudo(capturesOnly: boolean): number[] {
    const out: number[] = [];
    const b = this.board, us = this.side;
    const add = (from: number, f: number, r: number) => {
      const to = at(f, r);
      const t = b[to];
      if (!t) { if (!capturesOnly) out.push(encode(from, to)); }
      else if (pieceColor(t) !== us) out.push(encode(from, to));
    };
    for (let sq = 0; sq < 90; sq++) {
      const p = b[sq];
      if (!p || pieceColor(p) !== us) continue;
      const f0 = fileOf(sq), r0 = rankOf(sq);
      const restricted = this.restricted(p);
      switch (this.moveType(sq)) {
        case KING:
          for (const [df, dr] of ORTH) {
            const f = f0 + df, r = r0 + dr;
            if (inPalace(f, r, us)) add(sq, f, r);
          }
          break;
        case ADVISOR:
          for (const [df, dr] of DIAG) {
            const f = f0 + df, r = r0 + dr;
            if (!onBoard(f, r) || (restricted && !inPalace(f, r, us))) continue;
            add(sq, f, r);
          }
          break;
        case ELEPHANT:
          for (const [df, dr] of DIAG) {
            const f = f0 + 2 * df, r = r0 + 2 * dr;
            if (!onBoard(f, r) || (restricted && !ownSide(r, us))) continue;
            if (b[at(f0 + df, r0 + dr)]) continue; // elephant eye blocked
            add(sq, f, r);
          }
          break;
        case HORSE:
          for (const [df, dr] of HORSE_D) {
            const f = f0 + df, r = r0 + dr;
            if (!onBoard(f, r)) continue;
            const leg = Math.abs(df) === 2 ? at(f0 + df / 2, r0) : at(f0, r0 + dr / 2);
            if (b[leg]) continue;
            add(sq, f, r);
          }
          break;
        case ROOK:
          for (const [df, dr] of ORTH) {
            for (let f = f0 + df, r = r0 + dr; onBoard(f, r); f += df, r += dr) {
              add(sq, f, r);
              if (b[at(f, r)]) break;
            }
          }
          break;
        case CANNON:
          for (const [df, dr] of ORTH) {
            let screen = false;
            for (let f = f0 + df, r = r0 + dr; onBoard(f, r); f += df, r += dr) {
              const t = b[at(f, r)];
              if (!screen) {
                if (!t) { if (!capturesOnly) out.push(encode(sq, at(f, r))); }
                else screen = true;
              } else if (t) {
                if (pieceColor(t) !== us) out.push(encode(sq, at(f, r)));
                break;
              }
            }
          }
          break;
        case PAWN: {
          const fwd = us === RED ? 1 : -1;
          if (onBoard(f0, r0 + fwd)) add(sq, f0, r0 + fwd);
          if (crossed(r0, us)) {
            if (f0 > 0) add(sq, f0 - 1, r0);
            if (f0 < 8) add(sq, f0 + 1, r0);
          }
          break;
        }
      }
    }
    return out;
  }

  /** Is the square attacked by `by`? Used for general safety (incl. flying general). */
  attacked(target: number, by: number): boolean {
    const b = this.board;
    const tf = fileOf(target), tr = rankOf(target);
    // Lines: chariot, cannon (over one screen), facing generals.
    for (const [df, dr] of ORTH) {
      let screen = false;
      for (let f = tf + df, r = tr + dr; onBoard(f, r); f += df, r += dr) {
        const sq = at(f, r), p = b[sq];
        if (!p) continue;
        if (!screen) {
          if (pieceColor(p) === by) {
            const t = this.moveType(sq);
            if (t === ROOK) return true;
            if (t === KING && df === 0) return true;
            if (t === PAWN && Math.abs(f - tf) + Math.abs(r - tr) === 1 && this.pawnHits(sq, target, by)) return true;
          }
          screen = true;
        } else {
          if (pieceColor(p) === by && this.moveType(sq) === CANNON) return true;
          break;
        }
      }
    }
    // Horses.
    for (const [df, dr] of HORSE_D) {
      const f = tf - df, r = tr - dr; // horse square
      if (!onBoard(f, r)) continue;
      const sq = at(f, r), p = b[sq];
      if (!p || pieceColor(p) !== by || this.moveType(sq) !== HORSE) continue;
      const leg = Math.abs(df) === 2 ? at(f + df / 2, r) : at(f, r + dr / 2);
      if (!b[leg]) return true;
    }
    // Advisors and elephants (only matters for revealed ones in jieqi).
    for (const [df, dr] of DIAG) {
      let f = tf + df, r = tr + dr;
      if (onBoard(f, r)) {
        const sq = at(f, r), p = b[sq];
        if (p && pieceColor(p) === by && this.moveType(sq) === ADVISOR &&
            (!this.restricted(p) || inPalace(tf, tr, by))) return true;
      }
      f = tf + 2 * df; r = tr + 2 * dr;
      if (onBoard(f, r)) {
        const sq = at(f, r), p = b[sq];
        if (p && pieceColor(p) === by && this.moveType(sq) === ELEPHANT && !b[at(tf + df, tr + dr)] &&
            (!this.restricted(p) || ownSide(tr, by))) return true;
      }
    }
    return false;
  }

  private pawnHits(from: number, to: number, color: number): boolean {
    const df = fileOf(to) - fileOf(from), dr = rankOf(to) - rankOf(from);
    if (df === 0) return dr === (color === RED ? 1 : -1);
    return dr === 0 && crossed(rankOf(from), color);
  }

  inCheck(): boolean {
    return this.attacked(this.kings[this.side], this.side ^ 1);
  }

  private filterLegal(moves: number[]): number[] {
    const legal: number[] = [];
    for (const m of moves) {
      this.make(m);
      if (!this.attacked(this.kings[this.side ^ 1], this.side)) legal.push(m);
      this.unmake();
    }
    return legal;
  }

  legalMoves(): number[] {
    return this.filterLegal(this.pseudo(false));
  }

  legalCaptures(): number[] {
    return this.filterLegal(this.pseudo(true));
  }

  make(m: number) {
    const b = this.board, from = moveFrom(m), to = moveTo(m);
    const moved = b[from], captured = b[to];
    this.stack.push({ move: m, moved, captured, halfmove: this.halfmove, key: this.key });
    const placed = moved & ~HIDDEN; // a face-down piece is revealed by moving
    let key = this.key ^ Z_SIDE ^ Z_PIECE[(moved & 31) * 90 + from] ^ Z_PIECE[placed * 90 + to];
    if (captured) key ^= Z_PIECE[(captured & 31) * 90 + to];
    b[to] = placed;
    b[from] = 0;
    if (pieceType(moved) === KING) this.kings[pieceColor(moved)] = to;
    this.halfmove = captured ? 0 : this.halfmove + 1;
    this.side ^= 1;
    this.key = key;
  }

  unmake() {
    const u = this.stack.pop();
    if (!u) return;
    const from = moveFrom(u.move), to = moveTo(u.move);
    this.board[from] = u.moved;
    this.board[to] = u.captured;
    if (pieceType(u.moved) === KING) this.kings[pieceColor(u.moved)] = from;
    this.halfmove = u.halfmove;
    this.key = u.key;
    this.side ^= 1;
  }

  /** Pieces that can ever threaten the enemy general. */
  private hasAttackers(color: number): boolean {
    for (let sq = 0; sq < 90; sq++) {
      const p = this.board[sq];
      if (!p || pieceColor(p) !== color) continue;
      const t = pieceType(p);
      if (isHidden(p) || t >= HORSE) return true;
      if (this.jieqi && (t === ADVISOR || t === ELEPHANT)) return true;
    }
    return false;
  }

  insufficientMaterial(): boolean {
    return !this.hasAttackers(RED) && !this.hasAttackers(BLACK);
  }

  isRuleDraw(): boolean {
    return this.halfmove >= 120 || this.insufficientMaterial();
  }

  outcome(): Outcome | null {
    if (this.legalMoves().length === 0) {
      return { winner: (this.side ^ 1) as 0 | 1, reason: this.inCheck() ? 'checkmate' : 'nomoves' };
    }
    if (this.halfmove >= 120) return { winner: null, reason: 'fifty' };
    if (this.insufficientMaterial()) return { winner: null, reason: 'material' };
    return null;
  }

  noMovesScore(ply: number): number {
    return -MATE + ply; // in xiangqi having no legal move loses, even without check
  }

  private pieceValue(sq: number, hiddenAvg: number[]): number {
    const p = this.board[sq];
    return isHidden(p) ? hiddenAvg[pieceColor(p)] : VALUE[pieceType(p)];
  }

  captureOrder(m: number): number {
    const to = moveTo(m), victim = this.board[to];
    if (!victim) return -1;
    const v = isHidden(victim) ? 250 : VALUE[pieceType(victim)];
    return v * 8 - this.moveType(moveFrom(m));
  }

  evaluate(): number {
    const b = this.board;
    const hiddenSum = [0, 0], hiddenCount = [0, 0];
    for (let sq = 0; sq < 90; sq++) {
      const p = b[sq];
      if (isHidden(p)) { hiddenSum[pieceColor(p)] += VALUE[pieceType(p)]; hiddenCount[pieceColor(p)]++; }
    }
    const hiddenAvg = [0, 1].map(c => (hiddenCount[c] ? hiddenSum[c] / hiddenCount[c] : 0) + 15);
    let score = 0;
    for (let sq = 0; sq < 90; sq++) {
      const p = b[sq];
      if (!p) continue;
      const color = pieceColor(p);
      const f = fileOf(sq);
      const rr = color === RED ? rankOf(sq) : 9 - rankOf(sq); // rank from own back rank
      const centre = 4 - Math.abs(f - 4);
      let v = this.pieceValue(sq, hiddenAvg);
      if (!isHidden(p)) {
        switch (pieceType(p)) {
          case PAWN:
            if (rr >= 5) v += [0, 0, 0, 0, 0, 40, 60, 70, 55, 15][rr] + centre * 3;
            else if (rr === 4) v += 5;
            break;
          case HORSE:
            v += centre * 4 + Math.min(rr, 7) * 3 - (rr === 0 ? 10 : 0);
            break;
          case CANNON:
            v += (f === 4 ? 12 : 0) + centre * 2;
            break;
          case ROOK:
            v += (rr >= 5 ? 10 : 0) + (f === 3 || f === 5 ? 5 : 0);
            break;
          case KING:
            v -= rr * 10;
            break;
        }
      }
      score += color === RED ? v : -v;
    }
    return this.side === RED ? score : -score;
  }

  /** Coordinate notation (ICCS), e.g. h2e2. */
  iccs(m: number): string {
    const s = (sq: number) => 'abcdefghi'[fileOf(sq)] + rankOf(sq);
    return s(moveFrom(m)) + s(moveTo(m));
  }

  /** Traditional notation: "P2-5" (Vietnamese) or "C2=5" (WXF). Call before making the move. */
  notation(m: number, lang: 'vi' | 'en'): string {
    const N = NOTATION[lang];
    const from = moveFrom(m), to = moveTo(m);
    const p = this.board[from], us = pieceColor(p), type = this.moveType(from);
    const fileNo = (sq: number) => (us === RED ? 9 - fileOf(sq) : fileOf(sq) + 1);
    const fwd = us === RED ? 1 : -1;
    // Same kind of piece on the same file → front/back marker instead of file number.
    const same: number[] = [];
    for (let r = 0; r < 10; r++) {
      const sq = at(fileOf(from), r), q = this.board[sq];
      if (q && pieceColor(q) === us && this.moveType(sq) === type) same.push(sq);
    }
    let head = N.letters[type];
    if (same.length >= 2 && type !== KING && type !== ADVISOR && type !== ELEPHANT) {
      same.sort((a, b) => (rankOf(b) - rankOf(a)) * fwd);
      const marker = same[0] === from ? N.front : same[same.length - 1] === from ? N.back : String(same.indexOf(from) + 1);
      head = lang === 'vi' ? head + marker : marker + head;
    } else {
      head += fileNo(from);
    }
    const dr = (rankOf(to) - rankOf(from)) * fwd;
    let tail: string;
    if (dr === 0) tail = N.trav + fileNo(to);
    else {
      const sym = dr > 0 ? N.adv : N.ret;
      const straight = type === KING || type === ROOK || type === CANNON || type === PAWN;
      tail = sym + (straight ? Math.abs(dr) : fileNo(to));
    }
    let s = head + tail;
    if (isHidden(p)) s += '→' + N.letters[pieceType(p)];
    return s;
  }

  perft(depth: number): number {
    if (depth === 0) return 1;
    const moves = this.legalMoves();
    if (depth === 1) return moves.length;
    let n = 0;
    for (const m of moves) { this.make(m); n += this.perft(depth - 1); this.unmake(); }
    return n;
  }
}
