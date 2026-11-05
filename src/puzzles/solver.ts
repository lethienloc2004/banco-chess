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
 * Best defence after the attacker's move: first avoid any faster mate (resist
 * as long as possible), then leave the attacker the fewest ways to keep
 * forcing mate within `n` (ties: prefer captures).
 */
export function hardestDefence(pos: SearchPosition, n: number): number | null {
  let best: number | null = null;
  let bestKey: [number, number, number] = [-1, -Infinity, -Infinity];
  for (const r of pos.legalMoves()) {
    const capture = pos.captureOrder(r);
    pos.make(r);
    // How long can the defender hold out? Larger is better for the defender.
    let holds = n;
    for (let k = 1; k < n; k++) if (forcesMate(pos, k)) { holds = k; break; }
    const ways = mateMoves(pos, n).length;
    pos.unmake();
    const key: [number, number, number] = [holds, -ways, capture];
    if (key[0] > bestKey[0] || (key[0] === bestKey[0] && (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] > bestKey[2])))) {
      best = r; bestKey = key;
    }
  }
  return best;
}
