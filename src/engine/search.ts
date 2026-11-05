/**
 * Game-agnostic alpha-beta search for chess and xiangqi:
 * iterative deepening with aspiration windows, principal variation search,
 * transposition table, null-move pruning, late move reductions, reverse
 * futility pruning, check extensions, killer/history move ordering and a
 * quiescence search. Legality is checked lazily (pseudo-legal generation +
 * "did this move leave my king in check?") which is much faster.
 */
import { MATE, type SearchPosition } from './types';

const INF = MATE + 1;
const MATE_BOUND = MATE - 1000;
const MAX_PLY = 64;

class Timeout extends Error {}

const EXACT = 0, LOWER = 1, UPPER = 2;

/** Shared transposition table (2^19 entries, about 7 MB), reused between searches. */
const TT_SIZE = 1 << 19;
const TT_MASK = TT_SIZE - 1;
const ttKey = new Int32Array(TT_SIZE);
const ttMove = new Int32Array(TT_SIZE);
const ttScore = new Int32Array(TT_SIZE);
const ttDepth = new Int8Array(TT_SIZE).fill(-1);
const ttFlag = new Uint8Array(TT_SIZE);

function ttStore(key: number, depth: number, score: number, flag: number, move: number) {
  const i = key & TT_MASK;
  // Prefer deeper results for the same position; always replace other positions.
  if (ttKey[i] === key && ttDepth[i] > depth && flag !== EXACT) return;
  ttKey[i] = key; ttDepth[i] = depth; ttScore[i] = score; ttFlag[i] = flag; ttMove[i] = move;
}

export function clearTT() {
  ttDepth.fill(-1);
}

export interface SearchLimits {
  maxDepth: number;
  timeMs: number;
}

export interface SearchResult {
  move: number;
  /** Score from the side to move at the root (centipawns, or ±MATE-ply). */
  score: number;
  depth: number;
  nodes: number;
  /** Score of root moves at the deepest completed depth (all moves with `allScores`). */
  rootScores: Map<number, number>;
  /** Expected line of play, starting with `move`. */
  pv: number[];
}

export class Searcher {
  private nodes = 0;
  private deadline = 0;
  private killers = new Int32Array(MAX_PLY * 2 + 8);
  private history = new Int32Array(1 << 14);
  private path: number[] = [];

  constructor(private pos: SearchPosition) {}

  search(limits: SearchLimits, opts: { allScores?: boolean } = {}): SearchResult {
    const pos = this.pos;
    this.nodes = 0;
    this.deadline = Date.now() + limits.timeMs;
    this.path = [pos.hash()];
    this.killers.fill(0);
    this.history.fill(0);
    let rootMoves = pos.legalMoves();
    if (rootMoves.length === 0) throw new Error('no legal moves');
    let best: SearchResult = {
      move: rootMoves[0], score: 0, depth: 0, nodes: 0,
      rootScores: new Map(rootMoves.map(m => [m, 0])), pv: [rootMoves[0]],
    };
    const entry = pos.hash() & TT_MASK;
    rootMoves = this.order(rootMoves, 0, ttKey[entry] === pos.hash() ? ttMove[entry] : 0);
    if (rootMoves.length === 1 && !opts.allScores) limits = { ...limits, maxDepth: Math.min(limits.maxDepth, 2) };

    for (let depth = 1; depth <= limits.maxDepth; depth++) {
      try {
        let scores: Map<number, number>;
        let score: number, move: number;
        if (opts.allScores) {
          // Exact score of every root move (difficulty noise, jieqi sampling).
          scores = new Map();
          score = -INF; move = rootMoves[0];
          for (const m of rootMoves) {
            const s = this.searchRootMove(m, depth, -INF, INF);
            scores.set(m, s);
            if (s > score) { score = s; move = m; }
          }
        } else {
          // Aspiration window around the previous score.
          let window = 35;
          let alpha = depth >= 4 && Math.abs(best.score) < MATE_BOUND ? best.score - window : -INF;
          let beta = depth >= 4 && Math.abs(best.score) < MATE_BOUND ? best.score + window : INF;
          for (;;) {
            [score, move] = this.root(rootMoves, depth, alpha, beta);
            if (score <= alpha && alpha > -INF) { alpha = Math.max(-INF, alpha - window * 4); window *= 4; }
            else if (score >= beta && beta < INF) { beta = Math.min(INF, beta + window * 4); window *= 4; }
            else break;
          }
          scores = new Map([[move, score]]);
        }
        rootMoves = [move, ...rootMoves.filter(m => m !== move)];
        if (opts.allScores) rootMoves = [...rootMoves].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
        best = { move, score, depth, nodes: this.nodes, rootScores: scores, pv: this.extractPV(move, depth) };
      } catch (e) {
        if (!(e instanceof Timeout)) throw e;
        while (this.path.length > 1) { this.path.pop(); pos.unmake(); }
        break;
      }
      if (Math.abs(best.score) > MATE_BOUND && depth >= 2) break; // forced mate found
      if (Date.now() > this.deadline) break;
    }
    best.nodes = this.nodes;
    return best;
  }

