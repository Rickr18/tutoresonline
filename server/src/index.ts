import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { tx, uno, todos, ejecutar, sembrar, VERSION_TERMINOS } from './db.js';
import {
  ErrorHttp, texto, entero, opcion, firmar, autenticar, soloRol, montarTiempoReal, emitir, notificar, avisarSesion,
  vistaTutor, tutorPorId, buscarTutores, franjasLibres, franjaDisponible, validarPago, cobrar, reembolsar,
  porcentajeReembolso, sesionPorId, sesionesDonde, vistaSesion, enlaceVirtual, tutoresElegibles, finalizarSesion,
  ahoraIso, MODO_DEMO, VENTANA_DEMANDA, VENTANA_PROGRAMADA, MIN, registrar, eventosDe, idsDeRol, esEquipo,
  COLUMNAS_USUARIO, validarClave, accionesSobre, exigirAccion, auditar,
  type Usuario,
} from './nucleo.js';
import { duracionTexto, fechaHoraCo, horaCo, pesos } from './formato.js';
import { iniciarTareas } from './tareas.js';
import { montarCasos, montarDescargas, emitirCaso } from './casos.js';

sembrar();

const app = express();
app.use(cors());
// Los adjuntos llegan en base64 dentro del JSON; esa ruta acepta cuerpos más grandes.
const jsonNormal = express.json({ limit: '200kb' });
const jsonAdjuntos = express.json({ limit: '8mb' });
app.use((req, res, next) => (req.path === '/api/adjuntos' ? jsonAdjuntos : jsonNormal)(req, res, next));

const api = express.Router();
app.use('/api', api);

const DURACIONES = [60, 90, 120];

/* ---------- Público ---------- */

api.get('/salud', (_req, res) => res.json({ ok: true, modoDemo: MODO_DEMO, hora: ahoraIso() }));

api.get('/materias', (_req, res) => res.json(todos('SELECT id, nombre, area FROM materias WHERE activa = 1 ORDER BY area, nombre')));

/* ---------- Cuentas (P-01) ---------- */

function perfilPropio(u: Usuario) {
  const base = {
    id: u.id, nombre: u.nombre, email: u.email, rol: u.rol,
    ...(u.superior ? { superior: true } : {}),
    ...(u.debe_cambiar ? { debeCambiarPassword: true } : {}),
    ...(u.terminos_version ? { terminosVersion: u.terminos_version, terminosAceptadosEn: u.terminos_aceptados_en } : {}),
  };
  if (u.rol !== 'TUTOR') return base;
  return {
    ...base,
    tutor: {
      ...vistaTutor(tutorPorId(u.id), true),
      disponibilidad: todos(`SELECT dia_semana AS diaSemana, hora_inicio AS horaInicio, hora_fin AS horaFin
                             FROM disponibilidad WHERE tutor_id = ? ORDER BY dia_semana, hora_inicio`, u.id),
    },
  };
}

api.post('/auth/registro', (req, res) => {
  const nombre = texto(req.body.nombre, 'El nombre', 3, 80);
  const email = texto(req.body.email, 'El correo', 5, 120).toLowerCase();
  const rol = opcion(req.body.rol, 'El tipo de cuenta', ['ESTUDIANTE', 'TUTOR'] as const);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErrorHttp(400, 'El correo no es válido.');
  const password = validarClave(req.body.password);
  if (uno('SELECT 1 AS x FROM usuarios WHERE email = ?', email)) throw new ErrorHttp(409, 'Ya existe una cuenta con ese correo.');
  // Autorización previa, expresa e informada para el tratamiento de datos (Ley 1581 de 2012, Decreto 1377 de 2013).
  if (req.body.aceptaTerminos !== true) throw new ErrorHttp(400, 'Debes aceptar los términos y condiciones y la política de tratamiento de datos.');

  const id = tx(() => {
    const ahora = ahoraIso();
    const nuevo = Number(ejecutar(`INSERT INTO usuarios (nombre, email, password_hash, rol, creado_en, terminos_version, terminos_aceptados_en)
                                   VALUES (?,?,?,?,?,?,?)`,
      nombre, email, bcrypt.hashSync(password, 10), rol, ahora, VERSION_TERMINOS, ahora).lastInsertRowid);
    if (rol === 'TUTOR') ejecutar('INSERT INTO tutores (usuario_id) VALUES (?)', nuevo);
    notificar(nuevo, 'Cuenta creada', rol === 'TUTOR'
      ? 'Completa tu perfil y envíalo a verificación para empezar a recibir reservas.'
      : 'Busca un tutor por materia o pide uno ahora mismo.');
    return nuevo;
  });
  const u = uno<Usuario>(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = ?`, id)!;
  res.status(201).json({ token: firmar(u), usuario: perfilPropio(u) });
});

api.post('/auth/login', (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const u = uno<Usuario & { password_hash: string }>('SELECT * FROM usuarios WHERE email = ?', email);
  if (!u || !bcrypt.compareSync(String(req.body.password ?? ''), u.password_hash))
    throw new ErrorHttp(401, 'Correo o contraseña incorrectos.');
  if (u.estado !== 'ACTIVO') throw new ErrorHttp(403, 'Tu cuenta está suspendida. Escribe a soporte.');
  res.json({ token: firmar(u), usuario: perfilPropio(u) });
});

/* ---------- Recuperar la contraseña sin depender de un administrador ---------- */

const MINUTOS_CODIGO = 15;
const INTENTOS_CODIGO = 5;

/**
 * Pide un código de 6 dígitos. En producción llegaría por correo; en modo demostración se devuelve en la respuesta
 * (igual que los pagos simulados). La respuesta no dice si el correo existe, salvo el código de demostración.
 */
api.post('/auth/recuperar', (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErrorHttp(400, 'El correo no es válido.');
  const u = uno<{ id: number; estado: string }>('SELECT id, estado FROM usuarios WHERE email = ?', email);
  const mensaje = `Si el correo está registrado, te enviamos un código de 6 dígitos. Vence en ${MINUTOS_CODIGO} minutos.`;
  if (!u || u.estado !== 'ACTIVO') { res.json({ mensaje }); return; }
  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  tx(() => {
    ejecutar('UPDATE recuperaciones SET usado = 1 WHERE usuario_id = ? AND usado = 0', u.id);
    ejecutar('INSERT INTO recuperaciones (usuario_id, codigo_hash, expira_en, creado_en) VALUES (?,?,?,?)',
      u.id, bcrypt.hashSync(codigo, 8), new Date(Date.now() + MINUTOS_CODIGO * MIN).toISOString(), ahoraIso());
  });
  res.json({ mensaje, ...(MODO_DEMO ? { codigoDemo: codigo } : {}) });
});

/** Cambia la contraseña con el código y deja la sesión iniciada. Cierra las demás sesiones abiertas de la cuenta. */
api.post('/auth/restablecer', (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const codigo = String(req.body.codigo ?? '').replace(/\D/g, '');
  const nueva = validarClave(req.body.nueva);
  const invalido = new ErrorHttp(400, 'El código no es válido o ya venció. Pide uno nuevo.');
  const u = uno<{ id: number; estado: string }>('SELECT id, estado FROM usuarios WHERE email = ?', email);
  if (!u || u.estado !== 'ACTIVO') throw invalido;
  const r = uno<{ id: number; codigo_hash: string; intentos: number; expira_en: string }>(
    'SELECT id, codigo_hash, intentos, expira_en FROM recuperaciones WHERE usuario_id = ? AND usado = 0 ORDER BY id DESC LIMIT 1', u.id);
  if (!r || Date.parse(r.expira_en) < Date.now() || r.intentos >= INTENTOS_CODIGO) throw invalido;
  if (!bcrypt.compareSync(codigo, r.codigo_hash)) {
    ejecutar('UPDATE recuperaciones SET intentos = intentos + 1 WHERE id = ?', r.id);
    throw new ErrorHttp(400, r.intentos + 1 >= INTENTOS_CODIGO ? 'Demasiados intentos. Pide un código nuevo.' : 'El código no es correcto.');
  }
  tx(() => {
    ejecutar('UPDATE recuperaciones SET usado = 1 WHERE id = ?', r.id);
    ejecutar('UPDATE usuarios SET password_hash = ?, debe_cambiar = 0, version_token = version_token + 1 WHERE id = ?',
      bcrypt.hashSync(nueva, 10), u.id);
    notificar(u.id, 'Contraseña cambiada', 'Recuperaste el acceso con un código. Si no fuiste tú, escribe a soporte.');
  });
  const usuario = uno<Usuario>(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = ?`, u.id)!;
  res.json({ token: firmar(usuario), usuario: perfilPropio(usuario) });
});

montarDescargas(api);

/* ---------- Desde aquí todo requiere sesión iniciada ---------- */

api.use(autenticar);

