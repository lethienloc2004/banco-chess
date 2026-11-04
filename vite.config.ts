import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works under any path.
  base: './',
  worker: { format: 'es' },
  server: {
    // `npm run dev` + `npm run dev:server`: the app talks to the local game server.
    proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true, changeOrigin: true } },
  },
});
