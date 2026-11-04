/** The game screen: board, side panel, bot, and online play. */
import { Match } from '../game';
import type { Level } from '../engine/ai';
import type { GameKind, Outcome } from '../engine/types';
import { newRoomId, OnlineSession, type NetMsg } from '../online';
import { playSound } from '../sound';
import { saveSettings, settings, store, t, type Mode, type SavedGame } from '../state';
import { BoardRenderer, chessGlyph, xiangqiLabel } from './board';
import { confirmDialog, openDialog, toast } from './dialog';
import { gameThumb, type Nav, type Screen } from './home';

type UIOutcome = Outcome | { winner: 0 | 1; reason: 'resign' };

let worker: Worker | null = null;
let requestSeq = 0;
function getWorker(): Worker {
  worker ??= new Worker(new URL('../engine/ai.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

interface HostSave { match: ReturnType<Match['save']>; hostSide: 0 | 1; resigned: number | null }

export interface PlayOptions {
  kind: GameKind;
  mode: Mode;
  /** Online: room id; role decides host or guest. */
  room?: string;
  role?: 'host' | 'guest';
}

const ICON = {
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export class PlayScreen implements Screen {
  readonly el: HTMLElement;
  private match: Match;
  private board: BoardRenderer;
  private flipped = false;
  private selected: number | null = null;
  private pendingPromotion: number[] | null = null;
  private thinking = false;
  private req = 0;
  private humanSide: 0 | 1 = 0;
  private level: Level = settings.level;
  private hostSide: 0 | 1 = 0;
  private mySide: 0 | 1 | null = null;
  private resigned: number | null = null;
  private session: OnlineSession | null = null;
  private everConnected = false;
  private started: boolean;
  private overShown = false;
  private closeOver: (() => void) | null = null;
  private disposed = false;
  private readonly onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && this.opts.mode !== 'online') { e.preventDefault(); this.undo(); }
    if (e.key === 'Escape') { this.selected = null; this.pendingPromotion = null; this.render(); }
  };

  constructor(private opts: PlayOptions, private nav: Nav) {
    this.el = document.createElement('section');
    this.el.className = 'screen game';
    this.el.dataset.mode = opts.mode;
    this.el.innerHTML = `
      <div class="board-wrap">
        <div class="player top-player"></div>
        <div class="board-box"></div>
        <div class="player bottom-player"></div>
        <div class="promo" hidden></div>
        <div class="board-overlay" hidden></div>
      </div>
      <aside class="panel">
        <div class="game-title"><span class="thumb"></span><div><h1></h1><p class="mode-line"></p></div></div>
        <div class="status" aria-live="polite"></div>
        <div class="controls"></div>
        <div class="card level-card"></div>
        <div class="card net-card"></div>
        <details class="rules"><summary></summary><ul></ul></details>
        <div class="card"><h2 class="moves-title"></h2><ol class="moves"></ol></div>
      </aside>`;
    this.board = new BoardRenderer(this.q('.board-box'), sq => this.onCell(sq));
    document.addEventListener('keydown', this.onKey);

    const kind = opts.kind;
    if (opts.mode === 'online') {
      if (opts.role === 'host') {
        const saved = store.get<HostSave>('host:' + opts.room, true);
        if (saved && saved.match.kind === kind) {
          this.match = Match.restore(saved.match);
          this.hostSide = saved.hostSide;
          this.resigned = saved.resigned;
        } else {
          this.match = new Match(kind);
          this.hostSide = settings.onlineSide === 'random' ? (Math.random() < 0.5 ? 0 : 1) : settings.onlineSide;
        }
        this.mySide = this.hostSide;
        this.started = true;
        this.persist();
      } else {
        this.match = new Match(kind); // placeholder until the host sends the game
        this.started = false;
      }
      this.flipped = this.mySide === 1;
      this.connect();
    } else {
      const saved = store.get<SavedGame>('game:' + kind);
      if (saved && saved.mode === opts.mode && saved.match.kind === kind) {
        this.match = Match.restore(saved.match);
        this.humanSide = saved.humanSide;
        this.level = saved.level;
      } else {
        this.match = new Match(kind);
        this.humanSide = settings.humanSide;
        this.level = settings.level;
      }
      this.flipped = opts.mode === 'bot' && this.humanSide === 1;
      this.started = true;
      this.persist();
    }
    this.render(false, this.match.moves.length === 0);
    if (this.outcome()) this.overShown = true; // don't pop the dialog again for a finished saved game
    this.maybeBot();
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.el.querySelector<T>(sel)!;
  }

  dispose() {
    this.disposed = true;
    this.req = -1;
    this.session?.close();
    this.closeOver?.();
    document.removeEventListener('keydown', this.onKey);
  }

  // ---------- Game state ----------

  private outcome(): UIOutcome | null {
    if (this.resigned !== null) return { winner: (this.resigned ^ 1) as 0 | 1, reason: 'resign' };
    return this.match.outcome();
  }

  private persist() {
    if (this.opts.mode === 'online') {
      if (this.opts.role === 'host') store.set('host:' + this.opts.room, { match: this.match.save(), hostSide: this.hostSide, resigned: this.resigned } satisfies HostSave, true);
      return;
    }
    store.set('game:' + this.match.kind, {
      match: this.match.save(), mode: this.opts.mode as 'bot' | 'pvp', humanSide: this.humanSide, level: this.level, over: !!this.outcome(),
    } satisfies SavedGame);
  }

  private canMove(): boolean {
    if (!this.started || this.thinking || this.outcome()) return false;
    if (this.opts.mode === 'pvp') return true;
    if (this.opts.mode === 'bot') return this.match.side === this.humanSide;
    return this.session?.status === 'connected' && this.match.side === this.mySide;
  }

  private play(m: number, remote = false) {
    const reveal = this.match.pieceAt(this.match.moveFrom(m))?.hidden ?? false;
    const captures = this.match.captured.length;
    this.match.play(m);
    if (settings.sound) {
      if (this.outcome()) playSound('end');
      else if (this.match.checkedKing() !== null) playSound('check');
      else if (this.match.captured.length > captures) playSound('capture');
      else playSound(reveal ? 'reveal' : 'move');
    }
    if (this.opts.mode === 'online' && !remote) this.session?.send({ t: 'move', ply: this.match.moves.length - 1, move: m });
    this.selected = null;
    this.pendingPromotion = null;
    this.persist();
    this.render(true);
    this.checkOver();
    this.maybeBot();
  }

  private maybeBot() {
    if (this.opts.mode !== 'bot' || this.thinking || this.outcome() || this.match.side === this.humanSide) return;
    this.thinking = true;
    const id = (this.req = ++requestSeq);
    const w = getWorker();
    const started = Date.now();
    const onMsg = (e: MessageEvent<{ id: number; move?: number; error?: string }>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMsg);
      const apply = () => {
        if (this.req !== id || this.disposed) return;
        this.thinking = false;
        if (e.data.move !== undefined && this.match.legalMoves().includes(e.data.move)) this.play(e.data.move);
        else { console.error('Bot error', e.data.error); this.render(); }
      };
      window.setTimeout(apply, Math.max(0, 350 - (Date.now() - started)));
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, kind: this.match.kind, state: this.match.botState(), level: this.level });
    this.render();
  }

  private cancelBot() {
    this.req = -1;
    this.thinking = false;
  }

  private newGame() {
    if (this.opts.mode === 'online') {
      if (!this.outcome()) return;
      if (this.opts.role === 'guest') {
        this.session?.send({ t: 'rematch' });
        toast(t().rematch + ' ✓');
        return;
      }
      this.hostSide = (this.hostSide ^ 1) as 0 | 1; // swap colours each game
      this.mySide = this.hostSide;
      this.flipped = this.mySide === 1;
    }
    this.cancelBot();
    this.closeOver?.();
    this.match = new Match(this.match.kind);
    this.resigned = null;
    this.overShown = false;
    this.selected = null;
    this.pendingPromotion = null;
    if (this.opts.mode === 'bot') this.flipped = this.humanSide === 1;
    this.persist();
    if (this.opts.mode === 'online') this.sendStart();
    this.render(false, true);
    this.maybeBot();
  }

  private undo() {
    if (this.opts.mode === 'online' || !this.match.moves.length) return;
    this.cancelBot();
    this.match.undo();
    if (this.opts.mode === 'bot') while (this.match.moves.length && this.match.side !== this.humanSide) this.match.undo();
    this.overShown = !!this.outcome();
    this.selected = null;
    this.pendingPromotion = null;
    this.persist();
    this.render();
    this.maybeBot();
  }

  private async resign() {
    if (this.opts.mode !== 'online' || this.outcome() || this.mySide === null) return;
    const s = t();
    if (!(await confirmDialog(s.resignConfirm, s.resign, s.close))) return;
    this.resigned = this.mySide;
    this.session?.send({ t: 'resign', side: this.mySide });
    if (settings.sound) playSound('end');
    this.persist();
    this.render();
    this.checkOver();
  }

  private onCell(sq: number) {
    if (!this.canMove()) return;
    this.pendingPromotion = null;
    const legal = this.match.legalMoves();
    if (this.selected !== null) {
      const choices = legal.filter(m => this.match.moveFrom(m) === this.selected && this.match.moveTo(m) === sq);
      if (choices.length === 1) return this.play(choices[0]);
      if (choices.length > 1) { this.pendingPromotion = choices; return this.render(); }
    }
    const p = this.match.pieceAt(sq);
    this.selected = p && p.color === this.match.side && sq !== this.selected && legal.some(m => this.match.moveFrom(m) === sq) ? sq : null;
    this.render();
  }

  // ---------- Online ----------

  private roomLink(): string {
    return `${location.origin}${location.pathname}${location.search}#/join/${this.opts.room}`;
  }

  private connect() {
    const room = this.opts.room ?? newRoomId();
    const session = this.opts.role === 'host' ? OnlineSession.host(room) : OnlineSession.join(room);
    this.session = session;
    session.onStatus = st => {
      if (st === 'connected') this.everConnected = true;
      this.render();
    };
    session.onMessage = msg => this.onNet(msg);
  }

  private sendStart() {
    if (this.opts.role !== 'host') return;
    this.session?.send({
      t: 'start', kind: this.match.kind, initial: this.match.initial, moves: [...this.match.moves],
      hostSide: this.hostSide, resigned: this.resigned,
    });
  }

  private onNet(msg: NetMsg) {
    switch (msg.t) {
      case 'hello':
        this.sendStart();
        break;
      case 'start': {
        if (this.opts.role !== 'guest') return;
        const fresh = msg.moves.length === 0;
        this.match = Match.restore({ kind: msg.kind, initial: msg.initial, moves: msg.moves });
        this.hostSide = msg.hostSide;
        this.mySide = (msg.hostSide ^ 1) as 0 | 1;
        this.resigned = msg.resigned;
        this.flipped = this.mySide === 1;
        this.selected = null;
        this.pendingPromotion = null;
        const wasStarted = this.started;
        this.started = true;
        if (fresh) { this.overShown = false; this.closeOver?.(); }
        else this.overShown = !!this.outcome();
        this.render(false, fresh || !wasStarted);
        break;
      }
      case 'move':
        if (msg.ply === this.match.moves.length && this.match.side !== this.mySide && this.match.legalMoves().includes(msg.move)) {
          this.play(msg.move, true);
        } else if (msg.ply > this.match.moves.length - 1) {
          // Out of sync (missed a message): ask for / send the full game again.
          if (this.opts.role === 'guest') this.session?.send({ t: 'hello', v: 1 });
          else this.sendStart();
        }
        break;
      case 'resign':
        if (this.outcome() || msg.side === this.mySide) return;
        this.resigned = msg.side;
        if (settings.sound) playSound('end');
        this.persist();
        this.render();
        this.checkOver();
        break;
      case 'rematch':
        if (this.opts.role === 'host' && this.outcome()) this.newGame();
        break;
    }
  }

  private async copyLink() {
    const s = t();
    try { await navigator.clipboard.writeText(this.roomLink()); toast(s.copied); }
    catch {
      const input = this.el.querySelector<HTMLInputElement>('.link-input');
      input?.select();
      document.execCommand?.('copy');
      toast(s.copied);
    }
  }

  private shareLink() {
    const s = t();
    navigator.share?.({ title: 'Bàn Cờ', text: s.shareText, url: this.roomLink() }).catch(() => {});
  }

  private linkBox(): string {
    const s = t();
    const share = 'share' in navigator ? `<button class="btn" data-act="share">${ICON.share}<span>${s.share}</span></button>` : '';
    return `<div class="link-row"><input class="link-input" readonly value="${this.roomLink()}" aria-label="link" />
      <button class="btn primary" data-act="copy">${ICON.copy}<span>${s.copy}</span></button>${share}</div>`;
  }

  // ---------- Game over ----------

  private checkOver() {
    const o = this.outcome();
    if (!o || this.overShown) return;
    this.overShown = true;
    const s = t();
    window.setTimeout(() => {
      if (this.disposed || !this.outcome() || this.closeOver) return;
      const me = this.opts.mode === 'bot' ? this.humanSide : this.opts.mode === 'online' ? this.mySide : null;
      let title: string, icon: string;
      if (o.winner === null) { title = s.draw; icon = '🤝'; }
      else if (me === null) { title = s.wins(this.sideName(o.winner)); icon = '🏆'; }
      else if (o.winner === me) { title = s.youWin; icon = '🏆'; }
      else { title = s.youLose; icon = '😔'; }
      const reason = o.reason === 'resign' ? s.resignReason : s[o.reason];
      const online = this.opts.mode === 'online';
      this.closeOver = openDialog({
        title, icon, className: 'over-dlg',
        body: reason.charAt(0).toUpperCase() + reason.slice(1),
        actions: [
          { label: s.home, kind: 'ghost', onClick: () => this.nav.go('#/', 'back') },
          { label: s.reviewBoard },
          { label: online ? s.rematch : s.newGame, kind: 'primary', onClick: () => this.newGame() },
        ],
        onClose: () => { this.closeOver = null; },
      });
    }, 650);
  }

  // ---------- Rendering ----------

  private sideName(side: number): string {
    const s = t();
    return side === 0 ? (this.match.isChess ? s.white : s.red) : s.black;
  }

  private render(animate = false, intro = false) {
    if (this.disposed) return;
    const s = t();
    const m = this.match;
    const mode = this.opts.mode;
    const outcome = this.outcome();

    this.el.dataset.kind = m.kind;
    this.q('.game-title .thumb').innerHTML = gameThumb(m.kind);
    this.q('.game-title h1').textContent = s[m.kind];
    const red = this.sideName(0);
    this.q('.mode-line').textContent = mode === 'bot'
      ? `${s.bot} · ${s.youPlay.toLowerCase()} ${this.sideName(this.humanSide)}`
      : mode === 'pvp' ? s.pvp
      : `${s.online}${this.mySide !== null && this.started ? ` · ${s.youPlay.toLowerCase()} ${this.mySide === 0 ? red : s.black}` : ''}`;

    // Status
    let status: string, cls = '';
    if (!this.started) { status = s.connecting; cls = 'thinking'; }
    else if (mode === 'online' && !outcome && this.session?.status !== 'connected') {
      status = this.session?.status === 'error' ? s.netError
        : this.session?.status === 'reconnecting' ? s.reconnecting
        : this.everConnected ? s.friendLeft : this.session?.status === 'opening' ? s.opening : s.waitingFriend;
      cls = 'thinking';
    }
    else if (outcome) {
      const reason = outcome.reason === 'resign' ? s.resignReason : s[outcome.reason];
      status = outcome.winner === null ? `${s.draw} — ${reason}` : `${s.wins(this.sideName(outcome.winner))} — ${reason}`;
      cls = 'over';
    } else if (this.thinking) { status = s.thinking; cls = 'thinking'; }
    else {
      const check = m.checkedKing() !== null;
      status = mode === 'online' ? (m.side === this.mySide ? s.yourTurn : s.friendTurn) : s.toMove(this.sideName(m.side));
      if (check) { status += ` · ${s.check}`; cls = 'check'; }
    }
    const st = this.q('.status');
    st.className = 'status ' + cls;
    st.innerHTML = `<span class="dot side-${m.side} ${m.isChess ? 'chess' : 'xq'}"></span><span>${status}</span>`;

    // Controls
    const controls = this.q('.controls');
    const btn = (act: string, icon: string, label: string, disabled = false, primary = false) =>
      `<button class="btn${primary ? ' primary' : ''}" data-act="${act}"${disabled ? ' disabled' : ''}>${icon}<span>${label}</span></button>`;
    controls.innerHTML = mode === 'online'
      ? btn('flip', ICON.flip, s.flip) + btn('resign', ICON.flag, s.resign, !!outcome || !this.started || !this.everConnected)
        + btn('new', ICON.plus, s.rematch, !outcome || this.session?.status !== 'connected', !!outcome)
      : btn('undo', ICON.undo, s.undo, m.moves.length === 0) + btn('flip', ICON.flip, s.flip) + btn('new', ICON.plus, s.newGame, false, !!outcome);
    controls.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
      b.onclick = () => {
        const act = b.dataset.act;
        if (act === 'undo') this.undo();
        else if (act === 'flip') { this.flipped = !this.flipped; this.render(); }
        else if (act === 'new') this.newGame();
        else if (act === 'resign') void this.resign();
      };
    });

    // Bot level
    const lc = this.q('.level-card');
    lc.hidden = mode !== 'bot';
    if (mode === 'bot') {
      lc.innerHTML = `<div class="row"><span>${s.level}</span><div class="seg">${(['easy', 'medium', 'hard'] as Level[])
        .map(l => `<button data-l="${l}" class="${l === this.level ? 'on' : ''}" aria-pressed="${l === this.level}">${s[l]}</button>`).join('')}</div></div>`;
      lc.querySelectorAll<HTMLButtonElement>('button').forEach(b => (b.onclick = () => {
        this.level = b.dataset.l as Level;
        settings.level = this.level;
        saveSettings();
        this.persist();
        this.render();
      }));
    }

    // Online card + overlay
    const nc = this.q('.net-card');
    nc.hidden = mode !== 'online';
    const overlay = this.q('.board-overlay');
    overlay.hidden = true;
    if (mode === 'online' && this.session) {
      const ns = this.session.status;
      const err = this.session.error;
      const label = ns === 'connected' ? s.connected
        : ns === 'waiting' ? (this.everConnected ? s.friendLeft : s.waitingFriend)
        : ns === 'opening' ? s.opening : ns === 'connecting' ? s.connecting
        : ns === 'reconnecting' ? s.reconnecting : s.netError;
      nc.innerHTML = `<div class="net-status ${ns}"><span class="net-dot"></span><span>${label}</span></div>
        ${this.opts.role === 'host' ? this.linkBox() : ''}`;
      const errText = err === 'room-not-found' ? s.errRoom : err === 'network' ? s.errNetwork : err === 'server' ? s.errServer : s.errNetwork;
      if (ns === 'error') {
        overlay.hidden = false;
        overlay.innerHTML = `<div class="ov-card"><div class="ov-icon">⚠️</div><h2>${s.netError}</h2><p>${errText}</p>
          <div class="ov-actions"><button class="btn ghost" data-act="home">${s.home}</button><button class="btn primary" data-act="retry">${s.retry}</button></div></div>`;
      } else if (this.opts.role === 'host' && !this.everConnected && m.moves.length === 0) {
        overlay.hidden = false;
        overlay.innerHTML = `<div class="ov-card"><div class="ov-icon pulse">🔗</div><h2>${s.roomTitle}</h2><p>${s.roomHint}</p>
          ${this.linkBox()}<p class="ov-wait"><span class="spinner"></span>${ns === 'opening' ? s.opening : s.waitingFriend}</p></div>`;
      } else if (this.opts.role === 'guest' && !this.started) {
        overlay.hidden = false;
        overlay.innerHTML = `<div class="ov-card"><p class="ov-wait big"><span class="spinner"></span>${ns === 'opening' || ns === 'connecting' ? s.connecting : label}</p></div>`;
      }
      this.el.querySelectorAll<HTMLButtonElement>('[data-act="copy"]').forEach(b => (b.onclick = () => void this.copyLink()));
      this.el.querySelectorAll<HTMLButtonElement>('[data-act="share"]').forEach(b => (b.onclick = () => this.shareLink()));
      overlay.querySelector<HTMLButtonElement>('[data-act="retry"]')?.addEventListener('click', () => { this.session?.retry(); this.render(); });
      overlay.querySelector<HTMLButtonElement>('[data-act="home"]')?.addEventListener('click', () => this.nav.go('#/', 'back'));
    }

    // Rules
    const rules = this.q<HTMLDetailsElement>('.rules');
    rules.hidden = m.kind !== 'jieqi';
    rules.querySelector('summary')!.textContent = s.rulesTitle;
    rules.querySelector('ul')!.innerHTML = s.rules.map(r => `<li>${r}</li>`).join('');

    // Players
    const bottom = this.flipped ? 1 : 0;
    this.renderPlayer(this.q('.bottom-player'), bottom);
    this.renderPlayer(this.q('.top-player'), bottom ^ 1);

    // Moves
    this.q('.moves-title').textContent = s.moves;
    const ol = this.q('.moves');
    if (!m.notes.length) ol.innerHTML = `<li class="empty">${s.noMoves}</li>`;
    else {
      const rows: string[] = [];
      for (let i = 0; i < m.notes.length; i += 2) {
        const a = m.notes[i][settings.lang], b = m.notes[i + 1]?.[settings.lang] ?? '';
        const lastA = i === m.notes.length - 1, lastB = i + 1 === m.notes.length - 1;
        rows.push(`<li><span class="n">${i / 2 + 1}.</span><span class="${lastA ? 'cur' : ''}">${a}</span><span class="${lastB ? 'cur' : ''}">${b}</span></li>`);
      }
      ol.innerHTML = rows.join('');
      ol.scrollTop = ol.scrollHeight;
    }

    // Board
    const targets = new Map<number, boolean>();
    if (this.selected !== null) {
      for (const mv of m.legalMoves()) {
        if (m.moveFrom(mv) === this.selected) targets.set(m.moveTo(mv), m.pieceAt(m.moveTo(mv)) !== null);
      }
    }
    this.board.render(m, {
      flipped: this.flipped, selected: this.selected, targets, labels: settings.labels,
      river: settings.labels === 'hanzi' ? ['楚 河', '漢 界'] : ['Sở Hà', 'Hán Giới'],
    }, animate, intro);
    this.board.svg.setAttribute('aria-label', `${s[m.kind]} — ${status}`);
    this.board.svg.classList.toggle('locked', !this.canMove());

    // Promotion picker
    const promo = this.q('.promo');
    if (this.pendingPromotion) {
      promo.hidden = false;
      promo.innerHTML = `<p>${s.promote}</p>` + this.pendingPromotion
        .map(mv => `<button class="cp-btn ${m.side ? 'b' : 'w'}" data-m="${mv}">${chessGlyph(m.movePromo(mv))}</button>`).join('');
      promo.querySelectorAll<HTMLButtonElement>('button').forEach(b => (b.onclick = () => this.play(Number(b.dataset.m))));
    } else promo.hidden = true;
  }

  private renderPlayer(el: HTMLElement, side: number) {
    const s = t();
    const m = this.match;
    const mode = this.opts.mode;
    let who = '';
    if (mode === 'bot') who = side === this.humanSide ? `🙂 ${s.you}` : `🤖 ${s[this.level]}`;
    else if (mode === 'online' && this.started) who = side === this.mySide ? `🙂 ${s.you}` : `👋 ${s.friend}`;
    const caps = m.captured.filter(p => ((p >> 3) & 1) !== side).map(p => p & 7).sort((a, b) => b - a);
    const icons = caps.map(type => m.isChess
      ? `<span class="cap-chess ${side ? 'w' : 'b'}">${chessGlyph(type)}</span>`
      : `<span class="cap-xq ${side ? 'r' : 'b'}">${xiangqiLabel(type, side ^ 1, 'hanzi')}</span>`).join('');
    const turn = this.started && !this.outcome() && m.side === side;
    el.classList.toggle('turn', turn);
    el.innerHTML = `<span class="pname"><span class="dot side-${side} ${m.isChess ? 'chess' : 'xq'}"></span>${this.sideName(side)}${who ? `<span class="who">${who}</span>` : ''}</span><span class="caps" title="${s.captured}">${icons}</span>`;
  }

  /** Re-render after a settings change (language, labels, colours). */
  refresh() {
    this.render();
  }
}
