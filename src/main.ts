import './styles.css';
import type { GameKind } from './engine/types';
import { newRoomId } from './online';
import { playSound, unlockAudio } from './sound';
import { KINDS, saveSettings, settings, t } from './state';
import { openDialog } from './ui/dialog';
import { homeScreen, modesScreen, type Nav, type Screen } from './ui/home';
import { PlayScreen } from './ui/play';
import { CHESS_BOARDS, CHESS_PIECES, XQ_BOARDS, XQ_PIECES, applyThemes, findTheme, type Theme as ColorTheme } from './ui/themes';

export const REPO_URL = 'https://github.com';

type Route =
  | { name: 'home' }
  | { name: 'modes'; kind: GameKind }
  | { name: 'play'; kind: GameKind; mode: 'bot' | 'pvp' }
  | { name: 'host'; kind: GameKind; room: string }
  | { name: 'join'; room: string };

function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  const kind = parts[0] as GameKind;
  if (parts[0] === 'join' && parts[1]) return { name: 'join', room: parts[1] };
  if (!KINDS.includes(kind)) return { name: 'home' };
  if (parts[1] === 'bot' || parts[1] === 'pvp') return { name: 'play', kind, mode: parts[1] };
  if (parts[1] === 'online') return { name: 'host', kind, room: parts[2] ?? '' };
  return { name: 'modes', kind };
}

// ---------- Shell ----------

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="top">
    <button class="icon-btn back-btn" id="back-btn" hidden>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <a class="brand" href="#/">
      <img src="./icon.svg" alt="" width="32" height="32" />
      <span><strong>Bàn Cờ</strong><small id="tagline"></small></span>
    </a>
    <div class="top-actions">
      <button class="icon-btn" id="sound-btn"></button>
      <button class="icon-btn" id="settings-btn">
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
      </button>
      <a class="icon-btn" id="gh-link" href="${REPO_URL}" target="_blank" rel="noopener" aria-label="GitHub">
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>
    </div>
  </header>
  <div id="screen" class="screen-host"></div>
  <footer class="foot"><span>MIT License · <a href="${REPO_URL}" target="_blank" rel="noopener" id="src-link"></a></span></footer>
`;

const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
const host = $('#screen');
let current: Screen | null = null;
let route: Route = { name: 'home' };

const nav: Nav = {
  go(hash, dir = 'forward') {
    if (hash === location.hash || (hash === '#/' && !location.hash)) return;
    history.pushState(null, '', hash);
    show(dir);
  },
};

function applyGlobal() {
  const s = t();
  const root = document.documentElement;
  root.lang = settings.lang;
  if (settings.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  applyThemes(root, [
    findTheme(CHESS_BOARDS, settings.chessBoard), findTheme(CHESS_PIECES, settings.chessPieces),
    findTheme(XQ_BOARDS, settings.xqBoard), findTheme(XQ_PIECES, settings.xqPieces),
  ]);
  $('#tagline').textContent = s.tagline;
  $('#src-link').textContent = s.source;
  const back = $('#back-btn');
  back.hidden = route.name === 'home';
  back.title = s.back;
  back.setAttribute('aria-label', s.back);
  $('#settings-btn').title = s.settings;
  $('#settings-btn').setAttribute('aria-label', s.settings);
  const sb = $('#sound-btn');
  sb.title = settings.sound ? s.soundOff : s.soundOn;
  sb.setAttribute('aria-label', sb.title);
  sb.setAttribute('aria-pressed', String(settings.sound));
  sb.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/>${settings.sound
    ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
}

function build(r: Route): Screen {
  switch (r.name) {
    case 'home': return homeScreen(nav);
    case 'modes': return modesScreen(r.kind, nav);
    case 'play': return new PlayScreen({ kind: r.kind, mode: r.mode }, nav);
    case 'host': return new PlayScreen({ kind: r.kind, mode: 'online', role: 'host', room: r.room }, nav);
    case 'join': return new PlayScreen({ kind: 'xiangqi', mode: 'online', role: 'guest', room: r.room }, nav);
  }
}

function titleFor(r: Route): string {
  const s = t();
  const base = 'Bàn Cờ';
  if (r.name === 'home') return `${base} — ${s.tagline}`;
  if (r.name === 'join') return `${s.online} — ${base}`;
  return `${s[r.kind]} — ${base}`;
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function show(dir: 'forward' | 'back' | 'none' = 'none') {
  let r = parseRoute(location.hash);
  // A fresh online room gets its id now, so a reload keeps the same room.
  if (r.name === 'host' && !r.room) {
    r = { ...r, room: newRoomId() };
    history.replaceState(null, '', `#/${r.kind}/online/${r.room}`);
  }
  const swap = () => {
    current?.dispose();
    route = r;
    current = build(r);
    host.replaceChildren(current.el);
    document.title = titleFor(r);
    applyGlobal();
    window.scrollTo({ top: 0 });
  };
  document.documentElement.dataset.nav = dir;
  const vt = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
  if (dir !== 'none' && vt && !reduceMotion.matches) vt.call(document, swap);
  else {
    swap();
    if (dir !== 'none') current!.el.classList.add('enter-' + dir);
  }
}

