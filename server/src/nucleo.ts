import type { Request, Response, NextFunction } from 'express';
import type http from 'node:http';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { uno, todos, ejecutar } from './db.js';
import { duracionTexto, fechaHoraCo, horaCo, pesos } from './formato.js';
import { DEFINICION, type ClaveParametro } from './parametros.js';

/* ---------- Configuración ---------- */

const SECRETO = process.env.JWT_SECRET ?? 'solo-para-desarrollo';
/** En modo demo una sesión programada puede iniciarse antes de su hora, para poder mostrar el flujo completo. */
export const MODO_DEMO = (process.env.MODO_DEMO ?? '1') !== '0';

export const MIN = 60_000;
export const HORA = 3_600_000;
const UTC_COLOMBIA = -5 * HORA;               // Colombia no cambia de hora en el año

export const ahoraIso = () => new Date().toISOString();
const isoEn = (ms: number) => new Date(Date.now() + ms).toISOString();

/**
 * Valor vigente de un parámetro del negocio (RF-M11-07): la última versión cuya fecha de vigencia ya llegó.
 * Los plazos ya calculados de una sesión (expira_en, liberar_en) y la comisión de un pago ya cobrado no cambian.
 */
export function param(clave: ClaveParametro): number {
  const f = uno<{ valor: number }>(`SELECT valor FROM parametros WHERE clave = ? AND vigente_desde <= ?
                                    ORDER BY vigente_desde DESC, id DESC LIMIT 1`, clave, ahoraIso());
  return f?.valor ?? DEFINICION[clave].valor;
}
/** Plazos en milisegundos a partir de los parámetros. */
export const plazo = {
  reserva: () => param('PLAZO_RESERVA_H') * HORA,
  turno: () => param('TURNO_DEMANDA_S') * 1000,
  busqueda: () => param('BUSQUEDA_DEMANDA_MIN') * MIN,
  garantia: () => param('GARANTIA_H') * HORA,
  disputa: () => param('PLAZO_DISPUTA_H') * HORA,
  tolerancia: () => param('TOLERANCIA_MIN') * MIN,
};
/** Comisión vigente como fracción (0,15 = 15 %). */
export const comision = () => param('COMISION_PCT') / 100;
const numero = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
export const horasTexto = (h: number) => `${numero(h)} ${h === 1 ? 'hora' : 'horas'}`;

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
  terminos_version: string | null; terminos_aceptados_en: string | null;
};
export const COLUMNAS_USUARIO = 'id, nombre, email, rol, estado, superior, debe_cambiar, version_token, terminos_version, terminos_aceptados_en';
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
         (SELECT ROUND(AVG(c.puntaje), 1) FROM calificaciones c WHERE c.destinatario_id = u.id AND c.publicada = 1
            AND c.moderacion <> 'ELIMINADA') AS calificacion,
         (SELECT COUNT(*) FROM calificaciones c WHERE c.destinatario_id = u.id AND c.publicada = 1
            AND c.moderacion <> 'ELIMINADA') AS total_calificaciones,
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

function ocupadas(tutorId: number, excluir = 0) {
  return todos<{ inicio: string; duracion_min: number }>(
    `SELECT inicio, duracion_min FROM sesiones WHERE tutor_id = ? AND inicio IS NOT NULL AND estado IN ${OCUPAN} AND id <> ?`, tutorId, excluir)
    .map((o) => { const a = Date.parse(o.inicio); return [a, a + o.duracion_min * MIN] as const; });
}

