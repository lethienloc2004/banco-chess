/**
 * Quests (daily, weekly, achievements, holiday events) and piece skins.
 * Shared by the app (texts, progress display) and the server (scoring).
 * Days and weeks follow Vietnam time (UTC+7).
 */
import type { GameKind } from '../engine/types';

export type Text = { vi: string; en: string };
export type BotLevel = 'easy' | 'medium' | 'hard' | 'expert';
export const LEVEL_RANK: Record<BotLevel, number> = { easy: 0, medium: 1, hard: 2, expert: 3 };
export const KIND_BIT: Record<GameKind, number> = { chess: 1, xiangqi: 2, jieqi: 4, hiddenchess: 8 };

/** Something the player did. Online games are reported by the server itself. */
export type QuestEvent =
  | { t: 'game'; mode: 'bot' | 'online'; kind: GameKind; result: 'win' | 'loss' | 'draw'; level?: BotLevel; rated?: boolean }
  /** `distinct`: puzzles solved at least once, ever (filled in by the server). */
  | { t: 'puzzle'; id: string; distinct: number }
  | { t: 'analysis' }
  | { t: 'watch' }
  | { t: 'daily-claimed' }
  | { t: 'rating'; kind: GameKind; rating: number }
  | { t: 'streak'; days: number };

export type QuestScope = 'daily' | 'weekly' | 'achievement' | 'season';

export interface QuestDef {
  id: string;
  scope: QuestScope;
  title: Text;
  target: number;
  reward: { coins?: number; skin?: string };
  /** New raw progress after an event (unchanged when the event does not count). */
  step(ev: QuestEvent, prev: number): number;
  /** Progress shown to the player, from the raw value (e.g. a bit mask → number of games). */
  value?(raw: number): number;
  /** Holiday quests belong to one season. */
  season?: string;
}

const isGame = (ev: QuestEvent): ev is Extract<QuestEvent, { t: 'game' }> => ev.t === 'game';
const plus = (cond: boolean) => (prev: number) => prev + (cond ? 1 : 0);
const bits = (raw: number) => { let n = 0; for (let x = raw; x; x &= x - 1) n++; return n; };
const won = (ev: QuestEvent) => isGame(ev) && ev.result === 'win';
const finished = (ev: QuestEvent) => isGame(ev);

function quest(id: string, scope: QuestScope, target: number, reward: QuestDef['reward'], vi: string, en: string,
  step: (ev: QuestEvent, prev: number) => number, extra: Partial<QuestDef> = {}): QuestDef {
  return { id, scope, target, reward, title: { vi, en }, step, ...extra };
}

// ---------- Daily (3 a day, picked from this pool) ----------

const DAILY: QuestDef[] = [
  quest('d.win-medium', 'daily', 1, { coins: 30 }, 'Thắng 1 ván với máy từ mức Vừa trở lên', 'Beat the bot once on Medium or harder',
    (ev, p) => plus(won(ev) && isGame(ev) && ev.mode === 'bot' && LEVEL_RANK[ev.level ?? 'easy'] >= 1)(p)),
  quest('d.win-2', 'daily', 2, { coins: 25 }, 'Thắng 2 ván (với máy hoặc online)', 'Win 2 games (bot or online)', (ev, p) => plus(won(ev))(p)),
  quest('d.puzzles-3', 'daily', 3, { coins: 25 }, 'Giải 3 thế cờ', 'Solve 3 puzzles', (ev, p) => plus(ev.t === 'puzzle')(p)),
  quest('d.online-1', 'daily', 1, { coins: 35 }, 'Chơi xong 1 ván online', 'Finish 1 online game', (ev, p) => plus(isGame(ev) && ev.mode === 'online')(p)),
  quest('d.xiangqi', 'daily', 1, { coins: 20 }, 'Chơi xong 1 ván cờ tướng', 'Finish a xiangqi game', (ev, p) => plus(isGame(ev) && ev.kind === 'xiangqi')(p)),
  quest('d.jieqi', 'daily', 1, { coins: 25 }, 'Chơi xong 1 ván cờ úp', 'Finish a jieqi game', (ev, p) => plus(isGame(ev) && ev.kind === 'jieqi')(p)),
  quest('d.hidden', 'daily', 1, { coins: 25 }, 'Chơi xong 1 ván cờ vua úp', 'Finish a hidden chess game', (ev, p) => plus(isGame(ev) && ev.kind === 'hiddenchess')(p)),
  quest('d.chess-win', 'daily', 1, { coins: 25 }, 'Thắng 1 ván cờ vua', 'Win a chess game', (ev, p) => plus(won(ev) && isGame(ev) && ev.kind === 'chess')(p)),
  quest('d.analysis', 'daily', 1, { coins: 15 }, 'Phân tích 1 ván cờ', 'Analyse a game', (ev, p) => plus(ev.t === 'analysis')(p)),
  quest('d.watch', 'daily', 1, { coins: 15 }, 'Xem trọn 1 ván máy đấu máy', 'Watch a bot-vs-bot game to the end', (ev, p) => plus(ev.t === 'watch')(p)),
];

