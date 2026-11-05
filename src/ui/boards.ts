/**
 * Holiday boards: colours come from CSS variables (svg.board[data-theme]),
 * decorations are drawn here, under the pieces and kept faint so the game
 * stays easy to read. Chess board 800×800; xiangqi 940×1040 with the grid
 * from (70,70) to (870,970) and the river between y = 470 and 570.
 */
import type { Theme } from '../sound';

const g = (inner: string, attrs = '') => `<g class="bd-deco" ${attrs}>${inner}</g>`;

function cobweb(x: number, y: number, sx: number, sy: number, r: number, c = '#fff', o = 0.32): string {
  const rays = [0, 22, 45, 68, 90].map(a => {
    const t = (a * Math.PI) / 180;
    return `M0 0 L${(Math.cos(t) * r).toFixed(1)} ${(Math.sin(t) * r).toFixed(1)}`;
  }).join('');
  const arcs = [0.35, 0.6, 0.85].map(f => {
    const rr = r * f;
    const pts = [0, 22, 45, 68, 90].map(a => { const t = (a * Math.PI) / 180; return [Math.cos(t) * rr, Math.sin(t) * rr]; });
    return 'M' + pts.map(([px, py], i) => (i ? `Q${(((pts[i - 1][0] + px) / 2) * 0.86).toFixed(1)} ${(((pts[i - 1][1] + py) / 2) * 0.86).toFixed(1)} ` : '') + `${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  }).join('');
  return `<path transform="translate(${x} ${y}) scale(${sx} ${sy})" d="${rays}${arcs}" fill="none" stroke="${c}" stroke-width="1.6" opacity="${o}"/>`;
}

const batShape = (x: number, y: number, s: number, c = '#1b1027', o = 0.28) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 2 C-3 -3 -8 -5 -14 -2 C-11 -1 -11 2 -12 4 C-8 2 -6 4 -4 6 C-3 3 -1 3 0 4 C1 3 3 3 4 6 C6 4 8 2 12 4 C11 2 11 -1 14 -2 C8 -5 3 -3 0 2Z" fill="${c}" opacity="${o}"/>`;
/** A pumpkin; `lit` carves a jack-o'-lantern face glowing from a flickering candle inside. */
const pumpkin = (x: number, y: number, s: number, lit = false) => `<g transform="translate(${x} ${y}) scale(${s})">`
  + (lit ? `<circle class="bd-flicker" r="24" fill="url(#bd-candle)" style="${phase(2.3, x + y)}"/>` : '')
  + `<ellipse cx="-7" rx="9" ry="11" fill="#c95a12"/><ellipse cx="7" rx="9" ry="11" fill="#c95a12"/><ellipse rx="10" ry="12" fill="#e8741c"/><path d="M0 -12 C0 -16 2 -18 5 -19" stroke="#3e5d1e" stroke-width="3" fill="none"/>`
  + (lit
    ? `<path class="bd-flicker" style="${phase(1.7, x)}" d="M-7 -2 L-3 -7 L-1 -1Z M7 -2 L3 -7 L1 -1Z M-7 3 L-4 6 L-2 4 L0 7 L2 4 L4 6 L7 3 Q0 11 -7 3Z" fill="#ffd54f"/>`
    : `<path d="M-6 -3 L-3 -6 L-2 -2Z M6 -3 L3 -6 L2 -2Z M-6 4 Q0 9 6 4" fill="#3b1300"/>`)
  + `</g>`;
const snowflake = (x: number, y: number, s: number, o = 0.5, c = '#fff') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10V10M-10 0H10M-7 -7L7 7M-7 7L7 -7M0 -10L-3 -7M0 -10L3 -7M0 10L-3 7M0 10L3 7" stroke="${c}" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="${o}"/>`;
const holly = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C-6 -8 -16 -6 -20 -2 C-14 0 -10 4 -12 8 C-6 4 -2 4 0 0Z" fill="#2e7d32"/><path d="M0 0 C6 -8 16 -6 20 -2 C14 0 10 4 12 8 C6 4 2 4 0 0Z" fill="#388e3c"/><circle cx="-3" cy="1" r="3.4" fill="#e53935"/><circle cx="3" cy="2" r="3.4" fill="#c62828"/></g>`;
const tree = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="10" width="6" height="7" fill="#6d4c2e"/><path d="M0 -18 L12 2 H6 L14 12 H-14 L-6 2 H-12Z" fill="#2e6b4a"/><path d="M-5 -9 L0 -18 L5 -9 Q0 -6 -5 -9Z M-11 2 Q-4 -1 0 1 Q5 -1 11 2 L8 4 Q0 2 -8 4Z M-13 12 Q-5 8 0 10 Q6 8 13 12 L10 13 Q0 11 -10 13Z" fill="#fff"/><circle cy="-19" r="3" fill="#f9d342"/><circle cx="-4" cy="2" r="1.8" fill="#e53935"/><circle cx="5" cy="8" r="1.8" fill="#42a5f5"/></g>`;
const snowDrift = (x0: number, x1: number, y: number, o = 0.85) =>
  `<path d="M${x0} ${y} C${x0 + 80} ${y - 16} ${x0 + 160} ${y + 4} ${x0 + 240} ${y - 10} S${x1 - 160} ${y - 14} ${x1} ${y - 4} V${y + 30} H${x0}Z" fill="#fff" opacity="${o}"/>`;
const blossom = (x: number, y: number, r: number, petal: string, heart: string) =>
  `<g transform="translate(${x} ${y})">${[0, 1, 2, 3, 4].map(i => { const a = ((i * 72 - 90) * Math.PI) / 180; return `<circle cx="${(Math.cos(a) * r).toFixed(1)}" cy="${(Math.sin(a) * r).toFixed(1)}" r="${(r * 0.8).toFixed(1)}" fill="${petal}"/>`; }).join('')}<circle r="${(r * 0.55).toFixed(1)}" fill="${heart}"/></g>`;
/** A blossoming branch from a corner. `dir` mirrors it. */
function branch(x: number, y: number, dx: number, dy: number, petal: string, heart: string, len = 220): string {
  const p = (t: number, off = 0) => [x + dx * len * t + off * dy, y + dy * len * t * 0.55 - off * dx];
  const [ax, ay] = p(0.5, 22), [bx, by] = p(1, 6);
  const flowers = [[0.25, 14], [0.42, -16], [0.6, 18], [0.78, -10], [0.95, 8], [0.55, 34]].map(([t, o], i) => {
    const [fx, fy] = p(t, o);
    return blossom(+fx.toFixed(1), +fy.toFixed(1), i % 2 ? 7 : 9, petal, heart);
  }).join('');
  return `<path d="M${x} ${y} Q${ax.toFixed(1)} ${ay.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}" stroke="#5d3a1f" stroke-width="6" fill="none" stroke-linecap="round"/>${flowers}`;
}
const lantern = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><line x1="0" y1="-26" x2="0" y2="-18" stroke="#5d3a1f" stroke-width="2"/><rect x="-8" y="-18" width="16" height="4" rx="1.5" fill="#b71c1c"/><ellipse rx="15" ry="13" fill="#e53935"/><path d="M-6 -12 C-10 -4 -10 4 -6 12 M6 -12 C10 -4 10 4 6 12" stroke="#ffcc80" stroke-width="1.2" fill="none"/><rect x="-8" y="12" width="16" height="4" rx="1.5" fill="#b71c1c"/><path d="M0 16 V26" stroke="#ffca28" stroke-width="2.5"/></g>`;
const envelope = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-11" y="-15" width="22" height="30" rx="2.5" fill="#d32f2f"/><path d="M-11 -9 L0 -2 L11 -9" stroke="#b71c1c" stroke-width="2" fill="none"/><circle cy="3" r="5" fill="#ffd54f"/></g>`;
const moon = (x: number, y: number, r: number, o = 1) => `<g opacity="${o}"><circle cx="${x}" cy="${y}" r="${r * 1.6}" fill="#ffe9a8" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r}" fill="#ffe9a8"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.2}" r="${r * 0.16}" fill="#f1d37a"/><circle cx="${x + r * 0.35}" cy="${y + r * 0.3}" r="${r * 0.11}" fill="#f1d37a"/></g>`;
const stars = (pts: [number, number, number][], c = '#fff4c2') => pts.map(([x, y, r]) => `<circle class="bd-star" cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
const rabbit = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#f5f0ff" opacity=".85"><ellipse cx="0" cy="6" rx="10" ry="8"/><circle cx="-8" cy="-2" r="6"/><ellipse cx="-11" cy="-13" rx="2.4" ry="8" transform="rotate(-12 -11 -13)"/><ellipse cx="-6" cy="-14" rx="2.4" ry="8" transform="rotate(10 -6 -14)"/></g>`;

/**
 * Inline style for a looping animation whose phase follows the clock, so it keeps flowing
 * smoothly when the board is redrawn after every move instead of starting over.
 */
function phase(dur: number, offset = 0): string {
  const t = (Date.now() / 1000 + offset * 0.37) % dur;
  return `animation-duration:${dur}s;animation-delay:${(-t).toFixed(2)}s`;
}

const ghost = (x: number, y: number, s: number, dur: number, off: number) =>
  `<g transform="translate(${x} ${y})"><g class="bd-ghost" style="${phase(dur, off)}"><g transform="scale(${s})">`
  + `<path d="M-20 14 V-6 A20 20 0 0 1 20 -6 V20 L13 13 L7 20 L0 13 L-7 20 L-13 13 L-20 20Z" fill="#efe8ff"/>`
  + `<ellipse cx="-7" cy="-4" rx="3.6" ry="5" fill="#140a22"/><ellipse cx="7" cy="-4" rx="3.6" ry="5" fill="#140a22"/><ellipse cy="7" rx="4" ry="5.5" fill="#140a22"/></g></g></g>`;
/** Glowing eyes peering out of the dark, blinking now and then. */
const eyes = (x: number, y: number, s: number, off: number, c = '#d4ff5c') =>
  `<g transform="translate(${x} ${y}) scale(${s})"><g class="bd-eyes" style="${phase(9 + (off % 4), off)}">`
  + `<ellipse cx="-6" rx="6" ry="4" fill="${c}" opacity=".25"/><ellipse cx="6" rx="6" ry="4" fill="${c}" opacity=".25"/>`
  + `<path d="M-9 0 Q-6 -3.4 -2.6 0 Q-6 3 -9 0Z M9 0 Q6 -3.4 2.6 0 Q6 3 9 0Z" fill="${c}"/><circle cx="-5.8" r="1" fill="#120818"/><circle cx="5.8" r="1" fill="#120818"/></g></g>`;
/** A bat that flaps its wings while crossing the board from left to right. */
const flyingBat = (y: number, w: number, dur: number, off: number, s = 1.6) =>
  `<g transform="translate(0 ${y})"><g class="bd-batfly" style="${phase(dur, off)};--w:${w + 120}px"><g class="bd-flap">${batShape(0, 0, s, '#0d0616', 0.85)}</g></g></g>`;

/** Halloween gloom: dark vignette, rolling fog, ghosts, peering eyes, a passing bat and far lightning. */
function spooky(W: number, H: number, chess: boolean): string {
  const defs = `<defs><radialGradient id="bd-vig" cx=".5" cy=".5" r=".72"><stop offset=".45" stop-color="#07020e" stop-opacity="0"/><stop offset="1" stop-color="#07020e" stop-opacity=".72"/></radialGradient>`
    + `<radialGradient id="bd-fog"><stop offset="0" stop-color="#d6cdea" stop-opacity=".5"/><stop offset=".55" stop-color="#c9bfe2" stop-opacity=".2"/><stop offset="1" stop-color="#c9bfe2" stop-opacity="0"/></radialGradient></defs>`;
  const fog = ([[0.3, 0.28, 38, 0], [0.62, 0.52, 52, 11], [0.4, 0.78, 44, 23], [0.75, 0.12, 34, 5], [0.2, 0.62, 60, 31]] as const)
    .map(([fx, fy, d, o]) => `<g transform="translate(${fx * W} ${fy * H})"><ellipse class="bd-fog" style="${phase(d, o)}" rx="${W * 0.45}" ry="${H * 0.1}" fill="url(#bd-fog)"/></g>`).join('');
  const edge = chess ? 12 : 30;
  const peer = [eyes(edge + 10, H * 0.36, 1.7, 1), eyes(W - edge - 10, H * 0.58, 1.7, 6), eyes(W * 0.5, H * 0.44, 1.2, 3, '#ff6a3d')].join('');
  return defs + `<rect class="bd-flash" style="${phase(17, 2)}" x="0" y="0" width="${W}" height="${H}" fill="#e6dcff"/>`
    + fog + ghost(W * 0.22, H * 0.55, 2.4, 19, 0) + ghost(W * 0.7, H * 0.3, 2, 23, 9) + ghost(W * 0.5, H * 0.8, 1.7, 27, 17)
    + stoneDefs + (chess
      ? `<g opacity=".7">${tomb(140, 480, 1.9, 0, -6)}${tomb(660, 340, 1.7, 1, 5)}${tomb(420, 575, 1.5, 2, 3)}${tomb(575, 480, 1.3, 0, 8)}${hand(260, 370, 1.7, 2)}${hand(730, 570, 1.5, 7)}</g>`
      : `<g opacity=".7">${tomb(170, 462, 1.35, 0, -6)}${tomb(770, 462, 1.35, 1, 5)}${tomb(370, 662, 1.25, 2, 3)}${tomb(570, 462, 1.15, 1, -4)}${tomb(570, 862, 1.2, 0, 6)}${hand(370, 455, 1.3, 3)}${hand(170, 862, 1.3, 8)}</g>`)
    + peer + flyingBat(H * 0.4, W, 21, 4) + flyingBat(H * 0.7, W, 29, 15, 1.2)
    + `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#bd-vig)"/>`;
}

/** Icicles hanging from a horizontal edge at height y. */
function icicles(x0: number, x1: number, y: number, seed: number, max = 30): string {
  let d = '';
  const n = Math.floor((x1 - x0) / 26);
  for (let i = 0; i < n; i++) {
    const x = x0 + 10 + i * 26 + ((i * 7 + seed) % 9), len = 8 + (((i + seed) * 37) % max), half = 4 + ((i * 3) % 4);
    d += `M${x - half} ${y} Q${x - 1} ${y + len * 0.6} ${x} ${y + len} Q${x + 1} ${y + len * 0.6} ${x + half} ${y}Z`;
  }
  return `<path d="${d}" fill="url(#bd-ice)" stroke="#ffffff" stroke-opacity=".8" stroke-width="1"/>`;
}
/** A frost fern growing from a corner (sx, sy mirror it). */
function frost(x: number, y: number, sx: number, sy: number, r: number): string {
  let d = '';
  for (const a of [8, 30, 52, 74]) {
    const t = (a * Math.PI) / 180, ex = Math.cos(t) * r, ey = Math.sin(t) * r;
    d += `M0 0 L${ex.toFixed(1)} ${ey.toFixed(1)}`;
    for (const f of [0.3, 0.5, 0.7, 0.88]) {
      const bx = ex * f, by = ey * f, l = r * 0.22 * (1 - f * 0.6);
      for (const side of [-1, 1]) {
        const tt = t + side * 0.75;
        d += `M${bx.toFixed(1)} ${by.toFixed(1)} l${(Math.cos(tt) * l).toFixed(1)} ${(Math.sin(tt) * l).toFixed(1)}`;
      }
    }
  }
  return `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke-linecap="round"><path d="${d}" stroke="#8fbfe0" stroke-width="4" opacity=".55"/><path d="${d}" stroke="#fff" stroke-width="1.8"/></g>`;
}
/** Christmas cold: frosted edges, frost ferns in the corners, icicles and glinting ice. */
function wintry(W: number, H: number, top: number): string {
  const defs = `<defs><radialGradient id="bd-frost" cx=".5" cy=".5" r=".75"><stop offset=".45" stop-color="#cfe6f7" stop-opacity="0"/><stop offset="1" stop-color="#bcdcf3" stop-opacity=".75"/></radialGradient>`
    + `<linearGradient id="bd-ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cde8fa"/><stop offset="1" stop-color="#6fb0dd" stop-opacity=".85"/></linearGradient>`
    + `<radialGradient id="bd-gust"><stop offset="0" stop-color="#ffffff" stop-opacity=".75"/><stop offset=".6" stop-color="#eef7ff" stop-opacity=".3"/><stop offset="1" stop-color="#eef7ff" stop-opacity="0"/></radialGradient></defs>`;
  const gusts = ([[0.3, 0.92, 15, 0], [0.7, 0.62, 21, 8], [0.4, 0.3, 26, 17]] as const)
    .map(([fx, fy, d, o]) => `<g transform="translate(${fx * W} ${fy * H})"><ellipse class="bd-fog" style="${phase(d, o)}" rx="${W * 0.4}" ry="${H * 0.07}" fill="url(#bd-gust)"/></g>`).join('');
  return defs + `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#bd-frost)"/>` + gusts
    + frost(0, 0, 1, 1, 170) + frost(W, 0, -1, 1, 170) + frost(0, H, 1, -1, 170) + frost(W, H, -1, -1, 170)
    + stars(scatter(18, W, H, 19).map(([x, y], i) => [x, y, 1.4 + (i % 3) * 0.6] as [number, number, number]), '#ffffff')
    + icicles(0, W, top, 3, 34);
}

/** A tombstone standing on a dark mound (base at x, y). Kinds: rounded RIP stone, cross, leaning slab. */
function tomb(x: number, y: number, s: number, kind: 0 | 1 | 2, tilt = 0): string {
  const stone = kind === 0
    ? `<path d="M-17 0 V-32 A17 17 0 0 1 17 -32 V0Z" fill="url(#bd-stone)" stroke="#1c1428" stroke-width="2"/><text y="-30" text-anchor="middle" font-size="10" font-weight="700" fill="#2a2138" font-family="Georgia, serif">RIP</text><path d="M-10 -18 H10 M-8 -12 H8" stroke="#2a2138" stroke-width="1.6" opacity=".7"/><path d="M6 -46 L2 -38 L7 -30 L3 -22" stroke="#1c1428" stroke-width="1.3" fill="none"/>`
    : kind === 1
      ? `<path d="M-4 0 V-30 H-15 V-38 H-4 V-50 H4 V-38 H15 V-30 H4 V0Z" fill="url(#bd-stone)" stroke="#1c1428" stroke-width="2"/>`
      : `<path d="M-15 0 V-30 Q-15 -36 -9 -36 H9 Q15 -36 15 -30 V0Z" fill="url(#bd-stone)" stroke="#1c1428" stroke-width="2"/><path d="M-8 -26 H8 M-8 -20 H8 M-6 -14 H6" stroke="#2a2138" stroke-width="1.6" opacity=".7"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="1" rx="26" ry="6" fill="#120a1c"/><g transform="rotate(${tilt})">${stone}</g>`
    + `<path d="M-14 0 q2 -6 4 0 q2 -7 4 0 M8 0 q2 -6 4 0 q1 -5 3 0" stroke="#3f5d2a" stroke-width="2" fill="none"/></g>`;
}
const stoneDefs = `<defs><linearGradient id="bd-stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a93ab"/><stop offset="1" stop-color="#5a5270"/></linearGradient></defs>`;
/** A skeleton hand reaching out of a grave now and then. */
const hand = (x: number, y: number, s: number, off: number) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="bd-hand" style="${phase(11, off)}">`
  + `<path d="M-4 0 V-14 L-9 -24 M-4 -14 L-5 -28 M-1 -14 L0 -30 M2 -14 L4 -27 M4 -12 L10 -18 M-4 -14 H4" stroke="#e8e2d0" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>`
  + `<ellipse rx="12" ry="3.5" fill="#120a1c"/></g>`;

/** A paper lantern hanging from (x, y) that swings in the breeze. */
const swingLantern = (x: number, y: number, s: number, off: number) =>
  `<g transform="translate(${x} ${y})"><g class="bd-swing" style="${phase(3.6, off)}"><g transform="scale(${s}) translate(0 26)">${lantern(0, 0, 1)}</g></g></g>`;
/** A five-pointed star lantern (đèn ông sao) on a stick, bobbing as if a child carried it. */
function starLantern(x: number, y: number, s: number, off: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = ((i * 36 - 90) * Math.PI) / 180, r = i % 2 ? 7 : 17; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(' ');
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="bd-bob" style="${phase(2.8, off)}">`
    + `<circle r="26" fill="url(#bd-warm)"/><path d="M0 4 L-16 34" stroke="#7a4b22" stroke-width="2.5" stroke-linecap="round"/>`
    + `<polygon points="${pts}" fill="#e53935" stroke="#ffd54f" stroke-width="2" stroke-linejoin="round"/><circle r="3.4" fill="#ffd54f"/>`
    + `<path d="M-6 16 l-4 10 M6 16 l4 10" stroke="#ffd54f" stroke-width="1.6"/></g></g>`;
}
/** A glowing sky lantern rising slowly and fading out. */
const skyLantern = (x: number, y: number, rise: number, s: number, dur: number, off: number) =>
  `<g transform="translate(${x} ${y})"><g class="bd-rise" style="${phase(dur, off)};--rise:${-rise}px"><g transform="scale(${s})">`
  + `<circle r="22" fill="url(#bd-warm)"/><path d="M-9 -12 H9 L12 10 H-12Z" fill="#ffb74d" stroke="#ffe082" stroke-width="1.2"/><ellipse cy="10" rx="12" ry="2.5" fill="#ff8f00"/><circle cy="6" r="3" fill="#fff3c4"/></g></g></g>`;
/** A firework that bursts, sparkles and fades, again and again. */
function firework(x: number, y: number, r: number, color: string, dur: number, off: number): string {
  const rays = Array.from({ length: 14 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 14, c = Math.cos(a), sn = Math.sin(a);
    return `M${(c * r * 0.35).toFixed(1)} ${(sn * r * 0.35).toFixed(1)} L${(c * r).toFixed(1)} ${(sn * r).toFixed(1)}`;
  }).join('');
  const tips = Array.from({ length: 14 }, (_, i) => { const a = (i * 2 * Math.PI) / 14 + 0.22; return `<circle cx="${(Math.cos(a) * r * 1.1).toFixed(1)}" cy="${(Math.sin(a) * r * 1.1).toFixed(1)}" r="2.6"/>`; }).join('');
  return `<g transform="translate(${x} ${y})"><g class="bd-burst" style="${phase(dur, off)}"><path d="${rays}" stroke="${color}" stroke-width="3" stroke-linecap="round"/><g fill="#fff6c8">${tips}</g><circle r="${r * 0.18}" fill="#fff6c8"/></g></g>`;
}
/** A string of red firecrackers (pháo) hanging from (x, y). */
function firecrackers(x: number, y: number, n: number, off: number): string {
  let c = `<path d="M0 0 V${n * 15 + 6}" stroke="#7a4b22" stroke-width="2"/>`;
  for (let i = 0; i < n; i++) {
    const cy = 8 + i * 15, side = i % 2 ? 1 : -1;
    c += `<g transform="translate(${side * 5} ${cy}) rotate(${side * 28})"><rect x="-4" y="-7" width="8" height="14" rx="1.5" fill="#d32f2f" stroke="#8e1414" stroke-width="1"/><rect x="-4" y="-2" width="8" height="3" fill="#ffd54f"/></g>`;
  }
  return `<g transform="translate(${x} ${y})"><g class="bd-swing slow" style="${phase(4.4, off)}">${c}<path d="M0 ${n * 15 + 6} l-5 10 M0 ${n * 15 + 6} l5 10 M0 ${n * 15 + 6} v12" stroke="#ffd54f" stroke-width="2"/></g></g>`;
}
const warmDefs = `<defs><radialGradient id="bd-warm"><stop offset="0" stop-color="#ffd27a" stop-opacity=".75"/><stop offset=".55" stop-color="#ff9a3c" stop-opacity=".25"/><stop offset="1" stop-color="#ff7a00" stop-opacity="0"/></radialGradient></defs>`;
/** A shooting star streaking across now and then. */
const shootingStar = (x: number, y: number, dur: number, off: number) =>
  `<g transform="translate(${x} ${y}) rotate(25)"><g class="bd-shoot" style="${phase(dur, off)}"><path d="M0 0 H-90" stroke="url(#bd-tail)" stroke-width="3" stroke-linecap="round"/><circle r="3.4" fill="#fffbe6"/></g></g>`;
const tailDefs = `<defs><linearGradient id="bd-tail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffbe6" stop-opacity="0"/><stop offset="1" stop-color="#fffbe6"/></linearGradient></defs>`;
/** A cloud drifting slowly left and right (e.g. across the moon). */
const driftCloud = (x: number, y: number, s: number, dur: number, off: number, c = '#c9d3f0') =>
  `<g transform="translate(${x} ${y}) scale(${s})"><g class="bd-drift" style="${phase(dur, off)}" fill="${c}" opacity=".55"><ellipse rx="34" ry="11"/><ellipse cx="-14" cy="-7" rx="16" ry="11"/><ellipse cx="10" cy="-10" rx="18" ry="13"/></g></g>`;

/**
 * Weather drawn ABOVE the pieces (it never takes clicks): Christmas snow, Tết apricot and
 * peach petals, Mid-Autumn fireflies. x0, y0, w, h is the visible area.
 */
export function boardWeather(theme: Theme, x0: number, y0: number, w: number, h: number): string {
  if (theme === 'christmas') {
    const n = Math.round((w * h) / 7000);
    const flakes = scatter(n, w, 1, 41).map(([x], i) => {
      const near = i % 5 === 0, r = near ? 7 + (i % 3) * 1.2 : 3 + (i % 4) * 0.9;
      const dur = near ? 7 + (i % 4) : 11 + (i % 7) * 1.6;
      const body = near && i % 2
        ? `<g transform="scale(${(r / 6).toFixed(2)})">${snowflake(0, 0, 0.95, 1, '#7ea7c6')}${snowflake(0, 0, 0.9, 1)}</g>`
        : `<circle r="${r.toFixed(1)}" fill="#fff" stroke="#7ea7c6" stroke-opacity=".8" stroke-width="1"/>`;
      return `<g transform="translate(${(x0 + x).toFixed(1)} ${y0 - 12})"><g class="bd-fall" style="${phase(dur, i * 2.7)};--fy:${h + 24}px">`
        + `<g class="bd-sway" style="${phase(3 + (i % 4), i)}" opacity="${near ? 0.8 : 0.92}">${body}</g></g></g>`;
    }).join('');
    return `<g class="bd-weather">${flakes}</g>`;
  }
  if (theme === 'tet') {
    const n = Math.round((w * h) / 26000);
    const petals = scatter(n, w, 1, 53).map(([x], i) => {
      const [fill, edge] = i % 2 ? ['#ffd23f', '#e09b00'] : ['#ffb3cf', '#e0628f'];
      const k = 0.8 + (i % 3) * 0.3;
      return `<g transform="translate(${(x0 + x).toFixed(1)} ${y0 - 12})"><g class="bd-fall" style="${phase(13 + (i % 6) * 1.8, i * 3.1)};--fy:${h + 24}px">`
        + `<g class="bd-sway" style="${phase(3.4 + (i % 3), i)}"><g class="bd-spin" style="${phase(4 + (i % 4), i)}"><path transform="scale(${k})" d="M0 -9 C7 -9 9 -2 6 4 C4 8 1 9 0 7 C-1 9 -4 8 -6 4 C-9 -2 -7 -9 0 -9Z" fill="${fill}" stroke="${edge}" stroke-width="1"/></g></g></g></g>`;
    }).join('');
    return `<g class="bd-weather">${petals}</g>`;
  }
  if (theme === 'midautumn') {
    const flies = scatter(Math.round((w * h) / 30000), w, h, 61).map(([x, y], i) =>
      `<g transform="translate(${(x0 + x).toFixed(1)} ${(y0 + y).toFixed(1)})"><g class="bd-firefly" style="${phase(7 + (i % 5) * 1.5, i * 2.3)}"><circle r="11" fill="#ffe680" opacity=".3"/><circle r="3.6" fill="#fff6c8" stroke="#ffd24a" stroke-width="1"/></g></g>`).join('');
    return `<g class="bd-weather">${flies}</g>`;
  }
  return '';
}

/** Pseudo-random but fixed scatter, so decorations do not jump between renders. */
function scatter(n: number, w: number, h: number, seed: number): [number, number][] {
  const out: [number, number][] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = (s / 233280) * w;
    s = (s * 9301 + 49297) % 233280;
    out.push([x, (s / 233280) * h]);
  }
  return out;
}

/** Decorations of a holiday board, drawn above the squares / lines and below the pieces. */
export function boardDeco(theme: Theme, chess: boolean): string {
  if (chess) {
    switch (theme) {
      case 'halloween':
        return g(moon(720, 80, 46, 0.3) + cobweb(0, 0, 1, 1, 170, '#e8e0f5', 0.4) + cobweb(800, 800, -1, -1, 170, '#e8e0f5', 0.4)
          + cobweb(800, 0, -1, 1, 110, '#e8e0f5', 0.3) + batShape(560, 140, 2.2) + batShape(140, 520, 1.8) + spooky(800, 800, true));
      case 'christmas':
        return g(wintry(800, 800, 0) + snowDrift(0, 800, 792, 0.85));
      case 'tet':
        return g(`<g opacity=".5">${branch(0, 30, 1, 1, '#ffd23f', '#e65100')}${branch(800, 770, -1, -1, '#ff9ec0', '#c2185b')}</g>`
          + `<g opacity=".75">${firework(250, 330, 80, '#ffd54f', 5.2, 0)}${firework(590, 470, 60, '#ff5252', 6.4, 3)}${firework(420, 260, 50, '#ff80ab', 7.1, 8)}${firework(160, 560, 46, '#ffab40', 5.8, 13)}</g>`
          + stars(scatter(22, 800, 400, 31).map(([x, y], i) => [x, 200 + y, 1.6 + (i % 3) * 0.8] as [number, number, number]), '#ffd54f'));
      case 'midautumn':
        return g(warmDefs + tailDefs + `<g class="bd-glow" style="${phase(5)}">${moon(760, 40, 70, 0.42)}</g>` + stars(scatter(30, 800, 800, 3).map(([x, y], i) => [x, y, 1.6 + (i % 3) * 0.7] as [number, number, number])) + rabbit(735, 50, 2.2)
          + driftCloud(700, 90, 1.6, 23, 0) + driftCloud(140, 300, 1.2, 29, 9, '#9fb0e0')
          + shootingStar(200, 120, 9, 0) + shootingStar(520, 380, 13, 6)
          + `<g opacity=".8">${skyLantern(180, 640, 420, 1.9, 18, 0)}${skyLantern(460, 700, 480, 1.6, 22, 7)}${skyLantern(640, 620, 380, 1.7, 20, 14)}</g>`
          + `<g opacity=".7">${starLantern(110, 420, 2.1, 0)}${starLantern(690, 470, 1.9, 2)}</g>`);
    }
  }
  const W = 940, H = 1040, riverY = 520;
  switch (theme) {
    case 'halloween':
      return g(spooky(W, H, false) + cobweb(0, 0, 1, 1, 130, '#e8e0f5', 0.4) + cobweb(940, 0, -1, 1, 130, '#e8e0f5', 0.4)
        + cobweb(0, 1040, 1, -1, 130, '#e8e0f5', 0.4) + cobweb(940, 1040, -1, -1, 130, '#e8e0f5', 0.4)
        + pumpkin(130, riverY + 2, 1.6, true) + pumpkin(810, riverY + 2, 1.6, true) + batShape(470, riverY - 4, 2.4, '#0d0616', 0.6)
        + moon(470, 34, 18, 0.5));
    case 'christmas':
      return g(wintry(W, H, 0) + snowDrift(0, W, H - 22, 0.95)
        + tree(120, riverY - 2, 1.4) + tree(820, riverY - 2, 1.4) + snowflake(470, riverY, 2.4, 0.6, '#7fa9c6'));
    case 'tet':
      return g(branch(0, 8, 1, 1, '#ffd23f', '#e65100', 200) + branch(W, H - 8, -1, -1, '#ff9ec0', '#c2185b', 200)
        + `<g opacity=".75">${firework(270, 430, 66, '#ffd54f', 5.2, 0)}${firework(680, 610, 50, '#ff5252', 6.4, 3)}${firework(470, 640, 40, '#ff80ab', 7.1, 8)}${firework(200, 620, 40, '#ffab40', 5.8, 13)}</g>`
        + stars(scatter(18, W, 300, 31).map(([x, y], i) => [x, 380 + y, 1.6 + (i % 3) * 0.8] as [number, number, number]), '#ffd54f')
        + envelope(128, riverY, 1.3) + envelope(812, riverY, 1.3) + swingLantern(470, riverY - 32, 1.2, 0)
        + swingLantern(30, 270, 0.9, 1) + swingLantern(910, 710, 0.9, 2));
    case 'midautumn':
      return g(stars(scatter(40, W, H, 5).filter(([x, y]) => x < 62 || x > 878 || y < 62 || y > 978 || (y > 478 && y < 562)).map(([x, y], i) => [x, y, 1.8 + (i % 3) * 0.8] as [number, number, number]))
        + warmDefs + tailDefs + `<g class="bd-glow" style="${phase(5)}">${moon(470, riverY, 32)}</g>` + rabbit(470, riverY + 8, 1.4)
        + driftCloud(470, riverY - 6, 1, 19, 0) + shootingStar(260, 140, 9, 0) + shootingStar(640, 860, 13, 6)
        + swingLantern(120, riverY - 30, 1.1, 0) + swingLantern(820, riverY - 30, 1.1, 1)
        + `<g opacity=".75">${skyLantern(170, 900, 380, 1.6, 18, 0)}${skyLantern(770, 420, 330, 1.5, 22, 7)}${skyLantern(570, 940, 420, 1.5, 20, 14)}</g>`
        + `<g opacity=".7">${starLantern(170, 640, 1.5, 0)}${starLantern(770, 640, 1.5, 2)}</g>`);
  }
}

// ---------- Frames, tiles and rivers (the board's shape) ----------

/** Width of the holiday frame drawn around the board (outside the playing area). */
export const FRAME = { chess: 44, xq: 40 };

/** Outer outline with a repeating edge (teeth, scallops), as one path around the rectangle. */
function edgePath(x0: number, y0: number, x1: number, y1: number, step: number, bump: number, kind: 'teeth' | 'scallop'): string {
  let d = `M${x0} ${y0}`;
  const side = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step));
    for (let i = 1; i <= n; i++) {
      const t0 = (i - 1) / n, t1 = i / n, tm = (t0 + t1) / 2;
      const mx = ax + (bx - ax) * tm + nx * bump, my = ay + (by - ay) * tm + ny * bump;
      const ex = ax + (bx - ax) * t1, ey = ay + (by - ay) * t1;
      d += kind === 'teeth' ? ` L${mx.toFixed(1)} ${my.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}` : ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    }
  };
  side(x0, y0, x1, y0, 0, -1); side(x1, y0, x1, y1, 1, 0); side(x1, y1, x0, y1, 0, 1); side(x0, y1, x0, y0, -1, 0);
  return d + 'Z';
}
const ring = (x0: number, y0: number, x1: number, y1: number, ix0: number, iy0: number, ix1: number, iy1: number, outer?: string) =>
  `${outer ?? `M${x0} ${y0}H${x1}V${y1}H${x0}Z`} M${ix0} ${iy0}V${iy1}H${ix1}V${iy0}Z`;
