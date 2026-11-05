/**
 * Hand-drawn chess piece shapes for skins (original artwork, built from
 * simple SVG shapes in a 100×100 box, base at the bottom). Every set keeps
 * the six piece types easy to tell apart: pawn small and round, rook a
 * tower, bishop tall and pointed, knight an animal head, queen and king the
 * tallest, the king topped by a cross or its own headgear.
 */

export type ChessSet = 'staunton' | 'geo' | 'halloween' | 'christmas' | 'tet' | 'midautumn';
/** Engine piece types: 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king. */
type PieceType = 1 | 2 | 3 | 4 | 5 | 6;

export interface Paint { fill: string; stroke: string; sw: number; detail: string; filter?: string }

// ---------- tiny shape helpers (body shapes take the piece paint) ----------

const P = (d: string) => `<path d="${d}"/>`;
const C = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const E = (cx: number, cy: number, rx: number, ry: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
const R = (x: number, y: number, w: number, h: number, r = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
/** Detail lines / marks in the set's detail colour. */
const line = (d: string, c: string, w = 2.6) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const dot = (cx: number, cy: number, r: number, c: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" stroke="none"/>`;
const fixed = (inner: string, fill: string, stroke = 'none', w = 0) => `<g fill="${fill}" stroke="${stroke}" stroke-width="${w}">${inner}</g>`;

const star = (cx: number, cy: number, r: number, inner = 0.45) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * inner : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}"/>`;
};

// Shared silhouettes
const KNIGHT = 'M30 78 L31 68 C32 58 38 52 45 46 C39 46 33 49 28 52 C23 49 22 43 26 38 C32 30 40 22 47 16 L49 9 L55 15 C67 18 75 30 76 46 C77 60 73 70 71 78 Z';
const knightEye = (c: string) => dot(50, 27, 2.6, c) + line('M60 19 C67 27 70 38 70 52', c, 2.2);
const baseStaunton = R(22, 84, 56, 8, 4) + R(28, 77, 44, 8, 3);
const baseSmall = R(30, 84, 40, 8, 4);

// ---------- Classic carved set ----------

function staunton(t: PieceType, k: Paint): string {
  switch (t) {
    case 1: return baseStaunton + P('M37 78 C37 66 44 60 44 53 H56 C56 60 63 66 63 78Z') + R(38, 48, 24, 6, 3) + C(50, 37, 12);
    case 4: return baseStaunton + P('M34 78 L37 44 H63 L66 78Z') + R(32, 39, 36, 6, 2) + P('M30 40 V22 H38 V29 H45 V22 H55 V29 H62 V22 H70 V40Z');
    case 3: return baseStaunton + P('M38 78 C40 66 45 60 45 54 H55 C55 60 60 66 62 78Z') + R(37, 49, 26, 6, 3)
      + P('M50 15 C62 27 64 39 58 49 H42 C36 39 38 27 50 15Z') + line('M55 26 L45 38', k.detail, 3) + C(50, 13, 4);
    case 2: return baseStaunton + P(KNIGHT) + knightEye(k.detail);
    case 5: return baseStaunton + P('M34 78 C38 62 42 52 41 40 H59 C58 52 62 62 66 78Z') + R(36, 37, 28, 6, 3)
      + P('M32 38 L36 18 L43 30 L50 13 L57 30 L64 18 L68 38Z') + C(36, 17, 3.5) + C(50, 11, 3.5) + C(64, 17, 3.5);
    case 6: return baseStaunton + P('M35 78 C39 62 43 52 42 42 H58 C57 52 61 62 65 78Z') + R(36, 39, 28, 6, 3)
      + P('M34 40 C33 30 38 26 50 28 C62 26 67 30 66 40Z') + R(47, 6, 6, 22, 1.5) + R(40, 11, 20, 6, 1.5);
  }
}

// ---------- Modern geometric set ----------

function geo(t: PieceType, k: Paint): string {
  const base = R(26, 80, 48, 11, 3);
  switch (t) {
    case 1: return base + P('M38 80 L46 52 H54 L62 80Z') + C(50, 41, 12);
    case 4: return base + P('M34 80 L38 34 H62 L66 80Z') + P('M33 35 V16 H41 V23 H47 V16 H53 V23 H59 V16 H67 V35Z');
    case 3: return base + P('M36 80 L50 12 L64 80Z') + line('M56 34 L46 50', k.detail, 3.2);
    case 2: return base + P('M32 80 L36 60 L46 44 L30 40 L28 32 L46 14 L54 10 L56 18 L70 28 L74 46 L68 80Z') + dot(50, 26, 2.8, k.detail);
    case 5: return base + P('M34 80 L40 38 L30 16 L42 28 L50 10 L58 28 L70 16 L60 38 L66 80Z') + line('M40 54 H60', k.detail, 2.4);
    case 6: return base + P('M36 80 L42 36 H58 L64 80Z') + R(36, 28, 28, 9, 2) + R(47, 6, 6, 22, 1) + R(41, 11, 18, 5, 1);
  }
}

export function chessShape(set: ChessSet, type: number, k: Paint): string {
  const t = type as PieceType;
  const inner = set === 'staunton' ? staunton(t, k) : set === 'geo' ? geo(t, k) : HOLIDAY[set](t, k);
  return `<g class="shape" transform="translate(-56 -59) scale(1.12)" style="fill:${k.fill};stroke:${k.stroke};stroke-width:${k.sw}px;stroke-linejoin:round;${k.filter ? `filter:url(#${k.filter});` : ''}">${inner}</g>`;
}

// Holiday sets are defined below (kept apart: they carry their own accent colours).
const HOLIDAY: Record<'halloween' | 'christmas' | 'tet' | 'midautumn', (t: PieceType, k: Paint) => string> = {
  halloween: (t, k) => halloween(t, k),
  christmas: (t, k) => christmas(t, k),
  tet: (t, k) => tet(t, k),
  midautumn: (t, k) => midautumn(t, k),
};

// ---------- 🎃 Halloween ----------

function halloween(t: PieceType, k: Paint): string {
  const glowEye = k.detail;
  switch (t) {
    case 1: // jack-o'-lantern
      return baseSmall + E(39, 62, 12, 17) + E(61, 62, 12, 17) + E(50, 62, 14, 19)
        + fixed(P('M48 44 C47 38 49 34 54 31 L56 34 C52 36 51 40 52 44Z'), '#3e7d1e')
        + fixed(P('M40 57 L45 52 L47 59Z M60 57 L55 52 L53 59Z M38 68 L43 72 L47 68 L50 72 L53 68 L57 72 L62 68 C58 76 42 76 38 68Z'), glowEye);
    case 4: // haunted tower
      return baseStaunton + P('M33 78 L35 34 H65 L67 78Z') + P('M31 36 V18 H38 V25 H45 V18 H55 V25 H62 V18 H69 V36Z')
        + fixed(P('M44 64 V54 C44 48 56 48 56 54 V64Z'), glowEye) + fixed(P('M38 44 h5 v6 h-5Z M57 44 h5 v6 h-5Z'), glowEye);
    case 3: // ghost
      return baseSmall + P('M32 82 V44 C32 22 68 22 68 44 V82 L62 76 L56 82 L50 76 L44 82 L38 76Z')
        + fixed(E(43, 44, 3.6, 5.5) + E(57, 44, 3.6, 5.5) + E(50, 58, 4, 5), glowEye);
    case 2: // knight in a witch hat
      return baseStaunton + P(KNIGHT) + knightEye(glowEye)
        + fixed(P('M38 22 L58 18 L44 0 Z') + E(48, 21, 15, 4), '#2a1745', '#9dff7a', 1.6);
    case 5: // witch
      return baseStaunton + P('M34 78 C40 60 44 52 44 44 H56 C56 52 60 60 66 78Z') + C(50, 36, 10)
        + fixed(P('M36 30 L64 30 L56 24 L50 2 L45 24Z') + E(50, 30, 18, 4), '#2a1745', '#9dff7a', 1.6)
        + dot(46, 36, 1.8, glowEye) + dot(54, 36, 1.8, glowEye);
    case 6: // vampire king
      return baseStaunton + P('M30 78 C36 60 42 52 42 44 H58 C58 52 64 60 70 78Z') + P('M30 50 L42 40 L50 48 L58 40 L70 50 L60 50 L50 58 L40 50Z')
        + C(50, 33, 10) + P('M39 26 L41 12 L45 20 L50 9 L55 20 L59 12 L61 26Z') + R(48, 0, 4, 11, 1) + R(44, 3, 12, 4, 1)
        + fixed(P('M46 37 L47 41 L48 37Z M52 37 L53 41 L54 37Z'), '#fff') + dot(46, 32, 1.6, glowEye) + dot(54, 32, 1.6, glowEye);
  }
}

// ---------- 🎄 Christmas ----------

function christmas(t: PieceType, k: Paint): string {
  const snow = (d: string) => fixed(P(d), '#ffffff', '#cfd8e3', 1);
  switch (t) {
    case 1: // bauble
      return baseSmall + C(50, 58, 20) + fixed(R(44, 32, 12, 8, 2), '#f9d342', '#8a6d00', 1.2)
        + line('M47 32 C45 26 55 26 53 32', '#8a6d00', 2) + line('M31 56 C42 62 58 62 69 56', k.detail, 3) + dot(43, 50, 3, '#ffffff');
    case 4: // chimney with snow
      return baseStaunton + P('M33 78 V30 H67 V78Z') + line('M33 44 H67 M33 58 H67 M45 30 V44 M57 44 V58 M45 58 V72', k.detail, 2)
        + snow('M29 32 C29 22 71 22 71 32 C66 36 62 30 57 35 C52 30 47 36 42 31 C37 36 33 30 29 32Z');
    case 3: // fir tree
      return baseSmall + fixed(R(45, 74, 10, 10, 1), '#6d4c2e')
        + P('M50 14 L70 46 H60 L74 70 H26 L40 46 H30Z') + fixed(star(50, 12, 8), '#f9d342', '#8a6d00', 1)
        + dot(44, 40, 2.6, '#e53935') + dot(58, 56, 2.6, '#f9d342') + dot(40, 62, 2.6, '#42a5f5');
    case 2: // reindeer
      return baseStaunton + P(KNIGHT) + knightEye(k.detail)
        + line('M44 16 C40 8 34 6 30 2 M38 9 L32 12 M54 14 C58 6 64 4 66 0 M60 8 L66 10', '#7b5534', 3.2) + dot(26, 42, 4, '#e53935');
    case 5: // queen with star crown
      return baseStaunton + P('M34 78 C38 62 42 52 41 40 H59 C58 52 62 62 66 78Z') + R(36, 37, 28, 6, 3)
        + fixed(star(50, 22, 15, 0.5), '#f9d342', '#8a6d00', 1.4) + snow('M34 41 C40 37 60 37 66 41 C60 45 40 45 34 41Z');
    case 6: // king with a Santa hat crown
      return baseStaunton + P('M35 78 C39 62 43 52 42 42 H58 C57 52 61 62 65 78Z')
        + fixed(P('M34 38 C36 20 52 8 66 16 C58 18 60 28 66 38Z'), '#d62828', '#7a0f0f', 1.4)
        + snow('M32 37 C40 33 60 33 68 37 C68 43 32 43 32 37Z') + fixed(C(66, 16, 6), '#ffffff', '#cfd8e3', 1)
        + fixed(R(63.5, 2, 5, 10, 1) + R(61, 4.5, 10, 4, 1), '#f9d342', '#8a6d00', 1);
  }
}

// ---------- 🧧 Tết ----------

function tet(t: PieceType, k: Paint): string {
  const gold = '#ffd54f', red = '#d32f2f';
  switch (t) {
    case 1: // lucky coin on a stand
      return baseSmall + R(44, 74, 12, 12, 2) + C(50, 54, 22) + fixed(R(43, 47, 14, 14, 1), 'none', k.detail, 3) + line('M50 34 V38 M50 70 V74 M30 54 H34 M66 54 H70', k.detail, 2.4);
    case 4: // pagoda
      return baseStaunton + R(38, 58, 24, 20) + P('M26 60 C36 56 64 56 74 60 L68 52 H32Z') + R(40, 38, 20, 14)
        + P('M28 40 C38 36 62 36 72 40 L66 32 H34Z') + R(43, 22, 14, 10) + P('M32 24 C40 20 60 20 68 24 L60 14 H40Z') + R(48, 4, 4, 10)
        + fixed(R(46, 64, 8, 14, 1), k.detail);
    case 3: // firecracker
      return baseSmall + R(38, 26, 24, 58, 5) + fixed(R(38, 36, 24, 4) + R(38, 68, 24, 4), gold, 'none') + line('M50 26 C50 18 56 16 54 8', k.detail, 2.4)
        + fixed(star(55, 7, 6, 0.4), gold, '#e65100', 1);
    case 2: // horse with a red ribbon
      return baseStaunton + P(KNIGHT) + knightEye(k.detail) + fixed(P('M40 48 C48 52 60 52 70 46 L72 52 C62 58 48 58 38 54Z'), red, gold, 1.2) + fixed(C(56, 55, 4), gold);
    case 5: // queen crowned with an apricot blossom
      return baseStaunton + P('M34 78 C38 62 42 52 41 40 H59 C58 52 62 62 66 78Z') + R(36, 37, 28, 6, 3)
        + fixed([0, 1, 2, 3, 4].map(i => { const a = (i * 72 - 90) * Math.PI / 180; return C(+(50 + Math.cos(a) * 10).toFixed(1), +(22 + Math.sin(a) * 10).toFixed(1), 7.5); }).join(''), gold, '#e65100', 1.2)
        + fixed(C(50, 22, 4.5), '#e65100');
    case 6: // king in a mandarin hat (mũ cánh chuồn)
      return baseStaunton + P('M35 78 C39 62 43 52 42 42 H58 C57 52 61 62 65 78Z') + R(36, 39, 28, 6, 3)
        + fixed(P('M38 40 C38 24 62 24 62 40Z') + R(36, 36, 28, 5, 2), '#1b1b1b', gold, 1.4)
        + fixed(E(28, 30, 10, 4) + E(72, 30, 10, 4), '#1b1b1b', gold, 1.4) + fixed(C(50, 26, 3.5), gold);
  }
}

// ---------- 🏮 Mid-Autumn ----------

function midautumn(t: PieceType, k: Paint): string {
  const tassel = (x: number, y: number) => line(`M${x} ${y} V${y + 8}`, '#d32f2f', 2.4) + dot(x, y + 9, 2.4, '#d32f2f');
  switch (t) {
    case 1: // round lantern
      return E(50, 52, 20, 18) + R(42, 30, 16, 6, 2) + R(42, 68, 16, 6, 2) + line('M40 38 C36 46 36 58 40 66 M60 38 C64 46 64 58 60 66 M50 34 V70', k.detail, 1.8) + tassel(50, 74) + line('M50 30 V22', k.detail, 2);
    case 4: // square lantern tower
      return baseStaunton + R(34, 30, 32, 44, 3) + R(30, 24, 40, 8, 2) + R(30, 72, 40, 6, 2) + line('M42 30 V74 M58 30 V74 M34 52 H66', k.detail, 1.8) + R(46, 14, 8, 10, 2);
    case 3: // star lantern on a stick
      return baseSmall + line('M50 46 V84', '#8d6e63', 4) + star(50, 32, 22, 0.48) + dot(50, 32, 4, k.detail);
    case 2: // jade rabbit
      return baseStaunton + P('M30 78 C30 62 36 54 44 50 C34 50 28 44 30 36 C32 28 40 26 48 28 L44 6 C44 2 50 2 51 6 L54 26 L58 6 C59 2 65 2 64 6 L60 30 C70 34 74 46 74 56 C74 66 71 72 70 78Z')
        + dot(45, 37, 2.6, k.detail) + dot(30, 41, 2.2, '#f48fb1');
    case 5: // moon lady
      return baseStaunton + P('M32 78 C38 60 44 52 44 44 H56 C56 52 62 60 68 78Z') + C(50, 36, 9)
        + fixed(P('M58 6 A14 14 0 1 0 58 30 A10 10 0 1 1 58 6Z'), '#ffe08a', '#b38600', 1.2) + line('M38 58 C46 62 54 62 62 58', k.detail, 2);
    case 6: // king under the full moon
      return fixed(C(50, 20, 17), '#ffe08a', '#b38600', 1) + baseStaunton + P('M35 78 C39 62 43 52 42 42 H58 C57 52 61 62 65 78Z') + R(36, 39, 28, 6, 3)
        + P('M34 40 C33 30 38 26 50 28 C62 26 67 30 66 40Z') + R(47, 8, 6, 20, 1.5) + R(40, 13, 20, 6, 1.5);
  }
}

// ---------- Xiangqi disc outlines ----------

export type DiscShape = 'circle' | 'rings' | 'coin' | 'medal' | 'gem' | 'octagon' | 'rounded-square' | 'flame' | 'planet' | 'enso' | 'candy'
  | 'flower' | 'pumpkin' | 'bauble' | 'bagua' | 'lantern';

const poly = (n: number, r: number, rot = 0, cut = 1) => {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + rot;
    pts.push(`${(Math.cos(a) * r * cut).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
};
const bumps = (n: number, r: number, depth: number) => {
  let d = '';
  for (let i = 0; i <= n * 4; i++) {
    const a = (Math.PI * 2 * i) / (n * 4);
    const rr = r - depth + depth * Math.abs(Math.cos((a * n) / 2));
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + 'Z';
};

/** Disc outline (shape element without paint) plus extra pieces drawn behind / on top, centre 0,0, radius about 44. */
export function discShape(shape: DiscShape, detail: string): { back: string; disc: string; front: string } {
  switch (shape) {
    case 'rings': return { back: '', disc: '<circle r="44"/>', front: `<g fill="none" stroke="${detail}" stroke-width="1.2" opacity=".35"><circle r="40"/><circle r="31" cx="1" cy="-1"/></g>` };
    case 'coin': return { back: '', disc: '<circle r="45"/>', front: `<g fill="${detail}" opacity=".45">${Array.from({ length: 24 }, (_, i) => { const a = (Math.PI * 2 * i) / 24; return `<circle cx="${(Math.cos(a) * 41).toFixed(1)}" cy="${(Math.sin(a) * 41).toFixed(1)}" r="1.6"/>`; }).join('')}</g>` };
    case 'medal': return { back: '', disc: `<path d="${bumps(14, 47, 4)}"/>`, front: '' };
    case 'gem': return { back: '', disc: `<polygon points="${poly(8, 47, Math.PI / 8)}"/>`, front: `<g fill="none" stroke="#fff" stroke-width="1.3" opacity=".5"><polygon points="${poly(8, 33, Math.PI / 8)}"/><path d="M-17 -40 L-12 -31 M17 -40 L12 -31 M40 -17 L31 -12 M40 17 L31 12"/></g>` };
    case 'octagon': return { back: '', disc: `<polygon points="${poly(8, 46, Math.PI / 8)}" stroke-linejoin="round"/>`, front: '' };
    case 'rounded-square': return { back: '', disc: '<rect x="-41" y="-41" width="82" height="82" rx="18"/>', front: '' };
    case 'flame': return { back: '', disc: `<path d="${bumps(12, 48, 7)}"/>`, front: '' };
    case 'planet': return { back: `<ellipse rx="56" ry="13" transform="rotate(-18)" fill="none" stroke="${detail}" stroke-width="5" opacity=".75"/>`, disc: '<circle r="43"/>', front: `<path d="M-53 6 A56 13 0 0 0 53 -6" transform="rotate(-18)" fill="none" stroke="${detail}" stroke-width="5" opacity=".75"/>` };
    case 'enso': return { back: '', disc: '<circle r="44"/>', front: `<path d="M30 -32 A44 44 0 1 0 40 18" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round" opacity=".85"/>` };
    case 'candy': return { back: `<path d="M-40 0 L-58 -16 L-54 0 L-58 16Z M40 0 L58 -16 L54 0 L58 16Z" stroke-linejoin="round"/>`, disc: '<circle r="42"/>', front: '' };
    case 'flower': return { back: '', disc: `<path d="${Array.from({ length: 5 }, (_, i) => { const a = ((i * 72 - 90) * Math.PI) / 180; const x = Math.cos(a) * 24, y = Math.sin(a) * 24; return `M${(x + 22).toFixed(1)} ${y.toFixed(1)} A22 22 0 1 0 ${(x - 22).toFixed(1)} ${y.toFixed(1)} A22 22 0 1 0 ${(x + 22).toFixed(1)} ${y.toFixed(1)}Z`; }).join('')}"/><circle r="30"/>`, front: '' };
    case 'pumpkin': return { back: '', disc: '<ellipse cx="-17" rx="28" ry="40"/><ellipse cx="17" rx="28" ry="40"/><ellipse rx="30" ry="43"/>', front: `<path d="M-2 -42 C-3 -50 2 -56 8 -58 L10 -54 C5 -52 4 -48 4 -42Z" fill="#3e7d1e" stroke="none"/>` };
    case 'bauble': return { back: `<rect x="-10" y="-52" width="20" height="10" rx="2" fill="#f9d342" stroke="#8a6d00" stroke-width="1.5"/><path d="M-4 -52 C-6 -60 6 -60 4 -52" fill="none" stroke="#8a6d00" stroke-width="2"/>`, disc: '<circle r="44"/>', front: '' };
    case 'bagua': return { back: '', disc: `<polygon points="${poly(8, 47, Math.PI / 8)}"/>`, front: `<polygon points="${poly(8, 40, Math.PI / 8)}" fill="none" stroke="${detail}" stroke-width="2"/>` };
    case 'lantern': return { back: `<rect x="-16" y="-50" width="32" height="10" rx="3" fill="#b71c1c"/><rect x="-16" y="40" width="32" height="10" rx="3" fill="#b71c1c"/><path d="M0 50 V60" stroke="#d32f2f" stroke-width="3"/><circle cy="62" r="3" fill="#d32f2f"/>`, disc: '<ellipse rx="48" ry="42"/>', front: `<g fill="none" stroke="${detail}" stroke-width="1.4" opacity=".45"><path d="M-24 -36 C-34 -12 -34 12 -24 36 M24 -36 C34 -12 34 12 24 36"/></g>` };
    default: return { back: '', disc: '<circle r="44"/>', front: '' };
  }
}
