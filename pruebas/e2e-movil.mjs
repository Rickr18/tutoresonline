// Recorrido de la app móvil (exportada a web con `expo export --platform web`) en un viewport de teléfono.
// Uso: node pruebas/e2e-movil.mjs [URL de la exportación] [carpeta de capturas]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const URL = process.argv[2] ?? 'http://localhost:8090';
const DIR = process.argv[3] ?? 'docs/capturas';
mkdirSync(DIR, { recursive: true });

const errores = [];
const navegador = await chromium.launch();
const paginas = [];
let paso = 0;
const ok = (t) => console.log(`  ✓ ${++paso}. ${t}`);
const foto = (p, n) => p.screenshot({ path: `${DIR}/${n}.png` });

async function abrir(rol, nombre) {
  const ctx = await navegador.newContext({ ...devices['Pixel 7'], locale: 'es-CO' });
  const p = await ctx.newPage();
  paginas.push([nombre, p]);
  p.on('pageerror', (e) => errores.push(`[${nombre}] ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errores.push(`[${nombre}] ${m.text()}`); });
  await p.goto(URL);
  await p.getByRole('button', { name: rol, exact: true }).waitFor();
  return p;
}

try {
  const ana = await abrir('Estudiante', 'ana');
  await foto(ana, 'movil-01-acceso');
  await ana.getByRole('button', { name: 'Estudiante', exact: true }).click();
  await ana.getByText('Buscar tutor', { exact: true }).waitFor();
  await ana.getByRole('button', { name: 'Carlos Mendoza' }).waitFor();
  await foto(ana, 'movil-02-buscar');
  ok('estudiante entra con la cuenta de demostración y ve los tutores');

  await ana.getByRole('button', { name: 'Carlos Mendoza' }).click();
  await ana.getByText('Hora de Colombia. Toca una hora para continuar.').waitFor();
  await foto(ana, 'movil-03-perfil-tutor');
  await ana.getByText(/^\d{1,2}:00 [ap]\. m\.$/).first().click();
  await ana.getByLabel('Tema que quieres trabajar').fill('Repaso de derivadas implícitas');
  await ana.getByLabel('Número de la tarjeta').fill('4242424242424242');
  await foto(ana, 'movil-04-reserva');
  await ana.getByRole('button', { name: /Pagar .* y reservar/ }).click();
  await ana.getByText('Esperando al tutor').first().waitFor();
  ok('reserva programada pagada desde el teléfono');

  const carlos = await abrir('Tutor', 'carlos');
  await carlos.getByRole('button', { name: 'Tutor', exact: true }).click();
  await carlos.getByText('Reservas por aceptar').waitFor();
  await carlos.getByText('Repaso de derivadas implícitas', { exact: false }).first().waitFor();
  await foto(carlos, 'movil-07-panel-tutor');
  await carlos.getByText('Repaso de derivadas implícitas', { exact: false }).first().click();
  await carlos.getByRole('button', { name: 'Aceptar la solicitud' }).click();
  await carlos.getByRole('button', { name: 'Iniciar la sesión' }).waitFor();
  await ana.getByText('Sala de la sesión').waitFor({ timeout: 10000 });
  await foto(ana, 'movil-05-sesion-confirmada');
  ok('tutor acepta desde el teléfono y el estudiante lo ve en tiempo real');

  // Tutor ahora
  await ana.getByRole('button', { name: '← Volver' }).click().catch(() => {});
  await ana.getByRole('tab', { name: 'Ahora' }).click();
  await ana.getByRole('button', { name: 'Física mecánica' }).click();
  await ana.getByText(/en línea ·/).waitFor();
  await ana.getByLabel('¿Con qué necesitas ayuda?').fill('Un problema de plano inclinado con fricción');
  await ana.getByLabel('Número de la tarjeta').fill('4242424242424242');
  await ana.getByRole('button', { name: 'Buscar tutor ahora' }).click();
  await ana.getByText('Buscando un tutor disponible').waitFor();
  await ana.waitForTimeout(1500);
  await foto(ana, 'movil-06-buscando');
  await carlos.getByRole('button', { name: '← Volver' }).click();
  await carlos.getByText('plano inclinado', { exact: false }).waitFor({ timeout: 10000 });
  await foto(carlos, 'movil-08-solicitud-inmediata');
  await carlos.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await carlos.getByRole('button', { name: 'Iniciar la sesión' }).waitFor();
  await ana.getByText(/aceptó tu solicitud$/).waitFor({ timeout: 10000 });
  await foto(ana, 'movil-09-tutor-encontrado');
  ok('solicitud inmediata tomada por el tutor desde el teléfono');

  await carlos.getByRole('button', { name: 'Iniciar la sesión' }).click();
  await carlos.getByRole('button', { name: 'Finalizar la sesión' }).click();
  await carlos.getByRole('button', { name: 'Calificar al estudiante' }).click();
  await carlos.getByRole('radio', { name: '5 de 5' }).click();
  await carlos.getByRole('button', { name: 'Enviar calificación' }).click();
  await carlos.getByText('Se publica cuando la otra parte califique').waitFor();
  await ana.getByRole('button', { name: 'Ir a la sesión' }).click();
  await ana.getByRole('button', { name: 'Calificar al tutor' }).click();
  await ana.getByRole('radio', { name: '4 de 5' }).click();
  await ana.getByLabel('Comentario (opcional)').fill('Muy claro con los diagramas de fuerzas.');
  await ana.getByRole('button', { name: 'Enviar calificación' }).click();
  await ana.getByText('Calificación que recibiste').waitFor();
  await foto(ana, 'movil-10-sesion-finalizada');
  ok('sesión finalizada y calificada por ambos');

  // Disputa desde el teléfono: el estudiante reporta con una foto y el tutor presenta su versión
  const fotoPrueba = Buffer.from('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', 'base64');
  await ana.getByRole('button', { name: 'Reportar un problema' }).click();
  await ana.getByLabel('Motivo').fill('La conexión del tutor se cortó dos veces y perdimos casi 20 minutos de la sesión.');
  await ana.getByRole('button', { name: 'Abrir disputa' }).click();
  await ana.getByText('Pronto alguien de soporte tomará el caso', { exact: false }).waitFor();
  await ana.getByLabel('Mensaje para soporte').fill('Adjunto la captura del chat de la sala donde se ve la desconexión.');
  const [selector] = await Promise.all([ana.waitForEvent('filechooser'), ana.getByRole('button', { name: 'Galería' }).click()]);
  await selector.setFiles({ name: 'chat-sala.jpg', mimeType: 'image/jpeg', buffer: fotoPrueba });
  await ana.getByText('chat-sala.jpg', { exact: true }).waitFor();
  await ana.getByRole('button', { name: 'Enviar', exact: true }).click();
  await ana.getByText(/chat-sala\.jpg · \d+ KB/).waitFor();
  await foto(ana, 'movil-14-caso-estudiante');
  ok('estudiante abre una disputa desde el teléfono y adjunta una foto');

  await carlos.getByRole('button', { name: '← Volver' }).click();
  await carlos.getByRole('tab', { name: 'Inicio' }).click();
  await carlos.getByText(/Caso de soporte abierto/).first().waitFor({ timeout: 10000 });
  await carlos.getByText(/Caso de soporte abierto/).first().click();
  await carlos.getByText('Tu conversación con soporte').waitFor();
  await carlos.getByLabel('Mensaje para soporte').fill('Se cayó el internet del barrio dos veces; repuse el tiempo al final y le envié los ejercicios resueltos.');
  await carlos.getByRole('button', { name: 'Enviar', exact: true }).click();
  await carlos.getByText(/repuse el tiempo al final/).last().waitFor();
  if (await carlos.getByText('chat-sala.jpg').count()) throw new Error('El tutor ve la foto privada del estudiante');
  await foto(carlos, 'movil-15-caso-tutor');
  ok('el tutor ve el caso en su inicio y presenta su versión sin ver las pruebas del estudiante');

  await ana.getByRole('button', { name: 'Ver ▼' }).click();
  await ana.getByText(/presentó su versión del caso/).waitFor({ timeout: 10000 });
  await ana.getByText(/abrió una disputa/).first().scrollIntoViewIfNeeded();
  await foto(ana, 'movil-16-historial');
  ok('el historial de la sesión muestra cada paso con su hora exacta');

  await carlos.getByRole('button', { name: '← Volver' }).click();
  await carlos.getByRole('tab', { name: 'Ingresos' }).click();
  await carlos.getByText('Movimientos').waitFor();
  await foto(carlos, 'movil-11-ingresos');
  await ana.getByRole('button', { name: '← Volver' }).click();
  await ana.getByRole('tab', { name: 'Sesiones' }).click();
  await ana.getByText(/^Activas \(/).waitFor();
  await foto(ana, 'movil-12-sesiones');
  await ana.getByRole('tab', { name: 'Cuenta' }).click();
  await ana.getByText('Notificaciones', { exact: false }).first().waitFor();
  await foto(ana, 'movil-13-cuenta');
  ok('ingresos del tutor, sesiones y cuenta del estudiante');

  for (const [n, p] of paginas) {
    const desborde = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (desborde > 0) throw new Error(`${n}: la pantalla desborda ${desborde}px`);
  }
  ok('sin desbordes horizontales');
} catch (e) {
  console.error('\n✗ Falló:', e.message);
  errores.push(`FALLO: ${e.message}`);
  for (const [n, p] of paginas) await p.screenshot({ path: `${DIR}/fallo-movil-${n}.png` }).catch(() => {});
} finally {
  await navegador.close();
}
if (errores.length) { console.error('\nErrores:\n' + errores.join('\n')); process.exit(1); }
console.log(`\nRecorrido móvil completo: ${paso} pasos sin errores.`);
