// Reglas que dependen del paso del tiempo, probadas en el mismo proceso (no necesita el servidor encendido):
// recordatorios de 24 h y 15 min, turnos bajo demanda, inasistencia, alerta de reputación y vigencia de parámetros.
// Uso, desde la carpeta server:  npx tsx pruebas/plazos.mjs
// Usa una base temporal propia, así que no toca server/data.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'tutores-plazos-'));
process.env.DB_PATH = path.join(carpeta, 'prueba.db');

const { sembrar, ejecutar, uno, todos } = await import('../src/db.ts');
const { revisarPlazos } = await import('../src/tareas.ts');
const n = await import('../src/nucleo.ts');

let ok = 0, fallas = 0;
const check = (nombre, cond, detalle = '') => { console.log(`${cond ? 'OK  ' : 'FALLA'} ${nombre}${cond ? '' : ` ${detalle}`}`); cond ? ok++ : fallas++; };
const MIN = 60_000, HORA = 3_600_000;
const iso = (ms) => new Date(ms).toISOString();

sembrar();
const id = (email) => uno('SELECT id FROM usuarios WHERE email = ?', email).id;
const usuario = (email) => uno(`SELECT ${n.COLUMNAS_USUARIO} FROM usuarios WHERE email = ?`, email);
const ana = id('ana@demo.co'), carlos = id('carlos@demo.co'), andres = id('andres@demo.co');

/** Sesión confirmada de Ana con Carlos que empieza dentro de `minutos` (creada `creadaHace` minutos antes). */
const sesion = (minutos, creadaHace = 3 * 24 * 60) => Number(ejecutar(
  `INSERT INTO sesiones (estudiante_id, tutor_id, materia_id, tipo, estado, inicio, duracion_min, tema, modalidad, enlace, creado_en)
   VALUES (?,?,1,'PROGRAMADA','CONFIRMADA',?,60,'Prueba de plazos con suficiente texto','VIRTUAL','https://meet.jit.si/prueba',?)`,
  ana, carlos, iso(Date.now() + minutos * MIN), iso(Date.now() - creadaHace * MIN)).lastInsertRowid);
const recordatorios = (sid) => todos(`SELECT id FROM eventos WHERE sesion_id = ? AND tipo = 'RECORDATORIO'`, sid).length;
const avisos = (u, sid) => todos(`SELECT cuerpo FROM notificaciones WHERE usuario_id = ? AND sesion_id = ? AND titulo = 'Tu sesión empieza pronto'`, u, sid);

/* ---------- RF-M10-04: recordatorios de 24 h y 15 min ---------- */
const enUnDia = sesion(23 * 60);
const pronto = sesion(10);
const reciente = sesion(5 * 60, 30);      // se reservó hace 30 min para dentro de 5 h: no aplica el aviso de 24 h
const lejana = sesion(3 * 24 * 60);
revisarPlazos(); revisarPlazos();
check('a menos de 24 h llega el primer recordatorio, una sola vez', recordatorios(enUnDia) === 1 && avisos(ana, enUnDia).length === 1 && avisos(carlos, enUnDia).length === 1);
check('el primer aviso dice la fecha y el tutor', /es el .* Tutor: Carlos/.test(avisos(ana, enUnDia)[0]?.cuerpo ?? ''), avisos(ana, enUnDia)[0]?.cuerpo);
check('a menos de 15 min llega el segundo recordatorio con la sala', recordatorios(pronto) === 1 && /empieza a las .*sala/.test(avisos(ana, pronto)[0]?.cuerpo ?? ''), avisos(ana, pronto)[0]?.cuerpo);
check('una reserva hecha con menos de 24 h no recibe el aviso de 24 h', recordatorios(reciente) === 0 && !!uno('SELECT recordatorio_1_en FROM sesiones WHERE id = ?', reciente).recordatorio_1_en);
check('una sesión a 3 días todavía no tiene recordatorio', recordatorios(lejana) === 0);
// Al reprogramar se limpian y se vuelven a enviar
ejecutar('UPDATE sesiones SET inicio = ?, recordatorio_1_en = NULL, recordatorio_2_en = NULL WHERE id = ?', iso(Date.now() + 12 * MIN), enUnDia);
revisarPlazos();
check('tras reprogramar a 12 min llega el segundo recordatorio', recordatorios(enUnDia) === 2, recordatorios(enUnDia));

