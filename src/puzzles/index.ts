/** Puzzle data and the player's progress. */
import type { XiangqiJSON } from '../engine/xiangqi';
import { store } from '../state';
import data from './puzzles.json';

export type PuzzleKind = 'chess' | 'xiangqi';

export interface Puzzle {
  id: string;
  /** Checkmate in this many moves of the side to move. */
  mate: 1 | 2 | 3;
  start: string | XiangqiJSON;
  /** Solution: attacker, defender, attacker, … (engine move numbers). */
  line: number[];
  pieces: number;
}

export const PUZZLES = data as unknown as Record<PuzzleKind, Puzzle[]>;
export const PUZZLE_KINDS: PuzzleKind[] = ['chess', 'xiangqi'];

export function findPuzzle(id: string): { kind: PuzzleKind; puzzle: Puzzle; index: number } | null {
  for (const kind of PUZZLE_KINDS) {
    const index = PUZZLES[kind].findIndex(p => p.id === id);
    if (index >= 0) return { kind, puzzle: PUZZLES[kind][index], index };
  }
  return null;
}

/** Puzzles of one kind and mate length, in play order. */
export function group(kind: PuzzleKind, mate: 1 | 2 | 3): Puzzle[] {
  return PUZZLES[kind].filter(p => p.mate === mate);
}

/** Stars per solved puzzle: 1–3, or 0 when the solution was revealed. */
type Progress = Record<string, number>;

export function progress(): Progress {
  return store.get<Progress>('puzzles') ?? {};
}

export function solved(id: string): boolean {
  return id in progress();
}

export function stars(id: string): number {
  return progress()[id] ?? 0;
}

/** Keep the best result for a puzzle. */
export function record(id: string, value: number) {
  const p = progress();
  if (!(id in p) || value > p[id]) p[id] = value;
  store.set('puzzles', p);
}

/** Inside each group the first puzzle is open; the next opens when the previous one is done. */
export function unlocked(p: Puzzle, kind: PuzzleKind): boolean {
  const g = group(kind, p.mate);
  const i = g.findIndex(x => x.id === p.id);
  return i <= 0 || solved(g[i - 1].id);
}

/** The next puzzle to play after `id` (same group first, then the next group). */
export function nextPuzzle(id: string): Puzzle | null {
  const f = findPuzzle(id);
  if (!f) return null;
  return PUZZLES[f.kind][f.index + 1] ?? null;
}