  private searchRootMove(m: number, depth: number, alpha: number, beta: number): number {
    const pos = this.pos;
    pos.make(m);
    this.path.push(pos.hash());
    const s = -this.negamax(depth - 1, -beta, -alpha, 1, true);
    this.path.pop();
    pos.unmake();
    return s;
  }

  /** Principal variation search over the root moves. */
  private root(moves: number[], depth: number, alpha: number, beta: number): [number, number] {
    let best = -INF, bestMove = moves[0];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      let s: number;
      if (i === 0) s = this.searchRootMove(m, depth, alpha, beta);
      else {
        s = this.searchRootMove(m, depth, alpha, alpha + 1);
        if (s > alpha && s < beta) s = this.searchRootMove(m, depth, alpha, beta);
      }
      if (s > best) { best = s; bestMove = m; }
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return [best, bestMove];
  }

  /** Follow the transposition table from the root to get the expected line. */
  private extractPV(first: number, depth: number): number[] {
    const pos = this.pos;
    const pv = [first];
    pos.make(first);
    let made = 1;
    const seen = new Set([pos.hash()]);
    for (let i = 1; i < depth + 4; i++) {
      const key = pos.hash();
      const e = key & TT_MASK;
      if (ttKey[e] !== key || !ttMove[e]) break;
      const m = ttMove[e];
      if (!pos.legalMoves().includes(m)) break;
      pv.push(m);
      pos.make(m);
      made++;
      if (seen.has(pos.hash())) break;
      seen.add(pos.hash());
    }
    for (let i = 0; i < made; i++) pos.unmake();
    return pv;
  }

