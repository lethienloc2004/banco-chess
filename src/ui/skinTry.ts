/**
 * Try a skin before buying it: a full chess or xiangqi board in that skin (and its
 * holiday board), where you can move pieces yourself or watch a short demo with
 * captures, to see the move and capture effects and hear the sounds.
 */
import { Match } from '../game';
import { skinById } from '../shared/quests';
import { settings, t } from '../state';
import { BoardRenderer } from './board';
import { openDialog, type DialogAction } from './dialog';
import { moveSfx } from './sfx';
import { skinTheme } from './skins';
import { esc } from './util';

type Game = 'chess' | 'xiangqi';
/** Demo openings with a few captures: [file, rank] → [file, rank] (rank 0 = White's / Red's back rank). */
const DEMO: Record<Game, [number, number, number, number][]> = {
  // Scotch: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nxd4 5.Qxd4
  chess: [[4, 1, 4, 3], [4, 6, 4, 4], [6, 0, 5, 2], [1, 7, 2, 5], [3, 1, 3, 3], [4, 4, 3, 3], [5, 2, 3, 3], [2, 5, 3, 3], [3, 0, 3, 3]],
  // Central cannon taking the middle soldier, the horse taking back, the other cannon taking the horse.
  xiangqi: [[7, 2, 4, 2], [7, 9, 6, 7], [4, 2, 4, 6], [6, 7, 4, 6], [1, 2, 4, 2], [1, 7, 4, 7], [4, 2, 4, 6]],
};

export interface TryOptions {
  game: Game;
  /** Shown as the main button when given, e.g. buy or equip. */
  action?: DialogAction;
}

export function openSkinTry(skinId: string, o: TryOptions) {
  const s = t();
  const Q = s.quests;
  const def = skinById(skinId)!;
  const theme = skinTheme(skinId);
  let game: Game = o.game;
  let match = new Match(game);
  let selected: number | null = null;
  let flipped = false;
  let demo = 0;

  const body = document.createElement('div');
  body.className = 'try';
  body.innerHTML = `
    <div class="try-top"><div class="seg try-game">${(['chess', 'xiangqi'] as const).map(g => `<button data-g="${g}">${esc(s[g])}</button>`).join('')}</div>
      <div class="try-ctl"><button class="btn" data-act="demo">▶ <span>${esc(Q.tryDemo)}</span></button><button class="btn" data-act="reset">↺ <span>${esc(Q.tryReset)}</span></button><button class="btn" data-act="flip" title="${esc(s.flip)}">⇅</button></div></div>
    <div class="try-board"></div>
    <p class="muted small try-hint">${esc(Q.tryHint)}${theme ? ` ${esc(Q.tryBoard)}` : ''}</p>`;
  const board = new BoardRenderer(body.querySelector('.try-board')!, sq => onCell(sq));

  const render = (animate = false) => {
    const targets = new Map<number, boolean>();
    if (selected !== null) for (const mv of match.legalMoves()) if (match.moveFrom(mv) === selected) targets.set(match.moveTo(mv), match.pieceAt(match.moveTo(mv)) !== null);
    board.render(match, {
      flipped, selected, targets, labels: settings.labels,
      river: settings.labels === 'hanzi' ? ['楚 河', '漢 界'] : ['Sở Hà', 'Hán Giới'],
      skins: [skinId, skinId], theme,
    }, animate);
    body.querySelectorAll<HTMLButtonElement>('[data-g]').forEach(b => b.classList.toggle('on', b.dataset.g === game));
  };

  const play = (m: number) => {
    const before = match.captured.length;
    match.play(m);
    selected = null;
    moveSfx(match, m, before, false);
    render(true);
  };

  const onCell = (sq: number) => {
    if (demo) return;
    if (selected !== null) {
      const moves = match.legalMoves().filter(mv => match.moveFrom(mv) === selected && match.moveTo(mv) === sq);
      if (moves.length) { play(moves.find(mv => match.movePromo(mv) === 5) ?? moves[0]); return; } // promote to a queen
    }
    const p = match.pieceAt(sq);
    selected = p && p.color === match.side && match.legalMoves().some(mv => match.moveFrom(mv) === sq) ? sq : null;
    render();
  };

  const stopDemo = () => { window.clearTimeout(demo); demo = 0; };
  const reset = () => { stopDemo(); match = new Match(game); selected = null; render(); };
  const runDemo = () => {
    reset();
    const steps = DEMO[game];
    let i = 0;
    const next = () => {
      const st = steps[i++];
      if (!st) { demo = 0; return; }
      const from = match.sqOf({ file: st[0], rank: st[1] }), to = match.sqOf({ file: st[2], rank: st[3] });
      const m = match.legalMoves().find(mv => match.moveFrom(mv) === from && match.moveTo(mv) === to);
      if (m === undefined) { demo = 0; return; }
      play(m);
      demo = window.setTimeout(next, 900);
    };
    demo = window.setTimeout(next, 400);
  };

  body.querySelectorAll<HTMLButtonElement>('[data-g]').forEach(b => (b.onclick = () => { game = b.dataset.g as Game; flipped = false; runDemo(); }));
  body.querySelector<HTMLButtonElement>('[data-act="demo"]')!.onclick = runDemo;
  body.querySelector<HTMLButtonElement>('[data-act="reset"]')!.onclick = reset;
  body.querySelector<HTMLButtonElement>('[data-act="flip"]')!.onclick = () => { flipped = !flipped; render(); };

  render();
  openDialog({
    title: `${Q.tryTitle} · ${def.name[settings.lang]}`,
    body, className: 'wide-dlg try-dlg',
    actions: [{ label: s.close, kind: o.action ? 'ghost' : 'primary' }, ...(o.action ? [o.action] : [])],
    onClose: stopDemo,
  });
  // Show the effects straight away.
  runDemo();
}
