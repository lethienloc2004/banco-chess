/**
 * Bot vs bot: watch two engines play, with an evaluation bar, the expected
 * line of play and a quality mark for every move — a way to learn.
 */
import { Match, type SavedMatch } from '../game';
import { LEVELS, type AIResult, type Level } from '../engine/ai';
import { MATE, type GameKind } from '../engine/types';
import { saveSettings, settings, store, t } from '../state';
import { BoardRenderer, chessGlyph, xiangqiLabel } from './board';
import { gameThumb, type Nav, type Screen } from './home';
import { moveSfx } from './sfx';
import { openAnalysis } from './analysis';
import { esc } from './util';

export type WatchSpeed = 'slow' | 'normal' | 'fast';
const DELAY: Record<WatchSpeed, number> = { slow: 2200, normal: 1000, fast: 250 };

type Quality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
const MARK: Record<Quality, string> = { best: '✓', good: '', inaccuracy: '?!', mistake: '?', blunder: '??' };

interface Analysis {
  /** Evaluation from White/Red's point of view. */
  white: number;
  depth: number;
  pv: string[];
  side: 0 | 1;
}

let worker: Worker | null = null;
let referee: Worker | null = null;
let seq = 0;
function getWorker(): Worker {
  worker ??= new Worker(new URL('../engine/ai.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}
/** A second engine with fixed strength judges every position, whatever levels play. */
function getReferee(): Worker {
  referee ??= new Worker(new URL('../engine/ai.worker.ts', import.meta.url), { type: 'module' });
  return referee;
}
const REFEREE_MS = 450;

/** Mate scores clamped so swings stay comparable. */
function clampScore(v: number): number {
  return Math.abs(v) > MATE - 1000 ? Math.sign(v) * 2000 : Math.max(-2000, Math.min(2000, v));
}

const MATE_BOUND = MATE - 1000;

/** The game being watched, kept for the tab so leaving (e.g. to analyse it) and coming back resumes it. */
interface WatchSave {
  match: SavedMatch;
  ref: (Analysis | null)[];
  quality: (Quality | null)[];
  running: boolean;
}

export class WatchScreen implements Screen {
  readonly el: HTMLElement;
  private match: Match;
  private board: BoardRenderer;
  private flipped = false;
  private running = true;
  private thinking = false;
  private stepOnce = false;
  private req = 0;
  private timer = 0;
  private disposed = false;
  private analysis: Analysis | null = null;
  /** Referee evaluation of the position after `ply` moves (White/Red's view). */
  private ref: (Analysis | undefined)[] = [];
  private refQueue: { ply: number; state: ReturnType<Match['botState']>; game: number }[] = [];
  private refBusy = false;
  private game = 0;
  private quality: (Quality | null)[] = [];

  constructor(private kind: GameKind, private nav: Nav) {
    this.match = new Match(kind);
    this.el = document.createElement('section');
    this.el.className = 'screen game watch';
    this.el.dataset.kind = kind;
    this.el.innerHTML = `
      <div class="board-wrap">
        <div class="player top-player"></div>
        <div class="board-box"></div>
        <div class="player bottom-player"></div>
      </div>
      <aside class="panel">
        <div class="game-title"><span class="thumb">${gameThumb(kind)}</span><div><h1></h1><p class="mode-line"></p></div></div>
        <div class="status" aria-live="polite"></div>
        <div class="card eval-card"></div>
        <div class="controls"></div>
        <div class="card watch-settings"></div>
        <div class="card"><h2 class="moves-title"></h2><ol class="moves"></ol></div>
      </aside>`;
    this.board = new BoardRenderer(this.el.querySelector('.board-box')!, () => {});
    const saved = store.get<WatchSave>('watch:' + kind, true);
    if (saved && saved.match.kind === kind && this.resume(saved)) return;
    this.render(false, true);
    this.queueReferee();
    this.schedule(600);
  }

  /** Continue a game watched earlier in this tab; referee gaps are filled in. */
  private resume(saved: WatchSave): boolean {
    try {
      this.match = Match.restore(saved.match);
    } catch {
      return false;
    }
    const n = this.match.moves.length;
    this.ref = (saved.ref ?? []).slice(0, n + 1).map(a => a ?? undefined);
    this.quality = (saved.quality ?? []).slice(0, n);
    this.running = saved.running ?? true;
    const replay = new Match(this.kind, this.match.initial);
    for (let ply = 0; ply <= n; ply++) {
      if (!this.ref[ply]) this.refQueue.push({ ply, state: replay.botState(), game: this.game });
      if (ply < n) replay.play(this.match.moves[ply]);
    }
    this.pumpReferee();
    this.render(false, n === 0);
    if (!this.match.outcome()) this.schedule(600);
    return true;
  }

  private persist() {
    const save: WatchSave = { match: this.match.save(), ref: this.ref.map(a => a ?? null), quality: this.quality, running: this.running };
    store.set('watch:' + this.kind, save, true);
  }

  /** Ask the referee to evaluate the current position (processed in order). */
  private queueReferee() {
    this.refQueue.push({ ply: this.match.moves.length, state: this.match.botState(), game: this.game });
    this.pumpReferee();
  }

  private pumpReferee() {
    if (this.refBusy || this.disposed) return;
    const job = this.refQueue.shift();
    if (!job) return;
    this.refBusy = true;
    const id = ++seq;
    const w = getReferee();
    const onMsg = (e: MessageEvent<AIResult & { id: number; error?: string }>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMsg);
      this.refBusy = false;
      if (this.disposed) return;
      if (job.game === this.game && !e.data.error) {
        const side = (job.ply + (this.firstSide)) % 2 as 0 | 1;
        this.ref[job.ply] = { white: side === 0 ? e.data.score : -e.data.score, depth: e.data.depth, pv: [], side };
        this.judgeMove(job.ply - 1);
        this.judgeMove(job.ply);
        this.persist();
        this.render();
      }
      this.pumpReferee();
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, kind: this.kind, state: job.state, level: 'hard', timeMs: REFEREE_MS });
  }

  private get firstSide(): number {
    return new Match(this.kind, this.match.initial).side;
  }

  /** Quality of move `i`: how much the referee's evaluation dropped for the mover. */
  private judgeMove(i: number) {
    const before = this.ref[i], after = this.ref[i + 1];
    if (i < 0 || !before || !after) return;
    const mover = before.side;
    const sign = mover === 0 ? 1 : -1;
    const b = clampScore(before.white) * sign, a = clampScore(after.white) * sign;
    if (Math.abs(before.white) > MATE - 1000 && b > 0 && a >= 2000) { this.quality[i] = 'best'; return; }
    this.quality[i] = this.judge(b - a);
  }

  dispose() {
    this.disposed = true;
    this.req = -1;
    clearTimeout(this.timer);
  }

  refresh() {
    this.render();
  }

  private levels(): [Level, Level] {
    return settings.watchLevels;
  }

  private sideName(side: number): string {
    const s = t();
    return side === 0 ? (this.match.isChess ? s.white : s.red) : s.black;
  }

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.think(), ms);
  }

  private think() {
    if (this.disposed || this.thinking || this.match.outcome()) return;
    if (!this.running && !this.stepOnce) return;
    this.stepOnce = false;
    this.thinking = true;
    const side = this.match.side as 0 | 1;
    const id = (this.req = ++seq);
    const started = Date.now();
    const w = getWorker();
    const onMsg = (e: MessageEvent<AIResult & { id: number; error?: string }>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMsg);
      if (this.req !== id || this.disposed) return;
      const r = e.data;
      if (r.error || !this.match.legalMoves().includes(r.move)) { this.thinking = false; this.render(); return; }
      this.onAnalysis(r, side);
      const wait = Math.max(0, DELAY[settings.watchSpeed] - (Date.now() - started));
      this.timer = window.setTimeout(() => this.apply(r, side), wait);
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, kind: this.kind, state: this.match.botState(), level: this.levels()[side] });
    this.render();
  }

  /** The moving bot's own view: its expected line. */
  private onAnalysis(r: AIResult, side: 0 | 1) {
    const white = side === 0 ? r.score : -r.score;
    this.analysis = { white, depth: r.depth, pv: this.pvNotation(r.pv), side };
    this.render();
  }

  private judge(swing: number): Quality {
    if (swing <= 30) return swing <= 10 ? 'best' : 'good';
    if (swing <= 120) return 'inaccuracy';
    if (swing <= 300) return 'mistake';
    return 'blunder';
  }

  private apply(r: AIResult, side: 0 | 1) {
    if (this.disposed) return;
    const captures = this.match.captured.length;
    const reveal = this.match.pieceAt(this.match.moveFrom(r.move))?.hidden ?? false;
    this.match.play(r.move);
    this.queueReferee();
    this.persist();
    this.thinking = false;
    moveSfx(this.match, r.move, captures, reveal);
    void side;
    this.render(true);
    if (!this.match.outcome()) this.schedule(60);
  }

  private pvNotation(pv: number[]): string[] {
    if (!pv.length) return [];
    const copy = Match.restore(this.match.save());
    const out: string[] = [];
    for (const m of pv.slice(0, 8)) {
      if (!copy.pos.legalMoves().includes(m)) break;
      copy.play(m);
      out.push(copy.notes[copy.notes.length - 1][settings.lang]);
    }
    return out;
  }

  private analyse() {
    const [l0, l1] = this.levels();
    openAnalysis(this.nav, {
      kind: this.kind, initial: this.match.initial, moves: this.match.movesWithReveals(), players: [{ bot: l0 }, { bot: l1 }],
      result: this.match.outcome(), back: location.hash || '#/',
    });
  }

  private newGame() {
    this.req = -1;
    clearTimeout(this.timer);
    this.thinking = false;
    this.match = new Match(this.kind);
    this.analysis = null;
    this.game++;
    this.ref = [];
    this.refQueue = [];
    this.quality = [];
    this.running = true;
    this.persist();
    this.render(false, true);
    this.queueReferee();
    this.schedule(600);
  }

  private evalText(): { text: string; frac: number } {
    const s = t();
    const W = s.watch;
    // The referee's latest evaluation drives the bar (consistent strength).
    let a: Analysis | undefined;
    for (let i = this.ref.length - 1; i >= 0 && !a; i--) a = this.ref[i];
    if (!a) return { text: W.noEval, frac: 0.5 };
    const v = a.white;
    if (Math.abs(v) > MATE_BOUND) {
      const plies = MATE - Math.abs(v);
      const moves = Math.max(1, Math.ceil(plies / 2));
      const winner = v > 0 ? 0 : 1;
      return { text: W.mateIn(this.sideName(winner), moves), frac: winner === 0 ? 1 : 0 };
    }
    const pawns = v / 100;
    const frac = 1 / (1 + Math.exp(-v / 250));
    if (Math.abs(pawns) < 0.3) return { text: `${W.equal} (${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)})`, frac };
    const side = pawns > 0 ? 0 : 1;
    const size = Math.abs(pawns) < 1 ? W.slightly : Math.abs(pawns) < 3 ? W.clearly : W.winning;
    return { text: `${W.better(this.sideName(side), size)} (${pawns > 0 ? '+' : ''}${pawns.toFixed(1)})`, frac };
  }

  private render(animate = false, intro = false) {
    if (this.disposed) return;
    const s = t();
    const W = s.watch;
    const m = this.match;
    const [l0, l1] = this.levels();
    this.el.querySelector('.game-title h1')!.textContent = `${W.title} · ${s[this.kind]}`;
    this.el.querySelector('.mode-line')!.textContent = `${this.sideName(0)} (${s[l0]}) vs ${this.sideName(1)} (${s[l1]})`;

    const outcome = m.outcome();
    let status: string, cls = '';
    if (outcome) {
      const reason = s.reasons[outcome.reason];
      status = outcome.winner === null ? `${s.draw} — ${reason}` : `${s.wins(this.sideName(outcome.winner))} — ${reason}`;
      cls = 'over';
    } else if (!this.running && !this.thinking) { status = W.pausedStatus; }
    else { status = W.thinking(this.sideName(m.side), s[this.levels()[m.side as 0 | 1]]); cls = 'thinking'; }
    const st = this.el.querySelector<HTMLElement>('.status')!;
    st.className = 'status ' + cls;
    st.innerHTML = `<span class="dot side-${m.side} ${m.isChess ? 'chess' : 'xq'}"></span><span>${esc(status)}</span>`;

    // Evaluation bar + expected line
    const ev = this.evalText();
    const a = this.analysis;
    this.el.querySelector('.eval-card')!.innerHTML = `
      <h2>${esc(W.analysis)}</h2>
      <div class="eval-bar ${m.isChess ? 'chess' : 'xq'}" role="img" aria-label="${esc(ev.text)}"><span style="width:${(ev.frac * 100).toFixed(1)}%"></span></div>
      <p class="eval-text">${esc(ev.text)}</p>
      <p class="muted small">${esc(W.refereeNote)}</p>
      ${a && a.pv.length ? `<p class="pv"><span class="muted small">${esc(W.expects(this.sideName(a.side)))}</span><br>${a.pv.map(x => `<code>${esc(x)}</code>`).join(' ')}</p>` : ''}`;

    // Controls
    const controls = this.el.querySelector<HTMLElement>('.controls')!;
    controls.innerHTML = `
      <button class="btn${this.running ? '' : ' primary'}" data-act="toggle"${outcome ? ' disabled' : ''}>${this.running ? '⏸' : '▶'}<span>${esc(this.running ? W.pause : W.play)}</span></button>
      <button class="btn" data-act="step"${this.running || outcome || this.thinking ? ' disabled' : ''}>⏭<span>${esc(W.step)}</span></button>
      <button class="btn${outcome ? ' primary' : ''}" data-act="new">↺<span>${esc(s.newGame)}</span></button>
      ${outcome ? `<button class="btn" data-act="analyse">📈<span>${esc(s.analysis.open)}</span></button>` : ''}`;
    controls.querySelectorAll<HTMLButtonElement>('button').forEach(b => (b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'toggle') { this.running = !this.running; this.persist(); this.render(); if (this.running) this.schedule(50); }
      else if (act === 'step') { this.stepOnce = true; this.think(); }
      else if (act === 'new') this.newGame();
      else if (act === 'analyse') this.analyse();
    }));

    // Live settings: level per side, speed, flip
    const box = this.el.querySelector<HTMLElement>('.watch-settings')!;
    const levelSeg = (side: 0 | 1) => `<div class="seg" data-side="${side}">${LEVELS.map(l => `<button data-l="${l}" class="${l === this.levels()[side] ? 'on' : ''}">${esc(s[l])}</button>`).join('')}</div>`;
    box.innerHTML = `
      <div class="row"><span>${esc(this.sideName(0))}</span>${levelSeg(0)}</div>
      <div class="row"><span>${esc(this.sideName(1))}</span>${levelSeg(1)}</div>
      <div class="row"><span>${esc(W.speed)}</span><div class="seg speed">${(['slow', 'normal', 'fast'] as WatchSpeed[]).map(v => `<button data-v="${v}" class="${v === settings.watchSpeed ? 'on' : ''}">${esc(W[v])}</button>`).join('')}</div></div>
      <div class="row"><span></span><button class="btn" data-act="flip">⇅ ${esc(s.flip)}</button></div>`;
    box.querySelectorAll<HTMLElement>('.seg[data-side]').forEach(seg => seg.querySelectorAll<HTMLButtonElement>('button').forEach(b => (b.onclick = () => {
      const side = Number(seg.dataset.side) as 0 | 1;
      settings.watchLevels = [...settings.watchLevels] as [Level, Level];
      settings.watchLevels[side] = b.dataset.l as Level;
      saveSettings();
      this.render();
    })));
    box.querySelectorAll<HTMLButtonElement>('.speed button').forEach(b => (b.onclick = () => {
      settings.watchSpeed = b.dataset.v as WatchSpeed;
      saveSettings();
      this.render();
    }));
    box.querySelector<HTMLButtonElement>('[data-act="flip"]')!.onclick = () => { this.flipped = !this.flipped; this.render(); };

    // Players
    const bottom = this.flipped ? 1 : 0;
    for (const [sel, side] of [['.bottom-player', bottom], ['.top-player', bottom ^ 1]] as const) {
      const bar = this.el.querySelector<HTMLElement>(sel)!;
      const caps = m.captured.filter(p => ((p >> 3) & 1) !== side).map(p => p & 7).sort((x, y) => y - x);
      const icons = caps.map(type => m.isChess
        ? `<span class="cap-chess ${side ? 'w' : 'b'}">${chessGlyph(type)}</span>`
        : `<span class="cap-xq ${side ? 'r' : 'b'}">${xiangqiLabel(type, side ^ 1, 'hanzi')}</span>`).join('');
      bar.classList.toggle('turn', !outcome && m.side === side);
      bar.innerHTML = `<span class="pname"><span class="dot side-${side} ${m.isChess ? 'chess' : 'xq'}"></span>${esc(this.sideName(side))}<span class="who">🤖 ${esc(s[this.levels()[side as 0 | 1]])}</span></span><span class="caps">${icons}</span>`;
    }

    // Moves with quality marks
    this.el.querySelector('.moves-title')!.textContent = s.moves;
    const ol = this.el.querySelector<HTMLElement>('.moves')!;
    if (!m.notes.length) ol.innerHTML = `<li class="empty">${esc(s.noMoves)}</li>`;
    else {
      const cell = (i: number) => {
        if (i >= m.notes.length) return '<span></span>';
        const q = this.quality[i];
        const mark = q ? `<em class="q ${q}" title="${esc(W.quality[q])}">${MARK[q]}</em>` : '';
        return `<span class="${i === m.notes.length - 1 ? 'cur' : ''}">${esc(m.notes[i][settings.lang])}${mark}</span>`;
      };
      const rows: string[] = [];
      for (let i = 0; i < m.notes.length; i += 2) rows.push(`<li><span class="n">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</li>`);
      ol.innerHTML = rows.join('');
      ol.scrollTop = ol.scrollHeight;
    }
    const legend = Object.entries(MARK).filter(([, v]) => v).map(([k, v]) => `<span><em class="q ${k}">${v}</em> ${esc(W.quality[k as Quality])}</span>`).join('');
    if (!ol.nextElementSibling) ol.insertAdjacentHTML('afterend', `<p class="q-legend small muted">${legend}</p>`);
    else ol.nextElementSibling.innerHTML = legend;

    this.board.render(m, {
      flipped: this.flipped, selected: null, targets: new Map(), labels: settings.labels,
      river: settings.labels === 'hanzi' ? ['楚 河', '漢 界'] : ['Sở Hà', 'Hán Giới'],
    }, animate, intro);
    this.board.svg.classList.add('locked');
  }
}
