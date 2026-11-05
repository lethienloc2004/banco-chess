/**
 * Post-game analysis maths: move quality from evaluation swings and accuracy
 * from winning chances (the formulas Lichess documents for its accuracy).
 */
import { MATE } from './engine/types';

export type Quality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export const QUALITY_MARK: Record<Quality, string> = { best: '✓', good: '', inaccuracy: '?!', mistake: '?', blunder: '??' };

export interface PlyEval {
  /** Evaluation from White/Red's point of view, in centipawns (mates mapped to ±(10000 - plies)). */
  white: number;
  /** Best move in this position, if any. */
  best: number | null;
  pv: number[];
  depth: number;
}

const MATE_BOUND = MATE - 1000;

/** Engine score from the side to move → White/Red's view, mates kept recognisable. */
export function toWhite(score: number, sideToMove: 0 | 1): number {
  const s = Math.abs(score) > MATE_BOUND ? Math.sign(score) * (10000 - (MATE - Math.abs(score))) : score;
  return sideToMove === 0 ? s : -s;
}

export function isMateScore(v: number): boolean {
  return Math.abs(v) > 9000;
}

/** Moves until mate for a White-view score (positive: White mates). */
export function mateIn(v: number): number {
  return Math.sign(v) * Math.max(1, Math.ceil((10000 - Math.abs(v)) / 2));
}

/** Winning chances (0–100) for a centipawn score from the player's own view. */
export function winPercent(cp: number): number {
  const c = Math.max(-1500, Math.min(1500, isMateScore(cp) ? Math.sign(cp) * 1500 : cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/** Accuracy (0–100) of a move that changed the mover's winning chances from `before` to `after`. */
export function moveAccuracy(before: number, after: number): number {
  if (after >= before) return 100;
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * (before - after)) - 3.1669));
}

/** Quality from the evaluation lost by the mover (centipawns, clamped). */
export function classify(beforeMover: number, afterMover: number): Quality {
  const clamp = (v: number) => (isMateScore(v) ? Math.sign(v) * 2000 : Math.max(-2000, Math.min(2000, v)));
  // Keeping a forced mate (or still winning by miles) is never a mistake.
  if (isMateScore(beforeMover) && beforeMover > 0 && afterMover >= 1500) return 'best';
  const loss = clamp(beforeMover) - clamp(afterMover);
  if (loss <= 10) return 'best';
  if (loss <= 40) return 'good';
  if (loss <= 120) return 'inaccuracy';
  if (loss <= 300) return 'mistake';
  return 'blunder';
}

export interface Summary {
  quality: (Quality | null)[];
  accuracy: [number | null, number | null];
  counts: [Record<Quality, number>, Record<Quality, number>];
}

/**
 * evals[i] = evaluation of the position after i moves; move i goes from
 * position i to i+1 and is played by `firstSide` when i is even.
 */
export function summarize(evals: (PlyEval | undefined)[], plies: number, firstSide: 0 | 1): Summary {
  const empty = (): Record<Quality, number> => ({ best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 });
  const counts: [Record<Quality, number>, Record<Quality, number>] = [empty(), empty()];
  const acc: [number[], number[]] = [[], []];
  const quality: (Quality | null)[] = [];
  for (let i = 0; i < plies; i++) {
    const a = evals[i], b = evals[i + 1];
    if (!a || !b) { quality.push(null); continue; }
    const mover = ((firstSide + i) % 2) as 0 | 1;
    const sign = mover === 0 ? 1 : -1;
    const q = classify(a.white * sign, b.white * sign);
    quality.push(q);
    counts[mover][q]++;
    acc[mover].push(moveAccuracy(winPercent(a.white * sign), winPercent(b.white * sign)));
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : null);
  return { quality, accuracy: [mean(acc[0]), mean(acc[1])], counts };
}