// ---------- Weekly (2 a week) ----------

const WEEKLY: QuestDef[] = [
  quest('w.wins-10', 'weekly', 10, { coins: 120 }, 'Thắng 10 ván trong tuần', 'Win 10 games this week', (ev, p) => plus(won(ev))(p)),
  quest('w.online-5', 'weekly', 5, { coins: 150 }, 'Chơi xong 5 ván online', 'Finish 5 online games', (ev, p) => plus(isGame(ev) && ev.mode === 'online')(p)),
  quest('w.puzzles-15', 'weekly', 15, { coins: 100 }, 'Giải 15 thế cờ', 'Solve 15 puzzles', (ev, p) => plus(ev.t === 'puzzle')(p)),
  quest('w.allkinds', 'weekly', 4, { coins: 120 }, 'Chơi xong ván của cả 4 loại cờ', 'Finish a game of all 4 games', (ev, p) => (finished(ev) && isGame(ev) ? p | KIND_BIT[ev.kind] : p), { value: bits }),
  quest('w.hard-win', 'weekly', 1, { coins: 150 }, 'Thắng máy mức Khó', 'Beat the bot on Hard', (ev, p) => plus(won(ev) && isGame(ev) && ev.mode === 'bot' && LEVEL_RANK[ev.level ?? 'easy'] >= 2)(p)),
  quest('w.daily-5', 'weekly', 5, { coins: 100 }, 'Hoàn thành 5 nhiệm vụ ngày', 'Complete 5 daily quests', (ev, p) => plus(ev.t === 'daily-claimed')(p)),
];

// ---------- Achievements (once; each unlocks a skin) ----------

export const ACHIEVEMENTS: QuestDef[] = [
  quest('a.first-win', 'achievement', 1, { coins: 50, skin: 'wood' }, 'Thắng ván đầu tiên với máy', 'Win your first game against the bot',
    (ev, p) => plus(won(ev) && isGame(ev) && ev.mode === 'bot')(p)),
  quest('a.puzzles-20', 'achievement', 20, { coins: 50, skin: 'marble' }, 'Giải 20 thế cờ khác nhau', 'Solve 20 different puzzles',
    (ev, p) => (ev.t === 'puzzle' ? Math.max(p, ev.distinct) : p)),
  quest('a.hard-win', 'achievement', 1, { coins: 80, skin: 'bronze' }, 'Thắng máy mức Khó', 'Beat the bot on Hard',
    (ev, p) => plus(won(ev) && isGame(ev) && ev.mode === 'bot' && LEVEL_RANK[ev.level ?? 'easy'] >= 2)(p)),
  quest('a.expert-win', 'achievement', 1, { coins: 150, skin: 'gold' }, 'Thắng máy mức Rất khó', 'Beat the bot on Expert',
    (ev, p) => plus(won(ev) && isGame(ev) && ev.mode === 'bot' && ev.level === 'expert')(p)),
  quest('a.online-10', 'achievement', 10, { coins: 80, skin: 'crystal' }, 'Chơi xong 10 ván online', 'Finish 10 online games',
    (ev, p) => plus(isGame(ev) && ev.mode === 'online')(p)),
  quest('a.rated-1400', 'achievement', 1400, { coins: 150, skin: 'jade' }, 'Đạt 1400 Elo ở một loại cờ', 'Reach 1400 Elo in any game',
    (ev, p) => (ev.t === 'rating' ? Math.max(p, ev.rating) : p)),
  quest('a.allkinds', 'achievement', 4, { coins: 80, skin: 'neon' }, 'Thắng ít nhất 1 ván ở cả 4 loại cờ', 'Win at least one game of all 4 games',
    (ev, p) => (won(ev) && isGame(ev) ? p | KIND_BIT[ev.kind] : p), { value: bits }),
  quest('a.streak-7', 'achievement', 7, { coins: 100, skin: 'dragon' }, 'Làm nhiệm vụ 7 ngày liên tiếp', 'Do quests 7 days in a row',
    (ev, p) => (ev.t === 'streak' ? Math.max(p, ev.days) : p)),
  quest('a.puzzles-all', 'achievement', 126, { coins: 200, skin: 'galaxy' }, 'Giải hết 126 thế cờ', 'Solve all 126 puzzles',
    (ev, p) => (ev.t === 'puzzle' ? Math.max(p, ev.distinct) : p)),
];