/** RF-M05-08 (E4 de P-04): sesión del estudiante que se cruza con el horario pedido, para indicar cuál es. */
export function cruceEstudiante(estudianteId: number, inicio: number, duracionMin: number, excluir = 0) {
  const fin = inicio + duracionMin * MIN;
  return todos(`SELECT s.id, s.inicio, s.duracion_min, m.nombre AS materia FROM sesiones s JOIN materias m ON m.id = s.materia_id
                WHERE s.estudiante_id = ? AND s.inicio IS NOT NULL AND s.estado IN ${OCUPAN} AND s.id <> ?`, estudianteId, excluir)
    .find((o) => { const a = Date.parse(o.inicio); return inicio < a + o.duracion_min * MIN && fin > a; });
}
export function exigirSinCruce(estudianteId: number, inicio: number, duracionMin: number, excluir = 0) {
  const c = cruceEstudiante(estudianteId, inicio, duracionMin, excluir);
  if (c) throw new ErrorHttp(409, `Ya tienes la sesión #${c.id} de ${c.materia} el ${fechaHoraCo(c.inicio)}, que se cruza con ese horario.`);
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
export function franjaDisponible(tutorId: number, inicio: number, duracionMin: number, excluir = 0) {
  if (inicio < Date.now()) return false;
  const local = new Date(inicio + UTC_COLOMBIA);
  const desde = local.getUTCHours() * 60 + local.getUTCMinutes();
  const dentro = uno('SELECT 1 AS x FROM disponibilidad WHERE tutor_id = ? AND dia_semana = ? AND hora_inicio * 60 <= ? AND hora_fin * 60 >= ?',
    tutorId, local.getUTCDay(), desde, desde + duracionMin);
  if (!dentro) return false;
  const fin = inicio + duracionMin * MIN;
  return !ocupadas(tutorId, excluir).some(([a, z]) => inicio < z && fin > a);
}

/* ---------- Pagos (P-09) ---------- */

/**
 * Desglose del costo antes de confirmar (RF-M05-03, paso 4 de P-04). La comisión no se suma al estudiante:
 * se descuenta de lo que recibe el tutor (RN-03). El prototipo no factura IVA, por eso los impuestos van en cero.
 */
export function cotizar(tarifaHora: number, duracionMin: number) {
  const subtotal = Math.round((tarifaHora * duracionMin) / 60);
  const pct = param('COMISION_PCT');
  const com = Math.round(subtotal * pct / 100);
  return {
    tarifaHora, duracionMin, subtotal, comisionPct: pct, comision: com, netoTutor: subtotal - com,
    impuestos: 0, impuestosNota: 'El prototipo no factura IVA; en producción se sumaría según el régimen del tutor.',
    total: subtotal,
  };
}

/** Pasarela simulada. No guarda el número de la tarjeta, solo los últimos cuatro dígitos. */
export function validarPago(p: any): string {
  const metodo = opcion(p?.metodo, 'El medio de pago', ['TARJETA', 'PSE', 'NEQUI'] as const);
  if (metodo !== 'TARJETA') return metodo;
  const n = String(p.numero ?? '').replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(n)) throw new ErrorHttp(400, 'El número de la tarjeta no es válido.');
  if (n.endsWith('0000')) throw new ErrorHttp(402, 'El banco rechazó el pago. Prueba con otro medio de pago.');
  return `TARJETA •••• ${n.slice(-4)}`;
}

/**
 * Autoriza y retiene el importe (RN-02). La comisión vigente (RN-03) queda guardada en el pago: un cambio posterior
 * del parámetro no afecta los pagos ya cobrados.
 */