api.get('/yo', (req, res) => res.json(perfilPropio(req.yo)));

/** Cambio de la propia contraseña. Cierra las demás sesiones y devuelve un token nuevo para la actual. */
api.put('/yo/password', (req, res) => {
  const fila = uno<{ password_hash: string }>('SELECT password_hash FROM usuarios WHERE id = ?', req.yo.id)!;
  if (!bcrypt.compareSync(String(req.body.actual ?? ''), fila.password_hash))
    throw new ErrorHttp(400, 'La contraseña actual no es correcta.');
  const nueva = validarClave(req.body.nueva);
  if (bcrypt.compareSync(nueva, fila.password_hash)) throw new ErrorHttp(400, 'La nueva contraseña debe ser distinta de la actual.');
  ejecutar('UPDATE usuarios SET password_hash = ?, debe_cambiar = 0, version_token = version_token + 1 WHERE id = ?',
    bcrypt.hashSync(nueva, 10), req.yo.id);
  const u = uno<Usuario>(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = ?`, req.yo.id)!;
  res.json({ token: firmar(u), usuario: perfilPropio(u) });
});

/* ---------- Búsqueda (P-03) ---------- */

api.get('/tutores', (req, res) => res.json(buscarTutores(req.query)));

api.get('/tutores/:id', (req, res) => {
  const f = tutorPorId(entero(req.params.id, 'El tutor'));
  if (!f || f.verificacion !== 'APROBADO' || f.estado !== 'ACTIVO') throw new ErrorHttp(404, 'El tutor no está disponible.');
  res.json({
    ...vistaTutor(f),
    disponibilidad: todos(`SELECT dia_semana AS diaSemana, hora_inicio AS horaInicio, hora_fin AS horaFin
                           FROM disponibilidad WHERE tutor_id = ? ORDER BY dia_semana, hora_inicio`, f.id),
    resenas: todos(`SELECT c.puntaje, c.comentario, c.creado_en AS fecha, u.nombre AS autor
                    FROM calificaciones c JOIN usuarios u ON u.id = c.autor_id
                    WHERE c.destinatario_id = ? AND c.publicada = 1 ORDER BY c.creado_en DESC LIMIT 10`, f.id),
  });
});

api.get('/tutores/:id/franjas', (req, res) => res.json(franjasLibres(entero(req.params.id, 'El tutor'))));

/* ---------- Perfil y agenda del tutor (P-02, P-05) ---------- */

api.put('/tutor/perfil', soloRol('TUTOR'), (req, res) => {
  const b = req.body;
  const bio = texto(b.bio, 'La presentación', 20, 600);
  const tarifa = entero(b.tarifaHora, 'La tarifa por hora', 10_000, 500_000);
  const modalidad = opcion(b.modalidad, 'La modalidad', ['VIRTUAL', 'PRESENCIAL', 'AMBAS'] as const);
  const ciudad = texto(b.ciudad, 'La ciudad', 2, 60);
  const materias: number[] = Array.isArray(b.materias) ? [...new Set<number>(b.materias.map(Number))] : [];
  if (!materias.length || materias.length > 6) throw new ErrorHttp(400, 'Elige entre una y seis materias.');
  const actual = tutorPorId(req.yo.id);
  const documento = b.documento ? texto(b.documento, 'El documento', 3, 120) : actual.documento;

  tx(() => {
    ejecutar('UPDATE tutores SET bio = ?, tarifa_hora = ?, modalidad = ?, ciudad = ?, documento = ? WHERE usuario_id = ?',
      bio, tarifa, modalidad, ciudad, documento, req.yo.id);
    // Una materia desactivada se puede conservar si el tutor ya la tenía, pero no se puede agregar.
    const tenia = new Set(todos<{ m: number }>('SELECT materia_id AS m FROM tutor_materias WHERE tutor_id = ?', req.yo.id).map((f) => f.m));
    ejecutar('DELETE FROM tutor_materias WHERE tutor_id = ?', req.yo.id);
    for (const m of materias) {
      const mat = uno<{ activa: number }>('SELECT activa FROM materias WHERE id = ?', m);
      if (!mat || (!mat.activa && !tenia.has(m))) throw new ErrorHttp(400, 'Una de las materias no existe o no está disponible.');
      ejecutar('INSERT INTO tutor_materias VALUES (?,?)', req.yo.id, m);
    }
    // Enviar a verificación: solo desde INCOMPLETO o RECHAZADO y con el soporte cargado.
    if (b.enviar && ['INCOMPLETO', 'RECHAZADO'].includes(actual.verificacion)) {
      if (!documento) throw new ErrorHttp(400, 'Adjunta el soporte de tus estudios antes de enviar el perfil.');
      ejecutar(`UPDATE tutores SET verificacion = 'PENDIENTE', motivo_rechazo = NULL WHERE usuario_id = ?`, req.yo.id);
      for (const a of todos<{ id: number }>(`SELECT id FROM usuarios WHERE rol = 'ADMIN'`))
        notificar(a.id, 'Tutor por verificar', `${req.yo.nombre} envió su perfil a revisión.`);
    }
  });
  res.json(perfilPropio(req.yo));
});

api.put('/tutor/disponibilidad', soloRol('TUTOR'), (req, res) => {
  const bloques: any[] = Array.isArray(req.body.bloques) ? req.body.bloques : [];
  if (bloques.length > 40) throw new ErrorHttp(400, 'Demasiados bloques de horario.');
  const limpios = bloques.map((b) => ({
    dia: entero(b.diaSemana, 'El día', 0, 6), desde: entero(b.horaInicio, 'La hora de inicio', 0, 23), hasta: entero(b.horaFin, 'La hora de fin', 1, 24),
  }));
  for (const [i, b] of limpios.entries()) {
    if (b.desde >= b.hasta) throw new ErrorHttp(400, 'La hora de fin debe ser posterior a la de inicio.');
    if (limpios.some((o, j) => j !== i && o.dia === b.dia && b.desde < o.hasta && b.hasta > o.desde))
      throw new ErrorHttp(400, 'Hay bloques que se cruzan en el mismo día.');
  }
  tx(() => {
    ejecutar('DELETE FROM disponibilidad WHERE tutor_id = ?', req.yo.id);
    for (const b of limpios)
      ejecutar('INSERT INTO disponibilidad (tutor_id, dia_semana, hora_inicio, hora_fin) VALUES (?,?,?,?)', req.yo.id, b.dia, b.desde, b.hasta);
  });
  res.json(perfilPropio(req.yo));
});

api.post('/tutor/en-linea', soloRol('TUTOR'), (req, res) => {
  const t = tutorPorId(req.yo.id);
  const enLinea = !!req.body.enLinea;
  if (enLinea && t.verificacion !== 'APROBADO') throw new ErrorHttp(403, 'Tu perfil debe estar aprobado para recibir solicitudes.');
  ejecutar('UPDATE tutores SET en_linea = ? WHERE usuario_id = ?', enLinea ? 1 : 0, req.yo.id);
  res.json({ enLinea });
});

/* ---------- Solicitudes de materias nuevas (el tutor pide, un administrador decide) ---------- */

const vistaSolicitud = (s: any) => ({
  id: s.id, nombre: s.nombre, area: s.area, motivo: s.motivo, estado: s.estado, respuesta: s.respuesta,
  creadoEn: s.creado_en, resueltaEn: s.resuelta_en, materiaId: s.materia_id,
  ...(s.tutor_nombre ? { tutor: { id: s.tutor_id, nombre: s.tutor_nombre, email: s.tutor_email } } : {}),
  ...(s.resuelta_nombre ? { resueltaPor: s.resuelta_nombre } : {}),
});

api.get('/tutor/solicitudes-materia', soloRol('TUTOR'), (req, res) => {
  res.json(todos('SELECT * FROM solicitudes_materia WHERE tutor_id = ? ORDER BY id DESC', req.yo.id).map(vistaSolicitud));
});

api.post('/tutor/solicitudes-materia', soloRol('TUTOR'), (req, res) => {
  const nombre = texto(req.body.nombre, 'El nombre de la materia', 3, 60);
  const area = texto(req.body.area, 'El área', 3, 40);
  const motivo = texto(req.body.motivo, 'El motivo', 10, 300);
  if (uno('SELECT 1 AS x FROM materias WHERE lower(nombre) = lower(?) AND activa = 1', nombre))
    throw new ErrorHttp(409, 'Esa materia ya está en el catálogo: búscala en la lista de tu perfil.');
  if (uno(`SELECT 1 AS x FROM solicitudes_materia WHERE tutor_id = ? AND lower(nombre) = lower(?) AND estado = 'PENDIENTE'`, req.yo.id, nombre))
    throw new ErrorHttp(409, 'Ya tienes una solicitud pendiente para esa materia.');
  if ((uno<{ n: number }>(`SELECT COUNT(*) AS n FROM solicitudes_materia WHERE tutor_id = ? AND estado = 'PENDIENTE'`, req.yo.id)?.n ?? 0) >= 3)
    throw new ErrorHttp(409, 'Tienes 3 solicitudes pendientes. Espera a que un administrador las revise.');
  const id = tx(() => {
    const nueva = Number(ejecutar('INSERT INTO solicitudes_materia (tutor_id, nombre, area, motivo, creado_en) VALUES (?,?,?,?,?)',
      req.yo.id, nombre, area, motivo, ahoraIso()).lastInsertRowid);
    for (const a of idsDeRol('ADMIN'))
      notificar(a, 'Solicitud de materia', `${req.yo.nombre} pide agregar ${nombre} (${area}).`, null, '/admin/materias');
    return nueva;
  });
  res.status(201).json(vistaSolicitud(uno('SELECT * FROM solicitudes_materia WHERE id = ?', id)));
});

api.get('/tutor/ingresos', soloRol('TUTOR'), (req, res) => {
  const movimientos = todos(`
    SELECT p.id, p.monto, p.comision, p.neto_tutor AS netoTutor, p.estado, p.liberar_en AS liberarEn, s.id AS sesionId,
           s.finalizada_en AS fecha, m.nombre AS materia, e.nombre AS estudiante
    FROM pagos p JOIN sesiones s ON s.id = p.sesion_id JOIN materias m ON m.id = s.materia_id JOIN usuarios e ON e.id = s.estudiante_id
    WHERE s.tutor_id = ? AND p.estado IN ('RETENIDO','LIBERADO','REEMBOLSO_PARCIAL','EN_DISPUTA') AND s.estado IN ('FINALIZADA','CANCELADA')
    ORDER BY COALESCE(s.finalizada_en, p.creado_en) DESC LIMIT 100`, req.yo.id);
  const suma = (estados: string[]) => movimientos.filter((m) => estados.includes(m.estado)).reduce((a, m) => a + m.netoTutor, 0);
  res.json({
    disponible: suma(['LIBERADO', 'REEMBOLSO_PARCIAL']), porLiberar: suma(['RETENIDO']), enDisputa: suma(['EN_DISPUTA']), movimientos,
  });
});

/* ---------- Reserva programada (P-04) ---------- */

api.post('/sesiones', soloRol('ESTUDIANTE'), (req, res) => {
  const b = req.body;
  const tutorId = entero(b.tutorId, 'El tutor');
  const materiaId = entero(b.materiaId, 'La materia');
  const duracion = entero(b.duracionMin, 'La duración');
  if (!DURACIONES.includes(duracion)) throw new ErrorHttp(400, 'La duración debe ser de 60, 90 o 120 minutos.');
  const modalidad = opcion(b.modalidad, 'La modalidad', ['VIRTUAL', 'PRESENCIAL'] as const);
  const tema = texto(b.tema, 'El tema', 3, 200);
  const inicio = Date.parse(String(b.inicio));
  if (Number.isNaN(inicio)) throw new ErrorHttp(400, 'La fecha de la sesión no es válida.');
  if (tutorId === req.yo.id) throw new ErrorHttp(400, 'No puedes reservar una sesión contigo mismo.'); // RN-10

  const t = tutorPorId(tutorId);
  if (!t || t.verificacion !== 'APROBADO' || t.estado !== 'ACTIVO') throw new ErrorHttp(404, 'El tutor no está disponible.');
  if (!uno(`SELECT 1 AS x FROM tutor_materias tm JOIN materias m ON m.id = tm.materia_id
            WHERE tm.tutor_id = ? AND tm.materia_id = ? AND m.activa = 1`, tutorId, materiaId))
    throw new ErrorHttp(400, 'El tutor no dicta esa materia.');
  if (t.modalidad !== 'AMBAS' && t.modalidad !== modalidad) throw new ErrorHttp(400, 'El tutor no atiende en esa modalidad.');
  if (!franjaDisponible(tutorId, inicio, duracion)) throw new ErrorHttp(409, 'Ese horario ya no está disponible. Elige otro.');
  const metodo = validarPago(b.pago);
  const precio = Math.round((t.tarifa_hora * duracion) / 60);

  const id = tx(() => {
    const expira = new Date(Math.min(Date.now() + VENTANA_PROGRAMADA, inicio)).toISOString();
    const sid = Number(ejecutar(`INSERT INTO sesiones (estudiante_id, tutor_id, materia_id, tipo, estado, inicio, duracion_min, modalidad,
      tema, precio, metodo_pago, expira_en, creado_en) VALUES (?,?,?, 'PROGRAMADA', 'PENDIENTE_ACEPTACION', ?,?,?,?,?,?,?,?)`,
      req.yo.id, tutorId, materiaId, new Date(inicio).toISOString(), duracion, modalidad, tema, precio, metodo, expira, ahoraIso()).lastInsertRowid);
    const materiaNombre = uno<{ nombre: string }>('SELECT nombre FROM materias WHERE id = ?', materiaId)!.nombre;
    registrar(sid, 'SESION_CREADA', `${req.yo.nombre} reservó ${materiaNombre} con ${t.nombre} para el ${fechaHoraCo(inicio)} `
      + `(${duracionTexto(duracion)}, ${modalidad === 'VIRTUAL' ? 'virtual' : 'presencial'}). Tema: ${tema}.`, req.yo.id);
    cobrar(sid, precio, metodo);
    notificar(tutorId, 'Nueva solicitud de reserva', `${req.yo.nombre} quiere una sesión. Tienes 12 horas para responder.`, sid);
    return sid;
  });
  const s = sesionPorId(id);
  avisarSesion(s);
  res.status(201).json(vistaSesion(s, req.yo));
});

/* ---------- Tutoría bajo demanda (P-06) ---------- */

api.post('/sesiones/demanda', soloRol('ESTUDIANTE'), (req, res) => {
  const b = req.body;
  const materiaId = entero(b.materiaId, 'La materia');
  const duracion = entero(b.duracionMin, 'La duración');
  if (!DURACIONES.includes(duracion)) throw new ErrorHttp(400, 'La duración debe ser de 60, 90 o 120 minutos.');
  const tema = texto(b.tema, 'El tema', 3, 200);
  if (!uno('SELECT 1 AS x FROM materias WHERE id = ? AND activa = 1', materiaId)) throw new ErrorHttp(400, 'La materia no está disponible.');
  if (uno(`SELECT 1 AS x FROM sesiones WHERE estudiante_id = ? AND estado = 'BUSCANDO_TUTOR'`, req.yo.id))
    throw new ErrorHttp(409, 'Ya tienes una solicitud en curso.');
  const metodo = validarPago(b.pago); // se valida ahora y se cobra cuando un tutor acepta

  const candidatos = tutoresElegibles(materiaId).filter((id) => id !== req.yo.id);
  const id = tx(() => {
    const sid = Number(ejecutar(`INSERT INTO sesiones (estudiante_id, materia_id, tipo, estado, duracion_min, modalidad, tema,
      metodo_pago, expira_en, creado_en) VALUES (?,?, 'BAJO_DEMANDA', ?,?, 'VIRTUAL', ?,?,?,?)`,
      req.yo.id, materiaId, candidatos.length ? 'BUSCANDO_TUTOR' : 'SIN_TUTOR', duracion, tema, metodo,
      candidatos.length ? new Date(Date.now() + VENTANA_DEMANDA).toISOString() : null, ahoraIso()).lastInsertRowid);
    registrar(sid, 'SESION_CREADA', `${req.yo.nombre} pidió un tutor ahora (${duracionTexto(duracion)}). Tema: ${tema}.`, req.yo.id);
    if (candidatos.length) {
      const nombres = todos<{ nombre: string }>(`SELECT nombre FROM usuarios WHERE id IN (${candidatos.map(() => '?').join(',')})`, ...candidatos)
        .map((u) => u.nombre).join(', ');
      registrar(sid, 'TUTORES_AVISADOS', `La solicitud llegó a ${candidatos.length} ${candidatos.length === 1 ? 'tutor' : 'tutores'} en línea: ${nombres}.`);
    } else registrar(sid, 'SIN_TUTOR', 'No había tutores en línea para la materia. No se hizo ningún cobro.');
    for (const c of candidatos) notificar(c, 'Solicitud inmediata', `${req.yo.nombre} necesita tutoría ahora. El primero en aceptar la toma.`, sid);
    return sid;
  });
  emitir(candidatos, { tipo: 'demanda' });
  res.status(201).json({ ...vistaSesion(sesionPorId(id), req.yo), tutoresAvisados: candidatos.length });
});

api.get('/demanda/abiertas', soloRol('TUTOR'), (req, res) => {
  const t = tutorPorId(req.yo.id);
  if (t.verificacion !== 'APROBADO' || !t.en_linea) return res.json([]);
  const filas = sesionesDonde(`s.estado = 'BUSCANDO_TUTOR' AND s.expira_en > ?
    AND s.materia_id IN (SELECT materia_id FROM tutor_materias WHERE tutor_id = ?)
    AND NOT EXISTS (SELECT 1 FROM demanda_descartes d WHERE d.sesion_id = s.id AND d.tutor_id = ?)`, ahoraIso(), req.yo.id, req.yo.id);
  res.json(filas.map((s) => ({
    id: s.id, materia: { id: s.materia_id, nombre: s.materia_nombre }, estudiante: { id: s.estudiante_id, nombre: s.estudiante_nombre },
    tema: s.tema, duracionMin: s.duracion_min, expiraEn: s.expira_en, ganancia: Math.round((t.tarifa_hora * s.duracion_min) / 60 * 0.85),
  })));
});

/* ---------- Consulta de sesiones ---------- */

api.get('/sesiones', (req, res) => {
  if (esEquipo(req.yo)) throw new ErrorHttp(403, 'Usa el panel de soporte o de administración.');
  const col = req.yo.rol === 'TUTOR' ? 's.tutor_id' : 's.estudiante_id';
  res.json(sesionesDonde(`${col} = ?`, req.yo.id).map((s) => vistaSesion(s, req.yo)));
});

function sesionVisible(req: Request) {
  const s = sesionPorId(entero(req.params.id, 'La sesión'));
  if (!esEquipo(req.yo) && ![s.estudiante_id, s.tutor_id].includes(req.yo.id)) {
    const abierta = s.estado === 'BUSCANDO_TUTOR' && req.yo.rol === 'TUTOR';
    if (!abierta) throw new ErrorHttp(403, 'No participas en esta sesión.');
  }
  return s;
}

api.get('/sesiones/:id', (req, res) => res.json(vistaSesion(sesionVisible(req), req.yo)));

/** Historial con la hora exacta de cada hecho. Las partes ven los eventos públicos; soporte y administración, todos. */
api.get('/sesiones/:id/historial', (req, res) => {
  const s = sesionVisible(req);
  res.json(eventosDe(s.id, esEquipo(req.yo)));
});

/** Deja constancia de que alguien abrió el enlace de la sala (de la clase o de mediación). */
api.post('/sesiones/:id/sala', (req, res) => {
  const s = sesionVisible(req);
  const cual = opcion(req.body.cual ?? 'CLASE', 'La sala', ['CLASE', 'MEDIACION'] as const);
  if (cual === 'CLASE') {
    if (!s.enlace || !['CONFIRMADA', 'EN_CURSO'].includes(s.estado)) throw new ErrorHttp(409, 'La sala de esta sesión no está disponible.');
    registrar(s.id, 'SALA_ABIERTA', `${req.yo.nombre} abrió el enlace de la sala virtual.`, req.yo.id);
    return res.json({ enlace: s.enlace });
  }
  const d = uno('SELECT * FROM disputas WHERE sesion_id = ?', s.id);
  if (!d?.sala || d.estado === 'RESUELTA') throw new ErrorHttp(409, 'No hay una sala de mediación abierta para este caso.');
  registrar(s.id, 'SALA_MEDIACION_ABIERTA', `${req.yo.nombre}${esEquipo(req.yo) ? ' (soporte)' : ''} entró a la sala de mediación.`, req.yo.id);
  emitirCaso(d.id);
  res.json({ enlace: d.sala });
});

/* ---------- Respuesta del tutor ---------- */

api.post('/sesiones/:id/aceptar', soloRol('TUTOR'), (req, res) => {
  const s = sesionPorId(entero(req.params.id, 'La sesión'));
  if (s.tipo === 'BAJO_DEMANDA' && s.estado !== 'BUSCANDO_TUTOR')
    throw new ErrorHttp(409, 'Otro tutor aceptó primero o la solicitud venció.');
  if (s.tipo === 'PROGRAMADA') {
    if (s.tutor_id !== req.yo.id) throw new ErrorHttp(403, 'No participas en esta sesión.');
    if (s.estado !== 'PENDIENTE_ACEPTACION') throw new ErrorHttp(409, 'La solicitud ya no está pendiente.');
    tx(() => {
      ejecutar(`UPDATE sesiones SET estado = 'CONFIRMADA', expira_en = NULL, enlace = ? WHERE id = ?`,
        s.modalidad === 'VIRTUAL' ? enlaceVirtual(s.id) : null, s.id);
      const tardo = (Date.now() - Date.parse(s.creado_en)) / MIN;
      registrar(s.id, 'ACEPTADA', `${req.yo.nombre} aceptó la reserva ${tardo < 1 ? 'apenas la recibió' : `${duracionTexto(tardo)} después de recibirla`}.`
        + (s.modalidad === 'VIRTUAL' ? ' Se generó la sala virtual.' : ''), req.yo.id);
      notificar(s.estudiante_id, 'Reserva confirmada', `${req.yo.nombre} aceptó tu sesión de ${s.materia_nombre}.`, s.id);
    });
  } else {
    const t = tutorPorId(req.yo.id);
    if (!tutoresElegibles(s.materia_id, s.id).includes(req.yo.id))
      throw new ErrorHttp(403, 'No puedes tomar esta solicitud: revisa que estés en línea y sin otra sesión en curso.');
    const precio = Math.round((t.tarifa_hora * s.duracion_min) / 60);
    tx(() => {
      // RN-04: gana el primer tutor que acepta. La condición sobre el estado decide el empate.
      const r = ejecutar(`UPDATE sesiones SET estado = 'CONFIRMADA', tutor_id = ?, inicio = ?, precio = ?, enlace = ?, expira_en = NULL
        WHERE id = ? AND estado = 'BUSCANDO_TUTOR' AND expira_en > ?`, req.yo.id, ahoraIso(), precio, enlaceVirtual(s.id), s.id, ahoraIso());
      if (Number(r.changes) !== 1) throw new ErrorHttp(409, 'Otro tutor aceptó primero o la solicitud venció.');
      const seg = Math.round((Date.now() - Date.parse(s.creado_en)) / 1000);
      registrar(s.id, 'ACEPTADA', `${req.yo.nombre} tomó la solicitud a los ${seg} segundos (primer tutor en aceptar).`, req.yo.id);
      cobrar(s.id, precio, s.metodo_pago);
      notificar(s.estudiante_id, 'Tutor encontrado', `${req.yo.nombre} aceptó tu solicitud. Se cobraron ${pesos(precio)}.`, s.id);
    });
    emitir(tutoresElegibles(s.materia_id), { tipo: 'demanda' });
  }
  const nueva = sesionPorId(s.id);
  avisarSesion(nueva);
  res.json(vistaSesion(nueva, req.yo));
});

api.post('/sesiones/:id/rechazar', soloRol('TUTOR'), (req, res) => {
  const s = sesionVisible(req);
  if (s.tipo === 'BAJO_DEMANDA') {
    if (s.estado !== 'BUSCANDO_TUTOR') throw new ErrorHttp(409, 'La solicitud ya se cerró.');
    tx(() => {
      ejecutar('INSERT OR IGNORE INTO demanda_descartes VALUES (?,?)', s.id, req.yo.id);
      registrar(s.id, 'SOLICITUD_DESCARTADA', `${req.yo.nombre} pasó la solicitud.`, req.yo.id);
      if (!tutoresElegibles(s.materia_id, s.id).length) {
        ejecutar(`UPDATE sesiones SET estado = 'SIN_TUTOR', expira_en = NULL WHERE id = ?`, s.id);
        registrar(s.id, 'SIN_TUTOR', 'Todos los tutores avisados pasaron la solicitud. No se hizo ningún cobro.');
        notificar(s.estudiante_id, 'No encontramos tutor', 'Ningún tutor disponible tomó la solicitud. No se hizo ningún cobro.', s.id);
      }
    });
    avisarSesion(s);
    return res.json({ ok: true });
  }
  if (s.tutor_id !== req.yo.id) throw new ErrorHttp(403, 'No participas en esta sesión.');
  if (s.estado !== 'PENDIENTE_ACEPTACION') throw new ErrorHttp(409, 'La solicitud ya no está pendiente.');
  tx(() => {
    ejecutar(`UPDATE sesiones SET estado = 'CANCELADA', expira_en = NULL, cancelada_por = ? WHERE id = ?`, req.yo.id, s.id);
    registrar(s.id, 'RECHAZADA', `${req.yo.nombre} rechazó la reserva.`, req.yo.id);
    reembolsar(s.id, 100);
    notificar(s.estudiante_id, 'Reserva rechazada', `${req.yo.nombre} no puede atenderte en ese horario. Te devolvimos el pago completo.`, s.id);
  });
  avisarSesion(s);
  res.json(vistaSesion(sesionPorId(s.id), req.yo));
});

/* ---------- Cancelación (RN-06) ---------- */

api.post('/sesiones/:id/cancelar', (req, res) => {
  const s = sesionVisible(req);
  const v = vistaSesion(s, req.yo);
  if (!v.acciones.includes('cancelar')) throw new ErrorHttp(409, 'Esta sesión ya no se puede cancelar.');
  const porcentaje = porcentajeReembolso(s, req.yo);
  const otro = req.yo.id === s.estudiante_id ? s.tutor_id : s.estudiante_id;
  tx(() => {
    ejecutar(`UPDATE sesiones SET estado = 'CANCELADA', expira_en = NULL, cancelada_por = ? WHERE id = ?`, req.yo.id, s.id);
    const faltaban = s.inicio ? (Date.parse(s.inicio) - Date.now()) / MIN : null;
    registrar(s.id, 'CANCELADA', `${req.yo.nombre} canceló la sesión`
      + (faltaban !== null && faltaban > 0 && s.estado === 'CONFIRMADA' ? ` cuando faltaban ${duracionTexto(faltaban)} para empezar.` : '.'), req.yo.id);
    const devuelto = reembolsar(s.id, porcentaje);
    if (otro) notificar(otro, 'Sesión cancelada', `${req.yo.nombre} canceló la sesión de ${s.materia_nombre}.` +
      (otro === s.estudiante_id ? ` Te devolvimos ${pesos(devuelto)}.` : ''), s.id);
  });
  avisarSesion(s);
  if (s.tipo === 'BAJO_DEMANDA') emitir(tutoresElegibles(s.materia_id), { tipo: 'demanda' });
  res.json(vistaSesion(sesionPorId(s.id), req.yo));
});

/* ---------- Ejecución (P-07) ---------- */

api.post('/sesiones/:id/iniciar', soloRol('TUTOR'), (req, res) => {
  const s = sesionVisible(req);
  if (!vistaSesion(s, req.yo).acciones.includes('iniciar'))
    throw new ErrorHttp(409, 'La sesión solo se puede iniciar desde 10 minutos antes de la hora reservada.');
  if (uno(`SELECT 1 AS x FROM sesiones WHERE tutor_id = ? AND estado = 'EN_CURSO'`, req.yo.id))
    throw new ErrorHttp(409, 'Ya tienes otra sesión en curso.');
  const ahora = ahoraIso();
  ejecutar(`UPDATE sesiones SET estado = 'EN_CURSO', iniciada_en = ? WHERE id = ?`, ahora, s.id);
  const dif = Math.round((Date.parse(ahora) - Date.parse(s.inicio)) / MIN);
  registrar(s.id, 'INICIADA', `${req.yo.nombre} inició la sesión a las ${horaCo(ahora)}` + (s.tipo === 'BAJO_DEMANDA' ? ', apenas aceptó la solicitud.'
    : dif > 1 ? `, ${duracionTexto(dif)} después de la hora reservada.`
      : dif < -1 ? `, ${duracionTexto(-dif)} antes de la hora reservada${MODO_DEMO ? ' (modo demostración)' : ''}.` : ', a la hora reservada.'), req.yo.id);
  notificar(s.estudiante_id, 'Tu sesión comenzó', `${req.yo.nombre} inició la sesión de ${s.materia_nombre}.`, s.id);
  avisarSesion(s);
  res.json(vistaSesion(sesionPorId(s.id), req.yo));
});

api.post('/sesiones/:id/finalizar', soloRol('TUTOR'), (req, res) => {
  const s = sesionVisible(req);
  if (s.tutor_id !== req.yo.id || s.estado !== 'EN_CURSO') throw new ErrorHttp(409, 'La sesión no está en curso.');
  tx(() => finalizarSesion(s));
  res.json(vistaSesion(sesionPorId(s.id), req.yo));
});

/* ---------- Calificación (P-08) ---------- */

api.post('/sesiones/:id/calificar', (req, res) => {
  const s = sesionVisible(req);
  if (!vistaSesion(s, req.yo).acciones.includes('calificar'))
    throw new ErrorHttp(409, 'Solo se califican sesiones realizadas, una vez por persona.'); // RN-07
  const puntaje = entero(req.body.puntaje, 'El puntaje', 1, 5);
  const comentario = String(req.body.comentario ?? '').trim().slice(0, 400);
  const destinatario = req.yo.id === s.estudiante_id ? s.tutor_id : s.estudiante_id;
  tx(() => {
    ejecutar(`INSERT INTO calificaciones (sesion_id, autor_id, destinatario_id, puntaje, comentario, creado_en) VALUES (?,?,?,?,?,?)`,
      s.id, req.yo.id, destinatario, puntaje, comentario, ahoraIso());
    // RN-08: se publican juntas cuando ambas partes ya calificaron.
    const otroNombre = req.yo.id === s.estudiante_id ? s.tutor_nombre : s.estudiante_nombre;
    registrar(s.id, 'CALIFICADA', `${req.yo.nombre} calificó a ${otroNombre} con ${puntaje} ${puntaje === 1 ? 'estrella' : 'estrellas'}.`, req.yo.id);
    const n = uno<{ n: number }>('SELECT COUNT(*) AS n FROM calificaciones WHERE sesion_id = ?', s.id)!.n;
    if (n === 2) {
      ejecutar('UPDATE calificaciones SET publicada = 1 WHERE sesion_id = ?', s.id);
      registrar(s.id, 'CALIFICACIONES_PUBLICADAS', 'Las dos calificaciones se publicaron.');
      notificar(destinatario, 'Calificaciones publicadas', 'Ya puedes ver la calificación que recibiste.', s.id);
    } else {
      notificar(destinatario, 'Te calificaron', 'Califica tú también para ver el resultado.', s.id);
    }
  });
  avisarSesion(s);
  res.json(vistaSesion(sesionPorId(s.id), req.yo));
});

/* ---------- Disputa (RN-09) ---------- */

api.post('/sesiones/:id/disputa', soloRol('ESTUDIANTE'), (req, res) => {
  const s = sesionVisible(req);
  if (!vistaSesion(s, req.yo).acciones.includes('disputa'))
    throw new ErrorHttp(409, 'El reclamo solo se puede abrir dentro de las 48 horas siguientes a la sesión.');
  const motivo = texto(req.body.motivo, 'El motivo', 10, 500);
  const did = tx(() => {
    const id = Number(ejecutar('INSERT INTO disputas (sesion_id, autor_id, motivo, creado_en) VALUES (?,?,?,?)',
      s.id, req.yo.id, motivo, ahoraIso()).lastInsertRowid);
    ejecutar(`UPDATE pagos SET estado = 'EN_DISPUTA' WHERE sesion_id = ?`, s.id);
    registrar(s.id, 'DISPUTA_ABIERTA', `${req.yo.nombre} abrió una disputa. El pago queda congelado hasta que soporte la resuelva.`, req.yo.id);
    notificar(s.tutor_id, 'Abrieron una disputa',
      `${req.yo.nombre} reportó un problema con la sesión de ${s.materia_nombre}. Entra a la sesión, presenta tu versión y adjunta tus pruebas.`, s.id);
    for (const a of idsDeRol('SOPORTE', 'ADMIN'))
      notificar(a, `Nuevo caso #${id}`, `Sesión #${s.id}, ${s.materia_nombre}: ${motivo.slice(0, 90)}`, s.id, `/casos/${id}`);
    return id;
  });
  avisarSesion(s);
  emitirCaso(did);
  res.json(vistaSesion(sesionPorId(s.id), req.yo));
});

