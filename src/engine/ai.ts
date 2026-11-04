/** Bot move selection for every game kind and difficulty. */
import { Chess } from './chess';
import { Searcher } from './search';
import { MATE, type GameKind } from './types';
import { Xiangqi, type XiangqiJSON } from './xiangqi';

export type Level = 'easy' | 'medium' | 'hard';

export interface AIRequest {
  kind: GameKind;
  /** FEN for chess, JSON for xiangqi/jieqi. */
  state: string | XiangqiJSON;
  level: Level;
}

const LIMITS = {
  easy: { maxDepth: 2, timeMs: 300 },
  medium: { maxDepth: 4, timeMs: 900 },
  hard: { maxDepth: 30, timeMs: 2500 },
};

/** Easy bot: pick randomly among moves that are not much worse than the best. */
function pickWithNoise(scores: Map<number, number>, margin: number, random: () => number): number {
  const entries = [...scores.entries()];
  const best = Math.max(...entries.map(e => e[1]));
  const ok = entries.filter(([, s]) => s >= best - margin);
  return ok[Math.floor(random() * ok.length)][0];
}

export function chooseMove(req: AIRequest, random: () => number = Math.random): number {
  const limits = LIMITS[req.level];
  if (req.kind === 'chess') {
    const pos = new Chess(req.state as string);
    const res = new Searcher(pos).search(limits);
    return req.level === 'easy' ? pickWithNoise(res.rootScores, 120, random) : res.move;
  }
  const base = Xiangqi.fromJSON(req.state as XiangqiJSON);
  if (req.kind !== 'jieqi') {
    const res = new Searcher(base).search(limits);
    return req.level === 'easy' ? pickWithNoise(res.rootScores, 90, random) : res.move;
  }
  // Jieqi: the bot does not know the face-down pieces. It searches several
  // random arrangements of the unknown pieces and averages the root scores.
  const samples = { easy: 3, medium: 8, hard: 14 }[req.level];
  const totals = new Map<number, number>();
  const counts = new Map<number, number>();
  const perSample = { maxDepth: limits.maxDepth, timeMs: limits.timeMs / samples };
  for (let i = 0; i < samples; i++) {
    const pos = base.clone();
    pos.determinize(random);
    const res = new Searcher(pos).search(perSample);
    for (const [m, s] of res.rootScores) {
      // Clamp mate scores so a single lucky sample does not dominate.
      const c = Math.max(-3000, Math.min(3000, Math.abs(s) > MATE - 1000 ? Math.sign(s) * 3000 : s));
      totals.set(m, (totals.get(m) ?? 0) + c);
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  const avg = new Map([...totals].map(([m, t]) => [m, t / (counts.get(m) ?? 1)]));
  if (req.level === 'easy') return pickWithNoise(avg, 80, random);
  let bestMove = 0, bestScore = -Infinity;
  for (const [m, s] of avg) if (s > bestScore) { bestScore = s; bestMove = m; }
  return bestMove;
}
