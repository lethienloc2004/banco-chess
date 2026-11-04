/** Home (game list) and mode selection screens. */
import { Match } from '../game';
import type { GameKind } from '../engine/types';
import type { Level } from '../engine/ai';
import { KINDS, saveSettings, settings, store, t, type SavedGame } from '../state';

export interface Nav {
  go(hash: string, dir?: 'forward' | 'back'): void;
}

export interface Screen {
  el: HTMLElement;
  dispose(): void;
}

export function gameThumb(kind: GameKind): string {
  if (kind === 'chess') {
    let sq = '';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      if ((x + y) % 2) sq += `<rect x="${x * 16}" y="${y * 16}" width="16" height="16" fill="var(--sq-dark)"/>`;
    }
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="var(--sq-light)"/>${sq}
      <text x="32" y="35" class="thumb-glyph">♞︎</text></svg>`;
  }
  const lines = 'M8 12H56M8 32H56M8 52H56M8 12V52M24 12V52M40 12V52M56 12V52';
  const piece = kind === 'xiangqi'
    ? `<circle cx="32" cy="32" r="17" class="thumb-disc"/><circle cx="32" cy="32" r="13.5" class="thumb-ring"/><text x="32" y="33.5" class="thumb-hz">帥</text>`
    : `<circle cx="32" cy="32" r="17" class="thumb-disc hidden"/><circle cx="32" cy="32" r="13" class="thumb-ring hidden"/><text x="32" y="33.5" class="thumb-q">?</text>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="var(--xq-bg)"/>
    <path d="${lines}" stroke="var(--xq-line)" stroke-width="1.6" fill="none" opacity=".7"/>${piece}</svg>`;
}

const chevron = `<svg class="chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function savedGame(kind: GameKind): SavedGame | null {
  const g = store.get<SavedGame>('game:' + kind);
  return g && g.match?.moves?.length && !g.over ? g : null;
}

export function homeScreen(nav: Nav): Screen {
  const s = t();
  const el = document.createElement('section');
  el.className = 'screen home';
  el.innerHTML = `
    <div class="hero">
      <img class="hero-logo" src="./icon.svg" alt="" width="72" height="72" />
      <h1>${s.heroTitle}</h1>
      <p>${s.heroSub}</p>
    </div>
    <h2 class="list-title">${s.chooseGame}</h2>
    <ul class="list"></ul>`;
  const ul = el.querySelector('ul')!;
  KINDS.forEach((kind, i) => {
    const li = document.createElement('li');
    const saved = savedGame(kind);
    li.innerHTML = `<button class="item" style="--i:${i}">
        <span class="thumb">${gameThumb(kind)}</span>
        <span class="txt"><b>${s[kind]}${saved ? ` <em class="badge">${s.inProgress}</em>` : ''}</b><small>${s[`${kind}Desc` as const]}</small></span>
        ${chevron}
      </button>`;
    li.querySelector('button')!.onclick = () => nav.go('#/' + kind);
    ul.appendChild(li);
  });
  return { el, dispose() {} };
}

function seg<T extends string | number>(options: [T, string][], value: T, onPick: (v: T) => void): HTMLElement {
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

function optRow(label: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row';
  const span = document.createElement('span');
  span.textContent = label;
  row.append(span, control);
  return row;
}

export function modesScreen(kind: GameKind, nav: Nav): Screen {
  const s = t();
  const red = kind === 'chess' ? s.white : s.red;
  const el = document.createElement('section');
  el.className = 'screen modes';
  el.innerHTML = `
    <div class="screen-head">
      <span class="thumb big">${gameThumb(kind)}</span>
      <div><h1>${s[kind]}</h1><p>${s[`${kind}Desc` as const]}</p></div>
    </div>
    <h2 class="list-title">${s.chooseMode}</h2>
    <ul class="list"></ul>
    ${kind === 'jieqi' ? `<details class="rules"><summary>${s.rulesTitle}</summary><ul>${s.rules.map(r => `<li>${r}</li>`).join('')}</ul></details>` : ''}`;
  const ul = el.querySelector('ul.list')!;
  let i = 0;

  const saved = savedGame(kind);
  if (saved) {
    const li = document.createElement('li');
    const modeName = saved.mode === 'bot' ? `${s.bot} · ${s[saved.level]}` : s.pvp;
    li.innerHTML = `<button class="item accent" style="--i:${i++}">
      <span class="icon-badge">▶</span>
      <span class="txt"><b>${s.continueGame}</b><small>${s.continueDesc(saved.match.moves.length, modeName)}</small></span>${chevron}</button>`;
    li.querySelector('button')!.onclick = () => nav.go(`#/${kind}/${saved.mode}`);
    ul.appendChild(li);
  }

  const expandable = (icon: string, title: string, desc: string, build: (panel: HTMLElement) => void) => {
    const li = document.createElement('li');
    li.className = 'expandable';
    li.innerHTML = `<button class="item" style="--i:${i++}" aria-expanded="false">
      <span class="icon-badge">${icon}</span>
      <span class="txt"><b>${title}</b><small>${desc}</small></span>${chevron}</button>
      <div class="opts"><div class="opts-inner"></div></div>`;
    const btn = li.querySelector('button')!;
    build(li.querySelector('.opts-inner')!);
    btn.onclick = () => {
      const open = !li.classList.contains('open');
      ul.querySelectorAll('li.open').forEach(o => { o.classList.remove('open'); o.querySelector('button')!.setAttribute('aria-expanded', 'false'); });
      if (open) { li.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    };
    ul.appendChild(li);
  };

  const startBtn = (label: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn primary wide';
    b.textContent = label;
    b.onclick = onClick;
    return b;
  };

  expandable('🤖', s.bot, s.botDesc, panel => {
    panel.append(
      optRow(s.youPlay, seg<0 | 1>([[0, red], [1, s.black]], settings.humanSide, v => { settings.humanSide = v; saveSettings(); })),
      optRow(s.level, seg<Level>([['easy', s.easy], ['medium', s.medium], ['hard', s.hard]], settings.level, v => { settings.level = v; saveSettings(); })),
      startBtn(s.start, () => {
        store.set('game:' + kind, { match: new Match(kind).save(), mode: 'bot', humanSide: settings.humanSide, level: settings.level } satisfies SavedGame);
        nav.go(`#/${kind}/bot`);
      }),
    );
  });

  expandable('👥', s.pvp, s.pvpDesc, panel => {
    panel.append(startBtn(s.start, () => {
      store.set('game:' + kind, { match: new Match(kind).save(), mode: 'pvp', humanSide: 0, level: settings.level } satisfies SavedGame);
      nav.go(`#/${kind}/pvp`);
    }));
  });

  expandable('🌐', s.online, s.onlineDesc, panel => {
    panel.append(
      optRow(s.youPlay, seg<0 | 1 | 'random'>([[0, red], [1, s.black], ['random', s.random]], settings.onlineSide, v => { settings.onlineSide = v; saveSettings(); })),
      startBtn(s.createRoom, () => nav.go(`#/${kind}/online`)),
    );
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = s.onlineNote;
    panel.appendChild(note);
  });

  return { el, dispose() {} };
}
