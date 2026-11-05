/**
 * Piece skins, drawn with SVG only (gradients, glow filters, small
 * decorations and capture effects), for chess glyphs and xiangqi discs.
 * Side 0 = White / Red, side 1 = Black.
 */

import { chessShape, discShape, type ChessSet, type DiscShape } from './pieces';

type Pair<T> = [T, T];

interface ChessStyle { fill: string; stroke: string; sw: number; filter?: string }
interface XqStyle { disc: Pair<string>; edge: Pair<string>; edgeW?: number; ring: Pair<string>; text: Pair<string>; textStroke?: Pair<string>; filter?: Pair<string | undefined>; discFilter?: string }
export type Fx = 'fire' | 'sparkle' | 'snow' | 'petals' | 'glow' | 'spooky';

interface Skin {
  /** Chess piece shapes and xiangqi disc outline. */
  set: ChessSet;
  disc: DiscShape;
  defs: string;
  chess: Pair<ChessStyle>;
  xq: XqStyle;
  /** Extra shapes drawn on top of a piece (centre 0,0; chess glyphs span about ±40, xiangqi discs r = 44). */
  deco?: (game: 'chess' | 'xq', side: 0 | 1) => string;
  fx?: Fx;
}

// ---------- SVG helpers ----------

const lin = (id: string, stops: string[], x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / Math.max(1, stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const rad = (id: string, stops: string[], cx = 0.38, cy = 0.32) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="0.75">${stops.map((c, i) => `<stop offset="${(i / Math.max(1, stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</radialGradient>`;
/** Soft glow in the element's own colours. */
const glow = (id: string, blur = 3) =>
  `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
/** Coloured glow (independent of the element's colour). */
const halo = (id: string, color: string, blur = 4) =>
  `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="a"/><feFlood flood-color="${color}"/><feComposite in2="a" operator="in" result="h"/><feMerge><feMergeNode in="h"/><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
const url = (id: string) => `url(#${id})`;

const flower = (x: number, y: number, petal: string, heart: string, r = 6) => {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 72 - 90) * Math.PI / 180;
    return `<circle cx="${(x + Math.cos(a) * r).toFixed(1)}" cy="${(y + Math.sin(a) * r).toFixed(1)}" r="${(r * 0.72).toFixed(1)}" fill="${petal}"/>`;
  }).join('');
  return `<g class="sk-deco">${petals}<circle cx="${x}" cy="${y}" r="${(r * 0.5).toFixed(1)}" fill="${heart}"/></g>`;
};
const sparkle = (x: number, y: number, s: number, c = '#fff') =>
  `<path class="sk-twinkle" d="M${x} ${y - s}L${x + s * 0.28} ${y - s * 0.28}L${x + s} ${y}L${x + s * 0.28} ${y + s * 0.28}L${x} ${y + s}L${x - s * 0.28} ${y + s * 0.28}L${x - s} ${y}L${x - s * 0.28} ${y - s * 0.28}Z" fill="${c}"/>`;
const holly = (x: number, y: number) =>
  `<g class="sk-deco" transform="translate(${x} ${y})"><path d="M0 0 C-6 -8 -16 -6 -20 -2 C-14 0 -10 4 -12 8 C-6 4 -2 4 0 0Z" fill="#2e7d32"/><path d="M0 0 C6 -8 16 -6 20 -2 C14 0 10 4 12 8 C6 4 2 4 0 0Z" fill="#388e3c"/><circle cx="-3" cy="1" r="3.4" fill="#e53935"/><circle cx="3" cy="2" r="3.4" fill="#c62828"/></g>`;
const bat = (x: number, y: number, c = '#1b1027') =>
  `<path class="sk-deco sk-flap" transform="translate(${x} ${y})" d="M0 2 C-3 -3 -8 -5 -14 -2 C-11 -1 -11 2 -12 4 C-8 2 -6 4 -4 6 C-3 3 -1 3 0 4 C1 3 3 3 4 6 C6 4 8 2 12 4 C11 2 11 -1 14 -2 C8 -5 3 -3 0 2Z" fill="${c}"/>`;
const moon = (x: number, y: number) =>
  `<path class="sk-deco" transform="translate(${x} ${y})" d="M4 -9 A10 10 0 1 0 4 9 A7.5 7.5 0 1 1 4 -9Z" fill="#ffe08a"/>`;
const shine = (r: number) => `<ellipse class="sk-deco" cx="${-r * 0.32}" cy="${-r * 0.42}" rx="${r * 0.32}" ry="${r * 0.16}" transform="rotate(-28 ${-r * 0.32} ${-r * 0.42})" fill="#fff" opacity=".55"/>`;

// ---------- The skins ----------

const SKINS: Record<string, Skin> = {
  wood: {
    set: 'staunton', disc: 'rings',
    defs: lin('sk-wood-w', ['#f6e2bb', '#e0b479', '#c98f4e']) + lin('sk-wood-b', ['#8a5a33', '#5a3519', '#341c0b']) + rad('sk-wood-d', ['#f7dcaa', '#dcae72', '#b87d40']),
    chess: [{ fill: url('sk-wood-w'), stroke: '#5b3a1c', sw: 3.5 }, { fill: url('sk-wood-b'), stroke: '#1d0f05', sw: 2.5 }],
    xq: { disc: [url('sk-wood-d'), url('sk-wood-d')], edge: ['#7b4a1e', '#7b4a1e'], ring: ['#a3281a', '#2b1a0e'], text: ['#a3281a', '#2b1a0e'] },
  },
  marble: {
    set: 'staunton', disc: 'circle',
    defs: lin('sk-marble-w', ['#ffffff', '#eef0f3', '#c9ced6'], 1, 1) + lin('sk-marble-b', ['#5b616b', '#2a2e35', '#0c0e11'], 1, 1) + rad('sk-marble-d', ['#ffffff', '#eceef2', '#c8cdd5']),
    chess: [{ fill: url('sk-marble-w'), stroke: '#6d737c', sw: 3 }, { fill: url('sk-marble-b'), stroke: '#000', sw: 2.5 }],
    xq: { disc: [url('sk-marble-d'), url('sk-marble-d')], edge: ['#8a9099', '#8a9099'], ring: ['#b3261e', '#30353d'], text: ['#b3261e', '#1f2328'] },
    deco: (game, side) => game === 'xq'
      ? '<path class="sk-deco" d="M-30 -18 C-12 -10 -8 6 12 10 C22 12 28 22 30 26" stroke="#9aa1ab" stroke-width="1.6" fill="none" opacity=".55"/>'
      : side ? '<path class="sk-deco" d="M-14 -14 C-4 -6 0 4 10 10" stroke="#9aa1ab" stroke-width="1.4" fill="none" opacity=".45"/>' : '',
  },
  bronze: {
    set: 'staunton', disc: 'coin',
    defs: lin('sk-bronze-w', ['#ffd9a8', '#d98c45', '#a75e24', '#e8a868']) + lin('sk-bronze-b', ['#7e9070', '#46553a', '#232c1b']) + rad('sk-bronze-d', ['#f6c38b', '#c27a38', '#8a4c1c']),
    chess: [{ fill: url('sk-bronze-w'), stroke: '#4f2a0e', sw: 3 }, { fill: url('sk-bronze-b'), stroke: '#121a0c', sw: 2.5 }],
    xq: { disc: [url('sk-bronze-d'), url('sk-bronze-d')], edge: ['#4f2a0e', '#4f2a0e'], edgeW: 4, ring: ['#6e0f0a', '#1d2414'], text: ['#6e0f0a', '#1d2414'] },
  },
  gold: {
    set: 'staunton', disc: 'medal',
    defs: lin('sk-gold-w', ['#fff6c2', '#f6cf4a', '#c9930f', '#f3d36b']) + lin('sk-gold-b', ['#454545', '#151515', '#000']) + rad('sk-gold-d', ['#fff3b0', '#e8b52c', '#a8740a']) + halo('sk-gold-h', '#ffd54a', 3),
    chess: [{ fill: url('sk-gold-w'), stroke: '#7a5200', sw: 3, filter: 'sk-gold-h' }, { fill: url('sk-gold-b'), stroke: '#e0b12a', sw: 3 }],
    xq: { disc: [url('sk-gold-d'), url('sk-gold-d')], edge: ['#6b4a00', '#6b4a00'], edgeW: 4, ring: ['#9b1010', '#1a1000'], text: ['#9b1010', '#1a1000'], discFilter: 'sk-gold-h' },
    fx: 'glow',
  },
  crystal: {
    set: 'geo', disc: 'gem',
    defs: lin('sk-crystal-w', ['#ffffff', '#e3f3ff', '#a9d4f5'], 1, 1) + lin('sk-crystal-b', ['#93a6c2', '#4a6080', '#1e2c40'], 1, 1) + rad('sk-crystal-d', ['#ffffff', '#dff1fd', '#a3cdee']) + halo('sk-crystal-h', '#9fd8ff', 3),
    chess: [{ fill: url('sk-crystal-w'), stroke: '#4f8cc4', sw: 3, filter: 'sk-crystal-h' }, { fill: url('sk-crystal-b'), stroke: '#b7d3f0', sw: 2.5, filter: 'sk-crystal-h' }],
    xq: { disc: [url('sk-crystal-d'), url('sk-crystal-d')], edge: ['#6aa7d8', '#6aa7d8'], ring: ['#c0392b', '#1b2a3a'], text: ['#c0392b', '#1b2a3a'], discFilter: 'sk-crystal-h' },
    deco: game => (game === 'xq' ? shine(44) : ''),
    fx: 'sparkle',
  },
  jade: {
    set: 'staunton', disc: 'octagon',
    defs: lin('sk-jade-w', ['#e3fbe9', '#8fd8a6', '#3e9c63']) + lin('sk-jade-b', ['#3f8a60', '#1b4a31', '#082015']) + rad('sk-jade-d', ['#d4f6dd', '#6cc18b', '#2f7a4c']),
    chess: [{ fill: url('sk-jade-w'), stroke: '#1f6b3d', sw: 3 }, { fill: url('sk-jade-b'), stroke: '#031109', sw: 2.5 }],
    xq: { disc: [url('sk-jade-d'), url('sk-jade-d')], edge: ['#1b5232', '#1b5232'], ring: ['#8a1111', '#0c2416'], text: ['#8a1111', '#0c2416'] },
    deco: game => (game === 'xq' ? shine(44) : ''),
  },
  neon: {
    set: 'geo', disc: 'rounded-square',
    defs: glow('sk-neon-g', 2.6),
    chess: [{ fill: '#0b1824', stroke: '#4df3ff', sw: 3.2, filter: 'sk-neon-g' }, { fill: '#1b0b24', stroke: '#ff4df0', sw: 3.2, filter: 'sk-neon-g' }],
    xq: { disc: ['#0e1420', '#0e1420'], edge: ['#ff5d7a', '#4df3ff'], edgeW: 3.5, ring: ['#ff5d7a', '#4df3ff'], text: ['#ff7b95', '#7af6ff'], filter: ['sk-neon-g', 'sk-neon-g'], discFilter: 'sk-neon-g' },
    fx: 'sparkle',
  },
  dragon: {
    set: 'staunton', disc: 'flame',
    defs: lin('sk-dragon-w', ['#fff3a6', '#ffa733', '#e8391c']) + lin('sk-dragon-b', ['#4a1212', '#1d0606', '#0a0202']) + rad('sk-dragon-r', ['#ffe08a', '#f2742a', '#a8200e']) + rad('sk-dragon-k', ['#5a1515', '#2a0808', '#0c0202']) + halo('sk-dragon-h', '#ff6a00', 3.5),
    chess: [{ fill: url('sk-dragon-w'), stroke: '#6e1000', sw: 3, filter: 'sk-dragon-h' }, { fill: url('sk-dragon-b'), stroke: '#ff7a1a', sw: 3, filter: 'sk-dragon-h' }],
    xq: { disc: [url('sk-dragon-r'), url('sk-dragon-k')], edge: ['#5c0a00', '#ff7a1a'], edgeW: 3.5, ring: ['#fff0c2', '#ff9a3c'], text: ['#5a0000', '#ffb347'], discFilter: 'sk-dragon-h' },
    fx: 'fire',
  },
  galaxy: {
    set: 'geo', disc: 'planet',
    defs: lin('sk-galaxy-w', ['#efe6ff', '#b7a6ff', '#7a62ff'], 1, 1) + lin('sk-galaxy-b', ['#3a1a78', '#1a0a42', '#06021a'], 1, 1) + rad('sk-galaxy-r', ['#9b7bff', '#4b2aa8', '#1e0b55']) + rad('sk-galaxy-k', ['#2c3f9e', '#111a5c', '#03061c']) + halo('sk-galaxy-h', '#a58bff', 3),
    chess: [{ fill: url('sk-galaxy-w'), stroke: '#2b1d6b', sw: 3, filter: 'sk-galaxy-h' }, { fill: url('sk-galaxy-b'), stroke: '#c3b2ff', sw: 2.5, filter: 'sk-galaxy-h' }],
    xq: { disc: [url('sk-galaxy-r'), url('sk-galaxy-k')], edge: ['#d7c9ff', '#a9c8ff'], ring: ['#ffd1f5', '#a8d8ff'], text: ['#ffe1f8', '#bfe4ff'], discFilter: 'sk-galaxy-h' },
    deco: game => (game === 'xq'
      ? sparkle(-24, -20, 4) + sparkle(26, 14, 3) + sparkle(14, -30, 2.5, '#ffe9ff')
      : sparkle(-26, -26, 4) + sparkle(28, -12, 3, '#ffe9ff')),
    fx: 'sparkle',
  },
  ink: {
    set: 'staunton', disc: 'enso',
    defs: `<filter id="sk-ink-r" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter>`,
    chess: [{ fill: '#f8f2e2', stroke: '#141414', sw: 4.5, filter: 'sk-ink-r' }, { fill: '#121212', stroke: '#121212', sw: 2.5, filter: 'sk-ink-r' }],
    xq: { disc: ['#f4ecd8', '#f4ecd8'], edge: ['#1a1a1a', '#1a1a1a'], edgeW: 5, ring: ['#b22222', '#1a1a1a'], text: ['#b22222', '#111'], discFilter: 'sk-ink-r', filter: ['sk-ink-r', 'sk-ink-r'] },
  },
  candy: {
    set: 'geo', disc: 'candy',
    defs: lin('sk-candy-w', ['#fff0f7', '#ffb3d9', '#ff7ab8']) + lin('sk-candy-b', ['#dcfff6', '#7fe6cf', '#22b394']) + rad('sk-candy-r', ['#fff2f8', '#ffb6da', '#ff86c0']) + rad('sk-candy-k', ['#e8fffa', '#93ecd8', '#3cc4a6']),
    chess: [{ fill: url('sk-candy-w'), stroke: '#c2185b', sw: 3 }, { fill: url('sk-candy-b'), stroke: '#0b6b58', sw: 3 }],
    xq: { disc: [url('sk-candy-r'), url('sk-candy-k')], edge: ['#fff', '#fff'], edgeW: 4, ring: ['#c2185b', '#0b6b58'], text: ['#b0124f', '#0b5e4e'] },
    deco: game => (game === 'xq' ? shine(44) : ''),
    fx: 'petals',
  },
  sakura: {
    set: 'staunton', disc: 'flower',
    defs: lin('sk-sakura-w', ['#fff7fa', '#ffd3e2', '#f59ab9']) + lin('sk-sakura-b', ['#6b4152', '#3a2230', '#1e1018']) + rad('sk-sakura-d', ['#fff4f8', '#ffd1e0', '#f3a6c0']),
    chess: [{ fill: url('sk-sakura-w'), stroke: '#a8335c', sw: 3 }, { fill: url('sk-sakura-b'), stroke: '#ffb7cf', sw: 2.5 }],
    xq: { disc: [url('sk-sakura-d'), url('sk-sakura-d')], edge: ['#d16b8f', '#d16b8f'], ring: ['#c2185b', '#3b2430'], text: ['#c2185b', '#3b2430'] },
    deco: game => (game === 'xq' ? '' : flower(26, -30, '#ffb7cf', '#ffe08a', 5)),
    fx: 'petals',
  },
  pumpkin: {
    set: 'halloween', disc: 'pumpkin',
    defs: lin('sk-pumpkin-w', ['#ffd28c', '#ff8c1a', '#cf4f00']) + lin('sk-pumpkin-b', ['#4a3370', '#24163d', '#0d0717']) + rad('sk-pumpkin-r', ['#ffc266', '#ff8a1a', '#c94a00']) + rad('sk-pumpkin-k', ['#55377d', '#2a1745', '#0f0819']) + halo('sk-pumpkin-g', '#7cff6b', 3) + halo('sk-pumpkin-o', '#ff9a1a', 3),
    chess: [{ fill: url('sk-pumpkin-w'), stroke: '#3d1a00', sw: 3, filter: 'sk-pumpkin-o' }, { fill: url('sk-pumpkin-b'), stroke: '#7cff6b', sw: 2.8, filter: 'sk-pumpkin-g' }],
    xq: { disc: [url('sk-pumpkin-r'), url('sk-pumpkin-k')], edge: ['#8a3300', '#7cff6b'], edgeW: 3.5, ring: ['#3b1300', '#9dff7a'], text: ['#3b1300', '#b4ff9c'], filter: [undefined, 'sk-pumpkin-g'] },
    deco: (game, side) => (game === 'xq' ? (side === 0 ? '<g class="sk-deco" fill="none" stroke="#b84400" stroke-width="2" opacity=".6"><ellipse rx="15" ry="40"/></g>' : bat(26, -36, '#9dff7a')) : ''),
    fx: 'spooky',
  },
  christmas: {
    set: 'christmas', disc: 'bauble',
    defs: lin('sk-xmas-w', ['#ffffff', '#f2f7fb', '#d7e4ee']) + lin('sk-xmas-b', ['#43a047', '#1f6b2a', '#0b3a12']) + rad('sk-xmas-r', ['#ff6b6b', '#d32f2f', '#8e1414']) + rad('sk-xmas-k', ['#4caf50', '#1e7a2c', '#0b3d14']),
    chess: [{ fill: url('sk-xmas-w'), stroke: '#c62828', sw: 3.5 }, { fill: url('sk-xmas-b'), stroke: '#f9d342', sw: 2.5 }],
    xq: { disc: [url('sk-xmas-r'), url('sk-xmas-k')], edge: ['#ffffff', '#ffffff'], edgeW: 4.5, ring: ['#ffe9a0', '#ffe9a0'], text: ['#ffffff', '#fff6c9'] },
    deco: game => (game === 'xq' ? holly(30, -30) : ''),
    fx: 'snow',
  },
  tet: {
    set: 'tet', disc: 'bagua',
    defs: lin('sk-tet-w', ['#ff7a66', '#e8261a', '#a90f06']) + lin('sk-tet-b', ['#fff0b0', '#f2c230', '#b88407']) + rad('sk-tet-r', ['#ff5c45', '#d11a0c', '#8f0a03']) + rad('sk-tet-k', ['#fff1b8', '#f0c13a', '#b5860b']) + halo('sk-tet-h', '#ffd54f', 2.5),
    chess: [{ fill: url('sk-tet-w'), stroke: '#ffd54f', sw: 3.2, filter: 'sk-tet-h' }, { fill: url('sk-tet-b'), stroke: '#7a4b00', sw: 2.5 }],
    xq: { disc: [url('sk-tet-r'), url('sk-tet-k')], edge: ['#ffd54f', '#8a5a00'], edgeW: 4, ring: ['#ffe9a0', '#8a1c00'], text: ['#ffe9a0', '#7a1500'] },
    deco: (game, side) => (game === 'xq' ? (side === 0 ? flower(29, -29, '#ffd23f', '#e65100', 5.5) : flower(29, -29, '#ff9ec0', '#c2185b', 5.5)) : ''),
    fx: 'petals',
  },
  lantern: {
    set: 'midautumn', disc: 'lantern',
    defs: lin('sk-lantern-w', ['#fff6d0', '#ffcf5a', '#f08a00']) + lin('sk-lantern-b', ['#33447a', '#18224a', '#070b22']) + rad('sk-lantern-r', ['#fff0b8', '#ffb43b', '#e06a00']) + rad('sk-lantern-k', ['#34488a', '#16205a', '#060a24']) + halo('sk-lantern-h', '#ffc14d', 4),
    chess: [{ fill: url('sk-lantern-w'), stroke: '#9a4a00', sw: 3, filter: 'sk-lantern-h' }, { fill: url('sk-lantern-b'), stroke: '#ffd27a', sw: 2.6 }],
    xq: { disc: [url('sk-lantern-r'), url('sk-lantern-k')], edge: ['#a34700', '#ffd27a'], edgeW: 3.5, ring: ['#8a1c00', '#ffe08a'], text: ['#7a1800', '#ffe08a'], discFilter: 'sk-lantern-h' },
    deco: (game, side) => (game === 'xq' && side === 1 ? moon(30, -26) : ''),
    fx: 'glow',
  },
};

export const hasSkin = (id: string | null | undefined): id is string => !!id && id in SKINS;

/** <defs> for the skins in use (each skin's ids are unique). */
export function skinDefs(ids: (string | null | undefined)[]): string {
  const used = [...new Set(ids.filter(hasSkin))];
  return used.length ? `<defs>${used.map(id => SKINS[id].defs).join('')}</defs>` : '';
}

const filt = (id?: string) => (id ? `filter:url(#${id});` : '');

/** A skinned chess piece: the skin's own piece shape, plus its decoration. */
export function chessPiece(id: string, side: 0 | 1, type: number, peek = false): string {
  const sk = SKINS[id], st = sk.chess[side];
  const shape = chessShape(sk.set, type, { fill: st.fill, stroke: st.stroke, sw: Math.max(2, st.sw * 0.85), detail: st.stroke, filter: st.filter });
  return `<g class="cp-shape ${side ? 'b' : 'w'}${peek ? ' peek' : ''}">${shape}${sk.deco?.('chess', side) ?? ''}</g>`;
}

/** A skinned xiangqi disc: disc, ring, label and decoration. */
export function xqPiece(id: string, side: 0 | 1, label: string, textCls: string, textY: number, peek = false): string {
  const sk = SKINS[id], x = sk.xq;
  const textStroke = x.textStroke ? `stroke:${x.textStroke[side]};stroke-width:1.5px;paint-order:stroke;` : '';
  const shape = discShape(sk.disc, x.ring[side]);
  const paint = `fill:${x.disc[side]};stroke:${x.edge[side]};stroke-width:${x.edgeW ?? 3}px;`;
  return `<g class="xq-shape-back" style="${paint}">${shape.back}</g>`
    + `<g class="xq-disc sk${peek ? ' peek' : ''}" style="${paint}${filt(x.discFilter)}">${shape.disc}</g>`
    + shape.front
    + (sk.disc === 'enso' ? '' : `<circle class="xq-ring" r="37" style="stroke:${x.ring[side]}"/>`)
    + `<text class="${textCls}" y="${textY}" style="fill:${x.text[side]};${textStroke}${filt(x.filter?.[side])}">${label}</text>`
    + (sk.deco?.('xq', side) ?? '');
}

export const skinFx = (id: string | null | undefined): Fx | null => (hasSkin(id) ? SKINS[id].fx ?? null : null);

/** Burst drawn where a skinned piece captures (CSS animates and fades it). */
export function fxBurst(fx: Fx, x: number, y: number): string {
  const n = 10;
  const bits = Array.from({ length: n }, (_, i) => {
    const a = (360 / n) * i + (i % 2 ? 12 : 0);
    const d = 34 + (i % 3) * 12;
    const shape = fx === 'snow' ? `<path d="M0 -5V5M-5 0H5M-3.5 -3.5L3.5 3.5M-3.5 3.5L3.5 -3.5" stroke="#fff" stroke-width="1.6"/>`
      : fx === 'petals' ? `<ellipse rx="5" ry="3" fill="${i % 2 ? '#ffb7cf' : '#ffd23f'}"/>`
      : fx === 'sparkle' ? sparkle(0, 0, 5, i % 2 ? '#fff' : '#c9b8ff')
      : fx === 'spooky' ? `<circle r="4" fill="${i % 2 ? '#9dff7a' : '#b17cff'}"/>`
      : fx === 'glow' ? `<circle r="4" fill="${i % 2 ? '#ffe08a' : '#fff6cf'}"/>`
      : `<circle r="${4 + (i % 3)}" fill="${['#ffd54a', '#ff8a1a', '#ff3d00'][i % 3]}"/>`;
    return `<g class="fx-bit" style="--a:${a}deg;--d:${d}px;--delay:${(i % 4) * 25}ms">${shape}</g>`;
  }).join('');
  return `<g class="fx fx-${fx}" transform="translate(${x} ${y})"><circle class="fx-ring" r="30"/>${bits}</g>`;
}

/** Two sample pieces (one per side) for the shop and the quest rewards. */
export function skinPreview(id: string | null, game: 'chess' | 'xq'): string {
  const defs = id ? skinDefs([id]) : '';
  if (game === 'chess') {
    const p = (side: 0 | 1, type: number, glyph: string, x: number) => `<g transform="translate(${x} 57)">${id && hasSkin(id) ? chessPiece(id, side, type) : `<text class="cp ${side ? 'b' : 'w'}" y="4">${glyph}</text>`}</g>`;
    return `<svg viewBox="0 0 300 110" class="skin-prev" aria-hidden="true">${defs}${p(0, 6, '♚︎', 50)}${p(1, 5, '♛︎', 150)}${p(0, 2, '♞︎', 250)}</svg>`;
  }
  const p = (side: 0 | 1, label: string, x: number) => `<g transform="translate(${x} 55)">${id && hasSkin(id) ? xqPiece(id, side, label, `xq-t ${side ? 'b' : 'r'}`, 3)
    : `<circle class="xq-disc" r="44"/><circle class="xq-ring ${side ? 'b' : 'r'}" r="37"/><text class="xq-t ${side ? 'b' : 'r'}" y="3">${label}</text>`}</g>`;
  return `<svg viewBox="-12 -10 224 130" class="skin-prev" aria-hidden="true">${defs}${p(0, '帥', 52)}${p(1, '將', 148)}</svg>`;
}