function backTarget(): string {
  switch (route.name) {
    case 'modes': case 'join': return '#/';
    case 'play': case 'host': return '#/' + route.kind;
    default: return '#/';
  }
}

// ---------- Settings dialog ----------

function seg<T extends string | number | boolean>(options: [T, string][], value: T, onPick: (v: T) => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'seg';
  const draw = (v: T) => {
    el.innerHTML = '';
    for (const [ov, label] of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = ov === v ? 'on' : '';
      b.setAttribute('aria-pressed', String(ov === v));
      b.onclick = () => { draw(ov); onPick(ov); };
      el.appendChild(b);
    }
  };
  draw(value);
  return el;
}

function swatches(list: ColorTheme[], value: string, onPick: (id: string) => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'swatches';
  const draw = (v: string) => {
    el.innerHTML = '';
    for (const th of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw' + (th.id === v ? ' on' : '');
      b.title = th[settings.lang];
      b.setAttribute('aria-label', th[settings.lang]);
      b.setAttribute('aria-pressed', String(th.id === v));
      b.style.setProperty('--a', th.swatch[0]);
      b.style.setProperty('--b', th.swatch[1]);
      b.onclick = () => { draw(th.id); onPick(th.id); };
      el.appendChild(b);
    }
  };
  draw(value);
  return el;
}

function settingsChanged(rebuild = false) {
  saveSettings();
  applyGlobal();
  if (rebuild && route.name !== 'play' && route.name !== 'host' && route.name !== 'join') {
    current?.dispose();
    current = build(route);
    host.replaceChildren(current.el);
  } else if (current instanceof PlayScreen) current.refresh();
}

function openSettings() {
  const s = t();
  const body = document.createElement('div');
  body.className = 'settings-body';
  const row = (label: string, control: HTMLElement) => {
    const r = document.createElement('div');
    r.className = 'row';
    const span = document.createElement('span');
    span.textContent = label;
    r.append(span, control);
    return r;
  };
  const group = (title: string, ...rows: HTMLElement[]) => {
    const g = document.createElement('section');
    g.className = 'set-group';
    const h = document.createElement('h3');
    h.textContent = title;
    g.append(h, ...rows);
    return g;
  };
  body.append(
    group(s.settings,
      row(s.language, seg([['vi', 'Tiếng Việt'], ['en', 'English']], settings.lang, v => {
        settings.lang = v; settingsChanged(true);
        close(); openSettings();
      })),
      row(s.theme, seg([['auto', s.themeAuto], ['light', s.themeLight], ['dark', s.themeDark]], settings.theme, v => { settings.theme = v; settingsChanged(); })),
      row(s.sound, seg([[true, s.on], [false, s.off]], settings.sound, v => {
        settings.sound = v; if (v) { unlockAudio(); playSound('move'); } settingsChanged();
      })),
    ),
    group(s.chess,
      row(s.boardColor, swatches(CHESS_BOARDS, settings.chessBoard, id => { settings.chessBoard = id; settingsChanged(); })),
      row(s.pieceColor, swatches(CHESS_PIECES, settings.chessPieces, id => { settings.chessPieces = id; settingsChanged(); })),
    ),
    group(`${s.xiangqi} · ${s.jieqi}`,
      row(s.boardColor, swatches(XQ_BOARDS, settings.xqBoard, id => { settings.xqBoard = id; settingsChanged(); })),
      row(s.pieceColor, swatches(XQ_PIECES, settings.xqPieces, id => { settings.xqPieces = id; settingsChanged(); })),
      row(s.labels, seg([['hanzi', s.hanzi], ['viet', s.viet]], settings.labels, v => { settings.labels = v; settingsChanged(); })),
    ),
  );
  const close = openDialog({ title: s.settings, body, className: 'settings-dlg', actions: [{ label: s.close, kind: 'primary' }] });
}

// ---------- Events ----------

$('#back-btn').onclick = () => nav.go(backTarget(), 'back');
$('.brand').onclick = e => { e.preventDefault(); nav.go('#/', 'back'); };
$('#settings-btn').onclick = openSettings;
$('#sound-btn').onclick = () => {
  settings.sound = !settings.sound;
  if (settings.sound) { unlockAudio(); playSound('move'); }
  saveSettings();
  applyGlobal();
};
document.addEventListener('pointerdown', () => { if (settings.sound) unlockAudio(); }, { once: true });
window.addEventListener('popstate', () => show('back'));

// Old links (#chess, #xiangqi, #jieqi) open the mode list for that game.
const legacy = location.hash.slice(1) as GameKind;
if (KINDS.includes(legacy)) history.replaceState(null, '', '#/' + legacy);

show('none');

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