/* ---------- Notificaciones (P-10) ---------- */

api.get('/notificaciones', (req, res) => {
  res.json({
    sinLeer: uno<{ n: number }>('SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND leida = 0', req.yo.id)!.n,
    lista: todos(`SELECT id, titulo, cuerpo, sesion_id AS sesionId, enlace, leida, creado_en AS fecha FROM notificaciones
                  WHERE usuario_id = ? ORDER BY id DESC LIMIT 40`, req.yo.id).map((n) => ({ ...n, leida: !!n.leida })),
  });
});

api.post('/notificaciones/leer', (req, res) => {
  ejecutar('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?', req.yo.id);
  res.json({ ok: true });
});

/* ---------- Casos de soporte, adjuntos y consulta para el equipo (P-11) ---------- */

montarCasos(api);

/* ---------- Administración (P-02, P-11) y reportes (M12) ---------- */

const admin = express.Router();
api.use('/admin', soloRol('ADMIN'), admin);

admin.get('/resumen', (_req, res) => {
  const n = (sql: string, ...p: any[]) => uno<{ n: number }>(sql, ...p)!.n ?? 0;
  const demanda = n(`SELECT COUNT(*) AS n FROM sesiones WHERE tipo = 'BAJO_DEMANDA' AND estado NOT IN ('BUSCANDO_TUTOR')`);
  const demandaAsignada = n(`SELECT COUNT(*) AS n FROM sesiones WHERE tipo = 'BAJO_DEMANDA' AND tutor_id IS NOT NULL`);
  const desde = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);
  res.json({
    estudiantes: n(`SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'ESTUDIANTE'`),
    tutoresAprobados: n(`SELECT COUNT(*) AS n FROM tutores WHERE verificacion = 'APROBADO'`),
    tutoresPendientes: n(`SELECT COUNT(*) AS n FROM tutores WHERE verificacion = 'PENDIENTE'`),
    tutoresEnLinea: n(`SELECT COUNT(*) AS n FROM tutores WHERE en_linea = 1`),
    disputasAbiertas: n(`SELECT COUNT(*) AS n FROM disputas WHERE estado <> 'RESUELTA'`),
    disputasEscaladas: n(`SELECT COUNT(*) AS n FROM disputas WHERE estado = 'ESCALADA'`),
    disputasSinAsignar: n(`SELECT COUNT(*) AS n FROM disputas WHERE estado = 'ABIERTA'`),
    solicitudesMateria: n(`SELECT COUNT(*) AS n FROM solicitudes_materia WHERE estado = 'PENDIENTE'`),
    sesionesTotales: n('SELECT COUNT(*) AS n FROM sesiones'),
    sesionesFinalizadas: n(`SELECT COUNT(*) AS n FROM sesiones WHERE estado = 'FINALIZADA'`),
    volumenPagado: n(`SELECT COALESCE(SUM(monto - reembolso), 0) AS n FROM pagos`),
    comisiones: n(`SELECT COALESCE(SUM(comision), 0) AS n FROM pagos WHERE estado IN ('LIBERADO','REEMBOLSO_PARCIAL')`),
    retenido: n(`SELECT COALESCE(SUM(monto), 0) AS n FROM pagos WHERE estado IN ('RETENIDO','EN_DISPUTA')`),
    calificacionPromedio: uno<{ n: number }>(`SELECT ROUND(AVG(c.puntaje), 2) AS n FROM calificaciones c JOIN usuarios u ON u.id = c.destinatario_id
                                              WHERE u.rol = 'TUTOR' AND c.publicada = 1`)!.n,
    tasaAsignacion: demanda ? Math.round((demandaAsignada / demanda) * 100) : null,
    porEstado: todos('SELECT estado, COUNT(*) AS total FROM sesiones GROUP BY estado ORDER BY total DESC'),
    porMateria: todos(`SELECT m.nombre AS materia, COUNT(*) AS total FROM sesiones s JOIN materias m ON m.id = s.materia_id
                       GROUP BY m.id ORDER BY total DESC LIMIT 6`),
    porDia: todos(`SELECT substr(COALESCE(inicio, creado_en), 1, 10) AS dia, COUNT(*) AS total FROM sesiones
                   WHERE substr(COALESCE(inicio, creado_en), 1, 10) >= ? GROUP BY dia ORDER BY dia`, desde),
  });
});