const curl = (x: number, y: number, sx: number, sy: number, c: string) =>
  `<path transform="translate(${x} ${y}) scale(${sx} ${sy})" d="M0 0 C14 0 22 8 22 18 C22 26 16 30 10 30 C4 30 1 26 1 21 C1 17 4 14 8 14 C12 14 14 17 13 20 M0 0 C0 14 8 22 18 22" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;

/** The frame around a holiday board (chess: w = h = 800; xiangqi: 940 × 1040). */
export function boardFrame(theme: Theme, chess: boolean, w: number, h: number): string {
  const F = chess ? FRAME.chess : FRAME.xq, x0 = -F, y0 = -F, x1 = w + F, y1 = h + F;
  const inner = (pad = 0) => [-pad, -pad, w + pad, h + pad] as const;
  const [ix0, iy0, ix1, iy1] = inner(2);
  switch (theme) {
    case 'halloween': {
      const outer = edgePath(x0 + 6, y0 + 6, x1 - 6, y1 - 6, 34, 7, 'teeth');
      const drips = Array.from({ length: Math.floor(w / 46) }, (_, i) => {
        const x = 20 + i * 46 + ((i * 17) % 13), len = 10 + ((i * 29) % 22);
        return `M${x - 6} -2 C${x - 6} ${len * 0.6} ${x - 3} ${len} ${x} ${len} C${x + 3} ${len} ${x + 6} ${len * 0.6} ${x + 6} -2Z`;
      }).join('');
      return `<g class="bd-frame"><defs><radialGradient id="bd-candle"><stop offset="0" stop-color="#ffcf5c" stop-opacity=".85"/><stop offset=".5" stop-color="#ff8a1c" stop-opacity=".35"/><stop offset="1" stop-color="#ff6a00" stop-opacity="0"/></radialGradient>`
        + `<linearGradient id="bd-crypt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d1129"/><stop offset=".5" stop-color="#2a1a3d"/><stop offset="1" stop-color="#120a1c"/></linearGradient></defs>`
        + `<path d="${ring(x0, y0, x1, y1, ix0, iy0, ix1, iy1, outer)}" fill-rule="evenodd" fill="url(#bd-crypt)" stroke="#07030c" stroke-width="3"/>`
        + `<path d="M${-F / 2} ${-F / 2}H${w + F / 2}V${h + F / 2}H${-F / 2}Z" fill="none" stroke="#7cff6b" stroke-width="1.6" stroke-dasharray="2 9" opacity=".6"/>`
        + `<path d="${drips}" fill="#7cff6b" opacity=".75"/>`
        + [[-F / 2, -F / 2], [w + F / 2, -F / 2], [-F / 2, h + F / 2], [w + F / 2, h + F / 2]].map(([x, y]) => pumpkin(x, y, 1.15, true)).join('')
        + batShape(w * 0.3, -F / 2, 1.4, '#cdb8ee', 0.8) + batShape(w * 0.5, -F / 2, 1.1, '#cdb8ee', 0.7)
        + stoneDefs + tomb(w * 0.22, h + F - 7, 0.78, 0, -5) + tomb(w * 0.4, h + F - 7, 0.7, 1, 4) + tomb(w * 0.6, h + F - 7, 0.75, 2, -3) + tomb(w * 0.84, h + F - 7, 0.7, 0, 6)
        + eyes(-F / 2, h * 0.3, 0.9, 2) + eyes(w + F / 2, h * 0.7, 0.9, 7, '#ff6a3d') + eyes(w * 0.55, h + F / 2, 0.8, 12)
        + eyes(-F / 2, h * 0.78, 0.8, 5, '#ff6a3d') + eyes(w * 0.15, -F / 2, 0.8, 9)
        + `</g>`;
    }
    case 'christmas': {
      const blobs = Array.from({ length: Math.ceil((w + 2 * F) / 38) }, (_, i) => `<circle cx="${x0 + i * 38 + 10}" cy="${y0 + 6}" r="${14 + ((i * 7) % 8)}"/>`).join('');
      return `<g class="bd-frame"><defs><pattern id="bd-cane" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="20" fill="#d62828"/><rect x="10" width="10" height="20" fill="#fff"/></pattern>`
        + `<linearGradient id="bd-glacier" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4fbff"/><stop offset=".45" stop-color="#bfe0f4"/><stop offset=".55" stop-color="#e6f5ff"/><stop offset="1" stop-color="#8fbedc"/></linearGradient></defs>`
        + `<path d="${ring(x0, y0, x1, y1, ix0, iy0, ix1, iy1, `M${x0 + 12} ${y0}H${x1 - 12}Q${x1} ${y0} ${x1} ${y0 + 12}V${y1 - 12}Q${x1} ${y1} ${x1 - 12} ${y1}H${x0 + 12}Q${x0} ${y1} ${x0} ${y1 - 12}V${y0 + 12}Q${x0} ${y0} ${x0 + 12} ${y0}Z`)}" fill-rule="evenodd" fill="url(#bd-glacier)" stroke="#6f9fc0" stroke-width="2"/>`
        + `<path d="${ring(-12, -12, w + 12, h + 12, ix0, iy0, ix1, iy1)}" fill-rule="evenodd" fill="url(#bd-cane)"/>`
        + frost(x0, y0, 1, 1, 54) + frost(x1, y0, -1, 1, 54) + frost(x0, y1, 1, -1, 54) + frost(x1, y1, -1, -1, 54)
        + stars(scatter(22, w + 2 * F, 1, 29).map(([x], i) => [x0 + x, i % 2 ? y1 - 16 : -F / 2 + 8, 1.5 + (i % 3) * 0.5] as [number, number, number]), '#ffffff')
        + `<g fill="#fff" stroke="#cfe0ec" stroke-width="1.5">${blobs}</g><rect x="${x0}" y="${y0 + 2}" width="${w + 2 * F}" height="14" fill="#fff"/>`
        + [[-F / 2, h + F / 2], [w + F / 2, h + F / 2]].map(([x, y]) => holly(x, y, 1.3)).join('')
        + `<g transform="translate(${w / 2} ${-F / 2 + 4})"><path d="M0 0 C-14 -16 -30 -10 -24 2 C-20 10 -8 6 0 0 C8 6 20 10 24 2 C30 -10 14 -16 0 0Z" fill="#d62828" stroke="#8e1414" stroke-width="1.5"/><path d="M-3 2 L-12 22 M3 2 L12 22" stroke="#d62828" stroke-width="6" stroke-linecap="round"/><circle r="5" fill="#b71c1c"/></g>`
        + `</g>`;
    }
    case 'tet': {
      const outer = edgePath(x0 + 4, y0 + 4, x1 - 4, y1 - 4, 40, 6, 'scallop');
      return `<g class="bd-frame"><defs><linearGradient id="bd-lacquer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d0261a"/><stop offset="1" stop-color="#8f0f07"/></linearGradient></defs>`
        + `<path d="${ring(x0, y0, x1, y1, ix0, iy0, ix1, iy1, outer)}" fill-rule="evenodd" fill="url(#bd-lacquer)" stroke="#e8b739" stroke-width="3"/>`
        + `<rect x="${-F * 0.62}" y="${-F * 0.62}" width="${w + F * 1.24}" height="${h + F * 1.24}" fill="none" stroke="#ffd54f" stroke-width="2"/><rect x="-6" y="-6" width="${w + 12}" height="${h + 12}" fill="none" stroke="#ffd54f" stroke-width="2"/>`
        + curl(-F + 8, -F + 8, 1, 1, '#ffd54f') + curl(w + F - 8, -F + 8, -1, 1, '#ffd54f') + curl(-F + 8, h + F - 8, 1, -1, '#ffd54f') + curl(w + F - 8, h + F - 8, -1, -1, '#ffd54f')
        + firecrackers(-F / 2, -F + 30, chess ? 11 : 13, 0) + firecrackers(w + F / 2, -F + 30, chess ? 11 : 13, 2)
        + `<g transform="translate(${w / 2} ${-F / 2})"><circle class="bd-glow" style="${phase(3)}" r="${F * 0.95}" fill="#ffd54f" opacity=".35"/><circle r="${F * 0.62}" fill="#ffd54f" stroke="#b8860b" stroke-width="2"/><text y="2" text-anchor="middle" dominant-baseline="central" font-size="${F * 0.8}" font-weight="700" fill="#b3170c" font-family="'Noto Serif SC', 'Songti SC', serif">福</text></g>`
        + `<g transform="translate(${w / 2} ${h + F / 2})"><circle r="${F * 0.42}" fill="#ffd54f" stroke="#b8860b" stroke-width="2"/><rect x="-6" y="-6" width="12" height="12" fill="#b3170c"/></g>`
        + `</g>`;
    }
    case 'midautumn': {
      const outer = `M${x0 + 26} ${y0}H${x1 - 26}A26 26 0 0 1 ${x1} ${y0 + 26}V${y1 - 26}A26 26 0 0 1 ${x1 - 26} ${y1}H${x0 + 26}A26 26 0 0 1 ${x0} ${y1 - 26}V${y0 + 26}A26 26 0 0 1 ${x0 + 26} ${y0}Z`;
      const cloud = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#f0d58c" stroke-width="2.4"><path d="M-14 4 A8 8 0 0 1 -2 -6 A9 9 0 0 1 14 -2 A7 7 0 0 1 14 10 H-12 A6 6 0 0 1 -14 4Z"/><path d="M-4 4 A4 4 0 0 1 4 4"/></g>`;
      return `<g class="bd-frame"><defs><linearGradient id="bd-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22305f"/><stop offset="1" stop-color="#0e1533"/></linearGradient></defs>`
        + `<path d="${ring(x0, y0, x1, y1, ix0, iy0, ix1, iy1, outer)}" fill-rule="evenodd" fill="url(#bd-night)" stroke="#f0d58c" stroke-width="3"/>`
        + `<rect x="-7" y="-7" width="${w + 14}" height="${h + 14}" rx="6" fill="none" stroke="#f0d58c" stroke-width="2"/>`
        + stars(scatter(26, w + 2 * F, F - 10, 9).map(([x, y], i) => [x0 + x, y0 + 5 + y, 1.4 + (i % 3) * 0.6] as [number, number, number]))
        + stars(scatter(26, w + 2 * F, F - 10, 13).map(([x, y], i) => [x0 + x, h + 5 + y, 1.4 + (i % 3) * 0.6] as [number, number, number]))
        + cloud(-F / 2, -F / 2, 1) + cloud(w + F / 2, -F / 2, 1) + moon(w / 2, -F / 2, F * 0.36)
        + swingLantern(-F / 2, h + F / 2 - 26, 0.85, 0) + swingLantern(w + F / 2, h + F / 2 - 26, 0.85, 1)
        + `</g>`;
    }
  }
}

