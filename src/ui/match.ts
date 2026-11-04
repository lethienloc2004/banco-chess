/** Random matchmaking screen: waits in the lobby queue for an opponent. */
import type { GameKind } from '../engine/types';
import { lobby, net } from '../net';
import { RANKED_CLOCK } from '../shared/protocol';
import { t } from '../state';
import { gameThumb, type Nav, type Screen } from './home';
import { esc, formatClock } from './util';

export function matchScreen(kind: GameKind, nav: Nav): Screen {
  const s = t();
  const el = document.createElement('section');
  el.className = 'screen matchmaking';
  const started = Date.now();
  let timer = 0;
  let off: (() => void) | null = null;
  let queued = false;

  const draw = (state: 'searching' | 'offline' | 'banned') => {
    const stats = lobby.stats;
    if (state !== 'searching') {
      el.innerHTML = `<div class="mm-card"><div class="ov-icon">${state === 'banned' ? '⛔' : '📡'}</div>
        <h1>${esc(state === 'banned' ? s.bannedTitle : s.serverOffline)}</h1>
        <p>${esc(state === 'banned' ? s.bannedText(net.banned?.reason ?? '') : s.serverOfflineHint)}</p>
        <button class="btn primary" data-act="back">${esc(s.back)}</button></div>`;
      el.querySelector<HTMLButtonElement>('[data-act="back"]')!.onclick = () => nav.go('#/' + kind, 'back');
      return;
    }
    el.innerHTML = `<div class="mm-card">
      <div class="mm-orbit"><span class="thumb big">${gameThumb(kind)}</span><span class="mm-ring"></span><span class="mm-ring r2"></span></div>
      <h1>${esc(s.searching)}</h1>
      <p class="mm-time">0:00</p>
      <p>${esc(s[kind])} · ${esc(s.ranked)} · ${RANKED_CLOCK.base / 60}+${RANKED_CLOCK.inc}</p>
      <p class="mm-stats">${stats ? esc(s.lobbyStats(stats.online, stats.queued[kind])) : ''}</p>
      <button class="btn" data-act="cancel">${esc(s.cancel)}</button></div>`;
    el.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.onclick = () => nav.go('#/' + kind, 'back');
  };

  const start = async () => {
    if (!(await net.init())) return draw('offline');
    if (net.banned) return draw('banned');
    lobby.start();
    draw('searching');
    off = lobby.on(msg => {
      if (msg.t === 'matched') { queued = false; nav.go('#/r/' + msg.room); }
      if (msg.t === 'stats') {
        const p = el.querySelector('.mm-stats');
        if (p) p.textContent = s.lobbyStats(msg.stats.online, msg.stats.queued[kind]);
      }
      if (msg.t === 'hello' && queued) lobby.send({ t: 'queue', kind }); // re-queue after a reconnect
      if (msg.t === 'kicked') draw('banned');
    });
    const queue = () => {
      if (lobby.connected) { lobby.send({ t: 'queue', kind }); queued = true; }
      else window.setTimeout(queue, 300);
    };
    queue();
    timer = window.setInterval(() => {
      const tm = el.querySelector('.mm-time');
      if (tm) tm.textContent = formatClock(Date.now() - started + 999);
    }, 500);
  };
  void start();

  return {
    el,
    dispose() {
      clearInterval(timer);
      off?.();
      if (queued) lobby.send({ t: 'cancel' });
    },
  };
}
