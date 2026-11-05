/**
 * Post-game analysis: an engine evaluates every position of a finished game,
 * marks each move (best … blunder), shows the better move with an arrow,
 * draws the evaluation graph and gives each side an accuracy score.
 */
import { Match, type Reveal } from '../game';
import type { AIResult, Level } from '../engine/ai';
import { isHiddenKind, type GameKind, type Outcome } from '../engine/types';
import type { XiangqiJSON } from '../engine/xiangqi';
import { QUALITY_MARK, isMateScore, mateIn, summarize, toWhite, winPercent, type PlyEval, type Quality } from '../analysis';
import { settings, t } from '../state';
import { BoardRenderer, chessGlyph, xiangqiLabel } from './board';
import { gameThumb, type Nav, type Screen } from './home';
import { moveSfx } from './sfx';
import { esc } from './util';
import { gameKey, reportQuest } from './quests';

export interface AnalysisPlayer {
  /** Online account name and rating. */
  name?: string;
  rating?: number;
  bot?: Level;
  you?: boolean;
}

export interface AnalysisInput {
  kind: GameKind;
  initial: string | XiangqiJSON;
  moves: ({ m: number } & Reveal)[];
  /** Who played each side (White/Red first); labels are built in the current language. */
  players: [AnalysisPlayer, AnalysisPlayer];
  result: Outcome | null;
  /** Where the back button returns to. */
  back: string;
}

const KEY = 'banco:analysis';
let memory: AnalysisInput | null = null;

/** Hand a game to the analysis screen and open it. */
export function openAnalysis(nav: Nav, input: AnalysisInput) {
  memory = input;
  try { sessionStorage.setItem(KEY, JSON.stringify(input)); } catch { /* private mode: memory only */ }
  nav.go('#/analysis');
}

export function pendingAnalysis(): AnalysisInput | null {
  if (memory) return memory;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as AnalysisInput;
  } catch { /* ignore */ }
  return memory;
}

type Depth = 'quick' | 'deep';
const THINK_MS: Record<Depth, number> = { quick: 350, deep: 1500 };

interface Job { ply: number; state: string | XiangqiJSON; side: 0 | 1 }

