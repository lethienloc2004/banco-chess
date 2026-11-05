/** A match: engine position + move history, independent of the UI. */
import * as C from './engine/chess';
import * as X from './engine/xiangqi';
import { isChessKind, type GameKind, type Outcome } from './engine/types';

export interface Cell { file: number; rank: number }

export interface PieceView {
  sq: number;
  type: number;
  color: number;
  hidden: boolean;
}

export interface SavedMatch {
  kind: GameKind;
  initial: string | X.XiangqiJSON;
  moves: number[];
}

/** Identities a server reveals with a jieqi move: the moving piece and/or the captured one. */
export interface Reveal { r?: number; c?: number }

export class Match {
  readonly kind: GameKind;
  readonly initial: string | X.XiangqiJSON;
  pos: C.Chess | X.Xiangqi;
  moves: number[] = [];
  /** Notation per move, both languages. */
  notes: { vi: string; en: string }[] = [];
  /** Captured pieces in order (piece code incl. colour, revealed). */
  captured: number[] = [];
  private keys: string[] = [];
  /** Per move: did it give check / did it start chasing an unprotected piece (xiangqi). */
  private checks: boolean[] = [];
  private chases: boolean[] = [];
  private readonly startSide: number;

  constructor(kind: GameKind, initial?: string | X.XiangqiJSON) {
    this.kind = kind;
    if (isChessKind(kind)) {
      this.initial = (initial as string) ?? (kind === 'hiddenchess' ? C.Chess.hiddenStart(secureRandom) : C.START_FEN);
      this.pos = new C.Chess(this.initial);
    } else {
      const x = initial ? X.Xiangqi.fromJSON(initial as X.XiangqiJSON) : new X.Xiangqi(kind === 'jieqi', secureRandom);
      this.initial = x.toJSON();
      this.pos = x;
    }
    this.startSide = this.pos.side;
    this.keys = [this.repetitionKey()];
  }

  static restore(s: SavedMatch): Match {
    const m = new Match(s.kind, s.initial);
    for (const mv of s.moves) {
      if (!m.pos.legalMoves().includes(mv)) break;
      m.play(mv);
    }
    return m;
  }

  /** Replay a game whose hidden pieces are only known through server reveals. */
  static restoreRevealed(kind: GameKind, initial: string | X.XiangqiJSON, moves: { m: number; r?: number; c?: number }[]): Match {
    const match = new Match(kind, initial);
    for (const mv of moves) {
      if (!match.pos.legalMoves().includes(mv.m)) break;
      match.playRevealed(mv.m, mv);
    }
    return match;
  }

  private repetitionKey(): string {
    return this.pos instanceof C.Chess ? this.pos.repetitionKey() : this.pos.positionKey();
  }

  save(): SavedMatch {
    return { kind: this.kind, initial: this.initial, moves: [...this.moves] };
  }

  get isChess() { return isChessKind(this.kind); }
  get side(): number { return this.pos.side; }
  get width() { return this.isChess ? 8 : 9; }
  get height() { return this.isChess ? 8 : 10; }

  cellOf(sq: number): Cell {
    return this.isChess ? { file: sq & 7, rank: sq >> 4 } : { file: sq % 9, rank: (sq / 9) | 0 };
  }

  sqOf(c: Cell): number {
    return this.isChess ? c.rank * 16 + c.file : c.rank * 9 + c.file;
  }

  moveFrom(m: number) { return this.isChess ? C.moveFrom(m) : X.moveFrom(m); }
  moveTo(m: number) { return this.isChess ? C.moveTo(m) : X.moveTo(m); }
  movePromo(m: number) { return this.isChess ? C.movePromo(m) : 0; }

  pieces(): PieceView[] {
    const out: PieceView[] = [];
    const b = this.pos.board;
    for (let sq = 0; sq < b.length; sq++) {
      const p = b[sq];
      if (!p || (this.isChess && sq & 0x88)) continue;
      out.push({ sq, type: p & 7, color: (p >> 3) & 1, hidden: (p & 16) !== 0 });
    }
    return out;
  }

  pieceAt(sq: number): PieceView | null {
    const p = this.pos.board[sq];
    if (!p) return null;
    return { sq, type: p & 7, color: (p >> 3) & 1, hidden: (p & 16) !== 0 };
  }

  legalMoves(): number[] {
    return this.outcome() ? [] : this.pos.legalMoves();
  }

  checkedKing(): number | null {
    if (!this.pos.inCheck()) return null;
    return this.pos.kings[this.pos.side];
  }

  /** What a move reveals in jieqi (real identities of hidden mover / victim). */
  revealOf(m: number): Reveal {
    const b = this.pos.board, from = this.moveFrom(m), to = this.moveTo(m);
    const out: Reveal = {};
    if (b[from] & 16) out.r = b[from] & 7;
    if (b[to] && b[to] & 16) out.c = b[to] & 7;
    return out;
  }

  /** Apply a move after filling in identities revealed by the server. */
  playRevealed(m: number, reveal: Reveal) {
    if (reveal.r) this.pos.setHiddenType(this.moveFrom(m), reveal.r);
    if (reveal.c) this.pos.setHiddenType(this.moveTo(m), reveal.c);
    this.play(m);
  }

