import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { duracionTexto, fechaHoraCo, horaCo, pesos } from './formato.js';

const archivo = process.env.DB_PATH ?? path.resolve('data', 'tutoresonline.db');
fs.mkdirSync(path.dirname(archivo), { recursive: true });

export const db = new DatabaseSync(archivo);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

/** Carpeta de los archivos que se adjuntan en los casos de soporte. */
/** Versión vigente de los términos y la política de datos (las páginas /terminos y /privacidad de la web). */
export const VERSION_TERMINOS = '2026-11-10';

export const CARPETA_ADJUNTOS = path.join(path.dirname(archivo), 'adjuntos');

// Si la base viene de una versión anterior del esquema se recrea: son datos de demostración.
const VERSION_ESQUEMA = 5;
if ((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version !== VERSION_ESQUEMA) {
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of ['recuperaciones', 'solicitudes_materia', 'auditoria', 'eventos', 'disputa_mensajes', 'adjuntos', 'notificaciones', 'disputas', 'calificaciones', 'pagos',
    'demanda_descartes', 'sesiones', 'disponibilidad', 'tutor_materias', 'tutores', 'materias', 'usuarios'])
    db.exec(`DROP TABLE IF EXISTS ${t}`);
  fs.rmSync(CARPETA_ADJUNTOS, { recursive: true, force: true });
  db.exec(`PRAGMA user_version = ${VERSION_ESQUEMA}; PRAGMA foreign_keys = ON;`);
}
fs.mkdirSync(CARPETA_ADJUNTOS, { recursive: true });

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('ESTUDIANTE','TUTOR','SOPORTE','ADMIN')),
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','SUSPENDIDO')),
  -- Administrador principal: ningún otro admin puede modificar su cuenta. Solo hay uno.
  superior INTEGER NOT NULL DEFAULT 0,
  -- La contraseña fue restablecida por un admin y hay que cambiarla al ingresar.
  debe_cambiar INTEGER NOT NULL DEFAULT 0,
  -- Va dentro del token; al subirla se cierran las sesiones abiertas de la cuenta.
  version_token INTEGER NOT NULL DEFAULT 0,
  -- Aceptación de los términos y la política de datos al registrarse (Ley 1581 de 2012): versión y fecha.
  terminos_version TEXT,
  terminos_aceptados_en TEXT,
  creado_en TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_superior ON usuarios(superior) WHERE superior = 1;
CREATE TABLE IF NOT EXISTS materias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  area TEXT NOT NULL,
  activa INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER NOT NULL REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  objetivo_id INTEGER REFERENCES usuarios(id),
  texto TEXT NOT NULL,
  creado_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_auditoria_fecha ON auditoria(creado_en);
