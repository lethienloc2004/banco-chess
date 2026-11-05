/** Admin dashboard: overview, games, reports, users, announcements, audit log. */
import { Match } from '../game';
import type { GameKind } from '../engine/types';
import { net } from '../net';
import { DEFAULT_RATING, type MoveRec, type Ratings } from '../shared/protocol';
import { KINDS, settings, t } from '../state';
import { BoardRenderer } from './board';
import { confirmDialog, openDialog, toast } from './dialog';
import type { Nav, Screen } from './home';
import { esc, timeAgo } from './util';

type Tab = 'overview' | 'games' | 'reports' | 'users' | 'announcements' | 'audit';
const TABS: Tab[] = ['overview', 'games', 'reports', 'users', 'announcements', 'audit'];

interface GameRow {
  id: string; kind: GameKind; rated: number; p0_id: string | null; p0_name: string | null; p1_id: string | null; p1_name: string | null;
  status: string; winner: number | null; reason: string | null; created: number; ended: number | null; plies?: number;
}
interface UserRow {
  id: string; name: string; email: string | null; role: string; ratings?: Ratings; games: number; wins: number;
  warnings: number; banned_until: number | null; ban_reason: string | null; created: number; last_seen: number; google_sub: string | null;
}

const ratingOf = (u: UserRow, k: GameKind) => u.ratings?.[k] ?? DEFAULT_RATING;
/** The four ratings in one cell, each titled with its game. */
const ratingCell = (u: UserRow) => KINDS.map(k => `<span title="${esc(t()[k])}">${ratingOf(u, k)}</span>`).join(' · ');

const fmtDate = (ts: number | null) => (ts ? new Date(ts).toLocaleString(settings.lang === 'vi' ? 'vi-VN' : 'en-GB') : '—');

