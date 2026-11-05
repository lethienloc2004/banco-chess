/** Quest progress, rewards, coins and skins (scoring rules live in src/shared/quests.ts). */
import type { GameKind } from '../src/engine/types';
import puzzleData from '../src/puzzles/puzzles.json';
import {
  activeSeason, addDays, currentQuests, dayKey, questById, questValue, resetsIn, shopSkins, skinById, weekKey,
  type BotLevel, type QuestEvent,
} from '../src/shared/quests';
import { KINDS, seasonConfig } from './db';
import { rateHit } from './otp';

const PUZZLE_IDS = new Set<string>([...puzzleData.chess, ...puzzleData.xiangqi].map(p => p.id));
const LEVELS: BotLevel[] = ['easy', 'medium', 'hard', 'expert'];

interface Row { quest_id: string; period: string; progress: number; done: number; claimed: number }

/** Count an event towards every running quest; returns the quests it just completed. */
export async function applyEvent(db: D1Database, uid: string, ev: QuestEvent, now = Date.now()): Promise<string[]> {
  const running = currentQuests(now, await seasonConfig(db));
  const periods = [...new Set(running.map(r => r.period))];
  const rows = await db.prepare(`SELECT quest_id, period, progress, done, claimed FROM quest_progress WHERE user_id = ? AND period IN (${periods.map(() => '?').join(', ')})`)
    .bind(uid, ...periods).all<Row>();
  const byKey = new Map(rows.results.map(r => [`${r.quest_id}|${r.period}`, r]));
  const writes: D1PreparedStatement[] = [];
  const completed: string[] = [];
  for (const { quest, period } of running) {
    const row = byKey.get(`${quest.id}|${period}`);
    if (row?.done) continue;
    const prev = row?.progress ?? 0;
    const next = quest.step(ev, prev);
    if (next === prev) continue;
    const done = questValue(quest, next) >= quest.target ? 1 : 0;
    if (done) completed.push(quest.id);
    writes.push(db.prepare(
      `INSERT INTO quest_progress (user_id, quest_id, period, progress, done, updated) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, quest_id, period) DO UPDATE SET progress = excluded.progress, done = excluded.done, updated = excluded.updated`,
    ).bind(uid, quest.id, period, next, done, now));
  }
  if (writes.length) await db.batch(writes);
  return completed;
}

/** Remember an event key; false when it was already counted. */
async function firstTime(db: D1Database, uid: string, key: string, now: number): Promise<boolean> {
  const r = await db.prepare('INSERT OR IGNORE INTO quest_events (user_id, key, created) VALUES (?, ?, ?)').bind(uid, key, now).run();
  return (r.meta.changes ?? 0) > 0;
}

/** Online results, reported by the game room (never by the client). */
export async function recordOnline(db: D1Database, uid: string, kind: GameKind, result: 'win' | 'loss' | 'draw', rated: boolean, rating: number | null) {
  const done = await applyEvent(db, uid, { t: 'game', mode: 'online', kind, result, rated });
  if (rated && rating !== null) done.push(...await applyEvent(db, uid, { t: 'rating', kind, rating }));
  return done;
}

export interface ClientEvent {
  type: 'bot-game' | 'puzzle' | 'analysis' | 'watch';
  key?: string;
  kind?: GameKind;
  level?: BotLevel;
  result?: 'win' | 'loss' | 'draw';
  id?: string;
}

/**
 * Events the app reports (bot games, puzzles, analysis, watching). Rewards are
 * cosmetic, so this trusts the client, but every game/puzzle counts once and
 * reports are rate-limited.
 */
export async function clientEvent(db: D1Database, uid: string, e: ClientEvent | null, now = Date.now()): Promise<{ completed: string[] } | { error: string }> {
  if (!e || typeof e !== 'object') return { error: 'bad-request' };
  if (!(await rateHit(db, 'qe:' + uid, 120, now))) return { error: 'too-many' };
  const key = String(e.key ?? '').slice(0, 120);
  const day = dayKey(now);
  switch (e.type) {
    case 'bot-game': {
      if (!e.kind || !KINDS.includes(e.kind) || !e.level || !LEVELS.includes(e.level) || !['win', 'loss', 'draw'].includes(e.result ?? '') || !key) return { error: 'bad-request' };
      if (!(await firstTime(db, uid, 'g:' + key, now))) return { completed: [] };
      return { completed: await applyEvent(db, uid, { t: 'game', mode: 'bot', kind: e.kind, level: e.level, result: e.result! }, now) };
    }
    case 'puzzle': {
      const id = String(e.id ?? '');
      if (!PUZZLE_IDS.has(id)) return { error: 'bad-request' };
      await firstTime(db, uid, 'pz:' + id, now); // ever: for "solve N different puzzles"
      if (!(await firstTime(db, uid, `pd:${id}:${day}`, now))) return { completed: [] }; // once a day per puzzle
      const n = await db.prepare("SELECT COUNT(*) AS n FROM quest_events WHERE user_id = ? AND key LIKE 'pz:%'").bind(uid).first<{ n: number }>();
      return { completed: await applyEvent(db, uid, { t: 'puzzle', id, distinct: n?.n ?? 0 }, now) };
    }
    case 'analysis':
    case 'watch': {
      if (!key) return { error: 'bad-request' };
      if (!(await firstTime(db, uid, `${e.type === 'analysis' ? 'an' : 'wa'}:${key}`, now))) return { completed: [] };
      return { completed: await applyEvent(db, uid, { t: e.type }, now) };
    }
    default:
      return { error: 'bad-request' };
  }
}

