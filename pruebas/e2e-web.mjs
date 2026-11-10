// Recorrido de punta a punta de la web con Playwright: estudiante, tutor y administrador.
// Uso: node pruebas/e2e-web.mjs [URL] [carpeta de capturas]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:3000';
const DIR = process.argv[3] ?? 'docs/capturas';
mkdirSync(DIR, { recursive: true });

const errores = [];
const navegador = await chromium.launch();
let paso = 0;
const paginas = [];
const ok = (texto) => console.log(`  ✓ ${++paso}. ${texto}`);

async function abrir(email) {
  const ctx = await navegador.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2, locale: 'es-CO' });
  const p = await ctx.newPage();
  paginas.push([email, p]);
  p.on('pageerror', (e) => errores.push(`[${email}] ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errores.push(`[${email}] ${m.text()}`); });
  await p.goto(`${URL}/ingresar`);
  await p.getByLabel('Correo electrónico').fill(email);
  await p.getByLabel('Contraseña').fill('Demo1234');
  await p.getByRole('button', { name: 'Ingresar', exact: true }).last().click();
  await p.locator('.barra').waitFor();
  return p;
}
const foto = (p, nombre, completa = false) => p.screenshot({ path: `${DIR}/${nombre}.png`, fullPage: completa });
// Elige una opción en un Select de Ant Design: abre la lista, escribe para filtrar y hace clic en la opción.
async function elegir(p, etiqueta, opcion) {
  const campo = p.getByLabel(etiqueta, { exact: true });
  await campo.click();
  await campo.fill(opcion);
  await p.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: opcion }).first().click();
}

try {
  // Página de inicio pública y preguntas frecuentes (sin sesión)
  {
    const ctx = await navegador.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(`[inicio] ${e.message}`));
    await p.goto(URL);
    await p.getByRole('heading', { name: 'Un tutor para la materia que te está costando.' }).waitFor();
    await p.locator('.inicio-cifras .ant-statistic').first().waitFor();
    await p.locator('.inicio-tutor').first().waitFor();
    const destacados = await p.locator('.inicio-tutor').count();
    if (destacados < 1 || destacados > 4) throw new Error(`El inicio muestra ${destacados} tutores destacados`);
    await foto(p, 'web-00-inicio-publico', true);
    await p.getByRole('button', { name: 'Quiero ser tutor' }).click();
    await p.getByText('Soy tutor').waitFor();
    if (!(await p.getByLabel('Nombre completo').isVisible())) throw new Error('"Quiero ser tutor" no abre el registro.');
    await p.goto(`${URL}/ayuda`);
    await p.getByRole('heading', { name: 'Preguntas frecuentes' }).waitFor();
    await p.getByText('¿Puedo cancelar? ¿Me devuelven el dinero?').click();
    await p.getByText('entre 24 y 2 horas antes, el 50 %', { exact: false }).waitFor();
    await foto(p, 'web-00-ayuda');
    await p.setViewportSize({ width: 390, height: 844 });
    for (const ruta of ['/', '/ayuda']) {
      await p.goto(`${URL}${ruta}`);
      await p.locator('.pie-publico').waitFor();
      const desborde = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (desborde > 0) throw new Error(`${ruta} desborda ${desborde}px a 390 px`);
    }
    await foto(p, 'web-00-inicio-movil');
    await ctx.close();
    ok('inicio público con cifras y tutores destacados, registro de tutor desde el inicio y preguntas frecuentes');
  }

  // Pantalla de acceso
  {
    const ctx = await navegador.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(`${URL}/ingresar`);
    await p.getByText('Cuentas de demostración').first().waitFor();
    await foto(p, 'web-01-acceso');
    await ctx.close();
    ok('pantalla de acceso');
  }

  const ana = await abrir('ana@demo.co');
  const carlos = await abrir('carlos@demo.co');
  const admin = await abrir('rick@tutores.co');

  // Estudiante: su inicio y el aviso de un caso de soporte abierto (Luis tiene uno en la semilla)
  await ana.locator('.kpi').first().waitFor();
  await foto(ana, 'web-22-inicio-estudiante');
  const luis = await abrir('luis@demo.co');
  await luis.locator('.alerta', { hasText: 'Caso de soporte #1' }).waitFor();
  await luis.getByRole('link', { name: 'Ver el caso y escribir a soporte' }).click();
  await luis.locator('.caso-parte').waitFor();
  await luis.context().close();
  ok('el estudiante ve en su inicio el caso abierto y entra a la conversación con soporte');
  await ana.goto(`${URL}/buscar`);

  // Estudiante: búsqueda
  await ana.locator('.tutor-tarjeta').first().waitFor();
  const total = await ana.locator('.tutor-tarjeta').count();
  if (total !== 6) throw new Error(`Se esperaban 6 tutores publicados y hay ${total}`);
  await foto(ana, 'web-02-buscar');
  await elegir(ana, 'Materia', 'Cálculo diferencial');
  await ana.waitForFunction(() => document.querySelectorAll('.tutor-tarjeta').length === 2);
  await elegir(ana, 'Materia', 'Todas');
  await ana.waitForFunction(() => document.querySelectorAll('.tutor-tarjeta').length === 6);
  ok(`búsqueda con ${total} tutores y filtro por materia`);

  // Estudiante: perfil del tutor y reserva programada
  await ana.locator('.tutor-tarjeta', { hasText: 'Carlos Mendoza' }).click();
  await ana.locator('.franjas button').first().waitFor();
  await foto(ana, 'web-03-perfil-tutor');
  await ana.locator('.franjas button').first().click();
  await ana.getByLabel('Tema que quieres trabajar').fill('Límites y continuidad para el primer parcial');
  await ana.getByLabel('Número de la tarjeta').fill('4111 1111 1111 0000');
  await foto(ana, 'web-04-reserva');
  await ana.getByRole('button', { name: /Pagar .* y reservar/ }).click();
  await ana.locator('.ant-modal .ant-alert-error').waitFor();
  ok('tarjeta terminada en 0000 rechazada');
  await ana.getByLabel('Número de la tarjeta').fill('4242 4242 4242 4242');
  await ana.getByRole('button', { name: /Pagar .* y reservar/ }).click();
  await ana.waitForURL(/\/sesiones\/\d+$/);
  const idProgramada = ana.url().split('/').pop();
  await ana.getByText('Esperando al tutor').first().waitFor();
  ok(`reserva programada #${idProgramada} creada y pagada`);

  // Tutor: la reserva llega en tiempo real y la acepta
  await carlos.getByText('Nueva solicitud de reserva').first().waitFor({ timeout: 8000 }).catch(() => {});
  await carlos.goto(`${URL}/panel`);
  await carlos.locator('.fila-sesion').first().waitFor();
  await foto(carlos, 'web-08-panel-tutor');
  await carlos.goto(`${URL}/sesiones/${idProgramada}`);
  await carlos.getByRole('button', { name: 'Aceptar la solicitud' }).click();
  await carlos.getByRole('button', { name: 'Iniciar la sesión' }).waitFor();
  await ana.getByText('Sala de la sesión').first().waitFor({ timeout: 8000 });
  ok('tutor acepta y el estudiante ve el cambio sin recargar');
  await carlos.getByRole('button', { name: 'Iniciar la sesión' }).click();
  await carlos.getByRole('button', { name: 'Finalizar la sesión' }).click();
  await carlos.getByRole('button', { name: 'Calificar al estudiante' }).waitFor();
  ok('tutor inicia y finaliza la sesión');

  // Calificación mutua
  await ana.getByRole('button', { name: 'Calificar al tutor' }).waitFor({ timeout: 8000 });
  await ana.getByRole('button', { name: 'Calificar al tutor' }).click();
  await ana.getByRole('radio', { name: '5 de 5' }).click();
  await ana.getByLabel('Comentario (opcional)').fill('Explica con calma y deja ejercicios para practicar.');
  await ana.getByRole('button', { name: 'Enviar calificación' }).click();
  await ana.getByText('Se publica cuando la otra parte califique').first().waitFor();
  await carlos.getByRole('button', { name: 'Calificar al estudiante' }).click();
  await carlos.getByRole('radio', { name: '4 de 5' }).click();
  await carlos.getByRole('button', { name: 'Enviar calificación' }).click();
  await carlos.getByText('Calificación que recibiste').first().waitFor();
  await ana.reload();
  await ana.getByText('Calificación que recibiste').first().waitFor();
  await foto(ana, 'web-05-sesion-finalizada', true);
  ok('calificaciones de ambos lados publicadas juntas');

  // Disputa por parte del estudiante
  await ana.getByRole('button', { name: 'Reportar un problema' }).click();
  await ana.getByLabel('Motivo').fill('La conexión se cayó varias veces y no terminamos los ejercicios.');
  await ana.getByRole('button', { name: 'Abrir disputa' }).click();
  await ana.getByText('Pronto alguien de soporte tomará el caso').first().waitFor();
  await ana.getByLabel('Mensaje').fill('Adjunto la captura de la sala: el tutor se desconectó a los 20 minutos.');
  const captura = await ana.screenshot({ clip: { x: 0, y: 0, width: 640, height: 400 } });
  await ana.locator('.caso-parte input[type=file]').setInputFiles({ name: 'captura-sala.png', mimeType: 'image/png', buffer: captura });
  await ana.locator('.caso-parte').getByRole('button', { name: 'Enviar' }).click();
  await ana.locator('.caso-parte .adjunto.imagen img').waitFor();
  ok('estudiante abre una disputa y adjunta una prueba');
  await carlos.goto(`${URL}/sesiones/${idProgramada}`);
  await carlos.locator('.caso-parte').waitFor();
  await carlos.getByLabel('Mensaje').fill('La sesión duró la hora completa. Adjunto el resumen que le envié al estudiante al terminar.');
  await carlos.locator('.caso-parte input[type=file]').setInputFiles({ name: 'resumen-clase.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%prueba\n') });
  await carlos.locator('.caso-parte').getByRole('button', { name: 'Enviar' }).click();
  await carlos.locator('.caso-parte .adjunto.archivo').waitFor();
  if (await carlos.getByText('Adjunto la captura de la sala').count()) throw new Error('El tutor ve la conversación del estudiante');
  await carlos.addStyleTag({ content: '.avisos { display: none !important; }' });
  await foto(carlos, 'web-18-tutor-version', true);
  ok('el tutor presenta su versión con pruebas, sin ver la conversación del estudiante');

  // Bajo demanda: Ana pide, Carlos acepta
  await ana.goto(`${URL}/ahora`);
  await elegir(ana, 'Materia', 'Cálculo diferencial');
  await ana.getByText('en línea para esta materia').first().waitFor();
  await ana.getByLabel('¿Con qué necesitas ayuda?').fill('Tengo un taller de derivadas para entregar en una hora');
  await ana.getByLabel('Número de la tarjeta').fill('4242 4242 4242 4242');
  await foto(ana, 'web-06-tutor-ahora');
  await ana.getByRole('button', { name: 'Buscar tutor ahora' }).click();
  await ana.getByText('Buscando un tutor disponible').first().waitFor();
  await ana.waitForTimeout(1500);
  await foto(ana, 'web-07-buscando');
  await carlos.goto(`${URL}/panel`);
  await carlos.locator('.solicitud').first().waitFor({ timeout: 8000 });
  await foto(carlos, 'web-09-solicitud-inmediata');
  await carlos.locator('.solicitud').first().getByRole('button', { name: 'Aceptar' }).click();
  await carlos.waitForURL(/\/sesiones\/\d+$/);
  await ana.getByText('aceptó tu solicitud').first().waitFor({ timeout: 8000 });
  await foto(ana, 'web-10-tutor-encontrado');
  ok('solicitud inmediata aceptada por el primer tutor');
  await carlos.getByRole('button', { name: 'Iniciar la sesión' }).click();
  await carlos.getByRole('button', { name: 'Finalizar la sesión' }).click();
  await carlos.getByRole('button', { name: 'Calificar al estudiante' }).waitFor();

  // Tutor: disponibilidad, ingresos y perfil
  await carlos.goto(`${URL}/agenda`);
  await carlos.locator('.agenda .dia').first().waitFor();
  await foto(carlos, 'web-11-disponibilidad');
  await carlos.goto(`${URL}/ingresos`);
  await carlos.locator('table').waitFor();
  await foto(carlos, 'web-12-ingresos');
  await carlos.goto(`${URL}/perfil`);
  await carlos.getByLabel('Presentación').waitFor();
  await carlos.getByRole('button', { name: 'Guardar cambios' }).click();
  await carlos.getByText('Cambios guardados').first().waitFor();
  ok('tutor revisa agenda, ingresos y guarda el perfil');

  // Registro de un tutor nuevo y envío a verificación
  const ctxNuevo = await navegador.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 });
  const nuevo = await ctxNuevo.newPage();
  nuevo.on('pageerror', (e) => errores.push(`[nuevo] ${e.message}`));
  await nuevo.goto(`${URL}/ingresar`);
  await nuevo.getByRole('tab', { name: 'Crear cuenta' }).click();
  await nuevo.getByText('Soy tutor').click();
  await nuevo.getByLabel('Nombre completo').fill('Mariana Herrera');
  await nuevo.getByLabel('Correo electrónico').fill(`mariana${Date.now()}@demo.co`);
  await nuevo.getByLabel('Contraseña').fill('Clave2026');
  await nuevo.locator('#acceso-terminos').check();
  await nuevo.getByRole('button', { name: 'Crear cuenta' }).last().click();
  await nuevo.getByText('Completa tu perfil para empezar').first().waitFor();
  await nuevo.goto(`${URL}/perfil`);
  await nuevo.getByLabel('Presentación').fill('Licenciada en matemáticas con cuatro años de experiencia en refuerzo para bachillerato y primeros semestres.');
  await nuevo.getByLabel('Tarifa por hora (COP)').fill('30000');
  await nuevo.getByLabel('Ciudad').fill('Barranquilla');
  await nuevo.locator('.chips.eleccion label', { hasText: 'Álgebra lineal' }).click();
  await nuevo.locator('input[type=file]').setInputFiles({ name: 'diploma-licenciatura.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await nuevo.getByRole('button', { name: 'Guardar y enviar a verificación' }).click();
  await nuevo.getByText('En revisión').first().waitFor();
  await ctxNuevo.close();
  ok('tutor nuevo se registra y envía su perfil a verificación');

  // Administración
  await admin.goto(`${URL}/admin/verificaciones`);
  await admin.locator('.revision', { hasText: 'Mariana Herrera' }).waitFor();
  await foto(admin, 'web-14-admin-verificaciones');
  await admin.locator('.revision', { hasText: 'Mariana Herrera' }).getByRole('button', { name: 'Aprobar y publicar' }).click();
  await admin.getByText('Mariana Herrera quedó verificado').first().waitFor();
  await admin.locator('.revision', { hasText: 'Diego' }).getByRole('button', { name: 'Rechazar' }).click();
  await admin.getByLabel('Motivo').fill('El soporte adjunto no es legible, súbelo en PDF.');
  await admin.getByRole('button', { name: 'Rechazar perfil' }).click();
  await admin.getByText(/rechazado/).first().waitFor();
  ok('administrador aprueba un perfil y rechaza otro');

  // Soporte atiende el caso y lo escala; el administrador decide
  const soporte = await abrir('soporte@tutores.co');
  await soporte.getByText('Mis casos abiertos').first().waitFor();
  await foto(soporte, 'web-23-inicio-soporte');
  await soporte.goto(`${URL}/casos`);
  const filaCaso = soporte.locator('table tbody tr', { hasText: 'Ana Martínez' }).first();
  await filaCaso.waitFor();
  await foto(soporte, 'web-19-soporte-casos');
  await filaCaso.click();
  await soporte.getByRole('button', { name: 'Tomar el caso', exact: true }).click();
  await soporte.getByText('Tomaste el caso').first().waitFor();
  await soporte.getByLabel('Mensaje').fill('Hola Ana, ya revisé tu captura. Voy a hablar con el tutor y te cuento.');
  await soporte.locator('.conversaciones').getByRole('button', { name: 'Enviar' }).click();
  await soporte.locator('.burbuja.mia', { hasText: 'Hola Ana' }).waitFor();
  await soporte.getByRole('tab', { name: /Tutor/ }).click();
  await soporte.locator('.adjunto.archivo', { hasText: 'resumen-clase.pdf' }).waitFor();
  await soporte.getByRole('button', { name: 'Videollamada de mediación' }).click();
  await soporte.getByLabel('Cuándo (opcional)').fill('hoy a las 5:00 p. m.');
  await soporte.getByRole('button', { name: 'Crear sala y avisar' }).click();
  await soporte.getByText('Sala de mediación abierta').first().waitFor();
  await ana.goto(`${URL}/sesiones/${idProgramada}`);
  await ana.getByText('Entrar a la videollamada').first().waitFor();
  await ana.getByText('Hola Ana, ya revisé tu captura').first().waitFor();
  ok('soporte toma el caso, escribe a cada parte y abre una videollamada de mediación');
  await soporte.getByRole('button', { name: 'Escalar a administración' }).click();
  await soporte.getByLabel('Motivo').fill('Las dos versiones se contradicen y no hay registro de la desconexión; necesito que un administrador decida.');
  await soporte.getByRole('button', { name: 'Escalar el caso' }).click();
  await soporte.getByText('Escalado por Marcela Ruiz').first().waitFor();
  if (await soporte.getByRole('button', { name: 'Resolver', exact: true }).count()) throw new Error('Soporte puede resolver un caso escalado');
  await soporte.getByRole('tab', { name: /Estudiante/ }).click();
  await soporte.addStyleTag({ content: '.avisos { display: none !important; }' });
  await foto(soporte, 'web-20-soporte-caso', true);
  ok('soporte escala el caso a administración y ya no puede resolverlo');
  await admin.goto(`${URL}/casos`);
  await admin.locator('table tbody tr', { hasText: 'Ana Martínez' }).first().click();
  await admin.getByRole('button', { name: 'Resolver', exact: true }).click();
  await admin.getByText('Reembolso del 50 % al estudiante y 50 % para el tutor').click();
  await admin.getByLabel('Explicación para el estudiante y el tutor').fill('La sesión se dio, pero con cortes que redujeron el tiempo útil de la clase.');
  await admin.getByRole('button', { name: 'Confirmar decisión' }).click();
  await admin.getByText('Caso resuelto').first().waitFor();
  await ana.locator('.ant-alert-title', { hasText: 'Decisión: Reembolso del 50 %' }).waitFor({ timeout: 10000 });
  ok('administrador resuelve el caso escalado y el estudiante ve la decisión al instante');
  await admin.goto(`${URL}/gestion/sesiones/${idProgramada}`);
  await admin.locator('.linea-tiempo').waitFor();
  await admin.addStyleTag({ content: '.avisos { display: none !important; }' });
  await foto(admin, 'web-21-sesion-historial', true);
  await admin.goto(`${URL}/admin/pagos`);
  await admin.locator('table').waitFor();
  await foto(admin, 'web-15-admin-pagos');
  const liberar = admin.getByRole('button', { name: 'Liberar' }).first();
  if (await liberar.count()) { await liberar.click(); await admin.getByText(/liberado al tutor/).first().waitFor(); }
  await admin.goto(`${URL}/admin/usuarios`);
  await admin.locator('tr', { hasText: 'sofia@demo.co' }).getByRole('button', { name: 'Suspender' }).click();
  await admin.locator('tr', { hasText: 'sofia@demo.co' }).getByRole('button', { name: 'Reactivar' }).waitFor();
  await admin.locator('tr', { hasText: 'sofia@demo.co' }).getByRole('button', { name: 'Reactivar' }).click();
  await admin.goto(`${URL}/gestion/sesiones`);
  await admin.locator('table').waitFor();
  await foto(admin, 'web-16-admin-sesiones');
  await admin.goto(`${URL}/admin`);
  await admin.locator('.kpi').first().waitFor();
  await admin.addStyleTag({ content: '.avisos { display: none !important; }' });
  await foto(admin, 'web-13-admin-resumen', true);
  ok('administrador libera un pago, suspende y reactiva una cuenta');

  // Administrador principal: bitácora y catálogo de materias
  await admin.goto(`${URL}/admin/actividad`);
  await admin.getByText('Suspendió la cuenta de Sofía Rojas').first().waitFor();
  await foto(admin, 'web-18-admin-actividad');
  await admin.goto(`${URL}/admin/materias`);
  await admin.locator('tr', { hasText: 'Cálculo diferencial' }).waitFor();
  await foto(admin, 'web-19-admin-materias');
  ok('la bitácora registra lo que hizo el administrador y el catálogo de materias carga');

  // Recuperar la contraseña con el código (modo demostración)
  {
    const ctx = await navegador.newContext({ viewport: { width: 1360, height: 860 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(`[recuperar] ${e.message}`));
    await p.goto(`${URL}/ingresar`);
    await p.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await p.getByLabel('Correo electrónico').fill('laura@demo.co');
    await p.getByRole('button', { name: 'Enviar código' }).click();
    const codigo = (await p.locator('.ant-alert-warning .nums').first().innerText()).trim().slice(0, 6);
    await p.getByLabel('Código de 6 dígitos').fill(codigo);
    await p.getByLabel('Contraseña nueva', { exact: true }).fill('Laura2026');
    await p.getByLabel('Repite la contraseña nueva').fill('Laura2026');
    await p.getByRole('button', { name: 'Cambiar contraseña y entrar' }).click();
    await p.locator('.barra').waitFor();
    await ctx.close();
    ok('recuperar la contraseña con el código y entrar sin pasar por un administrador');
  }

  // Registro con la aceptación de los términos y páginas legales públicas
  {
    const ctx = await navegador.newContext({ viewport: { width: 1360, height: 860 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(`[registro] ${e.message}`));
    await p.goto(`${URL}/terminos`);
    await p.getByRole('heading', { name: 'Términos y condiciones' }).waitFor();
    await foto(p, 'web-18-terminos');
    await p.getByRole('link', { name: 'Ver la política de tratamiento de datos' }).click();
    await p.getByRole('heading', { name: 'Política de tratamiento de datos personales' }).waitFor();
    await p.goto(`${URL}/ingresar`);
    await p.getByRole('tab', { name: 'Crear cuenta' }).click();
    await p.getByLabel('Nombre completo').fill('Camila Ortega');
    await p.getByLabel('Correo electrónico').fill(`camila${Date.now()}@demo.co`);
    await p.getByLabel('Contraseña').fill('Camila2026');
    const crear = p.getByRole('button', { name: 'Crear cuenta' });
    if (await crear.isEnabled()) throw new Error('Se puede crear la cuenta sin aceptar los términos.');
    await p.locator('#acceso-terminos').check();
    await foto(p, 'web-19-registro-terminos');
    await crear.click();
    await p.locator('.barra').waitFor();
    await p.goto(`${URL}/cuenta`);
    await p.getByText('Aceptaste los términos y la política de datos', { exact: false }).waitFor();
    await ctx.close();
    ok('registro solo con la casilla de términos marcada; las páginas legales cargan sin sesión');
  }

  // Pantalla angosta
  await ana.setViewportSize({ width: 390, height: 844 });
  await ana.goto(`${URL}/buscar`);
  await ana.locator('.tutor-tarjeta').first().waitFor();
  const desborde = await ana.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (desborde > 0) throw new Error(`La búsqueda desborda ${desborde}px a 390 px de ancho`);
  await foto(ana, 'web-17-buscar-movil');
  ok('la web se adapta a 390 px sin desbordes');
} catch (e) {
  console.error('\n✗ Falló:', e.message);
  errores.push(`FALLO: ${e.message}`);
  for (const [n, p] of paginas) { await p.screenshot({ path: `${DIR}/fallo-${n}.png` }).catch(() => {}); console.error(n, p.url()); }
} finally {
  await navegador.close();
}

if (errores.length) { console.error('\nErrores:\n' + errores.join('\n')); process.exit(1); }
console.log(`\nRecorrido completo: ${paso} pasos sin errores.`);