export function cobrar(sesionId: number, monto: number, metodo: string, texto?: string) {
  const com = Math.round(monto * comision());
  const referencia = `SIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  ejecutar(`INSERT INTO pagos (sesion_id, monto, comision, neto_tutor, metodo, referencia, estado, creado_en)
            VALUES (?,?,?,?,?,?, 'RETENIDO', ?)`,
    sesionId, monto, com, monto - com, metodo, referencia, ahoraIso());
  registrar(sesionId, 'PAGO_COBRADO', texto ?? `Se cobraron ${pesos(monto)} con ${metodo} (referencia ${referencia}). El dinero queda retenido por la plataforma.`);
}

/** Bajo demanda: la retención se hizo por el valor estimado; al asignarse el tutor se ajusta a su tarifa y se libera la diferencia. */
export function ajustarRetencion(sesionId: number, precio: number, tutorNombre: string) {
  const p = uno('SELECT * FROM pagos WHERE sesion_id = ?', sesionId);
  if (!p || p.monto === precio) return;
  const tasa = p.monto ? p.comision / p.monto : comision();
  const com = Math.round(precio * tasa);
  ejecutar('UPDATE pagos SET monto = ?, comision = ?, neto_tutor = ? WHERE id = ?', precio, com, precio - com, p.id);
  registrar(sesionId, 'PAGO_AJUSTADO', `La retención se ajustó a ${pesos(precio)}, la tarifa de ${tutorNombre}. `
    + `Se liberaron ${pesos(p.monto - precio)} de la diferencia al estudiante.`);
}

/**
 * Devuelve al estudiante el porcentaje indicado. Lo que no se devuelve se reparte entre tutor y plataforma con la
 * comisión con que se cobró. Con 0 % el pago se libera al tutor al cumplirse el periodo de garantía.
 */
export function reembolsar(sesionId: number, porcentaje: number, texto?: string) {
  const p = uno('SELECT * FROM pagos WHERE sesion_id = ?', sesionId);
  if (!p) return 0;
  if (porcentaje >= 100) {
    ejecutar(`UPDATE pagos SET estado = 'REEMBOLSADO', reembolso = monto, comision = 0, neto_tutor = 0, liberar_en = NULL WHERE id = ?`, p.id);
    registrar(sesionId, 'PAGO_REEMBOLSADO', texto ?? `Se devolvieron ${pesos(p.monto)} al estudiante (100 %).`);
    return p.monto as number;
  }
  if (porcentaje > 0) {
    const tasa = p.monto ? p.comision / p.monto : comision();
    const reembolso = Math.round((p.monto * porcentaje) / 100);
    const com = Math.round((p.monto - reembolso) * tasa);
    ejecutar(`UPDATE pagos SET estado = 'REEMBOLSO_PARCIAL', reembolso = ?, comision = ?, neto_tutor = ?, liberar_en = NULL WHERE id = ?`,
      reembolso, com, p.monto - reembolso - com, p.id);
    registrar(sesionId, 'PAGO_REEMBOLSO_PARCIAL',
      `Se devolvieron ${pesos(reembolso)} al estudiante (${porcentaje} %) y ${pesos(p.monto - reembolso - com)} quedan para el tutor.`);
    return reembolso;
  }
  const h = param('GARANTIA_H');
  ejecutar('UPDATE pagos SET liberar_en = ? WHERE id = ?', isoEn(h * HORA), p.id);
  registrar(sesionId, 'SIN_REEMBOLSO', texto ?? `La cancelación no tiene devolución; el pago se liberará al tutor en ${horasTexto(h)}.`);
  return 0;
}

/** RN-06 con los parámetros vigentes: 100 % con más de 24 h, 50 % entre 24 h y 2 h, nada con menos de 2 h. Si cancela el tutor, 100 %. */
export function porcentajeReembolso(s: any, quien: Usuario): number {
  if (quien.id !== s.estudiante_id || s.estado !== 'CONFIRMADA') return 100;
  const faltan = Date.parse(s.inicio) - Date.now();
  return faltan > param('REEMBOLSO_TOTAL_H') * HORA ? 100
    : faltan >= param('REEMBOLSO_PARCIAL_H') * HORA ? param('REEMBOLSO_PARCIAL_PCT') : 0;
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


/** ¿La persona abrió alguna vez el enlace de la sala de clase de esta sesión? */
const entroASala = (sesionId: number, usuarioId: number | null) =>
  !!usuarioId && !!uno(`SELECT 1 AS x FROM eventos WHERE sesion_id = ? AND tipo = 'SALA_ABIERTA' AND actor_id = ?`, sesionId, usuarioId);

/** Tutores que se le sugieren al estudiante cuando su reserva no prosperó (A1 de P-04, A5 de P-06, E3 de P-07). */
function sugerencias(s: any) {
  const aplica = s.estado === 'SIN_TUTOR'
    || (s.estado === 'CANCELADA' && s.tutor_id && s.cancelada_por !== s.estudiante_id)
    || (s.estado === 'NO_REALIZADA' && s.ausente === 'TUTOR');
  if (!aplica) return [];
  return buscarTutores({ materia: s.materia_id })
    .filter((t) => t.id !== s.tutor_id && t.id !== s.estudiante_id).slice(0, 3)
    .map((t) => ({ id: t.id, nombre: t.nombre, tarifaHora: t.tarifaHora, calificacion: t.calificacion, enLinea: t.enLinea }));
}

/** Cómo va la búsqueda bajo demanda: candidato actual, total de candidatos y fin del turno. */
function estadoBusqueda(s: any) {
  const pasaron = uno<{ n: number }>('SELECT COUNT(*) AS n FROM demanda_descartes WHERE sesion_id = ?', s.id)!.n;
  const quedan = candidatosOrdenados(s.materia_id, s.id, s.estudiante_id).length;
  return { candidato: s.turno_tutor_id ? pasaron + 1 : pasaron, total: pasaron + quedan, turnoExpiraEn: s.turno_expira_en };
}

export function vistaSesion(s: any, yo: Usuario) {
  const pago = uno('SELECT * FROM pagos WHERE sesion_id = ?', s.id);
  const califs = todos('SELECT * FROM calificaciones WHERE sesion_id = ?', s.id);
  const mia = califs.find((c) => c.autor_id === yo.id);
  const recibida = califs.find((c) => c.destinatario_id === yo.id && c.publicada);
  const disputa = uno(`SELECT d.*, a.nombre AS asignado_nombre, au.nombre AS autor_nombre, au.rol AS autor_rol
                       FROM disputas d LEFT JOIN usuarios a ON a.id = d.asignado_a JOIN usuarios au ON au.id = d.autor_id
                       WHERE d.sesion_id = ?`, s.id);
  const soyTutor = yo.id === s.tutor_id;
  const soyEstudiante = yo.id === s.estudiante_id;
  const soyParte = soyTutor || soyEstudiante;
  const ahora = Date.now();
  const turnoMio = s.estado === 'BUSCANDO_TUTOR' && s.turno_tutor_id === yo.id && Date.parse(s.turno_expira_en) > ahora;

  const acciones: string[] = [];
  if (s.estado === 'PENDIENTE_ACEPTACION') {
    if (soyTutor) acciones.push('aceptar', 'rechazar');
    if (soyEstudiante) acciones.push('cancelar');
  } else if (s.estado === 'BUSCANDO_TUTOR') {
    if (soyEstudiante) acciones.push('cancelar');
    if (turnoMio) acciones.push('aceptar', 'rechazar');
  } else if (s.estado === 'CONFIRMADA') {
    const inicio = Date.parse(s.inicio);
    if (soyTutor && (MODO_DEMO || ahora >= inicio - 10 * MIN)) acciones.push('iniciar');
    if (soyParte) acciones.push('cancelar');
    // RF-M05-07: una parte propone una fecha nueva y la otra la acepta o la rechaza.
    if (soyParte && s.tipo === 'PROGRAMADA' && ahora < inicio)
      acciones.push(!s.repro_inicio ? 'reprogramar' : s.repro_por !== yo.id ? 'responder-reprogramacion' : 'retirar-reprogramacion');
    // RF-M07-05: pasada la tolerancia, quien sí llegó reporta a la parte que no se conectó.
    if (soyParte && ahora >= inicio + plazo.tolerancia()) {
      const otro = soyTutor ? s.estudiante_id : s.tutor_id;
      if (s.modalidad !== 'VIRTUAL' || !entroASala(s.id, otro)) acciones.push('inasistencia');
    }
  } else if (s.estado === 'EN_CURSO') {
    if (soyParte) acciones.push('finalizar'); // RF-M07-04: cualquiera de las dos partes
  } else if (s.estado === 'FINALIZADA' || s.estado === 'NO_REALIZADA') {
    if (s.estado === 'FINALIZADA' && soyParte && !mia) acciones.push('calificar');
    const cierre = s.finalizada_en ?? s.cerrada_en;
    const enPlazo = !!cierre && ahora - Date.parse(cierre) <= plazo.disputa();
    if (soyParte && !disputa && pago?.estado === 'RETENIDO' && enPlazo) acciones.push('disputa'); // RN-09, cualquiera de las partes
  }
  if (recibida?.comentario && recibida.moderacion === 'VISIBLE') acciones.push('reportar'); // RF-M08-07

  const visible = (c: any) => (['VISIBLE', 'REPORTADA'].includes(c.moderacion) ? c.comentario : null);
  return {
    id: s.id, tipo: s.tipo, estado: s.estado, inicio: s.inicio, duracionMin: s.duracion_min, modalidad: s.modalidad,
    tema: s.tema, precio: s.precio, expiraEn: s.expira_en, iniciadaEn: s.iniciada_en, finalizadaEn: s.finalizada_en,
    creadoEn: s.creado_en, cerradaEn: s.cerrada_en, ausente: s.ausente,
    enlace: ['CONFIRMADA', 'EN_CURSO'].includes(s.estado) ? s.enlace : null,
    materia: { id: s.materia_id, nombre: s.materia_nombre },
    estudiante: { id: s.estudiante_id, nombre: s.estudiante_nombre },
    tutor: s.tutor_id ? { id: s.tutor_id, nombre: s.tutor_nombre } : null,
    turnoExpiraEn: turnoMio ? s.turno_expira_en : null,
    busqueda: s.estado === 'BUSCANDO_TUTOR' && (soyEstudiante || esEquipo(yo)) ? estadoBusqueda(s) : null,
    reprogramacion: s.repro_inicio && s.estado === 'CONFIRMADA' ? {
      inicio: s.repro_inicio, fecha: s.repro_en, mia: s.repro_por === yo.id,
      propuestaPor: s.repro_por === s.tutor_id ? { id: s.tutor_id, nombre: s.tutor_nombre } : { id: s.estudiante_id, nombre: s.estudiante_nombre },
    } : null,
    pago: pago && {
      id: pago.id, monto: pago.monto, comision: pago.comision, netoTutor: pago.neto_tutor, reembolso: pago.reembolso,
      metodo: pago.metodo, referencia: pago.referencia, estado: pago.estado, liberarEn: pago.liberar_en,
    },
    miCalificacion: mia ? { puntaje: mia.puntaje, comentario: mia.comentario, publicada: !!mia.publicada, moderacion: mia.moderacion } : null,
    calificacionRecibida: recibida ? { puntaje: recibida.puntaje, comentario: visible(recibida), moderacion: recibida.moderacion } : null,
    disputa: disputa ? {
      id: disputa.id, motivo: disputa.motivo, estado: disputa.estado, decision: disputa.decision, resolucion: disputa.resolucion,
      creadoEn: disputa.creado_en, resueltaEn: disputa.resuelta_en,
      autor: { id: disputa.autor_id, nombre: disputa.autor_nombre, rol: disputa.autor_rol }, mia: disputa.autor_id === yo.id,
      // Las partes ven quién lleva su caso y la sala de mediación mientras el caso siga abierto.
      asignado: disputa.asignado_nombre ?? null,
      sala: disputa.estado !== 'RESUELTA' ? disputa.sala : null,
      salaCreadaEn: disputa.estado !== 'RESUELTA' ? disputa.sala_creada_en : null,
    } : null,
    sugerencias: soyEstudiante ? sugerencias(s) : [],
    acciones,
    reembolsoSiCancela: acciones.includes('cancelar') && pago ? porcentajeReembolso(s, yo) : null,
  };
}

/* ---------- Tutoría bajo demanda por turnos (P-06) ---------- */

/** Tutores que pueden recibir una solicitud bajo demanda: aprobados, en línea, dictan la materia, no están en sesión y no la pasaron. */
export function tutoresElegibles(materiaId: number, sesionId?: number): number[] {
  return todos<{ id: number }>(`
    SELECT u.id FROM usuarios u JOIN tutores t ON t.usuario_id = u.id
    JOIN tutor_materias tm ON tm.tutor_id = u.id AND tm.materia_id = ?
    WHERE u.estado = 'ACTIVO' AND t.verificacion = 'APROBADO' AND t.en_linea = 1
      AND NOT EXISTS (SELECT 1 FROM sesiones s WHERE s.tutor_id = u.id AND s.estado = 'EN_CURSO')
      AND NOT EXISTS (SELECT 1 FROM demanda_descartes d WHERE d.tutor_id = u.id AND d.sesion_id = ?)`,
    materiaId, sesionId ?? 0).map((f) => f.id);
}

/**
 * RF-M06-03: candidatos en orden de prioridad. Primero la reputación, luego la tasa histórica de aceptación bajo demanda
 * y por último el identificador, para que el orden sea reproducible. La cercanía no pesa porque en el prototipo
 * las solicitudes inmediatas son virtuales.
 */
export function candidatosOrdenados(materiaId: number, sesionId: number, estudianteId: number) {
  const ids = tutoresElegibles(materiaId, sesionId).filter((id) => id !== estudianteId);
  if (!ids.length) return [];
  return todos<{ id: number; nombre: string; tarifa_hora: number; cal: number | null; aceptadas: number; pasadas: number }>(`
    SELECT u.id, u.nombre, t.tarifa_hora,
      (SELECT AVG(c.puntaje) FROM calificaciones c WHERE c.destinatario_id = u.id AND c.publicada = 1 AND c.moderacion <> 'ELIMINADA') AS cal,
      (SELECT COUNT(*) FROM sesiones s WHERE s.tutor_id = u.id AND s.tipo = 'BAJO_DEMANDA') AS aceptadas,
      (SELECT COUNT(*) FROM demanda_descartes d WHERE d.tutor_id = u.id) AS pasadas
    FROM usuarios u JOIN tutores t ON t.usuario_id = u.id WHERE u.id IN (${ids.map(() => '?').join(',')})`, ...ids)
    .map((c) => ({ ...c, tasa: c.aceptadas + c.pasadas ? c.aceptadas / (c.aceptadas + c.pasadas) : 1 }))
    .sort((a, b) => (b.cal ?? 0) - (a.cal ?? 0) || b.tasa - a.tasa || a.id - b.id);
}

/** Cierra la búsqueda sin tutor: libera la retención y ofrece la reserva programada (A5 de P-06). */
export function cerrarSinTutor(s: any, texto: string) {
  ejecutar(`UPDATE sesiones SET estado = 'SIN_TUTOR', expira_en = NULL, turno_tutor_id = NULL, turno_expira_en = NULL WHERE id = ?`, s.id);
  registrar(s.id, 'SIN_TUTOR', texto);
  reembolsar(s.id, 100, 'Se liberó la retención del pago: no se hizo ningún cobro.');
  notificar(s.estudiante_id, 'No encontramos tutor',
    `${texto} No se hizo ningún cobro. Puedes reservar una sesión programada con un tutor de ${s.materia_nombre}.`, s.id);
  if (s.turno_tutor_id) emitir(s.turno_tutor_id, { tipo: 'demanda' });
  avisarSesion(s);
}

/**
 * Ofrece la solicitud al siguiente candidato con su propio turno (RF-M06-05), sin pasar del límite global (RF-M06-06).
 * Si no quedan candidatos, la búsqueda termina de una vez (E2 de P-06).
 */
export function avanzarTurno(s: any) {
  const ahora = Date.now();
  const limite = Date.parse(s.expira_en);
  const anterior = s.turno_tutor_id as number | null;
  if (limite <= ahora) return cerrarSinTutor(s, `Pasaron ${param('BUSQUEDA_DEMANDA_MIN')} minutos y ningún tutor aceptó.`);
  const lista = candidatosOrdenados(s.materia_id, s.id, s.estudiante_id);
  if (!lista.length) return cerrarSinTutor(s, 'Ningún tutor en línea de la materia tomó la solicitud.');
  const c = lista[0];
  const seg = param('TURNO_DEMANDA_S');
  const fin = Math.min(ahora + seg * 1000, limite);
  ejecutar('UPDATE sesiones SET turno_tutor_id = ?, turno_expira_en = ? WHERE id = ?', c.id, new Date(fin).toISOString(), s.id);
  const pasaron = uno<{ n: number }>('SELECT COUNT(*) AS n FROM demanda_descartes WHERE sesion_id = ?', s.id)!.n;
  // Queda en el historial interno: el orden de difusión es auditable (RF-M06-03).
  registrar(s.id, 'TURNO', `Se ofreció la solicitud a ${c.nombre} (candidato ${pasaron + 1} de ${pasaron + lista.length}, turno de ${seg} s).`, null, false);
  notificar(c.id, 'Solicitud inmediata',
    `${s.estudiante_nombre} necesita tutoría de ${s.materia_nombre} ahora. Tienes ${seg} segundos para aceptarla.`, s.id);
  emitir([c.id, ...(anterior && anterior !== c.id ? [anterior] : [])], { tipo: 'demanda' });
  avisarSesion(s);
}

/** El tutor en turno pasó, no respondió o dejó de estar disponible: queda descartado y sigue el siguiente. */
export function pasarTurno(s: any, texto: string, actorId: number | null = null) {
  ejecutar('INSERT OR IGNORE INTO demanda_descartes VALUES (?,?)', s.id, s.turno_tutor_id);
  registrar(s.id, 'TURNO_PASADO', texto, actorId, false);
  avanzarTurno(sesionPorId(s.id));
}

/* ---------- Ejecución de la sesión (P-07) ---------- */

/** Pasa la sesión a EN_CURSO: la inicia el tutor o empieza sola cuando las dos partes entran a la sala. */
export function iniciarSesion(s: any, actor: Usuario | null) {
  const ahora = ahoraIso();
  ejecutar(`UPDATE sesiones SET estado = 'EN_CURSO', iniciada_en = ?, repro_inicio = NULL, repro_por = NULL, repro_en = NULL
            WHERE id = ? AND estado = 'CONFIRMADA'`, ahora, s.id);
  const dif = Math.round((Date.parse(ahora) - Date.parse(s.inicio)) / MIN);
  const quien = actor ? `${actor.nombre} inició la sesión` : 'La sesión empezó sola cuando las dos partes entraron a la sala,';
  registrar(s.id, 'INICIADA', `${quien} a las ${horaCo(ahora)}` + (s.tipo === 'BAJO_DEMANDA' ? ', apenas se asignó el tutor.'
    : dif > 1 ? `, ${duracionTexto(dif)} después de la hora reservada.`
      : dif < -1 ? `, ${duracionTexto(-dif)} antes de la hora reservada${MODO_DEMO ? ' (modo demostración)' : ''}.` : ', a la hora reservada.'),
    actor?.id ?? null);
  for (const id of [s.estudiante_id, s.tutor_id].filter((id) => id !== actor?.id))
    notificar(id, 'Tu sesión comenzó', `La sesión de ${s.materia_nombre} está en curso.`, s.id);
  avisarSesion(s);
}

export function finalizarSesion(s: any, actor: Usuario | null) {
  const ahora = ahoraIso();
  ejecutar(`UPDATE sesiones SET estado = 'FINALIZADA', finalizada_en = ? WHERE id = ?`, ahora, s.id);
  const real = (Date.parse(ahora) - Date.parse(s.iniciada_en)) / MIN;
  registrar(s.id, actor ? 'FINALIZADA' : 'CIERRE_AUTOMATICO', actor
    ? `${actor.nombre} finalizó la sesión a las ${horaCo(ahora)}, con una duración real de ${duracionTexto(real)} de ${duracionTexto(s.duracion_min)} reservada.`
    : `La sesión seguía abierta después de lo pactado y se cerró automáticamente a las ${horaCo(ahora)}, con ${duracionTexto(real)} registrados.`,
    actor?.id ?? null);
  const h = param('GARANTIA_H');
  ejecutar('UPDATE pagos SET liberar_en = ? WHERE sesion_id = ?', isoEn(h * HORA), s.id);
  notificar(s.estudiante_id, 'Sesión finalizada', `Califica tu sesión de ${s.materia_nombre} con ${s.tutor_nombre}.`, s.id);
  notificar(s.tutor_id, 'Sesión finalizada', `El pago se libera en ${horasTexto(h)} si no hay reclamos. Califica al estudiante.`, s.id);
  avisarSesion(s);
}

/** RF-M07-05 (E2 y E3 de P-07): una parte reporta que la otra no se conectó dentro de la tolerancia. */
export function reportarInasistencia(s: any, yo: Usuario) {
  const faltoTutor = yo.id === s.estudiante_id;
  const otroNombre = faltoTutor ? s.tutor_nombre : s.estudiante_nombre;
  ejecutar(`UPDATE sesiones SET estado = 'NO_REALIZADA', ausente = ?, cerrada_en = ?, repro_inicio = NULL, repro_por = NULL, repro_en = NULL
            WHERE id = ?`, faltoTutor ? 'TUTOR' : 'ESTUDIANTE', ahoraIso(), s.id);
  registrar(s.id, 'INASISTENCIA',
    `${yo.nombre} reportó que ${otroNombre} no se conectó en los ${param('TOLERANCIA_MIN')} minutos de tolerancia.`, yo.id);
  if (faltoTutor) {
    reembolsar(s.id, 100);
    notificar(s.tutor_id, 'Inasistencia reportada', `${yo.nombre} reportó que no te conectaste a la sesión de ${s.materia_nombre}. Se le devolvió el pago.`, s.id);
    notificar(s.estudiante_id, 'Sesión no realizada', 'Te devolvimos el pago completo. Te sugerimos otros tutores de la materia.', s.id);
  } else {
    reembolsar(s.id, 0, `Como el estudiante no se conectó, el pago se liberará al tutor en ${horasTexto(param('GARANTIA_H'))} salvo que se abra una disputa.`);
    notificar(s.estudiante_id, 'Inasistencia reportada',
      `${yo.nombre} reportó que no te conectaste a la sesión de ${s.materia_nombre}. Si no es así, abre una disputa en las próximas ${horasTexto(param('PLAZO_DISPUTA_H'))}.`, s.id);
  }
  avisarSesion(s);
}

/* ---------- Calificaciones (P-08) ---------- */

const OFENSIVAS = ['idiota', 'estupido', 'estupida', 'imbecil', 'hijueputa', 'malparido', 'malparida', 'gonorrea', 'mierda', 'puta',
  'pendejo', 'pendeja', 'careverga', 'huevon', 'guevon', 'marica', 'perra'];

/** Filtro automático de comentarios (E2 de P-08): devuelve el motivo si el comentario debe retenerse. */
export function revisarComentario(texto: string): string | null {
  const plano = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/.test(plano)) return 'El filtro automático encontró datos personales (un correo).';
  if (/(\d[\s.-]?){7,}/.test(plano)) return 'El filtro automático encontró datos personales (un número de teléfono).';
  if (OFENSIVAS.some((p) => new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(plano))) return 'El filtro automático encontró lenguaje ofensivo.';
  return null;
}

/** RF-M08-08 (A5 de P-08): alerta al administrador cuando el promedio de un tutor baja del umbral. No oculta el perfil. */
export function revisarReputacion(usuarioId: number) {
  const t = uno<{ alerta: string | null; nombre: string }>(
    'SELECT t.alerta_reputacion_en AS alerta, u.nombre FROM tutores t JOIN usuarios u ON u.id = t.usuario_id WHERE t.usuario_id = ?', usuarioId);
  if (!t) return;
  const r = uno<{ prom: number | null; n: number }>(`SELECT AVG(puntaje) AS prom, COUNT(*) AS n FROM calificaciones
    WHERE destinatario_id = ? AND publicada = 1 AND moderacion <> 'ELIMINADA'`, usuarioId)!;
  const umbral = param('UMBRAL_REPUTACION');
  const bajo = r.n >= param('MIN_VALORACIONES') && (r.prom ?? 5) < umbral;
  if (bajo && !t.alerta) {
    ejecutar('UPDATE tutores SET alerta_reputacion_en = ? WHERE usuario_id = ?', ahoraIso(), usuarioId);
    for (const a of idsDeRol('ADMIN'))
      notificar(a, 'Alerta de reputación',
        `${t.nombre} tiene ${numero(r.prom ?? 0)} estrellas con ${r.n} valoraciones, por debajo del umbral de ${numero(umbral)}.`, null, '/moderacion');
  } else if (!bajo && t.alerta) ejecutar('UPDATE tutores SET alerta_reputacion_en = NULL WHERE usuario_id = ?', usuarioId);
}
