import { tx, todos, ejecutar } from './db.js';
import {
  ahoraIso, MIN, HORA, notificar, avisarSesion, emitir, reembolsar, finalizarSesion, sesionesDonde, tutoresElegibles, registrar,
} from './nucleo.js';
import { horaCo, pesos } from './formato.js';

/** Revisa los plazos del sistema. Corre cada dos segundos para que una solicitud bajo demanda no quede colgada (RNF-02). */
export function revisarPlazos() {
  const ahora = ahoraIso();
  const t = Date.now();

  tx(() => {
    // RN-05: nadie aceptó en 45 s.
    for (const s of sesionesDonde(`s.estado = 'BUSCANDO_TUTOR' AND s.expira_en <= ?`, ahora)) {
      ejecutar(`UPDATE sesiones SET estado = 'SIN_TUTOR', expira_en = NULL WHERE id = ?`, s.id);
      registrar(s.id, 'SIN_TUTOR', 'Pasaron 45 segundos y ningún tutor aceptó. No se hizo ningún cobro.');
      notificar(s.estudiante_id, 'No encontramos tutor',
        `Ningún tutor de ${s.materia_nombre} aceptó a tiempo. No se hizo ningún cobro. Puedes reservar una sesión programada.`, s.id);
      avisarSesion(s);
      emitir(tutoresElegibles(s.materia_id), { tipo: 'demanda' });
    }

    // RN-05: el tutor no respondió la reserva en 12 h. Se devuelve todo.
    for (const s of sesionesDonde(`s.estado = 'PENDIENTE_ACEPTACION' AND s.expira_en <= ?`, ahora)) {
      ejecutar(`UPDATE sesiones SET estado = 'CANCELADA', expira_en = NULL WHERE id = ?`, s.id);
      registrar(s.id, 'VENCIDA', `${s.tutor_nombre} no respondió la reserva a tiempo. Se canceló automáticamente.`);
      reembolsar(s.id, 100);
      notificar(s.estudiante_id, 'Reserva vencida', `${s.tutor_nombre} no respondió a tiempo. Te devolvimos el pago completo.`, s.id);
      notificar(s.tutor_id, 'Reserva vencida', `La solicitud de ${s.estudiante_nombre} venció sin respuesta.`, s.id);
      avisarSesion(s);
    }

    // Recordatorio una hora antes de cada sesión confirmada. El evento RECORDATORIO evita repetirlo.
    for (const s of sesionesDonde(`s.estado = 'CONFIRMADA' AND s.inicio > ? AND s.inicio <= ?
                                   AND NOT EXISTS (SELECT 1 FROM eventos e WHERE e.sesion_id = s.id AND e.tipo = 'RECORDATORIO')`,
                                   ahora, new Date(t + HORA).toISOString())) {
      const hora = horaCo(s.inicio);
      registrar(s.id, 'RECORDATORIO', `Se recordó la sesión a las dos partes: empieza a las ${hora}.`);
      notificar(s.estudiante_id, 'Tu sesión empieza pronto', `Tu sesión de ${s.materia_nombre} con ${s.tutor_nombre} empieza a las ${hora}.`, s.id);
      notificar(s.tutor_id, 'Tu sesión empieza pronto', `Tu sesión de ${s.materia_nombre} con ${s.estudiante_nombre} empieza a las ${hora}.`, s.id);
      avisarSesion(s);
    }

    // Sesión confirmada que nunca se inició: 15 min de gracia después de la hora de fin.
    for (const s of sesionesDonde(`s.estado = 'CONFIRMADA'`)) {
      if (Date.parse(s.inicio) + (s.duracion_min + 15) * MIN > t) continue;
      ejecutar(`UPDATE sesiones SET estado = 'NO_REALIZADA' WHERE id = ?`, s.id);
      registrar(s.id, 'NO_REALIZADA', 'La sesión no se inició dentro del horario reservado (15 minutos de tolerancia).');
      reembolsar(s.id, 100);
      notificar(s.estudiante_id, 'Sesión no realizada', 'La sesión no se inició. Te devolvimos el pago completo.', s.id);
      notificar(s.tutor_id, 'Sesión no realizada', 'La sesión no se inició dentro del horario reservado.', s.id);
      avisarSesion(s);
    }

    // Sesión que quedó abierta: se cierra sola una hora después de la duración pactada.
    for (const s of sesionesDonde(`s.estado = 'EN_CURSO'`))
      if (Date.parse(s.iniciada_en) + s.duracion_min * MIN + HORA <= t) finalizarSesion(s, true);

    // RN-02: pasadas 48 h sin disputa, el pago queda disponible para el tutor.
    for (const p of todos(`SELECT p.id, p.neto_tutor, s.id AS sesion_id, s.tutor_id FROM pagos p JOIN sesiones s ON s.id = p.sesion_id
                           WHERE p.estado = 'RETENIDO' AND p.liberar_en IS NOT NULL AND p.liberar_en <= ?`, ahora)) {
      ejecutar(`UPDATE pagos SET estado = 'LIBERADO' WHERE id = ?`, p.id);
      registrar(p.sesion_id, 'PAGO_LIBERADO', `Pasaron 48 horas sin reclamos: se liberaron ${pesos(p.neto_tutor)} al tutor.`);
      notificar(p.tutor_id, 'Pago liberado', `Ya tienes disponibles ${pesos(p.neto_tutor)} de tu sesión.`, p.sesion_id);
    }

    // RN-08: una calificación sin contraparte se publica a los 7 días.
    for (const c of todos(`SELECT DISTINCT sesion_id FROM calificaciones WHERE publicada = 0 AND creado_en <= ?`, new Date(t - 7 * 24 * HORA).toISOString()))
      registrar(c.sesion_id, 'CALIFICACIONES_PUBLICADAS', 'Pasaron 7 días: la calificación se publicó sin esperar a la otra parte.');
    ejecutar(`UPDATE calificaciones SET publicada = 1 WHERE publicada = 0 AND creado_en <= ?`,
      new Date(t - 7 * 24 * HORA).toISOString());
  });
}

export function iniciarTareas() {
  setInterval(() => {
    try { revisarPlazos(); } catch (e) { console.error('Error revisando plazos:', e); }
  }, 2000).unref();
}
