/** User settings and local persistence. */
import type { Level } from './engine/ai';
import type { ClockState } from './clock';
import type { GameKind, Outcome } from './engine/types';
import type { SavedMatch } from './game';
import { STRINGS, type Lang, type Strings } from './i18n';
import { DEFAULT_CUSTOM, type CustomColors } from './ui/themes';

export type Mode = 'bot' | 'pvp' | 'room';

export interface Settings {
  lang: Lang;
  theme: 'auto' | 'light' | 'dark';
  humanSide: 0 | 1;
  onlineSide: 0 | 1 | 'random';
  level: Level;
  labels: 'hanzi' | 'viet';
  sound: boolean;
  chessBoard: string;
  chessPieces: string;
  xqBoard: string;
  xqPieces: string;
  custom: CustomColors;
  onlineClock: string;
  /** Time control for bot / two-player games ('none' = unlimited). */
  localClock: string;
  /** Bot vs bot: level per side and pace. */
  watchLevels: [Level, Level];
  watchSpeed: 'slow' | 'normal' | 'fast';
  /** 'piece': every piece has its own sound; 'simple': one knock for all. */
  soundStyle: 'piece' | 'simple';
  /** Show other players' piece skins in online games. */
  showSkins: boolean;
}

/** A local (bot or two-player) game saved per kind so it can be resumed. */
export interface SavedGame {
  match: SavedMatch;
  mode: 'bot' | 'pvp';
  humanSide: 0 | 1;
  level: Level;
  over?: boolean;
  clock?: ClockState | null;
  /** Set when the game ended on time. */
  flagged?: Outcome | null;
}

export const KINDS: GameKind[] = ['chess', 'xiangqi', 'jieqi', 'hiddenchess'];

export const store = {
  get<T>(key: string, session = false): T | null {
    try {
      const v = (session ? sessionStorage : localStorage).getItem('banco:' + key);
      return v ? (JSON.parse(v) as T) : null;
    } catch { return null; }
  },
  set(key: string, value: unknown, session = false) {
    try { (session ? sessionStorage : localStorage).setItem('banco:' + key, JSON.stringify(value)); } catch { /* unavailable */ }
  },
  remove(key: string, session = false) {
    try { (session ? sessionStorage : localStorage).removeItem('banco:' + key); } catch { /* unavailable */ }
  },
};

const defaults: Settings = {
  lang: navigator.language && !navigator.language.startsWith('vi') ? 'en' : 'vi',
  theme: 'auto',
  humanSide: 0,
  onlineSide: 0,
  level: 'medium',
  labels: 'hanzi',
  sound: true,
  chessBoard: 'wood',
  chessPieces: 'classic',
  xqBoard: 'wood',
  xqPieces: 'classic',
  custom: DEFAULT_CUSTOM,
  onlineClock: '10+5',
  localClock: 'none',
  watchLevels: ['hard', 'hard'],
  watchSpeed: 'normal',
  soundStyle: 'piece',
  showSkins: true,
};

export const settings: Settings = { ...defaults, ...store.get<Partial<Settings>>('settings') };
settings.custom = { ...DEFAULT_CUSTOM, ...settings.custom };

export function saveSettings() {
  store.set('settings', settings);
}

export function t(): Strings {
  return STRINGS[settings.lang];
}
