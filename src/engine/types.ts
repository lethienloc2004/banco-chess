/** Shared types for all game engines. Moves are encoded as plain numbers. */

export type GameKind = 'chess' | 'xiangqi' | 'jieqi';

export type WinReason =
  | 'checkmate' | 'stalemate' | 'nomoves' | 'perpetual-check' | 'perpetual-chase'
  | 'resign' | 'timeout' | 'abandon' | 'admin';
export type DrawReason = 'stalemate' | 'fifty' | 'repetition' | 'material' | 'agreement' | 'admin' | 'cancelled';

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
}

export const MATE = 100000;
