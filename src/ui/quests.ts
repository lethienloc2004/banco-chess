/**
 * Quests & skins screen (#/quests), plus reporting what the player did so
 * quests progress. Progress lives on the server, per account.
 */
import type { GameKind } from '../engine/types';
import { net } from '../net';
import { ACHIEVEMENTS, SEASONS, SKINS, activeSeason, dayKey, questById, skinById, type QuestDef } from '../shared/quests';
import { settings, t } from '../state';
import { confirmDialog, toast } from './dialog';
import type { Nav, Screen } from './home';
import { skinPreview, skinTheme } from './skins';
import { esc } from './util';

export interface QuestRow {
  id: string; scope: QuestDef['scope']; period: string; progress: number; target: number; done: boolean; claimed: boolean;
  reward: { coins?: number; skin?: string };
}
export interface QuestState {
  day: string; week: string; resetsIn: { day: number; week: number };
  season: { id: string; end: string } | null;
  coins: number; streak: number; equipped: string | null; owned: string[];
  quests: QuestRow[]; shop: { id: string; price: number }[];
}

/** Rewards waiting to be taken (for the badge on the home screen). */
export let claimable = 0;
const listeners = new Set<() => void>();
export const onQuestsChange = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
function setState(st: QuestState) {
  claimable = st.quests.filter(q => q.done && !q.claimed).length;
  if (net.me) net.me = { ...net.me, coins: st.coins, skin: st.equipped };
  listeners.forEach(fn => fn());
}

export async function loadQuests(): Promise<QuestState | null> {
  if (!(await net.init()) || !net.me) return null;
  try {
    const st = await net.api<QuestState>('/quests');
    setState(st);
    return st;
  } catch {
    return null;
  }
}

/** Short stable id for a game (the same game reported twice counts once). */
export function gameKey(...parts: unknown[]): string {
  const s = JSON.stringify(parts);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619); h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length.toString(36);
}

type Report =
  | { type: 'bot-game'; kind: GameKind; level: string; result: 'win' | 'loss' | 'draw'; key: string }
  | { type: 'puzzle'; id: string }
  | { type: 'analysis'; key: string }
  | { type: 'watch'; key: string };

/** Tell the server; announce quests this completed. Never blocks or fails the game. */
export function reportQuest(ev: Report) {
  if (!net.available || !net.me) return;
  void net.api<{ completed: string[] }>('/quests/event', { method: 'POST', body: ev }).then(r => {
    if (r.completed.length) {
      const names = r.completed.map(id => questById(id)?.title[settings.lang]).filter(Boolean);
      toast(`🎯 ${t().quests.completed}: ${names.join(' · ')}`);
      void loadQuests();
    }
  }).catch(() => {});
}

const fmtLeft = (ms: number) => {
  const h = Math.floor(ms / 3600_000), d = Math.floor(h / 24), m = Math.floor((ms % 3600_000) / 60_000);
  return d >= 1 ? `${d}${settings.lang === 'vi' ? ' ngày' : 'd'} ${h % 24}h` : `${h}h ${String(m).padStart(2, '0')}m`;
};

