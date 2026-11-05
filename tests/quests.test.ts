import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, SKINS, activeSeason, seasonWindow, currentQuests, dailyQuests, dayKey, questById, questValue, resetsIn, shopSkins, weekKey, weeklyQuests } from '../src/shared/quests';

const vn = (s: string) => Date.parse(s + '+07:00');

describe('quest calendar', () => {
  it('uses Vietnam days and ISO weeks', () => {
    expect(dayKey(vn('2026-11-05T23:59:00'))).toBe('2026-11-05');
    expect(dayKey(vn('2026-11-06T00:01:00'))).toBe('2026-11-06');
    expect(weekKey(vn('2026-11-05T12:00:00'))).toBe('2026-W45');
    expect(weekKey(vn('2026-01-01T12:00:00'))).toBe('2026-W01');
    expect(weekKey(vn('2027-01-01T12:00:00'))).toBe('2026-W53');
    const r = resetsIn(vn('2026-11-05T23:00:00'));
    expect(r.day).toBe(3600_000);
    expect(r.week).toBe(3600_000 + 3 * 86400_000); // Thursday 23:00 -> Monday 00:00
  });

  it('picks 3 daily and 2 weekly quests, the same for everyone', () => {
    expect(dailyQuests('2026-11-05')).toHaveLength(3);
    expect(new Set(dailyQuests('2026-11-05').map(q => q.id)).size).toBe(3);
    expect(dailyQuests('2026-11-05')).toEqual(dailyQuests('2026-11-05'));
    expect(weeklyQuests('2026-W45')).toHaveLength(2);
    const days = new Set(Array.from({ length: 10 }, (_, i) => dailyQuests(`2026-11-${String(i + 1).padStart(2, '0')}`).map(q => q.id).join()));
    expect(days.size).toBeGreaterThan(5);
  });

  it('knows the holiday seasons', () => {
    expect(activeSeason('2026-11-05')?.id).toBe('halloween');
    expect(activeSeason('2026-11-08')).toBeNull();
    expect(activeSeason('2026-12-24')?.id).toBe('christmas');
    expect(activeSeason('2027-01-05')?.id).toBe('christmas');
    expect(activeSeason('2027-02-06')?.id).toBe('tet');
    expect(activeSeason('2027-09-15')?.id).toBe('midautumn');
    expect(shopSkins(vn('2026-11-05T12:00:00')).map(s => s.id)).toContain('pumpkin');
    expect(shopSkins(vn('2026-11-20T12:00:00')).map(s => s.id)).not.toContain('pumpkin');
    expect(currentQuests(vn('2026-11-05T12:00:00')).some(q => q.quest.id === 's.halloween')).toBe(true);
  });

  it('every reward skin exists and every skin can be obtained', () => {
    const ids = new Set(SKINS.map(s => s.id));
    for (const q of currentQuests()) if (q.quest.reward.skin) expect(ids.has(q.quest.reward.skin)).toBe(true);
    for (const s of SKINS) {
      if (s.how === 'achievement') expect(ACHIEVEMENTS.some(a => a.reward.skin === s.id)).toBe(true);
      else expect(s.price).toBeGreaterThan(0);
    }
  });
});

describe('quest scoring', () => {
  it('counts the right events', () => {
    const q = questById('d.win-medium')!;
    expect(q.step({ t: 'game', mode: 'bot', kind: 'chess', result: 'win', level: 'easy' }, 0)).toBe(0);
    expect(q.step({ t: 'game', mode: 'bot', kind: 'chess', result: 'win', level: 'medium' }, 0)).toBe(1);
    expect(q.step({ t: 'game', mode: 'bot', kind: 'chess', result: 'loss', level: 'expert' }, 0)).toBe(0);
    const all = questById('a.allkinds')!;
    let p = 0;
    for (const kind of ['chess', 'xiangqi', 'chess', 'jieqi'] as const) p = all.step({ t: 'game', mode: 'online', kind, result: 'win' }, p);
    expect(questValue(all, p)).toBe(3);
    p = all.step({ t: 'game', mode: 'bot', kind: 'hiddenchess', result: 'win', level: 'easy' }, p);
    expect(questValue(all, p)).toBe(4);
    expect(questById('a.rated-1400')!.step({ t: 'rating', kind: 'chess', rating: 1416 }, 1300)).toBe(1416);
    expect(questById('a.puzzles-20')!.step({ t: 'puzzle', id: 'c1-01', distinct: 7 }, 5)).toBe(7);
  });

  it('lets the admin force, stop and sell holiday events', () => {
    // Turned off: Halloween does not run even on its dates.
    expect(activeSeason('2026-11-05', { halloween: { mode: 'off' } })).toBeNull();
    // Turned on out of season: runs from the day it was turned on, with no end date.
    const tet = activeSeason('2026-11-20', { tet: { mode: 'on', since: '2026-11-19' } });
    expect(tet?.id).toBe('tet');
    expect(tet?.end).toBeNull();
    expect(tet?.period).toBe('s:tet:2026-11-19');
    // Forced on during its own window: same run (and progress) as the calendar one.
    expect(activeSeason('2026-11-05', { halloween: { mode: 'on', since: '2026-11-01' } })?.period).toBe('s:halloween:2026-10-15');
    // A forced event wins over the calendar one; the latest forced wins over older ones.
    expect(activeSeason('2026-11-05', { christmas: { mode: 'on', since: '2026-11-02' } })?.id).toBe('christmas');
    expect(activeSeason('2026-11-20', { tet: { mode: 'on', since: '2026-11-01' }, midautumn: { mode: 'on', since: '2026-11-10' } })?.id).toBe('midautumn');
    expect(currentQuests(vn('2026-11-20T12:00:00'), { tet: { mode: 'on', since: '2026-11-19' } }).some(q => q.quest.id === 's.tet')).toBe(true);
    // Sold all year: the skin is in the shop while its event is not running.
    const shop = shopSkins(vn('2026-11-20T12:00:00'), { christmas: { mode: 'auto', shop: true } }).map(x => x.id);
    expect(shop).toContain('christmas');
    expect(shop).not.toContain('pumpkin');
    expect(seasonWindow('halloween', '2026-11-20')).toEqual({ start: '2027-10-15', end: '2027-11-07' });
  });
});