admin.get('/tutores', (req, res) => {
  const filtro = typeof req.query.verificacion === 'string' ? req.query.verificacion : null;
  const filas = todos(`SELECT usuario_id AS id FROM tutores ${filtro ? 'WHERE verificacion = ?' : ''}
                       ORDER BY verificacion = 'PENDIENTE' DESC, usuario_id DESC`, ...(filtro ? [filtro] : []));
  res.json(filas.map((f) => {
    const t = tutorPorId(f.id);
    return { ...vistaTutor(t, true), email: uno('SELECT email FROM usuarios WHERE id = ?', f.id).email };
  }));
});

admin.post('/tutores/:id/verificar', (req, res) => {
  const id = entero(req.params.id, 'El tutor');
  const t = tutorPorId(id);
  if (!t) throw new ErrorHttp(404, 'El tutor no existe.');
  if (t.verificacion !== 'PENDIENTE') throw new ErrorHttp(409, 'El perfil no está pendiente de revisión.');
  const aprobar = !!req.body.aprobar;
  const motivo = aprobar ? null : texto(req.body.motivo, 'El motivo del rechazo', 5, 300);
  tx(() => {
    ejecutar('UPDATE tutores SET verificacion = ?, motivo_rechazo = ? WHERE usuario_id = ?', aprobar ? 'APROBADO' : 'RECHAZADO', motivo, id);
    auditar(req.yo.id, aprobar ? 'TUTOR_APROBADO' : 'TUTOR_RECHAZADO',
      aprobar ? `Aprobó el perfil de ${t.nombre}.` : `Rechazó el perfil de ${t.nombre}: ${motivo}`, id);
    notificar(id, aprobar ? 'Perfil aprobado' : 'Perfil rechazado', aprobar
      ? 'Ya apareces en las búsquedas. Configura tu agenda y conéctate para recibir solicitudes.'
      : `Motivo: ${motivo}. Corrige tu perfil y vuelve a enviarlo.`);
  });
  emitir(id, { tipo: 'perfil' });
  res.json(vistaTutor(tutorPorId(id), true));
});

