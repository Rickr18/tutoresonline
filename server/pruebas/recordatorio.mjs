// Recordatorio de sesión, probado en el mismo proceso (no necesita el servidor encendido).
// Uso, desde la carpeta server:  npx tsx pruebas/recordatorio.mjs
// Usa una base temporal propia, así que no toca server/data.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'tutores-recordatorio-'));
process.env.DB_PATH = path.join(carpeta, 'prueba.db');

const { sembrar, ejecutar, uno, todos } = await import('../src/db.ts');
const { revisarPlazos } = await import('../src/tareas.ts');

let fallas = 0;
const check = (nombre, ok, detalle = '') => { console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}${ok ? '' : ` ${detalle}`}`); if (!ok) fallas++; };

sembrar();
const ana = uno(`SELECT id FROM usuarios WHERE email = 'ana@demo.co'`).id;
const carlos = uno(`SELECT id FROM usuarios WHERE email = 'carlos@demo.co'`).id;
const materia = uno('SELECT materia_id FROM tutor_materias WHERE tutor_id = ? LIMIT 1', carlos).materia_id;

const sesion = (minutos) => Number(ejecutar(
  `INSERT INTO sesiones (estudiante_id, tutor_id, materia_id, tipo, estado, inicio, duracion_min, tema, creado_en)
   VALUES (?,?,?,'PROGRAMADA','CONFIRMADA',?,60,'Prueba de recordatorio',?)`,
  ana, carlos, materia, new Date(Date.now() + minutos * 60_000).toISOString(), new Date().toISOString()).lastInsertRowid);
const pronto = sesion(30);
const tarde = sesion(180);

const recordatorios = (id) => todos(`SELECT id FROM eventos WHERE sesion_id = ? AND tipo = 'RECORDATORIO'`, id).length;
const avisos = (usuario, id) => todos(`SELECT id FROM notificaciones WHERE usuario_id = ? AND sesion_id = ? AND titulo = 'Tu sesión empieza pronto'`, usuario, id).length;

revisarPlazos();
revisarPlazos();

check('la sesión que empieza en 30 minutos tiene un solo recordatorio en el historial', recordatorios(pronto) === 1, recordatorios(pronto));
check('el estudiante recibe un aviso', avisos(ana, pronto) === 1, avisos(ana, pronto));
check('el tutor recibe un aviso', avisos(carlos, pronto) === 1, avisos(carlos, pronto));
check('la sesión que empieza en 3 horas todavía no tiene recordatorio', recordatorios(tarde) === 0 && avisos(ana, tarde) === 0);
const texto = uno(`SELECT cuerpo FROM notificaciones WHERE usuario_id = ? AND sesion_id = ?`, ana, pronto)?.cuerpo ?? '';
check('el aviso dice la materia, el tutor y la hora', /con Carlos .* empieza a las \d{1,2}:\d{2} [ap]\. m\./.test(texto), texto);

console.log(`\n${5 - fallas} correctas, ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
