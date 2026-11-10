import type { Request, Response, NextFunction } from 'express';
import type http from 'node:http';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { uno, todos, ejecutar, COMISION } from './db.js';
import { duracionTexto, horaCo, pesos } from './formato.js';

/* ---------- Configuración ---------- */

const SECRETO = process.env.JWT_SECRET ?? 'solo-para-desarrollo';
/** En modo demo una sesión programada puede iniciarse antes de su hora, para poder mostrar el flujo completo. */
export const MODO_DEMO = (process.env.MODO_DEMO ?? '1') !== '0';

export const MIN = 60_000;
export const HORA = 3_600_000;
export const VENTANA_DEMANDA = 45_000;        // RN-05: 45 s para aceptar una solicitud bajo demanda
export const VENTANA_PROGRAMADA = 12 * HORA;  // RN-05: 12 h para responder una reserva programada
export const RETENCION = 48 * HORA;           // RN-02 y RN-09: 48 h de retención y de plazo para disputar
const UTC_COLOMBIA = -5 * HORA;               // Colombia no cambia de hora en el año

export const ahoraIso = () => new Date().toISOString();
const isoEn = (ms: number) => new Date(Date.now() + ms).toISOString();

/* ---------- Errores y validación ---------- */

export class ErrorHttp extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje); }
}

export function texto(v: unknown, campo: string, min = 1, max = 500): string {
  if (typeof v !== 'string' || v.trim().length < min)
    throw new ErrorHttp(400, min > 1 ? `${campo} debe tener al menos ${min} caracteres.` : `${campo} es obligatorio.`);
  return v.trim().slice(0, max);
}
export function entero(v: unknown, campo: string, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErrorHttp(400, `${campo} no es válido.`);
  return n;
}
export function opcion<T extends string>(v: unknown, campo: string, validas: readonly T[]): T {
  if (!validas.includes(v as T)) throw new ErrorHttp(400, `${campo} no es válido.`);
  return v as T;
}

/* ---------- Autenticación ---------- */

export type Usuario = {
  id: number; nombre: string; email: string; rol: 'ESTUDIANTE' | 'TUTOR' | 'SOPORTE' | 'ADMIN'; estado: string;
  superior: number; debe_cambiar: number; version_token: number;
};
export const COLUMNAS_USUARIO = 'id, nombre, email, rol, estado, superior, debe_cambiar, version_token';
export const esEquipo = (u: Usuario) => u.rol === 'ADMIN' || u.rol === 'SOPORTE';
declare global {
  namespace Express { interface Request { yo: Usuario } }
}

/** El token lleva la versión de la cuenta: cambiar o restablecer la contraseña la sube y cierra las demás sesiones. */
export const firmar = (u: { id: number; version_token: number }) =>
  jwt.sign({ sub: String(u.id), v: u.version_token }, SECRETO, { expiresIn: '7d' });

