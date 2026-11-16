import { tx, todos, ejecutar } from './db.js';
import {
  ahoraIso, MIN, HORA, notificar, avisarSesion, reembolsar, finalizarSesion, sesionesDonde, tutoresElegibles, registrar,
  param, plazo, avanzarTurno, pasarTurno, cerrarSinTutor, revisarReputacion,
} from './nucleo.js';
import { fechaHoraCo, horaCo, pesos } from './formato.js';

/** Revisa los plazos del sistema. Corre cada dos segundos para que una solicitud bajo demanda no quede colgada (RNF-02). */
export function revisarPlazos() {
  const ahora = ahoraIso();
  const t = Date.now();

  tx(() => {
    // P-06: búsqueda por turnos. Se cierra al cumplirse el límite global; si no, el turno vencido pasa al siguiente candidato.
    for (const s of sesionesDonde(`s.estado = 'BUSCANDO_TUTOR'`)) {
      if (Date.parse(s.expira_en) <= t) {
        cerrarSinTutor(s, `Pasaron ${param('BUSQUEDA_DEMANDA_MIN')} minutos y ningún tutor aceptó.`);
      } else if (!s.turno_tutor_id) {
        avanzarTurno(s);
      } else if (!tutoresElegibles(s.materia_id, s.id).includes(s.turno_tutor_id)) {
        pasarTurno(s, `El tutor en turno dejó de estar disponible; la solicitud pasó al siguiente candidato.`);
      } else if (Date.parse(s.turno_expira_en) <= t) {
        pasarTurno(s, `El tutor en turno no respondió en ${param('TURNO_DEMANDA_S')} segundos (RN-05); la solicitud pasó al siguiente candidato.`);
      }
    }

    // RN-05: el tutor no respondió la reserva a tiempo. Se devuelve todo (A2 de P-04).
    for (const s of sesionesDonde(`s.estado = 'PENDIENTE_ACEPTACION' AND s.expira_en <= ?`, ahora)) {
      ejecutar(`UPDATE sesiones SET estado = 'CANCELADA', expira_en = NULL WHERE id = ?`, s.id);
      registrar(s.id, 'VENCIDA', `${s.tutor_nombre} no respondió la reserva a tiempo. Se canceló automáticamente.`);
      reembolsar(s.id, 100);
      notificar(s.estudiante_id, 'Reserva vencida', `${s.tutor_nombre} no respondió a tiempo. Te devolvimos el pago completo y te sugerimos otros tutores.`, s.id);
      notificar(s.tutor_id, 'Reserva vencida', `La solicitud de ${s.estudiante_nombre} venció sin respuesta.`, s.id);
      avisarSesion(s);
    }

    // RF-M10-04: dos recordatorios a las dos partes, 24 h y 15 min antes. Una propuesta de reprogramación vence al llegar la hora.
    const h1 = param('RECORDATORIO_1_H') * HORA;
    const m2 = param('RECORDATORIO_2_MIN') * MIN;
    for (const s of sesionesDonde(`s.estado = 'CONFIRMADA' AND s.inicio > ?`, ahora)) {
      const falta = Date.parse(s.inicio) - t;
      if (!s.recordatorio_1_en && falta <= h1 && falta > m2) {
        // Si la sesión se reservó cuando faltaba menos que eso, el primer aviso ya no tiene sentido: se marca sin enviar.
        const aTiempo = Date.parse(s.inicio) - Date.parse(s.creado_en) > h1;
        ejecutar('UPDATE sesiones SET recordatorio_1_en = ? WHERE id = ?', ahora, s.id);
        if (aTiempo) recordar(s, `Recordatorio: tu sesión de ${s.materia_nombre} es el ${fechaHoraCo(s.inicio)}.`, 'primer');
      }
      if (!s.recordatorio_2_en && falta <= m2) {
        ejecutar('UPDATE sesiones SET recordatorio_1_en = COALESCE(recordatorio_1_en, ?), recordatorio_2_en = ? WHERE id = ?', ahora, ahora, s.id);
        recordar(s, `Tu sesión de ${s.materia_nombre} empieza a las ${horaCo(s.inicio)}.${s.enlace ? ' Ya puedes entrar a la sala.' : ''}`, 'segundo');
      }
    }
    for (const s of sesionesDonde(`s.estado = 'CONFIRMADA' AND s.repro_inicio IS NOT NULL AND s.inicio <= ?`, ahora)) {
      ejecutar('UPDATE sesiones SET repro_inicio = NULL, repro_por = NULL, repro_en = NULL WHERE id = ?', s.id);
      registrar(s.id, 'REPROGRAMACION_VENCIDA', 'La propuesta de reprogramación venció sin respuesta al llegar la hora de la sesión.');
      avisarSesion(s);
    }

    // Sesión confirmada que nunca se inició ni se reportó: tolerancia después de la hora de fin. Se devuelve todo (E7 de P-06).
    const tol = plazo.tolerancia();
    for (const s of sesionesDonde(`s.estado = 'CONFIRMADA'`)) {
      if (Date.parse(s.inicio) + s.duracion_min * MIN + tol > t) continue;
      ejecutar(`UPDATE sesiones SET estado = 'NO_REALIZADA', cerrada_en = ? WHERE id = ?`, ahora, s.id);
      registrar(s.id, 'NO_REALIZADA', `La sesión no se inició dentro del horario reservado (${param('TOLERANCIA_MIN')} minutos de tolerancia).`);
      reembolsar(s.id, 100);
      notificar(s.estudiante_id, 'Sesión no realizada', 'La sesión no se inició. Te devolvimos el pago completo.', s.id);
      notificar(s.tutor_id, 'Sesión no realizada', 'La sesión no se inició dentro del horario reservado.', s.id);
      avisarSesion(s);
    }

    // A4 de P-07: nadie la marcó como finalizada; se cierra al vencer la duración pactada más la tolerancia.
    for (const s of sesionesDonde(`s.estado = 'EN_CURSO'`))
      if (Date.parse(s.iniciada_en) + s.duracion_min * MIN + tol <= t) finalizarSesion(s, null);

    // RN-02: pasado el periodo de garantía sin disputa, el pago queda disponible para el tutor.
    for (const p of todos(`SELECT p.id, p.neto_tutor, s.id AS sesion_id, s.tutor_id FROM pagos p JOIN sesiones s ON s.id = p.sesion_id
                           WHERE p.estado = 'RETENIDO' AND p.liberar_en IS NOT NULL AND p.liberar_en <= ?`, ahora)) {
      ejecutar(`UPDATE pagos SET estado = 'LIBERADO' WHERE id = ?`, p.id);
      registrar(p.sesion_id, 'PAGO_LIBERADO', `Terminó el periodo de garantía sin reclamos: se liberaron ${pesos(p.neto_tutor)} al tutor.`);
      notificar(p.tutor_id, 'Pago liberado', `Ya tienes disponibles ${pesos(p.neto_tutor)} de tu sesión.`, p.sesion_id);
    }

    // RN-08: una calificación sin contraparte se publica al cumplirse el plazo.
    const limite = new Date(t - param('PUBLICACION_DIAS') * 24 * HORA).toISOString();
    const pendientes = todos(`SELECT DISTINCT sesion_id, destinatario_id FROM calificaciones WHERE publicada = 0 AND creado_en <= ?`, limite);
    for (const c of pendientes)
      registrar(c.sesion_id, 'CALIFICACIONES_PUBLICADAS', `Pasaron ${param('PUBLICACION_DIAS')} días: la calificación se publicó sin esperar a la otra parte.`);
    ejecutar(`UPDATE calificaciones SET publicada = 1 WHERE publicada = 0 AND creado_en <= ?`, limite);
    for (const c of pendientes) revisarReputacion(c.destinatario_id);
  });
}

function recordar(s: any, texto: string, cual: 'primer' | 'segundo') {
  registrar(s.id, 'RECORDATORIO', `Se envió el ${cual} recordatorio a las dos partes (sesión del ${fechaHoraCo(s.inicio)}).`);
  notificar(s.estudiante_id, 'Tu sesión empieza pronto', `${texto} Tutor: ${s.tutor_nombre}.`, s.id);
  notificar(s.tutor_id, 'Tu sesión empieza pronto', `${texto} Estudiante: ${s.estudiante_nombre}.`, s.id);
  avisarSesion(s);
}


export function iniciarTareas() {
  setInterval(() => {
    try { revisarPlazos(); } catch (e) { console.error('Error revisando plazos:', e); }
  }, 2000).unref();
}
