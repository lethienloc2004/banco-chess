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
export const pieceColor = (p: number) => p >> 3;
const mk = (type: number, color: number) => type | (color << 3);

const F_CAPTURE = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8;

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
const Z_PIECE = Int32Array.from({ length: 16 * 128 }, rnd);
const Z_CASTLE = Int32Array.from({ length: 16 }, rnd);
const Z_EP = Int32Array.from({ length: 8 }, rnd);
const Z_SIDE = rnd();

// Piece-square tables from white's point of view, rank 8 first.
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
    for (const ch of placement) {
      if (ch === '/') { rank--; file = 0; continue; }
      if (/\d/.test(ch)) { file += Number(ch); continue; }
      const type = FEN_CHARS.indexOf(ch.toLowerCase());
      if (type <= 0) throw new Error('Bad FEN: ' + fen);
      const color = ch === ch.toUpperCase() ? WHITE : BLACK;
      const sq = rank * 16 + file;
      this.board[sq] = mk(type, color);
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

  /** FEN without move counters: identical positions share a key. */
  positionKey(): string {
    let s = '';
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const p = this.board[rank * 16 + file];
        if (!p) { empty++; continue; }
        if (empty) { s += empty; empty = 0; }
        const ch = FEN_CHARS[pieceType(p)];
        s += pieceColor(p) === WHITE ? ch.toUpperCase() : ch;
      }
      if (empty) s += empty;
      if (rank) s += '/';
    }
    let c = '';
    if (this.castling & 1) c += 'K';
    if (this.castling & 2) c += 'Q';
    if (this.castling & 4) c += 'k';
    if (this.castling & 8) c += 'q';
    return `${s} ${this.side ? 'b' : 'w'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'}`;
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

  attacked(sq: number, by: number): boolean {
    const b = this.board;
    if (by === WHITE) {
      if (!((sq - 15) & 0x88) && b[sq - 15] === mk(PAWN, WHITE)) return true;
      if (!((sq - 17) & 0x88) && b[sq - 17] === mk(PAWN, WHITE)) return true;
    } else {
      if (!((sq + 15) & 0x88) && b[sq + 15] === mk(PAWN, BLACK)) return true;
      if (!((sq + 17) & 0x88) && b[sq + 17] === mk(PAWN, BLACK)) return true;
    }
    const knight = mk(KNIGHT, by), king = mk(KING, by);
    for (const d of KNIGHT_D) { const t = sq + d; if (!(t & 0x88) && b[t] === knight) return true; }
    for (const d of KING_D) { const t = sq + d; if (!(t & 0x88) && b[t] === king) return true; }
    const bishop = mk(BISHOP, by), rook = mk(ROOK, by), queen = mk(QUEEN, by);
    for (const d of DIAG_D) {
      for (let t = sq + d; !(t & 0x88); t += d) {
        const p = b[t];
        if (!p) continue;
        if (p === bishop || p === queen) return true;
        break;
      }
    }
    for (const d of ORTH_D) {
      for (let t = sq + d; !(t & 0x88); t += d) {
        const p = b[t];
        if (!p) continue;
        if (p === rook || p === queen) return true;
        break;
      }
    }
    return false;
  }

  inCheck(): boolean {
    return this.attacked(this.kings[this.side], this.side ^ 1);
  }

  private pseudo(capturesOnly: boolean): number[] {
    const out: number[] = [];
    const b = this.board, us = this.side, them = us ^ 1;
    const push = (from: number, to: number, flags: number) => out.push(encode(from, to, 0, flags));
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p || pieceColor(p) !== us) continue;
      const type = pieceType(p);
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
    const rook = mk(ROOK, us);
    if (this.castling & kRight && !b[base + 5] && !b[base + 6] && b[base + 7] === rook &&
        !this.attacked(king, them) && !this.attacked(base + 5, them) && !this.attacked(base + 6, them)) {
      out.push(encode(king, base + 6, 0, F_CASTLE));
    }
    if (this.castling & qRight && !b[base + 1] && !b[base + 2] && !b[base + 3] && b[base] === rook &&
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
    this.stack.push({ move: m, captured: 0, castling: this.castling, ep: this.ep, halfmove: this.halfmove, key: this.key });
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

    const placed = promo ? mk(promo, us) : p;
    b[from] = 0;
    b[to] = placed;
    key ^= Z_PIECE[p * 128 + from] ^ Z_PIECE[placed * 128 + to];

    if (flags & F_CASTLE) {
      const [rf, rt] = to > from ? [from + 3, from + 1] : [from - 4, from - 1];
      const r = b[rf];
      b[rt] = r;
      b[rf] = 0;
      key ^= Z_PIECE[r * 128 + rf] ^ Z_PIECE[r * 128 + rt];
    }
    if (pieceType(p) === KING) this.kings[us] = to;

    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.ep = flags & F_DOUBLE ? from + dir : -1;
    this.halfmove = pieceType(p) === PAWN || captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.side = us ^ 1;
    key ^= Z_CASTLE[this.castling];
    if (this.ep >= 0) key ^= Z_EP[this.ep & 7];
    this.key = key;
  }

  unmake() {
    const u = this.stack.pop();
    if (!u) return;
    const b = this.board;
    this.side ^= 1;
    const us = this.side;
    const m = u.move, from = moveFrom(m), to = moveTo(m), flags = moveFlags(m);
    const p = movePromo(m) ? mk(PAWN, us) : b[to];
    b[from] = p;
    if (flags & F_EP) {
      b[to] = 0;
      b[to - (us === WHITE ? 16 : -16)] = u.captured;
    } else {
      b[to] = u.captured;
    }
    if (flags & F_CASTLE) {
      const [rf, rt] = to > from ? [from + 3, from + 1] : [from - 4, from - 1];
      b[rf] = b[rt];
      b[rt] = 0;
    }
    if (pieceType(p) === KING) this.kings[us] = from;
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.key = u.key;
    if (us === BLACK) this.fullmove--;
  }

  insufficientMaterial(): boolean {
    let minors = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const t = pieceType(this.board[sq]);
      if (!t || t === KING) continue;
      if (t === KNIGHT || t === BISHOP) { if (++minors > 1) return false; }
      else return false;
    }
    return true;
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
    const victim = flags & F_EP ? PAWN : pieceType(this.board[moveTo(m)]);
    const attacker = pieceType(this.board[moveFrom(m)]);
    return VALUE[victim] * 8 - attacker + (promo ? VALUE[promo] : 0);
  }

  evaluate(): number {
    let mg = 0, eg = 0, phase = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.board[sq];
      if (!p) continue;
      const type = pieceType(p), color = pieceColor(p);
      const idx = color === WHITE ? (7 - sqRank(sq)) * 8 + sqFile(sq) : sqRank(sq) * 8 + sqFile(sq);
      const sign = color === WHITE ? 1 : -1;
      if (type === KING) {
        mg += sign * PST[KING][idx];
        eg += sign * KING_END[idx];
      } else {
        const v = VALUE[type] + PST[type][idx];
        mg += sign * v;
        eg += sign * v;
        if (type !== PAWN) phase += VALUE[type];
      }
    }
    // phase: 1 = full middlegame material, 0 = bare endgame.
    const t = Math.min(1, phase / 6200);
    const score = Math.round(mg * t + eg * (1 - t));
    return this.side === WHITE ? score : -score;
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
    const type = pieceType(this.board[from]);
    let s: string;
    if (flags & F_CASTLE) {
      s = to > from ? 'O-O' : 'O-O-O';
    } else if (type === PAWN) {
      s = (flags & F_CAPTURE ? 'abcdefgh'[sqFile(from)] + 'x' : '') + sqName(to) + (promo ? '=' + LETTER[promo] : '');
    } else {
      const others = legal.filter(o => o !== m && moveTo(o) === to && pieceType(this.board[moveFrom(o)]) === type);
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