export function usuarioDeToken(token?: string | null): Usuario | null {
  try {
    const p = jwt.verify(token ?? '', SECRETO) as { sub: string; v?: number };
    const u = uno<Usuario>(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = ?`, Number(p.sub));
    return u && u.estado === 'ACTIVO' && (p.v ?? 0) === u.version_token ? u : null;
  } catch {
    return null;
  }
}

/** Regla común de contraseñas. */
export function validarClave(password: unknown): string {
  const p = String(password ?? '');
  if (p.length < 8 || !/[a-zA-Z]/.test(p) || !/\d/.test(p))
    throw new ErrorHttp(400, 'La contraseña debe tener al menos 8 caracteres, con letras y números.');
  return p;
}

/* ---------- Jerarquía de administración ---------- */

export type AccionUsuario = 'editar' | 'password' | 'suspender' | 'reactivar' | 'rol';

/**
 * Qué puede hacer un admin sobre otra cuenta. Nadie toca al administrador principal; solo él gestiona a los demás
 * administradores y cambia roles entre soporte y administración. Nadie se suspende ni se cambia el rol a sí mismo.
 */
export function accionesSobre(yo: Usuario, x: { id: number; rol: Usuario['rol']; estado: string; superior: number }): AccionUsuario[] {
  if (yo.rol !== 'ADMIN' || x.superior || x.id === yo.id) return [];
  if (x.rol === 'ADMIN' && !yo.superior) return [];
  const a: AccionUsuario[] = ['editar', 'password', x.estado === 'ACTIVO' ? 'suspender' : 'reactivar'];
  if (yo.superior && (x.rol === 'SOPORTE' || x.rol === 'ADMIN')) a.push('rol');
  return a;
}

export function exigirAccion(yo: Usuario, x: Parameters<typeof accionesSobre>[1], accion: AccionUsuario) {
  if (!accionesSobre(yo, x).includes(accion))
    throw new ErrorHttp(403, x.superior ? 'La cuenta del administrador principal no se puede modificar.'
      : x.rol === 'ADMIN' ? 'Solo el administrador principal gestiona a otros administradores.'
      : 'No puedes hacer esta acción sobre esta cuenta.');
}

/* ---------- Bitácora de administración ---------- */

export function auditar(actorId: number, accion: string, texto: string, objetivoId: number | null = null) {
  ejecutar('INSERT INTO auditoria (actor_id, accion, objetivo_id, texto, creado_en) VALUES (?,?,?,?,?)',
    actorId, accion, objetivoId, texto, ahoraIso());
}

export function autenticar(req: Request, _res: Response, next: NextFunction) {
  const cab = req.headers.authorization ?? '';
  const u = usuarioDeToken(cab.startsWith('Bearer ') ? cab.slice(7) : null);
  if (!u) throw new ErrorHttp(401, 'Tu sesión venció o la cuenta está suspendida. Inicia sesión de nuevo.');
  req.yo = u;
  next();
}

export const soloRol = (...roles: Usuario['rol'][]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!roles.includes(req.yo.rol)) throw new ErrorHttp(403, 'Tu rol no permite esta acción.');
  next();
};

/* ---------- Tiempo real ---------- */

const conexiones = new Map<number, Set<WebSocket>>();

export function montarTiempoReal(servidor: http.Server) {
  const wss = new WebSocketServer({ noServer: true });
  servidor.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const u = url.pathname === '/ws' ? usuarioDeToken(url.searchParams.get('token')) : null;
    if (!u) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!conexiones.has(u.id)) conexiones.set(u.id, new Set());
      conexiones.get(u.id)!.add(ws);
      (ws as any).viva = true;
      ws.on('pong', () => { (ws as any).viva = true; });
      ws.on('close', () => conexiones.get(u.id)?.delete(ws));
      ws.send(JSON.stringify({ tipo: 'conectado' }));
    });
  });
  // Latido: cierra las conexiones que dejaron de responder.
  setInterval(() => {
    for (const grupo of conexiones.values())
      for (const ws of grupo) {
        if (!(ws as any).viva) { ws.terminate(); continue; }
        (ws as any).viva = false;
        ws.ping();
      }
  }, 30_000).unref();
}

export function emitir(usuarios: number | number[], evento: Record<string, unknown>) {
  const datos = JSON.stringify(evento);
  for (const id of [usuarios].flat())
    for (const ws of conexiones.get(id) ?? [])
      if (ws.readyState === WebSocket.OPEN) ws.send(datos);
}

/** Guarda la notificación (P-10) y la empuja al usuario si está conectado. `enlace` es la pantalla a la que lleva. */
export function notificar(usuarioId: number, titulo: string, cuerpo: string, sesionId: number | null = null, enlace: string | null = null) {
  ejecutar('INSERT INTO notificaciones (usuario_id, titulo, cuerpo, sesion_id, enlace, creado_en) VALUES (?,?,?,?,?,?)',
    usuarioId, titulo, cuerpo, sesionId, enlace, ahoraIso());
  emitir(usuarioId, { tipo: 'notificacion', titulo, cuerpo, sesionId, enlace });
}

/** Usuarios activos con alguno de los roles indicados. */
export const idsDeRol = (...roles: Usuario['rol'][]) =>
  todos<{ id: number }>(`SELECT id FROM usuarios WHERE estado = 'ACTIVO' AND rol IN (${roles.map(() => '?').join(',')})`, ...roles).map((u) => u.id);

/* ---------- Historial de la sesión ---------- */

/**
 * Registra un hecho con la hora exacta. Los eventos `publico = false` solo los ve el equipo de soporte y administración
 * (por ejemplo, el escalamiento de un caso).
 */
export function registrar(sesionId: number, tipo: string, texto: string, actorId: number | null = null, publico = true) {
  ejecutar('INSERT INTO eventos (sesion_id, tipo, texto, actor_id, publico, creado_en) VALUES (?,?,?,?,?,?)',
    sesionId, tipo, texto, actorId, publico ? 1 : 0, ahoraIso());
}

export function eventosDe(sesionId: number, incluirInternos: boolean) {
  return todos(`SELECT e.id, e.tipo, e.texto, e.publico, e.creado_en AS fecha, u.id AS actor_id, u.nombre AS actor_nombre, u.rol AS actor_rol
                FROM eventos e LEFT JOIN usuarios u ON u.id = e.actor_id
                WHERE e.sesion_id = ? ${incluirInternos ? '' : 'AND e.publico = 1'} ORDER BY e.creado_en, e.id`, sesionId)
    .map((e) => ({
      id: e.id, tipo: e.tipo, texto: e.texto, fecha: e.fecha, interno: !e.publico,
      actor: e.actor_id ? { id: e.actor_id, nombre: e.actor_nombre, rol: e.actor_rol } : null,
    }));
}

/** Avisa a las dos partes de una sesión que algo cambió, para que refresquen la pantalla. */
export function avisarSesion(s: { id: number; estudiante_id: number; tutor_id: number | null }) {
  emitir([s.estudiante_id, ...(s.tutor_id ? [s.tutor_id] : [])], { tipo: 'sesion', sesionId: s.id });
}

/* ---------- Tutores ---------- */

const SQL_TUTOR = `
  SELECT u.id, u.nombre, u.estado, t.bio, t.tarifa_hora, t.modalidad, t.ciudad, t.documento, t.verificacion,
         t.motivo_rechazo, t.en_linea,
         (SELECT ROUND(AVG(c.puntaje), 1) FROM calificaciones c WHERE c.destinatario_id = u.id AND c.publicada = 1) AS calificacion,
         (SELECT COUNT(*) FROM calificaciones c WHERE c.destinatario_id = u.id AND c.publicada = 1) AS total_calificaciones,
         (SELECT COUNT(*) FROM sesiones s WHERE s.tutor_id = u.id AND s.estado = 'FINALIZADA') AS sesiones_realizadas
  FROM usuarios u JOIN tutores t ON t.usuario_id = u.id`;

export function vistaTutor(f: any, privado = false) {
  const v: any = {
    id: f.id, nombre: f.nombre, bio: f.bio, tarifaHora: f.tarifa_hora, modalidad: f.modalidad, ciudad: f.ciudad,
    enLinea: !!f.en_linea, calificacion: f.calificacion, totalCalificaciones: f.total_calificaciones,
    sesionesRealizadas: f.sesiones_realizadas,
    materias: todos(`SELECT m.id, m.nombre, m.area FROM tutor_materias tm JOIN materias m ON m.id = tm.materia_id AND m.activa = 1
                     WHERE tm.tutor_id = ? ORDER BY m.nombre`, f.id),
  };
  if (privado) Object.assign(v, { verificacion: f.verificacion, motivoRechazo: f.motivo_rechazo, documento: f.documento, estado: f.estado });
  return v;
}

export const tutorPorId = (id: number) => uno(`${SQL_TUTOR} WHERE u.id = ?`, id);

export function buscarTutores(q: Record<string, unknown>) {
  const cond = [`t.verificacion = 'APROBADO'`, `u.estado = 'ACTIVO'`];
  const p: any[] = [];
  if (q.materia) { cond.push('EXISTS (SELECT 1 FROM tutor_materias tm WHERE tm.tutor_id = u.id AND tm.materia_id = ?)'); p.push(Number(q.materia)); }
  if (q.q) {
    cond.push(`(u.nombre LIKE ? OR t.bio LIKE ? OR EXISTS (SELECT 1 FROM tutor_materias tm JOIN materias m ON m.id = tm.materia_id
                WHERE tm.tutor_id = u.id AND m.nombre LIKE ?))`);
    const like = `%${String(q.q).trim()}%`;
    p.push(like, like, like);
  }
  if (q.precioMax) { cond.push('t.tarifa_hora <= ?'); p.push(Number(q.precioMax)); }
  if (q.modalidad === 'VIRTUAL' || q.modalidad === 'PRESENCIAL') { cond.push(`t.modalidad IN (?, 'AMBAS')`); p.push(q.modalidad); }
  if (q.enLinea === '1' || q.enLinea === 'true') cond.push('t.en_linea = 1');
  let filas = todos(`${SQL_TUTOR} WHERE ${cond.join(' AND ')}`, ...p);
  if (q.calificacionMin) filas = filas.filter((f) => (f.calificacion ?? 0) >= Number(q.calificacionMin));
  const orden = q.orden === 'precio'
    ? (a: any, b: any) => a.tarifa_hora - b.tarifa_hora
    : (a: any, b: any) => (b.calificacion ?? 0) - (a.calificacion ?? 0) || b.sesiones_realizadas - a.sesiones_realizadas;
  return filas.sort(orden).map((f) => vistaTutor(f));
}

/* ---------- Agenda (P-05) ---------- */

const OCUPAN = `('PENDIENTE_ACEPTACION','CONFIRMADA','EN_CURSO')`;

function ocupadas(tutorId: number) {
  return todos<{ inicio: string; duracion_min: number }>(
    `SELECT inicio, duracion_min FROM sesiones WHERE tutor_id = ? AND inicio IS NOT NULL AND estado IN ${OCUPAN}`, tutorId)
    .map((o) => { const a = Date.parse(o.inicio); return [a, a + o.duracion_min * MIN] as const; });
}

/** Franjas de una hora que el tutor tiene libres en los próximos días. Las horas de la agenda son hora de Colombia. */
export function franjasLibres(tutorId: number, dias = 7) {
  const bloques = todos<{ dia_semana: number; hora_inicio: number; hora_fin: number }>(
    'SELECT dia_semana, hora_inicio, hora_fin FROM disponibilidad WHERE tutor_id = ?', tutorId);
  const ocup = ocupadas(tutorId);
  const ahora = Date.now();
  const local = new Date(ahora + UTC_COLOMBIA);
  const res: string[] = [];
  for (let d = 0; d < dias; d++) {
    const medianoche = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + d);
    const dia = new Date(medianoche).getUTCDay();
    for (const b of bloques.filter((x) => x.dia_semana === dia))
      for (let h = b.hora_inicio; h < b.hora_fin; h++) {
        const t = medianoche + h * HORA - UTC_COLOMBIA;
        if (t < ahora + 30 * MIN) continue;
        if (!ocup.some(([a, z]) => t < z && t + HORA > a)) res.push(new Date(t).toISOString());
      }
  }
  return res.sort();
}

/** Verifica que la franja completa caiga dentro de la agenda del tutor y no se cruce con otra sesión. */
export function franjaDisponible(tutorId: number, inicio: number, duracionMin: number) {
  if (inicio < Date.now()) return false;
  const local = new Date(inicio + UTC_COLOMBIA);
  const desde = local.getUTCHours() * 60 + local.getUTCMinutes();
  const dentro = uno('SELECT 1 AS x FROM disponibilidad WHERE tutor_id = ? AND dia_semana = ? AND hora_inicio * 60 <= ? AND hora_fin * 60 >= ?',
    tutorId, local.getUTCDay(), desde, desde + duracionMin);
  if (!dentro) return false;
  const fin = inicio + duracionMin * MIN;
  return !ocupadas(tutorId).some(([a, z]) => inicio < z && fin > a);
}

/* ---------- Pagos (P-09) ---------- */

/** Pasarela simulada. No guarda el número de la tarjeta, solo los últimos cuatro dígitos. */
export function validarPago(p: any): string {
  const metodo = opcion(p?.metodo, 'El medio de pago', ['TARJETA', 'PSE', 'NEQUI'] as const);
  if (metodo !== 'TARJETA') return metodo;
  const n = String(p.numero ?? '').replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(n)) throw new ErrorHttp(400, 'El número de la tarjeta no es válido.');
  if (n.endsWith('0000')) throw new ErrorHttp(402, 'El banco rechazó el pago. Prueba con otro medio de pago.');
  return `TARJETA •••• ${n.slice(-4)}`;
}

/** Cobra y deja el dinero retenido (RN-02). La comisión de la plataforma es del 15 % (RN-03). */
export function cobrar(sesionId: number, monto: number, metodo: string) {
  const comision = Math.round(monto * COMISION);
  const referencia = `SIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  ejecutar(`INSERT INTO pagos (sesion_id, monto, comision, neto_tutor, metodo, referencia, estado, creado_en)
            VALUES (?,?,?,?,?,?, 'RETENIDO', ?)`,
    sesionId, monto, comision, monto - comision, metodo, referencia, ahoraIso());
  registrar(sesionId, 'PAGO_COBRADO', `Se cobraron ${pesos(monto)} con ${metodo} (referencia ${referencia}). El dinero queda retenido por la plataforma.`);
}

/** Devuelve al estudiante el porcentaje indicado. Lo que no se devuelve se reparte entre tutor y plataforma. */
export function reembolsar(sesionId: number, porcentaje: 0 | 50 | 100) {
  const p = uno('SELECT * FROM pagos WHERE sesion_id = ?', sesionId);
  if (!p) return 0;
  if (porcentaje === 100) {
    ejecutar(`UPDATE pagos SET estado = 'REEMBOLSADO', reembolso = monto, comision = 0, neto_tutor = 0, liberar_en = NULL WHERE id = ?`, p.id);
    registrar(sesionId, 'PAGO_REEMBOLSADO', `Se devolvieron ${pesos(p.monto)} al estudiante (100 %).`);
    return p.monto as number;
  }
  if (porcentaje === 50) {
    const reembolso = Math.round(p.monto / 2);
    const comision = Math.round((p.monto - reembolso) * COMISION);
    ejecutar(`UPDATE pagos SET estado = 'REEMBOLSO_PARCIAL', reembolso = ?, comision = ?, neto_tutor = ?, liberar_en = NULL WHERE id = ?`,
      reembolso, comision, p.monto - reembolso - comision, p.id);
    registrar(sesionId, 'PAGO_REEMBOLSO_PARCIAL',
      `Se devolvieron ${pesos(reembolso)} al estudiante (50 %) y ${pesos(p.monto - reembolso - comision)} quedan para el tutor.`);
    return reembolso;
  }
  ejecutar('UPDATE pagos SET liberar_en = ? WHERE id = ?', isoEn(RETENCION), p.id);
  registrar(sesionId, 'SIN_REEMBOLSO', 'La cancelación no tiene devolución; el pago se liberará al tutor en 48 horas.');
  return 0;
}

/** RN-06: 100 % si faltan más de 24 h, 50 % entre 24 h y 2 h, nada con menos de 2 h. */
export function porcentajeReembolso(s: any, quien: Usuario): 0 | 50 | 100 {
  if (quien.id !== s.estudiante_id || s.estado !== 'CONFIRMADA') return 100;
  const faltan = Date.parse(s.inicio) - Date.now();
  return faltan > 24 * HORA ? 100 : faltan >= 2 * HORA ? 50 : 0;
}

/* ---------- Sesiones ---------- */

const SQL_SESION = `
  SELECT s.*, m.nombre AS materia_nombre, e.nombre AS estudiante_nombre, t.nombre AS tutor_nombre
  FROM sesiones s JOIN materias m ON m.id = s.materia_id JOIN usuarios e ON e.id = s.estudiante_id
  LEFT JOIN usuarios t ON t.id = s.tutor_id`;

export function sesionPorId(id: number) {
  const s = uno(`${SQL_SESION} WHERE s.id = ?`, id);
  if (!s) throw new ErrorHttp(404, 'La sesión no existe.');
  return s;
}

export const sesionesDonde = (donde: string, ...p: any[]) =>
  todos(`${SQL_SESION} WHERE ${donde} ORDER BY COALESCE(s.inicio, s.creado_en) DESC LIMIT 200`, ...p);

export const enlaceVirtual = (id: number) => `https://meet.jit.si/TutoresOnLine-${id}-${crypto.randomBytes(4).toString('hex')}`;

export function vistaSesion(s: any, yo: Usuario) {
  const pago = uno('SELECT * FROM pagos WHERE sesion_id = ?', s.id);
  const califs = todos('SELECT * FROM calificaciones WHERE sesion_id = ?', s.id);
  const mia = califs.find((c) => c.autor_id === yo.id);
  const recibida = califs.find((c) => c.destinatario_id === yo.id && c.publicada);
  const disputa = uno(`SELECT d.*, a.nombre AS asignado_nombre FROM disputas d LEFT JOIN usuarios a ON a.id = d.asignado_a
                       WHERE d.sesion_id = ?`, s.id);
  const soyTutor = yo.id === s.tutor_id;
  const soyEstudiante = yo.id === s.estudiante_id;

  const acciones: string[] = [];
  if (s.estado === 'PENDIENTE_ACEPTACION') {
    if (soyTutor) acciones.push('aceptar', 'rechazar');
    if (soyEstudiante) acciones.push('cancelar');
  } else if (s.estado === 'BUSCANDO_TUTOR') {
    if (soyEstudiante) acciones.push('cancelar');
  } else if (s.estado === 'CONFIRMADA') {
    if (soyTutor && (MODO_DEMO || Date.now() >= Date.parse(s.inicio) - 10 * MIN)) acciones.push('iniciar');
    if (soyTutor || soyEstudiante) acciones.push('cancelar');
  } else if (s.estado === 'EN_CURSO') {
    if (soyTutor) acciones.push('finalizar');
  } else if (s.estado === 'FINALIZADA') {
    if ((soyTutor || soyEstudiante) && !mia) acciones.push('calificar');
    const enPlazo = Date.now() - Date.parse(s.finalizada_en) <= RETENCION;
    if (soyEstudiante && !disputa && pago?.estado === 'RETENIDO' && enPlazo) acciones.push('disputa');
  }

  return {
    id: s.id, tipo: s.tipo, estado: s.estado, inicio: s.inicio, duracionMin: s.duracion_min, modalidad: s.modalidad,
    tema: s.tema, precio: s.precio, expiraEn: s.expira_en, iniciadaEn: s.iniciada_en, finalizadaEn: s.finalizada_en,
    creadoEn: s.creado_en,
    enlace: ['CONFIRMADA', 'EN_CURSO'].includes(s.estado) ? s.enlace : null,
    materia: { id: s.materia_id, nombre: s.materia_nombre },
    estudiante: { id: s.estudiante_id, nombre: s.estudiante_nombre },
    tutor: s.tutor_id ? { id: s.tutor_id, nombre: s.tutor_nombre } : null,
    pago: pago && {
      id: pago.id, monto: pago.monto, comision: pago.comision, netoTutor: pago.neto_tutor, reembolso: pago.reembolso,
      metodo: pago.metodo, referencia: pago.referencia, estado: pago.estado, liberarEn: pago.liberar_en,
    },
    miCalificacion: mia ? { puntaje: mia.puntaje, comentario: mia.comentario, publicada: !!mia.publicada } : null,
    calificacionRecibida: recibida ? { puntaje: recibida.puntaje, comentario: recibida.comentario } : null,
    disputa: disputa ? {
      id: disputa.id, motivo: disputa.motivo, estado: disputa.estado, decision: disputa.decision, resolucion: disputa.resolucion,
      creadoEn: disputa.creado_en, resueltaEn: disputa.resuelta_en,
      // Las partes ven quién lleva su caso y la sala de mediación mientras el caso siga abierto.
      asignado: disputa.asignado_nombre ?? null,
      sala: disputa.estado !== 'RESUELTA' ? disputa.sala : null,
      salaCreadaEn: disputa.estado !== 'RESUELTA' ? disputa.sala_creada_en : null,
    } : null,
    acciones,
    reembolsoSiCancela: acciones.includes('cancelar') && pago ? porcentajeReembolso(s, yo) : null,
  };
}

/** Tutores que pueden recibir una solicitud bajo demanda: aprobados, en línea, dictan la materia y no están en sesión. */
export function tutoresElegibles(materiaId: number, sesionId?: number): number[] {
  return todos<{ id: number }>(`
    SELECT u.id FROM usuarios u JOIN tutores t ON t.usuario_id = u.id
    JOIN tutor_materias tm ON tm.tutor_id = u.id AND tm.materia_id = ?
    WHERE u.estado = 'ACTIVO' AND t.verificacion = 'APROBADO' AND t.en_linea = 1
      AND NOT EXISTS (SELECT 1 FROM sesiones s WHERE s.tutor_id = u.id AND s.estado = 'EN_CURSO')
      AND NOT EXISTS (SELECT 1 FROM demanda_descartes d WHERE d.tutor_id = u.id AND d.sesion_id = ?)`,
    materiaId, sesionId ?? 0).map((f) => f.id);
}

export function finalizarSesion(s: any, automatica = false) {
  const ahora = ahoraIso();
  ejecutar(`UPDATE sesiones SET estado = 'FINALIZADA', finalizada_en = ? WHERE id = ?`, ahora, s.id);
  const real = (Date.parse(ahora) - Date.parse(s.iniciada_en)) / MIN;
  registrar(s.id, automatica ? 'CIERRE_AUTOMATICO' : 'FINALIZADA', automatica
    ? `La sesión seguía abierta una hora después de lo pactado y se cerró automáticamente a las ${horaCo(ahora)}, con ${duracionTexto(real)} registrados.`
    : `${s.tutor_nombre} finalizó la sesión a las ${horaCo(ahora)}, con una duración real de ${duracionTexto(real)} de ${duracionTexto(s.duracion_min)} reservada.`,
    automatica ? null : s.tutor_id);
  ejecutar('UPDATE pagos SET liberar_en = ? WHERE sesion_id = ?', isoEn(RETENCION), s.id);
  notificar(s.estudiante_id, 'Sesión finalizada', `Califica tu sesión de ${s.materia_nombre} con ${s.tutor_nombre}.`, s.id);
  notificar(s.tutor_id, 'Sesión finalizada', 'El pago se libera en 48 horas si no hay reclamos. Califica al estudiante.', s.id);
  avisarSesion(s);
}