/* ---------- Usuarios: jerarquía en accionesSobre() de nucleo.ts ---------- */

const ROL_TEXTO: Record<Usuario['rol'], string> = { ESTUDIANTE: 'estudiante', TUTOR: 'tutor', SOPORTE: 'soporte', ADMIN: 'administrador' };
const SQL_USUARIO_ADMIN = `SELECT id, nombre, email, rol, estado, superior, debe_cambiar, creado_en FROM usuarios`;

function vistaUsuarioAdmin(u: any, yo: Usuario) {
  return {
    id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, estado: u.estado, creadoEn: u.creado_en,
    superior: !!u.superior, debeCambiarPassword: !!u.debe_cambiar, acciones: accionesSobre(yo, u),
  };
}
function usuarioObjetivo(idTexto: unknown) {
  const u = uno<any>(`${SQL_USUARIO_ADMIN} WHERE id = ?`, entero(idTexto, 'El usuario'));
  if (!u) throw new ErrorHttp(404, 'El usuario no existe.');
  return u;
}
function correoValido(v: unknown, idActual = 0) {
  const email = texto(v, 'El correo', 5, 120).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErrorHttp(400, 'El correo no es válido.');
  if (uno('SELECT 1 AS x FROM usuarios WHERE email = ? AND id <> ?', email, idActual)) throw new ErrorHttp(409, 'Ya existe una cuenta con ese correo.');
  return email;
}

