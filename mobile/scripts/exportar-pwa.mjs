// Exporta la app a web para servirla como PWA en /app/ del mismo servidor (la usa el iPhone).
// Uso: npm run export:pwa  ->  ../web/dist/app (compilar antes la web, porque Vite vacía web/dist).
// Destino distinto: npm run export:pwa -- ../otra/carpeta
import { spawnSync } from 'node:child_process';

const destino = process.argv[2] ?? '../web/dist/app';
const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', destino], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_BASE_URL: '/app' },
});
process.exit(r.status ?? 1);