// ---------- Holiday seasons ----------

export interface Season { id: string; name: Text; skin: string; emoji: string }

export const SEASONS: Season[] = [
  { id: 'halloween', name: { vi: 'Halloween', en: 'Halloween' }, skin: 'pumpkin', emoji: '🎃' },
  { id: 'christmas', name: { vi: 'Giáng sinh', en: 'Christmas' }, skin: 'christmas', emoji: '🎄' },
  { id: 'tet', name: { vi: 'Tết Nguyên đán', en: 'Lunar New Year' }, skin: 'tet', emoji: '🧧' },
  { id: 'midautumn', name: { vi: 'Tết Trung thu', en: 'Mid-Autumn Festival' }, skin: 'lantern', emoji: '🏮' },
];

/** First day of the Lunar New Year and of the Mid-Autumn Festival (15/8 âm lịch). Add later years here. */
const LUNAR_NEW_YEAR: Record<number, string> = { 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03', 2031: '2031-01-23', 2032: '2032-02-11' };
const MID_AUTUMN: Record<number, string> = { 2026: '2026-09-25', 2027: '2027-09-15', 2028: '2028-10-03', 2029: '2029-09-22', 2030: '2030-09-12', 2031: '2031-10-01', 2032: '2032-09-19' };

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** [first day, last day] of each season window around `year`. */
function windows(year: number): { season: string; start: string; end: string }[] {
  const out: { season: string; start: string; end: string }[] = [];
  for (const y of [year - 1, year]) {
    out.push({ season: 'halloween', start: `${y}-10-15`, end: `${y}-11-07` });
    out.push({ season: 'christmas', start: `${y}-12-01`, end: `${y + 1}-01-06` });
    if (LUNAR_NEW_YEAR[y]) out.push({ season: 'tet', start: addDays(LUNAR_NEW_YEAR[y], -14), end: addDays(LUNAR_NEW_YEAR[y], 10) });
    if (MID_AUTUMN[y]) out.push({ season: 'midautumn', start: addDays(MID_AUTUMN[y], -10), end: addDays(MID_AUTUMN[y], 3) });
  }
  return out;
}

/** The holiday running on `day` (YYYY-MM-DD), with its window. */
export function activeSeason(day: string): (Season & { start: string; end: string; period: string }) | null {
  const w = windows(Number(day.slice(0, 4))).find(x => day >= x.start && day <= x.end);
  if (!w) return null;
  return { ...SEASONS.find(s => s.id === w.season)!, start: w.start, end: w.end, period: `s:${w.season}:${w.start}` };
}

export const SEASON_QUESTS: QuestDef[] = SEASONS.map(s => quest(`s.${s.id}`, 'season', 3, { coins: 60, skin: s.skin },
  `${s.emoji} Dịp ${s.name.vi}: thắng 3 ván (với máy hoặc online)`, `${s.emoji} ${s.name.en}: win 3 games (bot or online)`,
  (ev, p) => plus(won(ev))(p), { season: s.id }));

// ---------- Skins ----------

export interface SkinDef {
  id: string;
  name: Text;
  /** How it is obtained. */
  how: 'achievement' | 'shop' | 'season';
  price?: number;
  season?: string;
}

export const SKINS: SkinDef[] = [
  { id: 'wood', name: { vi: 'Gỗ', en: 'Wood' }, how: 'achievement' },
  { id: 'marble', name: { vi: 'Cẩm thạch', en: 'Marble' }, how: 'achievement' },
  { id: 'bronze', name: { vi: 'Đồng', en: 'Bronze' }, how: 'achievement' },
  { id: 'gold', name: { vi: 'Vàng', en: 'Gold' }, how: 'achievement' },
  { id: 'crystal', name: { vi: 'Pha lê', en: 'Crystal' }, how: 'achievement' },
  { id: 'jade', name: { vi: 'Ngọc bích', en: 'Jade' }, how: 'achievement' },
  { id: 'neon', name: { vi: 'Neon', en: 'Neon' }, how: 'achievement' },
  { id: 'dragon', name: { vi: 'Rồng lửa', en: 'Fire dragon' }, how: 'achievement' },
  { id: 'galaxy', name: { vi: 'Thiên hà', en: 'Galaxy' }, how: 'achievement' },
  { id: 'ink', name: { vi: 'Mực tàu', en: 'Ink' }, how: 'shop', price: 300 },
  { id: 'candy', name: { vi: 'Kẹo ngọt', en: 'Candy' }, how: 'shop', price: 350 },
  { id: 'sakura', name: { vi: 'Hoa anh đào', en: 'Sakura' }, how: 'shop', price: 400 },
  { id: 'pumpkin', name: { vi: 'Bí ngô Halloween', en: 'Halloween pumpkin' }, how: 'season', season: 'halloween', price: 250 },
  { id: 'christmas', name: { vi: 'Giáng sinh', en: 'Christmas' }, how: 'season', season: 'christmas', price: 250 },
  { id: 'tet', name: { vi: 'Tết', en: 'Lunar New Year' }, how: 'season', season: 'tet', price: 250 },
  { id: 'lantern', name: { vi: 'Đèn Trung thu', en: 'Mid-Autumn lantern' }, how: 'season', season: 'midautumn', price: 250 },
];

export const skinById = (id: string | null | undefined) => SKINS.find(s => s.id === id) ?? null;
export const ALL_QUESTS: QuestDef[] = [...DAILY, ...WEEKLY, ...ACHIEVEMENTS, ...SEASON_QUESTS];
export const questById = (id: string) => ALL_QUESTS.find(q => q.id === id) ?? null;
export const questValue = (q: QuestDef, raw: number) => Math.min(q.target, q.value ? q.value(raw) : raw);

// ---------- Calendar (Vietnam time) ----------

const VN_OFFSET = 7 * 3600_000;

export function dayKey(now = Date.now()): string {
  return new Date(now + VN_OFFSET).toISOString().slice(0, 10);
}

/** ISO week, e.g. "2026-W45". */
export function weekKey(now = Date.now()): string {
  const d = new Date(dayKey(now) + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow + 3); // Thursday of this week
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Milliseconds until the next Vietnam midnight / next Monday. */
export function resetsIn(now = Date.now()): { day: number; week: number } {
  const vn = new Date(now + VN_OFFSET);
  const midnight = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + 1) - VN_OFFSET;
  const dow = (vn.getUTCDay() + 6) % 7;
  const monday = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + 7 - dow) - VN_OFFSET;
  return { day: midnight - now, week: monday - now };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Same pick for everyone on a given day/week, so players can talk about "today's quests". */
function pick(pool: QuestDef[], n: number, seed: string): QuestDef[] {
  const order = pool.map(q => ({ q, k: hash(seed + q.id) })).sort((a, b) => a.k - b.k).map(x => x.q);
  return order.slice(0, n);
}

export const dailyQuests = (day: string) => pick(DAILY, 3, 'day:' + day);
export const weeklyQuests = (week: string) => pick(WEEKLY, 2, 'week:' + week);

/** The quests running now, each with the period its progress belongs to. */
export function currentQuests(now = Date.now()): { quest: QuestDef; period: string }[] {
  const day = dayKey(now), week = weekKey(now);
  const out = [
    ...dailyQuests(day).map(quest => ({ quest, period: 'd:' + day })),
    ...weeklyQuests(week).map(quest => ({ quest, period: 'w:' + week })),
    ...ACHIEVEMENTS.map(quest => ({ quest, period: 'a' })),
  ];
  const season = activeSeason(day);
  if (season) out.push({ quest: SEASON_QUESTS.find(q => q.season === season.id)!, period: season.period });
  return out;
}

/** Skins that can be bought right now. */
export function shopSkins(now = Date.now()): SkinDef[] {
  const season = activeSeason(dayKey(now));
  return SKINS.filter(s => s.how === 'shop' || (s.how === 'season' && s.season === season?.id));
}
