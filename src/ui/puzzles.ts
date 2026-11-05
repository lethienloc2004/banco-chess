/** Puzzle level map and the puzzle play screen. */
import { Match } from '../game';
import {
  PUZZLES, PUZZLE_KINDS, findPuzzle, group, nextPuzzle, progress, record, stars, unlocked,
  type Puzzle, type PuzzleKind,
} from '../puzzles';
import { defenderLoses, hardestDefence, isMated } from '../puzzles/solver';
import type { SearchPosition } from '../engine/types';
import { playSound } from '../sound';
import { settings, t } from '../state';
import { BoardRenderer, chessGlyph } from './board';
import { openDialog } from './dialog';
import { gameThumb, type Nav, type Screen } from './home';
import { moveSfx } from './sfx';
import { esc } from './util';

const STAR = '★';

function starsHtml(n: number, max = 3): string {
  return `<span class="stars" aria-label="${n}/${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}">${STAR}</i>`).join('')}</span>`;
}

export function puzzleThumb(): string {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="var(--accent-soft)"/>
    <path d="M22 12h10a5 5 0 1 1 8 0h10v12a5 5 0 1 0 0 8v12H40a5 5 0 1 1-8 0H22V32a5 5 0 1 0 0-8z" transform="translate(-4 4)" fill="var(--accent)" opacity=".9"/></svg>`;
}

// ---------- Level map ----------

export function puzzleListScreen(kindArg: string | undefined, nav: Nav): Screen {
  const s = t();
  const P = s.puzzles;
  const kind: PuzzleKind = kindArg === 'xiangqi' ? 'xiangqi' : 'chess';
  const el = document.createElement('section');
  el.className = 'screen puzzles';
  const all = PUZZLES[kind];
  const prog = progress();
  const done = all.filter(p => p.id in prog).length;
  const total = all.reduce((n, p) => n + (prog[p.id] ?? 0), 0);
  el.innerHTML = `
    <div class="screen-head">
      <span class="thumb big">${puzzleThumb()}</span>
      <div><h1>${esc(P.title)}</h1><p>${esc(P.subtitle)}</p></div>
    </div>
    <nav class="pz-tabs">${PUZZLE_KINDS.map(k => `<a href="#/puzzles/${k}" class="${k === kind ? 'on' : ''}"><span class="thumb">${gameThumb(k)}</span>${esc(s[k])}</a>`).join('')}</nav>
    <p class="pz-progress">${esc(P.progress(done, all.length))} · ${STAR} ${total}/${all.length * 3}</p>
    <div class="pz-groups"></div>`;
  el.querySelectorAll<HTMLAnchorElement>('.pz-tabs a').forEach(a => {
    a.onclick = e => { e.preventDefault(); nav.go(a.getAttribute('href')!, 'none'); };
  });
  const groups = el.querySelector<HTMLElement>('.pz-groups')!;
  let n = 0;
  for (const mate of [1, 2, 3] as const) {
    const list = group(kind, mate);
    if (!list.length) continue;
    const sec = document.createElement('section');
    sec.className = 'pz-group';
    sec.innerHTML = `<h2 class="list-title">${esc(P.mateIn(mate))} <span class="muted">· ${esc(P.levelCount(list.length))}</span></h2><div class="pz-grid"></div>`;
    const grid = sec.querySelector<HTMLElement>('.pz-grid')!;
    list.forEach((p, i) => {
      const open = unlocked(p, kind);
      const b = document.createElement('button');
      b.className = 'pz-tile' + (p.id in prog ? ' done' : '') + (open ? '' : ' locked');
      b.style.setProperty('--i', String(n++));
      b.disabled = !open;
      b.innerHTML = `<b>${open ? i + 1 : '🔒'}</b>${p.id in prog ? starsHtml(prog[p.id]) : ''}`;
      b.setAttribute('aria-label', `${P.level(i + 1)} — ${P.mateIn(mate)}${open ? '' : ' (' + P.locked + ')'}`);
      b.onclick = () => nav.go(`#/puzzle/${p.id}`);
      grid.appendChild(b);
    });
    groups.appendChild(sec);
  }
  return { el, dispose() {} };
}