/* ---------- RF-M07-05: inasistencia después de la tolerancia ---------- */
const hace20 = sesion(-20);
const sAna = n.vistaSesion(n.sesionPorId(hace20), usuario('ana@demo.co'));
check('pasados 15 min sin que el tutor entre, el estudiante puede reportarlo', sAna.acciones.includes('inasistencia'), JSON.stringify(sAna.acciones));
const hace5 = sesion(-5);
check('antes de la tolerancia no se puede reportar', !n.vistaSesion(n.sesionPorId(hace5), usuario('ana@demo.co')).acciones.includes('inasistencia'));
ejecutar(`INSERT INTO pagos (sesion_id, monto, comision, neto_tutor, metodo, referencia, estado, creado_en) VALUES (?,35000,5250,29750,'TARJETA','SIM-1','RETENIDO',?)`, hace20, iso(Date.now()));
n.reportarInasistencia(n.sesionPorId(hace20), usuario('ana@demo.co'));
let s = n.vistaSesion(n.sesionPorId(hace20), usuario('ana@demo.co'));
check('E3 de P-07: si falta el tutor, NO_REALIZADA y reembolso del 100 %', s.estado === 'NO_REALIZADA' && s.ausente === 'TUTOR' && s.pago.estado === 'REEMBOLSADO', JSON.stringify([s.estado, s.ausente, s.pago?.estado]));
check('y se sugieren otros tutores de la materia', s.sugerencias.length > 0 && s.sugerencias.every((t) => t.id !== carlos), JSON.stringify(s.sugerencias));
const otra = sesion(-30);
ejecutar(`INSERT INTO eventos (sesion_id, tipo, texto, actor_id, publico, creado_en) VALUES (?, 'SALA_ABIERTA', 'Ana entró', ?, 1, ?)`, otra, ana, iso(Date.now()));
check('si el estudiante sí entró a la sala, el tutor no puede reportarlo', !n.vistaSesion(n.sesionPorId(otra), usuario('carlos@demo.co')).acciones.includes('inasistencia'));
const falto = sesion(-25);
ejecutar(`INSERT INTO pagos (sesion_id, monto, comision, neto_tutor, metodo, referencia, estado, creado_en) VALUES (?,35000,5250,29750,'TARJETA','SIM-2','RETENIDO',?)`, falto, iso(Date.now()));
n.reportarInasistencia(n.sesionPorId(falto), usuario('carlos@demo.co'));
s = n.vistaSesion(n.sesionPorId(falto), usuario('ana@demo.co'));
check('E2 de P-07: si falta el estudiante, el pago va al tutor tras la garantía', s.ausente === 'ESTUDIANTE' && s.pago.estado === 'RETENIDO' && !!s.pago.liberarEn, JSON.stringify(s.pago));
check('el estudiante puede abrir una disputa si no está de acuerdo', s.acciones.includes('disputa'), JSON.stringify(s.acciones));

/* ---------- P-06: turnos bajo demanda ---------- */
ejecutar('UPDATE tutores SET en_linea = 1 WHERE usuario_id IN (?, ?)', carlos, andres);
ejecutar(`UPDATE sesiones SET estado = 'FINALIZADA' WHERE estado IN ('CONFIRMADA','EN_CURSO')`);
const did = Number(ejecutar(`INSERT INTO sesiones (estudiante_id, materia_id, tipo, estado, duracion_min, modalidad, tema, metodo_pago, expira_en, creado_en)
  VALUES (?, 1, 'BAJO_DEMANDA', 'BUSCANDO_TUTOR', 60, 'VIRTUAL', 'Tema de prueba para la demanda', 'TARJETA', ?, ?)`, ana, iso(Date.now() + 5 * MIN), iso(Date.now())).lastInsertRowid);
