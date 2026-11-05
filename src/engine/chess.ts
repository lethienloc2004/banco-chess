/**
 * Chess rules engine (0x88 board) with make/unmake, legal move generation,
 * SAN notation, FEN import/export and a simple evaluation for the bot.
 */
import { MATE, type Outcome, type SearchPosition } from './types';
import { rng32 } from './rand';

export const WHITE = 0;
export const BLACK = 1;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;

export const pieceType = (p: number) => p & 7;
export const pieceColor = (p: number) => (p >> 3) & 1;
/** Face-down piece (hidden chess): moves like the piece that starts on its square. */
export const HIDDEN = 16;
export const isHidden = (p: number) => (p & HIDDEN) !== 0;
const mk = (type: number, color: number) => type | (color << 3);

const F_CAPTURE = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8;
const NULL_MOVE = -1;

export const moveFrom = (m: number) => m & 127;
export const moveTo = (m: number) => (m >> 7) & 127;
export const movePromo = (m: number) => (m >> 14) & 7;
const moveFlags = (m: number) => (m >> 17) & 15;
const encode = (from: number, to: number, promo: number, flags: number) =>
  from | (to << 7) | (promo << 14) | (flags << 17);

export const sqFile = (sq: number) => sq & 7;
export const sqRank = (sq: number) => sq >> 4;
export const sqName = (sq: number) => 'abcdefgh'[sq & 7] + (sqRank(sq) + 1);

const KNIGHT_D = [33, 31, 18, 14, -33, -31, -18, -14];
const KING_D = [1, -1, 16, -16, 15, 17, -15, -17];
const DIAG_D = [15, 17, -15, -17];
const ORTH_D = [1, -1, 16, -16];

export const VALUE = [0, 100, 320, 330, 500, 900, 0];
const LETTER = ['', '', 'N', 'B', 'R', 'Q', 'K'];
const FEN_CHARS = ' pnbrqk';

/** Type of the piece that starts on each square of the standard setup (0 = none). */
export const START_TYPE = new Int8Array(128);
['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'].forEach((c, f) => {
  START_TYPE[f] = START_TYPE[112 + f] = ' pnbrqk'.indexOf(c);
  START_TYPE[16 + f] = START_TYPE[96 + f] = 1;
});

// Castling rights: 1 = white O-O, 2 = white O-O-O, 4 = black O-O, 8 = black O-O-O.
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[4] = 15 & ~3;
CASTLE_MASK[7] = 15 & ~1;
CASTLE_MASK[0] = 15 & ~2;
CASTLE_MASK[116] = 15 & ~12;
CASTLE_MASK[119] = 15 & ~4;
CASTLE_MASK[112] = 15 & ~8;

// Zobrist keys (32-bit).
const rnd = rng32(0x9e3779b9);
const Z_PIECE = Int32Array.from({ length: 32 * 128 }, rnd);
const Z_CASTLE = Int32Array.from({ length: 16 }, rnd);
const Z_EP = Int32Array.from({ length: 8 }, rnd);
const Z_SIDE = rnd();

// Piece-square tables from white's point of view, rank 8 first.
// Based on Tomasz Michniewski's "Simplified Evaluation Function"
// (https://www.chessprogramming.org/Simplified_Evaluation_Function).
// prettier-ignore
const PST: number[][] = [
  [],
  [ 0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
    0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0 ],
  [ -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
    -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50 ],
  [ -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
    -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20 ],
  [ 0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
    -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0 ],
  [ -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
    0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20 ],
  [ -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20 ],
];
// prettier-ignore
const KING_END = [ -50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30,
  -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50 ];

