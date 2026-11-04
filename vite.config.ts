import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { repository?: { url?: string } | string };
const repo = (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '');

export default defineConfig({
  // Relative base so the build works under any path.
  base: './',
  worker: { format: 'es' },
  // The GitHub link in the app comes from "repository" in package.json.
  define: { __REPO_URL__: JSON.stringify(repo) },
  server: {
    // `npm run dev` + `npm run dev:server`: the app talks to the local game server.
    proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true, changeOrigin: true } },
  },
});
