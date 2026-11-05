/**
 * Leaderboards (one per game, from rated matchmaking games) and public
 * player profiles.
 */
import type { GameKind } from '../engine/types';
import { net } from '../net';
import { LEADERBOARD_MIN_GAMES, type BoardEntry, type Leaderboard, type PlayerProfile } from '../shared/protocol';
import { KINDS, settings, t } from '../state';
import { gameThumb, type Nav, type Screen } from './home';
import { esc } from './util';

const MEDAL = ['🥇', '🥈', '🥉'];

export function trophyThumb(): string {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="var(--accent-soft)"/>
    <path d="M22 14h20v10a10 10 0 0 1-20 0z" fill="var(--accent)"/>
    <path d="M22 17h-6a6 6 0 0 0 6 8M42 17h6a6 6 0 0 1-6 8" fill="none" stroke="var(--accent)" stroke-width="3"/>
    <path d="M29 33h6v8h-6z" fill="var(--accent)"/><rect x="22" y="41" width="20" height="6" rx="2" fill="var(--accent)"/></svg>`;
}

const fmtDate = (ts: number | null) => (ts ? new Date(ts).toLocaleDateString(settings.lang === 'vi' ? 'vi-VN' : 'en-GB') : '—');
const winRate = (e: { games: number; wins: number; draws: number }) => (e.games ? Math.round(((e.wins + e.draws / 2) / e.games) * 100) : 0);

function offlineCard(el: HTMLElement, nav: Nav) {
  const s = t();
  el.innerHTML = `<div class="mm-card"><div class="ov-icon">📡</div>
    <h1>${esc(s.serverOffline)}</h1><p>${esc(s.serverOfflineHint)}</p>
    <button class="btn primary" data-act="back">${esc(s.back)}</button></div>`;
  el.querySelector<HTMLButtonElement>('[data-act="back"]')!.onclick = () => nav.go('#/', 'back');
}

// ---------- Leaderboard ----------

export function leaderboardScreen(kindArg: string | undefined, nav: Nav): Screen {
  const s = t();
  const L = s.board;
  const kind: GameKind = KINDS.includes(kindArg as GameKind) ? (kindArg as GameKind) : 'chess';
  const el = document.createElement('section');
  el.className = 'screen board-screen';
  let disposed = false;

  const row = (e: BoardEntry, me: boolean) => `<tr class="clickable${me ? ' me' : ''}${e.rank <= 3 ? ' podium' : ''}" data-id="${esc(e.id)}">
      <td class="rk">${e.rank <= 3 ? `<span class="medal">${MEDAL[e.rank - 1]}</span>` : e.rank}</td>
      <td class="nm"><a href="#/player/${esc(e.id)}">${esc(e.name)}</a>${me ? ` <span class="tag">${esc(L.you)}</span>` : ''}</td>
      <td class="el">${e.rating}</td>
      <td class="gm">${e.games}</td>
      <td class="wr">${winRate(e)}%</td></tr>`;

  const draw = (b: Leaderboard) => {
    const myId = net.me?.id;
    const meListed = !!b.me && b.entries.some(e => e.id === b.me!.id);
    let mine = '';
    if (b.me && !meListed) mine = `<tbody class="me-sep"><tr><td colspan="5">⋯</td></tr></tbody><tbody>${row(b.me, true)}</tbody>`;
    let note: string;
    if (b.me) note = L.yourRank(b.me.rank, b.total);
    else if (net.me) note = L.progress(b.myGames, b.minGames, s[kind]);
    else note = L.rule(b.minGames);
    el.querySelector('.lb-body')!.innerHTML = `
      <p class="lb-note">${esc(note)}${b.me ? '' : ` <a class="btn primary small-btn" href="#/match/${kind}">${esc(L.findMatch)}</a>`}</p>
      ${b.entries.length ? `<div class="table-wrap"><table class="tbl lb">
        <thead><tr><th>${esc(L.rank)}</th><th>${esc(L.player)}</th><th>Elo</th><th>${esc(L.games)}</th><th>${esc(L.winRate)}</th></tr></thead>
        <tbody>${b.entries.map(e => row(e, e.id === myId)).join('')}</tbody>${mine}
      </table></div>
      <p class="muted small">${esc(L.total(b.total))} · ${esc(L.rule(b.minGames))}</p>`
      : `<div class="card lb-empty"><p>🏁 ${esc(L.empty(b.minGames))}</p></div>`}`;
    el.querySelectorAll<HTMLTableRowElement>('tr.clickable').forEach(tr => (tr.onclick = e => {
      if ((e.target as HTMLElement).closest('a')) return;
      nav.go('#/player/' + tr.dataset.id);
    }));
  };

  el.innerHTML = `
    <div class="screen-head">
      <span class="thumb big">${trophyThumb()}</span>
      <div><h1>${esc(L.title)}</h1><p>${esc(L.subtitle)}</p></div>
    </div>
    <nav class="pz-tabs lb-tabs">${KINDS.map(k => `<a href="#/leaderboard/${k}" class="${k === kind ? 'on' : ''}"><span class="thumb">${gameThumb(k)}</span><span>${esc(s[k])}</span></a>`).join('')}</nav>
    <div class="lb-body"><p class="muted">${esc(L.loading)}</p></div>`;

  void (async () => {
    if (!(await net.init())) { if (!disposed) offlineCard(el, nav); return; }
    try {
      const b = await net.api<Leaderboard>(`/leaderboard?kind=${kind}`);
      if (!disposed) draw(b);
    } catch {
      if (!disposed) el.querySelector('.lb-body')!.innerHTML = `<div class="card"><p>${esc(L.loadError)}</p></div>`;
    }
  })();
  return { el, dispose() { disposed = true; } };
}

// ---------- Player profile ----------

export function profileScreen(id: string, nav: Nav): Screen {
  const s = t();
  const L = s.board;
  const el = document.createElement('section');
  el.className = 'screen board-screen profile';
  let disposed = false;
  el.innerHTML = `<p class="muted">${esc(L.loading)}</p>`;

  const draw = (p: PlayerProfile) => {
    const own = net.me?.id === p.id;
    const cards = KINDS.map(k => {
      const st = p.stats[k];
      const losses = st.games - st.wins - st.draws;
      const rank = st.rank !== null
        ? `<span class="pf-rank">${st.rank <= 3 ? MEDAL[st.rank - 1] + ' ' : ''}${esc(L.rankN(st.rank))}</span>`
        : `<span class="pf-rank muted">${esc(L.unranked(st.games, LEADERBOARD_MIN_GAMES))}</span>`;
      return `<a class="card pf-card" href="#/leaderboard/${k}">
        <div class="pf-kind"><span class="thumb">${gameThumb(k)}</span><b>${esc(s[k])}</b></div>
        <div class="pf-elo">${st.rating}</div>
        ${rank}
        <div class="pf-rec small muted">${esc(L.record)}: <b>${st.wins}</b> / <b>${st.draws}</b> / <b>${losses}</b> · ${esc(L.peak)} ${st.peak}</div>
      </a>`;
    }).join('');
    const games = p.recent.map(g => {
      const res = g.winner === null ? 'draw' : g.winner === g.side ? 'win' : 'loss';
      const label = res === 'win' ? L.win : res === 'loss' ? L.loss : L.drawShort;
      const reason = g.reason && g.reason in s.reasons ? s.reasons[g.reason as keyof typeof s.reasons] : '';
      const opp = g.opponent.id
        ? `<a href="#/player/${esc(g.opponent.id)}">${esc(g.opponent.name ?? '?')}</a>`
        : esc(g.opponent.name ?? '?');
      return `<tr><td><span class="thumb tiny">${gameThumb(g.kind)}</span></td>
        <td>${esc(L.vs)} ${opp}</td>
        <td><span class="res ${res}">${esc(label)}</span> <span class="muted small">${esc(reason)}</span></td>
        <td>${g.rated ? `<span class="tag">${esc(L.rated)}</span>` : `<span class="muted small">${esc(L.casual)}</span>`}</td>
        <td class="muted small">${esc(fmtDate(g.ended))}</td></tr>`;
    }).join('');
    el.innerHTML = `
      <div class="screen-head">
        <span class="avatar big">${esc([...p.name][0]?.toUpperCase() ?? '?')}</span>
        <div><h1>${esc(p.name)}${own ? ` <span class="tag">${esc(L.you)}</span>` : ''}${p.banned ? ` <span class="tag danger">${esc(L.banned)}</span>` : ''}</h1>
          <p>${esc(L.joined(fmtDate(p.created)))}</p></div>
      </div>
      <div class="pf-grid">${cards}</div>
      <h2 class="list-title">${esc(L.recent)}</h2>
      ${games ? `<div class="table-wrap"><table class="tbl pf-games"><tbody>${games}</tbody></table></div>` : `<div class="card"><p class="muted">${esc(L.noGames)}</p></div>`}
      <p><a class="btn ghost" href="#/leaderboard">← ${esc(L.title)}</a></p>`;
  };

  void (async () => {
    if (!(await net.init())) { if (!disposed) offlineCard(el, nav); return; }
    try {
      const r = await net.api<{ profile: PlayerProfile }>(`/players/${encodeURIComponent(id)}`, { auth: false });
      if (!disposed) draw(r.profile);
    } catch {
      if (!disposed) el.innerHTML = `<div class="mm-card"><div class="ov-icon">🔍</div><h1>${esc(L.notFound)}</h1>
        <a class="btn primary" href="#/leaderboard">${esc(L.title)}</a></div>`;
    }
  })();
  return { el, dispose() { disposed = true; } };
}
