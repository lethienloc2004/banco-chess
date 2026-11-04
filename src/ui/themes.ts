/**
 * Colour themes for boards and pieces. Each theme is a set of CSS custom
 * properties applied to the root element; the first theme of each list is the
 * default and applies nothing, so the light/dark defaults in styles.css apply.
 * The "custom" theme of each list is built from the user's own colours.
 */
export interface Theme {
  id: string;
  vi: string;
  en: string;
  /** Two colours shown in the picker swatch. */
  swatch: [string, string];
  vars: Record<string, string>;
}

const board = (id: string, vi: string, en: string, light: string, dark: string): Theme =>
  ({ id, vi, en, swatch: [light, dark], vars: { '--sq-light': light, '--sq-dark': dark } });

export const CHESS_BOARDS: Theme[] = [
  { id: 'wood', vi: 'Gỗ', en: 'Wood', swatch: ['#f0d9b5', '#b58863'], vars: {} },
  board('green', 'Xanh lá', 'Green', '#eeeed2', '#769656'),
  board('blue', 'Xanh biển', 'Blue', '#dee3e6', '#8ca2ad'),
  board('purple', 'Tím', 'Purple', '#e8e0f0', '#9179b0'),
  board('slate', 'Đá xám', 'Slate', '#d9d9d9', '#7d8796'),
  board('walnut', 'Óc chó', 'Walnut', '#e6cba5', '#7b5434'),
  board('coral', 'San hô', 'Coral', '#f6e4d8', '#d9826a'),
  board('ice', 'Băng', 'Ice', '#eaf4fb', '#7fb2d6'),
  board('mint', 'Bạc hà', 'Mint', '#e6f5ec', '#5fa883'),
  board('rose', 'Hồng', 'Rose', '#fbe4ea', '#c77d93'),
  board('sand', 'Cát', 'Sand', '#f3ead3', '#c4a46c'),
  board('olive', 'Ô liu', 'Olive', '#ecebd2', '#8a8a4e'),
  board('marble', 'Cẩm thạch', 'Marble', '#f2f2f0', '#a8a39a'),
  board('tournament', 'Thi đấu', 'Tournament', '#e9edcc', '#779954'),
  board('midnight', 'Nửa đêm', 'Midnight', '#9aa6b8', '#34405a'),
  board('orange', 'Cam', 'Orange', '#fbe5c8', '#e08a3c'),
];

const cp = (id: string, vi: string, en: string, wf: string, ws: string, bf: string, bs: string): Theme =>
  ({ id, vi, en, swatch: [wf, bf], vars: { '--cp-w-fill': wf, '--cp-w-stroke': ws, '--cp-b-fill': bf, '--cp-b-stroke': bs } });

export const CHESS_PIECES: Theme[] = [
  { id: 'classic', vi: 'Trắng – Đen', en: 'White – Black', swatch: ['#ffffff', '#1d1d1d'], vars: {} },
  cp('cream', 'Kem – Nâu', 'Cream – Brown', '#f7e7c6', '#4a2e14', '#6b4423', '#2a1708'),
  cp('ocean', 'Xanh – Đỏ', 'Blue – Red', '#dbeafe', '#1e3a8a', '#b91c1c', '#450a0a'),
  cp('gold', 'Vàng – Bạc', 'Gold – Silver', '#fde68a', '#854d0e', '#475569', '#0f172a'),
  cp('emerald', 'Ngọc lục – Hồng ngọc', 'Emerald – Ruby', '#a7f3d0', '#065f46', '#9f1239', '#4c0519'),
  cp('ivory', 'Ngà – Mun', 'Ivory – Ebony', '#fffbeb', '#57534e', '#292524', '#0c0a09'),
  cp('violet', 'Tím – Cam', 'Violet – Amber', '#ede9fe', '#5b21b6', '#d97706', '#78350f'),
  cp('sky', 'Trời – Đêm', 'Sky – Navy', '#e0f2fe', '#0369a1', '#1e3a8a', '#0b1739'),
  cp('pastel', 'Pastel', 'Pastel', '#fce7f3', '#9d174d', '#a5b4fc', '#3730a3'),
  cp('neon', 'Neon', 'Neon', '#ecfccb', '#3f6212', '#db2777', '#500724'),
];

const xb = (id: string, vi: string, en: string, bg: string, line: string): Theme =>
  ({ id, vi, en, swatch: [bg, line], vars: { '--xq-bg': bg, '--xq-line': line } });

export const XQ_BOARDS: Theme[] = [
  { id: 'wood', vi: 'Gỗ sáng', en: 'Light wood', swatch: ['#e9c48b', '#6b4320'], vars: {} },
  xb('dark', 'Gỗ đậm', 'Dark wood', '#b9814a', '#3d2310'),
  xb('paper', 'Giấy', 'Paper', '#f5ecd7', '#5b4632'),
  xb('jade', 'Ngọc bích', 'Jade', '#bfe0cf', '#1f5a44'),
  xb('night', 'Đêm', 'Night', '#2b3442', '#a9b6c8'),
  xb('bamboo', 'Tre', 'Bamboo', '#dfe4a8', '#4d5a1e'),
  xb('lacquer', 'Sơn mài', 'Lacquer', '#7a1f1a', '#f0c674'),
  xb('sand', 'Cát', 'Sand', '#ecd9b0', '#7a5a2e'),
  xb('sky', 'Trời xanh', 'Sky', '#cfe3f3', '#24517a'),
  xb('cherry', 'Anh đào', 'Cherry', '#f6d6d6', '#8a2f3f'),
  xb('stone', 'Đá', 'Stone', '#cfcac2', '#46413a'),
  xb('ink', 'Mực tàu', 'Ink', '#f4f1ea', '#111111'),
  xb('amber', 'Hổ phách', 'Amber', '#f2b55c', '#5a2d06'),
];