/** Everything the quests screen needs. */
export async function questState(db: D1Database, uid: string, now = Date.now()) {
  const cfg = await seasonConfig(db);
  const running = currentQuests(now, cfg);
  const periods = [...new Set(running.map(r => r.period))];
  const [rows, user, skins] = await Promise.all([
    db.prepare(`SELECT quest_id, period, progress, done, claimed FROM quest_progress WHERE user_id = ? AND period IN (${periods.map(() => '?').join(', ')})`).bind(uid, ...periods).all<Row>(),
    db.prepare('SELECT coins, skin, streak, streak_day FROM users WHERE id = ?').bind(uid).first<{ coins: number; skin: string | null; streak: number; streak_day: string | null }>(),
    db.prepare('SELECT skin_id FROM user_skins WHERE user_id = ?').bind(uid).all<{ skin_id: string }>(),
  ]);
  const byKey = new Map(rows.results.map(r => [`${r.quest_id}|${r.period}`, r]));
  const day = dayKey(now);
  // A streak that skipped yesterday is over.
  const streakAlive = user?.streak_day === day || user?.streak_day === addDays(day, -1);
  const season = activeSeason(day, cfg);
  return {
    day, week: weekKey(now), resetsIn: resetsIn(now),
    season: season ? { id: season.id, end: season.end } : null,
    coins: user?.coins ?? 0, streak: streakAlive ? user?.streak ?? 0 : 0, equipped: user?.skin ?? null,
    owned: skins.results.map(s => s.skin_id),
    quests: running.map(({ quest, period }) => {
      const r = byKey.get(`${quest.id}|${period}`);
      return { id: quest.id, scope: quest.scope, period, progress: questValue(quest, r?.progress ?? 0), target: quest.target, done: !!r?.done, claimed: !!r?.claimed, reward: quest.reward };
    }),
    shop: shopSkins(now, cfg).map(s => ({ id: s.id, price: s.price! })),
  };
}

/** Take the reward of a finished quest. */
export async function claim(db: D1Database, uid: string, questId: string, period: string, now = Date.now()): Promise<{ ok: true; completed: string[] } | { error: string }> {
  const quest = questById(questId);
  if (!quest || !currentQuests(now, await seasonConfig(db)).some(r => r.quest.id === questId && r.period === period)) return { error: 'not-found' };
  const r = await db.prepare('UPDATE quest_progress SET claimed = 1 WHERE user_id = ? AND quest_id = ? AND period = ? AND done = 1 AND claimed = 0')
    .bind(uid, questId, period).run();
  if (!r.meta.changes) return { error: 'not-claimable' };
  const writes: D1PreparedStatement[] = [];
  if (quest.reward.coins) writes.push(db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(quest.reward.coins, uid));
  if (quest.reward.skin) writes.push(db.prepare('INSERT OR IGNORE INTO user_skins (user_id, skin_id, acquired) VALUES (?, ?, ?)').bind(uid, quest.reward.skin, now));
  if (writes.length) await db.batch(writes);
  const completed: string[] = [];
  if (quest.scope === 'daily') {
    // Streak: one more day when the last counted day was yesterday.
    const day = dayKey(now);
    const u = await db.prepare('SELECT streak, streak_day FROM users WHERE id = ?').bind(uid).first<{ streak: number; streak_day: string | null }>();
    if (u && u.streak_day !== day) {
      const streak = u.streak_day === addDays(day, -1) ? u.streak + 1 : 1;
      await db.prepare('UPDATE users SET streak = ?, streak_day = ? WHERE id = ?').bind(streak, day, uid).run();
      completed.push(...await applyEvent(db, uid, { t: 'streak', days: streak }, now));
    }
    completed.push(...await applyEvent(db, uid, { t: 'daily-claimed' }, now));
  }
  return { ok: true, completed };
}

export async function buySkin(db: D1Database, uid: string, skinId: string, now = Date.now()): Promise<{ ok: true } | { error: string }> {
  const item = shopSkins(now, await seasonConfig(db)).find(s => s.id === skinId);
  if (!item?.price) return { error: 'not-for-sale' };
  const owned = await db.prepare('SELECT 1 AS x FROM user_skins WHERE user_id = ? AND skin_id = ?').bind(uid, skinId).first();
  if (owned) return { error: 'owned' };
  const paid = await db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').bind(item.price, uid, item.price).run();
  if (!paid.meta.changes) return { error: 'not-enough-coins' };
  await db.prepare('INSERT OR IGNORE INTO user_skins (user_id, skin_id, acquired) VALUES (?, ?, ?)').bind(uid, skinId, now).run();
  return { ok: true };
}

export async function equipSkin(db: D1Database, uid: string, skinId: string | null): Promise<{ ok: true } | { error: string }> {
  if (skinId !== null) {
    if (!skinById(skinId)) return { error: 'not-found' };
    const owned = await db.prepare('SELECT 1 AS x FROM user_skins WHERE user_id = ? AND skin_id = ?').bind(uid, skinId).first();
    if (!owned) return { error: 'not-owned' };
  }
  await db.prepare('UPDATE users SET skin = ? WHERE id = ?').bind(skinId, uid).run();
  return { ok: true };
}