admin.get('/usuarios', (req, res) => {
  const q = `%${String(req.query.q ?? '').trim()}%`;
  res.json(todos(`${SQL_USUARIO_ADMIN} WHERE nombre LIKE ? OR email LIKE ? ORDER BY superior DESC, id DESC LIMIT 200`, q, q)
    .map((u) => vistaUsuarioAdmin(u, req.yo)));
});

/** Crea cuentas del equipo interno. Soporte la crea cualquier admin; otro administrador, solo el principal. */
admin.post('/usuarios', (req, res) => {
  const nombre = texto(req.body.nombre, 'El nombre', 3, 80);
  const email = correoValido(req.body.email);
  const password = validarClave(req.body.password);
  const rol = opcion(req.body.rol, 'El rol', ['SOPORTE', 'ADMIN'] as const);
  if (rol === 'ADMIN' && !req.yo.superior) throw new ErrorHttp(403, 'Solo el administrador principal crea cuentas de administrador.');
  const id = tx(() => {
    const nuevo = Number(ejecutar('INSERT INTO usuarios (nombre, email, password_hash, rol, debe_cambiar, creado_en) VALUES (?,?,?,?,1,?)',
      nombre, email, bcrypt.hashSync(password, 10), rol, ahoraIso()).lastInsertRowid);
    auditar(req.yo.id, 'CUENTA_CREADA', `Creó la cuenta de ${ROL_TEXTO[rol]} de ${nombre} (${email}).`, nuevo);
    return nuevo;
  });
  res.status(201).json(vistaUsuarioAdmin(uno(`${SQL_USUARIO_ADMIN} WHERE id = ?`, id), req.yo));
});

/** Edita nombre y correo; el rol (soporte ↔ administración) solo lo cambia el administrador principal. */
admin.patch('/usuarios/:id', (req, res) => {
  const u = usuarioObjetivo(req.params.id);
  exigirAccion(req.yo, u, 'editar');
  const nombre = req.body.nombre === undefined ? u.nombre : texto(req.body.nombre, 'El nombre', 3, 80);
  const email = req.body.email === undefined ? u.email : correoValido(req.body.email, u.id);
  let rol = u.rol as Usuario['rol'];
  if (req.body.rol !== undefined && req.body.rol !== u.rol) {
    exigirAccion(req.yo, u, 'rol');
    rol = opcion(req.body.rol, 'El rol', ['SOPORTE', 'ADMIN'] as const);
  }
  const cambios = [
    nombre !== u.nombre && `nombre "${u.nombre}" → "${nombre}"`,
    email !== u.email && `correo ${u.email} → ${email}`,
    rol !== u.rol && `rol ${ROL_TEXTO[u.rol as Usuario['rol']]} → ${ROL_TEXTO[rol]}`,
  ].filter(Boolean);
  if (cambios.length) tx(() => {
    ejecutar('UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?', nombre, email, rol, u.id);
    auditar(req.yo.id, 'CUENTA_EDITADA', `Editó la cuenta de ${nombre}: ${cambios.join(', ')}.`, u.id);
  });
  emitir(u.id, { tipo: 'perfil' });
  res.json(vistaUsuarioAdmin(uno(`${SQL_USUARIO_ADMIN} WHERE id = ?`, u.id), req.yo));
});

