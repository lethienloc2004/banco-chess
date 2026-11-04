import './styles.css';
import { Match, type SavedMatch } from './game';
import { STRINGS, type Lang, type Strings } from './i18n';
import { BoardRenderer, chessGlyph, xiangqiLabel } from './ui/board';
import type { GameKind } from './engine/types';
import type { Level } from './engine/ai';
import { playSound, unlockAudio } from './sound';
import { CHESS_BOARDS, CHESS_PIECES, XQ_BOARDS, XQ_PIECES, applyThemes, findTheme, type Theme as ColorTheme } from './ui/themes';

export const REPO_URL = 'https://github.com';

type Theme = 'auto' | 'light' | 'dark';
interface Settings {
  kind: GameKind;
  lang: Lang;
  theme: Theme;
  mode: 'pvp' | 'bot';
  humanSide: 0 | 1;
  level: Level;
  labels: 'hanzi' | 'viet';
  sound: boolean;
  chessBoard: string;
  chessPieces: string;
  xqBoard: string;
  xqPieces: string;
}

const KINDS: GameKind[] = ['chess', 'xiangqi', 'jieqi'];
const store = {
  get<T>(key: string): T | null {
    try { const v = localStorage.getItem('banco:' + key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem('banco:' + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

const defaults: Settings = {
  kind: 'xiangqi',
  lang: navigator.language?.startsWith('vi') ? 'vi' : (navigator.language ? 'en' : 'vi'),
  theme: 'auto',
  mode: 'bot',
  humanSide: 0,
  level: 'medium',
  labels: 'hanzi',
  sound: true,
  chessBoard: 'wood',
  chessPieces: 'classic',
  xqBoard: 'wood',
  xqPieces: 'classic',
};
const settings: Settings = { ...defaults, ...store.get<Partial<Settings>>('settings') };
const hashKind = location.hash.slice(1) as GameKind;
if (KINDS.includes(hashKind)) settings.kind = hashKind;

let match = loadMatch(settings.kind);
let flipped = settings.mode === 'bot' && settings.humanSide === 1;
let selected: number | null = null;
let pendingPromotion: number[] | null = null;
let botThinking = false;
let requestId = 0;

const worker = new Worker(new URL('./engine/ai.worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = (e: MessageEvent<{ id: number; move?: number; error?: string }>) => {
  if (e.data.id !== requestId) return; // stale answer (game changed meanwhile)
  botThinking = false;
  if (e.data.move !== undefined && match.legalMoves().includes(e.data.move)) {
    play(e.data.move);
  } else {
    console.error('Bot error', e.data.error);
    render();
  }
};

function loadMatch(kind: GameKind): Match {
  const saved = store.get<SavedMatch>('game:' + kind);
  if (saved && saved.kind === kind) {
    try { return Match.restore(saved); } catch { /* corrupted save */ }
  }
  return new Match(kind);
}

function persist() {
  store.set('settings', settings);
  store.set('game:' + match.kind, match.save());
}

// ---------- DOM skeleton ----------

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="top">
    <a class="brand" href="./" aria-label="Bàn Cờ">
      <img src="./icon.svg" alt="" width="32" height="32" />
      <span><strong>Bàn Cờ</strong><small data-t="tagline"></small></span>
    </a>
    <nav class="tabs" role="tablist"></nav>
    <div class="top-actions">
      <button class="icon-btn" id="lang-btn"></button>
      <button class="icon-btn" id="sound-btn"></button>
      <button class="icon-btn" id="theme-btn" aria-label="theme"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg></button>
      <a class="icon-btn" id="gh-link" href="${REPO_URL}" target="_blank" rel="noopener" aria-label="GitHub">
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>
    </div>
  </header>
  <main class="layout">
    <section class="board-wrap">
      <div class="player top-player"></div>
      <div class="board-box" id="board-box"></div>
      <div class="player bottom-player"></div>
      <div class="promo" id="promo" hidden></div>
    </section>
    <aside class="panel">
      <div class="status" id="status" aria-live="polite"></div>
      <div class="controls">
        <button class="btn primary" id="new-btn"></button>
        <button class="btn" id="undo-btn"></button>
        <button class="btn" id="flip-btn"></button>
      </div>
      <div class="settings">
        <div class="row"><span data-t="mode"></span>
          <div class="seg" id="mode-seg"></div></div>
        <div class="row bot-only"><span data-t="youPlay"></span>
          <div class="seg" id="side-seg"></div></div>
        <div class="row bot-only"><span data-t="level"></span>
          <div class="seg" id="level-seg"></div></div>
        <div class="row xq-only"><span data-t="labels"></span>
          <div class="seg" id="labels-seg"></div></div>
      </div>
      <div class="settings colors">
        <div class="row"><span data-t="boardColor"></span><div class="swatches" id="board-sw"></div></div>
        <div class="row"><span data-t="pieceColor"></span><div class="swatches" id="piece-sw"></div></div>
      </div>
      <details class="rules jieqi-only" id="rules"><summary data-t="rulesTitle"></summary><ul></ul></details>
      <div class="card">
        <h2 data-t="moves"></h2>
        <ol class="moves" id="moves"></ol>
      </div>
    </aside>
  </main>
  <footer class="foot">
    <span>MIT License · <a href="${REPO_URL}" target="_blank" rel="noopener" data-t="source"></a></span>
  </footer>
`;

const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
const board = new BoardRenderer($('#board-box'), onCell);

function t(): Strings { return STRINGS[settings.lang]; }

function sideName(side: number): string {
  const s = t();
  return side === 0 ? (match.isChess ? s.white : s.red) : s.black;
}

function seg<T extends string | number>(el: HTMLElement, options: [T, string][], value: T, onPick: (v: T) => void) {
  el.innerHTML = '';
  for (const [v, label] of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = v === value ? 'on' : '';
    b.setAttribute('aria-pressed', String(v === value));
    b.onclick = () => onPick(v);
    el.appendChild(b);
  }
}

function swatches(el: HTMLElement, list: ColorTheme[], value: string, onPick: (id: string) => void) {
  el.innerHTML = '';
  for (const th of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw' + (th.id === value ? ' on' : '');
    b.title = th[settings.lang];
    b.setAttribute('aria-label', th[settings.lang]);
    b.setAttribute('aria-pressed', String(th.id === value));
    b.style.setProperty('--a', th.swatch[0]);
    b.style.setProperty('--b', th.swatch[1]);
    b.onclick = () => onPick(th.id);
    el.appendChild(b);
  }
}

// ---------- Game flow ----------

function isBotTurn(): boolean {
  return settings.mode === 'bot' && match.side !== settings.humanSide && !match.outcome();
}

function play(m: number) {
  const reveal = match.pieceAt(match.moveFrom(m))?.hidden ?? false;
  const captures = match.captured.length;
  match.play(m);
  if (settings.sound) {
    if (match.outcome()) playSound('end');
    else if (match.checkedKing() !== null) playSound('check');
    else if (match.captured.length > captures) playSound('capture');
    else playSound(reveal ? 'reveal' : 'move');
  }
  selected = null;
  pendingPromotion = null;
  persist();
  render(true);
  maybeBot();
}

function maybeBot() {
  if (!isBotTurn() || botThinking) return;
  botThinking = true;
  const id = ++requestId;
  const started = Date.now();
  render();
  const msg = { id, kind: match.kind, state: match.botState(), level: settings.level };
  // Small delay so instant replies still feel natural.
  setTimeout(() => { if (id === requestId) worker.postMessage(msg); }, Math.max(0, 250 - (Date.now() - started)));
}

function cancelBot() {
  requestId++;
  botThinking = false;
}

function newGame() {
  cancelBot();
  match = new Match(settings.kind);
  selected = null;
  pendingPromotion = null;
  flipped = settings.mode === 'bot' && settings.humanSide === 1;
  persist();
  render();
  maybeBot();
}

function undo() {
  cancelBot();
  match.undo();
  // Against the bot, take back until it is the human's turn again.
  if (settings.mode === 'bot') while (match.moves.length && match.side !== settings.humanSide) match.undo();
  selected = null;
  pendingPromotion = null;
  persist();
  render();
  maybeBot();
}

function switchKind(kind: GameKind) {
  if (kind === match.kind) return;
  cancelBot();
  settings.kind = kind;
  history.replaceState(null, '', '#' + kind);
  match = loadMatch(kind);
  selected = null;
  pendingPromotion = null;
  flipped = settings.mode === 'bot' && settings.humanSide === 1;
  persist();
  render();
  maybeBot();
}

function onCell(sq: number) {
  if (botThinking || isBotTurn() || match.outcome()) return;
  pendingPromotion = null;
  const legal = match.legalMoves();
  if (selected !== null) {
    const choices = legal.filter(m => match.moveFrom(m) === selected && match.moveTo(m) === sq);
    if (choices.length === 1) return play(choices[0]);
    if (choices.length > 1) { pendingPromotion = choices; return render(); }
  }
  const p = match.pieceAt(sq);
  selected = p && p.color === match.side && sq !== selected && legal.some(m => match.moveFrom(m) === sq) ? sq : null;
  render();
}

// ---------- Rendering ----------

function render(animate = false) {
  const s = t();
  document.documentElement.lang = settings.lang;
  document.documentElement.dataset.theme = settings.theme === 'auto' ? '' : settings.theme;
  if (settings.theme === 'auto') delete document.documentElement.dataset.theme;
  app.dataset.kind = match.kind;
  app.dataset.mode = settings.mode;

  app.querySelectorAll<HTMLElement>('[data-t]').forEach(el => {
    const v = s[el.dataset.t as keyof Strings];
    if (typeof v === 'string') el.textContent = v;
  });
  $('#lang-btn').textContent = settings.lang === 'vi' ? 'EN' : 'VI';
  $('#lang-btn').title = s.language;
  $('#theme-btn').title = s.theme;
  const sb = $('#sound-btn');
  sb.title = settings.sound ? s.soundOff : s.soundOn;
  sb.setAttribute('aria-label', sb.title);
  sb.setAttribute('aria-pressed', String(settings.sound));
  sb.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/>${settings.sound
    ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
  $('#new-btn').textContent = s.newGame;
  $('#undo-btn').textContent = s.undo;
  $('#flip-btn').textContent = s.flip;
  ($('#undo-btn') as HTMLButtonElement).disabled = match.moves.length === 0;

  // Tabs
  const tabs = $('.tabs');
  tabs.innerHTML = '';
  for (const k of KINDS) {
    const b = document.createElement('button');
    b.role = 'tab';
    b.textContent = s[k];
    b.className = 'tab' + (k === match.kind ? ' on' : '');
    b.setAttribute('aria-selected', String(k === match.kind));
    b.onclick = () => switchKind(k);
    tabs.appendChild(b);
  }

  seg($('#mode-seg'), [['bot', s.bot], ['pvp', s.pvp]], settings.mode, v => {
    settings.mode = v;
    flipped = v === 'bot' && settings.humanSide === 1;
    persist(); render(); maybeBot();
  });
  seg($('#side-seg'), [[0, match.isChess ? s.white : s.red], [1, s.black]], settings.humanSide, v => {
    settings.humanSide = v as 0 | 1;
    newGame();
  });
  seg($('#level-seg'), [['easy', s.easy], ['medium', s.medium], ['hard', s.hard]], settings.level, v => {
    settings.level = v; persist(); render();
  });
  seg($('#labels-seg'), [['hanzi', s.hanzi], ['viet', s.viet]], settings.labels, v => {
    settings.labels = v; persist(); render();
  });
  // Colours
  const chess = match.isChess;
  swatches($('#board-sw'), chess ? CHESS_BOARDS : XQ_BOARDS, chess ? settings.chessBoard : settings.xqBoard, id => {
    if (chess) settings.chessBoard = id; else settings.xqBoard = id;
    persist(); render();
  });
  swatches($('#piece-sw'), chess ? CHESS_PIECES : XQ_PIECES, chess ? settings.chessPieces : settings.xqPieces, id => {
    if (chess) settings.chessPieces = id; else settings.xqPieces = id;
    persist(); render();
  });
  applyThemes(app, [
    findTheme(CHESS_BOARDS, settings.chessBoard), findTheme(CHESS_PIECES, settings.chessPieces),
    findTheme(XQ_BOARDS, settings.xqBoard), findTheme(XQ_PIECES, settings.xqPieces),
  ]);
  $('#rules ul').innerHTML = s.rules.map(r => `<li>${r}</li>`).join('');

  // Status
  const outcome = match.outcome();
  let status: string;
  let cls = '';
  if (outcome) {
    status = outcome.winner === null ? `${s.draw} — ${s[outcome.reason]}` : `${s.wins(sideName(outcome.winner))} — ${s[outcome.reason]}`;
    cls = 'over';
  } else if (botThinking) {
    status = s.thinking;
    cls = 'thinking';
  } else {
    status = s.toMove(sideName(match.side)) + (match.checkedKing() !== null ? ` · ${s.check}` : '');
    if (match.checkedKing() !== null) cls = 'check';
  }
  const st = $('#status');
  st.className = 'status ' + cls;
  st.innerHTML = `<span class="dot side-${match.side} ${match.isChess ? 'chess' : 'xq'}"></span><span>${status}</span>`;

  // Players & captured pieces
  const bottomSide = flipped ? 1 : 0;
  renderPlayer($('.bottom-player'), bottomSide);
  renderPlayer($('.top-player'), bottomSide ^ 1);

  // Move list
  const ol = $('#moves');
  if (!match.notes.length) ol.innerHTML = `<li class="empty">${s.noMoves}</li>`;
  else {
    const rows: string[] = [];
    for (let i = 0; i < match.notes.length; i += 2) {
      const a = match.notes[i][settings.lang], b = match.notes[i + 1]?.[settings.lang] ?? '';
      const lastA = i === match.notes.length - 1, lastB = i + 1 === match.notes.length - 1;
      rows.push(`<li><span class="n">${i / 2 + 1}.</span><span class="${lastA ? 'cur' : ''}">${a}</span><span class="${lastB ? 'cur' : ''}">${b}</span></li>`);
    }
    ol.innerHTML = rows.join('');
    ol.scrollTop = ol.scrollHeight;
  }

  // Board
  const targets = new Map<number, boolean>();
  if (selected !== null) {
    for (const m of match.legalMoves()) {
      if (match.moveFrom(m) === selected) targets.set(match.moveTo(m), match.pieceAt(match.moveTo(m)) !== null);
    }
  }
  board.render(match, {
    flipped, selected, targets, labels: settings.labels,
    river: settings.labels === 'hanzi' ? ['楚 河', '漢 界'] : ['Sở Hà', 'Hán Giới'],
  }, animate);
  board.svg.setAttribute('aria-label', `${s[match.kind]} — ${status}`);

  // Promotion picker
  const promo = $('#promo');
  if (pendingPromotion) {
    promo.hidden = false;
    promo.innerHTML = `<p>${s.promote}</p>` + pendingPromotion
      .map(m => `<button class="cp-btn ${match.side ? 'b' : 'w'}" data-m="${m}">${chessGlyph(match.movePromo(m))}</button>`).join('');
    promo.querySelectorAll<HTMLButtonElement>('button').forEach(b => (b.onclick = () => play(Number(b.dataset.m))));
  } else promo.hidden = true;
}

function renderPlayer(el: HTMLElement, side: number) {
  const s = t();
  const isBot = settings.mode === 'bot' && side !== settings.humanSide;
  const name = sideName(side) + (settings.mode === 'bot' ? ` · ${isBot ? '🤖 ' + s[settings.level] : '🙂'}` : '');
  // Pieces this side has captured = opponent pieces in the captured list.
  const caps = match.captured.filter(p => ((p >> 3) & 1) !== side).map(p => p & 7).sort((a, b) => b - a);
  const icons = caps.map(type => match.isChess
    ? `<span class="cap-chess ${side ? 'w' : 'b'}">${chessGlyph(type)}</span>`
    : `<span class="cap-xq ${side ? 'r' : 'b'}">${xiangqiLabel(type, side ^ 1, 'hanzi')}</span>`).join('');
  const turn = !match.outcome() && match.side === side;
  el.className = `player ${el.classList.contains('top-player') ? 'top-player' : 'bottom-player'}${turn ? ' turn' : ''}`;
  el.innerHTML = `<span class="pname"><span class="dot side-${side} ${match.isChess ? 'chess' : 'xq'}"></span>${name}</span><span class="caps" title="${s.captured}">${icons}</span>`;
}

// ---------- Global controls ----------

$('#new-btn').onclick = newGame;
$('#sound-btn').onclick = () => {
  settings.sound = !settings.sound;
  if (settings.sound) { unlockAudio(); playSound('move'); }
  persist();
  render();
};
// Browsers only allow audio after a user gesture; unlock on the first one.
document.addEventListener('pointerdown', () => { if (settings.sound) unlockAudio(); }, { once: true });
$('#undo-btn').onclick = undo;
$('#flip-btn').onclick = () => { flipped = !flipped; render(); };
$('#lang-btn').onclick = () => { settings.lang = settings.lang === 'vi' ? 'en' : 'vi'; persist(); render(); };
$('#theme-btn').onclick = () => {
  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  settings.theme = dark ? 'light' : 'dark';
  persist();
  render();
};
window.addEventListener('hashchange', () => {
  const k = location.hash.slice(1) as GameKind;
  if (KINDS.includes(k)) switchKind(k);
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'Escape') { selected = null; pendingPromotion = null; render(); }
});

history.replaceState(null, '', '#' + match.kind);
render();
maybeBot();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