-- Un tutor pide una materia que no está en el catálogo; un administrador la aprueba (la crea y se la asigna) o la rechaza.
CREATE TABLE IF NOT EXISTS solicitudes_materia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tutor_id INTEGER NOT NULL REFERENCES usuarios(id),
  nombre TEXT NOT NULL,
  area TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA')),
  respuesta TEXT,
  materia_id INTEGER REFERENCES materias(id),
  resuelta_por INTEGER REFERENCES usuarios(id),
  resuelta_en TEXT,
  creado_en TEXT NOT NULL
);
-- Recuperación de contraseña con un código de 6 dígitos (en producción llegaría por correo).
CREATE TABLE IF NOT EXISTS recuperaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  codigo_hash TEXT NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  usado INTEGER NOT NULL DEFAULT 0,
  expira_en TEXT NOT NULL,
  creado_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tutores (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id),
  bio TEXT NOT NULL DEFAULT '',
  tarifa_hora INTEGER NOT NULL DEFAULT 0,
  modalidad TEXT NOT NULL DEFAULT 'VIRTUAL' CHECK (modalidad IN ('VIRTUAL','PRESENCIAL','AMBAS')),
  ciudad TEXT NOT NULL DEFAULT '',
  documento TEXT,
  verificacion TEXT NOT NULL DEFAULT 'INCOMPLETO'
    CHECK (verificacion IN ('INCOMPLETO','PENDIENTE','APROBADO','RECHAZADO')),
  motivo_rechazo TEXT,
  en_linea INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tutor_materias (
  tutor_id INTEGER NOT NULL REFERENCES usuarios(id),
  materia_id INTEGER NOT NULL REFERENCES materias(id),
  PRIMARY KEY (tutor_id, materia_id)
);
CREATE TABLE IF NOT EXISTS disponibilidad (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tutor_id INTEGER NOT NULL REFERENCES usuarios(id),
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio INTEGER NOT NULL,
  hora_fin INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudiante_id INTEGER NOT NULL REFERENCES usuarios(id),
  tutor_id INTEGER REFERENCES usuarios(id),
  materia_id INTEGER NOT NULL REFERENCES materias(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('PROGRAMADA','BAJO_DEMANDA')),
  estado TEXT NOT NULL CHECK (estado IN ('PENDIENTE_ACEPTACION','BUSCANDO_TUTOR','CONFIRMADA',
    'EN_CURSO','FINALIZADA','SIN_TUTOR','CANCELADA','NO_REALIZADA')),
  inicio TEXT,
  duracion_min INTEGER NOT NULL,
  modalidad TEXT NOT NULL DEFAULT 'VIRTUAL',
  tema TEXT NOT NULL DEFAULT '',
  precio INTEGER NOT NULL DEFAULT 0,
  enlace TEXT,
  metodo_pago TEXT,
  expira_en TEXT,
  iniciada_en TEXT,
  finalizada_en TEXT,
  cancelada_por INTEGER,
  creado_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demanda_descartes (
  sesion_id INTEGER NOT NULL REFERENCES sesiones(id),
  tutor_id INTEGER NOT NULL REFERENCES usuarios(id),
  PRIMARY KEY (sesion_id, tutor_id)
);
CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id INTEGER NOT NULL UNIQUE REFERENCES sesiones(id),
  monto INTEGER NOT NULL,
  comision INTEGER NOT NULL,
  neto_tutor INTEGER NOT NULL,
  reembolso INTEGER NOT NULL DEFAULT 0,
  metodo TEXT NOT NULL,
  referencia TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('RETENIDO','LIBERADO','REEMBOLSADO','REEMBOLSO_PARCIAL','EN_DISPUTA')),
  liberar_en TEXT,
  creado_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS calificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id INTEGER NOT NULL REFERENCES sesiones(id),
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  destinatario_id INTEGER NOT NULL REFERENCES usuarios(id),
  puntaje INTEGER NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
  comentario TEXT NOT NULL DEFAULT '',
  publicada INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL,
  UNIQUE (sesion_id, autor_id)
);
CREATE TABLE IF NOT EXISTS disputas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id INTEGER NOT NULL UNIQUE REFERENCES sesiones(id),
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  motivo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA','EN_REVISION','ESCALADA','RESUELTA')),
  asignado_a INTEGER REFERENCES usuarios(id),
  escalada_por INTEGER REFERENCES usuarios(id),
  escalada_motivo TEXT,
  escalada_en TEXT,
  sala TEXT,
  sala_creada_en TEXT,
  decision TEXT CHECK (decision IN ('REEMBOLSO_TOTAL','REEMBOLSO_PARCIAL','LIBERAR')),
  resolucion TEXT,
  resuelta_por INTEGER REFERENCES usuarios(id),
  resuelta_en TEXT,
  creado_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS adjuntos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamano INTEGER NOT NULL,
  archivo TEXT NOT NULL,
  subido_por INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS disputa_mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  disputa_id INTEGER NOT NULL REFERENCES disputas(id),
  canal TEXT NOT NULL CHECK (canal IN ('ESTUDIANTE','TUTOR','INTERNO')),
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  texto TEXT NOT NULL DEFAULT '',
  adjunto_id INTEGER UNIQUE REFERENCES adjuntos(id),
  creado_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id INTEGER NOT NULL REFERENCES sesiones(id),
  tipo TEXT NOT NULL,
  texto TEXT NOT NULL,
  actor_id INTEGER REFERENCES usuarios(id),
  publico INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  sesion_id INTEGER,
  enlace TEXT,
  leida INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sesiones_estado ON sesiones(estado);
