// PWA de iPhone: la app móvil exportada a web y servida en /app/ por el mismo servidor.
// Necesita la web compilada con la PWA (cd web && npm run build && cd ../mobile && npm run export:pwa) servida en :3000.
// Uso: node pruebas/e2e-pwa.mjs [URL del servidor] [carpeta de capturas]
// Una vez: npx playwright install webkit
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, webkit, devices } = createRequire(import.meta.url)('playwright');

const URL = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '');
const DIR = process.argv[3] ?? 'docs/capturas';
mkdirSync(DIR, { recursive: true });

const errores = [];
let paso = 0;
const ok = (t) => console.log(`  ✓ ${++paso}. ${t}`);
const foto = (p, n) => p.screenshot({ path: `${DIR}/${n}.png` });
const navegadores = [];

async function pagina(motor, opciones, nombre) {
  const b = await motor.launch();
  navegadores.push(b);
  const ctx = await b.newContext({ locale: 'es-CO', ...opciones });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(`[${nombre}] ${e.message}`));
  return p;
}

let actual;
try {
  // 1. iPhone (WebKit, el motor de Safari): la web manda a /app/ y se ve la app móvil.
  const iphone = await pagina(webkit, devices['iPhone 13'], 'iphone');
  actual = iphone;
  await iphone.goto(`${URL}/`);
  await iphone.waitForURL(/\/app\/$/);
  await iphone.getByRole('button', { name: 'Estudiante', exact: true }).waitFor();
  await iphone.getByText('Agregar a inicio', { exact: false }).waitFor();
  if (await iphone.getByText('Servidor:', { exact: false }).count()) throw new Error('La PWA no debe mostrar la dirección del servidor.');
  await foto(iphone, 'pwa-01-acceso');
  ok('en iPhone la web redirige a /app/ con la app móvil y el aviso para instalarla');

  const manifiesto = await iphone.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    return (await fetch(href)).json();
  });
  if (manifiesto.start_url !== '/app/' || manifiesto.display !== 'standalone') throw new Error(`Manifest inesperado: ${JSON.stringify(manifiesto)}`);
  const metas = await iphone.evaluate(() => ({
    viewport: document.querySelector('meta[name="viewport"]').content,
    capaz: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    icono: document.querySelector('link[rel="apple-touch-icon"]')?.href,
  }));
  if (!metas.viewport.includes('viewport-fit=cover') || metas.capaz !== 'yes' || !metas.icono) throw new Error(`Metadatos de iOS: ${JSON.stringify(metas)}`);
  const icono = await iphone.evaluate(async (u) => (await fetch(u)).status, metas.icono);
  if (icono !== 200) throw new Error(`apple-touch-icon responde ${icono}`);
  ok('manifest (standalone, /app/), viewport-fit=cover, metas de Apple e ícono');

  await iphone.getByRole('button', { name: 'Estudiante', exact: true }).click();
  await iphone.getByText('Buscar tutor', { exact: true }).waitFor();
  await iphone.getByRole('tab', { name: 'Sesiones' }).waitFor();
  await foto(iphone, 'pwa-02-buscar');
  await iphone.getByRole('tab', { name: 'Cuenta' }).click();
  await iphone.getByText('Versión 1.1.0', { exact: false }).waitFor();
  await foto(iphone, 'pwa-03-cuenta');
  ok('ingresa Ana, navega por las pestañas y ve la versión en Cuenta');

  // La web y la PWA comparten la sesión: recargar sigue adentro.
  await iphone.reload();
  await iphone.getByRole('tab', { name: 'Buscar' }).waitFor();
  ok('la sesión se mantiene al recargar la PWA');

  // 2. ?web=1 deja la versión web completa en el iPhone.
  await iphone.goto(`${URL}/?web=1`);
  await iphone.waitForTimeout(800);
  if (new globalThis.URL(iphone.url()).pathname.startsWith('/app')) throw new Error('?web=1 no debe redirigir a /app/.');
  await iphone.goto(`${URL}/cuenta`);
  await iphone.getByRole('button', { name: 'Usar la app móvil' }).click();
  await iphone.waitForURL(/\/app\/$/);
  await iphone.getByRole('tab', { name: 'Buscar' }).waitFor();
  ok('?web=1 abre la web completa y "Usar la app móvil" vuelve a /app/');

  // 3. Una cuenta del equipo en la PWA pasa a la web completa.
  const r = await fetch(`${URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'soporte@tutores.co', password: 'Demo1234' }) });
  const { token } = await r.json();
  await iphone.evaluate((t) => localStorage.setItem('tutoresonline.token', t), token);
  await iphone.goto(`${URL}/app/`);
  await iphone.waitForURL((u) => u.pathname === '/' && u.search.includes('web=1'));
  ok('soporte abierto en la PWA pasa a la versión web completa');

  // 4. Escritorio: sin redirección.
  const escritorio = await pagina(chromium, { viewport: { width: 1280, height: 800 } }, 'escritorio');
  actual = escritorio;
  await escritorio.goto(`${URL}/`);
  await escritorio.getByRole('button', { name: 'Ingresar', exact: true }).first().waitFor();
  if (new globalThis.URL(escritorio.url()).pathname !== '/') throw new Error('El escritorio no debe redirigir.');
  ok('en escritorio la web sigue igual');

  // 5. Service worker (Chromium con perfil de iPhone): controla /app/ y no guarda nada de la API.
  const sw = await pagina(chromium, devices['iPhone 13'], 'sw');
  actual = sw;
  await sw.goto(`${URL}/app/`);
  await sw.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await sw.reload();
  await sw.getByRole('button', { name: 'Estudiante', exact: true }).click();
  await sw.getByText('Buscar tutor', { exact: true }).waitFor();
  await sw.waitForTimeout(1500);
  const guardado = await sw.evaluate(async () => {
    const urls = [];
    for (const k of await caches.keys()) for (const req of await (await caches.open(k)).keys()) urls.push(new URL(req.url).pathname);
    return { controlada: !!navigator.serviceWorker.controller, urls };
  });
  if (!guardado.controlada) throw new Error('El service worker no controla /app/.');
  const privados = guardado.urls.filter((u) => u.startsWith('/api') || u.startsWith('/ws'));
  if (privados.length) throw new Error(`El service worker guardó datos privados: ${privados.join(', ')}`);
  if (!guardado.urls.includes('/app/')) throw new Error('El service worker no guardó /app/.');
  ok(`service worker activo con ${guardado.urls.length} archivos estáticos y nada de /api`);

  if (errores.length) throw new Error(`Errores en las páginas:\n${errores.join('\n')}`);
  console.log(`\nPWA: ${paso} pasos correctos.`);
} catch (e) {
  console.error(`\n✗ Falló después del paso ${paso}: ${e.message}`);
  if (actual) await actual.screenshot({ path: `${DIR}/fallo-pwa.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  for (const b of navegadores) await b.close();
}