// ---------- Play screen ----------

type Phase = 'play' | 'reply' | 'solved' | 'shown';

export class PuzzleScreen implements Screen {
  readonly el: HTMLElement;
  private readonly kind: PuzzleKind;
  private readonly puzzle: Puzzle;
  private readonly index: number;
  private match!: Match;
  private board: BoardRenderer;
  private attacker: 0 | 1 = 0;
  private step = 0; // attacker moves made
  private onLine = true; // still following the stored solution
  private selected: number | null = null;
  private pendingPromotion: number[] | null = null;
  private mistakes = 0;
  private hinted = false;
  private hint: number | null = null;
  private phase: Phase = 'play';
  private message: { text: string; cls: string } | null = null;
  private timers: number[] = [];
  private disposed = false;

  constructor(id: string, private nav: Nav) {
    const f = findPuzzle(id)!;
    this.kind = f.kind;
    this.puzzle = f.puzzle;
    this.index = group(f.kind, f.puzzle.mate).findIndex(p => p.id === id);
    this.el = document.createElement('section');
    this.el.className = 'screen game puzzle';
    this.el.dataset.kind = this.kind;
    this.el.innerHTML = `
      <div class="board-wrap">
        <div class="player top-player"></div>
        <div class="board-box"></div>
        <div class="player bottom-player"></div>
        <div class="promo" hidden></div>
      </div>
      <aside class="panel">
        <div class="game-title"><span class="thumb">${puzzleThumb()}</span><div><h1></h1><p class="mode-line"></p></div></div>
        <div class="status" aria-live="polite"></div>
        <div class="pz-steps"></div>
        <div class="controls"></div>
        <div class="card pz-tip"></div>
      </aside>`;
    this.board = new BoardRenderer(this.el.querySelector('.board-box')!, sq => this.onCell(sq));
    this.reset(true);
  }

  dispose() {
    this.disposed = true;
    this.timers.forEach(clearTimeout);
  }

  refresh() {
    this.render();
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(window.setTimeout(() => { if (!this.disposed) fn(); }, ms));
  }

  private get pos(): SearchPosition {
    return this.match.pos as unknown as SearchPosition;
  }

  private reset(intro = false) {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.match = new Match(this.kind, this.puzzle.start);
    this.attacker = this.match.side as 0 | 1;
    this.step = 0;
    this.onLine = true;
    this.selected = null;
    this.pendingPromotion = null;
    this.hint = null;
    this.phase = 'play';
    this.message = null;
    this.render(false, intro);
  }

  private remaining(): number {
    return this.puzzle.mate - this.step;
  }

  private sideName(side: number): string {
    const s = t();
    return side === 0 ? (this.kind === 'chess' ? s.white : s.red) : s.black;
  }

  private onCell(sq: number) {
    if (this.phase !== 'play') return;
    this.pendingPromotion = null;
    const legal = this.match.legalMoves();
    if (this.selected !== null) {
      const choices = legal.filter(m => this.match.moveFrom(m) === this.selected && this.match.moveTo(m) === sq);
      if (choices.length === 1) return this.tryMove(choices[0]);
      if (choices.length > 1) { this.pendingPromotion = choices; return this.render(); }
    }
    const p = this.match.pieceAt(sq);
    this.selected = p && p.color === this.match.side && sq !== this.selected && legal.some(m => this.match.moveFrom(m) === sq) ? sq : null;
    this.render();
  }

  /** Is `m` a correct move for the attacker at the current step? */
  private judge(m: number): boolean {
    const left = this.remaining();
    const pos = this.pos;
    pos.make(m);
    let ok: boolean;
    if (left === 1) ok = isMated(pos); // any checkmate counts
    else if (this.onLine && m === this.puzzle.line[this.step * 2]) ok = true;
    // Puzzles have a unique first move; later on, any move that still forces mate is fine.
    else ok = this.step > 0 && defenderLoses(pos, left - 1);
    pos.unmake();
    return ok;
  }

