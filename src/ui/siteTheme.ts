/**
 * The whole site dressed for the running holiday: its own colours (light and dark)
 * and a scene behind the content (corner pieces and things moving across the sky).
 */
import type { Theme } from '../sound';
import { siteScene } from './boards';

type Vars = Record<string, string>;
const P: Record<Theme, { light: Vars; dark: Vars }> = {
  halloween: {
    light: { bg: '#ece4f1', surface: '#fbf8fd', 'surface-2': '#e3d8ec', text: '#241a2e', muted: '#6e5f7c', border: '#d6c8e2', accent: '#d9591a', 'accent-text': '#fff', 'accent-soft': '#f7dcc7' },
    dark: { bg: '#120c19', surface: '#1d1527', 'surface-2': '#281d35', text: '#efe6f7', muted: '#a596b5', border: '#352845', accent: '#ff8a2b', 'accent-text': '#1a0f05', 'accent-soft': '#3a2414' },
  },
  christmas: {
    light: { bg: '#e7f1f8', surface: '#fbfdff', 'surface-2': '#dcebf4', text: '#15283a', muted: '#5c7286', border: '#cadced', accent: '#c62828', 'accent-text': '#fff', 'accent-soft': '#f6d6d6' },
    dark: { bg: '#0b1621', surface: '#13212f', 'surface-2': '#1b2c3d', text: '#e6f1fa', muted: '#94aabd', border: '#263a4e', accent: '#ef5350', 'accent-text': '#fff', 'accent-soft': '#3a1c1f' },
  },
  tet: {
    light: { bg: '#fdeedd', surface: '#fffaf2', 'surface-2': '#f8e1c4', text: '#3a1206', muted: '#8a5a3a', border: '#efcfa3', accent: '#c62828', 'accent-text': '#fff', 'accent-soft': '#fbd9c9' },
    dark: { bg: '#1c0d08', surface: '#2a140c', 'surface-2': '#3a1d11', text: '#fbe9d6', muted: '#c49a78', border: '#4a2716', accent: '#ffca28', 'accent-text': '#3a1206', 'accent-soft': '#4a2a10' },
  },
  midautumn: {
    light: { bg: '#e9e8f5', surface: '#fcfbff', 'surface-2': '#dedcef', text: '#1a1f3d', muted: '#5e6385', border: '#d0cee5', accent: '#d9741f', 'accent-text': '#fff', 'accent-soft': '#f7e1c8' },
    dark: { bg: '#0b1030', surface: '#141a40', 'surface-2': '#1d2452', text: '#f2ecd8', muted: '#a8a9c8', border: '#2a3163', accent: '#f0c050', 'accent-text': '#1a1508', 'accent-soft': '#3b3220' },
  },
};

const block = (v: Vars) => Object.entries(v).map(([k, x]) => `--${k}:${x};`).join('');

function css(): string {
  return (Object.keys(P) as Theme[]).map(th => {
    const sel = `:root[data-season='${th}']`;
    return `${sel}{${block(P[th].light)}}`
      + `@media (prefers-color-scheme: dark){${sel}:not([data-theme='light']){${block(P[th].dark)}}}`
      + `${sel}[data-theme='dark']{${block(P[th].dark)}}`;
  }).join('\n');
}

let shown: Theme | null = null;

/** Dress the site for `theme` (null = the usual look). */
export function applySiteTheme(theme: Theme | null) {
  const root = document.documentElement;
  if (theme === shown) return;
  shown = theme;
  if (!document.getElementById('season-css')) {
    const style = document.createElement('style');
    style.id = 'season-css';
    style.textContent = css();
    document.head.appendChild(style);
  }
  document.querySelector('.season-scene')?.remove();
  if (!theme) { delete root.dataset.season; return; }
  root.dataset.season = theme;
  const { corners, sky } = siteScene(theme);
  const scene = document.createElement('div');
  scene.className = 'season-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `<div class="ss-sky">${sky}</div>`
    + ['tl', 'tr', 'bl', 'br'].map((c, i) => `<div class="ss-corner ${c}">${corners[i]}</div>`).join('');
  document.body.prepend(scene);
}
