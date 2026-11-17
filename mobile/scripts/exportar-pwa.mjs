// Exporta la app a web para servirla como PWA en /app/ del mismo servidor (la usa el iPhone).
// Uso: npm run export:pwa  ->  ../web/dist/app (compilar antes la web, porque Vite vacía web/dist).
// Destino distinto: npm run export:pwa -- ../otra/carpeta
// Después de exportar, el nombre de la caché del service worker se cambia en cada exportación (versión de la app + hora),
// para que una actualización limpie la caché anterior y nadie se quede con una interfaz vieja.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const destino = process.argv[2] ?? '../web/dist/app';
const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', destino], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_BASE_URL: '/app' },
});
if (r.status === 0) {
  const sw = join(destino, 'sw.js');
  if (existsSync(sw)) {
    const version = JSON.parse(readFileSync('app.json', 'utf8')).expo.version;
    const nombre = `tutoresonline-pwa-${version}-${Date.now().toString(36)}`;
    writeFileSync(sw, readFileSync(sw, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${nombre}';`));
    console.log(`Service worker: caché ${nombre}`);
  }
}
process.exit(r.status ?? 1);