/** Restablece la contraseña de otra cuenta y cierra sus sesiones abiertas. */
admin.post('/usuarios/:id/password', (req, res) => {
  const u = usuarioObjetivo(req.params.id);
  exigirAccion(req.yo, u, 'password');
  const password = validarClave(req.body.password);
  const debeCambiar = req.body.debeCambiar !== false;
  tx(() => {
    ejecutar('UPDATE usuarios SET password_hash = ?, debe_cambiar = ?, version_token = version_token + 1 WHERE id = ?',
      bcrypt.hashSync(password, 10), debeCambiar ? 1 : 0, u.id);
    auditar(req.yo.id, 'PASSWORD_RESTABLECIDA',
      `Restableció la contraseña de ${u.nombre}${debeCambiar ? ' (deberá cambiarla al ingresar)' : ''}.`, u.id);
  });
  res.json(vistaUsuarioAdmin(uno(`${SQL_USUARIO_ADMIN} WHERE id = ?`, u.id), req.yo));
});

admin.post('/usuarios/:id/estado', (req, res) => {
  const u = usuarioObjetivo(req.params.id);
  const estado = opcion(req.body.estado, 'El estado', ['ACTIVO', 'SUSPENDIDO'] as const);
  exigirAccion(req.yo, u, estado === 'SUSPENDIDO' ? 'suspender' : 'reactivar');
  tx(() => {
    ejecutar('UPDATE usuarios SET estado = ? WHERE id = ?', estado, u.id);
    if (estado === 'SUSPENDIDO') ejecutar('UPDATE tutores SET en_linea = 0 WHERE usuario_id = ?', u.id);
    auditar(req.yo.id, estado === 'SUSPENDIDO' ? 'CUENTA_SUSPENDIDA' : 'CUENTA_REACTIVADA',
      `${estado === 'SUSPENDIDO' ? 'Suspendió' : 'Reactivó'} la cuenta de ${u.nombre} (${ROL_TEXTO[u.rol as Usuario['rol']]}).`, u.id);
  });
  res.json({ id: u.id, estado });
});

/* ---------- Bitácora de administración ---------- */

admin.get('/auditoria', (req, res) => {
  const q = `%${String(req.query.q ?? '').trim()}%`;
  res.json(todos(`
    SELECT a.id, a.accion, a.texto, a.creado_en AS fecha, u.id AS actorId, u.nombre AS actorNombre, u.superior AS actorSuperior
    FROM auditoria a JOIN usuarios u ON u.id = a.actor_id
    WHERE a.texto LIKE ? OR u.nombre LIKE ? ORDER BY a.id DESC LIMIT 300`, q, q)
    .map((a) => ({ id: a.id, accion: a.accion, texto: a.texto, fecha: a.fecha,
      actor: { id: a.actorId, nombre: a.actorNombre, superior: !!a.actorSuperior } })));
});

/* ---------- Catálogo de materias ---------- */

const SQL_MATERIA_ADMIN = `
  SELECT m.id, m.nombre, m.area, m.activa,
         (SELECT COUNT(*) FROM tutor_materias tm WHERE tm.materia_id = m.id) AS tutores,
         (SELECT COUNT(*) FROM sesiones s WHERE s.materia_id = m.id) AS sesiones
  FROM materias m`;
const vistaMateria = (m: any) => ({ id: m.id, nombre: m.nombre, area: m.area, activa: !!m.activa, tutores: m.tutores, sesiones: m.sesiones });
function nombreMateriaLibre(nombre: string, id = 0) {
  if (uno('SELECT 1 AS x FROM materias WHERE lower(nombre) = lower(?) AND id <> ?', nombre, id))
    throw new ErrorHttp(409, 'Ya existe una materia con ese nombre.');
}

admin.get('/materias', (_req, res) => {
  res.json(todos(`${SQL_MATERIA_ADMIN} ORDER BY m.activa DESC, m.area, m.nombre`).map(vistaMateria));
});

admin.post('/materias', (req, res) => {
  const nombre = texto(req.body.nombre, 'El nombre', 3, 60);
  const area = texto(req.body.area, 'El área', 3, 40);
  nombreMateriaLibre(nombre);
  const id = tx(() => {
    const nueva = Number(ejecutar('INSERT INTO materias (nombre, area) VALUES (?,?)', nombre, area).lastInsertRowid);
    auditar(req.yo.id, 'MATERIA_CREADA', `Creó la materia ${nombre} (${area}).`);
    return nueva;
  });
  res.status(201).json(vistaMateria(uno(`${SQL_MATERIA_ADMIN} WHERE m.id = ?`, id)));
});

admin.patch('/materias/:id', (req, res) => {
  const m = uno<any>('SELECT * FROM materias WHERE id = ?', entero(req.params.id, 'La materia'));
  if (!m) throw new ErrorHttp(404, 'La materia no existe.');
  const nombre = req.body.nombre === undefined ? m.nombre : texto(req.body.nombre, 'El nombre', 3, 60);
  const area = req.body.area === undefined ? m.area : texto(req.body.area, 'El área', 3, 40);
  const activa = req.body.activa === undefined ? !!m.activa : !!req.body.activa;
  if (nombre !== m.nombre) nombreMateriaLibre(nombre, m.id);
  const cambios = [
    nombre !== m.nombre && `nombre "${m.nombre}" → "${nombre}"`,
    area !== m.area && `área ${m.area} → ${area}`,
    activa !== !!m.activa && (activa ? 'la activó' : 'la desactivó'),
  ].filter(Boolean);
  if (cambios.length) tx(() => {
    ejecutar('UPDATE materias SET nombre = ?, area = ?, activa = ? WHERE id = ?', nombre, area, activa ? 1 : 0, m.id);
    auditar(req.yo.id, 'MATERIA_EDITADA', `Materia ${nombre}: ${cambios.join(', ')}.`);
  });
  res.json(vistaMateria(uno(`${SQL_MATERIA_ADMIN} WHERE m.id = ?`, m.id)));
});

/* ---------- Solicitudes de materias de los tutores ---------- */

const SQL_SOLICITUD_ADMIN = `
  SELECT s.*, t.nombre AS tutor_nombre, t.email AS tutor_email, r.nombre AS resuelta_nombre
  FROM solicitudes_materia s JOIN usuarios t ON t.id = s.tutor_id LEFT JOIN usuarios r ON r.id = s.resuelta_por`;

function solicitudPendiente(idTexto: unknown) {
  const s = uno<any>(`${SQL_SOLICITUD_ADMIN} WHERE s.id = ?`, entero(idTexto, 'La solicitud'));
  if (!s) throw new ErrorHttp(404, 'La solicitud no existe.');
  if (s.estado !== 'PENDIENTE') throw new ErrorHttp(409, 'La solicitud ya fue respondida.');
  return s;
}

admin.get('/solicitudes-materia', (_req, res) => {
  res.json(todos(`${SQL_SOLICITUD_ADMIN} ORDER BY s.estado = 'PENDIENTE' DESC, s.id DESC LIMIT 200`).map(vistaSolicitud));
});