export class AnalysisScreen implements Screen {
  readonly el: HTMLElement;
  private board: BoardRenderer | null = null;
  private input: AnalysisInput | null;
  private ply = 0;
  private flipped = false;
  private showBest = true;
  private depth: Depth = 'quick';
  private disposed = false;
  // Positions of the game
  private full!: Match;
  private states: (string | XiangqiJSON)[] = [];
  private sides: (0 | 1)[] = [];
  private terminal: (Outcome | null)[] = [];
  private firstSide: 0 | 1 = 0;
  // Engine
  private evals: (PlyEval | undefined)[] = [];
  private queue: Job[] = [];
  private workers: { w: Worker; busy: boolean }[] = [];
  private gen = 0;
  private done = 0;
  private toDo = 0;
  private seq = 0;
  private reported = false;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const n = this.input?.moves.length ?? 0;
    if (e.key === 'ArrowLeft') this.go(this.ply - 1);
    else if (e.key === 'ArrowRight') this.go(this.ply + 1, true);
    else if (e.key === 'Home') this.go(0);
    else if (e.key === 'End') this.go(n);
    else return;
    e.preventDefault();
  };

  constructor(private nav: Nav) {
    this.input = pendingAnalysis();
    this.el = document.createElement('section');
    this.el.className = 'screen game analysis';
    if (!this.input || !this.build(this.input)) {
      this.input = null;
      this.el.innerHTML = `<div class="card empty-analysis"><p></p><a class="btn primary" href="#/"></a></div>`;
      this.renderEmpty();
      return;
    }
    const kind = this.input.kind;
    this.el.dataset.kind = kind;
    this.el.innerHTML = `
      <div class="board-wrap">
        <div class="player top-player"></div>
        <div class="board-box"></div>
        <div class="player bottom-player"></div>
        <div class="an-nav"></div>
      </div>
      <aside class="panel">
        <div class="game-title"><span class="thumb">${gameThumb(kind)}</span><div><h1></h1><p class="mode-line"></p></div></div>
        <div class="status over"></div>
        <div class="card an-summary"></div>
        <div class="card an-graph-card"><h2 class="an-graph-title"></h2><div class="an-graph"></div><p class="an-progress small muted"></p></div>
        <div class="card an-current"></div>
        <div class="card an-settings"></div>
        <div class="card"><h2 class="moves-title"></h2><ol class="moves"></ol><p class="q-legend small muted"></p></div>
      </aside>`;
    this.board = new BoardRenderer(this.el.querySelector('.board-box')!, () => {});
    this.ply = this.input.moves.length;
    document.addEventListener('keydown', this.onKey);
    this.start();
    this.render(false, true);
  }

  /** Replay the game once, keeping every position for the engine. */
  private build(input: AnalysisInput): boolean {
    try {
      const m = new Match(input.kind, input.initial);
      this.firstSide = m.side as 0 | 1;
      const record = () => {
        this.states.push(m.botState());
        this.sides.push(m.side as 0 | 1);
        this.terminal.push(m.outcome());
      };
      record();
      for (const mv of input.moves) {
        if (!m.pos.legalMoves().includes(mv.m)) break;
        m.playRevealed(mv.m, mv);
        record();
      }
      input.moves = input.moves.slice(0, m.moves.length);
      this.full = m;
      return true;
    } catch {
      return false;
    }
  }

  dispose() {
    this.disposed = true;
    document.removeEventListener('keydown', this.onKey);
    for (const { w } of this.workers) w.terminate();
    this.workers = [];
  }

  refresh() {
    if (!this.input) this.renderEmpty();
    else this.render();
  }

  // ---------- Engine ----------

  private start() {
    const n = Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('../engine/ai.worker.ts', import.meta.url), { type: 'module' });
      this.workers.push({ w, busy: false });
    }
    this.enqueueAll();
  }

  private enqueueAll() {
    this.gen++;
    this.queue = [];
    this.done = 0;
    this.toDo = 0;
    for (let ply = 0; ply < this.states.length; ply++) {
      const o = this.terminal[ply];
      if (o) {
        // Finished positions need no engine: mate is mate, a draw is 0.
        this.evals[ply] = { white: o.winner === null ? 0 : o.winner === 0 ? 10000 : -10000, best: null, pv: [], depth: 0 };
        continue;
      }
      this.queue.push({ ply, state: this.states[ply], side: this.sides[ply] });
      this.toDo++;
    }
    this.pump();
  }

  private pump() {
    if (this.disposed) return;
    for (const slot of this.workers) {
      if (slot.busy || !this.queue.length) continue;
      // The position on screen first, then the rest in order.
      let k = this.queue.findIndex(j => j.ply === this.ply);
      if (k < 0) k = 0;
      const job = this.queue.splice(k, 1)[0];
      slot.busy = true;
      const id = ++this.seq, gen = this.gen;
      const onMsg = (e: MessageEvent<AIResult & { id: number; error?: string }>) => {
        if (e.data.id !== id) return;
        slot.w.removeEventListener('message', onMsg);
        slot.busy = false;
        if (this.disposed) return;
        if (gen === this.gen) {
          this.done++;
          if (this.done === this.toDo && !this.reported) {
            this.reported = true;
            reportQuest({ type: 'analysis', key: 'an:' + gameKey(this.input!.initial, this.input!.moves.map(m => m.m)) });
          }
          if (!e.data.error) {
            const r = e.data;
            this.evals[job.ply] = { white: toWhite(r.score, job.side), best: r.move || null, pv: r.pv, depth: r.depth };
          }
          this.render();
        }
        this.pump();
      };
      slot.w.addEventListener('message', onMsg);
      slot.w.postMessage({ id, kind: this.input!.kind, state: job.state, level: 'hard', timeMs: THINK_MS[this.depth] });
    }
  }

  // ---------- Navigation ----------

  private matchAt(ply: number): Match {
    const inp = this.input!;
    return Match.restoreRevealed(inp.kind, inp.initial, inp.moves.slice(0, ply));
  }

  private go(ply: number, sound = false) {
    const n = this.input!.moves.length;
    ply = Math.max(0, Math.min(n, ply));
    if (ply === this.ply) return;
    const step = ply === this.ply + 1;
    this.ply = ply;
    if (step && sound) {
      const before = this.matchAt(ply - 1);
      const mv = this.input!.moves[ply - 1];
      const caps = before.captured.length;
      const reveal = before.pieceAt(before.moveFrom(mv.m))?.hidden ?? false;
      before.playRevealed(mv.m, mv);
      moveSfx(before, mv.m, caps, reveal, ply === n && !!this.input!.result);
    }
    this.render(step);
  }

  /** Notation of a line starting in the position after `ply` moves. */
  private line(ply: number, pv: number[], max = 8): string[] {
    const out: string[] = [];
    try {
      const m = this.matchAt(ply);
      for (const mv of pv.slice(0, max)) {
        if (!m.pos.legalMoves().includes(mv)) break;
        m.play(mv);
        // A suggested move does not reveal anything: the engine does not know face-down pieces.
        out.push(m.notes[m.notes.length - 1][settings.lang].replace(/→.*$/, ''));
      }
    } catch { /* hidden pieces without an identity: stop the line */ }
    return out;
  }

  // ---------- Rendering ----------

  private sideName(side: number): string {
    const s = t();
    return side === 0 ? (this.full.isChess ? s.white : s.red) : s.black;
  }

  private playerName(side: 0 | 1): string {
    const s = t();
    const p = this.input!.players?.[side] ?? {};
    if (p.name) return p.rating ? `${p.name} (${p.rating})` : p.name;
    const who = p.bot ? `🤖 ${s[p.bot]}` : p.you ? s.you : '';
    return who ? `${this.sideName(side)} · ${who}` : this.sideName(side);
  }

  private evalText(v: number): string {
    const W = t().watch;
    if (isMateScore(v)) {
      const winner = v > 0 ? 0 : 1;
      return W.mateIn(this.sideName(winner), Math.abs(mateIn(v)));
    }
    const pawns = v / 100;
    const num = `(${pawns > 0 ? '+' : ''}${pawns.toFixed(1)})`;
    if (Math.abs(pawns) < 0.3) return `${W.equal} ${num}`;
    const size = Math.abs(pawns) < 1 ? W.slightly : Math.abs(pawns) < 3 ? W.clearly : W.winning;
    return `${W.better(this.sideName(pawns > 0 ? 0 : 1), size)} ${num}`;
  }

  private resultText(): string {
    const s = t();
    const o = this.input!.result;
    if (!o) return s.analysis.notOver;
    const reason = s.reasons[o.reason];
    return o.winner === null ? `${s.draw} — ${reason}` : `${s.wins(this.sideName(o.winner))} — ${reason}`;
  }

  private renderEmpty() {
    const s = t();
    this.el.querySelector('.empty-analysis p')!.textContent = s.analysis.noGame;
    this.el.querySelector('.empty-analysis a')!.textContent = s.home;
  }

  private graph(quality: (Quality | null)[]): string {
    const n = this.input!.moves.length;
    const W = 600, H = 120;
    const x = (i: number) => (n ? (i / n) * W : W / 2);
    const y = (v: number) => H * (1 - winPercent(v) / 100);
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const e = this.evals[i];
      if (e) pts.push([x(i), y(e.white)]);
    }
    const area = pts.length
      ? `<path class="g-area" d="M${pts[0][0].toFixed(1)},${H} ${pts.map(([a, b]) => `L${a.toFixed(1)},${b.toFixed(1)}`).join(' ')} L${pts[pts.length - 1][0].toFixed(1)},${H} Z"/>`
      : '';
    const dots = quality.map((q, i) => {
      const e = this.evals[i + 1];
      if (!e || !q || (q !== 'mistake' && q !== 'blunder')) return '';
      return `<circle class="q-dot ${q}" cx="${x(i + 1).toFixed(1)}" cy="${y(e.white).toFixed(1)}" r="5"/>`;
    }).join('');
    const cur = x(this.ply);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="${this.full.isChess ? 'chess' : 'xq'}" role="img" aria-label="${esc(t().analysis.graph)}">
      <rect class="g-bg" width="${W}" height="${H}"/>${area}
      <line class="g-mid" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>
      <line class="g-cur" x1="${cur}" y1="0" x2="${cur}" y2="${H}"/>${dots}</svg>`;
  }

  private render(animate = false, intro = false) {
    if (this.disposed || !this.input) return;
    const s = t();
    const A = s.analysis, Wt = s.watch;
    const inp = this.input;
    const n = inp.moves.length;
    const sum = summarize(this.evals, n, this.firstSide);
    const q = (sel: string) => this.el.querySelector<HTMLElement>(sel)!;

    q('.game-title h1').textContent = `${A.title} · ${s[inp.kind]}`;
    q('.mode-line').textContent = `${this.playerName(0)} vs ${this.playerName(1)}`;
    q('.status').innerHTML = `<span>${esc(this.resultText())}</span>`;

    // Accuracy and mistake counts per side
    const acc = (v: number | null) => (v === null ? '…' : `${Math.round(v)}%`);
    const countCell = (side: 0 | 1, k: Quality) => `<td><em class="q ${k}">${sum.counts[side][k]}</em></td>`;
    const bad: Quality[] = ['inaccuracy', 'mistake', 'blunder'];
    q('.an-summary').innerHTML = `
      <h2>${esc(A.accuracy)}</h2>
      <table class="an-table">
        <thead><tr><th></th><th>${esc(A.accuracy)}</th>${bad.map(k => `<th title="${esc(Wt.quality[k])}"><em class="q ${k}">${QUALITY_MARK[k]}</em></th>`).join('')}</tr></thead>
        <tbody>${([0, 1] as const).map(side => `<tr><th><span class="dot side-${side} ${this.full.isChess ? 'chess' : 'xq'}"></span>${esc(this.playerName(side))}</th>
          <td class="acc">${acc(sum.accuracy[side])}</td>${bad.map(k => countCell(side, k)).join('')}</tr>`).join('')}</tbody>
      </table>
      ${isHiddenKind(inp.kind) ? `<p class="muted small">${esc(A.hiddenNote)}</p>` : ''}`;

    // Graph
    q('.an-graph-title').textContent = A.graph;
    const g = q('.an-graph');
    g.innerHTML = this.graph(sum.quality);
    g.onclick = (e: MouseEvent) => {
      const r = g.getBoundingClientRect();
      this.go(Math.round(((e.clientX - r.left) / r.width) * n));
    };
    q('.an-progress').textContent = this.done < this.toDo ? A.progress(this.done, this.toDo) : A.done(THINK_MS[this.depth] / 1000);

    // The position on screen: the move that led here, the evaluation, the best move now
    const ev = this.evals[this.ply];
    let html = '';
    if (this.ply === 0) html += `<h2>${esc(A.start)}</h2>`;
    else {
      const i = this.ply - 1;
      const note = this.full.notes[i][settings.lang];
      const quality = sum.quality[i];
      const num = `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}`;
      html += `<h2>${esc(A.moveBy(this.sideName((this.firstSide + i) % 2)))}</h2>
        <p class="an-move"><code>${esc(num)} ${esc(note)}</code>${quality ? ` <span class="q-badge ${quality}">${QUALITY_MARK[quality] ? `<em>${QUALITY_MARK[quality]}</em> ` : ''}${esc(Wt.quality[quality])}</span>` : ''}</p>`;
      const prev = this.evals[i];
      if (quality && bad.includes(quality) && prev?.best && prev.best !== inp.moves[i].m) {
        const better = this.line(i, [prev.best], 1)[0];
        if (better) html += `<p class="an-better">${esc(A.bestWas)} <code>${esc(better)}</code></p>`;
      }
    }
    const o = this.terminal[this.ply];
    if (o) html += `<p class="eval-text">${esc(s.reasons[o.reason].charAt(0).toUpperCase() + s.reasons[o.reason].slice(1))}</p>`;
    else if (ev) {
      const frac = winPercent(ev.white) / 100;
      html += `<div class="eval-bar ${this.full.isChess ? 'chess' : 'xq'}" role="img" aria-label="${esc(this.evalText(ev.white))}"><span style="width:${(frac * 100).toFixed(1)}%"></span></div>
        <p class="eval-text">${esc(this.evalText(ev.white))}</p>`;
      const pv = ev.pv.length ? ev.pv : ev.best ? [ev.best] : [];
      const line = this.line(this.ply, pv);
      if (line.length) html += `<p class="pv"><span class="muted small">${esc(A.bestNow(this.sideName(this.sides[this.ply])))}</span><br>${line.map((x, k) => `<code${k === 0 ? ' class="first"' : ''}>${esc(x)}</code>`).join(' ')}</p>`;
    } else html += `<p class="muted">${esc(A.thinking)}</p>`;
    q('.an-current').innerHTML = html;

    // Settings: depth, arrow, flip
    const box = q('.an-settings');
    box.innerHTML = `
      <div class="row"><span>${esc(A.depthLabel)}</span><div class="seg depth">${(['quick', 'deep'] as Depth[]).map(d => `<button data-d="${d}" class="${d === this.depth ? 'on' : ''}">${esc(A[d])}</button>`).join('')}</div></div>
      <label class="row check"><span>${esc(A.showBest)}</span><input type="checkbox"${this.showBest ? ' checked' : ''}></label>
      <div class="row"><a class="btn ghost" href="${esc(inp.back)}">← ${esc(A.backToGame)}</a><button class="btn" data-act="flip">⇅ ${esc(s.flip)}</button></div>`;
    box.querySelectorAll<HTMLButtonElement>('.depth button').forEach(b => (b.onclick = () => {
      const d = b.dataset.d as Depth;
      if (d === this.depth) return;
      this.depth = d;
      this.enqueueAll();
      this.render();
    }));
    box.querySelector<HTMLInputElement>('input')!.onchange = e => { this.showBest = (e.target as HTMLInputElement).checked; this.render(); };
    box.querySelector<HTMLButtonElement>('[data-act="flip"]')!.onclick = () => { this.flipped = !this.flipped; this.render(); };

    // Navigation under the board
    const navEl = q('.an-nav');
    const nb = (act: string, label: string, text: string, disabled: boolean) => `<button class="btn" data-act="${act}" aria-label="${esc(label)}" title="${esc(label)}"${disabled ? ' disabled' : ''}>${text}</button>`;
    navEl.innerHTML = nb('first', A.first, '⏮', this.ply === 0) + nb('prev', A.prev, '◀', this.ply === 0)
      + `<span class="an-ply">${this.ply}/${n}</span>`
      + nb('next', A.next, '▶', this.ply === n) + nb('last', A.last, '⏭', this.ply === n);
    navEl.querySelectorAll<HTMLButtonElement>('button').forEach(b => (b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'first') this.go(0);
      else if (act === 'prev') this.go(this.ply - 1);
      else if (act === 'next') this.go(this.ply + 1, true);
      else this.go(n);
    }));

    // Players with captured pieces at this point
    const shown = this.matchAt(this.ply);
    const bottom: 0 | 1 = this.flipped ? 1 : 0;
    for (const [sel, side] of [['.bottom-player', bottom], ['.top-player', (bottom ^ 1) as 0 | 1]] as const) {
      const bar = q(sel);
      const caps = shown.captured.filter(p => ((p >> 3) & 1) !== side).map(p => p & 7).sort((x, y) => y - x);
      const icons = caps.map(type => shown.isChess
        ? `<span class="cap-chess ${side ? 'w' : 'b'}">${chessGlyph(type)}</span>`
        : `<span class="cap-xq ${side ? 'r' : 'b'}">${xiangqiLabel(type, side ^ 1, 'hanzi')}</span>`).join('');
      bar.classList.toggle('turn', !this.terminal[this.ply] && shown.side === side);
      bar.innerHTML = `<span class="pname"><span class="dot side-${side} ${shown.isChess ? 'chess' : 'xq'}"></span><span class="nm">${esc(this.playerName(side))}</span><span class="who">${acc(sum.accuracy[side])}</span></span><span class="caps">${icons}</span>`;
    }

    // Move list: click a move to jump there
    q('.moves-title').textContent = s.moves;
    const ol = q('.moves');
    if (!n) ol.innerHTML = `<li class="empty">${esc(s.noMoves)}</li>`;
    else {
      const cell = (i: number) => {
        if (i >= n) return '<span></span>';
        const qq = sum.quality[i];
        const mark = qq && QUALITY_MARK[qq] ? `<em class="q ${qq}" title="${esc(Wt.quality[qq])}">${QUALITY_MARK[qq]}</em>` : '';
        return `<button type="button" class="mv${i === this.ply - 1 ? ' cur' : ''}" data-ply="${i + 1}">${esc(this.full.notes[i][settings.lang])}${mark}</button>`;
      };
      const rows: string[] = [];
      for (let i = 0; i < n; i += 2) rows.push(`<li><span class="n">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</li>`);
      const top = ol.scrollTop;
      ol.innerHTML = rows.join('');
      ol.scrollTop = top;
      ol.querySelectorAll<HTMLButtonElement>('.mv').forEach(b => (b.onclick = () => this.go(Number(b.dataset.ply), Number(b.dataset.ply) === this.ply + 1)));
      const cur = ol.querySelector<HTMLElement>('.cur');
      if (cur && (cur.offsetTop < ol.scrollTop || cur.offsetTop > ol.scrollTop + ol.clientHeight - 24)) ol.scrollTop = cur.offsetTop - ol.clientHeight / 2;
    }
    q('.q-legend').innerHTML = (Object.entries(QUALITY_MARK) as [Quality, string][]).filter(([, v]) => v)
      .map(([k, v]) => `<span><em class="q ${k}">${v}</em> ${esc(Wt.quality[k])}</span>`).join('');

    // Board with the best-move arrow
    const arrows: { from: number; to: number; kind: 'best' | 'played' }[] = [];
    if (this.showBest && ev?.best && !this.terminal[this.ply]) arrows.push({ from: shown.moveFrom(ev.best), to: shown.moveTo(ev.best), kind: 'best' });
    this.board!.render(shown, {
      flipped: this.flipped, selected: null, targets: new Map(), labels: settings.labels,
      river: settings.labels === 'hanzi' ? ['楚 河', '漢 界'] : ['Sở Hà', 'Hán Giới'],
      arrows,
    }, animate, intro);
    this.board!.svg.classList.add('locked');
    void this.nav;
  }
}
