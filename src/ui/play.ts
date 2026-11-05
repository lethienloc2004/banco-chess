/** The game screen: board, side panel, bot, and online rooms on the server. */
import { GameClock } from '../clock';
import { Match } from '../game';
import { LEVELS, type Level } from '../engine/ai';
import type { GameKind, Outcome } from '../engine/types';
import { net, ReSocket, type SocketStatus } from '../net';
import {
  CLAIM_AFTER_MS, CLOCKS, EMOTES, REPORT_REASONS, clockLabel, timeLeft,
  type ClientMsg, type RoomState, type ServerMsg,
} from '../shared/protocol';
import { playSound } from '../sound';
import { saveSettings, settings, store, t, type SavedGame } from '../state';
import { BoardRenderer, chessGlyph, xiangqiLabel } from './board';
import { moveSfx } from './sfx';
import { confirmDialog, openDialog, toast, type DialogAction } from './dialog';
import { openAnalysis, type AnalysisPlayer } from './analysis';
import { ACCOUNT_EVENT, openLogin } from './login';
import { gameKey, reportQuest } from './quests';
import { gameThumb, type Nav, type Screen } from './home';
import { esc, formatClock } from './util';

let worker: Worker | null = null;
let requestSeq = 0;
function getWorker(): Worker {
  worker ??= new Worker(new URL('../engine/ai.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

export interface PlayOptions {
  kind: GameKind;
  mode: 'bot' | 'pvp' | 'room';
  room?: string;
}

const ICON = {
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1V4.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.7-2.3L2.6 15a1.5 1.5 0 0 1 2.3-1.9L8 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18M7 15l4-4 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  report: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
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
  private overShown = false;
  // Local clock (bot / two-player games)
  private clock: GameClock | null = null;
  private flagged: Outcome | null = null;
  private lowWarned = [false, false];
  private closeOver: (() => void) | null = null;
  private disposed = false;
  // Online room
  private sock: ReSocket<ServerMsg, ClientMsg> | null = null;
  private room: RoomState | null = null;
  private clockOffset = 0;
  private pending = false;
  private tick = 0;
  private shownOverFor = 0;
  private lastYou: 0 | 1 | null | undefined = undefined;
  private readonly onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && this.opts.mode !== 'room') { e.preventDefault(); this.undo(); }
    if (e.key === 'Escape') { this.selected = null; this.pendingPromotion = null; this.render(); }
  };
  private readonly onVisible = () => { if (document.visibilityState === 'visible') this.sock?.kick(); };
  /** Signed in or out while in a room: reconnect so the server seats (or unseats) us. */
  private readonly onAccount = () => {
    if (!this.online || this.disposed) return;
    this.sock?.close();
    this.connectRoom();
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
        <div class="offer-card" hidden></div>
        <div class="controls"></div>
        <div class="card level-card"></div>
        <div class="card clock-card"></div>
        <div class="card net-card"></div>
        <details class="rules"><summary></summary><ul></ul></details>
        <div class="card"><h2 class="moves-title"></h2><ol class="moves"></ol></div>
      </aside>`;
    this.board = new BoardRenderer(this.q('.board-box'), sq => this.onCell(sq));
    document.addEventListener('keydown', this.onKey);

    const kind = opts.kind;
    if (opts.mode === 'room') {
      this.match = new Match(kind); // placeholder until the server sends the game
      this.connectRoom();
      document.addEventListener('visibilitychange', this.onVisible);
      window.addEventListener(ACCOUNT_EVENT, this.onAccount);
      this.tick = window.setInterval(() => this.updateClocks(), 200);
    } else {
      const saved = store.get<SavedGame>('game:' + kind);
      if (saved && saved.mode === opts.mode && saved.match.kind === kind) {
        this.match = Match.restore(saved.match);
        this.humanSide = saved.humanSide;
        this.level = saved.level;
        this.flagged = saved.flagged ?? null;
        if (saved.clock) this.clock = new GameClock(saved.clock.tc, saved.clock, this.match.side as 0 | 1);
      } else {
        this.match = new Match(kind);
        this.humanSide = settings.humanSide;
        this.level = settings.level;
        const tc = CLOCKS[settings.localClock];
        if (tc) this.clock = new GameClock(tc);
      }
      if (this.flagged || this.match.outcome()) this.clock?.stop();
      this.tick = window.setInterval(() => this.updateClocks(), 200);
      this.flipped = opts.mode === 'bot' && this.humanSide === 1;
      this.persist();
    }
    this.render(false, opts.mode !== 'room' && this.match.moves.length === 0);
    if (this.outcome()) this.overShown = true;
    this.maybeBot();
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.el.querySelector<T>(sel)!;
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener(ACCOUNT_EVENT, this.onAccount);
    this.req = -1;
    this.sock?.close();
    clearInterval(this.tick);
    this.closeOver?.();
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  // ---------- Game state ----------

  private get online() { return this.opts.mode === 'room'; }
  private get you(): 0 | 1 | null { return this.room?.you ?? null; }

  private outcome(): Outcome | null {
    if (this.online) return this.room?.result ?? null;
    return this.flagged ?? this.match.outcome();
  }

  private persist() {
    if (this.online) return;
    store.set('game:' + this.match.kind, {
      match: this.match.save(), mode: this.opts.mode as 'bot' | 'pvp', humanSide: this.humanSide, level: this.level, over: !!this.outcome(),
      clock: this.clock?.save() ?? null, flagged: this.flagged,
    } satisfies SavedGame);
  }

  private canMove(): boolean {
    if (this.thinking || this.outcome()) return false;
    if (!this.online && this.clock?.paused) return false;
    if (this.opts.mode === 'pvp') return true;
    if (this.opts.mode === 'bot') return this.match.side === this.humanSide;
    return !!this.room && this.room.status === 'playing' && this.sock?.status === 'open' && !this.pending && this.match.side === this.you;
  }

  private soundFor(m: number, captures: number, reveal: boolean) {
    moveSfx(this.match, m, captures, reveal, !!this.outcome());
  }

  private play(m: number) {
    if (this.online) {
      // The server validates the move and sends it back to everyone (with jieqi reveals).
      this.pending = true;
      this.sock?.send({ t: 'move', ply: this.match.moves.length, m });
      this.selected = null;
      this.pendingPromotion = null;
      this.render();
      return;
    }
    if (this.outcome()) return;
    if (this.clock?.flagged() !== null && this.clock?.flagged() !== undefined) { this.onFlag(); return; }
    const mover = this.match.side as 0 | 1;
    const reveal = this.match.pieceAt(this.match.moveFrom(m))?.hidden ?? false;
    const captures = this.match.captured.length;
    this.match.play(m);
    this.clock?.moved(mover, this.match.moves.length);
    if (this.match.outcome()) this.clock?.stop();
    this.soundFor(m, captures, reveal);
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
        if (this.outcome()) { this.render(); return; } // e.g. the bot ran out of time while thinking
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
    if (this.online) {
      if (this.room?.status === 'over' && this.you !== null) this.sock?.send({ t: 'rematch' });
      return;
    }
    this.cancelBot();
    this.closeOver?.();
    this.match = new Match(this.match.kind);
    this.flagged = null;
    this.lowWarned = [false, false];
    if (this.clock) this.clock = new GameClock(this.clock.tc);
    this.overShown = false;
    this.selected = null;
    this.pendingPromotion = null;
    if (this.opts.mode === 'bot') this.flipped = this.humanSide === 1;
    this.persist();
    this.render(false, true);
    this.maybeBot();
  }

  private undo() {
    if (this.online || !this.match.moves.length || this.flagged) return;
    this.cancelBot();
    this.match.undo();
    if (this.opts.mode === 'bot') while (this.match.moves.length && this.match.side !== this.humanSide) this.match.undo();
    this.clock?.rewind(this.match.moves.length, this.match.side as 0 | 1);
    this.overShown = !!this.outcome();
    this.selected = null;
    this.pendingPromotion = null;
    this.persist();
    this.render();
    this.maybeBot();
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

  // ---------- Online room ----------

  private connectRoom() {
    this.sock = new ReSocket<ServerMsg, ClientMsg>(`/rooms/${this.opts.room}/ws`, msg => this.onServer(msg), (st: SocketStatus) => {
      if (st !== 'open') this.pending = false;
      this.render();
    });
  }

  private onServer(msg: ServerMsg) {
    const s = t();
    switch (msg.t) {
      case 'state': {
        const st = msg.state;
        const newGame = !this.room || st.gameNo !== this.room.gameNo;
        this.room = st;
        this.clockOffset = st.serverNow - Date.now();
        this.match = Match.restoreRevealed(st.kind, st.initial, st.moves);
        if (this.lastYou !== st.you) { this.flipped = st.you === 1; this.lastYou = st.you; }
        this.pending = false;
        if (newGame) { this.closeOver?.(); this.selected = null; }
        this.render(false, newGame && st.moves.length === 0);
        if (st.status === 'over') this.checkOver();
        break;
      }
      case 'move': {
        const r = this.room;
        if (!r) return;
        if (msg.ply !== this.match.moves.length) {
          if (msg.ply > this.match.moves.length) this.resync();
          return;
        }
        const reveal = this.match.pieceAt(this.match.moveFrom(msg.mv.m))?.hidden ?? false;
        const captures = this.match.captured.length;
        r.moves.push(msg.mv);
        r.remaining = msg.remaining;
        r.turnStart = msg.turnStart;
        r.drawOffer = null;
        this.clockOffset = msg.serverNow - Date.now();
        this.match.playRevealed(msg.mv.m, msg.mv);
        this.pending = false;
        this.selected = null;
        this.soundFor(msg.mv.m, captures, reveal);
        this.render(true);
        break;
      }
      case 'presence':
        if (!this.room) return;
        this.room.seats = msg.seats;
        this.room.disconnectedAt = msg.disconnectedAt;
        this.render();
        break;
      case 'offer':
        if (!this.room) return;
        if (msg.kind === 'draw') {
          this.room.drawOffer = msg.side;
          if (msg.side !== null && msg.side !== this.you && this.you !== null) { toast(s.drawOffered); if (settings.sound) playSound('check'); }
        } else if (msg.rematch) {
          this.room.rematch = msg.rematch;
          if (msg.side !== this.you && this.you !== null) toast(s.rematchAsked);
          this.refreshOverDialog();
        }
        this.render();
        break;
      case 'emote':
        this.showEmote(msg.side, msg.e);
        break;
      case 'error':
        this.pending = false;
        if (msg.code === 'too-early') toast(s.claimTooEarly);
        else if (msg.code === 'illegal' || msg.code === 'not-your-turn') toast(s.moveRejected);
        else if (msg.code === 'banned') toast(s.bannedShort);
        this.render();
        break;
    }
  }

  private resync() {
    this.sock?.close();
    this.connectRoom();
  }

  private roomLink(): string {
    return `${location.origin}${location.pathname}#/r/${this.opts.room}`;
  }

  private async copyLink() {
    const s = t();
    try { await navigator.clipboard.writeText(this.roomLink()); toast(s.copied); }
    catch {
      this.el.querySelector<HTMLInputElement>('.link-input')?.select();
      document.execCommand?.('copy');
      toast(s.copied);
    }
  }

  private shareLink() {
    navigator.share?.({ title: 'Bàn Cờ', text: t().shareText, url: this.roomLink() }).catch(() => {});
  }

  private linkBox(): string {
    const s = t();
    const share = 'share' in navigator ? `<button class="btn" data-act="share">${ICON.share}<span>${s.share}</span></button>` : '';
    return `<div class="link-row"><input class="link-input" readonly value="${esc(this.roomLink())}" aria-label="link" />
      <button class="btn primary" data-act="copy">${ICON.copy}<span>${s.copy}</span></button>${share}</div>`;
  }

  private async resign() {
    const s = t();
    if (!this.online || this.room?.status !== 'playing' || this.you === null) return;
    if (!(await confirmDialog(s.resignConfirm, s.resign, s.close))) return;
    this.sock?.send({ t: 'resign' });
  }

  private offerDraw() {
    if (this.room?.status === 'playing' && this.you !== null) this.sock?.send({ t: 'draw' });
  }

  private report() {
    const s = t();
    const r = this.room;
    if (!r || this.you === null) return;
    const target = r.seats[this.you ^ 1];
    if (!target) return;
    const body = document.createElement('div');
    body.className = 'report-body';
    body.innerHTML = `<p>${esc(s.reportAbout(target.name))}</p>
      <div class="radio-list">${REPORT_REASONS.map((r2, i) => `<label><input type="radio" name="reason" value="${r2}"${i === 0 ? ' checked' : ''}/> ${esc(s.reportReasons[r2])}</label>`).join('')}</div>
      <textarea maxlength="500" rows="3" placeholder="${esc(s.reportNote)}"></textarea>`;
    openDialog({
      title: s.report, body,
      actions: [
        { label: s.close, kind: 'ghost' },
        {
          label: s.send, kind: 'primary', onClick: () => {
            const reason = body.querySelector<HTMLInputElement>('input[name=reason]:checked')?.value ?? 'other';
            const note = body.querySelector('textarea')!.value;
            net.api('/reports', { method: 'POST', body: { room: r.id, gameNo: r.gameNo, target: target.id, reason, note } })
              .then(() => toast(s.reportSent)).catch(() => toast(s.netError));
          },
        },
      ],
    });
  }

  private showEmote(side: 0 | 1 | null, e: string) {
    if (side === null) return;
    const bottom = this.flipped ? 1 : 0;
    const bar = this.q(side === bottom ? '.bottom-player' : '.top-player');
    const bubble = document.createElement('span');
    bubble.className = 'emote-bubble';
    bubble.textContent = e;
    bar.appendChild(bubble);
    window.setTimeout(() => bubble.remove(), 2600);
  }

  private remainingMs(side: 0 | 1): number {
    const r = this.room;
    if (!r?.clock) return 0;
    const running = r.status === 'playing' && r.turnStart !== null && this.match.side === side;
    return running ? timeLeft(r.clock, r.remaining[side], Date.now() + this.clockOffset - r.turnStart!) : r.remaining[side];
  }

  /** A local clock ran out: decide the game (loss, or draw if the opponent cannot win). */
  private onFlag() {
    const side = this.clock?.flagged();
    if (side === null || side === undefined || this.outcome()) return;
    this.flagged = this.match.timeoutResult(side);
    this.clock!.stop();
    this.cancelBot();
    this.selected = null;
    this.pendingPromotion = null;
    if (settings.sound) playSound('end');
    this.persist();
    this.render();
    this.checkOver();
  }

  private togglePause() {
    const c = this.clock;
    if (!c || this.outcome()) return;
    if (c.paused) c.resume(); else c.pause();
    this.persist();
    this.render();
  }

  private updateLocalClock() {
    const c = this.clock;
    if (!c) return;
    if (!this.flagged && c.flagged() !== null) { this.onFlag(); return; }
    const over = !!this.outcome();
    this.el.querySelectorAll<HTMLElement>('.clock').forEach(el => {
      const side = Number(el.dataset.side) as 0 | 1;
      const ms = Math.max(0, c.left(side));
      const running = !over && c.active === side && !c.paused;
      el.textContent = formatClock(ms);
      el.classList.toggle('low', ms < 30_000);
      el.classList.toggle('run', running);
      // Two short beeps once when a human player drops under 10 seconds.
      const human = this.opts.mode === 'pvp' || side === this.humanSide;
      if (running && human && ms < 10_000 && !this.lowWarned[side]) {
        this.lowWarned[side] = true;
        if (settings.sound) playSound('lowtime');
      }
    });
  }

  private updateClocks() {
    if (!this.online) { this.updateLocalClock(); return; }
    const r = this.room;
    if (!r) return;
    if (r.clock) {
      this.el.querySelectorAll<HTMLElement>('.clock').forEach(c => {
        const side = Number(c.dataset.side) as 0 | 1;
        const ms = this.remainingMs(side);
        c.textContent = formatClock(ms);
        c.classList.toggle('low', ms < 30_000);
        c.classList.toggle('run', r.status === 'playing' && r.turnStart !== null && this.match.side === side);
      });
    }
    // Countdown before the opponent's abandonment can be claimed.
    const claim = this.el.querySelector<HTMLElement>('.claim-line');
    if (claim && this.you !== null) {
      const gone = r.disconnectedAt[this.you ^ 1];
      if (gone !== null) {
        const left = CLAIM_AFTER_MS - (Date.now() + this.clockOffset - gone);
        const s = t();
        if (left > 0) claim.innerHTML = `<span>${esc(s.opponentGone(formatClock(left)))}</span>`;
        else if (!claim.querySelector('button')) {
          claim.innerHTML = `<span>${esc(s.opponentLeft)}</span><button class="btn primary" data-act="claim">${esc(s.claimWin)}</button>`;
          claim.querySelector<HTMLButtonElement>('button')!.onclick = () => this.sock?.send({ t: 'claim' });
        }
      }
    }
  }

  // ---------- Game over ----------

  /** Piece skins: yours on your pieces; online, each player's own (opponents' only if enabled). */
  private skins(): [string | null, string | null] {
    const mine = net.me?.skin ?? null;
    if (this.opts.mode === 'bot') return this.humanSide === 0 ? [mine, null] : [null, mine];
    if (this.opts.mode === 'pvp') return [mine, mine];
    const seats = this.room?.seats;
    const pick = (side: 0 | 1) => (side === this.you || settings.showSkins ? seats?.[side]?.skin ?? null : null);
    return [pick(0), pick(1)];
  }

  private checkOver() {
    const o = this.outcome();
    if (!o) return;
    if (this.opts.mode === 'bot' && !this.overShown) {
      // Quests: a finished game against the bot (each game counts once).
      const result = o.winner === null ? 'draw' : o.winner === this.humanSide ? 'win' : 'loss';
      reportQuest({ type: 'bot-game', kind: this.match.kind, level: this.level, result, key: 'bot:' + gameKey(this.match.initial, this.match.moves, this.humanSide) });
    }
    if (this.online) {
      if (this.shownOverFor === this.room!.gameNo) return;
      this.shownOverFor = this.room!.gameNo;
    } else {
      if (this.overShown) return;
      this.overShown = true;
    }
    window.setTimeout(() => this.openOverDialog(), 650);
  }

  private overBody(): HTMLElement {
    const s = t();
    const o = this.outcome()!;
    const div = document.createElement('div');
    const reason = s.reasons[o.reason];
    let html = `<p class="over-reason">${esc(reason.charAt(0).toUpperCase() + reason.slice(1))}</p>`;
    const r = this.room;
    if (r?.ratingChange && this.you !== null) {
      const d = r.ratingChange[this.you];
      html += `<p class="rating-change ${d >= 0 ? 'up' : 'down'}">${esc(s.rating)}: ${r.seats[this.you]?.rating ?? ''} (${d >= 0 ? '+' : ''}${d})</p>`;
    }
    if (r && this.you !== null && r.rematch[this.you ^ 1]) html += `<p class="rematch-note">${esc(s.rematchAsked)}</p>`;
    else if (r && this.you !== null && r.rematch[this.you]) html += `<p class="rematch-note">${esc(s.rematchWaiting)}</p>`;
    div.innerHTML = html;
    return div;
  }

  private refreshOverDialog() {
    const body = document.querySelector('dialog.over-dlg .dlg-body');
    if (body) body.replaceChildren(this.overBody());
  }

  private openOverDialog() {
    if (this.disposed || !this.outcome() || this.closeOver) return;
    const s = t();
    const o = this.outcome()!;
    const me = this.opts.mode === 'bot' ? this.humanSide : this.online ? this.you : null;
    let title: string, icon: string;
    if (o.winner === null) { title = s.draw; icon = '🤝'; }
    else if (me === null) { title = s.wins(this.sideName(o.winner)); icon = '🏆'; }
    else if (o.winner === me) { title = s.youWin; icon = '🏆'; }
    else { title = s.youLose; icon = '😔'; }
    const actions: DialogAction[] = [
      { label: s.home, kind: 'ghost', onClick: () => this.nav.go('#/', 'back') },
      { label: s.reviewBoard },
      { label: s.analysis.open, onClick: () => this.analyse() },
    ];
    if (!this.online) actions.push({ label: s.newGame, kind: 'primary', onClick: () => this.newGame() });
    else if (this.you !== null) {
      if (this.room?.rated) actions.push({ label: s.findNew, onClick: () => this.nav.go(`#/match/${this.match.kind}`) });
      if (this.room?.seats[0] && this.room?.seats[1]) actions.push({ label: s.rematch, kind: 'primary', onClick: () => this.newGame() });
    }
    this.closeOver = openDialog({
      title, icon, className: 'over-dlg', body: this.overBody(), actions,
      onClose: () => { this.closeOver = null; },
    });
  }

  // ---------- Rendering ----------

  private clockLabel(): string {
    const tc = this.clock?.tc;
    return tc ? clockLabel(tc) : '';
  }

  /** Open the finished game in the analysis screen. */
  private analyse() {
    const r = this.room;
    const players = ([0, 1] as const).map((side): AnalysisPlayer => {
      if (this.opts.mode === 'bot') return side === this.humanSide ? { you: true } : { bot: this.level };
      const seat = r?.seats[side];
      return seat ? { name: seat.name, rating: seat.rating, you: side === this.you } : {};
    }) as [AnalysisPlayer, AnalysisPlayer];
    const moves = this.online && r ? r.moves : this.match.movesWithReveals();
    const initial = this.online && r ? r.initial : this.match.initial;
    openAnalysis(this.nav, { kind: this.match.kind, initial, moves, players, result: this.outcome(), back: location.hash || '#/' });
  }

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
    const r = this.room;

    this.el.dataset.kind = m.kind;
    this.q('.game-title .thumb').innerHTML = gameThumb(m.kind);
    this.q('.game-title h1').textContent = s[m.kind];
    this.q('.mode-line').textContent = mode === 'bot'
      ? [`${s.bot} · ${s.youPlay.toLowerCase()} ${this.sideName(this.humanSide)}`, this.clockLabel()].filter(Boolean).join(' · ')
      : mode === 'pvp' ? [s.pvp, this.clockLabel()].filter(Boolean).join(' · ')
      : r ? [r.rated ? s.ranked : s.friendRoom, r.clock ? clockLabel(r.clock) : s.noClock,
        this.you === null ? s.spectating : `${s.youPlay.toLowerCase()} ${this.sideName(this.you)}`].join(' · ') : s.online;

    // Status
    let status: string, cls = '';
    const sockStatus = this.sock?.status;
    if (this.online && !r) {
      status = sockStatus === 'failed' ? s.roomNotFound : s.connecting;
      cls = sockStatus === 'failed' ? 'check' : 'thinking';
    } else if (outcome) {
      const reason = s.reasons[outcome.reason];
      status = outcome.winner === null ? `${s.draw} — ${reason}` : `${s.wins(this.sideName(outcome.winner))} — ${reason}`;
      cls = 'over';
    } else if (this.online && sockStatus !== 'open') { status = s.reconnecting; cls = 'thinking'; }
    else if (this.online && r!.status === 'waiting') { status = this.you === null ? s.waitingPlayer : s.waitingFriend; cls = 'thinking'; }
    else if (this.thinking) { status = s.thinking; cls = 'thinking'; }
    else {
      const check = m.checkedKing() !== null;
      status = this.online && this.you !== null ? (m.side === this.you ? s.yourTurn : s.opponentTurn) : s.toMove(this.sideName(m.side));
      if (check) { status += ` · ${s.check}`; cls = 'check'; }
    }
    const st = this.q('.status');
    st.className = 'status ' + cls;
    st.innerHTML = `<span class="dot side-${m.side} ${m.isChess ? 'chess' : 'xq'}"></span><span>${esc(status)}</span>`;

    // Draw offer banner
    const offer = this.q('.offer-card');
    offer.hidden = true;
    if (this.online && r?.status === 'playing' && r.drawOffer !== null && this.you !== null) {
      offer.hidden = false;
      if (r.drawOffer === this.you) offer.innerHTML = `<span>🤝 ${esc(s.drawSent)}</span>`;
      else {
        offer.innerHTML = `<span>🤝 ${esc(s.drawOffered)}</span><div><button class="btn ghost" data-act="decline">${esc(s.decline)}</button><button class="btn primary" data-act="accept">${esc(s.accept)}</button></div>`;
        offer.querySelector<HTMLButtonElement>('[data-act="accept"]')!.onclick = () => this.sock?.send({ t: 'draw' });
        offer.querySelector<HTMLButtonElement>('[data-act="decline"]')!.onclick = () => this.sock?.send({ t: 'decline' });
      }
    }

    // Controls
    const controls = this.q('.controls');
    const btn = (act: string, icon: string, label: string, disabled = false, primary = false) =>
      `<button class="btn${primary ? ' primary' : ''}" data-act="${act}"${disabled ? ' disabled' : ''}>${icon}<span>${esc(label)}</span></button>`;
    if (this.online) {
      const playing = r?.status === 'playing' && this.you !== null;
      const over = r?.status === 'over' && this.you !== null;
      controls.innerHTML = btn('flip', ICON.flip, s.flip)
        + (over ? btn('new', ICON.plus, r!.rematch[this.you!] ? s.rematchWaitingShort : s.rematch, r!.rematch[this.you!], true)
          : btn('draw', ICON.hand, s.offerDraw, !playing || r!.drawOffer === this.you))
        + (over ? btn('analyse', ICON.chart, s.analysis.open) : btn('resign', ICON.flag, s.resign, !playing));
    } else {
      controls.innerHTML = btn('undo', ICON.undo, s.undo, m.moves.length === 0 || !!this.flagged) + btn('flip', ICON.flip, s.flip) + btn('new', ICON.plus, s.newGame, false, !!outcome);
      if (outcome) controls.innerHTML += btn('analyse', ICON.chart, s.analysis.open);
    }
    controls.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
      b.onclick = () => {
        const act = b.dataset.act;
        if (act === 'undo') this.undo();
        else if (act === 'pause') this.togglePause();
        else if (act === 'flip') { this.flipped = !this.flipped; this.render(); }
        else if (act === 'new') this.newGame();
        else if (act === 'resign') void this.resign();
        else if (act === 'draw') this.offerDraw();
        else if (act === 'analyse') this.analyse();
      };
    });

    // Local clock: time control + pause
    const cc = this.q('.clock-card');
    cc.hidden = this.online || !this.clock;
    if (!this.online && this.clock) {
      const paused = this.clock.paused;
      cc.innerHTML = `<div class="row"><span>⏱ ${esc(s.timeControl)}: <b>${esc(this.clockLabel())}</b></span>
        <button class="btn" data-act="pause"${outcome ? ' disabled' : ''}>${esc(paused ? s.resume : s.pause)}</button></div>
        <p class="muted small">${esc(s.clockDesc(this.clock.tc))}</p>
        ${!outcome && this.clock.active === null ? `<p class="muted small">${esc(s.clockStartsHint)}</p>` : ''}`;
      cc.querySelector<HTMLButtonElement>('[data-act="pause"]')!.onclick = () => this.togglePause();
    }

    // Bot level
    const lc = this.q('.level-card');
    lc.hidden = mode !== 'bot';
    if (mode === 'bot') {
      lc.innerHTML = `<div class="row"><span>${esc(s.level)}</span><div class="seg">${LEVELS
        .map(l => `<button data-l="${l}" class="${l === this.level ? 'on' : ''}" aria-pressed="${l === this.level}">${esc(s[l])}</button>`).join('')}</div></div>`;
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
    nc.hidden = !this.online;
    const overlay = this.q('.board-overlay');
    overlay.hidden = true;
    if (this.online) {
      const connected = sockStatus === 'open';
      let html = `<div class="net-status ${connected ? 'connected' : sockStatus === 'failed' ? 'error' : ''}"><span class="net-dot"></span><span>${esc(connected ? s.connected : sockStatus === 'failed' ? s.netError : s.reconnecting)}</span></div>`;
      if (r && this.you !== null && r.status === 'playing') html += `<div class="claim-line"></div>`;
      if (r && this.you !== null && r.status !== 'waiting') {
        html += `<div class="emotes">${EMOTES.map(e => `<button class="emote" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`;
        if (r.seats[this.you ^ 1]) html += `<button class="link-btn" data-act="report">${ICON.report}<span>${esc(s.reportPlayer)}</span></button>`;
      }
      if (r && r.status === 'waiting' && this.you !== null) html += this.linkBox();
      if (r && this.you === null) {
        // Guests only watch; a free seat waits for them once they sign in.
        const freeSeat = r.status === 'waiting' && (!r.seats[0] || !r.seats[1]);
        if (!net.member) html += `<p class="spectate-note">👀 ${esc(s.login.spectatorJoin)}</p><button class="btn primary" data-act="login">${esc(s.login.signInToPlay)}</button>`;
        else if (!freeSeat) html += `<p class="spectate-note">👀 ${esc(s.spectatingNote)}</p>`;
      }
      nc.innerHTML = html;
      nc.querySelectorAll<HTMLButtonElement>('.emote').forEach(b => (b.onclick = () => this.sock?.send({ t: 'emote', e: b.dataset.e! })));
      nc.querySelector<HTMLButtonElement>('[data-act="report"]')?.addEventListener('click', () => this.report());
      nc.querySelector<HTMLButtonElement>('[data-act="login"]')?.addEventListener('click', () => openLogin());

      if (!r && sockStatus === 'failed') {
        overlay.hidden = false;
        overlay.innerHTML = `<div class="ov-card"><div class="ov-icon">🔍</div><h2>${esc(s.roomNotFound)}</h2><p>${esc(s.roomNotFoundHint)}</p>
          <div class="ov-actions"><button class="btn primary" data-act="home">${esc(s.home)}</button></div></div>`;
      } else if (!r) {
        overlay.hidden = false;
        overlay.innerHTML = `<div class="ov-card"><p class="ov-wait big"><span class="spinner"></span>${esc(s.connecting)}</p></div>`;
      } else if (r.status === 'waiting' && this.you !== null) {
        overlay.hidden = false;
        overlay.innerHTML = `<div class="ov-card"><div class="ov-icon pulse">🔗</div><h2>${esc(s.roomTitle)}</h2><p>${esc(s.roomHint)}</p>
          ${this.linkBox()}<p class="ov-wait"><span class="spinner"></span>${esc(s.waitingFriend)}</p></div>`;
      }
      this.el.querySelectorAll<HTMLButtonElement>('[data-act="copy"]').forEach(b => (b.onclick = () => void this.copyLink()));
      this.el.querySelectorAll<HTMLButtonElement>('[data-act="share"]').forEach(b => (b.onclick = () => this.shareLink()));
      overlay.querySelector<HTMLButtonElement>('[data-act="home"]')?.addEventListener('click', () => this.nav.go('#/', 'back'));
    }

    if (!this.online && this.clock?.paused && !outcome) {
      overlay.hidden = false;
      overlay.innerHTML = `<div class="ov-card"><div class="ov-icon">⏸</div><h2>${esc(s.paused)}</h2>
        <div class="ov-actions"><button class="btn primary" data-act="resume">${esc(s.resume)}</button></div></div>`;
      overlay.querySelector<HTMLButtonElement>('[data-act="resume"]')!.onclick = () => this.togglePause();
    }

    // Rules
    const rules = this.q<HTMLDetailsElement>('.rules');
    rules.hidden = m.kind !== 'jieqi' && m.kind !== 'hiddenchess';
    const hc = m.kind === 'hiddenchess';
    rules.querySelector('summary')!.textContent = hc ? s.rulesTitleHc : s.rulesTitle;
    rules.querySelector('ul')!.innerHTML = (hc ? s.rulesHc : s.rules).map(x => `<li>${esc(x)}</li>`).join('');

    // Players
    const bottom: 0 | 1 = this.flipped ? 1 : 0;
    this.renderPlayer(this.q('.bottom-player'), bottom);
    this.renderPlayer(this.q('.top-player'), (bottom ^ 1) as 0 | 1);

    // Moves
    this.q('.moves-title').textContent = s.moves;
    const ol = this.q('.moves');
    if (!m.notes.length) ol.innerHTML = `<li class="empty">${esc(s.noMoves)}</li>`;
    else {
      const rows: string[] = [];
      for (let i = 0; i < m.notes.length; i += 2) {
        const a = m.notes[i][settings.lang], b = m.notes[i + 1]?.[settings.lang] ?? '';
        const lastA = i === m.notes.length - 1, lastB = i + 1 === m.notes.length - 1;
        rows.push(`<li><span class="n">${i / 2 + 1}.</span><span class="${lastA ? 'cur' : ''}">${esc(a)}</span><span class="${lastB ? 'cur' : ''}">${esc(b)}</span></li>`);
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
      skins: this.skins(),
    }, animate, intro);
    this.board.svg.setAttribute('aria-label', `${s[m.kind]} — ${status}`);
    this.board.svg.classList.toggle('locked', !this.canMove());

    // Promotion picker
    const promo = this.q('.promo');
    if (this.pendingPromotion) {
      promo.hidden = false;
      promo.innerHTML = `<p>${esc(s.promote)}</p>` + this.pendingPromotion
        .map(mv => `<button class="cp-btn ${m.side ? 'b' : 'w'}" data-m="${mv}">${chessGlyph(m.movePromo(mv))}</button>`).join('');
      promo.querySelectorAll<HTMLButtonElement>('button').forEach(b => (b.onclick = () => this.play(Number(b.dataset.m))));
    } else promo.hidden = true;

    this.updateClocks();
  }

  private renderPlayer(el: HTMLElement, side: 0 | 1) {
    const s = t();
    const m = this.match;
    const mode = this.opts.mode;
    let who = '';
    let name = esc(this.sideName(side));
    const r = this.room;
    if (mode === 'bot') who = side === this.humanSide ? `🙂 ${s.you}` : `🤖 ${s[this.level]}`;
    else if (this.online && r) {
      const seat = r.seats[side];
      if (seat) {
        name = `${esc(seat.name)} <span class="rating">${seat.rating}</span>`;
        who = side === this.you ? s.you : '';
        if (!seat.online) who += (who ? ' · ' : '') + s.offline;
      } else who = s.emptySeat;
    }
    const caps = m.captured.filter(p => ((p >> 3) & 1) !== side).map(p => p & 7).sort((a, b) => b - a);
    const icons = caps.map(type => m.isChess
      ? `<span class="cap-chess ${side ? 'w' : 'b'}">${chessGlyph(type)}</span>`
      : `<span class="cap-xq ${side ? 'r' : 'b'}">${xiangqiLabel(type, side ^ 1, 'hanzi')}</span>`).join('');
    const turn = !this.outcome() && m.side === side && (!this.online || r?.status === 'playing');
    el.classList.toggle('turn', turn);
    const clock = (this.online && r?.clock) || (!this.online && this.clock) ? `<span class="clock" data-side="${side}"></span>` : '';
    el.innerHTML = `<span class="pname"><span class="dot side-${side} ${m.isChess ? 'chess' : 'xq'}"></span><span class="nm">${name}</span>${who ? `<span class="who">${esc(who)}</span>` : ''}</span><span class="caps" title="${esc(s.captured)}">${icons}</span>${clock}`;
  }

  /** Re-render after a settings change (language, labels, colours). */
  refresh() {
    this.render();
  }
}
