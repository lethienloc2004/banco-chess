// Integration test for the game server. Start it first: npm run dev:server
const B = process.env.SERVER_URL ?? 'http://127.0.0.1:8787';
const api = async (path, { token, method = 'GET', body } = {}) => {
  const r = await fetch(B + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const sock = (path, token) => new Promise((resolve, reject) => {
  const ws = new WebSocket(B.replace('http', 'ws') + '/api' + path + '?token=' + token);
  const inbox = [];
  const waiters = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); inbox.push(m); waiters.forEach(w => w()); };
  ws.onopen = () => resolve({
    ws, inbox,
    send: m => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 5000) => new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout waiting')), ms);
      let done = false;
      const check = () => { if (done) return; const i = inbox.findIndex(pred); if (i >= 0) { done = true; clearTimeout(t); waiters.splice(waiters.indexOf(check), 1); res(inbox.splice(0, i + 1).pop()); } };
      waiters.push(check); check();
    }),
  });
  ws.onerror = reject;
});
const ok = (c, msg) => { if (!c) { console.log('FAIL:', msg); process.exitCode = 1; } else console.log('ok  -', msg); };

const g1 = (await api('/auth/guest', { method: 'POST' })).data;
const g2 = (await api('/auth/guest', { method: 'POST' })).data;
ok(g1.token && g1.user.name.startsWith('Khách'), 'guest accounts created: ' + g1.user.name + ', ' + g2.user.name);
ok((await api('/me', { token: 'bad' })).status === 401, 'bad token rejected');
ok((await api('/me', { token: g1.token, method: 'PATCH', body: { name: '<b>Hùng</b>  Cờ' } })).data.user.name === 'bHùng/b Cờ', 'name sanitized');

// --- Members only: guests watch, signed-in players play
ok((await api('/config')).data.emailLogin === true, 'email sign-in available');
ok(!g1.user.member && (await api('/rooms', { token: g1.token, method: 'POST', body: { kind: 'chess', side: 0, clock: 'none' } })).data.error === 'login-required', 'guest cannot create a room');
{
  const lg = await sock('/lobby/ws', g1.token);
  await lg.wait(m => m.t === 'hello');
  lg.send({ t: 'queue', kind: 'chess' });
  ok((await lg.wait(m => m.t === 'error')).code === 'login-required', 'guest cannot join matchmaking');
  lg.ws.close();
}
const tag = Date.now().toString(36);
const mail1 = `p1-${tag}@example.com`, mail2 = `p2-${tag}@example.com`;
ok((await api('/auth/email/start', { method: 'POST', body: { email: 'not-an-email' } })).data.error === 'bad-email', 'invalid email rejected');
let st1 = (await api('/auth/email/start', { method: 'POST', body: { email: mail1.toUpperCase() } })).data;
ok(st1.ok && /^\d{6}$/.test(st1.devCode), 'code sent (dev: returned instead of mailed)');
ok((await api('/auth/email/start', { method: 'POST', body: { email: mail1 } })).data.error === 'wait', 'no new code within a minute');
const wrong = String((Number(st1.devCode) + 1) % 1000000).padStart(6, '0');
const bad = await api('/auth/email/verify', { token: g1.token, method: 'POST', body: { email: mail1, code: wrong } });
ok(bad.status === 400 && bad.data.left === 4, 'wrong code counted, 4 tries left');
const v1 = (await api('/auth/email/verify', { token: g1.token, method: 'POST', body: { email: mail1, code: st1.devCode } })).data;
ok(v1.user.id === g1.user.id && v1.user.member && v1.user.name === 'bHùng/b Cờ', 'guest upgraded to a member, same account kept');
ok((await api('/auth/email/verify', { method: 'POST', body: { email: mail1, code: st1.devCode } })).data.error === 'code-expired', 'a code works only once');
Object.assign(g1, v1);
const st2 = (await api('/auth/email/start', { method: 'POST', body: { email: mail2 } })).data;
Object.assign(g2, (await api('/auth/email/verify', { token: g2.token, method: 'POST', body: { email: mail2, code: st2.devCode } })).data);
// Signing in again with the same email from another browser reaches the same account
const fresh = (await api('/auth/guest', { method: 'POST' })).data;
const mail3 = `p3-${tag}@example.com`;
const st3 = (await api('/auth/email/start', { method: 'POST', body: { email: mail3 } })).data;
const v3 = (await api('/auth/email/verify', { method: 'POST', body: { email: mail3, code: st3.devCode } })).data;
ok(v3.user.member && v3.user.id !== fresh.user.id && v3.user.name.startsWith('Kỳ thủ'), 'new email without a guest session: new member account');