/** Aprueba: crea la materia (o reactiva una con el mismo nombre) y se la asigna al tutor si tiene cupo (máximo 6). */
admin.post('/solicitudes-materia/:id/aprobar', (req, res) => {
  const s = solicitudPendiente(req.params.id);
  const nombre = req.body.nombre === undefined ? s.nombre : texto(req.body.nombre, 'El nombre', 3, 60);
  const area = req.body.area === undefined ? s.area : texto(req.body.area, 'El área', 3, 40);
  let asignada = false;
  tx(() => {
    const existente = uno<{ id: number }>('SELECT id FROM materias WHERE lower(nombre) = lower(?)', nombre);
    const materiaId = existente
      ? (ejecutar('UPDATE materias SET activa = 1 WHERE id = ?', existente.id), existente.id)
      : Number(ejecutar('INSERT INTO materias (nombre, area) VALUES (?,?)', nombre, area).lastInsertRowid);
    const tiene = uno<{ n: number }>('SELECT COUNT(*) AS n FROM tutor_materias WHERE tutor_id = ?', s.tutor_id)!.n;
    if (tiene < 6) {
      ejecutar('INSERT OR IGNORE INTO tutor_materias VALUES (?,?)', s.tutor_id, materiaId);
      asignada = true;
    }
    ejecutar(`UPDATE solicitudes_materia SET estado = 'APROBADA', materia_id = ?, resuelta_por = ?, resuelta_en = ?, respuesta = ? WHERE id = ?`,
      materiaId, req.yo.id, ahoraIso(), asignada ? null : 'La materia quedó en el catálogo; ya tienes 6 materias, cambia alguna en tu perfil para agregarla.', s.id);
    auditar(req.yo.id, 'SOLICITUD_APROBADA',
      `Aprobó la solicitud de ${s.tutor_nombre}: ${existente ? 'reactivó' : 'creó'} la materia ${nombre} (${area})${asignada ? ' y se la asignó' : ''}.`, s.tutor_id);
    notificar(s.tutor_id, 'Materia aprobada', asignada
      ? `${nombre} ya está en el catálogo y en tu perfil.`
      : `${nombre} ya está en el catálogo. Tienes 6 materias: cambia alguna en tu perfil para agregarla.`, null, '/perfil');
  });
  emitir(s.tutor_id, { tipo: 'perfil' });
  res.json({ ...vistaSolicitud(uno(`${SQL_SOLICITUD_ADMIN} WHERE s.id = ?`, s.id)), asignada });
});

admin.post('/solicitudes-materia/:id/rechazar', (req, res) => {
  const s = solicitudPendiente(req.params.id);
  const motivo = texto(req.body.motivo, 'El motivo del rechazo', 5, 300);
  tx(() => {
    ejecutar(`UPDATE solicitudes_materia SET estado = 'RECHAZADA', respuesta = ?, resuelta_por = ?, resuelta_en = ? WHERE id = ?`,
      motivo, req.yo.id, ahoraIso(), s.id);
    auditar(req.yo.id, 'SOLICITUD_RECHAZADA', `Rechazó la solicitud de ${s.tutor_nombre} para ${s.nombre}: ${motivo}`, s.tutor_id);
    notificar(s.tutor_id, 'Solicitud de materia rechazada', `${s.nombre}: ${motivo}`, null, '/perfil');
  });
  res.json(vistaSolicitud(uno(`${SQL_SOLICITUD_ADMIN} WHERE s.id = ?`, s.id)));
});

/* ---------- Exportar a CSV (Excel en español usa ; como separador) ---------- */

function enviarCsv(res: Response, nombre: string, encabezados: string[], filas: unknown[][]) {
  const celda = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cuerpo = [encabezados, ...filas].map((f) => f.map(celda).join(';')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.send('﻿' + cuerpo);
}
const fechaCsv = (iso: string | null) => (iso ? fechaHoraCo(iso) : '');

admin.get('/exportar/usuarios.csv', (req, res) => {
  const filas = todos(`${SQL_USUARIO_ADMIN} ORDER BY id`);
  auditar(req.yo.id, 'EXPORTACION', `Exportó la lista de usuarios (${filas.length} filas).`);
  enviarCsv(res, 'usuarios.csv', ['ID', 'Nombre', 'Correo', 'Rol', 'Estado', 'Principal', 'Registro'],
    filas.map((u) => [u.id, u.nombre, u.email, ROL_TEXTO[u.rol as Usuario['rol']], u.estado, u.superior ? 'Sí' : '', fechaCsv(u.creado_en)]));
});

admin.get('/exportar/pagos.csv', (req, res) => {
  const filas = todos(`
    SELECT p.id, p.creado_en, s.id AS sesion, m.nombre AS materia, e.nombre AS estudiante, t.nombre AS tutor,
           p.monto, p.comision, p.neto_tutor, p.reembolso, p.metodo, p.referencia, p.estado
    FROM pagos p JOIN sesiones s ON s.id = p.sesion_id JOIN materias m ON m.id = s.materia_id
    JOIN usuarios e ON e.id = s.estudiante_id LEFT JOIN usuarios t ON t.id = s.tutor_id ORDER BY p.id`);
  auditar(req.yo.id, 'EXPORTACION', `Exportó los pagos (${filas.length} filas).`);
  enviarCsv(res, 'pagos.csv',
    ['ID', 'Fecha', 'Sesión', 'Materia', 'Estudiante', 'Tutor', 'Monto', 'Comisión', 'Neto tutor', 'Reembolso', 'Método', 'Referencia', 'Estado'],
    filas.map((p) => [p.id, fechaCsv(p.creado_en), p.sesion, p.materia, p.estudiante, p.tutor, p.monto, p.comision, p.neto_tutor,
      p.reembolso, p.metodo, p.referencia, p.estado]));
});

admin.get('/sesiones', (req, res) => {
  const estado = typeof req.query.estado === 'string' && req.query.estado ? req.query.estado : null;
  const filas = estado ? sesionesDonde('s.estado = ?', estado) : sesionesDonde('1 = 1');
  res.json(filas.map((s) => vistaSesion(s, req.yo)));
});

admin.get('/pagos', (_req, res) => {
  res.json(todos(`
    SELECT p.id, p.monto, p.comision, p.neto_tutor AS netoTutor, p.reembolso, p.metodo, p.referencia, p.estado,
           p.liberar_en AS liberarEn, p.creado_en AS fecha, s.id AS sesionId, s.estado AS estadoSesion,
           e.nombre AS estudiante, t.nombre AS tutor
    FROM pagos p JOIN sesiones s ON s.id = p.sesion_id JOIN usuarios e ON e.id = s.estudiante_id LEFT JOIN usuarios t ON t.id = s.tutor_id
    ORDER BY p.id DESC LIMIT 200`));
});

/** Adelanta la liberación de un pago retenido, para no esperar las 48 h durante una demostración. */
admin.post('/pagos/:id/liberar', (req, res) => {
  const p = uno(`SELECT p.*, s.estado AS estado_sesion, s.tutor_id FROM pagos p JOIN sesiones s ON s.id = p.sesion_id WHERE p.id = ?`,
    entero(req.params.id, 'El pago'));
  if (!p) throw new ErrorHttp(404, 'El pago no existe.');
  if (p.estado !== 'RETENIDO' || p.estado_sesion !== 'FINALIZADA')
    throw new ErrorHttp(409, 'Solo se liberan pagos retenidos de sesiones finalizadas.');
  tx(() => {
    ejecutar(`UPDATE pagos SET estado = 'LIBERADO' WHERE id = ?`, p.id);
    registrar(p.sesion_id, 'PAGO_LIBERADO', `${req.yo.nombre} (administrador) liberó ${pesos(p.neto_tutor)} al tutor antes de las 48 horas.`, req.yo.id);
    auditar(req.yo.id, 'PAGO_LIBERADO', `Liberó ${pesos(p.neto_tutor)} del pago #${p.id} (sesión #${p.sesion_id}) antes de las 48 horas.`, p.tutor_id);
    notificar(p.tutor_id, 'Pago liberado', `Ya tienes disponibles ${pesos(p.neto_tutor)} de tu sesión.`, p.sesion_id);
  });
  res.json({ id: p.id, estado: 'LIBERADO' });
});

/* ---------- Errores ---------- */

api.use((_req, _res, next) => next(new ErrorHttp(404, 'Ruta no encontrada.')));
api.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'El archivo supera los 5 MB.' });
  const status = err instanceof ErrorHttp ? err.status : err?.type === 'entity.parse.failed' ? 400 : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Error interno. Intenta de nuevo.' : err.message });
});

/* ---------- Aplicación web compilada ---------- */

const web = path.resolve(process.env.WEB_DIST ?? path.join(import.meta.dirname, '..', '..', 'web', 'dist'));
if (fs.existsSync(path.join(web, 'index.html'))) {
  app.use(express.static(web, { maxAge: '1h', index: false }));
  // PWA de iPhone: la app móvil exportada a web en web/dist/app (la arma el Dockerfile o "npm run export:pwa" en mobile).
  const pwa = path.join(web, 'app', 'index.html');
  app.get(/^\/app(\/.*)?$/, (req, res, next) => {
    if (!fs.existsSync(pwa)) return next();
    if (req.path === '/app') return res.redirect(301, '/app/');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(pwa);
  });
  app.get('*', (_req, res) => res.sendFile(path.join(web, 'index.html')));
} else {
  app.get('/', (_req, res) => res.type('text').send('API de TutoresOn-Line. Compila la web con "npm run build" en la carpeta web.'));
}

const servidor = http.createServer(app);
montarTiempoReal(servidor);
iniciarTareas();

const puerto = Number(process.env.PORT ?? 3000);
servidor.listen(puerto, () => console.log(`TutoresOn-Line escuchando en el puerto ${puerto}${MODO_DEMO ? ' (modo demo)' : ''}`));