export function adminScreen(tab: Tab | string, nav: Nav): Screen {
  const s = t();
  const A = s.admin;
  const el = document.createElement('section');
  el.className = 'screen admin';
  const current: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'overview';
  let disposed = false;

  if (!net.me || net.me.role !== 'admin') {
    el.innerHTML = `<div class="mm-card"><div class="ov-icon">🔒</div><h1>${esc(A.noAccess)}</h1><p>${esc(A.noAccessHint)}</p>
      <button class="btn primary" data-act="home">${esc(s.home)}</button></div>`;
    el.querySelector<HTMLButtonElement>('[data-act="home"]')!.onclick = () => nav.go('#/', 'back');
    return { el, dispose() {} };
  }

  el.innerHTML = `
    <div class="admin-head"><h1>🛡️ ${esc(A.title)}</h1><span class="muted">${esc(net.me.name)}</span></div>
    <nav class="admin-tabs">${TABS.map(x => `<a href="#/admin/${x}" class="${x === current ? 'on' : ''}">${esc(A.tabs[x])}</a>`).join('')}</nav>
    <div class="admin-body"><p class="muted"><span class="spinner"></span></p></div>`;
  el.querySelectorAll<HTMLAnchorElement>('.admin-tabs a').forEach(a => {
    a.onclick = e => { e.preventDefault(); nav.go(a.getAttribute('href')!, 'none'); };
  });
  const body = el.querySelector<HTMLElement>('.admin-body')!;

  const call = async <T>(path: string, method = 'GET', data?: unknown): Promise<T | null> => {
    try { return await net.api<T>('/admin' + path, { method, body: data }); }
    catch (e) { toast(`${A.failed}: ${(e as Error).message}`); return null; }
  };

  const result = (g: GameRow) => {
    if (g.status === 'playing') return `<span class="tag live">${esc(A.live)}</span>`;
    const reason = s.reasons[g.reason as keyof typeof s.reasons] ?? g.reason ?? '';
    const who = g.winner === 0 ? g.p0_name : g.winner === 1 ? g.p1_name : null;
    return who ? `${esc(A.wonBy(who))} · <span class="muted">${esc(reason)}</span>` : `<span class="muted">${esc(reason || s.draw)}</span>`;
  };

  const gamesTable = (games: GameRow[]) => games.length ? `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>${esc(A.game)}</th><th>${esc(A.players)}</th><th>${esc(A.result)}</th><th>${esc(A.time)}</th></tr></thead><tbody>
    ${games.map(g => `<tr data-game="${esc(g.id)}" class="clickable">
      <td>${esc(s[g.kind])}${g.rated ? ` <span class="tag">${esc(s.ranked)}</span>` : ''}<div class="muted small">${esc(g.id)}</div></td>
      <td><span class="dot xq side-0"></span> ${esc(g.p0_name ?? '—')}<br><span class="dot xq side-1"></span> ${esc(g.p1_name ?? '—')}</td>
      <td>${result(g)}${g.plies !== undefined ? `<div class="muted small">${g.plies} ${esc(A.plies)}</div>` : ''}</td>
      <td class="muted small">${esc(timeAgo(g.created, settings.lang))}</td></tr>`).join('')}
    </tbody></table></div>` : `<p class="muted">${esc(A.empty)}</p>`;

  const bindGames = (root: HTMLElement) => {
    root.querySelectorAll<HTMLElement>('[data-game]').forEach(r => (r.onclick = () => void openGame(r.dataset.game!)));
    root.querySelectorAll<HTMLElement>('[data-user]').forEach(r => (r.onclick = e => { e.stopPropagation(); void openUser(r.dataset.user!); }));
  };

  // ---------- Game detail with replay ----------
  async function openGame(id: string) {
    const r = await call<{ game: GameRow & { initial: string; moves: MoveRec[]; online?: boolean[] } }>(`/games/${id}`);
    if (!r) return;
    const g = r.game;
    const full = Match.restore({ kind: g.kind, initial: g.initial, moves: g.moves.map(m => m.m) });
    let ply = full.moves.length;
    const wrap = document.createElement('div');
    wrap.className = 'replay';
    wrap.innerHTML = `<div class="replay-board"></div>
      <div class="replay-nav"><button class="btn" data-n="first">⏮</button><button class="btn" data-n="prev">◀</button>
      <span class="replay-ply"></span><button class="btn" data-n="next">▶</button><button class="btn" data-n="last">⏭</button></div>
      <p class="small"><span class="dot xq side-0"></span> <a href="#" data-user="${esc(g.p0_id ?? '')}">${esc(g.p0_name ?? '—')}</a> ·
        <span class="dot xq side-1"></span> <a href="#" data-user="${esc(g.p1_id ?? '')}">${esc(g.p1_name ?? '—')}</a></p>
      <p class="small">${result(g)} · ${esc(fmtDate(g.created))}</p>
      <div class="admin-actions"></div>`;
    const renderer = new BoardRenderer(wrap.querySelector('.replay-board')!, () => {});
    const show = () => {
      const m = Match.restore({ kind: g.kind, initial: g.initial, moves: full.moves.slice(0, ply) });
      renderer.render(m, { flipped: false, selected: null, targets: new Map(), labels: settings.labels, river: ['楚 河', '漢 界'], peek: true });
      wrap.querySelector('.replay-ply')!.textContent = `${ply} / ${full.moves.length}${ply ? ' · ' + (full.notes[ply - 1]?.[settings.lang] ?? '') : ''}`;
    };
    wrap.querySelectorAll<HTMLButtonElement>('[data-n]').forEach(b => (b.onclick = () => {
      const n = b.dataset.n;
      ply = n === 'first' ? 0 : n === 'prev' ? Math.max(0, ply - 1) : n === 'next' ? Math.min(full.moves.length, ply + 1) : full.moves.length;
      show();
    }));
    const actions = wrap.querySelector<HTMLElement>('.admin-actions')!;
    const act = async (label: string, payload: { action: 'cancel' | 'result'; winner?: 0 | 1 | null }) => {
      if (!(await confirmDialog(`${label}?`, A.confirm, s.close))) return;
      if (await call(`/games/${g.id}/action`, 'POST', payload)) { toast(A.done); close(); void load(); }
    };
    const mk = (label: string, payload: { action: 'cancel' | 'result'; winner?: 0 | 1 | null }, danger = false) => {
      const b = document.createElement('button');
      b.className = 'btn' + (danger ? ' danger' : '');
      b.textContent = label;
      b.onclick = () => void act(label, payload);
      actions.appendChild(b);
    };
    mk(A.cancelGame, { action: 'cancel' }, true);
    mk(A.setWinner(g.p0_name ?? s.red), { action: 'result', winner: 0 });
    mk(A.setWinner(g.p1_name ?? s.black), { action: 'result', winner: 1 });
    mk(A.setDraw, { action: 'result', winner: null });
    wrap.querySelectorAll<HTMLAnchorElement>('[data-user]').forEach(a => (a.onclick = e => { e.preventDefault(); if (a.dataset.user) void openUser(a.dataset.user); }));
    const close = openDialog({ title: `${s[g.kind]} · ${g.id}`, body: wrap, className: 'wide-dlg', actions: [{ label: s.close, kind: 'primary' }] });
    show();
  }

  // ---------- User detail ----------
  async function openUser(id: string) {
    const r = await call<{ user: UserRow; games: GameRow[]; reports: { reason: string; note: string; created: number; status: string }[] }>(`/users/${id}`);
    if (!r) return;
    const u = r.user;
    const banned = u.banned_until !== null && u.banned_until > Date.now();
    const wrap = document.createElement('div');
    wrap.className = 'user-detail';
    wrap.innerHTML = `
      <div class="kv">
        <span>${esc(A.id)}</span><code>${esc(u.id)}</code>
        <span>${esc(A.email)}</span><span>${esc(u.email ?? (u.google_sub ? 'Google' : A.guest))}</span>
        <span>${esc(s.rating)}</span><span>${KINDS.map(k => `${esc(s[k])} <b>${ratingOf(u, k)}</b>`).join(' · ')}<br>${u.games} ${esc(A.gamesCount)} · ${u.wins} ${esc(A.winsCount)} · <a href="#/player/${esc(u.id)}">${esc(s.board.profile)}</a></span>
        <span>${esc(A.role)}</span><span>${u.role === 'admin' ? '🛡️ ' + esc(A.adminRole) : esc(A.userRole)}</span>
        <span>${esc(A.warnings)}</span><span>${u.warnings}</span>
        <span>${esc(A.status)}</span><span>${banned ? `⛔ ${esc(A.bannedUntil(fmtDate(u.banned_until! > 8e15 ? null : u.banned_until)))} — ${esc(u.ban_reason ?? '')}` : '✅ ' + esc(A.active)}</span>
        <span>${esc(A.joined)}</span><span>${esc(fmtDate(u.created))} · ${esc(A.lastSeen)} ${esc(fmtDate(u.last_seen))}</span>
      </div>
      <div class="admin-form">
        <input class="inp" name="reason" maxlength="300" placeholder="${esc(A.reasonPh)}" />
        <div class="admin-actions">
          <select class="inp" name="days"><option value="1">1 ${esc(A.days)}</option><option value="7">7 ${esc(A.days)}</option><option value="30">30 ${esc(A.days)}</option><option value="0">${esc(A.permanent)}</option></select>
          <button class="btn danger" data-a="ban">${esc(A.ban)}</button>
          ${banned ? `<button class="btn" data-a="unban">${esc(A.unban)}</button>` : ''}
          <button class="btn" data-a="warn">${esc(A.warn)}</button>
        </div>
        <div class="admin-actions">
          <input class="inp" name="name" maxlength="20" value="${esc(u.name)}" />
          <button class="btn" data-a="rename">${esc(A.rename)}</button>
          <select class="inp" name="rkind"><option value="all">${esc(A.allGames)}</option>${KINDS.map(k => `<option value="${k}">${esc(s[k])}</option>`).join('')}</select>
          <input class="inp narrow" name="rating" type="number" min="100" max="3500" value="${ratingOf(u, 'chess')}" />
          <button class="btn" data-a="rating">${esc(A.setRating)}</button>
        </div>
        <div class="admin-actions">
          <button class="btn" data-a="role">${esc(u.role === 'admin' ? A.removeAdmin : A.makeAdmin)}</button>
          <button class="btn danger" data-a="delete">${esc(A.deleteUser)}</button>
        </div>
      </div>
      <h3>${esc(A.recentGames)}</h3>${gamesTable(r.games)}
      <h3>${esc(A.reportsAgainst)}</h3>
      ${r.reports.length ? `<ul class="plain">${r.reports.map(x => `<li><b>${esc(s.reportReasons[x.reason as keyof typeof s.reportReasons] ?? x.reason)}</b> — ${esc(x.note || '')} <span class="muted small">${esc(fmtDate(x.created))} · ${esc(x.status)}</span></li>`).join('')}</ul>` : `<p class="muted">${esc(A.empty)}</p>`}`;
    const val = (n: string) => wrap.querySelector<HTMLInputElement>(`[name="${n}"]`)!.value;
    wrap.querySelectorAll<HTMLButtonElement>('[data-a]').forEach(b => (b.onclick = async () => {
      const a = b.dataset.a!;
      const payload: Record<string, unknown> = { action: a, reason: val('reason') };
      if (a === 'ban') payload.days = Number(val('days')) || null;
      if (a === 'rename') payload.name = val('name');
      if (a === 'rating') { payload.rating = Number(val('rating')); payload.kind = val('rkind'); }
      if (a === 'role') payload.role = u.role === 'admin' ? 'user' : 'admin';
      if ((a === 'ban' || a === 'delete' || a === 'role') && !(await confirmDialog(`${b.textContent} — ${u.name}?`, A.confirm, s.close))) return;
      if (await call(`/users/${u.id}/action`, 'POST', payload)) { toast(A.done); close(); if (a !== 'delete') void openUser(u.id); void load(); }
    }));
    bindGames(wrap);
    const close = openDialog({ title: u.name, body: wrap, className: 'wide-dlg', actions: [{ label: s.close, kind: 'primary' }] });
  }

  // ---------- Tabs ----------
  async function load() {
    if (disposed) return;
    if (current === 'overview') {
      const st = await call<{
        online: number; queued: Record<GameKind, number>; users: number; newUsers: number; liveGames: number;
        gamesToday: number; openReports: number; banned: number; byKind: Record<string, number>; perDay: number[];
      }>('/stats');
      if (!st || disposed) return;
      const max = Math.max(1, ...st.perDay);
      body.innerHTML = `<div class="stat-grid">
        ${[[A.online, st.online, '🟢'], [A.liveGames, st.liveGames, '♟️'], [A.gamesToday, st.gamesToday, '📅'], [A.users, st.users, '👥'],
          [A.newUsers, st.newUsers, '✨'], [A.openReports, st.openReports, '🚩'], [A.bannedUsers, st.banned, '⛔']]
          .map(([l, v, i]) => `<div class="stat"><span class="stat-i">${i}</span><b>${v}</b><span>${esc(String(l))}</span></div>`).join('')}
      </div>
      <div class="admin-cards">
        <div class="card"><h2>${esc(A.last7)}</h2><div class="bars">${st.perDay.map((n, i) => `<div class="bar" style="--h:${(n / max) * 100}%" title="${n}"><span>${n}</span><em>${esc(A.dayLabel(6 - i))}</em></div>`).join('')}</div></div>
        <div class="card"><h2>${esc(A.byKind)}</h2>${(['chess', 'xiangqi', 'jieqi', 'hiddenchess'] as GameKind[]).map(k => `<div class="row"><span>${esc(s[k])}</span><b>${st.byKind[k] ?? 0}</b><span class="muted small">${esc(A.queued)}: ${st.queued[k]}</span></div>`).join('')}</div>
      </div>`;
    } else if (current === 'games') {
      body.innerHTML = `<div class="admin-filter"><input class="inp" placeholder="${esc(A.searchGames)}" />
        <select class="inp"><option value="">${esc(A.all)}</option><option value="playing">${esc(A.live)}</option><option value="over">${esc(A.finished)}</option></select></div><div class="list-area"></div>`;
      const [q, sel] = [body.querySelector<HTMLInputElement>('input')!, body.querySelector<HTMLSelectElement>('select')!];
      const area = body.querySelector<HTMLElement>('.list-area')!;
      const fetchGames = async () => {
        const r = await call<{ games: GameRow[] }>(`/games?status=${sel.value}&q=${encodeURIComponent(q.value)}`);
        if (r) { area.innerHTML = gamesTable(r.games); bindGames(area); }
      };
      let deb = 0;
      q.oninput = () => { clearTimeout(deb); deb = window.setTimeout(fetchGames, 300); };
      sel.onchange = fetchGames;
      await fetchGames();
    } else if (current === 'reports') {
      body.innerHTML = `<div class="admin-filter"><select class="inp"><option value="open">${esc(A.open)}</option><option value="resolved">${esc(A.resolved)}</option><option value="dismissed">${esc(A.dismissed)}</option></select></div><div class="list-area"></div>`;
      const sel = body.querySelector<HTMLSelectElement>('select')!;
      const area = body.querySelector<HTMLElement>('.list-area')!;
      const fetchReports = async () => {
        const r = await call<{ reports: { id: number; game_id: string; reporter_id: string; reporter_name: string; target_id: string; target_name: string; reason: string; note: string; created: number; status: string; resolution: string | null; target_warnings: number }[] }>(`/reports?status=${sel.value}`);
        if (!r) return;
        area.innerHTML = r.reports.length ? r.reports.map(x => `<div class="card report">
          <div class="row"><b>${esc(s.reportReasons[x.reason as keyof typeof s.reportReasons] ?? x.reason)}</b><span class="muted small">${esc(fmtDate(x.created))}</span></div>
          <p>${esc(A.reportLine(x.reporter_name ?? '?', x.target_name ?? '?'))} <span class="muted small">(${x.target_warnings} ${esc(A.warnings).toLowerCase()})</span></p>
          ${x.note ? `<blockquote>${esc(x.note)}</blockquote>` : ''}
          ${x.resolution ? `<p class="muted small">→ ${esc(x.resolution)}</p>` : ''}
          <div class="admin-actions">
            <button class="btn" data-game="${esc(x.game_id)}">${esc(A.viewGame)}</button>
            <button class="btn" data-user="${esc(x.target_id)}">${esc(A.viewUser)}</button>
            ${x.status === 'open' ? `<button class="btn primary" data-r="${x.id}" data-s="resolved">${esc(A.resolve)}</button><button class="btn ghost" data-r="${x.id}" data-s="dismissed">${esc(A.dismiss)}</button>` : ''}
          </div></div>`).join('') : `<p class="muted">${esc(A.empty)}</p>`;
        bindGames(area);
        area.querySelectorAll<HTMLButtonElement>('[data-r]').forEach(b => (b.onclick = async () => {
          const card = b.closest('.card')!;
          const resolution = b.dataset.s === 'resolved' ? prompt(A.resolutionPh) ?? '' : '';
          if (await call(`/reports/${b.dataset.r}`, 'POST', { status: b.dataset.s, resolution })) { card.remove(); toast(A.done); }
        }));
      };
      sel.onchange = fetchReports;
      await fetchReports();
    } else if (current === 'users') {
      body.innerHTML = `<div class="admin-filter"><input class="inp" placeholder="${esc(A.searchUsers)}" />
        <select class="inp"><option value="">${esc(A.all)}</option><option value="banned">${esc(A.bannedUsers)}</option><option value="admins">${esc(A.admins)}</option></select></div><div class="list-area"></div>`;
      const [q, sel] = [body.querySelector<HTMLInputElement>('input')!, body.querySelector<HTMLSelectElement>('select')!];
      const area = body.querySelector<HTMLElement>('.list-area')!;
      const fetchUsers = async () => {
        const r = await call<{ users: UserRow[] }>(`/users?q=${encodeURIComponent(q.value)}&filter=${sel.value}`);
        if (!r) return;
        area.innerHTML = r.users.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>${esc(A.name)}</th><th>${esc(s.rating)}</th><th>${esc(A.gamesCount)}</th><th>${esc(A.status)}</th><th>${esc(A.lastSeen)}</th></tr></thead><tbody>
          ${r.users.map(u => `<tr class="clickable" data-user="${esc(u.id)}"><td>${u.role === 'admin' ? '🛡️ ' : ''}${esc(u.name)}<div class="muted small">${esc(u.email ?? (u.google_sub ? 'Google' : A.guest))}</div></td>
          <td class="small">${ratingCell(u)}</td><td>${u.games}</td><td>${u.banned_until && u.banned_until > Date.now() ? `<span class="tag danger">${esc(A.banned)}</span>` : u.warnings ? `⚠️ ${u.warnings}` : '✅'}</td>
          <td class="muted small">${esc(timeAgo(u.last_seen, settings.lang))}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${esc(A.empty)}</p>`;
        bindGames(area);
      };
      let deb = 0;
      q.oninput = () => { clearTimeout(deb); deb = window.setTimeout(fetchUsers, 300); };
      sel.onchange = fetchUsers;
      await fetchUsers();
    } else if (current === 'announcements') {
      body.innerHTML = `<div class="card admin-form">
          <textarea class="inp" maxlength="300" rows="2" placeholder="${esc(A.announcementPh)}"></textarea>
          <div class="admin-actions"><select class="inp" name="level"><option value="info">ℹ️ ${esc(A.info)}</option><option value="warn">⚠️ ${esc(A.warnLevel)}</option></select>
          <select class="inp" name="hours"><option value="2">2 ${esc(A.hours)}</option><option value="24">24 ${esc(A.hours)}</option><option value="168">7 ${esc(A.days)}</option><option value="0">${esc(A.noExpiry)}</option></select>
          <button class="btn primary" data-act="post">${esc(A.post)}</button></div></div><div class="list-area"></div>`;
      const area = body.querySelector<HTMLElement>('.list-area')!;
      const fetchAnn = async () => {
        const r = await call<{ announcements: { id: number; text: string; level: string; active: number; created: number; expires: number | null }[] }>('/announcements');
        if (!r) return;
        area.innerHTML = r.announcements.map(a => {
          const live = a.active && (!a.expires || a.expires > Date.now());
          return `<div class="card ann ${a.level}"><p>${a.level === 'warn' ? '⚠️' : 'ℹ️'} ${esc(a.text)}</p>
            <div class="row"><span class="muted small">${esc(fmtDate(a.created))}${a.expires ? ' → ' + esc(fmtDate(a.expires)) : ''}</span>
            ${live ? `<button class="btn ghost" data-del="${a.id}">${esc(A.takeDown)}</button>` : `<span class="tag">${esc(A.ended)}</span>`}</div></div>`;
        }).join('') || `<p class="muted">${esc(A.empty)}</p>`;
        area.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b => (b.onclick = async () => {
          if (await call(`/announcements/${b.dataset.del}`, 'DELETE')) { toast(A.done); void fetchAnn(); }
        }));
      };
      body.querySelector<HTMLButtonElement>('[data-act="post"]')!.onclick = async () => {
        const text = body.querySelector('textarea')!.value.trim();
        if (!text) return;
        const level = body.querySelector<HTMLSelectElement>('[name="level"]')!.value;
        const hours = Number(body.querySelector<HTMLSelectElement>('[name="hours"]')!.value) || null;
        if (await call('/announcements', 'POST', { text, level, hours })) { body.querySelector('textarea')!.value = ''; toast(A.done); void fetchAnn(); }
      };
      await fetchAnn();
    } else if (current === 'audit') {
      const r = await call<{ audit: { admin_name: string; action: string; target: string; detail: string | null; created: number }[] }>('/audit');
      if (!r || disposed) return;
      body.innerHTML = r.audit.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>${esc(A.time)}</th><th>${esc(A.adminRole)}</th><th>${esc(A.action)}</th><th>${esc(A.target)}</th></tr></thead><tbody>
        ${r.audit.map(x => `<tr><td class="muted small">${esc(fmtDate(x.created))}</td><td>${esc(x.admin_name)}</td><td><code>${esc(x.action)}</code></td><td class="small">${esc(x.target)}${x.detail ? `<div class="muted small">${esc(x.detail.slice(0, 120))}</div>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : `<p class="muted">${esc(A.empty)}</p>`;
    }
  }
  void load();
  return { el, dispose() { disposed = true; } };
}
