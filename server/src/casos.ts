/* Casos de soporte (disputas), adjuntos y consulta de sesiones para el equipo de soporte y administración (P-11). */

import express, { type Request, type Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tx, uno, todos, ejecutar, CARPETA_ADJUNTOS } from './db.js';
import {
  ErrorHttp, texto, entero, opcion, soloRol, emitir, notificar, avisarSesion, registrar, eventosDe, idsDeRol, esEquipo,
  usuarioDeToken, sesionPorId, sesionesDonde, vistaSesion, reembolsar, ahoraIso, MIN, auditar, type Usuario,
} from './nucleo.js';
import { pesos } from './formato.js';

type Canal = 'ESTUDIANTE' | 'TUTOR' | 'INTERNO';
const ROL_TEXTO: Record<string, string> = { SOPORTE: 'soporte', ADMIN: 'administrador', ESTUDIANTE: 'estudiante', TUTOR: 'tutor' };
const DECISION_TEXTO: Record<string, string> = {
  REEMBOLSO_TOTAL: 'reembolso total al estudiante',
  REEMBOLSO_PARCIAL: 'reembolso del 50 % al estudiante y 50 % para el tutor',
  LIBERAR: 'pago completo al tutor',
};

/* ---------- Adjuntos ---------- */

const TIPOS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf',
};
const MAX_BYTES = 5 * 1024 * 1024;

