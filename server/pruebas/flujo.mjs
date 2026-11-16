// Prueba de humo de la API: node pruebas/flujo.mjs [url]
const B = (process.argv[2] || 'http://localhost:3000') + '/api';
let ok = 0, mal = 0;
const check = (nombre, cond, extra = '') => { cond ? ok++ : mal++; console.log(`${cond ? 'OK  ' : 'FALLA'} ${nombre}${cond ? '' : ' -> ' + extra}`); };
async function api(metodo, ruta, token, cuerpo) {
  const r = await fetch(B + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  let d = null; try { d = await r.json(); } catch {}
  return { s: r.status, d };
}
const login = async (email) => (await api('POST', '/auth/login', null, { email, password: 'Demo1234' })).d;
const tarjeta = { metodo: 'TARJETA', numero: '4242424242424242' };

const ana = await login('ana@demo.co'), luis = await login('luis@demo.co');
const carlos = await login('carlos@demo.co'), andres = await login('andres@demo.co'), laura = await login('laura@demo.co');
const admin = await login('rick@tutores.co');
check('Rick Rios es el administrador principal', admin.usuario?.superior === true && admin.usuario.nombre === 'Rick Rios', JSON.stringify(admin.usuario));
check('login estudiante', ana.usuario?.rol === 'ESTUDIANTE', JSON.stringify(ana));
check('login tutor con perfil', carlos.usuario?.tutor?.materias?.length === 3, JSON.stringify(carlos.usuario));
check('login clave mala 401', (await api('POST', '/auth/login', null, { email: 'ana@demo.co', password: 'x' })).s === 401);
check('sin token 401', (await api('GET', '/yo')).s === 401);

// Registro
const correo = `nuevo${Date.now()}@demo.co`;
let r = await api('POST', '/auth/registro', null, { nombre: 'Nuevo Usuario', email: correo, password: 'Clave1234', rol: 'ESTUDIANTE', aceptaTerminos: true });
check('registro', r.s === 200 || r.s === 201, JSON.stringify(r));
r = await api('POST', '/auth/registro', null, { nombre: 'Nuevo Usuario', email: correo, password: 'Clave1234', rol: 'ESTUDIANTE', aceptaTerminos: true });
check('registro duplicado 409', r.s === 409, JSON.stringify(r));
r = await api('POST', '/auth/registro', null, { nombre: 'X Y', email: 'a' + correo, password: 'corta', rol: 'ESTUDIANTE', aceptaTerminos: true });
check('clave débil 400', r.s === 400, JSON.stringify(r));
r = await api('POST', '/auth/registro', null, { nombre: 'Sin Aceptar', email: 'b' + correo, password: 'Clave1234', rol: 'ESTUDIANTE' });
check('registro sin aceptar los términos 400', r.s === 400 && /términos/.test(r.d.error), JSON.stringify(r));
r = await api('POST', '/auth/login', null, { email: correo, password: 'Clave1234' });
check('la cuenta nueva guarda la versión y la fecha de aceptación', r.d.usuario?.terminosVersion === '2026-11-10' && !!r.d.usuario?.terminosAceptadosEn, JSON.stringify(r.d.usuario));
check('las cuentas sembradas traen la aceptación', !!ana.usuario.terminosVersion && !!carlos.usuario.terminosVersion, JSON.stringify(ana.usuario));

// Página de inicio pública
r = await api('GET', '/vitrina');
check('vitrina pública sin token', r.s === 200 && r.d.tutores === 6 && r.d.destacados.length === 4, JSON.stringify(r).slice(0, 200));
check('la vitrina no expone correos', !JSON.stringify(r.d).includes('@'), JSON.stringify(r.d).slice(0, 200));

// Búsqueda
r = await api('GET', '/tutores', ana.token);
check('búsqueda lista 6 aprobados', r.d.length === 6, r.d.length);
r = await api('GET', '/tutores?materia=1&orden=precio', ana.token);
check('filtro materia + orden precio', r.d.length === 2 && r.d[0].tarifaHora <= r.d[1].tarifaHora, JSON.stringify(r.d.map(t => [t.nombre, t.tarifaHora])));
r = await api('GET', '/tutores?precioMax=28000', ana.token);
check('filtro precio', r.d.every(t => t.tarifaHora <= 28000) && r.d.length === 2, JSON.stringify(r.d.map(t => t.tarifaHora)));
const idCarlos = carlos.usuario.id;
r = await api('GET', `/tutores/${idCarlos}`, ana.token);
check('detalle tutor con reseñas', Array.isArray(r.d.resenas) && r.d.disponibilidad.length === 5, JSON.stringify(r.d).slice(0, 200));
const fr = await api('GET', `/tutores/${idCarlos}/franjas`, ana.token);
check('franjas libres', fr.d.length > 5, JSON.stringify(fr.d).slice(0, 200));
console.log('   primera franja', fr.d[0], 'total', fr.d.length);

// Reserva programada
r = await api('GET', `/tutores/${idCarlos}/cotizacion?duracionMin=90`, ana.token);
check('RF-M05-03 desglose antes de reservar', r.d.subtotal === 52500 && r.d.comisionPct === 15 && r.d.comision === 7875 && r.d.netoTutor === 44625 && r.d.impuestos === 0 && r.d.total === 52500, JSON.stringify(r.d));
r = await api('POST', '/sesiones', ana.token, { tutorId: idCarlos, materiaId: 1, inicio: fr.d[0], duracionMin: 60, modalidad: 'VIRTUAL', tema: 'Derivadas', pago: tarjeta });
check('RF-M05-02 tema de menos de 20 caracteres 400', r.s === 400 && /20 caracteres/.test(r.d.error), JSON.stringify(r));
r = await api('POST', '/sesiones', ana.token, { tutorId: idCarlos, materiaId: 1, inicio: fr.d[0], duracionMin: 60, modalidad: 'VIRTUAL', tema: 'Derivadas por regla de la cadena', pago: { metodo: 'TARJETA', numero: '4111111111110000' } });
check('tarjeta 0000 rechazada 402', r.s === 402, JSON.stringify(r));
r = await api('POST', '/sesiones', carlos.token, { tutorId: idCarlos, materiaId: 1, inicio: fr.d[0], duracionMin: 60, modalidad: 'VIRTUAL', tema: 'Derivadas por regla de la cadena', pago: tarjeta });
check('tutor no puede reservar (403)', r.s === 403, JSON.stringify(r));
r = await api('POST', '/sesiones', ana.token, { tutorId: idCarlos, materiaId: 1, inicio: fr.d[0], duracionMin: 60, modalidad: 'VIRTUAL', tema: 'Derivadas por regla de la cadena', pago: tarjeta });
check('reserva creada PENDIENTE_ACEPTACION', r.d?.estado === 'PENDIENTE_ACEPTACION' && r.d.pago?.estado === 'RETENIDO' && r.d.pago.monto === 35000 && r.d.pago.comision === 5250, JSON.stringify(r));
const s1 = r.d.id;
r = await api('POST', '/sesiones', luis.token, { tutorId: idCarlos, materiaId: 1, inicio: fr.d[0], duracionMin: 60, modalidad: 'VIRTUAL', tema: 'Otra sesión a la misma hora del día', pago: tarjeta });
check('franja ocupada 409', r.s === 409, JSON.stringify(r));
r = await api('POST', '/sesiones', ana.token, { tutorId: laura.usuario.id, materiaId: 10, inicio: fr.d[0], duracionMin: 60, modalidad: 'VIRTUAL', tema: 'Conversación para una entrevista', pago: tarjeta });
check('RF-M05-08 el estudiante no reserva dos sesiones cruzadas', r.s === 409 && r.d.error.includes(`#${s1}`), JSON.stringify(r));
r = await api('GET', `/sesiones/${s1}`, luis.token);
check('sesión ajena 403/404', r.s === 403 || r.s === 404, r.s);
r = await api('GET', `/sesiones/${s1}`, carlos.token);
check('tutor ve acciones aceptar/rechazar', r.d.acciones.includes('aceptar') && r.d.acciones.includes('rechazar'), JSON.stringify(r.d.acciones));
r = await api('POST', `/sesiones/${s1}/aceptar`, carlos.token);
check('aceptar -> CONFIRMADA con enlace', r.d?.estado === 'CONFIRMADA' && /jit\.si/.test(r.d.enlace || ''), JSON.stringify(r));
r = await api('POST', `/sesiones/${s1}/calificar`, ana.token, { puntaje: 5, comentario: 'x' });
check('RN-07 no se califica sin finalizar', r.s >= 400, JSON.stringify(r));
// Reprogramación (RF-M05-07): una parte propone, la otra acepta o rechaza
r = await api('GET', `/sesiones/${s1}`, ana.token);
check('las dos partes pueden proponer otra fecha', r.d.acciones.includes('reprogramar'), JSON.stringify(r.d.acciones));
r = await api('POST', `/sesiones/${s1}/reprogramar`, ana.token, { inicio: fr.d[1] });
check('el estudiante propone otra fecha', r.s === 200 && r.d.reprogramacion?.mia && r.d.inicio === fr.d[0], JSON.stringify(r.d.reprogramacion));
r = await api('GET', `/sesiones/${s1}`, carlos.token);
check('el tutor ve la propuesta para responder', r.d.acciones.includes('responder-reprogramacion') && r.d.reprogramacion.propuestaPor.nombre === 'Ana Martínez', JSON.stringify(r.d.acciones));
r = await api('POST', `/sesiones/${s1}/reprogramacion`, carlos.token, { aceptar: false });
check('el tutor rechaza y la fecha no cambia', r.s === 200 && !r.d.reprogramacion && r.d.inicio === fr.d[0], JSON.stringify(r.d));
await api('POST', `/sesiones/${s1}/reprogramar`, carlos.token, { inicio: fr.d[1] });
r = await api('POST', `/sesiones/${s1}/reprogramacion`, ana.token, { aceptar: true });
check('el estudiante acepta la propuesta del tutor', r.s === 200 && r.d.inicio === fr.d[1] && r.d.pago.estado === 'RETENIDO', JSON.stringify(r.d));
r = await api('GET', `/sesiones/${s1}`, ana.token);
check('no se reporta inasistencia antes de la tolerancia', !r.d.acciones.includes('inasistencia'), JSON.stringify(r.d.acciones));
// Corte 2: cuando las dos partes entran a la sala, la sesión pasa sola a En curso
r = await api('POST', `/sesiones/${s1}/sala`, ana.token, {});
r = await api('GET', `/sesiones/${s1}`, ana.token);
check('con una sola parte en la sala sigue confirmada', r.d.estado === 'CONFIRMADA', r.d.estado);
await api('POST', `/sesiones/${s1}/sala`, carlos.token, {});
r = await api('GET', `/sesiones/${s1}`, ana.token);
check('con las dos partes en la sala pasa a EN_CURSO', r.d.estado === 'EN_CURSO' && !!r.d.iniciadaEn, JSON.stringify(r.d));
check('RF-M07-04 el estudiante también puede finalizar', r.d.acciones.includes('finalizar'), JSON.stringify(r.d.acciones));
r = await api('POST', `/sesiones/${s1}/finalizar`, ana.token);
check('finalizar -> FINALIZADA, liberarEn', r.d?.estado === 'FINALIZADA' && !!r.d.pago.liberarEn, JSON.stringify(r));
r = await api('POST', `/sesiones/${s1}/calificar`, ana.token, { puntaje: 5, comentario: 'Explica muy claro.' });
check('califica estudiante', r.s === 200 && r.d.miCalificacion?.puntaje === 5, JSON.stringify(r));
r = await api('GET', `/sesiones/${s1}`, carlos.token);
check('RN-08 tutor aún no ve calificación', r.d.calificacionRecibida == null, JSON.stringify(r.d.calificacionRecibida));
r = await api('POST', `/sesiones/${s1}/calificar`, ana.token, { puntaje: 4, comentario: 'otra' });
check('no calificar dos veces', r.s >= 400, JSON.stringify(r));
r = await api('POST', `/sesiones/${s1}/calificar`, carlos.token, { puntaje: 5, comentario: 'Muy atenta.' });
check('califica tutor y ve la recibida', r.d?.calificacionRecibida?.puntaje === 5, JSON.stringify(r.d?.calificacionRecibida));
check('RF-M08-07 quien recibe el comentario lo puede reportar', r.d.acciones.includes('reportar'), JSON.stringify(r.d.acciones));
r = await api('POST', `/sesiones/${s1}/calificacion/reportar`, carlos.token, { motivo: 'El comentario no corresponde a lo que pasó.' });
check('reportar oculta el comentario', r.s === 200 && r.d.calificacionRecibida.moderacion === 'REPORTADA' && !r.d.acciones.includes('reportar'), JSON.stringify(r.d.calificacionRecibida));
r = await api('GET', `/tutores/${idCarlos}`, luis.token);
check('el comentario reportado no se ve en el perfil', !r.d.resenas.some(x => x.comentario === 'Explica muy claro.'), JSON.stringify(r.d.resenas.slice(0, 2)));
r = await api('POST', `/sesiones/${s1}/disputa`, ana.token, { motivo: 'La sesión duró menos de lo pactado.' });
check('disputa abierta, pago EN_DISPUTA', r.d?.pago?.estado === 'EN_DISPUTA' && r.d.disputa, JSON.stringify(r));
// Caso de soporte: canales separados, pruebas, sala de mediación, escalamiento y resolución
const soporte = await login('soporte@tutores.co');
check('login soporte', soporte.usuario?.rol === 'SOPORTE', JSON.stringify(soporte));
r = await api('GET', '/notificaciones', carlos.token);
check('tutor avisado de la disputa', r.d.lista.some(n => n.titulo === 'Abrieron una disputa'), JSON.stringify(r.d.lista[0]));
r = await api('GET', '/gestion/disputas', soporte.token);
const caso = r.d.find(d => d.sesionId === s1);
check('soporte ve el caso sin asignar', caso?.estado === 'ABIERTA' && !caso.asignado, JSON.stringify(caso));
check('estudiante no entra a gestión', (await api('GET', '/gestion/disputas', ana.token)).s === 403);
check('soporte no entra a administración', (await api('GET', '/admin/pagos', soporte.token)).s === 403);
r = await api('POST', `/gestion/disputas/${caso.id}/tomar`, soporte.token);
r = await api('GET', `/gestion/disputas/${caso.id}`, soporte.token);
check('caso tomado queda en revisión', r.d.estado === 'EN_REVISION' && r.d.asignado?.nombre === 'Marcela Ruiz', JSON.stringify(r.d.asignado));
check('vista de sesión con horas reales', r.d.sesion.tiempos.realInicio && r.d.sesion.tiempos.minutosReales !== null, JSON.stringify(r.d.sesion.tiempos));
await api('POST', `/gestion/disputas/${caso.id}/mensajes`, soporte.token, { canal: 'ESTUDIANTE', texto: 'Ana, ¿tienes capturas de la sala?' });
await api('POST', `/gestion/disputas/${caso.id}/mensajes`, soporte.token, { canal: 'TUTOR', texto: 'Carlos, cuéntanos tu versión.' });
await api('POST', `/gestion/disputas/${caso.id}/mensajes`, soporte.token, { canal: 'INTERNO', texto: 'Nota solo para el equipo.' });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
r = await api('POST', '/adjuntos', carlos.token, { nombre: 'captura-chat.png', tipo: 'image/png', datos: PNG });
check('subir prueba en imagen', r.s === 201 && r.d.tamano > 0, JSON.stringify(r));
const adj = r.d.id;
r = await api('POST', '/adjuntos', carlos.token, { nombre: 'falso.png', tipo: 'image/png', datos: Buffer.from('hola').toString('base64') });
check('rechaza archivo con tipo falso', r.s === 400, JSON.stringify(r));
r = await api('POST', `/sesiones/${s1}/disputa/mensajes`, carlos.token, { texto: 'La sesión duró la hora completa; adjunto el chat.', adjuntoId: adj });
check('tutor presenta su versión con prueba', r.s === 201 && r.d.some(m => m.adjunto?.id === adj), JSON.stringify(r));
check('tutor solo ve su canal', r.d.every(m => m.canal === 'TUTOR'), JSON.stringify(r.d.map(m => m.canal)));
r = await api('GET', `/sesiones/${s1}/disputa/mensajes`, ana.token);
check('estudiante solo ve su canal', r.d.length === 1 && r.d[0].canal === 'ESTUDIANTE', JSON.stringify(r.d));
check('estudiante no ve la prueba del tutor', (await fetch(`${B}/adjuntos/${adj}`, { headers: { Authorization: 'Bearer ' + ana.token } })).status === 403);
check('soporte ve la prueba', (await fetch(`${B}/adjuntos/${adj}`, { headers: { Authorization: 'Bearer ' + soporte.token } })).status === 200);
check('tutor ve su prueba con token en la URL', (await fetch(`${B}/adjuntos/${adj}?t=${carlos.token}`)).status === 200);
r = await api('POST', `/gestion/disputas/${caso.id}/sala`, soporte.token, {});
check('sala de mediación creada', r.d?.sala?.includes('meet.jit.si'), JSON.stringify(r));
r = await api('GET', `/sesiones/${s1}`, ana.token);
check('estudiante ve la sala de mediación', !!r.d.disputa.sala && r.d.disputa.asignado === 'Marcela Ruiz', JSON.stringify(r.d.disputa));
r = await api('POST', `/sesiones/${s1}/sala`, ana.token, { cual: 'MEDIACION' });
check('registro de entrada a la mediación', r.s === 200, JSON.stringify(r));
r = await api('POST', `/gestion/disputas/${caso.id}/escalar`, soporte.token, { motivo: 'Versiones opuestas, necesito decisión de un administrador.' });
check('soporte escala el caso', r.s === 200, JSON.stringify(r));
r = await api('POST', `/gestion/disputas/${caso.id}/resolver`, soporte.token, { decision: 'LIBERAR', resolucion: 'Intento de resolver un caso escalado.' });
check('soporte no resuelve un caso escalado', r.s === 403, JSON.stringify(r));
r = await api('GET', `/gestion/disputas/${caso.id}`, admin.token);
check('admin puede resolver el escalado', r.d.estado === 'ESCALADA' && r.d.permisos.resolver && r.d.mensajes.some(m => m.canal === 'INTERNO'), JSON.stringify(r.d.permisos));
r = await api('POST', `/gestion/disputas/${caso.id}/resolver`, admin.token, { decision: 'REEMBOLSO_PARCIAL', resolucion: 'La sesión se dio pero fue más corta de lo pactado.' });
check('admin resuelve con reembolso parcial', r.s === 200, JSON.stringify(r));
r = await api('GET', `/sesiones/${s1}`, ana.token);
check('pago con reembolso del 50 %', r.d.pago.estado === 'REEMBOLSO_PARCIAL' && r.d.pago.reembolso === 17500 && r.d.disputa.estado === 'RESUELTA' && !r.d.disputa.sala, JSON.stringify(r.d.pago));
r = await api('POST', `/sesiones/${s1}/disputa/mensajes`, carlos.token, { texto: 'Un mensaje más' });
check('no se escribe en un caso resuelto', r.s === 409, JSON.stringify(r));
r = await api('GET', `/sesiones/${s1}/historial`, ana.token);
const tipos = r.d.map(e => e.tipo);
check('historial público con hora exacta', ['SESION_CREADA', 'PAGO_COBRADO', 'ACEPTADA', 'REPROGRAMACION_PROPUESTA', 'REPROGRAMADA', 'INICIADA', 'FINALIZADA', 'DISPUTA_ABIERTA', 'DESCARGO', 'CASO_RESUELTO'].every(t => tipos.includes(t)), JSON.stringify(tipos));
check('el estudiante no ve el escalamiento interno', !tipos.includes('CASO_ESCALADO'));
r = await api('GET', `/gestion/sesiones/${s1}`, soporte.token);
check('soporte ve el historial completo', r.d.eventos.some(e => e.tipo === 'CASO_ESCALADO' && e.interno), JSON.stringify(r.d.eventos.map(e => e.tipo)));
r = await api('POST', '/admin/usuarios', admin.token, { nombre: 'Nuevo Agente', email: `agente${Date.now()}@tutores.co`, password: 'Soporte2026', rol: 'SOPORTE' });
check('admin crea cuenta de soporte', r.s === 201 && r.d.rol === 'SOPORTE', JSON.stringify(r));

// Cancelación RN-06: reserva lejana (>24 h) -> 100 %
const lejos = fr.d.find(f => Date.parse(f) - Date.now() > 25 * 3600e3);
r = await api('POST', '/sesiones', luis.token, { tutorId: idCarlos, materiaId: 2, inicio: lejos, duracionMin: 90, modalidad: 'PRESENCIAL', tema: 'Integración por partes', pago: { metodo: 'NEQUI', numero: '3001234567' } });
check('reserva 90 min presencial', r.d?.precio === 52500 && r.d.reembolsoSiCancela === 100, JSON.stringify(r));
const s2 = r.d.id;
r = await api('POST', `/sesiones/${s2}/cancelar`, luis.token);
check('cancelar -> reembolso 100%', r.d?.estado === 'CANCELADA' && r.d.pago.reembolso === 52500, JSON.stringify(r));
// Rechazo del tutor: se devuelve todo y se sugieren otros tutores de la materia (A1 de P-04)
r = await api('POST', '/sesiones', luis.token, { tutorId: idCarlos, materiaId: 1, inicio: lejos, duracionMin: 60, modalidad: 'VIRTUAL', tema: 'Límites y continuidad', pago: { metodo: 'PSE', numero: '1234567' } });
const s3 = r.d.id;
r = await api('POST', `/sesiones/${s3}/rechazar`, carlos.token);
check('rechazar -> CANCELADA con reembolso', r.d?.estado === 'CANCELADA' && r.d.pago.estado === 'REEMBOLSADO', JSON.stringify(r));
r = await api('GET', `/sesiones/${s3}`, luis.token);
check('el estudiante recibe tutores sugeridos', r.d.sugerencias.length > 0 && r.d.sugerencias.every(t => t.id !== idCarlos), JSON.stringify(r.d.sugerencias));

// Bajo demanda por turnos (P-06): Carlos y Andrés dictan Cálculo diferencial y están en línea
await api('POST', '/tutor/en-linea', andres.token, { enLinea: true });
r = await api('POST', '/sesiones/demanda', ana.token, { materiaId: 1, duracionMin: 60, tema: 'Tengo parcial mañana de límites', pago: tarjeta });
check('demanda BUSCANDO_TUTOR con turno para el primer candidato de 2', r.d?.estado === 'BUSCANDO_TUTOR' && r.d.busqueda?.candidato === 1 && r.d.busqueda.total === 2, JSON.stringify(r.d));
check('RF-M06-07 el pago se retiene antes de buscar (valor estimado)', r.d.pago?.estado === 'RETENIDO' && r.d.pago.monto === 35000, JSON.stringify(r.d.pago));
const d1 = r.d.id;
const limite = Date.parse(r.d.expiraEn) - Date.now();
check('límite global de 5 minutos', limite > 280e3 && limite <= 300e3, limite);
r = await api('GET', '/demanda/abiertas', carlos.token);
const turno = r.d.find(x => x.id === d1);
check('el mejor calificado tiene el turno de 45 s', !!turno && Date.parse(turno.expiraEn) - Date.now() <= 45e3, JSON.stringify(r.d));
r = await api('GET', '/demanda/abiertas', andres.token);
check('el segundo candidato todavía no la ve', !r.d.some(x => x.id === d1), JSON.stringify(r.d));
r = await api('GET', '/demanda/abiertas', laura.token);
check('tutor de otra materia no la ve', !r.d.some(x => x.id === d1), JSON.stringify(r.d));
const [a, b] = await Promise.all([api('POST', `/sesiones/${d1}/aceptar`, carlos.token), api('POST', `/sesiones/${d1}/aceptar`, andres.token)]);
check('RN-04 solo uno gana', [a.s, b.s].sort().join() === '200,409' && a.s === 200, `${a.s} ${b.s} ${JSON.stringify(b.d)}`);
r = await api('GET', `/sesiones/${d1}`, ana.token);
check('demanda CONFIRMADA y cobrada', r.d.estado === 'CONFIRMADA' && r.d.pago?.estado === 'RETENIDO' && r.d.pago.monto === 35000, JSON.stringify(r.d));
r = await api('POST', `/sesiones/${d1}/aceptar`, laura.token);
check('tutor no elegible no acepta', r.s >= 400, JSON.stringify(r));
r = await api('GET', `/gestion/sesiones/${d1}`, soporte.token);
check('el orden de difusión queda en el historial interno', r.d.eventos.some(e => e.tipo === 'TURNO' && e.interno && e.texto.includes('Carlos')), JSON.stringify(r.d.eventos.map(e => e.tipo)));

// A1 de P-06: el primero pasa y la solicitud sigue con el siguiente; la retención se ajusta a la tarifa de quien acepta
r = await api('POST', '/sesiones/demanda', luis.token, { materiaId: 1, duracionMin: 60, tema: 'Derivadas implícitas para el quiz', pago: tarjeta });
const d3 = r.d.id;
r = await api('POST', `/sesiones/${d3}/rechazar`, andres.token);
check('solo el tutor en turno puede pasar', r.s === 409, JSON.stringify(r));
r = await api('POST', `/sesiones/${d3}/rechazar`, carlos.token);
check('el tutor en turno pasa', r.s === 200, JSON.stringify(r));
r = await api('GET', `/sesiones/${d3}`, luis.token);
check('el turno pasa al segundo candidato', r.d.estado === 'BUSCANDO_TUTOR' && r.d.busqueda.candidato === 2, JSON.stringify(r.d.busqueda));
r = await api('POST', `/sesiones/${d3}/aceptar`, andres.token);
check('el segundo acepta y la retención se ajusta a su tarifa', r.s === 200 && r.d.estado === 'CONFIRMADA' && r.d.pago.monto === 28000, JSON.stringify(r.d.pago));

// A4 de P-06: cancelar mientras se busca libera toda la retención
r = await api('POST', '/sesiones/demanda', luis.token, { materiaId: 2, duracionMin: 60, tema: 'Integrales por fracciones parciales', pago: tarjeta });
check('E4 de P-04 no se pide tutor si se cruza con otra sesión', r.s === 409 && /se cruza/.test(r.d.error), JSON.stringify(r));
r = await api('POST', `/sesiones/${d3}/cancelar`, luis.token);
r = await api('POST', '/sesiones/demanda', luis.token, { materiaId: 2, duracionMin: 60, tema: 'Integrales por fracciones parciales', pago: tarjeta });
const d4 = r.d.id;
r = await api('POST', `/sesiones/${d4}/cancelar`, luis.token);
check('cancelar la búsqueda libera la retención', r.d.estado === 'CANCELADA' && r.d.pago.estado === 'REEMBOLSADO' && r.d.pago.reembolso === r.d.pago.monto, JSON.stringify(r.d));

// Ejecución de la sesión inmediata: el tutor la inicia y la finaliza; el filtro retiene el comentario con datos personales
r = await api('POST', `/sesiones/${d1}/iniciar`, carlos.token);
check('iniciar (modo demo) -> EN_CURSO', r.d?.estado === 'EN_CURSO', JSON.stringify(r));
r = await api('POST', `/sesiones/${d1}/finalizar`, carlos.token);
check('el tutor finaliza', r.d?.estado === 'FINALIZADA', JSON.stringify(r.d?.estado));
r = await api('POST', `/sesiones/${d1}/calificar`, ana.token, { puntaje: 4, comentario: 'Buena clase. Escríbanme al 300 123 4567 si quieren saber más.' });
check('E2 de P-08 el filtro retiene datos personales', r.s === 200 && r.d.miCalificacion.moderacion === 'RETENIDA' && /teléfono/.test(r.d.comentarioRetenido), JSON.stringify(r.d.miCalificacion));
r = await api('POST', `/sesiones/${d1}/disputa`, carlos.token, { motivo: 'La estudiante se desconectó a la mitad y luego pidió reembolso por chat.' });
check('RF-M11-03 el tutor también abre una disputa', r.s === 200 && r.d.disputa?.autor.rol === 'TUTOR' && r.d.pago.estado === 'EN_DISPUTA', JSON.stringify(r.d.disputa));
r = await api('GET', '/gestion/disputas', soporte.token);
check('soporte ve quién abrió el caso', r.d.find(c => c.sesionId === d1)?.autor.nombre === 'Carlos Mendoza', JSON.stringify(r.d[0]));

// Demanda con un solo candidato que pasa, y sin tutores en línea
r = await api('POST', '/sesiones/demanda', luis.token, { materiaId: 10, duracionMin: 60, tema: 'Conversación para entrevista', pago: tarjeta });
const d2 = r.d.id; check('demanda inglés con un candidato', r.d.busqueda?.total === 1, JSON.stringify(r.d.busqueda));
r = await api('POST', `/sesiones/${d2}/rechazar`, laura.token);
check('descartar demanda', r.s === 200, JSON.stringify(r));
r = await api('GET', `/sesiones/${d2}`, luis.token);
check('sin más candidatos -> SIN_TUTOR y retención liberada', r.d.estado === 'SIN_TUTOR' && r.d.pago.estado === 'REEMBOLSADO' && r.d.sugerencias.length >= 0, JSON.stringify(r.d));
r = await api('POST', '/sesiones/demanda', luis.token, { materiaId: 6, duracionMin: 60, tema: 'Estequiometría urgente', pago: tarjeta });
check('sin tutores en línea -> SIN_TUTOR sin cobro', r.d?.estado === 'SIN_TUTOR' && !r.d.pago, JSON.stringify(r.d));

// Moderación de comentarios (RF-M11-05)
r = await api('GET', '/gestion/moderacion', soporte.token);
check('soporte ve los comentarios por moderar', r.d.pendientes.length === 4 && r.d.pendientes.some(c => c.moderacion === 'RETENIDA') && r.d.pendientes.some(c => c.moderacion === 'REPORTADA'), JSON.stringify(r.d.pendientes.map(c => c.moderacion)));
check('estudiante no entra a moderación', (await api('GET', '/gestion/moderacion', ana.token)).s === 403);
const reportado = r.d.pendientes.find(c => c.sesionId === s1);
r = await api('POST', `/gestion/moderacion/${reportado.id}`, soporte.token, { decision: 'APROBAR', motivo: 'El comentario es una opinión válida.' });
check('soporte aprueba el comentario reportado', r.s === 200 && r.d.moderacion === 'VISIBLE' && r.d.moderadaPor.nombre === 'Marcela Ruiz', JSON.stringify(r.d));
r = await api('GET', '/notificaciones', ana.token);
check('el autor recibe la decisión con el motivo', r.d.lista.some(n => n.titulo === 'Revisamos tu comentario' && n.cuerpo.includes('opinión válida')), JSON.stringify(r.d.lista[0]));
const retenido = (await api('GET', '/gestion/moderacion', soporte.token)).d.pendientes.find(c => c.sesionId === d1);
r = await api('POST', `/gestion/moderacion/${retenido.id}`, soporte.token, { decision: 'OCULTAR', motivo: 'Incluye un número de teléfono.' });
check('soporte oculta el comentario retenido', r.d.moderacion === 'OCULTA', JSON.stringify(r.d));

// Tutor: perfil, disponibilidad, ingresos
r = await api('GET', '/tutor/ingresos', carlos.token);
check('ingresos tutor', typeof r.d.disponible === 'number' && Array.isArray(r.d.movimientos), JSON.stringify(r.d).slice(0, 200));
r = await api('PUT', '/tutor/disponibilidad', carlos.token, { bloques: [{ diaSemana: 1, horaInicio: 14, horaFin: 20 }, { diaSemana: 2, horaInicio: 14, horaFin: 20 }, { diaSemana: 3, horaInicio: 14, horaFin: 20 }, { diaSemana: 4, horaInicio: 14, horaFin: 20 }, { diaSemana: 5, horaInicio: 14, horaFin: 20 }] });
check('guardar disponibilidad', r.s === 200, JSON.stringify(r));
r = await api('PUT', '/tutor/disponibilidad', carlos.token, { bloques: [{ diaSemana: 1, horaInicio: 14, horaFin: 12 }] });
check('disponibilidad inválida 400', r.s === 400, JSON.stringify(r));

// Admin
r = await api('GET', '/admin/resumen', admin.token);
check('admin resumen', r.s === 200 && r.d.porMateria?.length > 0, JSON.stringify(r.d).slice(0, 300));
console.log('   resumen:', JSON.stringify(r.d).slice(0, 600));
check('admin bloqueado a estudiante', (await api('GET', '/admin/resumen', ana.token)).s === 403);
r = await api('GET', '/admin/tutores?verificacion=PENDIENTE', admin.token);
check('admin ve tutor pendiente', r.d.length === 1, JSON.stringify(r.d));
const diego = r.d[0];
r = await api('POST', `/admin/tutores/${diego.id}/verificar`, admin.token, { aprobar: false, motivo: 'El documento no es legible.' });
check('rechazar verificación', r.s === 200, JSON.stringify(r));
const dg = await login('diego@demo.co');
r = await api('PUT', '/tutor/perfil', dg.token, { bio: 'Ingeniero de sistemas con experiencia en monitorías de programación.', tarifaHora: 30000, modalidad: 'VIRTUAL', ciudad: 'Barranquilla', materias: [7, 8], documento: 'cedula_diego.pdf', enviar: true });
check('tutor reenvía perfil a revisión', r.s === 200 && r.d.tutor?.verificacion === 'PENDIENTE', JSON.stringify(r));
r = await api('POST', `/admin/tutores/${diego.id}/verificar`, admin.token, { aprobar: true });
check('aprobar verificación', r.s === 200, JSON.stringify(r));
r = await api('GET', '/tutores', ana.token); check('ahora 7 tutores visibles', r.d.length === 7, r.d.length);
r = await api('GET', '/admin/pagos', admin.token); check('admin pagos', r.d.length > 10, r.d.length);
const ret = r.d.find(p => p.estado === 'RETENIDO');
r = await api('POST', `/admin/pagos/${ret.id}/liberar`, admin.token); check('liberar pago manual', r.s === 200 || r.s === 409, JSON.stringify(r));
r = await api('GET', '/admin/usuarios?q=sofia', admin.token);
const sofia = r.d[0];
r = await api('POST', `/admin/usuarios/${sofia.id}/estado`, admin.token, { estado: 'SUSPENDIDO' });
check('suspender usuario', r.s === 200, JSON.stringify(r));
check('suspendido no entra', (await api('POST', '/auth/login', null, { email: 'sofia@demo.co', password: 'Demo1234' })).s >= 400);
await api('POST', `/admin/usuarios/${sofia.id}/estado`, admin.token, { estado: 'ACTIVO' });
r = await api('GET', '/notificaciones', ana.token); check('notificaciones', r.d.sinLeer > 0 && r.d.lista.length > 0, JSON.stringify(r.d).slice(0, 200));
r = await api('POST', '/notificaciones/leer', ana.token);
r = await api('GET', '/notificaciones', ana.token); check('marcar leídas', r.d.sinLeer === 0);
r = await api('GET', '/sesiones', ana.token); check('listado de sesiones', r.d.length >= 3, r.d.length);

// Jerarquía de administración: Rick es el principal y los demás admins no lo pueden tocar
const idRick = admin.usuario.id;
const correoAdmin2 = `admin${Date.now()}@tutores.co`;
r = await api('POST', '/admin/usuarios', admin.token, { nombre: 'Andrea Gómez', email: correoAdmin2, password: 'Temporal2026', rol: 'ADMIN' });
check('Rick crea otro administrador', r.s === 201 && r.d.rol === 'ADMIN' && r.d.acciones.includes('suspender'), JSON.stringify(r));
const idAdmin2 = r.d.id;
let admin2 = (await api('POST', '/auth/login', null, { email: correoAdmin2, password: 'Temporal2026' })).d;
check('la cuenta nueva debe cambiar la clave', admin2.usuario?.debeCambiarPassword === true, JSON.stringify(admin2.usuario));
r = await api('PUT', '/yo/password', admin2.token, { actual: 'Temporal2026', nueva: 'Andrea2026' });
check('cambiar la propia contraseña', r.s === 200 && !r.d.usuario.debeCambiarPassword && !!r.d.token, JSON.stringify(r));
check('el token viejo deja de servir', (await api('GET', '/yo', admin2.token)).s === 401);
admin2 = r.d;
r = await api('PUT', '/yo/password', admin2.token, { actual: 'mala', nueva: 'Otra2026x' });
check('clave actual incorrecta 400', r.s === 400, JSON.stringify(r));
r = await api('GET', '/admin/usuarios', admin2.token);
check('un admin normal no tiene acciones sobre Rick', r.d.find(u => u.id === idRick)?.acciones.length === 0, JSON.stringify(r.d.find(u => u.id === idRick)));
r = await api('POST', `/admin/usuarios/${idRick}/estado`, admin2.token, { estado: 'SUSPENDIDO' });
check('un admin normal no suspende a Rick (403)', r.s === 403, JSON.stringify(r));
r = await api('POST', `/admin/usuarios/${idRick}/password`, admin2.token, { password: 'Hackeo2026' });
check('un admin normal no restablece la clave de Rick (403)', r.s === 403, JSON.stringify(r));
r = await api('PATCH', `/admin/usuarios/${idRick}`, admin2.token, { nombre: 'Otro Nombre' });
check('un admin normal no edita a Rick (403)', r.s === 403, JSON.stringify(r));
r = await api('POST', '/admin/usuarios', admin2.token, { nombre: 'Otro Admin', email: `x${Date.now()}@tutores.co`, password: 'Clave2026', rol: 'ADMIN' });
check('un admin normal no crea administradores (403)', r.s === 403, JSON.stringify(r));
r = await api('POST', `/admin/usuarios/${idRick}/estado`, admin.token, { estado: 'SUSPENDIDO' });
check('Rick no se suspende a sí mismo', r.s === 403, JSON.stringify(r));

// El admin normal gestiona a un estudiante; Rick gestiona al admin normal
const idLuis = luis.usuario.id;
r = await api('POST', `/admin/usuarios/${idLuis}/password`, admin2.token, { password: 'Temporal123', debeCambiar: true });
check('admin restablece la clave de un estudiante', r.s === 200 && r.d.debeCambiarPassword, JSON.stringify(r));
check('las sesiones del estudiante se cierran', (await api('GET', '/yo', luis.token)).s === 401);
r = await api('POST', '/auth/login', null, { email: 'luis@demo.co', password: 'Temporal123' });
check('entra con la temporal y debe cambiarla', r.s === 200 && r.d.usuario.debeCambiarPassword === true, JSON.stringify(r));
r = await api('PATCH', `/admin/usuarios/${idLuis}`, admin2.token, { nombre: 'Luis Alberto Herrera' });
check('admin edita el nombre de un estudiante', r.s === 200 && r.d.nombre === 'Luis Alberto Herrera', JSON.stringify(r));
r = await api('PATCH', `/admin/usuarios/${idLuis}`, admin2.token, { email: 'ana@demo.co' });
check('correo repetido 409', r.s === 409, JSON.stringify(r));
r = await api('PATCH', `/admin/usuarios/${idAdmin2}`, admin.token, { rol: 'SOPORTE' });
check('Rick cambia el rol de un admin a soporte', r.s === 200 && r.d.rol === 'SOPORTE', JSON.stringify(r));
r = await api('GET', '/admin/usuarios', admin2.token);
check('al pasar a soporte pierde el panel de admin (403)', r.s === 403, JSON.stringify(r).slice(0, 120));
r = await api('POST', `/admin/usuarios/${idAdmin2}/estado`, admin.token, { estado: 'SUSPENDIDO' });
check('Rick suspende la cuenta', r.s === 200, JSON.stringify(r));

// Catálogo de materias
r = await api('POST', '/admin/materias', admin.token, { nombre: 'Termodinámica', area: 'Ciencias' });
check('crear materia', r.s === 201 && r.d.activa === true, JSON.stringify(r));
const idTermo = r.d.id;
r = await api('POST', '/admin/materias', admin.token, { nombre: 'termodinámica', area: 'Ciencias' });
check('materia repetida 409', r.s === 409, JSON.stringify(r));
r = await api('GET', '/materias', ana.token); check('la materia nueva aparece', r.d.some(m => m.id === idTermo));
r = await api('PATCH', `/admin/materias/${idTermo}`, admin.token, { activa: false });
check('desactivar materia', r.s === 200 && r.d.activa === false, JSON.stringify(r));
r = await api('GET', '/materias', ana.token); check('la materia desactivada no aparece', !r.d.some(m => m.id === idTermo));
r = await api('POST', '/sesiones/demanda', ana.token, { materiaId: idTermo, duracionMin: 60, tema: 'Primera ley de la termodinámica', pago: tarjeta });
check('no se pide tutor de una materia inactiva', r.s === 400, JSON.stringify(r));

// Exportar y bitácora
let res = await fetch(B + '/admin/exportar/usuarios.csv', { headers: { Authorization: 'Bearer ' + admin.token } });
let csv = await res.text();
check('CSV de usuarios', res.ok && res.headers.get('content-type')?.includes('text/csv') && csv.includes('rick@tutores.co'), csv.slice(0, 120));
res = await fetch(B + '/admin/exportar/pagos.csv', { headers: { Authorization: 'Bearer ' + admin.token } });
csv = await res.text();
check('CSV de pagos', res.ok && csv.split('\r\n').length > 10, csv.slice(0, 120));
check('CSV solo para admin', (await fetch(B + '/admin/exportar/pagos.csv', { headers: { Authorization: 'Bearer ' + ana.token } })).status === 403);
r = await api('GET', '/admin/auditoria', admin.token);
const acciones = r.d.map(a => a.accion);
check('la bitácora registra las acciones', ['CUENTA_CREADA', 'PASSWORD_RESTABLECIDA', 'CUENTA_EDITADA', 'CUENTA_SUSPENDIDA', 'MATERIA_CREADA', 'EXPORTACION', 'TUTOR_APROBADO'].every(a => acciones.includes(a)), JSON.stringify(acciones));
// Recuperar la contraseña con un código (sin pasar por un administrador)
r = await api('POST', '/auth/recuperar', null, { email: 'noexiste@demo.co' });
check('recuperar con correo desconocido no revela nada', r.s === 200 && !r.d.codigoDemo, JSON.stringify(r));
r = await api('POST', '/auth/recuperar', null, { email: 'sofia@demo.co' });
check('recuperar entrega código en modo demo', r.s === 200 && /^\d{6}$/.test(r.d.codigoDemo ?? ''), JSON.stringify(r));
const codigo = r.d.codigoDemo;
const sofiaAntes = await login('sofia@demo.co');
r = await api('POST', '/auth/restablecer', null, { email: 'sofia@demo.co', codigo: codigo === '000000' ? '111111' : '000000', nueva: 'Recupero2026' });
check('código equivocado 400', r.s === 400, JSON.stringify(r));
r = await api('POST', '/auth/restablecer', null, { email: 'sofia@demo.co', codigo, nueva: 'Recupero2026' });
check('restablecer con el código deja la sesión iniciada', r.s === 200 && !!r.d.token && r.d.usuario.email === 'sofia@demo.co', JSON.stringify(r));
check('el token anterior deja de servir', (await api('GET', '/yo', sofiaAntes.token)).s === 401);
r = await api('POST', '/auth/restablecer', null, { email: 'sofia@demo.co', codigo, nueva: 'Otra2026x' });
check('el código no se puede usar dos veces', r.s === 400, JSON.stringify(r));
check('entra con la contraseña nueva', (await api('POST', '/auth/login', null, { email: 'sofia@demo.co', password: 'Recupero2026' })).s === 200);

// Solicitudes de materias: el tutor pide, el administrador aprueba o rechaza
const paola = await login('paola@demo.co');
r = await api('GET', '/admin/solicitudes-materia', admin.token);
check('la solicitud sembrada aparece al admin', r.d.some(s => s.nombre === 'Microeconomía' && s.estado === 'PENDIENTE'), JSON.stringify(r.d).slice(0, 200));
r = await api('GET', '/admin/resumen', admin.token); check('el resumen cuenta las solicitudes pendientes', r.d.solicitudesMateria >= 1, r.d.solicitudesMateria);
r = await api('POST', '/tutor/solicitudes-materia', paola.token, { nombre: 'Estadística', area: 'Matemáticas', motivo: 'La enseño hace años en la universidad.' });
check('no se pide una materia que ya está en el catálogo (409)', r.s === 409, JSON.stringify(r));
r = await api('POST', '/tutor/solicitudes-materia', paola.token, { nombre: 'Finanzas personales', area: 'Negocios', motivo: 'Me la piden estudiantes de primeros semestres.' });
check('el tutor pide una materia nueva', r.s === 201 && r.d.estado === 'PENDIENTE', JSON.stringify(r));
const idFinanzas = r.d.id;
r = await api('POST', '/tutor/solicitudes-materia', paola.token, { nombre: 'finanzas personales', area: 'Negocios', motivo: 'Repito la misma solicitud otra vez.' });
check('solicitud repetida 409', r.s === 409, JSON.stringify(r));
check('un estudiante no pide materias (403)', (await api('POST', '/tutor/solicitudes-materia', ana.token, { nombre: 'Otra', area: 'Otra', motivo: 'No debería poder.' })).s >= 401);
r = await api('GET', '/admin/solicitudes-materia', admin.token);
const micro = r.d.find(s => s.nombre === 'Microeconomía');
r = await api('POST', `/admin/solicitudes-materia/${micro.id}/aprobar`, admin.token, {});
check('el admin aprueba la solicitud', r.s === 200 && r.d.estado === 'APROBADA' && r.d.asignada === true, JSON.stringify(r));
r = await api('GET', '/materias', paola.token); check('la materia aprobada entra al catálogo', r.d.some(m => m.nombre === 'Microeconomía'));
r = await api('GET', '/yo', paola.token); check('y queda en el perfil del tutor', r.d.tutor.materias.some(m => m.nombre === 'Microeconomía'), JSON.stringify(r.d.tutor.materias));
r = await api('POST', `/admin/solicitudes-materia/${micro.id}/aprobar`, admin.token, {});
check('una solicitud respondida no se responde otra vez (409)', r.s === 409, JSON.stringify(r));
r = await api('POST', `/admin/solicitudes-materia/${idFinanzas}/rechazar`, admin.token, { motivo: 'Por ahora el catálogo es solo académico.' });
check('el admin rechaza con motivo', r.s === 200 && r.d.estado === 'RECHAZADA', JSON.stringify(r));
r = await api('GET', '/tutor/solicitudes-materia', paola.token);
check('el tutor ve el estado y la respuesta', r.d.find(s => s.id === idFinanzas)?.respuesta?.includes('académico'), JSON.stringify(r.d));
r = await api('GET', '/admin/auditoria', admin.token);
check('la bitácora registra las solicitudes', ['SOLICITUD_APROBADA', 'SOLICITUD_RECHAZADA'].every(a => r.d.some(x => x.accion === a)));

// Parámetros del negocio versionados (RF-M11-07)
r = await api('GET', '/admin/parametros', admin.token);
check('el admin ve los parámetros con su regla', r.s === 200 && r.d.find(p => p.clave === 'COMISION_PCT')?.valor === 15 && r.d.every(p => p.historial.length >= 1), JSON.stringify(r.d[0]).slice(0, 200));
const manana = new Date(Date.now() + 86400e3).toISOString();
r = await api('POST', '/admin/parametros/COMISION_PCT', admin.token, { valor: 18, vigenteDesde: manana, motivo: 'Ajuste aprobado para el próximo mes.' });
check('cambio programado a futuro', r.s === 201, JSON.stringify(r));
r = await api('GET', '/parametros');
check('el valor vigente no cambia antes de la fecha', r.d.COMISION_PCT === 15, JSON.stringify(r.d));
r = await api('GET', '/admin/parametros', admin.token);
check('el cambio aparece como próximo', r.d.find(p => p.clave === 'COMISION_PCT').proximo?.valor === 18, JSON.stringify(r.d.find(p => p.clave === 'COMISION_PCT').proximo));
r = await api('POST', '/admin/parametros/REEMBOLSO_PARCIAL_PCT', admin.token, { valor: 40, motivo: 'Prueba de cambio inmediato.' });
r = await api('GET', '/parametros');
check('un cambio sin fecha rige de inmediato', r.d.REEMBOLSO_PARCIAL_PCT === 40, JSON.stringify(r.d));
await api('POST', '/admin/parametros/REEMBOLSO_PARCIAL_PCT', admin.token, { valor: 50, motivo: 'Se vuelve al valor del Corte 1.' });
r = await api('POST', '/admin/parametros/TURNO_DEMANDA_S', admin.token, { valor: 5, motivo: 'Fuera del rango permitido.' });
check('valor fuera de rango 400', r.s === 400, JSON.stringify(r));
check('soporte no cambia parámetros', (await api('POST', '/admin/parametros/COMISION_PCT', soporte.token, { valor: 10, motivo: 'No debería poder.' })).s === 403);
r = await api('GET', '/admin/auditoria', admin.token);
check('la bitácora registra los cambios de parámetros y la moderación', ['PARAMETRO_CAMBIADO', 'COMENTARIO_MODERADO'].every(a => r.d.some(x => x.accion === a)), JSON.stringify(r.d.slice(0, 3)));
console.log(`\n${ok} correctas, ${mal} fallas`);
process.exit(mal ? 1 : 0);