export function questsThumb(): string {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="var(--accent-soft)"/>
    <circle cx="32" cy="32" r="19" fill="none" stroke="var(--accent)" stroke-width="5"/><circle cx="32" cy="32" r="10" fill="none" stroke="var(--accent)" stroke-width="5"/>
    <circle cx="32" cy="32" r="3.5" fill="var(--accent)"/><path d="M33 31L50 14M44 13h7v7" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/></svg>`;
}

export function questsScreen(tab: string | undefined, nav: Nav): Screen {
  const s = t();
  const Qs = s.quests;
  const el = document.createElement('section');
  el.className = 'screen quests-screen';
  let disposed = false;
  let st: QuestState | null = null;
  let current: 'quests' | 'skins' = tab === 'skins' ? 'skins' : 'quests';
  let previewGame: 'chess' | 'xq' = 'chess';

  const reward = (r: QuestRow['reward']) => [
    r.coins ? `<span class="coin-tag">🪙 ${r.coins}</span>` : '',
    r.skin ? `<span class="skin-tag">🎨 ${esc(skinById(r.skin)?.name[settings.lang] ?? r.skin)}</span>` : '',
  ].join('');

  const row = (q: QuestRow) => {
    const def = questById(q.id)!;
    const pct = Math.round((q.progress / q.target) * 100);
    const shown = q.id === 'a.rated-1400' ? `${q.progress || '—'} / ${q.target}` : `${q.progress} / ${q.target}`;
    return `<li class="quest${q.done ? ' done' : ''}${q.claimed ? ' claimed' : ''}">
      <div class="q-main"><b>${esc(def.title[settings.lang])}</b>
        <div class="q-bar"><span style="width:${pct}%"></span></div>
        <div class="q-meta"><span class="muted small">${shown}</span>${reward(q.reward)}</div></div>
      ${q.claimed ? `<span class="q-claimed">✓ ${esc(Qs.claimed)}</span>`
        : q.done ? `<button class="btn primary" data-claim="${esc(q.id)}" data-period="${esc(q.period)}">${esc(Qs.claim)}</button>`
        : ''}
    </li>`;
  };

  const section = (title: string, sub: string, list: QuestRow[]) => list.length
    ? `<div class="card q-section"><div class="q-head"><h2>${esc(title)}</h2><span class="muted small">${esc(sub)}</span></div><ul class="q-list">${list.map(row).join('')}</ul></div>` : '';

  const skinCard = (id: string) => {
    const def = skinById(id)!;
    const owned = st!.owned.includes(id);
    const equipped = st!.equipped === id;
    const sale = st!.shop.find(x => x.id === id);
    const ach = ACHIEVEMENTS.find(a => a.reward.skin === id);
    const season = def.season ? SEASONS.find(x => x.id === def.season) : null;
    let action: string;
    if (equipped) action = `<button class="btn" disabled>✓ ${esc(Qs.equipped)}</button>`;
    else if (owned) action = `<button class="btn primary" data-equip="${id}">${esc(Qs.equip)}</button>`;
    else if (sale) action = `<button class="btn" data-buy="${id}" ${st!.coins < sale.price ? 'disabled' : ''}>🪙 ${sale.price} · ${esc(Qs.buy)}</button>`;
    else action = '';
    let how = '';
    if (!owned) {
      if (ach) how = `🔒 ${ach.title[settings.lang]}`;
      else if (season && !sale) how = `📅 ${Qs.onlyDuring(`${season.emoji} ${season.name[settings.lang]}`)}`;
      else if (season && sale) how = Qs.orEvent;
    }
    return `<div class="skin-card${owned ? ' owned' : ''}${equipped ? ' on' : ''}">
      ${skinPreview(id, previewGame)}
      <b>${esc(def.name[settings.lang])}</b>
      ${def.how === 'season' ? `<p class="small board-too">🖼 ${esc(Qs.boardToo)}</p>` : ''}
      ${how ? `<p class="muted small">${esc(how)}</p>` : ''}
      ${action}
    </div>`;
  };

  const draw = () => {
    if (disposed || !st) return;
    const season = st.season ? SEASONS.find(x => x.id === st!.season!.id) : null;
    const daily = st.quests.filter(q => q.scope === 'daily'), weekly = st.quests.filter(q => q.scope === 'weekly');
    const event = st.quests.filter(q => q.scope === 'season'), ach = st.quests.filter(q => q.scope === 'achievement');
    const body = current === 'quests'
      ? (season ? `<div class="season-banner">${season.emoji} <b>${esc(Qs.eventNow(season.name[settings.lang]))}</b> <span>${esc(Qs.eventEnds(st.season!.end.split('-').reverse().join('/')))}</span></div>` : '')
        + section(Qs.today, Qs.resets(fmtLeft(st.resetsIn.day)), daily)
        + section(Qs.week, Qs.resets(fmtLeft(st.resetsIn.week)), weekly)
        + (season ? section(`${season.emoji} ${Qs.event}`, '', event) : '')
        + section(Qs.achievements, Qs.achievementsSub, ach)
      : `<div class="card skin-now"><div><h2>${esc(Qs.wearing)}</h2><b>${esc(st.equipped ? skinById(st.equipped)?.name[settings.lang] ?? '' : Qs.noSkin)}</b>
          <p class="muted small">${esc(Qs.othersSee)}</p>
          ${st.equipped ? `<button class="btn ghost" data-equip="">${esc(Qs.unequip)}</button>` : ''}</div>
          <div class="skin-now-prev">${skinPreview(st.equipped, previewGame)}</div></div>
        <div class="seg skin-game"><button data-g="chess" class="${previewGame === 'chess' ? 'on' : ''}">${esc(s.chess)}</button><button data-g="xq" class="${previewGame === 'xq' ? 'on' : ''}">${esc(s.xiangqi)}</button></div>
        <div class="skin-grid">${SKINS.map(x => skinCard(x.id)).join('')}</div>`;
    el.innerHTML = `
      <div class="screen-head"><span class="thumb big">${questsThumb()}</span>
        <div><h1>${esc(Qs.title)}</h1><p>${esc(Qs.subtitle)}</p></div></div>
      <div class="wallet"><span class="coins">🪙 <b>${st.coins}</b> ${esc(Qs.coins)}</span><span class="streak">🔥 <b>${st.streak}</b> ${esc(Qs.streakDays)}</span>${net.member ? '' : `<span class="muted small">${esc(Qs.guestNote)}</span>`}</div>
      <nav class="pz-tabs q-tabs"><a href="#/quests" class="${current === 'quests' ? 'on' : ''}" data-tab="quests">🎯 ${esc(Qs.tabQuests)}${claimable ? ` <em class="badge">${claimable}</em>` : ''}</a><a href="#/quests/skins" class="${current === 'skins' ? 'on' : ''}" data-tab="skins">🎨 ${esc(Qs.tabSkins)}</a></nav>
      <div class="q-body">${body}</div>`;
    el.querySelectorAll<HTMLAnchorElement>('[data-tab]').forEach(a => (a.onclick = e => { e.preventDefault(); current = a.dataset.tab as typeof current; draw(); history.replaceState(null, '', a.getAttribute('href')!); }));
    el.querySelectorAll<HTMLButtonElement>('[data-g]').forEach(b => (b.onclick = () => { previewGame = b.dataset.g as typeof previewGame; draw(); }));
    el.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach(b => (b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await net.api<{ state: QuestState; completed: string[] }>('/quests/claim', { method: 'POST', body: { quest: b.dataset.claim, period: b.dataset.period } });
        const q = questById(b.dataset.claim!)!;
        toast(`🎉 ${Qs.got} ${[q.reward.coins ? `🪙 ${q.reward.coins}` : '', q.reward.skin ? `🎨 ${skinById(q.reward.skin)?.name[settings.lang]}` : ''].filter(Boolean).join(' + ')}`);
        st = r.state; setState(st); draw();
      } catch { toast(s.netError); b.disabled = false; }
    }));
    el.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => (b.onclick = async () => {
      const id = b.dataset.buy!;
      const price = st!.shop.find(x => x.id === id)?.price ?? 0;
      if (!(await confirmDialog(Qs.confirmBuy(skinById(id)!.name[settings.lang], price), Qs.buy, s.close))) return;
      try {
        const r = await net.api<{ state: QuestState }>('/skins/buy', { method: 'POST', body: { skin: id } });
        st = r.state; setState(st); toast(`🎨 ${skinById(id)!.name[settings.lang]}`); draw();
      } catch { toast(Qs.notEnough); }
    }));
    el.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach(b => (b.onclick = async () => {
      try {
        const r = await net.api<{ state: QuestState }>('/skins/equip', { method: 'POST', body: { skin: b.dataset.equip || null } });
        st = r.state; setState(st); draw();
      } catch { toast(s.netError); }
    }));
  };

  el.innerHTML = `<p class="muted">${esc(s.board.loading)}</p>`;
  void (async () => {
    const r = await loadQuests();
    if (disposed) return;
    if (!r) {
      el.innerHTML = `<div class="mm-card"><div class="ov-icon">📡</div><h1>${esc(s.serverOffline)}</h1><p>${esc(Qs.needServer)}</p>
        <button class="btn primary" data-act="home">${esc(s.home)}</button></div>`;
      el.querySelector<HTMLButtonElement>('[data-act="home"]')!.onclick = () => nav.go('#/', 'back');
      return;
    }
    st = r;
    draw();
  })();
  return { el, dispose() { disposed = true; } };
}

/** Holiday board for the viewer: the theme of the skin they wear (unless turned off). */
export const myBoardTheme = () => (settings.themedBoard ? skinTheme(net.me?.skin) : null);

/** Is a holiday running today (for a badge)? */
export const seasonNow = () => activeSeason(dayKey());
