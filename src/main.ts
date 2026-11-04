import './styles.css';
import type { GameKind } from './engine/types';
import { lobby, net, renderGoogleButton } from './net';
import { playSound, unlockAudio } from './sound';
import { KINDS, saveSettings, settings, store, t } from './state';
import { adminScreen } from './ui/admin';
import { openDialog, toast } from './ui/dialog';
import { homeScreen, modesScreen, type Nav, type Screen } from './ui/home';
import { matchScreen } from './ui/match';
import { PlayScreen } from './ui/play';
import {
  CHESS_BOARDS, CHESS_PIECES, XQ_BOARDS, XQ_PIECES, applyThemes, customTheme, findTheme,
  type CustomColors, type Theme as ColorTheme,
} from './ui/themes';
import { esc } from './ui/util';

/** Source link from package.json "repository"; the GitHub buttons hide when it is empty. */
export const REPO_URL = __REPO_URL__;

type Route =
  | { name: 'home' }
  | { name: 'modes'; kind: GameKind }
  | { name: 'play'; kind: GameKind; mode: 'bot' | 'pvp' }
  | { name: 'room'; room: string }
  | { name: 'match'; kind: GameKind }
  | { name: 'admin'; tab: string };

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const kind = parts[0] as GameKind;
  if ((parts[0] === 'r' || parts[0] === 'join') && parts[1]) return { name: 'room', room: parts[1] };
  if (parts[0] === 'match' && KINDS.includes(parts[1] as GameKind)) return { name: 'match', kind: parts[1] as GameKind };
  if (parts[0] === 'admin') return { name: 'admin', tab: parts[1] ?? 'overview' };
  if (!KINDS.includes(kind)) return { name: 'home' };
  if (parts[1] === 'bot' || parts[1] === 'pvp') return { name: 'play', kind, mode: parts[1] };
  return { name: 'modes', kind };
}

// ---------- Shell ----------

const ICON_SHIELD = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

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
      <a class="icon-btn" id="admin-btn" href="#/admin" hidden>${ICON_SHIELD}</a>
      <button class="icon-btn" id="sound-btn"></button>
      <button class="icon-btn" id="settings-btn">
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
      </button>
      <a class="icon-btn" id="gh-link" href="${REPO_URL}" target="_blank" rel="noopener" aria-label="GitHub" ${REPO_URL ? '' : 'hidden'}>
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>
    </div>
  </header>
  <div id="banner" class="banner" hidden></div>
  <div id="screen" class="screen-host"></div>
  <footer class="foot"><span>MIT License<span ${REPO_URL ? '' : 'hidden'}> · <a href="${REPO_URL}" target="_blank" rel="noopener" id="src-link"></a></span></span></footer>
