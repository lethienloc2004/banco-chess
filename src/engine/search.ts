/**
 * Game-agnostic alpha-beta search: iterative deepening, quiescence search,
 * transposition table (for move ordering), killer + history heuristics.
 */
import { MATE, type SearchPosition } from './types';

const INF = MATE + 1;

class Timeout extends Error {}

interface TTEntry { depth: number; score: number; flag: 0 | 1 | 2; move: number }
const EXACT = 0, LOWER = 1, UPPER = 2;

export interface SearchLimits {
  maxDepth: number;
  timeMs: number;
}

export interface SearchResult {
  move: number;
  score: number;
  depth: number;
  nodes: number;
  /** Score of every root move at the deepest completed depth. */
  rootScores: Map<number, number>;
}

export class Searcher {
  private nodes = 0;
  private deadline = 0;
  private tt = new Map<number, TTEntry>();
  private killers: number[][] = [];
  private history = new Map<number, number>();
  private path: number[] = [];

  constructor(private pos: SearchPosition) {}

  search(limits: SearchLimits): SearchResult {
    const pos = this.pos;
    this.nodes = 0;
    this.deadline = Date.now() + limits.timeMs;
    this.path = [];
    let rootMoves = pos.legalMoves();
    if (rootMoves.length === 0) throw new Error('no legal moves');
    let best: SearchResult = {
      move: rootMoves[0], score: 0, depth: 0, nodes: 0,
      rootScores: new Map(rootMoves.map(m => [m, 0])),
    };
    rootMoves = this.order(rootMoves, 0, 0);
    for (let depth = 1; depth <= limits.maxDepth; depth++) {
      const scores = new Map<number, number>();
      let alpha = -INF, bestMove = rootMoves[0];
      try {
        for (const m of rootMoves) {
          pos.make(m);
          this.path.push(pos.hash());
          // Full window for each root move so we get exact scores for every move
          // (needed for difficulty randomness and jieqi sampling).
          const s = -this.negamax(depth - 1, -INF, INF, 1);
          this.path.pop();
          pos.unmake();
          scores.set(m, s);
          if (s > alpha) { alpha = s; bestMove = m; }
        }
      } catch (e) {
        if (!(e instanceof Timeout)) throw e;
        // Restore the position (make/unmake pairs were interrupted).
        while (this.path.length) { this.path.pop(); pos.unmake(); }
        break;
      }
      best = { move: bestMove, score: alpha, depth, nodes: this.nodes, rootScores: scores };
      rootMoves = [...rootMoves].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
      if (Math.abs(alpha) > MATE - 1000) break; // found a forced mate
      if (Date.now() > this.deadline) break;
    }
    best.nodes = this.nodes;
    return best;
  }

  private tick() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) throw new Timeout();
  }

  private isRepetition(): boolean {
    const h = this.path[this.path.length - 1];
    for (let i = this.path.length - 3; i >= 0; i -= 2) if (this.path[i] === h) return true;
    return false;
  }

  private order(moves: number[], ply: number, ttMove: number): number[] {
    const pos = this.pos;
    const k = this.killers[ply] ?? [];
    const scored = moves.map(m => {
      let s: number;
      if (m === ttMove) s = 1e9;
      else {
        const c = pos.captureOrder(m);
        if (c >= 0) s = 1e7 + c;
        else if (m === k[0]) s = 9e6;
        else if (m === k[1]) s = 8e6;
        else s = this.history.get(m) ?? 0;
      }
      return [s, m];
    });
    scored.sort((a, b) => b[0] - a[0]);
    return scored.map(x => x[1]);
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number): number {
    const pos = this.pos;
    this.tick();
    if (pos.isRuleDraw() || this.isRepetition()) return 0;
    const inCheck = pos.inCheck();
    if (inCheck && ply < 30) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply, 0);

    const key = pos.hash();
    const entry = this.tt.get(key);
    let ttMove = 0;
    if (entry) {
      ttMove = entry.move;
      if (entry.depth >= depth && Math.abs(entry.score) < MATE - 1000) {
        if (entry.flag === EXACT) return entry.score;
        if (entry.flag === LOWER && entry.score >= beta) return entry.score;
        if (entry.flag === UPPER && entry.score <= alpha) return entry.score;
      }
    }

    const moves = pos.legalMoves();
    if (moves.length === 0) return pos.noMovesScore(ply);

    const alpha0 = alpha;
    let best = -INF, bestMove = moves[0];
    for (const m of this.order(moves, ply, ttMove)) {
      pos.make(m);
      this.path.push(pos.hash());
      const s = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      this.path.pop();
      pos.unmake();
      if (s > best) { best = s; bestMove = m; }
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (pos.captureOrder(m) < 0) {
          const k = (this.killers[ply] ??= [0, 0]);
          if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
          this.history.set(m, (this.history.get(m) ?? 0) + depth * depth);
        }
        break;
      }
    }
    if (this.tt.size > 400_000) this.tt.clear();
    this.tt.set(key, {
      depth, score: best, move: bestMove,
      flag: best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT,
    });
    return best;
  }

  private quiesce(alpha: number, beta: number, ply: number, qply: number): number {
    const pos = this.pos;
    this.tick();
    const inCheck = pos.inCheck();
    let moves: number[];
    if (inCheck) {
      moves = pos.legalMoves();
      if (moves.length === 0) return pos.noMovesScore(ply);
      if (qply > 6) return pos.evaluate();
    } else {
      const stand = pos.evaluate();
      if (stand >= beta || qply > 6) return stand;
      if (stand > alpha) alpha = stand;
      moves = pos.legalCaptures();
    }
    for (const m of this.order(moves, ply, 0)) {
      pos.make(m);
      this.path.push(pos.hash());
      const s = -this.quiesce(-beta, -alpha, ply + 1, qply + 1);
      this.path.pop();
      pos.unmake();
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }
}