/** Tile look of the chess squares (inset edges, cracks, gold borders…). */
export function boardTiles(theme: Theme): string {
  const out: string[] = [];
  for (let fy = 0; fy < 8; fy++) for (let fx = 0; fx < 8; fx++) {
    const x = fx * 100, y = fy * 100, dark = (fx + fy) % 2 === 1, k = fx * 8 + fy;
    if (theme === 'halloween') {
      out.push(`<rect x="${x + 3}" y="${y + 3}" width="94" height="94" rx="7" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="3"/>`);
      if (k % 7 === 3) out.push(`<path d="M${x + 20} ${y + 8} L${x + 34} ${y + 30} L${x + 28} ${y + 46} L${x + 44} ${y + 66}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2"/>`);
    } else if (theme === 'christmas') {
      if (!dark) out.push(`<path d="M${x + 14} ${y + 30} L${x + 30} ${y + 14} M${x + 14} ${y + 46} L${x + 46} ${y + 14}" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>`);
      else out.push(`<rect x="${x + 5}" y="${y + 5}" width="90" height="90" rx="10" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`);
    } else if (theme === 'tet') {
      if (dark) out.push(`<rect x="${x + 7}" y="${y + 7}" width="86" height="86" fill="none" stroke="#e8c46a" stroke-opacity=".7" stroke-width="2"/><circle cx="${x + 7}" cy="${y + 7}" r="2.5" fill="#e8c46a"/><circle cx="${x + 93}" cy="${y + 93}" r="2.5" fill="#e8c46a"/>`);
    } else {
      if (dark) out.push(`<rect x="${x + 6}" y="${y + 6}" width="88" height="88" rx="44" fill="none" stroke="#f0d58c" stroke-opacity=".22" stroke-width="2"/>`);
    }
  }
  return `<g class="bd-deco bd-tiles">${out.join('')}</g>`;
}

