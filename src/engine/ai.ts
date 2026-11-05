/** Bot move selection and analysis for every game kind and difficulty. */
import { Chess } from './chess';
import { Searcher } from './search';
import { MATE, type GameKind } from './types';
import { Xiangqi, type XiangqiJSON } from './xiangqi';

export type Level = 'easy' | 'medium' | 'hard' | 'expert';
export const LEVELS: Level[] = ['easy', 'medium', 'hard', 'expert'];

export interface AIRequest {
  kind: GameKind;
  /** FEN for chess, JSON for xiangqi/jieqi. */
  state: string | XiangqiJSON;
  level: Level;
  /** Override the level's thinking time (e.g. a fixed-strength referee). */
  timeMs?: number;
}

export interface AIResult {
  move: number;
  /** Evaluation from the side to move (centipawns; |score| > MATE-1000 means mate). */
  score: number;
  depth: number;
  nodes: number;
  /** Expected continuation, starting with `move` (empty for jieqi). */
  pv: number[];
}

const LIMITS: Record<Level, { maxDepth: number; timeMs: number }> = {
  easy: { maxDepth: 2, timeMs: 250 },
  medium: { maxDepth: 5, timeMs: 700 },
  hard: { maxDepth: 64, timeMs: 2000 },
  expert: { maxDepth: 64, timeMs: 5000 },
};

/** Easy bot: pick randomly among moves that are not much worse than the best. */
function pickWithNoise(scores: Map<number, number>, margin: number, random: () => number): number {
  const entries = [...scores.entries()];
  const best = Math.max(...entries.map(e => e[1]));
  const ok = entries.filter(([, s]) => s >= best - margin);
  return ok[Math.floor(random() * ok.length)][0];
}

export function analyze(req: AIRequest, random: () => number = Math.random): AIResult {
  const limits = req.timeMs ? { maxDepth: 64, timeMs: req.timeMs } : LIMITS[req.level];
  if (req.kind !== 'jieqi') {
    const pos = req.kind === 'chess' ? new Chess(req.state as string) : Xiangqi.fromJSON(req.state as XiangqiJSON);
    if (req.level === 'easy') {
      const res = new Searcher(pos).search(limits, { allScores: true });
      const move = pickWithNoise(res.rootScores, req.kind === 'chess' ? 120 : 90, random);
      return { move, score: res.rootScores.get(move) ?? res.score, depth: res.depth, nodes: res.nodes, pv: [move] };
    }
    const res = new Searcher(pos).search(limits);
    return { move: res.move, score: res.score, depth: res.depth, nodes: res.nodes, pv: res.pv };
  }
  // Jieqi: the bot does not know the face-down pieces. It searches several
  // random arrangements of the unknown pieces and averages the root scores.
  const base = Xiangqi.fromJSON(req.state as XiangqiJSON);
  const samples = { easy: 3, medium: 8, hard: 14, expert: 20 }[req.level];
  const totals = new Map<number, number>();
  const counts = new Map<number, number>();
  const perSample = { maxDepth: { easy: 2, medium: 3, hard: 4, expert: 5 }[req.level], timeMs: limits.timeMs / samples };
  let depth = 0, nodes = 0;
  for (let i = 0; i < samples; i++) {
    const pos = base.clone();
    pos.determinize(random);
    const res = new Searcher(pos).search(perSample, { allScores: true });
    depth = Math.max(depth, res.depth);
    nodes += res.nodes;
    for (const [m, s] of res.rootScores) {
      // Clamp mate scores so a single lucky sample does not dominate.
      const c = Math.abs(s) > MATE - 1000 ? Math.sign(s) * 3000 : Math.max(-3000, Math.min(3000, s));
      totals.set(m, (totals.get(m) ?? 0) + c);
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  const avg = new Map([...totals].map(([m, t]) => [m, t / (counts.get(m) ?? 1)]));
  let move: number;
  if (req.level === 'easy') move = pickWithNoise(avg, 80, random);
  else {
    move = 0;
    let bestScore = -Infinity;
    for (const [m, s] of avg) if (s > bestScore) { bestScore = s; move = m; }
  }
  return { move, score: Math.round(avg.get(move) ?? 0), depth, nodes, pv: [] };
}

export function chooseMove(req: AIRequest, random: () => number = Math.random): number {
  return analyze(req, random).move;
}