// --- Friend room (jieqi): hidden identities must not leak
const room = (await api('/rooms', { token: g1.token, method: 'POST', body: { kind: 'jieqi', side: 0, clock: '5+3' } })).data;
ok(/^[a-z2-9]{7}$/.test(room.id), 'room created ' + room.id);
const a = await sock(`/rooms/${room.id}/ws`, g1.token);
let st = (await a.wait(m => m.t === 'state')).state;
ok(st.status === 'waiting' && st.you === 0, 'host waiting as red');
const watcher = await sock(`/rooms/${room.id}/ws`, fresh.token);
const ws0 = (await watcher.wait(m => m.t === 'state')).state;
ok(ws0.you === null && ws0.status === 'waiting', 'guest who opens the link only watches (seat stays free)');
watcher.ws.close();
const b = await sock(`/rooms/${room.id}/ws`, g2.token);
st = (await b.wait(m => m.t === 'state')).state;
ok(st.status === 'playing' && st.you === 1, 'guest joined as black, game playing');
const hostState = (await a.wait(m => m.t === 'state' && m.state.status === 'playing')).state;
ok(hostState.status === 'playing', 'host notified game started');
// masked: every hidden piece type equals its start-square type
const START = [5,4,3,2,1,2,3,4,5, 0,0,0,0,0,0,0,0,0, 0,6,0,0,0,0,0,6,0, 7,0,7,0,7,0,7,0,7];
const startType = sq => { const r = Math.floor(sq / 9), f = sq % 9; const rr = r <= 4 ? r : 9 - r; return START[rr * 9 + f] ?? 0; };
ok(st.initial.board.every((p, sq) => !(p & 16) || (p & 7) === startType(sq)), 'jieqi start position is masked for clients');
// Red moves b2 (cannon square, sq 19) to e2 (sq 22): move = from | to << 7
const mv = 19 | (22 << 7);
b.send({ t: 'move', ply: 0, m: mv });
ok((await b.wait(m => m.t === 'error')).code === 'not-your-turn', 'black cannot move on red turn');
a.send({ t: 'move', ply: 0, m: 19 | (19 << 7) });
ok((await a.wait(m => m.t === 'error')).code === 'illegal', 'illegal move rejected');
a.send({ t: 'move', ply: 0, m: mv });
const moved = await b.wait(m => m.t === 'move');
ok(moved.mv.m === mv && moved.mv.r >= 2 && moved.mv.r <= 7, 'move relayed with revealed identity r=' + moved.mv.r);
// draw offer + decline, emote
b.send({ t: 'draw' });
ok((await a.wait(m => m.t === 'offer')).side === 1, 'draw offer relayed');
a.send({ t: 'decline' });
ok((await b.wait(m => m.t === 'offer' && m.side === null)).side === null, 'draw declined');
a.send({ t: 'emote', e: '👍' });
ok((await b.wait(m => m.t === 'emote')).e === '👍', 'emote relayed');
// reconnect: guest reconnects and gets the moves back
b.ws.close();
await a.wait(m => m.t === 'presence' && m.seats[1] && !m.seats[1].online);
ok(true, 'host sees guest offline');
const b2 = await sock(`/rooms/${room.id}/ws`, g2.token);
st = (await b2.wait(m => m.t === 'state')).state;
ok(st.you === 1 && st.moves.length === 1, 'guest reconnected with game state');
a.send({ t: 'claim' });
ok((await a.wait(m => m.t === 'error')).code === 'too-early', 'cannot claim win while opponent online');
b2.send({ t: 'resign' });
st = (await a.wait(m => m.t === 'state' && m.state.status === 'over')).state;
ok(st.result.winner === 0 && st.result.reason === 'resign' && st.ratingChange === null, 'resign -> red wins, unrated');
a.send({ t: 'rematch' }); b2.send({ t: 'rematch' });
st = (await a.wait(m => m.t === 'state' && m.state.gameNo === 2)).state;
ok(st.you === 1 && st.moves.length === 0 && st.status === 'playing', 'rematch: colours swapped');
a.ws.close(); b2.ws.close();

