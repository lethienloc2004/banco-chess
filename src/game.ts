/** A match: engine position + move history, independent of the UI. */
import * as C from './engine/chess';
import * as X from './engine/xiangqi';
import type { GameKind, Outcome } from './engine/types';

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

  constructor(kind: GameKind, initial?: string | X.XiangqiJSON) {
    this.kind = kind;
    if (kind === 'chess') {
      this.initial = (initial as string) ?? C.START_FEN;
      this.pos = new C.Chess(this.initial);
    } else {
      const x = initial ? X.Xiangqi.fromJSON(initial as X.XiangqiJSON) : new X.Xiangqi(kind === 'jieqi', secureRandom);
      this.initial = x.toJSON();
      this.pos = x;
    }
    this.keys = [this.pos.positionKey()];
  }

  static restore(s: SavedMatch): Match {
    const m = new Match(s.kind, s.initial);
    for (const mv of s.moves) {
      if (!m.pos.legalMoves().includes(mv)) break;
      m.play(mv);
    }
    return m;
  }

  save(): SavedMatch {
    return { kind: this.kind, initial: this.initial, moves: [...this.moves] };
  }

  get isChess() { return this.kind === 'chess'; }
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
      out.push({ sq, type: p & 7, color: (p >> 3) & 1, hidden: !this.isChess && X.isHidden(p) });
    }
    return out;
  }

  pieceAt(sq: number): PieceView | null {
    const p = this.pos.board[sq];
    if (!p) return null;
    return { sq, type: p & 7, color: (p >> 3) & 1, hidden: !this.isChess && X.isHidden(p) };
  }

  legalMoves(): number[] {
    return this.outcome() ? [] : this.pos.legalMoves();
  }

  checkedKing(): number | null {
    if (!this.pos.inCheck()) return null;
    return this.pos.kings[this.pos.side];
  }

  play(m: number) {
    const pos = this.pos;
    if (pos instanceof C.Chess) {
      const san = pos.san(m);
      this.notes.push({ vi: san, en: san });
      const to = C.moveTo(m);
      const victim = pos.board[to] || (pos.isCapture(m) ? (C.PAWN | ((pos.side ^ 1) << 3)) : 0);
      if (victim) this.captured.push(victim);
    } else {
      this.notes.push({ vi: pos.notation(m, 'vi'), en: pos.notation(m, 'en') });
      const victim = pos.board[X.moveTo(m)];
      if (victim) this.captured.push(victim & ~X.HIDDEN);
    }
    pos.make(m);
    this.moves.push(m);
    this.keys.push(pos.positionKey());
  }

  undo(): boolean {
    if (!this.moves.length) return false;
    const m = this.moves.pop()!;
    this.notes.pop();
    this.keys.pop();
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
    if (this.keys.filter(k => k === key).length >= 3) return { winner: null, reason: 'repetition' };
    return null;
  }

  /** State to hand to the bot (chess: FEN, xiangqi: JSON). */
  botState(): string | X.XiangqiJSON {
    return this.pos instanceof C.Chess ? this.pos.fen() : this.pos.toJSON();
  }

  lastMove(): number | null {
    return this.moves.length ? this.moves[this.moves.length - 1] : null;
  }
}

function secureRandom(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}