interface Undo {
  move: number;
  /** The moving piece before the move (it may have been face down). */
  moved: number;
  /** The corner piece moved by castling, before the move. */
  rook: number;
  captured: number;
  castling: number;
  ep: number;
  halfmove: number;
  key: number;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export class Chess implements SearchPosition {
  board = new Int8Array(128);
  side = WHITE;
  castling = 0;
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings = [4, 116];
  key = 0;
  private stack: Undo[] = [];

  constructor(fen = START_FEN) {
    this.load(fen);
  }

  load(fen: string) {
    const [placement, side, castle, ep, half, full] = fen.trim().split(/\s+/);
    this.board.fill(0);
    let rank = 7, file = 0;
    let hidden = false;
    for (const ch of placement) {
      if (ch === '/') { rank--; file = 0; continue; }
      if (ch === '~') { hidden = true; continue; } // "~N": face-down piece whose real identity is N
      if (/\d/.test(ch)) { file += Number(ch); continue; }
      const type = FEN_CHARS.indexOf(ch.toLowerCase());
      if (type <= 0) throw new Error('Bad FEN: ' + fen);
      const color = ch === ch.toUpperCase() ? WHITE : BLACK;
      const sq = rank * 16 + file;
      this.board[sq] = mk(type, color) | (hidden ? HIDDEN : 0);
      hidden = false;
      if (type === KING) this.kings[color] = sq;
      file++;
    }
    this.side = side === 'b' ? BLACK : WHITE;
    this.castling = 0;
    if (castle && castle !== '-') {
      if (castle.includes('K')) this.castling |= 1;
      if (castle.includes('Q')) this.castling |= 2;
      if (castle.includes('k')) this.castling |= 4;
      if (castle.includes('q')) this.castling |= 8;
    }
    this.ep = ep && ep !== '-' ? (Number(ep[1]) - 1) * 16 + 'abcdefgh'.indexOf(ep[0]) : -1;
    this.halfmove = Number(half ?? 0) || 0;
    this.fullmove = Number(full ?? 1) || 1;
    this.stack = [];
    this.key = this.computeKey();
  }

  fen(): string {
    return `${this.positionKey()} ${this.halfmove} ${this.fullmove}`;
  }

  /** FEN without move counters. */
  positionKey(): string {
    return this.placementKey(true);
  }

  private placementKey(withEp: boolean): string {
    let s = '';
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const p = this.board[rank * 16 + file];
        if (!p) { empty++; continue; }
        if (empty) { s += empty; empty = 0; }
        const ch = FEN_CHARS[pieceType(p)];
        s += (isHidden(p) ? '~' : '') + (pieceColor(p) === WHITE ? ch.toUpperCase() : ch);
      }
      if (empty) s += empty;
      if (rank) s += '/';
    }
    let c = '';
    if (this.castling & 1) c += 'K';
    if (this.castling & 2) c += 'Q';
    if (this.castling & 4) c += 'k';
    if (this.castling & 8) c += 'q';
    return `${s} ${this.side ? 'b' : 'w'} ${c || '-'} ${withEp && this.ep >= 0 ? sqName(this.ep) : '-'}`;
  }

  clone(): Chess {
    const c = new Chess(this.fen());
    return c;
  }

  private computeKey(): number {
    let k = 0;
    for (let sq = 0; sq < 128; sq++) if (!(sq & 0x88) && this.board[sq]) k ^= Z_PIECE[this.board[sq] * 128 + sq];
    k ^= Z_CASTLE[this.castling];
    if (this.ep >= 0) k ^= Z_EP[this.ep & 7];
    if (this.side) k ^= Z_SIDE;
    return k;
  }

  hash(): number {
    return this.key;
  }

  /** How the piece on `sq` moves: face-down pieces move like their start square. */
  moveType(sq: number): number {
    const p = this.board[sq];
    return isHidden(p) ? START_TYPE[sq] : pieceType(p);
  }

  /** Real identity of a face-down piece, filled in when a server reveals it. */
  setHiddenType(sq: number, type: number) {
    const p = this.board[sq];
    if (!isHidden(p)) return;
    const q = mk(type, pieceColor(p)) | HIDDEN;
    this.key ^= Z_PIECE[p * 128 + sq] ^ Z_PIECE[q * 128 + sq];
    this.board[sq] = q;
  }

  /** FEN where face-down pieces only show their start-square type (what players may know). */
  masked(): string {
    const c = new Chess(this.fen());
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      if (isHidden(c.board[sq])) c.board[sq] = mk(START_TYPE[sq], pieceColor(c.board[sq])) | HIDDEN;
    }
    return c.fen();
  }

  /** Shuffle the identities of face-down pieces (same multiset): the bot samples, never peeks. */
  determinize(random: () => number = Math.random) {
    for (const color of [WHITE, BLACK]) {
      const squares: number[] = [];
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = this.board[sq];
        if (isHidden(p) && pieceColor(p) === color) squares.push(sq);
      }
      const types = squares.map(sq => pieceType(this.board[sq]));
      for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
      squares.forEach((sq, i) => (this.board[sq] = mk(types[i], color) | HIDDEN));
    }
    this.key = this.computeKey();
  }

  /** Hidden chess start: every piece but the kings face down, shuffled on its own side's start squares. */
  static hiddenStart(random: () => number = Math.random): string {
    const c = new Chess();
    for (const color of [WHITE, BLACK]) {
      const squares: number[] = [];
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = c.board[sq];
        if (p && pieceColor(p) === color && pieceType(p) !== KING) squares.push(sq);
      }
      const types = squares.map(sq => pieceType(c.board[sq]));
      for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
      squares.forEach((sq, i) => (c.board[sq] = mk(types[i], color) | HIDDEN));
    }
    return c.fen();
  }

  attacked(sq: number, by: number): boolean {
    const b = this.board;
    // Attacker of colour `by` on t that moves like `type` (face-down pieces move like their square).
    const is = (t: number, type: number) => {
      const p = b[t];
      return p !== 0 && pieceColor(p) === by && (isHidden(p) ? START_TYPE[t] : pieceType(p)) === type;
    };
    if (by === WHITE) {
      if (!((sq - 15) & 0x88) && is(sq - 15, PAWN)) return true;
      if (!((sq - 17) & 0x88) && is(sq - 17, PAWN)) return true;
    } else {
      if (!((sq + 15) & 0x88) && is(sq + 15, PAWN)) return true;
      if (!((sq + 17) & 0x88) && is(sq + 17, PAWN)) return true;
    }
    for (const d of KNIGHT_D) { const t = sq + d; if (!(t & 0x88) && is(t, KNIGHT)) return true; }
    for (const d of KING_D) { const t = sq + d; if (!(t & 0x88) && is(t, KING)) return true; }
    for (const d of DIAG_D) {
      for (let t = sq + d; !(t & 0x88); t += d) {
        if (!b[t]) continue;
        if (is(t, BISHOP) || is(t, QUEEN)) return true;
        break;
      }
    }
    for (const d of ORTH_D) {
      for (let t = sq + d; !(t & 0x88); t += d) {
        if (!b[t]) continue;
        if (is(t, ROOK) || is(t, QUEEN)) return true;
        break;
      }
    }
    return false;
  }

  inCheck(): boolean {
    return this.attacked(this.kings[this.side], this.side ^ 1);
  }

  /** Pseudo-legal moves (may leave the own king in check); for the search. */
  pseudoMoves(): number[] {
    return this.pseudo(false);
  }

  pseudoCaptures(): number[] {
    return this.pseudo(true);
  }

  /** After make(): did that move leave the mover's own king attacked (illegal)? */
  leftInCheck(): boolean {
    return this.attacked(this.kings[this.side ^ 1], this.side);
  }

  /** Pass the turn (null-move pruning). Undo with unmake(). */
  makeNull() {
    this.stack.push({ move: NULL_MOVE, moved: 0, rook: 0, captured: 0, castling: this.castling, ep: this.ep, halfmove: this.halfmove, key: this.key });
    let key = this.key ^ Z_SIDE;
    if (this.ep >= 0) key ^= Z_EP[this.ep & 7];
    this.ep = -1;
    this.side ^= 1;
    this.key = key;
  }

  /** Knights, bishops, rooks or queens left (null move is unsafe without them: zugzwang). */
  hasNonPawnMaterial(side: number): boolean {
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.board[sq];
      if (p && pieceColor(p) === side && (isHidden(p) || (pieceType(p) >= KNIGHT && pieceType(p) <= QUEEN))) return true;
    }
    return false;
  }

  private pseudo(capturesOnly: boolean): number[] {
    const out: number[] = [];
    const b = this.board, us = this.side, them = us ^ 1;
    const push = (from: number, to: number, flags: number) => out.push(encode(from, to, 0, flags));
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p || pieceColor(p) !== us) continue;
      const type = isHidden(p) ? START_TYPE[sq] : pieceType(p);
      if (type === PAWN) {
        const dir = us === WHITE ? 16 : -16;
        const promoRank = us === WHITE ? 6 : 1;
        const startRank = us === WHITE ? 1 : 6;
        const promo = sqRank(sq) === promoRank;
        const fwd = sq + dir;
        if (!(fwd & 0x88) && !b[fwd]) {
          if (promo) {
            out.push(encode(sq, fwd, QUEEN, 0));
            if (!capturesOnly) for (const pr of [ROOK, BISHOP, KNIGHT]) out.push(encode(sq, fwd, pr, 0));
          } else if (!capturesOnly) {
            push(sq, fwd, 0);
            if (sqRank(sq) === startRank && !b[fwd + dir]) push(sq, fwd + dir, F_DOUBLE);
          }
        }
        for (const d of [dir - 1, dir + 1]) {
          const t = sq + d;
          if (t & 0x88) continue;
          if (b[t] && pieceColor(b[t]) === them) {
            if (promo) for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(encode(sq, t, pr, F_CAPTURE));
            else push(sq, t, F_CAPTURE);
          } else if (t === this.ep) push(sq, t, F_CAPTURE | F_EP);
        }
      } else if (type === KNIGHT || type === KING) {
        for (const d of type === KNIGHT ? KNIGHT_D : KING_D) {
          const t = sq + d;
          if (t & 0x88) continue;
          if (!b[t]) { if (!capturesOnly) push(sq, t, 0); }
          else if (pieceColor(b[t]) === them) push(sq, t, F_CAPTURE);
        }
      } else {
        const dirs = type === BISHOP ? DIAG_D : type === ROOK ? ORTH_D : KING_D;
        for (const d of dirs) {
          for (let t = sq + d; !(t & 0x88); t += d) {
            if (!b[t]) { if (!capturesOnly) push(sq, t, 0); continue; }
            if (pieceColor(b[t]) === them) push(sq, t, F_CAPTURE);
            break;
          }
        }
      }
    }
    if (!capturesOnly) this.castles(out);
    return out;
  }

  private castles(out: number[]) {
    const b = this.board, us = this.side, them = us ^ 1;
    const base = us === WHITE ? 0 : 112;
    const king = base + 4;
    if (b[king] !== mk(KING, us)) return;
    const kRight = us === WHITE ? 1 : 4, qRight = us === WHITE ? 2 : 8;
    // The corner piece must move like a rook: a rook, or a face-down piece on its start square.
    const rookAt = (sq: number) => b[sq] === mk(ROOK, us) || (isHidden(b[sq]) && pieceColor(b[sq]) === us && START_TYPE[sq] === ROOK);
    if (this.castling & kRight && !b[base + 5] && !b[base + 6] && rookAt(base + 7) &&
        !this.attacked(king, them) && !this.attacked(base + 5, them) && !this.attacked(base + 6, them)) {
      out.push(encode(king, base + 6, 0, F_CASTLE));
    }
    if (this.castling & qRight && !b[base + 1] && !b[base + 2] && !b[base + 3] && rookAt(base) &&
        !this.attacked(king, them) && !this.attacked(base + 3, them) && !this.attacked(base + 2, them)) {
      out.push(encode(king, base + 2, 0, F_CASTLE));
    }
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
    const b = this.board;
    const from = moveFrom(m), to = moveTo(m), flags = moveFlags(m), promo = movePromo(m);
    const p = b[from], us = this.side;
    const dir = us === WHITE ? 16 : -16;
    let captured = b[to];
    this.stack.push({ move: m, moved: p, rook: 0, captured: 0, castling: this.castling, ep: this.ep, halfmove: this.halfmove, key: this.key });
    let key = this.key ^ Z_CASTLE[this.castling] ^ Z_SIDE;
    if (this.ep >= 0) key ^= Z_EP[this.ep & 7];

    if (flags & F_EP) {
      const capSq = to - dir;
      captured = b[capSq];
      b[capSq] = 0;
      key ^= Z_PIECE[captured * 128 + capSq];
    } else if (captured) {
      key ^= Z_PIECE[captured * 128 + to];
    }
    this.stack[this.stack.length - 1].captured = captured;

    const placed = promo ? mk(promo, us) : p & ~HIDDEN; // a face-down piece is revealed by moving
    b[from] = 0;
    b[to] = placed;
    key ^= Z_PIECE[p * 128 + from] ^ Z_PIECE[placed * 128 + to];

    if (flags & F_CASTLE) {
      const [rf, rt] = to > from ? [from + 3, from + 1] : [from - 4, from - 1];
      const r = b[rf], rr = r & ~HIDDEN;
      this.stack[this.stack.length - 1].rook = r;
      b[rt] = rr;
      b[rf] = 0;
      key ^= Z_PIECE[r * 128 + rf] ^ Z_PIECE[rr * 128 + rt];
    }
    if (pieceType(p) === KING) this.kings[us] = to;

    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    // En passant only when the piece that made the double step really is a pawn.
    this.ep = flags & F_DOUBLE && pieceType(p) === PAWN ? from + dir : -1;
    // Pawn moves, captures and reveals cannot be undone: reset the 50-move counter.
    this.halfmove = pieceType(p) === PAWN || captured || isHidden(p) ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.side = us ^ 1;
    key ^= Z_CASTLE[this.castling];
    if (this.ep >= 0) key ^= Z_EP[this.ep & 7];
    this.key = key;
  }

  unmake() {
    const u = this.stack.pop();
    if (!u) return;
    if (u.move === NULL_MOVE) {
      this.side ^= 1;
      this.ep = u.ep;
      this.halfmove = u.halfmove;
      this.key = u.key;
      return;
    }
    const b = this.board;
    this.side ^= 1;
    const us = this.side;
    const m = u.move, from = moveFrom(m), to = moveTo(m), flags = moveFlags(m);
    const p = u.moved;
    b[from] = p;
    if (flags & F_EP) {
      b[to] = 0;
      b[to - (us === WHITE ? 16 : -16)] = u.captured;
    } else {
      b[to] = u.captured;
    }
    if (flags & F_CASTLE) {
      const [rf, rt] = to > from ? [from + 3, from + 1] : [from - 4, from - 1];
      b[rf] = u.rook;
      b[rt] = 0;
    }
    if (pieceType(p) === KING) this.kings[us] = from;
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.key = u.key;
    if (us === BLACK) this.fullmove--;
  }

  /**
   * Dead positions by material: K vs K, K+minor vs K, and any number of
   * bishops (either side) that all stand on squares of the same colour.
   */
  insufficientMaterial(): boolean {
    let knights = 0, bishops = 0;
    const bishopColours = new Set<number>();
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.board[sq];
      const t = pieceType(p);
      if (!t || t === KING) continue;
      if (isHidden(p)) return false; // could be anything
      if (t === KNIGHT) knights++;
      else if (t === BISHOP) { bishops++; bishopColours.add((sqFile(sq) + sqRank(sq)) & 1); }
      else return false;
    }
    if (knights + bishops <= 1) return true;
    return knights === 0 && bishopColours.size === 1;
  }

  /**
   * Could `color` still checkmate by some legal sequence (FIDE 6.9, used when
   * the opponent's flag falls)? Same approximation as major chess sites:
   * a lone king never can; king + one knight, or king + bishops all on one
   * square colour, can only mate if the other side has pieces that can block.
   */
  canWin(color: number): boolean {
    const mine: { t: number; shade: number }[] = [];
    const theirs: { t: number; shade: number }[] = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.board[sq];
      const t = pieceType(p);
      if (!t || t === KING) continue;
      if (isHidden(p) && pieceColor(p) === color) return true; // could be a queen
      // An unknown enemy piece counts as a possible blocker (t = 0).
      (pieceColor(p) === color ? mine : theirs).push({ t: isHidden(p) ? 0 : t, shade: (sqFile(sq) + sqRank(sq)) & 1 });
    }
    if (!mine.length) return false;
    if (mine.some(p => p.t === PAWN || p.t === ROOK || p.t === QUEEN)) return true;
    const knights = mine.filter(p => p.t === KNIGHT).length;
    const shades = new Set(mine.filter(p => p.t === BISHOP).map(p => p.shade));
    if (knights === 1 && shades.size === 0) return theirs.length > 0;
    if (knights === 0 && shades.size === 1) return theirs.some(p => p.t !== BISHOP || !shades.has(p.shade));
    return true;
  }

  /** True when the side to move can legally capture en passant right now. */
  private epCapturable(): boolean {
    if (this.ep < 0) return false;
    return this.legalMoves().some(m => (moveFlags(m) & F_EP) !== 0);
  }

  /**
   * Key for threefold repetition (FIDE): same pieces, side to move, castling
   * rights, and en passant only when such a capture is actually possible.
   */
  repetitionKey(): string {
    return this.placementKey(this.epCapturable());
  }

  isRuleDraw(): boolean {
    return this.halfmove >= 100 || this.insufficientMaterial();
  }

  /** Result ignoring repetition (the game controller tracks that). */
  outcome(): Outcome | null {
    if (this.legalMoves().length === 0) {
      return this.inCheck() ? { winner: (this.side ^ 1) as 0 | 1, reason: 'checkmate' } : { winner: null, reason: 'stalemate' };
    }
    if (this.halfmove >= 100) return { winner: null, reason: 'fifty' };
    if (this.insufficientMaterial()) return { winner: null, reason: 'material' };
    return null;
  }

  noMovesScore(ply: number): number {
    return this.inCheck() ? -MATE + ply : 0;
  }

  captureOrder(m: number): number {
    const flags = moveFlags(m);
    const promo = movePromo(m);
    if (!(flags & F_CAPTURE) && !promo) return -1;
    const target = this.board[moveTo(m)];
    const worth = flags & F_EP ? VALUE[PAWN] : isHidden(target) ? 330 : VALUE[pieceType(target)];
    const attacker = this.moveType(moveFrom(m));
    return worth * 8 - attacker + (promo ? VALUE[promo] : 0);
  }

  evaluate(): number {
    const b = this.board;
    let mg = 0, eg = 0, phase = 0;
    // Pawn files per side, for pawn structure and open files.
    const pawnFiles = [new Int8Array(8), new Int8Array(8)];
    const bishops = [0, 0];
    const hiddenSum = [0, 0], hiddenCount = [0, 0];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (pieceType(p) === PAWN && !isHidden(p)) pawnFiles[pieceColor(p)][sqFile(sq)]++;
      if (isHidden(p)) { hiddenSum[pieceColor(p)] += VALUE[pieceType(p)]; hiddenCount[pieceColor(p)]++; }
    }
    // Face-down pieces are worth the average of what is still hidden on that side.
    const hiddenAvg = [0, 1].map(c => (hiddenCount[c] ? hiddenSum[c] / hiddenCount[c] : 0));
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p) continue;
      const type = pieceType(p), color = pieceColor(p), them = color ^ 1;
      if (isHidden(p)) {
        const v = hiddenAvg[color] + 10;
        mg += color === WHITE ? v : -v;
        eg += color === WHITE ? v : -v;
        phase += hiddenAvg[color];
        continue;
      }
      const file = sqFile(sq), rank = sqRank(sq);
      const idx = color === WHITE ? (7 - rank) * 8 + file : rank * 8 + file;
      const sign = color === WHITE ? 1 : -1;
      let m = 0, e = 0;
      switch (type) {
        case KING: {
          m += PST[KING][idx];
          e += KING_END[idx];
          // Pawn shield in front of a castled king (middlegame only).
          const fwd = color === WHITE ? 16 : -16;
          if ((color === WHITE ? rank <= 1 : rank >= 6) && (file <= 2 || file >= 5)) {
            for (const d of [-1, 0, 1]) {
              const t1 = sq + fwd + d, t2 = sq + 2 * fwd + d;
              if (!(t1 & 0x88) && b[t1] === mk(PAWN, color)) m += 12;
              else if (!(t2 & 0x88) && b[t2] === mk(PAWN, color)) m += 6;
              else m -= 10;
            }
          }
          break;
        }
        case PAWN: {
          m += VALUE[PAWN] + PST[PAWN][idx];
          e += VALUE[PAWN] + 10 + PST[PAWN][idx];
          const own = pawnFiles[color];
          if (own[file] > 1) { m -= 10; e -= 20; } // doubled
          if ((file === 0 || !own[file - 1]) && (file === 7 || !own[file + 1])) { m -= 12; e -= 15; } // isolated
          // Passed pawn: no enemy pawn ahead on this or adjacent files.
          let passed = true;
          const dir = color === WHITE ? 16 : -16;
          for (let t = sq + dir; !(t & 0x88) && passed; t += dir) {
            for (const d of [-1, 0, 1]) {
              const x = t + d;
              if (!(x & 0x88) && b[x] === mk(PAWN, them)) { passed = false; break; }
            }
          }
          if (passed) {
            const adv = color === WHITE ? rank : 7 - rank;
            m += [0, 5, 8, 15, 25, 45, 70, 0][adv];
            e += [0, 10, 18, 30, 50, 80, 120, 0][adv];
          }
          break;
        }
        case KNIGHT: case BISHOP: case ROOK: case QUEEN: {
          m += VALUE[type] + PST[type][idx];
          e += VALUE[type] + PST[type][idx];
          phase += VALUE[type];
          // Mobility: squares the piece attacks that are not occupied by own pieces.
          let mob = 0;
          if (type === KNIGHT) {
            for (const d of KNIGHT_D) { const t = sq + d; if (!(t & 0x88) && (!b[t] || pieceColor(b[t]) === them)) mob++; }
            m += (mob - 4) * 4; e += (mob - 4) * 4;
          } else {
            const dirs = type === BISHOP ? DIAG_D : type === ROOK ? ORTH_D : KING_D;
            for (const d of dirs) {
              for (let t = sq + d; !(t & 0x88); t += d) {
                if (!b[t]) { mob++; continue; }
                if (pieceColor(b[t]) === them) mob++;
                break;
              }
            }
            const w = type === BISHOP ? [4, 5] : type === ROOK ? [2, 4] : [1, 2];
            const base = type === BISHOP ? 6 : type === ROOK ? 7 : 13;
            m += (mob - base) * w[0]; e += (mob - base) * w[1];
          }
          if (type === BISHOP) bishops[color]++;
          if (type === ROOK) {
            if (!pawnFiles[color][file]) { const open = !pawnFiles[them][file]; m += open ? 22 : 10; e += open ? 12 : 6; }
            if ((color === WHITE ? rank === 6 : rank === 1)) { m += 15; e += 25; } // rook on the 7th
          }
          break;
        }
      }
      mg += sign * m;
      eg += sign * e;
    }
    for (const c of [WHITE, BLACK]) if (bishops[c] >= 2) { const sign = c === WHITE ? 1 : -1; mg += sign * 30; eg += sign * 50; }
    // phase: 1 = full middlegame material, 0 = bare endgame.
    const t = Math.min(1, phase / 6200);
    const score = Math.round(mg * t + eg * (1 - t));
    // Small bonus for having the move.
    return (this.side === WHITE ? score : -score) + 10;
  }

  isCapture(m: number): boolean {
    return (moveFlags(m) & F_CAPTURE) !== 0;
  }

  isCastle(m: number): boolean {
    return (moveFlags(m) & F_CASTLE) !== 0;
  }

  /** Standard Algebraic Notation for a legal move in the current position. */
  san(m: number, legal: number[] = this.legalMoves()): string {
    const from = moveFrom(m), to = moveTo(m), flags = moveFlags(m), promo = movePromo(m);
    const moving = this.board[from];
    const type = this.moveType(from);
    let s: string;
    if (flags & F_CASTLE) {
      s = to > from ? 'O-O' : 'O-O-O';
    } else if (type === PAWN) {
      s = (flags & F_CAPTURE ? 'abcdefgh'[sqFile(from)] + 'x' : '') + sqName(to) + (promo ? '=' + LETTER[promo] : '');
    } else {
      const others = legal.filter(o => o !== m && moveTo(o) === to && this.moveType(moveFrom(o)) === type);
      let dis = '';
      if (others.length) {
        const sameFile = others.some(o => sqFile(moveFrom(o)) === sqFile(from));
        const sameRank = others.some(o => sqRank(moveFrom(o)) === sqRank(from));
        if (!sameFile) dis = 'abcdefgh'[sqFile(from)];
        else if (!sameRank) dis = String(sqRank(from) + 1);
        else dis = sqName(from);
      }
      s = LETTER[type] + dis + (flags & F_CAPTURE ? 'x' : '') + sqName(to);
    }
    this.make(m);
    if (this.inCheck()) s += this.legalMoves().length ? '+' : '#';
    this.unmake();
    // Hidden chess: show what the piece turned out to be.
    if (isHidden(moving)) s += '→' + (LETTER[pieceType(moving)] || 'P');
    return s;
  }

  uci(m: number): string {
    return sqName(moveFrom(m)) + sqName(moveTo(m)) + (movePromo(m) ? FEN_CHARS[movePromo(m)] : '');
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