// --- Hidden chess room: identities are masked for players
const hroom = (await api('/rooms', { token: g1.token, method: 'POST', body: { kind: 'hiddenchess', side: 0, clock: 'none' } })).data;
const ha = await sock(`/rooms/${hroom.id}/ws`, g1.token);
const hs = (await ha.wait(m => m.t === 'state')).state;
const CHESS_START = { 0: 'R', 1: 'N', 2: 'B', 3: 'Q', 5: 'B', 6: 'N', 7: 'R' };
const rows = hs.initial.split(' ')[0].split('/');
const back = rows[7].match(/~?[A-Za-z]|\d/g); // rank 1
ok(hs.kind === 'hiddenchess' && back.filter(x => x.startsWith('~')).every((x, i) => true), 'hidden chess room created');
let file = 0, maskedOk = true;
for (const tok of back) { if (/\d/.test(tok)) { file += Number(tok); continue; } if (tok.startsWith('~') && CHESS_START[file] && tok[1] !== CHESS_START[file]) maskedOk = false; file++; }
ok(maskedOk && rows[6].replace(/~/g, '') === 'PPPPPPPP', 'hidden chess start is masked for clients');
ha.ws.close();

// --- Matchmaking (chess, rated)
const l1 = await sock('/lobby/ws', g1.token);
const l2 = await sock('/lobby/ws', g2.token);
await l1.wait(m => m.t === 'hello');
l1.send({ t: 'queue', kind: 'chess' });
await l1.wait(m => m.t === 'queued');
l2.send({ t: 'queue', kind: 'chess' });
const m1 = await l1.wait(m => m.t === 'matched'), m2 = await l2.wait(m => m.t === 'matched');
ok(m1.room === m2.room, 'matched into the same room ' + m1.room);
const r1 = await sock(`/rooms/${m1.room}/ws`, g1.token), r2 = await sock(`/rooms/${m2.room}/ws`, g2.token);
const s1 = (await r1.wait(m => m.t === 'state')).state, s2 = (await r2.wait(m => m.t === 'state')).state;
ok(s1.rated && s1.clock && s1.you !== s2.you, 'rated game with clock, opposite sides');
const [white, black] = s1.you === 0 ? [r1, r2] : [r2, r1];
// Fool's mate: f3 e5 g4 Qh4#. 0x88 squares; encode from | to<<7 | flags<<17 (double push flag 8)
const sq = s => (Number(s[1]) - 1) * 16 + 'abcdefgh'.indexOf(s[0]);
const enc = (f, t, flags = 0) => sq(f) | (sq(t) << 7) | (flags << 17);
const seq = [[white, enc('f2', 'f3')], [black, enc('e7', 'e5', 8)], [white, enc('g2', 'g4', 8)], [black, enc('d8', 'h4')]];
for (let i = 0; i < seq.length; i++) {
  seq[i][0].send({ t: 'move', ply: i, m: seq[i][1] });
  await r1.wait(m => m.t === 'move' && m.ply === i);
}
const end = (await r1.wait(m => m.t === 'state' && m.state.status === 'over')).state;
ok(end.result.reason === 'checkmate' && end.result.winner === 1, 'checkmate detected by server');
ok(end.ratingChange && end.ratingChange[1] > 0 && end.ratingChange[0] < 0, 'ratings updated ' + JSON.stringify(end.ratingChange));

// --- Per-game ratings and leaderboard
const blackTok = s1.you === 1 ? g1.token : g2.token, whiteTok = s1.you === 0 ? g1.token : g2.token;
const blackId = s1.you === 1 ? g1.user.id : g2.user.id, whiteId = s1.you === 0 ? g1.user.id : g2.user.id;
let meB = (await api('/me', { token: blackTok })).data.user;
ok(meB.ratings.chess > 1200 && meB.ratings.xiangqi === 1200 && meB.ratings.jieqi === 1200, 'only the chess rating moved ' + JSON.stringify(meB.ratings));
let lb = (await api('/leaderboard?kind=chess', { token: blackTok })).data;
ok(lb.me === null && lb.myGames === 1 && !lb.entries.some(e => e.id === blackId), 'not on the board before 5 rated games');
ok((await api('/leaderboard?kind=go')).status === 400, 'unknown game rejected');
// Four more rated chess games: White resigns each time.
for (let i = 0; i < 4; i++) {
  l1.send({ t: 'queue', kind: 'chess' }); await l1.wait(m => m.t === 'queued');
  l2.send({ t: 'queue', kind: 'chess' });
  const mm = await l1.wait(m => m.t === 'matched'); await l2.wait(m => m.t === 'matched');
  const wsW = await sock(`/rooms/${mm.room}/ws`, whiteTok), wsB = await sock(`/rooms/${mm.room}/ws`, blackTok);
  await wsW.wait(m => m.t === 'state'); await wsB.wait(m => m.t === 'state');
  wsW.send({ t: 'resign' });
  await wsB.wait(m => m.t === 'state' && m.state.status === 'over');
  wsW.ws.close(); wsB.ws.close();
}
lb = (await api('/leaderboard?kind=chess', { token: blackTok })).data;
const rb = lb.entries.find(e => e.id === blackId), rw = lb.entries.find(e => e.id === whiteId);
ok(rb && rw && rb.rank < rw.rank && rb.games === 5 && rb.wins === 5 && rw.wins === 0, `both ranked after 5 games: #${rb?.rank} ${rb?.rating}, #${rw?.rank} ${rw?.rating}`);
ok(lb.me && lb.me.id === blackId && lb.me.rank === rb.rank && lb.total >= 2, 'caller row and total returned');
ok((await api('/leaderboard?kind=xiangqi')).data.entries.every(e => e.id !== blackId), 'xiangqi board unaffected');
const anon = (await api('/leaderboard?kind=chess')).data;
ok(anon.me === null && anon.entries.length >= 2, 'leaderboard readable without signing in');
const prof = (await api('/players/' + blackId)).data.profile;
ok(prof.stats.chess.games === 5 && prof.stats.chess.rank === rb.rank && prof.stats.xiangqi.rank === null && prof.recent.length >= 5, 'profile: stats, rank and recent games');
ok(prof.recent[0].opponent.id === whiteId && prof.recent[0].winner === prof.recent[0].side && !('email' in prof), 'profile: results from the player\'s side, no email');
ok((await api('/players/u_nobody')).status === 404, 'unknown profile is 404');

