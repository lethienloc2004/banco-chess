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
