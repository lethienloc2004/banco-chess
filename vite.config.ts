import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { repository?: { url?: string } | string };
/** Public address of the app, used for link previews (og:image needs a full URL), robots.txt and the sitemap. */
const SITE_URL = (process.env.SITE_URL ?? 'https://banco-chess.lethienloc.workers.dev').replace(/\/$/, '');

const repo = (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '');

export default defineConfig({
  // Relative base so the build works under any path.
  base: './',
  worker: { format: 'es' },
  // The GitHub link in the app comes from "repository" in package.json.
  define: { __REPO_URL__: JSON.stringify(repo) },
  plugins: [{
    name: 'site-url',
    transformIndexHtml: html => html.replaceAll('%SITE_URL%', SITE_URL),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n` });
      const pages = ['/', '/privacy.html', '/terms.html'];
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n')}\n</urlset>\n` });
    },
  }],
  server: {
    // `npm run dev` + `npm run dev:server`: the app talks to the local game server.
    proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true, changeOrigin: true } },
  },
});