  private tryMove(m: number) {
    const s = t();
    this.selected = null;
    this.pendingPromotion = null;
    this.hint = null;
    const ok = this.judge(m);
    const captures = this.match.captured.length;
    const followsLine = this.onLine && m === this.puzzle.line[this.step * 2];
    this.match.play(m);
    if (!ok) {
      this.mistakes++;
      this.phase = 'reply';
      this.message = { text: s.puzzles.wrong, cls: 'check' };
      if (settings.sound) playSound('wrong');
      this.render(true);
      this.board.svg.classList.add('shake');
      this.later(() => {
        this.board.svg.classList.remove('shake');
        this.match.undo();
        this.phase = 'play';
        this.render();
      }, 900);
      return;
    }
    if (!followsLine) this.onLine = false;
    this.step++;
    if (this.remaining() === 0) return this.finish(captures);
    moveSfx(this.match, m, captures, false);
    this.phase = 'reply';
    this.message = { text: s.puzzles.good, cls: 'good' };
    this.render(true);
    this.later(() => this.reply(), 650);
  }

  /** The defender answers with the stored (or the hardest) defence. */
  private reply() {
    const d = this.onLine ? this.puzzle.line[this.step * 2 - 1] : hardestDefence(this.pos, this.remaining());
    if (d === undefined || d === null) return;
    const captures = this.match.captured.length;
    this.match.play(d);
    moveSfx(this.match, d, captures, false);
    this.phase = 'play';
    this.message = null;
    this.render(true);
  }

  private finish(captures: number) {
    void captures;
    const s = t();
    const P = s.puzzles;
    this.phase = 'solved';
    const got = this.hinted ? Math.max(1, 2 - this.mistakes) : this.mistakes === 0 ? 3 : this.mistakes === 1 ? 2 : 1;
    record(this.puzzle.id, got);
    if (settings.sound) playSound('solved');
    this.message = { text: P.solved, cls: 'over' };
    this.render(true);
    const next = nextPuzzle(this.puzzle.id);
    this.later(() => {
      const body = document.createElement('div');
      body.innerHTML = `<p class="pz-result">${starsHtml(got)}</p><p>${esc(got === 3 ? P.perfect : got === 2 ? P.nice : P.done)}</p>`;
      openDialog({
        title: P.solvedTitle, icon: '🎉', className: 'over-dlg', body,
        actions: [
          { label: P.levels, kind: 'ghost', onClick: () => this.nav.go(`#/puzzles/${this.kind}`, 'back') },
          { label: P.retry, onClick: () => { this.mistakes = 0; this.hinted = false; this.reset(); } },
          ...(next ? [{ label: P.next, kind: 'primary' as const, onClick: () => this.nav.go(`#/puzzle/${next.id}`) }] : []),
        ],
      });
    }, 700);
  }

  private showHint() {
    if (this.phase !== 'play') return;
    const m = this.onLine ? this.puzzle.line[this.step * 2] : null;
    if (m === null || m === undefined) return;
    this.hinted = true;
    this.hint = this.match.moveFrom(m);
    this.selected = this.hint;
    this.render();
  }

  /** Play the whole solution, one move at a time. */
  private showSolution() {
    this.reset();
    this.phase = 'shown';
    const line = this.puzzle.line;
    if (!(this.puzzle.id in progress())) record(this.puzzle.id, 0); // unlocks the next level without stars
    this.message = { text: t().puzzles.watching, cls: 'thinking' };
    this.render();
    line.forEach((m, i) => this.later(() => {
      const captures = this.match.captured.length;
      this.match.play(m);
      moveSfx(this.match, m, captures, false, i === line.length - 1);
      if (i === line.length - 1) this.message = { text: t().puzzles.shownDone, cls: 'over' };
      this.render(true);
    }, 700 * (i + 1)));
  }

