/**
 * Exhaustive mate solver used to build and check puzzles.
 * Works on any engine position (chess or xiangqi) through SearchPosition.
 * "Mated" means: no legal move while in check (a real checkmate).
 */
import type { SearchPosition } from '../engine/types';

export function isMated(pos: SearchPosition): boolean {
  return pos.inCheck() && pos.legalMoves().length === 0;
}

/** Attacker moves ordered so that checks and captures are tried first. */
function ordered(pos: SearchPosition): number[] {
  const scored = pos.legalMoves().map(m => {
    pos.make(m);
    const check = pos.inCheck();
    pos.unmake();
    return [(check ? 1e6 : 0) + Math.max(0, pos.captureOrder(m)), m];
  });
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map(x => x[1]);
}

/** Does the side to move force checkmate within `n` of its own moves? */
export function forcesMate(pos: SearchPosition, n: number): boolean {
  return mateMoves(pos, n, true).length > 0;
}

/**
 * Moves of the side to move that force checkmate within `n` moves.
 * With `firstOnly`, stops at the first one found.
 */
export function mateMoves(pos: SearchPosition, n: number, firstOnly = false): number[] {
  const out: number[] = [];
  for (const m of ordered(pos)) {
    pos.make(m);
    const ok = defenderLoses(pos, n - 1);
    pos.unmake();
    if (ok) {
      out.push(m);
      if (firstOnly) break;
    }
  }
  return out;
}

/** Defender to move: is it mated now, or mated within `n` more attacker moves whatever it plays? */
export function defenderLoses(pos: SearchPosition, n: number): boolean {
  const replies = pos.legalMoves();
  if (replies.length === 0) return pos.inCheck();
  if (n <= 0) return false;
  for (const r of replies) {
    pos.make(r);
    const mates = n === 1 ? hasMateInOne(pos) : forcesMate(pos, n);
    pos.unmake();
    if (!mates) return false;
  }
  return true;
}

function hasMateInOne(pos: SearchPosition): boolean {
  for (const m of pos.legalMoves()) {
    pos.make(m);
    const mate = pos.inCheck() && pos.legalMoves().length === 0;
    pos.unmake();
    if (mate) return true;
  }
  return false;
}

/**
 * Best defence after the attacker's move: the reply after which the attacker
 * has the fewest ways to keep forcing mate (ties: prefer captures).
 */
export function hardestDefence(pos: SearchPosition, n: number): number | null {
  let best: number | null = null, bestCount = Infinity, bestCapture = -1;
  for (const r of pos.legalMoves()) {
    const capture = pos.captureOrder(r);
    pos.make(r);
    const count = mateMoves(pos, n).length;
    pos.unmake();
    if (count < bestCount || (count === bestCount && capture > bestCapture)) {
      best = r; bestCount = count; bestCapture = capture;
    }
  }
  return best;
}