  private tick() {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) throw new Timeout();
  }

  private isRepetition(): boolean {
    const h = this.path[this.path.length - 1];
    for (let i = this.path.length - 3; i >= 0; i -= 2) if (this.path[i] === h) return true;
    return false;
  }

  private order(moves: number[], ply: number, hashMove: number): number[] {
    const pos = this.pos;
    const k0 = this.killers[ply * 2], k1 = this.killers[ply * 2 + 1];
    const n = moves.length;
    const keys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const m = moves[i];
      if (m === hashMove) keys[i] = 1e9;
      else {
        const c = pos.captureOrder(m);
        if (c >= 0) keys[i] = 1e7 + c;
        else if (m === k0) keys[i] = 9e6;
        else if (m === k1) keys[i] = 8e6;
        else keys[i] = this.history[m & 0x3fff];
      }
    }
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => keys[b] - keys[a]);
    return idx.map(i => moves[i]);
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    const pos = this.pos;
    this.tick();
    if (pos.isRuleDraw() || this.isRepetition()) return 0;
    if (ply >= MAX_PLY) return pos.evaluate();

    // Mate distance pruning.
    alpha = Math.max(alpha, -MATE + ply);
    beta = Math.min(beta, MATE - ply - 1);
    if (alpha >= beta) return alpha;

    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply, 0);

    const pvNode = beta - alpha > 1;
    const key = pos.hash();
    const e = key & TT_MASK;
    let hashMove = 0;
    if (ttKey[e] === key && ttDepth[e] >= 0) {
      hashMove = ttMove[e];
      if (!pvNode && ttDepth[e] >= depth) {
        let s = ttScore[e];
        if (s > MATE_BOUND) s -= ply; else if (s < -MATE_BOUND) s += ply;
        const f = ttFlag[e];
        if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
      }
    }

    const staticEval = inCheck ? -INF : pos.evaluate();

    // Reverse futility pruning: far above beta at shallow depth.
    if (!pvNode && !inCheck && depth <= 3 && Math.abs(beta) < MATE_BOUND && staticEval - 110 * depth >= beta) return staticEval;

    // Null move: if passing still beats beta, this node is good enough.
    if (!pvNode && allowNull && !inCheck && depth >= 3 && staticEval >= beta && pos.hasNonPawnMaterial(pos.side)) {
      const R = depth > 6 ? 3 : 2;
      pos.makeNull();
      this.path.push(pos.hash());
      const s = -this.negamax(depth - 1 - R, -beta, -beta + 1, ply + 1, false);
      this.path.pop();
      pos.unmake();
      if (s >= beta) return s >= MATE_BOUND ? beta : s;
    }

    const moves = this.order(pos.pseudoMoves(), ply, hashMove);
    const alpha0 = alpha;
    let best = -INF, bestMove = 0, legal = 0;
    for (const m of moves) {
      const quiet = pos.captureOrder(m) < 0;
      pos.make(m);
      if (pos.leftInCheck()) { pos.unmake(); continue; }
      legal++;
      this.path.push(pos.hash());
      const givesCheck = pos.inCheck();
      let s: number;
      if (legal === 1) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        // Late move reductions for quiet moves that come late in the ordering.
        let r = 0;
        if (depth >= 3 && legal > 3 && quiet && !inCheck && !givesCheck &&
            m !== this.killers[ply * 2] && m !== this.killers[ply * 2 + 1]) {
          r = 1 + (legal > 10 ? 1 : 0) + (depth > 6 ? 1 : 0) - (pvNode ? 1 : 0);
          r = Math.max(0, Math.min(r, depth - 2));
        }
        s = -this.negamax(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && r > 0) s = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && s < beta) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      this.path.pop();
      pos.unmake();
      if (s > best) { best = s; bestMove = m; }
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (quiet) {
          if (this.killers[ply * 2] !== m) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = m; }
          const h = m & 0x3fff;
          this.history[h] = Math.min(1 << 28, this.history[h] + depth * depth);
        }
        break;
      }
    }
    if (legal === 0) return pos.noMovesScore(ply);

    let stored = best;
    if (stored > MATE_BOUND) stored += ply; else if (stored < -MATE_BOUND) stored -= ply;
    ttStore(key, depth, stored, best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT, bestMove);
    return best;
  }

  private quiesce(alpha: number, beta: number, ply: number, qply: number): number {
    const pos = this.pos;
    this.tick();
    const inCheck = pos.inCheck();
    let stand = -INF;
    let moves: number[];
    if (inCheck) {
      if (qply > 8 || ply >= MAX_PLY) return pos.evaluate();
      moves = pos.pseudoMoves();
    } else {
      stand = pos.evaluate();
      if (stand >= beta || qply > 8 || ply >= MAX_PLY) return stand;
      if (stand > alpha) alpha = stand;
      moves = pos.pseudoCaptures();
    }
    let legal = 0;
    for (const m of this.order(moves, ply, 0)) {
      // Delta pruning: even winning the victim cannot lift us to alpha.
      if (!inCheck) {
        const c = pos.captureOrder(m);
        if (c >= 0 && stand + c / 8 + 200 < alpha) continue;
      }
      pos.make(m);
      if (pos.leftInCheck()) { pos.unmake(); continue; }
      legal++;
      this.path.push(pos.hash());
      const s = -this.quiesce(-beta, -alpha, ply + 1, qply + 1);
      this.path.pop();
      pos.unmake();
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    if (inCheck && legal === 0) return pos.noMovesScore(ply);
    return alpha;
  }
}