/** Revisa la firma de los primeros bytes para no aceptar un archivo con un tipo falso. */
function firmaValida(tipo: string, b: Buffer) {
  if (tipo === 'application/pdf') return b.subarray(0, 4).toString('latin1') === '%PDF';
  if (tipo === 'image/png') return b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG';
  if (tipo === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8;
  if (tipo === 'image/webp') return b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
  return b.subarray(4, 8).toString('latin1') === 'ftyp'; // HEIC
}

const vistaAdjunto = (a: any) => (a ? { id: a.id, nombre: a.nombre, tipo: a.tipo, tamano: a.tamano } : null);

/** Descarga de adjuntos. Va antes de la autenticación general porque también acepta el token en la URL (para <img src>). */
export function montarDescargas(api: Router) {
  api.get('/adjuntos/:id', (req, res) => {
    const cab = req.headers.authorization ?? '';
    const yo = usuarioDeToken(cab.startsWith('Bearer ') ? cab.slice(7) : String(req.query.t ?? ''));
    if (!yo) throw new ErrorHttp(401, 'Inicia sesión para ver este archivo.');
    const a = uno('SELECT * FROM adjuntos WHERE id = ?', entero(req.params.id, 'El archivo'));
    if (!a) throw new ErrorHttp(404, 'El archivo no existe.');
    const m = uno(`SELECT m.canal, s.estudiante_id, s.tutor_id FROM disputa_mensajes m JOIN disputas d ON d.id = m.disputa_id
                   JOIN sesiones s ON s.id = d.sesion_id WHERE m.adjunto_id = ?`, a.id);
    const permitido = a.subido_por === yo.id || esEquipo(yo)
      || (m?.canal === 'ESTUDIANTE' && m.estudiante_id === yo.id) || (m?.canal === 'TUTOR' && m.tutor_id === yo.id);
    if (!permitido) throw new ErrorHttp(403, 'No tienes acceso a este archivo.');
    res.setHeader('Content-Type', a.tipo);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(a.nombre)}`);
    res.sendFile(path.join(CARPETA_ADJUNTOS, a.archivo));
  });
}

/* ---------- Utilidades de los casos ---------- */

export function emitirCaso(disputaId: number) {
  const d = uno(`SELECT d.id, d.sesion_id, s.estudiante_id, s.tutor_id FROM disputas d JOIN sesiones s ON s.id = d.sesion_id
                 WHERE d.id = ?`, disputaId);
  if (!d) return;
  emitir([d.estudiante_id, d.tutor_id, ...idsDeRol('SOPORTE', 'ADMIN')], { tipo: 'disputa', disputaId: d.id, sesionId: d.sesion_id });
}

function disputaPorId(id: number) {
  const d = uno('SELECT * FROM disputas WHERE id = ?', id);
  if (!d) throw new ErrorHttp(404, 'El caso no existe.');
  return d;
}

function mensajes(disputaId: number, canales: Canal[], yo: Usuario) {
  return todos(`
    SELECT m.id, m.canal, m.texto, m.creado_en, m.autor_id, u.nombre AS autor_nombre, u.rol AS autor_rol,
           a.id AS a_id, a.nombre AS a_nombre, a.tipo AS a_tipo, a.tamano AS a_tamano
    FROM disputa_mensajes m JOIN usuarios u ON u.id = m.autor_id LEFT JOIN adjuntos a ON a.id = m.adjunto_id
    WHERE m.disputa_id = ? AND m.canal IN (${canales.map(() => '?').join(',')}) ORDER BY m.creado_en, m.id`, disputaId, ...canales)
    .map((m) => ({
      id: m.id, canal: m.canal, texto: m.texto, fecha: m.creado_en, mio: m.autor_id === yo.id,
      autor: { id: m.autor_id, nombre: m.autor_nombre, rol: m.autor_rol },
      adjunto: m.a_id ? { id: m.a_id, nombre: m.a_nombre, tipo: m.a_tipo, tamano: m.a_tamano } : null,
    }));
}

/** Guarda un mensaje (con o sin archivo) y devuelve el nombre del archivo si lo hay. */
function guardarMensaje(d: any, canal: Canal, yo: Usuario, cuerpo: any) {
  const textoMsg = String(cuerpo.texto ?? '').trim().slice(0, 2000);
  let adjunto: any = null;
  if (cuerpo.adjuntoId !== undefined && cuerpo.adjuntoId !== null) {
    adjunto = uno('SELECT * FROM adjuntos WHERE id = ?', entero(cuerpo.adjuntoId, 'El archivo'));
    if (!adjunto || adjunto.subido_por !== yo.id) throw new ErrorHttp(400, 'El archivo no es válido.');
    if (uno('SELECT 1 AS x FROM disputa_mensajes WHERE adjunto_id = ?', adjunto.id)) throw new ErrorHttp(409, 'Ese archivo ya se envió.');
  }
  if (!textoMsg && !adjunto) throw new ErrorHttp(400, 'Escribe un mensaje o adjunta un archivo.');
  ejecutar('INSERT INTO disputa_mensajes (disputa_id, canal, autor_id, texto, adjunto_id, creado_en) VALUES (?,?,?,?,?,?)',
    d.id, canal, yo.id, textoMsg, adjunto?.id ?? null, ahoraIso());
  return adjunto?.nombre as string | undefined;
}

const nombreConRol = (u: Usuario) => `${u.nombre} (${ROL_TEXTO[u.rol]})`;

/* ---------- Vistas para el equipo ---------- */

function vistaCaso(d: any) {
  const f = uno(`
    SELECT s.id AS sesion_id, m.nombre AS materia, p.monto, p.estado AS estado_pago, e.id AS e_id, e.nombre AS e_nombre,
           t.id AS t_id, t.nombre AS t_nombre, a.id AS a_id, a.nombre AS a_nombre, a.rol AS a_rol,
           ep.nombre AS esc_nombre, rp.nombre AS res_nombre, rp.rol AS res_rol,
           (SELECT MAX(creado_en) FROM disputa_mensajes WHERE disputa_id = ?) AS ultimo_mensaje,
           (SELECT COUNT(*) FROM disputa_mensajes WHERE disputa_id = ? AND canal = 'TUTOR' AND autor_id = s.tutor_id) AS descargos
    FROM sesiones s JOIN materias m ON m.id = s.materia_id JOIN usuarios e ON e.id = s.estudiante_id
    JOIN usuarios t ON t.id = s.tutor_id LEFT JOIN pagos p ON p.sesion_id = s.id
    LEFT JOIN usuarios a ON a.id = ? LEFT JOIN usuarios ep ON ep.id = ? LEFT JOIN usuarios rp ON rp.id = ?
    WHERE s.id = ?`, d.id, d.id, d.asignado_a, d.escalada_por, d.resuelta_por, d.sesion_id);
  return {
    id: d.id, estado: d.estado, motivo: d.motivo, creadoEn: d.creado_en,
    sesionId: f.sesion_id, materia: f.materia, monto: f.monto, estadoPago: f.estado_pago,
    estudiante: { id: f.e_id, nombre: f.e_nombre }, tutor: { id: f.t_id, nombre: f.t_nombre },
    asignado: f.a_id ? { id: f.a_id, nombre: f.a_nombre, rol: f.a_rol } : null,
    escalada: d.escalada_en ? { por: f.esc_nombre, motivo: d.escalada_motivo, fecha: d.escalada_en } : null,
    sala: d.sala, salaCreadaEn: d.sala_creada_en,
    decision: d.decision, resolucion: d.resolucion, resueltaEn: d.resuelta_en,
    resueltaPor: f.res_nombre ? { nombre: f.res_nombre, rol: f.res_rol } : null,
    tutorRespondio: f.descargos > 0,
    ultimaActividad: [d.creado_en, f.ultimo_mensaje, d.escalada_en, d.resuelta_en].filter(Boolean).sort().pop(),
  };
}

function vistaSesionEquipo(s: any, yo: Usuario) {
  const base = vistaSesion(s, yo);
  const correos = todos<{ id: number; email: string }>('SELECT id, email FROM usuarios WHERE id IN (?, ?)', s.estudiante_id, s.tutor_id ?? 0);
  const correo = (id: number | null) => correos.find((c) => c.id === id)?.email ?? null;
  const califs = todos(`SELECT c.puntaje, c.comentario, c.publicada, c.creado_en, u.nombre AS autor, c.autor_id
                        FROM calificaciones c JOIN usuarios u ON u.id = c.autor_id WHERE c.sesion_id = ?`, s.id);
  const disputa = uno('SELECT id, estado FROM disputas WHERE sesion_id = ?', s.id);
  const cancelo = s.cancelada_por ? uno<{ nombre: string }>('SELECT nombre FROM usuarios WHERE id = ?', s.cancelada_por)?.nombre : null;
  const inicioProg = s.inicio ? Date.parse(s.inicio) : null;
  return {
    ...base,
    enlace: s.enlace,
    estudiante: { ...base.estudiante, email: correo(s.estudiante_id) },
    tutor: base.tutor ? { ...base.tutor, email: correo(s.tutor_id) } : null,
    canceladaPor: cancelo,
    tiempos: {
      programadoInicio: s.inicio,
      programadoFin: inicioProg ? new Date(inicioProg + s.duracion_min * MIN).toISOString() : null,
      realInicio: s.iniciada_en,
      realFin: s.finalizada_en,
      minutosReales: s.iniciada_en && s.finalizada_en ? Math.round((Date.parse(s.finalizada_en) - Date.parse(s.iniciada_en)) / MIN) : null,
      retrasoMin: s.iniciada_en && inicioProg && s.tipo === 'PROGRAMADA' ? Math.round((Date.parse(s.iniciada_en) - inicioProg) / MIN) : null,
    },
    calificaciones: califs.map((c) => ({
      autor: c.autor, deEstudiante: c.autor_id === s.estudiante_id, puntaje: c.puntaje, comentario: c.comentario,
      publicada: !!c.publicada, fecha: c.creado_en,
    })),
    disputaId: disputa?.id ?? null,
    estadoDisputa: disputa?.estado ?? null,
    eventos: eventosDe(s.id, true),
  };
}

/* ---------- Rutas ---------- */

export function montarCasos(api: Router) {
  /* Subida de archivos (pruebas de un caso). */
  api.post('/adjuntos', (req, res) => {
    const nombre = texto(req.body.nombre, 'El nombre del archivo', 1, 120).replace(/[\\/\r\n]/g, '_');
    const tipo = opcion(req.body.tipo, 'El tipo de archivo', Object.keys(TIPOS));
    const datos = Buffer.from(String(req.body.datos ?? ''), 'base64');
    if (!datos.length) throw new ErrorHttp(400, 'El archivo está vacío.');
    if (datos.length > MAX_BYTES) throw new ErrorHttp(413, 'El archivo supera los 5 MB.');
    if (!firmaValida(tipo, datos)) throw new ErrorHttp(400, 'El contenido del archivo no corresponde a su tipo.');
    const archivo = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${TIPOS[tipo]}`;
    fs.writeFileSync(path.join(CARPETA_ADJUNTOS, archivo), datos);
    const id = Number(ejecutar('INSERT INTO adjuntos (nombre, tipo, tamano, archivo, subido_por, creado_en) VALUES (?,?,?,?,?,?)',
      nombre, tipo, datos.length, archivo, req.yo.id, ahoraIso()).lastInsertRowid);
    res.status(201).json(vistaAdjunto(uno('SELECT * FROM adjuntos WHERE id = ?', id)));
  });

  /* Estudiante y tutor: cada uno conversa con soporte por su propio canal. */
  function casoDeParte(req: Request) {
    const s = sesionPorId(entero(req.params.id, 'La sesión'));
    const canal: Canal | null = req.yo.id === s.estudiante_id ? 'ESTUDIANTE' : req.yo.id === s.tutor_id ? 'TUTOR' : null;
    if (!canal) throw new ErrorHttp(403, 'No participas en esta sesión.');
    const d = uno('SELECT * FROM disputas WHERE sesion_id = ?', s.id);
    if (!d) throw new ErrorHttp(404, 'Esta sesión no tiene un caso abierto.');
    return { s, d, canal };
  }

  api.get('/sesiones/:id/disputa/mensajes', (req, res) => {
    const { d, canal } = casoDeParte(req);
    res.json(mensajes(d.id, [canal], req.yo));
  });

  api.post('/sesiones/:id/disputa/mensajes', (req, res) => {
    const { s, d, canal } = casoDeParte(req);
    if (d.estado === 'RESUELTA') throw new ErrorHttp(409, 'El caso ya se resolvió.');
    tx(() => {
      const primero = canal === 'TUTOR' && !uno('SELECT 1 AS x FROM disputa_mensajes WHERE disputa_id = ? AND autor_id = ?', d.id, req.yo.id);
      const archivo = guardarMensaje(d, canal, req.yo, req.body);
      if (primero) registrar(s.id, 'DESCARGO', `${req.yo.nombre} presentó su versión del caso.`, req.yo.id);
      if (archivo) registrar(s.id, 'PRUEBA_ADJUNTA', `${req.yo.nombre} adjuntó una prueba: ${archivo}.`, req.yo.id);
      const destino = d.asignado_a ? [d.asignado_a] : idsDeRol('SOPORTE', 'ADMIN');
      for (const id of destino)
        notificar(id, `Respuesta en el caso #${d.id}`, `${req.yo.nombre} (${ROL_TEXTO[req.yo.rol]}) escribió${archivo ? ' y adjuntó un archivo' : ''}.`,
          s.id, `/casos/${d.id}`);
    });
    emitirCaso(d.id);
    res.status(201).json(mensajes(d.id, [canal], req.yo));
  });

  /* Equipo de soporte y administración. */
  const g = express.Router();
  api.use('/gestion', soloRol('SOPORTE', 'ADMIN'), g);

  g.get('/disputas', (_req, res) => {
    res.json(todos('SELECT * FROM disputas ORDER BY id DESC LIMIT 300').map(vistaCaso));
  });

  g.get('/disputas/:id', (req, res) => {
    const d = disputaPorId(entero(req.params.id, 'El caso'));
    const caso = vistaCaso(d);
    const abierto = d.estado !== 'RESUELTA';
    res.json({
      ...caso,
      sesion: vistaSesionEquipo(sesionPorId(d.sesion_id), req.yo),
      mensajes: mensajes(d.id, ['ESTUDIANTE', 'TUTOR', 'INTERNO'], req.yo),
      permisos: {
        tomar: abierto && caso.asignado?.id !== req.yo.id && (d.estado !== 'ESCALADA' || req.yo.rol === 'ADMIN'),
        escalar: abierto && d.estado !== 'ESCALADA' && req.yo.rol === 'SOPORTE',
        resolver: abierto && (d.estado !== 'ESCALADA' || req.yo.rol === 'ADMIN'),
        escribir: abierto,
      },
    });
  });

  g.post('/disputas/:id/tomar', (req, res) => {
    const d = disputaPorId(entero(req.params.id, 'El caso'));
    if (d.estado === 'RESUELTA') throw new ErrorHttp(409, 'El caso ya se resolvió.');
    if (d.estado === 'ESCALADA' && req.yo.rol !== 'ADMIN') throw new ErrorHttp(403, 'Este caso está escalado: lo atiende un administrador.');
    const s = sesionPorId(d.sesion_id);
    tx(() => {
      ejecutar(`UPDATE disputas SET asignado_a = ?, estado = CASE WHEN estado = 'ABIERTA' THEN 'EN_REVISION' ELSE estado END WHERE id = ?`,
        req.yo.id, d.id);
      registrar(s.id, 'CASO_TOMADO', `${nombreConRol(req.yo)} tomó el caso.`, req.yo.id);
      for (const id of [s.estudiante_id, s.tutor_id])
        notificar(id, 'Tu caso está en revisión', `${req.yo.nombre}, del equipo de ${ROL_TEXTO[req.yo.rol]}, está revisando el caso de la sesión de ${s.materia_nombre}.`, s.id);
      if (d.asignado_a && d.asignado_a !== req.yo.id)
        notificar(d.asignado_a, `Caso #${d.id} reasignado`, `${req.yo.nombre} tomó el caso.`, s.id, `/casos/${d.id}`);
    });
    emitirCaso(d.id);
    res.json({ ok: true });
  });

  g.post('/disputas/:id/mensajes', (req, res) => {
    const d = disputaPorId(entero(req.params.id, 'El caso'));
    if (d.estado === 'RESUELTA') throw new ErrorHttp(409, 'El caso ya se resolvió.');
    const canal = opcion(req.body.canal, 'La conversación', ['ESTUDIANTE', 'TUTOR', 'INTERNO'] as const);
    const s = sesionPorId(d.sesion_id);
    tx(() => {
      const archivo = guardarMensaje(d, canal, req.yo, req.body);
      if (!d.asignado_a) {
        ejecutar(`UPDATE disputas SET asignado_a = ?, estado = CASE WHEN estado = 'ABIERTA' THEN 'EN_REVISION' ELSE estado END WHERE id = ?`,
          req.yo.id, d.id);
        registrar(s.id, 'CASO_TOMADO', `${nombreConRol(req.yo)} tomó el caso.`, req.yo.id);
      }
      if (canal === 'INTERNO') {
        const otros = [d.asignado_a, ...(d.estado === 'ESCALADA' ? idsDeRol('ADMIN') : [])].filter((id) => id && id !== req.yo.id);
        for (const id of new Set(otros)) notificar(id, `Nota interna en el caso #${d.id}`, `${req.yo.nombre}: ${String(req.body.texto ?? archivo ?? '').slice(0, 90)}`, s.id, `/casos/${d.id}`);
      } else {
        const destino = canal === 'ESTUDIANTE' ? s.estudiante_id : s.tutor_id;
        notificar(destino, 'Mensaje de soporte', `${req.yo.nombre} te escribió sobre el caso de la sesión de ${s.materia_nombre}.`, s.id);
        if (archivo) registrar(s.id, 'PRUEBA_ADJUNTA', `${nombreConRol(req.yo)} envió un archivo al ${canal === 'ESTUDIANTE' ? 'estudiante' : 'tutor'}: ${archivo}.`, req.yo.id, false);
      }
    });
    emitirCaso(d.id);
    res.status(201).json(mensajes(d.id, ['ESTUDIANTE', 'TUTOR', 'INTERNO'], req.yo));
  });

  /** Sala de videollamada para estudiante, tutor y soporte. */
  g.post('/disputas/:id/sala', (req, res) => {
    const d = disputaPorId(entero(req.params.id, 'El caso'));
    if (d.estado === 'RESUELTA') throw new ErrorHttp(409, 'El caso ya se resolvió.');
    const s = sesionPorId(d.sesion_id);
    const sala = `https://meet.jit.si/TutoresOnLine-caso-${d.id}-${crypto.randomBytes(5).toString('hex')}`;
    const cuando = req.body.cuando ? String(req.body.cuando).trim().slice(0, 80) || null : null;
    tx(() => {
      ejecutar('UPDATE disputas SET sala = ?, sala_creada_en = ? WHERE id = ?', sala, ahoraIso(), d.id);
      registrar(s.id, 'SALA_MEDIACION_CREADA',
        `${nombreConRol(req.yo)} abrió una sala de mediación con el estudiante y el tutor${cuando ? ` (${cuando})` : ''}.`, req.yo.id);
      for (const id of [s.estudiante_id, s.tutor_id])
        notificar(id, 'Videollamada de mediación', `Soporte te invita a una videollamada con la otra parte${cuando ? ` (${cuando})` : ''}. Entra desde la sesión de ${s.materia_nombre}.`, s.id);
    });
    emitirCaso(d.id);
    res.json({ sala });
  });

  g.post('/disputas/:id/escalar', soloRol('SOPORTE'), (req, res) => {
    const d = disputaPorId(entero(req.params.id, 'El caso'));
    if (d.estado === 'RESUELTA') throw new ErrorHttp(409, 'El caso ya se resolvió.');
    if (d.estado === 'ESCALADA') throw new ErrorHttp(409, 'El caso ya está escalado.');
    const motivo = texto(req.body.motivo, 'El motivo del escalamiento', 10, 400);
    const s = sesionPorId(d.sesion_id);
    tx(() => {
      ejecutar(`UPDATE disputas SET estado = 'ESCALADA', escalada_por = ?, escalada_motivo = ?, escalada_en = ?,
                asignado_a = COALESCE(asignado_a, ?) WHERE id = ?`, req.yo.id, motivo, ahoraIso(), req.yo.id, d.id);
      ejecutar('INSERT INTO disputa_mensajes (disputa_id, canal, autor_id, texto, creado_en) VALUES (?,?,?,?,?)',
        d.id, 'INTERNO', req.yo.id, `Escalé el caso a administración. Motivo: ${motivo}`, ahoraIso());
      registrar(s.id, 'CASO_ESCALADO', `${nombreConRol(req.yo)} escaló el caso a administración: ${motivo}`, req.yo.id, false);
      for (const id of idsDeRol('ADMIN'))
        notificar(id, `Caso #${d.id} escalado`, `${req.yo.nombre}: ${motivo.slice(0, 100)}`, s.id, `/casos/${d.id}`);
    });
    emitirCaso(d.id);
    res.json({ ok: true });
  });

  g.post('/disputas/:id/resolver', (req, res) => {
    const d = disputaPorId(entero(req.params.id, 'El caso'));
    if (d.estado === 'RESUELTA') throw new ErrorHttp(409, 'El caso ya se resolvió.');
    if (d.estado === 'ESCALADA' && req.yo.rol !== 'ADMIN') throw new ErrorHttp(403, 'Este caso está escalado: lo resuelve un administrador.');
    const decision = opcion(req.body.decision, 'La decisión', ['REEMBOLSO_TOTAL', 'REEMBOLSO_PARCIAL', 'LIBERAR'] as const);
    const resolucion = texto(req.body.resolucion, 'La explicación para las partes', 10, 600);
    const s = sesionPorId(d.sesion_id);
    tx(() => {
      ejecutar(`UPDATE disputas SET estado = 'RESUELTA', decision = ?, resolucion = ?, resuelta_por = ?, resuelta_en = ?,
                asignado_a = COALESCE(asignado_a, ?) WHERE id = ?`, decision, resolucion, req.yo.id, ahoraIso(), req.yo.id, d.id);
      if (decision === 'REEMBOLSO_TOTAL') reembolsar(s.id, 100);
      else if (decision === 'REEMBOLSO_PARCIAL') reembolsar(s.id, 50);
      else {
        const p = uno('SELECT neto_tutor FROM pagos WHERE sesion_id = ?', s.id);
        ejecutar(`UPDATE pagos SET estado = 'LIBERADO' WHERE sesion_id = ?`, s.id);
        registrar(s.id, 'PAGO_LIBERADO', `Se liberaron ${pesos(p?.neto_tutor ?? 0)} al tutor por decisión del caso.`);
      }
      registrar(s.id, 'CASO_RESUELTO', `${nombreConRol(req.yo)} resolvió el caso: ${DECISION_TEXTO[decision]}. ${resolucion}`, req.yo.id);
      if (req.yo.rol === 'ADMIN')
        auditar(req.yo.id, 'CASO_RESUELTO', `Resolvió el caso #${d.id}${d.estado === 'ESCALADA' ? ' (escalado)' : ''}: ${DECISION_TEXTO[decision]}.`);
      for (const id of [s.estudiante_id, s.tutor_id])
        notificar(id, 'Caso resuelto', `Decisión: ${DECISION_TEXTO[decision]}. ${resolucion}`, s.id);
      if (d.asignado_a && d.asignado_a !== req.yo.id)
        notificar(d.asignado_a, `Caso #${d.id} resuelto`, `${req.yo.nombre} resolvió el caso: ${DECISION_TEXTO[decision]}.`, s.id, `/casos/${d.id}`);
    });
    emitirCaso(d.id);
    avisarSesion(s);
    res.json({ ok: true });
  });

  g.get('/sesiones', (req, res) => {
    const cond = ['1 = 1'];
    const p: any[] = [];
    if (typeof req.query.estado === 'string' && req.query.estado) { cond.push('s.estado = ?'); p.push(req.query.estado); }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      cond.push('(CAST(s.id AS TEXT) = ? OR e.nombre LIKE ? OR t.nombre LIKE ? OR m.nombre LIKE ?)');
      p.push(q.replace(/^#/, ''), `%${q}%`, `%${q}%`, `%${q}%`);
    }
    res.json(sesionesDonde(cond.join(' AND '), ...p).map((s) => {
      const v = vistaSesion(s, req.yo);
      const d = uno('SELECT id, estado FROM disputas WHERE sesion_id = ?', s.id);
      return { ...v, disputaId: d?.id ?? null, estadoDisputa: d?.estado ?? null };
    }));
  });

  g.get('/sesiones/:id', (req, res) => {
    res.json(vistaSesionEquipo(sesionPorId(entero(req.params.id, 'La sesión')), req.yo));
  });
}

