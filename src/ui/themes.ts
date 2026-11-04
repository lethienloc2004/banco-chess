/**
 * Colour themes for boards and pieces. Each theme is a set of CSS custom
 * properties applied to #app; the first theme of each list is the default and
 * applies nothing, so the light/dark defaults in styles.css stay in effect.
 */
export interface Theme {
  id: string;
  vi: string;
  en: string;
  /** Two colours shown in the picker swatch. */
  swatch: [string, string];
  vars: Record<string, string>;
}

export const CHESS_BOARDS: Theme[] = [
  { id: 'wood', vi: 'Gỗ', en: 'Wood', swatch: ['#f0d9b5', '#b58863'], vars: {} },
  { id: 'green', vi: 'Xanh lá', en: 'Green', swatch: ['#eeeed2', '#769656'],
    vars: { '--sq-light': '#eeeed2', '--sq-dark': '#769656' } },
  { id: 'blue', vi: 'Xanh biển', en: 'Blue', swatch: ['#dee3e6', '#8ca2ad'],
    vars: { '--sq-light': '#dee3e6', '--sq-dark': '#8ca2ad' } },
  { id: 'purple', vi: 'Tím', en: 'Purple', swatch: ['#e8e0f0', '#9179b0'],
    vars: { '--sq-light': '#e8e0f0', '--sq-dark': '#9179b0' } },
  { id: 'slate', vi: 'Đá xám', en: 'Slate', swatch: ['#d9d9d9', '#7d8796'],
    vars: { '--sq-light': '#d9d9d9', '--sq-dark': '#7d8796' } },
];

export const CHESS_PIECES: Theme[] = [
  { id: 'classic', vi: 'Trắng – Đen', en: 'White – Black', swatch: ['#ffffff', '#1d1d1d'], vars: {} },
  { id: 'cream', vi: 'Kem – Nâu', en: 'Cream – Brown', swatch: ['#f7e7c6', '#6b4423'],
    vars: { '--cp-w-fill': '#f7e7c6', '--cp-w-stroke': '#4a2e14', '--cp-b-fill': '#6b4423', '--cp-b-stroke': '#2a1708' } },
  { id: 'ocean', vi: 'Xanh – Đỏ', en: 'Blue – Red', swatch: ['#dbeafe', '#b91c1c'],
    vars: { '--cp-w-fill': '#dbeafe', '--cp-w-stroke': '#1e3a8a', '--cp-b-fill': '#b91c1c', '--cp-b-stroke': '#450a0a' } },
  { id: 'gold', vi: 'Vàng – Bạc', en: 'Gold – Silver', swatch: ['#facc15', '#64748b'],
    vars: { '--cp-w-fill': '#fde68a', '--cp-w-stroke': '#854d0e', '--cp-b-fill': '#475569', '--cp-b-stroke': '#0f172a' } },
];

export const XQ_BOARDS: Theme[] = [
  { id: 'wood', vi: 'Gỗ sáng', en: 'Light wood', swatch: ['#e9c48b', '#6b4320'], vars: {} },
  { id: 'dark', vi: 'Gỗ đậm', en: 'Dark wood', swatch: ['#b9814a', '#3d2310'],
    vars: { '--xq-bg': '#b9814a', '--xq-line': '#3d2310' } },
  { id: 'paper', vi: 'Giấy', en: 'Paper', swatch: ['#f5ecd7', '#5b4632'],
    vars: { '--xq-bg': '#f5ecd7', '--xq-line': '#5b4632' } },
  { id: 'jade', vi: 'Ngọc bích', en: 'Jade', swatch: ['#bfe0cf', '#1f5a44'],
    vars: { '--xq-bg': '#bfe0cf', '--xq-line': '#1f5a44' } },
  { id: 'night', vi: 'Đêm', en: 'Night', swatch: ['#2b3442', '#a9b6c8'],
    vars: { '--xq-bg': '#2b3442', '--xq-line': '#a9b6c8' } },
];

export const XQ_PIECES: Theme[] = [
  { id: 'classic', vi: 'Cổ điển', en: 'Classic', swatch: ['#c0261d', '#1f1a17'], vars: {} },
  { id: 'ivory', vi: 'Ngà', en: 'Ivory', swatch: ['#fffaf0', '#b91c1c'],
    vars: { '--xq-piece': '#fffaf0', '--xq-piece-edge': '#d8cbb0', '--xq-red': '#b91c1c', '--xq-black': '#111827' } },
  { id: 'wood', vi: 'Gỗ', en: 'Wood', swatch: ['#d9a066', '#7a1010'],
    vars: { '--xq-piece': '#d9a066', '--xq-piece-edge': '#8a5a2b', '--xq-red': '#7a1010', '--xq-black': '#1a0f08', '--xq-hidden': '#3b2614' } },
  { id: 'jade', vi: 'Xanh – Cam', en: 'Teal – Orange', swatch: ['#c2410c', '#134e4a'],
    vars: { '--xq-piece': '#ecf5ef', '--xq-piece-edge': '#8fb9a0', '--xq-red': '#c2410c', '--xq-black': '#134e4a', '--xq-hidden': '#2f5d50' } },
];

const ALL_VARS = [...new Set([...CHESS_BOARDS, ...CHESS_PIECES, ...XQ_BOARDS, ...XQ_PIECES].flatMap(t => Object.keys(t.vars)))];

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