// --- Reports & admin
const loserId = s1.you === 0 ? g1.user.id : g2.user.id;
const winnerTok = s1.you === 0 ? g2.token : g1.token;
ok((await api('/reports', { token: winnerTok, method: 'POST', body: { room: m1.room, gameNo: 1, target: loserId, reason: 'abuse', note: 'test' } })).status === 200, 'report filed');
ok((await api('/admin/stats', { token: g1.token })).status === 403, 'non-admin blocked from admin API');
const adm = (await api('/auth/dev-admin', { method: 'POST' })).data;
const stats = (await api('/admin/stats', { token: adm.token })).data;
ok(stats.users >= 2 && stats.openReports >= 1 && stats.online >= 2, 'admin stats ' + JSON.stringify({ users: stats.users, online: stats.online, reports: stats.openReports, today: stats.gamesToday }));
// Admin sets one game's rating only
await api(`/admin/users/${whiteId}/action`, { token: adm.token, method: 'POST', body: { action: 'rating', kind: 'xiangqi', rating: 1555 } });
const meW = (await api('/me', { token: whiteTok })).data.user;
ok(meW.ratings.xiangqi === 1555 && meW.ratings.chess < 1200, 'admin set the xiangqi rating only ' + JSON.stringify(meW.ratings));
const adminList = (await api('/admin/users?q=' + whiteId, { token: adm.token })).data.users;
ok(adminList[0]?.ratings?.xiangqi === 1555, 'admin user list shows ratings per game');