  play(m: number) {
    const pos = this.pos;
    let chase = false;
    if (pos instanceof C.Chess) {
      const san = pos.san(m);
      this.notes.push({ vi: san, en: san });
      const to = C.moveTo(m);
      const victim = pos.board[to] || (pos.isCapture(m) ? (C.PAWN | ((pos.side ^ 1) << 3)) : 0);
      if (victim) this.captured.push(victim & ~C.HIDDEN);
    } else {
      this.notes.push({ vi: pos.notation(m, 'vi'), en: pos.notation(m, 'en') });
      const victim = pos.board[X.moveTo(m)];
      if (victim) this.captured.push(victim & ~X.HIDDEN);
      chase = isChase(pos, m);
    }
    pos.make(m);
    this.moves.push(m);
    this.checks.push(pos.inCheck());
    this.chases.push(chase);
    this.keys.push(this.repetitionKey());
  }

  undo(): boolean {
    if (!this.moves.length) return false;
    const m = this.moves.pop()!;
    this.notes.pop();
    this.keys.pop();
    this.checks.pop();
    this.chases.pop();
    this.pos.unmake();
    // Recompute whether the undone move captured something.
    const victim = this.isChess
      ? (this.pos as C.Chess).isCapture(m)
      : !!this.pos.board[X.moveTo(m)];
    if (victim) this.captured.pop();
    return true;
  }

  outcome(): Outcome | null {
    const o = this.pos.outcome();
    if (o) return o;
    const key = this.keys[this.keys.length - 1];
    const seen: number[] = [];
    this.keys.forEach((k, i) => { if (k === key) seen.push(i); });
    if (seen.length < 3) return null;
    if (this.isChess) return { winner: null, reason: 'repetition' };
    return this.repetitionVerdict(seen[seen.length - 3], this.keys.length - 1);
  }

  /**
   * Asian xiangqi rules (simplified): in a repeated cycle, a side that checks
   * on every move loses ("chiếu dai"); otherwise a side that chases an
   * unprotected piece (or checks) on every move loses ("đuổi dai").
   * If both or neither side violates, the game is drawn.
   */
  private repetitionVerdict(start: number, end: number): Outcome {
    const perpetualCheck = [true, true];
    const perpetualChase = [true, true];
    const moved = [0, 0];
    for (let j = start; j < end; j++) {
      const side = (this.startSide + j) % 2;
      moved[side]++;
      if (!this.checks[j]) perpetualCheck[side] = false;
      if (!this.checks[j] && !this.chases[j]) perpetualChase[side] = false;
    }
    for (const s of [0, 1]) if (!moved[s]) { perpetualCheck[s] = false; perpetualChase[s] = false; }
    if (perpetualCheck[0] !== perpetualCheck[1]) {
      return { winner: perpetualCheck[0] ? 1 : 0, reason: 'perpetual-check' };
    }
    if (!perpetualCheck[0]) {
      const chase = [perpetualChase[0], perpetualChase[1]];
      if (chase[0] !== chase[1]) return { winner: chase[0] ? 1 : 0, reason: 'perpetual-chase' };
    }
    return { winner: null, reason: 'repetition' };
  }

  /**
   * Result when `loser` runs out of time: a loss, unless the opponent could
   * not have won by any legal sequence of moves, which is a draw (FIDE 6.9;
   * in xiangqi: the opponent has no attacking pieces left).
   */
  timeoutResult(loser: 0 | 1): Outcome {
    const winner = (loser ^ 1) as 0 | 1;
    const canWin = this.pos instanceof C.Chess ? this.pos.canWin(winner) : this.pos.hasAttackers(winner);
    return canWin ? { winner, reason: 'timeout' } : { winner: null, reason: 'timeout-material' };
  }

  /** The moves with the identities they revealed (for analysis and replays of hidden variants). */
  movesWithReveals(): ({ m: number } & Reveal)[] {
    const replay = new Match(this.kind, this.initial);
    const out: ({ m: number } & Reveal)[] = [];
    for (const m of this.moves) {
      out.push({ m, ...replay.revealOf(m) });
      replay.play(m);
    }
    return out;
  }

  /** State to hand to the bot (chess: FEN, xiangqi: JSON). */
  botState(): string | X.XiangqiJSON {
    return this.pos instanceof C.Chess ? this.pos.fen() : this.pos.toJSON();
  }

  lastMove(): number | null {
    return this.moves.length ? this.moves[this.moves.length - 1] : null;
  }
}

/**
 * Does this move make the moving piece newly attack an enemy piece that is
 * unprotected (or worth more than the attacker)? Generals and soldiers may
 * chase freely, and soldiers/generals are not counted as chased.
 */
function isChase(pos: X.Xiangqi, m: number): boolean {
  const from = X.moveFrom(m), to = X.moveTo(m);
  const moverType = pos.moveType(from);
  if (moverType === X.KING || moverType === X.PAWN) return false;
  const before = new Set(pos.genFrom(from, true).map(X.moveTo));
  pos.make(m);
  let chase = false;
  const attacker = X.pieceType(pos.board[to]);
  if (attacker !== X.KING && attacker !== X.PAWN) {
    for (const mv of pos.genFrom(to, true)) {
      const t = X.moveTo(mv);
      if (before.has(t)) continue;
      const victim = pos.board[t];
      const vt = X.pieceType(victim);
      if (vt === X.KING || vt === X.PAWN) continue;
      const protectedBy = pos.attacked(t, X.pieceColor(victim));
      const worth = X.isHidden(victim) ? 250 : X.VALUE[vt];
      if (!protectedBy || worth > X.VALUE[attacker]) { chase = true; break; }
    }
  }
  pos.unmake();
  return chase;
}

function secureRandom(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}
