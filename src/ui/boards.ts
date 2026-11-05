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
const pumpkin = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="-7" rx="9" ry="11" fill="#e8741c"/><ellipse cx="7" rx="9" ry="11" fill="#e8741c"/><ellipse rx="10" ry="12" fill="#ff8c1a"/><path d="M0 -12 C0 -16 2 -18 5 -19" stroke="#3e7d1e" stroke-width="3" fill="none"/><path d="M-6 -3 L-3 -6 L-2 -2Z M6 -3 L3 -6 L2 -2Z M-6 4 Q0 9 6 4" fill="#3b1300"/></g>`;
const snowflake = (x: number, y: number, s: number, o = 0.5, c = '#fff') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10V10M-10 0H10M-7 -7L7 7M-7 7L7 -7M0 -10L-3 -7M0 -10L3 -7M0 10L-3 7M0 10L3 7" stroke="${c}" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="${o}"/>`;
const holly = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C-6 -8 -16 -6 -20 -2 C-14 0 -10 4 -12 8 C-6 4 -2 4 0 0Z" fill="#2e7d32"/><path d="M0 0 C6 -8 16 -6 20 -2 C14 0 10 4 12 8 C6 4 2 4 0 0Z" fill="#388e3c"/><circle cx="-3" cy="1" r="3.4" fill="#e53935"/><circle cx="3" cy="2" r="3.4" fill="#c62828"/></g>`;
const tree = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="10" width="6" height="7" fill="#6d4c2e"/><path d="M0 -18 L12 2 H6 L14 12 H-14 L-6 2 H-12Z" fill="#2e7d32"/><circle cy="-19" r="3" fill="#f9d342"/><circle cx="-4" cy="2" r="1.8" fill="#e53935"/><circle cx="5" cy="8" r="1.8" fill="#42a5f5"/></g>`;
const garland = (x0: number, x1: number, y: number, sag: number, n: number) => {
  let d = `M${x0} ${y}`;
  const step = (x1 - x0) / n;
  const bulbs: string[] = [];
  const colors = ['#e53935', '#f9d342', '#42a5f5', '#43a047'];
  for (let i = 0; i < n; i++) {
    const a = x0 + i * step, b = a + step;
    d += ` Q${(a + b) / 2} ${y + sag} ${b} ${y}`;
    bulbs.push(`<circle cx="${(a + b) / 2}" cy="${y + sag / 2 + 4}" r="5" fill="${colors[i % 4]}"/>`);
  }
  return `<path d="${d}" fill="none" stroke="#2e7d32" stroke-width="5" stroke-linecap="round"/>${bulbs.join('')}`;
};
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
        return g(cobweb(0, 0, 1, 1, 150) + cobweb(800, 800, -1, -1, 150) + moon(720, 80, 46, 0.35)
          + batShape(560, 140, 2.2) + batShape(140, 520, 1.8) + batShape(620, 620, 1.6));
      case 'christmas':
        return g(scatter(26, 800, 760, 7).map(([x, y], i) => snowflake(x, y, 0.7 + (i % 3) * 0.3, 0.45)).join('')
          + `<g opacity=".55">${garland(0, 800, -6, 34, 8)}</g>` + snowDrift(0, 800, 792, 0.75));
      case 'tet':
        return g(`<g opacity=".5">${branch(0, 30, 1, 1, '#ffd23f', '#e65100')}${branch(800, 770, -1, -1, '#ff9ec0', '#c2185b')}</g>`);
      case 'midautumn':
        return g(moon(760, 40, 70, 0.38) + stars(scatter(30, 800, 800, 3).map(([x, y], i) => [x, y, 1.6 + (i % 3) * 0.7] as [number, number, number])) + rabbit(735, 50, 2.2));
    }
  }
  const W = 940, H = 1040, riverY = 520;
  switch (theme) {
    case 'halloween':
      return g(cobweb(0, 0, 1, 1, 120) + cobweb(940, 0, -1, 1, 120) + cobweb(0, 1040, 1, -1, 120) + cobweb(940, 1040, -1, -1, 120)
        + pumpkin(130, riverY + 2, 1.6) + pumpkin(810, riverY + 2, 1.6) + batShape(470, riverY - 4, 2.4, '#1b1027', 0.55)
        + batShape(300, 32, 1.6, '#cdb8ee', 0.5) + batShape(640, 1010, 1.6, '#cdb8ee', 0.5) + moon(470, 34, 18, 0.6));
    case 'christmas':
      return g(garland(30, 910, 14, 26, 10) + snowDrift(0, W, H - 22, 0.95)
        + scatter(20, W, 60, 11).map(([x, y]) => snowflake(x, H - 70 + y * 0.5, 0.8, 0.6, '#9ab8cc')).join('')
        + tree(120, riverY - 2, 1.4) + tree(820, riverY - 2, 1.4) + snowflake(470, riverY, 2.4, 0.5, '#9ab8cc'));
    case 'tet':
      return g(branch(0, 8, 1, 1, '#ffd23f', '#e65100', 200) + branch(W, H - 8, -1, -1, '#ff9ec0', '#c2185b', 200)
        + envelope(128, riverY, 1.3) + envelope(812, riverY, 1.3) + lantern(470, riverY, 1.2)
        + lantern(30, 300, 0.9) + lantern(910, 740, 0.9));
    case 'midautumn':
      return g(stars(scatter(40, W, H, 5).filter(([x, y]) => x < 62 || x > 878 || y < 62 || y > 978 || (y > 478 && y < 562)).map(([x, y], i) => [x, y, 1.8 + (i % 3) * 0.8] as [number, number, number]))
        + moon(470, riverY, 32) + rabbit(470, riverY + 8, 1.4) + lantern(120, riverY, 1.1) + lantern(820, riverY, 1.1));
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
      return `<g class="bd-frame">`
        + `<path d="${ring(x0, y0, x1, y1, ix0, iy0, ix1, iy1, outer)}" fill-rule="evenodd" fill="#241632" stroke="#0f0818" stroke-width="3"/>`
        + `<path d="M${-F / 2} ${-F / 2}H${w + F / 2}V${h + F / 2}H${-F / 2}Z" fill="none" stroke="#7cff6b" stroke-width="1.6" stroke-dasharray="2 9" opacity=".6"/>`
        + `<path d="${drips}" fill="#7cff6b" opacity=".75"/>`
        + [[-F / 2, -F / 2], [w + F / 2, -F / 2], [-F / 2, h + F / 2], [w + F / 2, h + F / 2]].map(([x, y]) => pumpkin(x, y, 1.15)).join('')
        + batShape(w * 0.3, -F / 2, 1.4, '#cdb8ee', 0.8) + batShape(w * 0.72, h + F / 2, 1.3, '#cdb8ee', 0.8)
        + `</g>`;
    }
    case 'christmas': {
      const blobs = Array.from({ length: Math.ceil((w + 2 * F) / 38) }, (_, i) => `<circle cx="${x0 + i * 38 + 10}" cy="${y0 + 6}" r="${14 + ((i * 7) % 8)}"/>`).join('');
      return `<g class="bd-frame"><defs><pattern id="bd-cane" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="13" height="26" fill="#d62828"/><rect x="13" width="13" height="26" fill="#fff"/></pattern></defs>`
        + `<path d="${ring(x0, y0, x1, y1, ix0, iy0, ix1, iy1, `M${x0 + 12} ${y0}H${x1 - 12}Q${x1} ${y0} ${x1} ${y0 + 12}V${y1 - 12}Q${x1} ${y1} ${x1 - 12} ${y1}H${x0 + 12}Q${x0} ${y1} ${x0} ${y1 - 12}V${y0 + 12}Q${x0} ${y0} ${x0 + 12} ${y0}Z`)}" fill-rule="evenodd" fill="url(#bd-cane)" stroke="#8e1414" stroke-width="2"/>`
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
        + `<g transform="translate(${w / 2} ${-F / 2})"><circle r="${F * 0.62}" fill="#ffd54f" stroke="#b8860b" stroke-width="2"/><text y="2" text-anchor="middle" dominant-baseline="central" font-size="${F * 0.8}" font-weight="700" fill="#b3170c" font-family="'Noto Serif SC', 'Songti SC', serif">福</text></g>`
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
        + lantern(-F / 2, h + F / 2 - 4, 0.85) + lantern(w + F / 2, h + F / 2 - 4, 0.85)
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
