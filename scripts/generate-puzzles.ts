/**
 * Generates mate puzzles for chess and xiangqi from bot self-play.
 * Every puzzle is verified with the exhaustive solver: the side to move forces
 * checkmate in exactly N moves, there is no faster mate, and the first move is
 * the only one that works.
 *
 *   npx tsx scripts/generate-puzzles.ts [minutesPerKind=6] [seed=1] [kinds=chess,xiangqi] [out=src/puzzles/puzzles.json]
 *
 * Positions are original (found by the app's own engine), MIT licensed.
 */
import { writeFileSync } from 'node:fs';
import { Chess } from '../src/engine/chess';
import { Searcher } from '../src/engine/search';
import { MATE, type SearchPosition } from '../src/engine/types';
import { Xiangqi, type XiangqiJSON } from '../src/engine/xiangqi';
import { rngFloat } from '../src/engine/rand';
import { hardestDefence, mateMoves } from '../src/puzzles/solver';

type Kind = 'chess' | 'xiangqi';
interface Puzzle { id: string; mate: 1 | 2 | 3; start: string | XiangqiJSON; line: number[]; pieces: number }

const minutes = Number(process.argv[2] ?? 6);
const random = rngFloat(Number(process.argv[3] ?? 1));
const TARGET = { 1: 24, 2: 24, 3: 12 } as const;
const KINDS = (process.argv[4] ?? 'chess,xiangqi').split(',') as Kind[];
const OUT = process.argv[5] ?? 'src/puzzles/puzzles.json';

type Pos = (Chess | Xiangqi) & SearchPosition;

function newPos(kind: Kind): Pos {
  return (kind === 'chess' ? new Chess() : new Xiangqi(false, random)) as Pos;
}

function snapshot(pos: Pos): string | XiangqiJSON {
  return pos instanceof Chess ? pos.fen() : pos.toJSON();
}

function pieceCount(pos: Pos): number {
  return Array.from(pos.board).filter((p, sq) => p && !(pos instanceof Chess && sq & 0x88)).length;
}

function pickMove(pos: Pos): number {
  const moves = pos.legalMoves();
  if (random() < 0.08) return moves[Math.floor(random() * moves.length)];
  const res = new Searcher(pos).search({ maxDepth: 2, timeMs: 40 }, { allScores: true });
  const best = Math.max(...res.rootScores.values());
  const ok = [...res.rootScores].filter(([, s]) => s >= best - 60).map(([m]) => m);
  return ok[Math.floor(random() * ok.length)];
}

/** Quick filter: does a short search see a mate for the side to move within `plies`? */
function seesMate(pos: Pos, plies: number, ms: number): boolean {
  const res = new Searcher(pos).search({ maxDepth: plies, timeMs: ms });
  return res.score >= MATE - 50;
}

function buildLine(pos: Pos, first: number, mate: number): number[] {
  const line = [first];
  pos.make(first);
  let made = 1;
  for (let left = mate - 1; left >= 1; left--) {
    const d = hardestDefence(pos, left);
    if (d === null) break;
    line.push(d); pos.make(d); made++;
    // The quickest mating move for the attacker.
    let next = 0;
    for (let k = 1; k <= left && !next; k++) next = mateMoves(pos, k, true)[0] ?? 0;
    line.push(next); pos.make(next); made++;
  }
  for (let i = 0; i < made; i++) pos.unmake();
  return line;
}

function generate(kind: Kind): Record<1 | 2 | 3, Puzzle[]> {
  const found: Record<1 | 2 | 3, Puzzle[]> = { 1: [], 2: [], 3: [] };
  const seen = new Set<string>();
  const deadline = Date.now() + minutes * 60_000;
  let games = 0;
  const need = (n: 1 | 2 | 3) => found[n].length < TARGET[n];
  while (Date.now() < deadline && (need(1) || need(2) || need(3))) {
    games++;
    const pos = newPos(kind);
    const got = new Set<number>();
    for (let ply = 0; ply < 160; ply++) {
      if (pos.legalMoves().length === 0 || pos.isRuleDraw()) break;
      if (ply >= 12 && !pos.inCheck()) {
        const key = pos.positionKey();
        if (!seen.has(key)) {
          seen.add(key);
          const m1 = mateMoves(pos, 1);
          if (m1.length) {
            if (m1.length === 1 && need(1) && !got.has(1)) {
              found[1].push({ id: '', mate: 1, start: snapshot(pos), line: m1, pieces: pieceCount(pos) });
              got.add(1);
            }
          } else if ((need(2) || need(3)) && seesMate(pos, 5, 120)) {
            const m2 = mateMoves(pos, 2);
            if (m2.length === 1 && need(2) && !got.has(2)) {
              found[2].push({ id: '', mate: 2, start: snapshot(pos), line: buildLine(pos, m2[0], 2), pieces: pieceCount(pos) });
              got.add(2);
            } else if (m2.length === 0 && need(3) && !got.has(3)) {
              const m3 = mateMoves(pos, 3);
              if (m3.length === 1) {
                found[3].push({ id: '', mate: 3, start: snapshot(pos), line: buildLine(pos, m3[0], 3), pieces: pieceCount(pos) });
                got.add(3);
              }
            }
          }
        }
      }
      pos.make(pickMove(pos));
    }
    if (games % 10 === 0) console.error(`${kind}: ${games} games · mate1 ${found[1].length} · mate2 ${found[2].length} · mate3 ${found[3].length}`);
  }
  console.error(`${kind} done after ${games} games`);
  return found;
}

const out: Record<Kind, Puzzle[]> = { chess: [], xiangqi: [] };
for (const kind of KINDS) {
  const f = generate(kind);
  for (const n of [1, 2, 3] as const) {
    // Simpler positions (fewer pieces) first inside each group.
    f[n].sort((a, b) => a.pieces - b.pieces);
    f[n].forEach((p, i) => { p.id = `${kind === 'chess' ? 'c' : 'x'}${n}-${String(i + 1).padStart(2, '0')}`; });
    out[kind].push(...f[n]);
  }
}
writeFileSync(OUT, JSON.stringify(out) + '\n');
console.error(`wrote ${out.chess.length} chess + ${out.xiangqi.length} xiangqi puzzles`);