`;

const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
const host = $('#screen');
let current: Screen | null = null;
let route: Route = { name: 'home' };

const nav: Nav = {
  go(hash, dir = 'forward') {
    if (hash === location.hash || (hash === '#/' && !location.hash)) return;
    // Leaving a finished matchmaking/room screen should not come back on "back".
    if (route.name === 'match' && hash.startsWith('#/r/')) history.replaceState(null, '', hash);
    else history.pushState(null, '', hash);
    show(dir);
  },
};

function themeFor(list: ColorTheme[], id: string, key: keyof CustomColors): ColorTheme {
  return id === 'custom' ? customTheme(key, settings.custom) : findTheme(list, id);
}

function applyGlobal() {
  const s = t();
  const root = document.documentElement;
  root.lang = settings.lang;
  if (settings.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  applyThemes(root, [
    themeFor(CHESS_BOARDS, settings.chessBoard, 'chessBoard'), themeFor(CHESS_PIECES, settings.chessPieces, 'chessPieces'),
    themeFor(XQ_BOARDS, settings.xqBoard, 'xqBoard'), themeFor(XQ_PIECES, settings.xqPieces, 'xqPieces'),
  ]);
  $('#tagline').textContent = s.tagline;
  $('#src-link').textContent = s.source;
  const back = $('#back-btn');
  back.hidden = route.name === 'home';
  back.title = s.back;
  back.setAttribute('aria-label', s.back);
  $('#settings-btn').title = s.settings;
  $('#settings-btn').setAttribute('aria-label', s.settings);
  const adminBtn = $('#admin-btn');
  adminBtn.hidden = net.me?.role !== 'admin';
  adminBtn.title = s.adminPanel;
  adminBtn.setAttribute('aria-label', s.adminPanel);
  const sb = $('#sound-btn');
  sb.title = settings.sound ? s.soundOff : s.soundOn;
  sb.setAttribute('aria-label', sb.title);
  sb.setAttribute('aria-pressed', String(settings.sound));
  sb.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/>${settings.sound
    ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
  renderBanner();
}

function renderBanner() {
  const b = $('#banner');
  const a = lobby.announcement;
  const dismissed = store.get<number>('dismissed-ann', true);
  if (!a || a.id === dismissed || (a.expires && a.expires < Date.now())) { b.hidden = true; return; }
  b.hidden = false;
  b.className = 'banner ' + a.level;
  b.innerHTML = `<span>${a.level === 'warn' ? '⚠️' : '📢'} ${esc(a.text)}</span><button class="icon-btn" aria-label="${esc(t().close)}">✕</button>`;
  b.querySelector('button')!.onclick = () => { store.set('dismissed-ann', a.id, true); b.hidden = true; };
}

function build(r: Route): Screen {
  switch (r.name) {
    case 'home': return homeScreen(nav);
    case 'modes': return modesScreen(r.kind, nav);
    case 'play': return new PlayScreen({ kind: r.kind, mode: r.mode }, nav);
    case 'room': return new PlayScreen({ kind: 'xiangqi', mode: 'room', room: r.room }, nav);
    case 'match': return matchScreen(r.kind, nav);
    case 'admin': return adminScreen(r.tab, nav);
  }
}

function titleFor(r: Route): string {
  const s = t();
  const base = 'Bàn Cờ';
  if (r.name === 'home') return `${base} — ${s.tagline}`;
  if (r.name === 'room') return `${s.online} — ${base}`;
  if (r.name === 'admin') return `${s.admin.title} — ${base}`;
  return `${s[r.kind]} — ${base}`;
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function show(dir: 'forward' | 'back' | 'none' = 'none') {
  const r = parseRoute(location.hash);
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
  type VT = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
  const vt = (document as Document & { startViewTransition?: (cb: () => void) => VT }).startViewTransition;
  if (dir !== 'none' && vt && !reduceMotion.matches) {
    // A newer navigation skips the running transition; that is expected, not an error.
    const tr = vt.call(document, swap);
    for (const p of [tr.ready, tr.finished, tr.updateCallbackDone]) p?.catch(() => {});
  }
  else {
    swap();
    if (dir !== 'none') current!.el.classList.add('enter-' + dir);
  }
}

function backTarget(): string {
  switch (route.name) {
    case 'play': case 'match': return '#/' + route.kind;
    default: return '#/';
  }
}

function rebuildCurrent() {
  if (current instanceof PlayScreen) { current.refresh(); return; }
  current?.dispose();
  current = build(route);
  host.replaceChildren(current.el);
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

/** Swatch picker with a "custom" entry that reveals colour inputs. */
function palette(list: ColorTheme[], key: keyof CustomColors, value: string, labels: string[], onPick: (id: string) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'palette';
  const sw = document.createElement('div');
  sw.className = 'swatches';
  const pickers = document.createElement('div');
  pickers.className = 'pickers';
  wrap.append(sw, pickers);
  const draw = (v: string) => {
    sw.innerHTML = '';
    for (const th of [...list, customTheme(key, settings.custom)]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw' + (th.id === v ? ' on' : '') + (th.id === 'custom' ? ' custom' : '');
      b.title = th[settings.lang];
      b.setAttribute('aria-label', th[settings.lang]);
      b.setAttribute('aria-pressed', String(th.id === v));
      b.style.setProperty('--a', th.swatch[0]);
      b.style.setProperty('--b', th.swatch[1]);
      b.onclick = () => { draw(th.id); onPick(th.id); };
      sw.appendChild(b);
    }
    pickers.hidden = v !== 'custom';
    pickers.innerHTML = '';
    if (v === 'custom') {
      (settings.custom[key] as string[]).forEach((c, i) => {
        const l = document.createElement('label');
        l.innerHTML = `<input type="color" value="${esc(c)}" /><span>${esc(labels[i])}</span>`;
        l.querySelector('input')!.oninput = e => {
          (settings.custom[key] as string[])[i] = (e.target as HTMLInputElement).value;
          settingsChanged();
          const custom = sw.querySelector<HTMLElement>('.sw.custom')!;
          const th = customTheme(key, settings.custom);
          custom.style.setProperty('--a', th.swatch[0]);
          custom.style.setProperty('--b', th.swatch[1]);
        };
        pickers.appendChild(l);
      });
    }
  };
  draw(value);
  return wrap;
}

function settingsChanged(rebuild = false) {
  saveSettings();
  applyGlobal();
  if (rebuild) rebuildCurrent();
  else if (current instanceof PlayScreen) current.refresh();
}

function accountGroup(close: () => void): HTMLElement {
  const s = t();
  const g = document.createElement('section');
  g.className = 'set-group account';
  const me = net.me;
  if (!net.available || !me) {
    g.innerHTML = `<h3>${esc(s.account)}</h3><p class="muted small">${esc(s.serverOffline)}</p>`;
    return g;
  }
  g.innerHTML = `<h3>${esc(s.account)}</h3>
    <div class="acct"><span class="avatar">${esc([...me.name][0]?.toUpperCase() ?? '?')}</span>
      <div><b>${esc(me.name)}</b><div class="muted small">${esc(me.google ? s.googleAccount : s.guestAccount)} · ${esc(s.rating)} ${me.rating} · ${me.games} ${esc(s.admin.gamesCount)}</div></div></div>
    <div class="row"><span>${esc(s.changeName)}</span><div class="name-edit"><input class="inp" maxlength="20" value="${esc(me.name)}" /><button class="btn">${esc(s.save)}</button></div></div>
    <div class="google-slot"></div>
    <div class="acct-actions"></div>`;
  const input = g.querySelector<HTMLInputElement>('.name-edit input')!;
  g.querySelector<HTMLButtonElement>('.name-edit button')!.onclick = async () => {
    try { await net.rename(input.value); toast(s.nameSaved); lobby.restart(); } catch { toast(s.badName); }
  };
  const actions = g.querySelector<HTMLElement>('.acct-actions')!;
  const slot = g.querySelector<HTMLElement>('.google-slot')!;
  if (!me.google && net.config?.googleClientId) {
    slot.innerHTML = `<p class="muted small">${esc(s.googleHint)}</p><div class="gbtn"></div>`;
    void renderGoogleButton(slot.querySelector('.gbtn')!, async credential => {
      try { await net.loginGoogle(credential); lobby.restart(); close(); applyGlobal(); toast('✓'); } catch { toast(s.netError); }
    });
  }
  const addBtn = (label: string, fn: () => void, cls = 'btn') => {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.onclick = fn;
    actions.appendChild(b);
  };
  if (me.role === 'admin') addBtn(s.adminPanel, () => { close(); nav.go('#/admin'); }, 'btn primary');
  if (me.google) addBtn(s.logout, async () => { await net.logout(); lobby.restart(); close(); applyGlobal(); });
  if (net.config?.dev && me.role !== 'admin') addBtn(s.devAdmin, async () => { await net.loginDevAdmin(); lobby.restart(); close(); applyGlobal(); });
  return g;
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
  const C = s.colorLabels;
  const close = openDialog({ title: s.settings, body, className: 'settings-dlg', actions: [{ label: s.close, kind: 'primary' }] });
  body.append(
    accountGroup(close),
    group(s.general,
      row(s.language, seg([['vi', 'Tiếng Việt'], ['en', 'English']], settings.lang, v => {
        settings.lang = v; settingsChanged(true);
        close(); window.setTimeout(openSettings, 200);
      })),
      row(s.theme, seg([['auto', s.themeAuto], ['light', s.themeLight], ['dark', s.themeDark]], settings.theme, v => { settings.theme = v; settingsChanged(); })),
      row(s.sound, seg([[true, s.on], [false, s.off]], settings.sound, v => {
        settings.sound = v; if (v) { unlockAudio(); playSound('move'); } settingsChanged();
      })),
    ),
    group(s.chess,
      row(s.boardColor, palette(CHESS_BOARDS, 'chessBoard', settings.chessBoard, [C.light, C.dark], id => { settings.chessBoard = id; settingsChanged(); })),
      row(s.pieceColor, palette(CHESS_PIECES, 'chessPieces', settings.chessPieces, [C.white, C.black], id => { settings.chessPieces = id; settingsChanged(); })),
    ),
    group(`${s.xiangqi} · ${s.jieqi}`,
      row(s.boardColor, palette(XQ_BOARDS, 'xqBoard', settings.xqBoard, [C.board, C.lines], id => { settings.xqBoard = id; settingsChanged(); })),
      row(s.pieceColor, palette(XQ_PIECES, 'xqPieces', settings.xqPieces, [C.disc, C.red, C.black], id => { settings.xqPieces = id; settingsChanged(); })),
      row(s.labels, seg([['hanzi', s.hanzi], ['viet', s.viet]], settings.labels, v => { settings.labels = v; settingsChanged(); })),
    ),
  );
}

// ---------- Events ----------

$('#back-btn').onclick = () => nav.go(backTarget(), 'back');
$('.brand').onclick = e => { e.preventDefault(); nav.go('#/', 'back'); };
$('#admin-btn').onclick = e => { e.preventDefault(); nav.go('#/admin'); };
$('#settings-btn').onclick = openSettings;
$('#sound-btn').onclick = () => {
  settings.sound = !settings.sound;
  if (settings.sound) { unlockAudio(); playSound('move'); }
  saveSettings();
  applyGlobal();
};
document.addEventListener('pointerdown', () => { if (settings.sound) unlockAudio(); }, { once: true });
window.addEventListener('popstate', () => show('back'));

// Old links: #chess → #/chess, #/<kind>/online/<id> (peer-to-peer rooms) → mode list.
const legacy = location.hash.slice(1) as GameKind;
if (KINDS.includes(legacy)) history.replaceState(null, '', '#/' + legacy);
const old = location.hash.match(/^#\/(\w+)\/online/);
if (old) history.replaceState(null, '', '#/' + old[1]);

show('none');

// Connect to the online server in the background; local modes never wait for it.
void net.init().then(ok => {
  if (!ok) return;
  lobby.start();
  applyGlobal();
  if (route.name === 'admin') rebuildCurrent();
  const me = net.me;
  if (me?.notice) {
    const s = t();
    openDialog({
      title: s.noticeTitle, icon: '⚠️', body: me.notice,
      actions: [{ label: s.understood, kind: 'primary', onClick: () => { void net.api('/me/notice', { method: 'DELETE' }); } }],
    });
  }
});
lobby.on(msg => {
  if (msg.t === 'announcement' || msg.t === 'hello') renderBanner();
  if (msg.t === 'kicked') { toast(t().bannedShort); void net.refreshMe(); }
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