// --- Admin leaderboard tools
const A = (path, body) => api(path, { token: adm.token, method: 'POST', body });
const onBoard = async id => (await api('/leaderboard?kind=chess')).data.entries.some(e => e.id === id);
await A(`/admin/users/${blackId}/action`, { action: 'board', hidden: true });
let pb = (await api('/players/' + blackId)).data.profile;
ok(!(await onBoard(blackId)) && pb.hidden && pb.stats.chess.rank === null, 'admin hid a player from the leaderboard');
ok((await api('/admin/users?filter=hidden', { token: adm.token })).data.users.some(u => u.id === blackId), 'hidden players filter');
await A(`/admin/users/${blackId}/action`, { action: 'board', hidden: false });
ok(await onBoard(blackId), 'shown on the leaderboard again');
const ratedGames = (await api('/admin/games?q=' + blackId, { token: adm.token })).data.games.filter(g => g.rated && g.status === 'over' && g.kind === 'chess');
const elo = async tok => (await api('/me', { token: tok })).data.user.ratings.chess;
// Change the latest result (Black won by resignation) to a White win: Elo recomputed from before the game
const g5 = ratedGames[0], whiteSide = g5.p0_id === whiteId ? 0 : 1;
const [b0, w0] = [await elo(blackTok), await elo(whiteTok)];
const fix = (await A(`/admin/games/${g5.id}/action`, { action: 'result', winner: whiteSide })).data;
const dB = whiteSide === 0 ? fix.refund.d1 : fix.refund.d0, dW = whiteSide === 0 ? fix.refund.d0 : fix.refund.d1;
ok(fix.refund && !fix.refund.estimated && dB < -20 && dW > 20 && dB === -dW, 'result corrected, Elo recomputed exactly ' + JSON.stringify(fix.refund));
ok(await elo(blackTok) === b0 + dB && await elo(whiteTok) === w0 + dW, 'ratings moved by the correction');
pb = (await api('/players/' + blackId)).data.profile;
ok(pb.stats.chess.games === 5 && pb.stats.chess.wins === 4, 'win counts follow the new result');
// Void another rated game: the points go back and it no longer counts
const g4 = ratedGames[1];
const b1 = await elo(blackTok);
const voided = (await A(`/admin/games/${g4.id}/action`, { action: 'cancel' })).data;
const dB2 = g4.p0_id === blackId ? voided.refund.d0 : voided.refund.d1;
pb = (await api('/players/' + blackId)).data.profile;
ok(dB2 < 0 && await elo(blackTok) === b1 + dB2 && pb.stats.chess.games === 4 && pb.stats.chess.wins === 3, 'voided game: Elo given back, 4 games left ' + JSON.stringify(voided.refund));
ok(!(await onBoard(blackId)), 'below 5 games again: off the board');
ok((await A(`/admin/games/${g4.id}/action`, { action: 'cancel' })).data.refund === null, 'voiding twice changes nothing');
// Reset one game's record
await A(`/admin/users/${whiteId}/action`, { action: 'reset', kind: 'chess' });
const wr = (await api('/me', { token: whiteTok })).data.user.ratings;
ok(wr.chess === 1200 && wr.xiangqi === 1555 && (await api('/players/' + whiteId)).data.profile.stats.chess.games === 0, 'reset the chess record only');
const games = (await api('/admin/games', { token: adm.token })).data.games;
ok(games.length >= 3, 'admin sees games: ' + games.map(g => `${g.kind}:${g.status}:${g.reason ?? '-'}`).join(', '));
const detail = (await api('/admin/games/' + games.find(g => g.kind === 'jieqi').id, { token: adm.token })).data.game;
ok(detail.initial.board.some((p, sq) => (p & 16) && (p & 7) !== startType(sq)), 'admin sees real jieqi identities');
// live jieqi game 2 is playing -> cancel it
const live = games.find(g => g.status === 'playing');
ok((await api(`/admin/games/${live.id}/action`, { token: adm.token, method: 'POST', body: { action: 'cancel' } })).status === 200, 'admin cancelled live game ' + live.id);
const reports = (await api('/admin/reports', { token: adm.token })).data.reports;
ok(reports[0].target_name, 'report lists names');
await api(`/admin/reports/${reports[0].id}`, { token: adm.token, method: 'POST', body: { status: 'resolved', resolution: 'warned' } });
await api(`/admin/users/${loserId}/action`, { token: adm.token, method: 'POST', body: { action: 'warn', reason: 'Lời lẽ không phù hợp' } });
const loserTok = s1.you === 0 ? g1.token : g2.token;
ok((await api('/me', { token: loserTok })).data.user.notice === 'Lời lẽ không phù hợp', 'warning notice delivered');
// announcement reaches the lobby live
await api('/admin/announcements', { token: adm.token, method: 'POST', body: { text: 'Bảo trì lúc 22h', level: 'warn', hours: 2 } });
ok((await l2.wait(m => m.t === 'announcement')).announcement.text === 'Bảo trì lúc 22h', 'announcement broadcast live');
// ban kicks from lobby and blocks rooms
await api(`/admin/users/${loserId}/action`, { token: adm.token, method: 'POST', body: { action: 'ban', days: 1, reason: 'test' } });
const kickedSock = s1.you === 0 ? l1 : l2;
ok((await kickedSock.wait(m => m.t === 'kicked')).t === 'kicked', 'banned user kicked from lobby');
ok((await api('/rooms', { token: loserTok, method: 'POST', body: { kind: 'chess', side: 0, clock: 'none' } })).status === 403, 'banned user cannot create rooms');
ok((await api('/me', { token: loserTok })).data.banned?.reason === 'test', '/me reports ban');
ok(!(await api('/leaderboard?kind=chess')).data.entries.some(e => e.id === loserId), 'banned player hidden from the leaderboard');
await api(`/admin/users/${loserId}/action`, { token: adm.token, method: 'POST', body: { action: 'unban' } });
ok((await api('/admin/audit', { token: adm.token })).data.audit.length >= 5, 'audit log recorded');
process.exit();