n.cobrar(did, 35000, 'TARJETA');
n.avanzarTurno(n.sesionPorId(did));
let d = n.sesionPorId(did);
check('el primer turno es para el tutor mejor calificado', d.turno_tutor_id === carlos, d.turno_tutor_id);
ejecutar('UPDATE sesiones SET turno_expira_en = ? WHERE id = ?', iso(Date.now() - 1000), did);
revisarPlazos();
d = n.sesionPorId(did);
check('RF-M06-05: vencidos los 45 s pasa al siguiente candidato', d.estado === 'BUSCANDO_TUTOR' && d.turno_tutor_id === andres, JSON.stringify([d.estado, d.turno_tutor_id]));
check('el vencimiento queda en el historial interno', todos(`SELECT 1 FROM eventos WHERE sesion_id = ? AND tipo = 'TURNO_PASADO' AND publico = 0`, did).length === 1);
ejecutar('UPDATE tutores SET en_linea = 0 WHERE usuario_id = ?', andres);
revisarPlazos();
d = n.sesionPorId(did);
check('E3 de P-05: si el tutor en turno se desconecta y no quedan candidatos, SIN_TUTOR', d.estado === 'SIN_TUTOR', d.estado);
check('y la retención se libera', uno('SELECT estado FROM pagos WHERE sesion_id = ?', did).estado === 'REEMBOLSADO');
const did2 = Number(ejecutar(`INSERT INTO sesiones (estudiante_id, materia_id, tipo, estado, duracion_min, modalidad, tema, metodo_pago, expira_en, turno_tutor_id, turno_expira_en, creado_en)
  VALUES (?, 1, 'BAJO_DEMANDA', 'BUSCANDO_TUTOR', 60, 'VIRTUAL', 'Tema de prueba para la demanda', 'TARJETA', ?, ?, ?, ?)`,
  ana, iso(Date.now() - 1000), carlos, iso(Date.now() + 30_000), iso(Date.now() - 5 * MIN)).lastInsertRowid);
revisarPlazos();
check('RF-M06-06: al cumplirse los 5 minutos la búsqueda termina', n.sesionPorId(did2).estado === 'SIN_TUTOR');

/* ---------- RF-M08-08: alerta de reputación ---------- */
const jorge = id('jorge@demo.co');
for (let i = 0; i < 9; i++) {
  const sid = Number(ejecutar(`INSERT INTO sesiones (estudiante_id, tutor_id, materia_id, tipo, estado, inicio, duracion_min, tema, creado_en)
    VALUES (?,?,6,'PROGRAMADA','FINALIZADA',?,60,'Prueba de reputación del tutor',?)`, ana, jorge, iso(Date.now() - HORA), iso(Date.now() - 2 * HORA)).lastInsertRowid);
  ejecutar(`INSERT INTO calificaciones (sesion_id, autor_id, destinatario_id, puntaje, publicada, creado_en) VALUES (?,?,?,2,1,?)`, sid, ana, jorge, iso(Date.now()));
}
n.revisarReputacion(jorge);
const alertas = todos(`SELECT cuerpo FROM notificaciones WHERE titulo = 'Alerta de reputación'`);
check('con 10 o más valoraciones bajo 3,0 se alerta al administrador', alertas.length === 1 && alertas[0].cuerpo.includes('Jorge'), JSON.stringify(alertas));
n.revisarReputacion(jorge);
check('la alerta no se repite', todos(`SELECT 1 FROM notificaciones WHERE titulo = 'Alerta de reputación'`).length === 1);
check('el perfil sigue visible (no se oculta automáticamente)', n.buscarTutores({}).some((t) => t.id === jorge));

/* ---------- RF-M11-07: vigencia de los parámetros ---------- */
ejecutar(`INSERT INTO parametros (clave, valor, vigente_desde, motivo, creado_en) VALUES ('TOLERANCIA_MIN', 30, ?, 'futuro', ?)`, iso(Date.now() + HORA), iso(Date.now()));
check('un cambio con fecha futura no rige todavía', n.param('TOLERANCIA_MIN') === 15, n.param('TOLERANCIA_MIN'));
ejecutar(`INSERT INTO parametros (clave, valor, vigente_desde, motivo, creado_en) VALUES ('TOLERANCIA_MIN', 20, ?, 'ya', ?)`, iso(Date.now() - 1000), iso(Date.now()));
check('el último cambio vigente es el que se aplica', n.param('TOLERANCIA_MIN') === 20, n.param('TOLERANCIA_MIN'));
ejecutar(`INSERT INTO parametros (clave, valor, vigente_desde, motivo, creado_en) VALUES ('REEMBOLSO_PARCIAL_PCT', 40, ?, 'prueba', ?)`, iso(Date.now() - 1000), iso(Date.now()));
const cancela = sesion(10 * 60);
check('RN-06 usa el porcentaje parcial vigente', n.porcentajeReembolso(n.sesionPorId(cancela), usuario('ana@demo.co')) === 40);

console.log(`\n${ok} correctas, ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
