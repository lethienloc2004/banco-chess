/** Move sound for a move that has just been played on `match`. */
import type { Match } from '../game';
import { playMove } from '../sound';
import { settings } from '../state';

export function moveSfx(match: Match, m: number, capturesBefore: number, reveal: boolean, over = false) {
  if (!settings.sound) return;
  const piece = match.pieceAt(match.moveTo(m));
  playMove({
    game: match.isChess ? 'chess' : 'xq',
    type: piece?.type ?? 1,
    capture: match.captured.length > capturesBefore,
    reveal,
    check: match.checkedKing() !== null,
    end: over || !!match.outcome(),
  });
}