  private render(animate = false, intro = false) {
    if (this.disposed) return;
    const s = t();
    const P = s.puzzles;
    const m = this.match;
    const flipped = this.attacker === 1;
    this.el.querySelector('.game-title h1')!.textContent = `${P.level(this.index + 1)} · ${s[this.kind]}`;
    this.el.querySelector('.mode-line')!.textContent = P.mateIn(this.puzzle.mate);

    const status = this.message?.text ?? P.task(this.sideName(this.attacker), this.puzzle.mate);
    const st = this.el.querySelector<HTMLElement>('.status')!;
    st.className = 'status ' + (this.message?.cls ?? '');
    st.innerHTML = `<span class="dot side-${this.attacker} ${m.isChess ? 'chess' : 'xq'}"></span><span>${esc(status)}</span>`;

    // One dot per attacker move.
    this.el.querySelector('.pz-steps')!.innerHTML = Array.from({ length: this.puzzle.mate }, (_, i) =>
      `<span class="pz-step ${i < this.step ? 'done' : i === this.step && this.phase === 'play' ? 'now' : ''}"></span>`).join('');

    const controls = this.el.querySelector<HTMLElement>('.controls')!;
    const busy = this.phase === 'reply' || this.phase === 'shown';
    const next = nextPuzzle(this.puzzle.id);
    const canNext = !!next && (this.puzzle.id in progress());
    controls.innerHTML = `
      <button class="btn" data-act="hint"${this.phase !== 'play' || !this.onLine ? ' disabled' : ''}>💡<span>${esc(P.hint)}</span></button>
      <button class="btn" data-act="retry"${busy && this.phase !== 'shown' ? ' disabled' : ''}>↺<span>${esc(P.retry)}</span></button>
      ${canNext ? `<button class="btn primary" data-act="next">→<span>${esc(P.next)}</span></button>` : `<button class="btn" data-act="solution"${this.phase === 'solved' || this.phase === 'shown' ? ' disabled' : ''}>👁<span>${esc(P.solution)}</span></button>`}`;
    controls.querySelectorAll<HTMLButtonElement>('button').forEach(b => (b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'hint') this.showHint();
      else if (a === 'retry') this.reset();
      else if (a === 'solution') this.showSolution();
      else if (a === 'next' && next) this.nav.go(`#/puzzle/${next.id}`);
    }));

    const best = stars(this.puzzle.id);
    this.el.querySelector('.pz-tip')!.innerHTML = `<p>${esc(P.tip(this.puzzle.mate))}</p>${this.puzzle.id in progress() ? `<p class="muted small">${esc(P.best)} ${starsHtml(best)}</p>` : ''}`;

    for (const [cls, side] of [['.bottom-player', flipped ? 1 : 0], ['.top-player', flipped ? 0 : 1]] as const) {
      const bar = this.el.querySelector<HTMLElement>(cls)!;
      bar.classList.toggle('turn', m.side === side && this.phase !== 'solved');
      bar.innerHTML = `<span class="pname"><span class="dot side-${side} ${m.isChess ? 'chess' : 'xq'}"></span>${esc(this.sideName(side))}<span class="who">${esc(side === this.attacker ? s.you : P.defender)}</span></span>`;
    }

    const targets = new Map<number, boolean>();
    if (this.selected !== null && this.phase === 'play') {
      for (const mv of m.legalMoves()) if (m.moveFrom(mv) === this.selected) targets.set(m.moveTo(mv), m.pieceAt(m.moveTo(mv)) !== null);
    }
    this.board.render(m, {
      flipped, selected: this.selected, targets, labels: settings.labels,
      river: settings.labels === 'hanzi' ? ['楚 河', '漢 界'] : ['Sở Hà', 'Hán Giới'],
    }, animate, intro);
    this.board.svg.classList.toggle('locked', this.phase !== 'play');
    this.board.svg.classList.toggle('hinted', this.hint !== null);

    const promo = this.el.querySelector<HTMLElement>('.promo')!;
    if (this.pendingPromotion) {
      promo.hidden = false;
      promo.innerHTML = `<p>${esc(s.promote)}</p>` + this.pendingPromotion
        .map(mv => `<button class="cp-btn ${m.side ? 'b' : 'w'}" data-m="${mv}">${chessGlyph(m.movePromo(mv))}</button>`).join('');
      promo.querySelectorAll<HTMLButtonElement>('button').forEach(b => (b.onclick = () => this.tryMove(Number(b.dataset.m))));
    } else promo.hidden = true;
  }
}
