/** Puzzle data and the player's progress. */
import type { XiangqiJSON } from '../engine/xiangqi';
import { store } from '../state';
import data from './puzzles.json';
import holiday from './holiday.json';
import { addDays, dayKey, holidayOf, holidayPuzzles } from '../shared/quests';

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
/** Holiday puzzles: played from the quests screen during an event, for coins. */
export const HOLIDAY_PUZZLES = holiday as unknown as Record<PuzzleKind, Puzzle[]>;

export function findPuzzle(id: string): { kind: PuzzleKind; puzzle: Puzzle; index: number; holiday: boolean } | null {
  for (const [set, isHoliday] of [[PUZZLES, false], [HOLIDAY_PUZZLES, true]] as const) {
    for (const kind of PUZZLE_KINDS) {
      const index = set[kind].findIndex(p => p.id === id);
      if (index >= 0) return { kind, puzzle: set[kind][index], index, holiday: isHoliday };
    }
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
  if (f.holiday) {
    // The next holiday puzzle of the same event.
    const list = holidayPuzzles(holidayOf(id)?.id ?? '');
    const next = list[list.findIndex(p => p.id === id) + 1];
    return next ? findPuzzle(next.id)!.puzzle : null;
  }
  return PUZZLES[f.kind][f.index + 1] ?? null;
}

// ---------- Today's puzzle (the same for everyone, new every day, Vietnam time) ----------

const DAILY_EPOCH = '2026-11-01';
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);

/** Today's puzzle: #1 on the epoch day, chess and xiangqi in turn, spread over the whole set. */
export function dailyPuzzle(day = dayKey()): { number: number; day: string; kind: PuzzleKind; puzzle: Puzzle } {
  const number = Math.max(1, daysBetween(DAILY_EPOCH, day) + 1);
  const kind: PuzzleKind = number % 2 ? 'chess' : 'xiangqi';
  const list = PUZZLES[kind];
  return { number, day, kind, puzzle: list[(Math.ceil(number / 2) * 37) % list.length] };
}

interface DailyState { last: string | null; streak: number; best: number; results: Record<string, number> }
export function dailyState(): DailyState {
  const d = store.get<DailyState>('daily') ?? { last: null, streak: 0, best: 0, results: {} };
  // A streak that skipped yesterday is over.
  const today = dayKey();
  if (d.last && d.last !== today && d.last !== addDays(today, -1)) d.streak = 0;
  return d;
}
/** Record solving today's puzzle (once a day; keeps the best stars). */
export function recordDaily(day: string, stars: number): DailyState {
  const d = dailyState();
  if (d.last !== day) {
    d.streak = d.last === addDays(day, -1) ? d.streak + 1 : 1;
    d.last = day;
    d.best = Math.max(d.best, d.streak);
  }
  d.results[day] = Math.max(d.results[day] ?? 0, stars);
  for (const k of Object.keys(d.results).sort().slice(0, -60)) delete d.results[k];
  store.set('daily', d);
  return d;
}

/** How many of the regular puzzles are solved (holiday puzzles not counted). */
export const solvedCount = () => { const p = progress(); return [...PUZZLES.chess, ...PUZZLES.xiangqi].filter(x => x.id in p).length; };