const xp = (id: string, vi: string, en: string, disc: string, edge: string, red: string, black: string, hidden?: string): Theme =>
  ({ id, vi, en, swatch: [red, black], vars: { '--xq-piece': disc, '--xq-piece-edge': edge, '--xq-red': red, '--xq-black': black, ...(hidden ? { '--xq-hidden': hidden } : {}) } });

export const XQ_PIECES: Theme[] = [
  { id: 'classic', vi: 'Cổ điển', en: 'Classic', swatch: ['#c0261d', '#1f1a17'], vars: {} },
  xp('ivory', 'Ngà', 'Ivory', '#fffaf0', '#d8cbb0', '#b91c1c', '#111827'),
  xp('wood', 'Gỗ', 'Wood', '#d9a066', '#8a5a2b', '#7a1010', '#1a0f08', '#3b2614'),
  xp('jade', 'Xanh – Cam', 'Teal – Orange', '#ecf5ef', '#8fb9a0', '#c2410c', '#134e4a', '#2f5d50'),
  xp('marble', 'Cẩm thạch', 'Marble', '#f1f1ef', '#a8a39a', '#9f1239', '#1f2937', '#57534e'),
  xp('gold', 'Vàng son', 'Gold', '#fde68a', '#b45309', '#991b1b', '#1c1917', '#78350f'),
  xp('lacquer', 'Sơn mài', 'Lacquer', '#1f1a17', '#c9a46a', '#f87171', '#f5d58a', '#4a2f19'),
  xp('blue', 'Đỏ – Xanh', 'Red – Blue', '#fdfaf3', '#c9b899', '#dc2626', '#1d4ed8', '#334155'),
  xp('green', 'Đỏ – Lục', 'Red – Green', '#fdfaf3', '#c9b899', '#b91c1c', '#166534', '#365314'),
  xp('purple', 'Hồng – Tím', 'Pink – Purple', '#fdf4ff', '#d8b4fe', '#db2777', '#6b21a8', '#581c87'),
];

/** Custom colours chosen with colour pickers. */
export interface CustomColors {
  chessBoard: [string, string];
  chessPieces: [string, string];
  xqBoard: [string, string];
  xqPieces: [string, string, string];
}

export const DEFAULT_CUSTOM: CustomColors = {
  chessBoard: ['#f0d9b5', '#b58863'],
  chessPieces: ['#ffffff', '#1d1d1d'],
  xqBoard: ['#e9c48b', '#6b4320'],
  xqPieces: ['#fbeed3', '#c0261d', '#1f1a17'],
};

/** Darken a #rrggbb colour (for automatic outlines). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * f));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

export function customTheme(kind: keyof CustomColors, c: CustomColors): Theme {
  const v = c[kind] as string[];
  const base = { id: 'custom', vi: 'Tùy chỉnh', en: 'Custom' };
  switch (kind) {
    case 'chessBoard': return { ...base, swatch: [v[0], v[1]], vars: { '--sq-light': v[0], '--sq-dark': v[1] } };
    case 'chessPieces': return { ...base, swatch: [v[0], v[1]], vars: { '--cp-w-fill': v[0], '--cp-w-stroke': shade(v[0], 0.3), '--cp-b-fill': v[1], '--cp-b-stroke': shade(v[1], 0.45) } };
    case 'xqBoard': return { ...base, swatch: [v[0], v[1]], vars: { '--xq-bg': v[0], '--xq-line': v[1] } };
    case 'xqPieces': return { ...base, swatch: [v[1], v[2]], vars: { '--xq-piece': v[0], '--xq-piece-edge': shade(v[0], 0.75), '--xq-red': v[1], '--xq-black': v[2] } };
  }
}

const ALL_VARS = [...new Set([...CHESS_BOARDS, ...CHESS_PIECES, ...XQ_BOARDS, ...XQ_PIECES, ...(['chessBoard', 'chessPieces', 'xqBoard', 'xqPieces'] as const).map(k => customTheme(k, DEFAULT_CUSTOM))].flatMap(t => Object.keys(t.vars)))];

export function findTheme(list: Theme[], id: string): Theme {
  return list.find(t => t.id === id) ?? list[0];
}

/** Apply a set of themes to an element, clearing variables they don't set. */
export function applyThemes(el: HTMLElement, themes: Theme[]) {
  const vars: Record<string, string> = Object.assign({}, ...themes.map(t => t.vars));
  for (const name of ALL_VARS) {
    if (vars[name]) el.style.setProperty(name, vars[name]);
    else el.style.removeProperty(name);
  }
}