CREATE INDEX IF NOT EXISTS ix_sesiones_tutor ON sesiones(tutor_id);
CREATE INDEX IF NOT EXISTS ix_sesiones_estudiante ON sesiones(estudiante_id);
CREATE INDEX IF NOT EXISTS ix_notif_usuario ON notificaciones(usuario_id, leida);
CREATE INDEX IF NOT EXISTS ix_eventos_sesion ON eventos(sesion_id, creado_en);
CREATE INDEX IF NOT EXISTS ix_mensajes_disputa ON disputa_mensajes(disputa_id, creado_en);
`);

/** Ejecuta fn dentro de una transacción. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const uno = <T = any>(sql: string, ...p: any[]) => db.prepare(sql).get(...p) as T | undefined;
export const todos = <T = any>(sql: string, ...p: any[]) => db.prepare(sql).all(...p) as T[];
export const ejecutar = (sql: string, ...p: any[]) => db.prepare(sql).run(...p);

export const COMISION = 0.15; // RN-03

/* ---------- Datos de demostración ---------- */

const iso = (d: Date) => d.toISOString();
const haceDias = (n: number, hora = 15) => {
  const d = new Date(Date.now() - n * 86400000);
  d.setUTCHours(hora, 0, 0, 0);
  return d;
};

export function sembrar() {
  if (uno('SELECT 1 AS x FROM usuarios LIMIT 1')) return;
  const clave = bcrypt.hashSync('Demo1234', 8);
  const ahora = iso(new Date());

  tx(() => {
    const materias: [string, string][] = [
      ['Cálculo diferencial', 'Matemáticas'], ['Cálculo integral', 'Matemáticas'],
      ['Álgebra lineal', 'Matemáticas'], ['Estadística', 'Matemáticas'],
      ['Física mecánica', 'Ciencias'], ['Química general', 'Ciencias'],
      ['Programación en Python', 'Tecnología'], ['Bases de datos', 'Tecnología'],
      ['Desarrollo web', 'Tecnología'], ['Inglés', 'Idiomas'],
      ['Contabilidad', 'Negocios'], ['Redacción académica', 'Humanidades'],
    ];
    for (const [n, a] of materias) ejecutar('INSERT INTO materias (nombre, area) VALUES (?,?)', n, a);

    const usuario = (nombre: string, email: string, rol: string) =>
      Number(ejecutar(`INSERT INTO usuarios (nombre,email,password_hash,rol,creado_en,terminos_version,terminos_aceptados_en)
                       VALUES (?,?,?,?,?,?,?)`,
        nombre, email, clave, rol, iso(haceDias(40)), ...(rol === 'ESTUDIANTE' || rol === 'TUTOR' ? [VERSION_TERMINOS, iso(haceDias(40))] : [null, null])).lastInsertRowid);

    const rick = usuario('Rick Rios', 'rick@tutores.co', 'ADMIN');
    ejecutar('UPDATE usuarios SET superior = 1 WHERE id = ?', rick);
    const soporte = usuario('Marcela Ruiz', 'soporte@tutores.co', 'SOPORTE');
    const ana = usuario('Ana Martínez', 'ana@demo.co', 'ESTUDIANTE');
    const luis = usuario('Luis Herrera', 'luis@demo.co', 'ESTUDIANTE');
    const sofia = usuario('Sofía Rojas', 'sofia@demo.co', 'ESTUDIANTE');

    type T = { nombre: string; email: string; bio: string; tarifa: number; modalidad: string; ciudad: string;
      materias: number[]; dias: number[]; desde: number; hasta: number; verificacion: string; enLinea: number };
    const tutores: T[] = [
      { nombre: 'Carlos Mendoza', email: 'carlos@demo.co', tarifa: 35000, modalidad: 'AMBAS', ciudad: 'Barranquilla',
        bio: 'Ingeniero mecánico y docente de cátedra. Ocho años preparando parciales de cálculo y física.',
        materias: [1, 2, 5], dias: [1, 2, 3, 4, 5], desde: 14, hasta: 20, verificacion: 'APROBADO', enLinea: 1 },
      { nombre: 'Valentina Ortiz', email: 'valentina@demo.co', tarifa: 40000, modalidad: 'VIRTUAL', ciudad: 'Bogotá',
        bio: 'Desarrolladora backend. Enseño Python y bases de datos con ejercicios tomados de proyectos reales.',
        materias: [7, 8, 9], dias: [1, 3, 5, 6], desde: 8, hasta: 13, verificacion: 'APROBADO', enLinea: 1 },
      { nombre: 'Andrés Pardo', email: 'andres@demo.co', tarifa: 28000, modalidad: 'VIRTUAL', ciudad: 'Medellín',
        bio: 'Estudiante de maestría en estadística. Explico con calma y dejo ejercicios resueltos de cada sesión.',
        materias: [3, 4, 1], dias: [0, 2, 4, 6], desde: 9, hasta: 17, verificacion: 'APROBADO', enLinea: 0 },
      { nombre: 'Laura Gómez', email: 'laura@demo.co', tarifa: 30000, modalidad: 'AMBAS', ciudad: 'Barranquilla',
        bio: 'Licenciada en lenguas extranjeras. Conversación, gramática y preparación para exámenes de inglés.',
        materias: [10, 12], dias: [1, 2, 3, 4, 5], desde: 7, hasta: 12, verificacion: 'APROBADO', enLinea: 1 },
      { nombre: 'Jorge Castillo', email: 'jorge@demo.co', tarifa: 32000, modalidad: 'PRESENCIAL', ciudad: 'Barranquilla',
        bio: 'Químico farmacéutico. Refuerzo de química general y estequiometría para primeros semestres.',
        materias: [6, 5], dias: [2, 4, 6], desde: 15, hasta: 19, verificacion: 'APROBADO', enLinea: 0 },
      { nombre: 'Paola Vergara', email: 'paola@demo.co', tarifa: 26000, modalidad: 'VIRTUAL', ciudad: 'Cartagena',
        bio: 'Contadora pública. Contabilidad básica, costos y estados financieros.',
        materias: [11, 4], dias: [1, 3, 5], desde: 18, hasta: 21, verificacion: 'APROBADO', enLinea: 0 },
      { nombre: 'Diego Salas', email: 'diego@demo.co', tarifa: 30000, modalidad: 'VIRTUAL', ciudad: 'Cali',
        bio: 'Desarrollador frontend con tres años de experiencia en React.',
        materias: [9, 7], dias: [1, 2, 3], desde: 16, hasta: 20, verificacion: 'PENDIENTE', enLinea: 0 },
    ];
    const ids: number[] = [];
    for (const t of tutores) {
      const id = usuario(t.nombre, t.email, 'TUTOR');
      ids.push(id);
      ejecutar(`INSERT INTO tutores (usuario_id,bio,tarifa_hora,modalidad,ciudad,documento,verificacion,en_linea)
        VALUES (?,?,?,?,?,?,?,?)`, id, t.bio, t.tarifa, t.modalidad, t.ciudad, 'titulo_profesional.pdf', t.verificacion, t.enLinea);
      for (const m of t.materias) ejecutar('INSERT INTO tutor_materias VALUES (?,?)', id, m);
      for (const d of t.dias)
        ejecutar('INSERT INTO disponibilidad (tutor_id,dia_semana,hora_inicio,hora_fin) VALUES (?,?,?,?)', id, d, t.desde, t.hasta);
    }

    // Historial: sesiones finalizadas con pago liberado y calificaciones publicadas.
    const comentarios = [
      'Explica con paciencia y trae ejercicios parecidos a los del parcial.',
      'Muy puntual. Entendí por fin las integrales por partes.',
      'Buena sesión, aunque faltó tiempo para el último tema.',
      'Resolvió todas mis dudas del taller. La recomiendo.',
      'Claro y ordenado. Volvería a reservar.',
      'Me ayudó a preparar la exposición en inglés.',
    ];
    const estudiantes = [ana, luis, sofia];
    const nombreEst: Record<number, string> = { [ana]: 'Ana Martínez', [luis]: 'Luis Herrera', [sofia]: 'Sofía Rojas' };
    const nombreMateria = (id: number) => materias[id - 1][0];
    const ev = (sid: number, tipo: string, texto: string, actor: number | null, fecha: Date | number, publico = 1) =>
      ejecutar('INSERT INTO eventos (sesion_id,tipo,texto,actor_id,publico,creado_en) VALUES (?,?,?,?,?,?)',
        sid, tipo, texto, actor, publico, iso(new Date(fecha)));
    const min = 60_000;
    /** Historial típico de una sesión programada o inmediata hasta que se cobra y se confirma. */
    const historiaInicio = (sid: number, tipo: string, est: number, ti: number, materia: number, inicio: Date, monto: number) => {
      const t = tutores[ti];
      const creada = tipo === 'PROGRAMADA' ? inicio.getTime() - 26 * 60 * min : inicio.getTime() - 2 * min;
      if (tipo === 'PROGRAMADA') {
        ev(sid, 'SESION_CREADA', `${nombreEst[est]} reservó ${nombreMateria(materia)} para el ${fechaHoraCo(inicio.getTime())} (1 h, virtual).`, est, creada);
        ev(sid, 'PAGO_COBRADO', `Se cobraron ${pesos(monto)} con TARJETA •••• 4242. El dinero queda retenido por la plataforma.`, null, creada + 2000);
        ev(sid, 'ACEPTADA', `${t.nombre} aceptó la reserva. Se generó la sala virtual.`, ids[ti], creada + 95 * min);
      } else {
        ev(sid, 'SESION_CREADA', `${nombreEst[est]} pidió un tutor ahora para ${nombreMateria(materia)} (1 h).`, est, creada);
        ev(sid, 'TUTORES_AVISADOS', 'La solicitud llegó a 3 tutores en línea.', null, creada + 500);
        ev(sid, 'ACEPTADA', `${t.nombre} tomó la solicitud a los 14 segundos.`, ids[ti], creada + 14000);
        ev(sid, 'PAGO_COBRADO', `Se cobraron ${pesos(monto)} con TARJETA •••• 4242. El dinero queda retenido por la plataforma.`, null, creada + 14500);
      }
    };
    let k = 0;
    const historial: [number, number, number, number, string][] = [
      // [índice tutor, materia, días atrás, puntaje, tipo]
      [0, 1, 12, 5, 'PROGRAMADA'], [0, 2, 9, 5, 'PROGRAMADA'], [0, 5, 6, 4, 'BAJO_DEMANDA'], [0, 1, 3, 5, 'PROGRAMADA'],
      [1, 7, 11, 5, 'PROGRAMADA'], [1, 8, 7, 4, 'BAJO_DEMANDA'], [1, 9, 4, 5, 'PROGRAMADA'], [1, 7, 2, 5, 'BAJO_DEMANDA'],
      [2, 4, 10, 4, 'PROGRAMADA'], [2, 3, 5, 5, 'PROGRAMADA'], [2, 4, 1, 4, 'PROGRAMADA'],
      [3, 10, 8, 5, 'PROGRAMADA'], [3, 10, 5, 5, 'BAJO_DEMANDA'], [3, 12, 2, 4, 'PROGRAMADA'],
      [4, 6, 6, 4, 'PROGRAMADA'], [4, 6, 3, 3, 'PROGRAMADA'],
      [5, 11, 9, 5, 'PROGRAMADA'], [5, 11, 4, 4, 'PROGRAMADA'],
    ];
    for (const [ti, materia, dias, puntaje, tipo] of historial) {
      const est = estudiantes[k % 3];
      const t = tutores[ti];
      const inicio = haceDias(dias, 14 + (k % 6));
      const fin = new Date(inicio.getTime() + 3600000);
      const comision = Math.round(t.tarifa * COMISION);
      const sid = Number(ejecutar(`INSERT INTO sesiones (estudiante_id,tutor_id,materia_id,tipo,estado,inicio,duracion_min,
        modalidad,tema,precio,iniciada_en,finalizada_en,creado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        est, ids[ti], materia, tipo, 'FINALIZADA', iso(inicio), 60, 'VIRTUAL', 'Repaso para parcial', t.tarifa,
        iso(inicio), iso(fin), iso(new Date(inicio.getTime() - 86400000))).lastInsertRowid);
      ejecutar(`INSERT INTO pagos (sesion_id,monto,comision,neto_tutor,metodo,referencia,estado,liberar_en,creado_en)
        VALUES (?,?,?,?,?,?,?,?,?)`, sid, t.tarifa, comision, t.tarifa - comision, 'TARJETA', `SIM-${1000 + sid}`,
        dias > 2 ? 'LIBERADO' : 'RETENIDO', iso(new Date(fin.getTime() + 48 * 3600000)), iso(inicio));
      ejecutar(`INSERT INTO calificaciones (sesion_id,autor_id,destinatario_id,puntaje,comentario,publicada,creado_en)
        VALUES (?,?,?,?,?,1,?)`, sid, est, ids[ti], puntaje, comentarios[k % comentarios.length], iso(fin));
      ejecutar(`INSERT INTO calificaciones (sesion_id,autor_id,destinatario_id,puntaje,comentario,publicada,creado_en)
        VALUES (?,?,?,?,?,1,?)`, sid, ids[ti], est, 5, 'Estudiante puntual y con buena disposición.', iso(fin));
      historiaInicio(sid, tipo, est, ti, materia, inicio, t.tarifa);
      ev(sid, 'SALA_ABIERTA', `${t.nombre} abrió el enlace de la sala virtual.`, ids[ti], inicio.getTime() - 3 * min);
      ev(sid, 'SALA_ABIERTA', `${nombreEst[est]} abrió el enlace de la sala virtual.`, est, inicio.getTime() - 1 * min);
      ev(sid, 'INICIADA', `${t.nombre} inició la sesión a las ${horaCo(inicio.getTime())}, a la hora reservada.`, ids[ti], inicio);
      ev(sid, 'FINALIZADA', `${t.nombre} finalizó la sesión a las ${horaCo(fin.getTime())}, con una duración real de 1 h.`, ids[ti], fin);
      ev(sid, 'CALIFICADA', `${nombreEst[est]} calificó a ${t.nombre} con ${puntaje} estrellas.`, est, fin.getTime() + 10 * min);
      ev(sid, 'CALIFICADA', `${t.nombre} calificó a ${nombreEst[est]} con 5 estrellas.`, ids[ti], fin.getTime() + 25 * min);
      ev(sid, 'CALIFICACIONES_PUBLICADAS', 'Las dos calificaciones se publicaron.', null, fin.getTime() + 25 * min);
      if (dias > 2) ev(sid, 'PAGO_LIBERADO', `Pasaron 48 horas sin reclamos: se liberaron ${pesos(t.tarifa - comision)} al tutor.`, null, fin.getTime() + 48 * 60 * min);
      k++;
    }
    // Dos casos de soporte para la demostración: uno en revisión y otro sin asignar.
    const casos = [
      { est: luis, ti: 2, materia: 4, horasAtras: 27, retraso: 18, dura: 25, asignado: soporte,
        motivo: 'El tutor entró 18 minutos tarde y cerró la sesión a la media hora, pero se cobró la hora completa. No alcanzamos a ver regresión lineal.' },
      { est: sofia, ti: 4, materia: 6, horasAtras: 20, retraso: 2, dura: 58, asignado: null,
        motivo: 'La sesión no fue sobre el tema que reservé (balanceo de ecuaciones). El tutor repasó nomenclatura todo el tiempo.' },
    ];
    for (const c of casos) {
      const t = tutores[c.ti];
      const inicio = new Date(Date.now() - c.horasAtras * 60 * min);
      inicio.setUTCMinutes(0, 0, 0);
      const real = new Date(inicio.getTime() + c.retraso * min);
      const fin = new Date(real.getTime() + c.dura * min);
      const comision = Math.round(t.tarifa * COMISION);
      const tema = c.materia === 4 ? 'Regresión lineal y correlación para el parcial' : 'Balanceo de ecuaciones químicas';
      const sid = Number(ejecutar(`INSERT INTO sesiones (estudiante_id,tutor_id,materia_id,tipo,estado,inicio,duracion_min,
        modalidad,tema,precio,enlace,iniciada_en,finalizada_en,creado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        c.est, ids[c.ti], c.materia, 'PROGRAMADA', 'FINALIZADA', iso(inicio), 60, 'VIRTUAL', tema, t.tarifa,
        `https://meet.jit.si/TutoresOnLine-demo-${c.materia}`, iso(real), iso(fin), iso(new Date(inicio.getTime() - 26 * 60 * min))).lastInsertRowid);
      ejecutar(`INSERT INTO pagos (sesion_id,monto,comision,neto_tutor,metodo,referencia,estado,liberar_en,creado_en)
        VALUES (?,?,?,?,?,?,?,?,?)`, sid, t.tarifa, comision, t.tarifa - comision, 'TARJETA •••• 4242', `SIM-${2000 + sid}`,
        'EN_DISPUTA', iso(new Date(fin.getTime() + 48 * 60 * min)), iso(inicio));
      historiaInicio(sid, 'PROGRAMADA', c.est, c.ti, c.materia, inicio, t.tarifa);
      ev(sid, 'SALA_ABIERTA', `${nombreEst[c.est]} abrió el enlace de la sala virtual.`, c.est, inicio.getTime() - 2 * min);
      ev(sid, 'SALA_ABIERTA', `${t.nombre} abrió el enlace de la sala virtual.`, ids[c.ti], real.getTime() - 1 * min);
      ev(sid, 'INICIADA', `${t.nombre} inició la sesión a las ${horaCo(real.getTime())}, ${c.retraso} min después de la hora reservada.`, ids[c.ti], real);
      ev(sid, 'FINALIZADA', `${t.nombre} finalizó la sesión a las ${horaCo(fin.getTime())}, con una duración real de ${duracionTexto(c.dura)} de 1 h reservada.`, ids[c.ti], fin);
      const abierta = fin.getTime() + 40 * min;
      const did = Number(ejecutar(`INSERT INTO disputas (sesion_id,autor_id,motivo,estado,asignado_a,creado_en) VALUES (?,?,?,?,?,?)`,
        sid, c.est, c.motivo, c.asignado ? 'EN_REVISION' : 'ABIERTA', c.asignado, iso(new Date(abierta))).lastInsertRowid);
      ev(sid, 'DISPUTA_ABIERTA', `${nombreEst[c.est]} abrió una disputa. El pago queda congelado.`, c.est, abierta);
      if (c.asignado) {
        const msj = (canal: string, autor: number, texto: string, minutos: number) =>
          ejecutar('INSERT INTO disputa_mensajes (disputa_id,canal,autor_id,texto,creado_en) VALUES (?,?,?,?,?)',
            did, canal, autor, texto, iso(new Date(abierta + minutos * min)));
        ev(sid, 'CASO_TOMADO', 'Marcela Ruiz (soporte) tomó el caso.', soporte, abierta + 30 * min);
        msj('ESTUDIANTE', soporte, 'Hola Luis, soy Marcela de soporte. Ya revisé el historial de la sesión. ¿Tienes alguna captura o mensaje del chat de la sala que muestre la hora en que entró el tutor?', 31);
        msj('ESTUDIANTE', luis, 'Hola Marcela. Entré a la sala a la hora y esperé solo. No tomé captura, pero le escribí al tutor por el chat de Jitsi a los 10 minutos preguntando si iba a entrar.', 55);
        msj('TUTOR', soporte, 'Hola Andrés, el estudiante reporta que la sesión empezó 18 minutos tarde y terminó a la media hora. Cuéntanos qué pasó y adjunta cualquier prueba que tengas.', 33);
        msj('TUTOR', ids[c.ti], 'Buenas. Se fue la luz en mi sector y me conecté con los datos del celular apenas pude. Al final la conexión estaba muy inestable y por eso cerré. Le ofrecí al estudiante reponer el tiempo otro día.', 80);
        msj('INTERNO', soporte, 'El historial confirma el retraso: el estudiante abrió la sala a la hora y el tutor la abrió 17 min después. Duración real 25 min. Propongo reembolso parcial si el tutor no repone la sesión.', 90);
      }
    }

    // Dos solicitudes bajo demanda que no encontraron tutor, para que el reporte de asignación tenga contraste.
    for (const d of [7, 3])
      ejecutar(`INSERT INTO sesiones (estudiante_id,materia_id,tipo,estado,duracion_min,tema,creado_en)
        VALUES (?,?,?,?,?,?,?)`, luis, 6, 'BAJO_DEMANDA', 'SIN_TUTOR', 60, 'Duda de estequiometría', iso(haceDias(d, 3)));

    // Una solicitud de materia pendiente, para que el administrador vea cómo funcionan.
    const paola = uno<{ id: number }>('SELECT id FROM usuarios WHERE email = ?', 'paola@demo.co')!.id;
    ejecutar('INSERT INTO solicitudes_materia (tutor_id, nombre, area, motivo, creado_en) VALUES (?,?,?,?,?)', paola,
      'Microeconomía', 'Negocios', 'Varios estudiantes de contaduría me piden refuerzo en oferta, demanda y elasticidad.', iso(haceDias(1, 14)));

    ejecutar('INSERT INTO notificaciones (usuario_id,titulo,cuerpo,creado_en) VALUES (?,?,?,?)', ana,
      'Bienvenida a TutoresOn-Line', 'Busca un tutor por materia o pide uno ahora mismo.', ahora);
  });
  console.log('Base de datos inicializada con datos de demostración.');
}