/** The xiangqi river as a themed band of water (drawn under the river text). */
export function riverBand(theme: Theme): string {
  const x0 = 72, x1 = 868, top = 478, bot = 562;
  /** Wave segments (relative), going right (dir 1) or left (dir -1). */
  const segs = (amp: number, n: number, dir: 1 | -1) => {
    const step = ((x1 - x0) / n) * dir;
    let d = '';
    for (let i = 0; i < n; i++) d += ` q${(step / 4).toFixed(1)} ${(-amp * dir).toFixed(1)} ${(step / 2).toFixed(1)} 0 t${(step / 2).toFixed(1)} 0`;
    return d;
  };
  const wave = (y: number, amp: number, n: number) => `M${x0} ${y}${segs(amp, n, 1)}`;
  const band = `M${x0} ${top}${segs(6, 10, 1)} L${x1} ${bot}${segs(6, 10, -1)}Z`;
  const fills: Record<Theme, [string, number, string]> = {
    halloween: ['#2d5a3a', 0.45, '#7cff6b'], christmas: ['#cfe8f7', 0.9, '#7fb3d5'], tet: ['#ffd54f', 0.35, '#c62828'], midautumn: ['#3a5aa6', 0.55, '#f0d58c'],
  };
  const [fill, op, line] = fills[theme];
  let extra = '';
  if (theme === 'christmas') extra = `<path d="M150 ${top + 12} L190 ${top + 40} L240 ${top + 30} M600 ${bot - 10} L640 ${top + 44} L700 ${top + 52} M420 ${top + 8} L450 ${top + 30}" stroke="#fff" stroke-width="2.4" fill="none"/>`;
  else if (theme === 'halloween') extra = scatter(14, x1 - x0, bot - top - 20, 21).map(([x, y], i) => `<circle cx="${x0 + x}" cy="${top + 10 + y}" r="${2 + (i % 3)}" fill="none" stroke="#7cff6b" stroke-width="1.2" opacity=".6"/>`).join('');
  else if (theme === 'midautumn') extra = `<ellipse cx="470" cy="${(top + bot) / 2 + 22}" rx="40" ry="5" fill="#ffe9a8" opacity=".45"/>`;
  return `<g class="bd-deco bd-river"><path d="${band}" fill="${fill}" opacity="${op}"/>`
    + `<path d="${wave(top + 24, 4, 14)} ${wave(bot - 22, 4, 14)}" fill="none" stroke="${line}" stroke-width="2" opacity=".55"/>${extra}</g>`;
}
