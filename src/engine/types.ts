/** Shared types for all game engines. Moves are encoded as plain numbers. */

/** jieqi = face-down xiangqi; hiddenchess = face-down chess (cờ vua úp). */
export type GameKind = 'chess' | 'xiangqi' | 'jieqi' | 'hiddenchess';

export const isChessKind = (k: GameKind) => k === 'chess' || k === 'hiddenchess';
export const isHiddenKind = (k: GameKind) => k === 'jieqi' || k === 'hiddenchess';

export type WinReason =
  | 'checkmate' | 'stalemate' | 'nomoves' | 'perpetual-check' | 'perpetual-chase'
  | 'resign' | 'timeout' | 'abandon' | 'admin';
export type DrawReason =
  | 'stalemate' | 'fifty' | 'repetition' | 'material' | 'agreement' | 'admin' | 'cancelled'
  /** Flag fell, but the opponent could not have won by any legal sequence. */
  | 'timeout-material';

export type Outcome = { winner: 0 | 1; reason: WinReason } | { winner: null; reason: DrawReason };

/** Minimal interface the alpha-beta search needs. Scores are from the side to move. */
export interface SearchPosition {
  readonly side: number;
  legalMoves(): number[];
  legalCaptures(): number[];
  make(move: number): void;
  unmake(): void;
  inCheck(): boolean;
  evaluate(): number;
  /** MVV-LVA style ordering value; negative for quiet moves. */
  captureOrder(move: number): number;
  /** Score when the side to move has no legal moves (at given ply from root). */
  noMovesScore(ply: number): number;
  /** Draw by rule that the search should respect (fifty-move, bare kings…). */
  isRuleDraw(): boolean;
  /** Cheap position hash for repetition detection inside the search. */
  hash(): number;
  /** Pseudo-legal moves; legality is checked with leftInCheck() after make(). */
  pseudoMoves(): number[];
  pseudoCaptures(): number[];
  /** After make(): the move just made left the mover in check (illegal). */
  leftInCheck(): boolean;
  /** Pass the turn; undone by unmake(). */
  makeNull(): void;
  hasNonPawnMaterial(side: number): boolean;
}

export const MATE = 100000;
