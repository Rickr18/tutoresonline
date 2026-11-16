import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Accion, type Sesion as TSesion } from '../api';
import { cuando, Pantalla, useParametros } from '../comunes';
import { useNav } from '../nav';
import { abrirSala, CasoDeLaSesion, Historial } from '../caso';
import { useSesion } from '../sesion';
import { Alerta, Avatar, Boton, Campo, Cargando, DatosLista, Estrellas, Hoja, Insignia, Opciones, Reloj, SelectorEstrellas, mensajeDe } from '../ui';
import { C, e } from '../tema';
import { dinero, duracion, ESTADO_PAGO, ESTADO_SESION, fechaHora, MODERACION } from '../formato';

const PASOS: Record<TSesion['tipo'], string[]> = {
  PROGRAMADA: ['Solicitada', 'Confirmada', 'En curso', 'Finalizada'],
  BAJO_DEMANDA: ['Buscando', 'Asignada', 'En curso', 'Finalizada'],
};
const AVANCE: Partial<Record<TSesion['estado'], number>> = { PENDIENTE_ACEPTACION: 0, BUSCANDO_TUTOR: 0, CONFIRMADA: 1, EN_CURSO: 2, FINALIZADA: 4 };
/** Por qué terminó una sesión que no llegó a realizarse (mismo texto que la web). */
function textoCierre(s: TSesion) {
  if (s.estado === 'SIN_TUTOR') return 'Ningún tutor tomó la solicitud a tiempo. La retención del pago se liberó: no se hizo ningún cobro.';
  if (s.estado === 'NO_REALIZADA') {
    if (s.ausente === 'TUTOR') return 'El tutor no se conectó dentro de la tolerancia. Se devolvió el pago completo al estudiante.';
    if (s.ausente === 'ESTUDIANTE') return 'El estudiante no se conectó dentro de la tolerancia. El pago se entrega al tutor al terminar el periodo de garantía, salvo disputa.';
    return 'La sesión no se inició en el horario reservado y el pago se devolvió al estudiante.';
  }
  return 'La sesión fue cancelada.';
}

function Pasos({ s }: { s: TSesion }) {
  const avance = AVANCE[s.estado];
  if (avance === undefined) return <Alerta tono="espera">{textoCierre(s)}</Alerta>;
  return (
    <View style={{ flexDirection: 'row' }}>
      {PASOS[s.tipo].map((p, i) => {
        const hecho = i < avance;
        const actual = i === avance;
        return (
          <View key={p} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : i <= avance ? C.verde : C.linea }} />
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hecho ? C.verde : actual ? C.ambar : C.gris }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: hecho ? '#fff' : C.tinta }}>{hecho ? '✓' : i + 1}</Text>
              </View>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 3 ? 'transparent' : i < avance ? C.verde : C.linea }} />
            </View>
            <Text style={{ fontSize: 11.5, color: hecho || actual ? C.tinta : C.tenue, fontWeight: actual ? '700' : '500' }}>{p}</Text>
          </View>
        );
      })}
    </View>
  );
}

type Ventana = 'cancelar' | 'rechazar' | 'calificar' | 'disputa' | 'reprogramar' | 'inasistencia' | 'reportar' | null;

/** Horas libres del tutor para proponer la reprogramación (las 12 más cercanas). */
function FranjasNuevas({ tutorId, actual, valor, cambiar }: { tutorId: number; actual: string | null; valor: string; cambiar: (v: string) => void }) {
  const franjas = useQuery({ queryKey: ['franjas', tutorId], queryFn: () => api<string[]>(`/tutores/${tutorId}/franjas`) });
  if (franjas.isPending) return <Cargando />;
  if (franjas.isError) return <Alerta>{mensajeDe(franjas.error)}</Alerta>;
  const opciones = franjas.data.filter((f) => f !== actual).slice(0, 12);
  if (!opciones.length) return <Alerta tono="espera">El tutor no tiene horas libres en los próximos 7 días.</Alerta>;
  return <Opciones etiqueta="Nueva fecha" valor={valor} cambiar={cambiar} opciones={[{ valor: '', texto: 'Elige una hora' }, ...opciones.map((f) => ({ valor: f, texto: fechaHora(f) }))]} />;
}

export default function Sesion({ id }: { id: number }) {
  const { usuario, avisar } = useSesion();
  const cola = useQueryClient();
  const [ventana, setVentana] = useState<Ventana>(null);
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [motivo, setMotivo] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const soyTutor = usuario?.rol === 'TUTOR';
  const p = useParametros();
  const nav = useNav();

  const sesion = useQuery({ queryKey: ['sesion', id], queryFn: () => api<TSesion>(`/sesiones/${id}`), refetchInterval: 30_000 });
  const accion = useMutation({
    mutationFn: ({ ruta, cuerpo }: { ruta: string; cuerpo?: object }) => api<TSesion | { ok: true }>(`/sesiones/${id}/${ruta}`, cuerpo ?? {}),
    onSuccess: (r, { ruta, cuerpo }) => {
      if ('id' in r) cola.setQueryData(['sesion', id], r);
      for (const k of ['sesion', 'sesiones', 'ingresos', 'demanda', 'historial', 'franjas']) cola.invalidateQueries({ queryKey: [k] });
      setVentana(null);
      const c = (cuerpo ?? {}) as { aceptar?: boolean; retirar?: boolean };
      const hecho: Record<string, string> = {
        aceptar: 'Sesión confirmada', rechazar: 'Solicitud rechazada', cancelar: 'Sesión cancelada', iniciar: 'Sesión iniciada',
        finalizar: 'Sesión finalizada', calificar: 'Calificación enviada', disputa: 'Disputa abierta', reprogramar: 'Propuesta enviada',
        inasistencia: 'Inasistencia reportada', 'calificacion/reportar': 'Comentario reportado',
        reprogramacion: c.retirar ? 'Propuesta retirada' : c.aceptar ? 'Nueva fecha aceptada' : 'Propuesta rechazada',
      };
      const retenido = 'comentarioRetenido' in r && r.comentarioRetenido;
      avisar(retenido ? 'Calificación enviada. El comentario quedó en revisión.' : hecho[ruta] ?? 'Listo', 'bien');
    },
  });
  const hacer = (ruta: string, cuerpo?: object) => accion.mutate({ ruta, cuerpo });
  const abrir = (v: Ventana) => { accion.reset(); setMotivo(''); setVentana(v); };

  if (sesion.isPending) return <Pantalla titulo="Sesión" atras><Cargando /></Pantalla>;
  if (sesion.isError) return <Pantalla titulo="Sesión" atras><Alerta>{mensajeDe(sesion.error)}</Alerta></Pantalla>;
  const s = sesion.data;
  const est = ESTADO_SESION[s.estado];
  const puede = (a: Accion) => s.acciones.includes(a);
  const otro = soyTutor ? s.estudiante.nombre : s.tutor?.nombre ?? 'Tutor por asignar';
  const ocupado = accion.isPending;

  const pctComision = s.pago && s.pago.monto ? Math.round((s.pago.comision / s.pago.monto) * 100) : p.COMISION_PCT;
  const textoCancelar = soyTutor ? 'Al estudiante se le devuelve el pago completo.'
    : s.estado === 'BUSCANDO_TUTOR' ? 'Se detiene la búsqueda y se libera toda la retención del pago.'
      : s.reembolsoSiCancela === null ? 'Todavía no se ha hecho ningún cobro.'
        : s.reembolsoSiCancela === 100 ? `Se te devuelve el pago completo (${dinero(s.precio)}).`
          : s.reembolsoSiCancela > 0 ? `Faltan menos de ${p.REEMBOLSO_TOTAL_H} horas: se te devuelve el ${s.reembolsoSiCancela} % (${dinero(((s.precio ?? 0) * s.reembolsoSiCancela) / 100)}).`
            : `Faltan menos de ${p.REEMBOLSO_PARCIAL_H} horas: la cancelación no tiene devolución.`;

  return (
    <>
      <Pantalla titulo={s.materia.nombre} atras refrescando={sesion.isRefetching} alRefrescar={() => sesion.refetch()}>
        <View style={e.tarjeta}>
          <View style={e.entre}>
            <View style={[e.fila, { flex: 1 }]}>
              <Avatar nombre={otro} />
              <View style={{ flex: 1 }}>
                <Text style={e.pequeno}>{soyTutor ? 'Estudiante' : 'Tutor'}</Text>
                <Text style={e.negrita}>{otro}</Text>
              </View>
            </View>
            <Insignia tono={est.tono} texto={est.texto} />
          </View>
          <Pasos s={s} />
          <DatosLista filas={[
            { dt: 'Cuándo', dd: cuando(s) },
            { dt: 'Duración', dd: duracion(s.duracionMin) },
            { dt: 'Modalidad', dd: `${s.modalidad === 'VIRTUAL' ? 'Virtual' : 'Presencial'}${s.tipo === 'BAJO_DEMANDA' ? ' · Bajo demanda' : ''}` },
            { dt: 'Tema', dd: s.tema },
          ]} />
          {s.estado === 'PENDIENTE_ACEPTACION' && s.expiraEn && (
            <Alerta tono="info">{soyTutor ? `Tienes hasta ${fechaHora(s.expiraEn).toLowerCase()} para responder.` : `El tutor tiene hasta ${fechaHora(s.expiraEn).toLowerCase()} para aceptar.`}</Alerta>
          )}
          {s.estado === 'BUSCANDO_TUTOR' && s.turnoExpiraEn && (
            <View style={[e.fila, { gap: 12 }]}>
              <Reloj hasta={s.turnoExpiraEn} />
              <Text style={[e.texto, { flex: 1 }]}>Es tu turno para esta solicitud. Si no respondes, pasa al siguiente tutor.</Text>
            </View>
          )}
          {s.estado === 'BUSCANDO_TUTOR' && s.busqueda && (
            <Alerta tono="info">{`Ofreciendo la solicitud al tutor ${s.busqueda.candidato} de ${s.busqueda.total}.`}</Alerta>
          )}
          {s.reprogramacion && (
            <View style={{ gap: 8 }}>
              <Alerta tono="espera" titulo={s.reprogramacion.mia ? 'Propusiste cambiar la fecha' : `${s.reprogramacion.propuestaPor.nombre} propone cambiar la fecha`}>
                {`Nueva fecha: ${fechaHora(s.reprogramacion.inicio)}. Mientras tanto la sesión sigue en la fecha actual y el pago sigue retenido.`}
              </Alerta>
              {puede('responder-reprogramacion') && <>
                <Boton texto="Aceptar la nueva fecha" cargando={ocupado} alPresionar={() => hacer('reprogramacion', { aceptar: true })} />
                <Boton texto="Mantener la fecha actual" variante="fantasma" alPresionar={() => hacer('reprogramacion', { aceptar: false })} />
              </>}
              {puede('retirar-reprogramacion') && <Boton texto="Retirar la propuesta" variante="fantasma" alPresionar={() => hacer('reprogramacion', { retirar: true })} />}
            </View>
          )}
          {s.enlace && (
            <Pressable onPress={() => abrirSala(s.id, 'CLASE', s.enlace!)} accessibilityRole="link">
              <Alerta tono="bien" titulo="Sala de la sesión (toca para entrar)">{s.estado === 'CONFIRMADA' ? `${s.enlace}\nLa sesión empieza sola cuando las dos partes entran.` : s.enlace}</Alerta>
            </Pressable>
          )}
          {accion.isError && ventana === null && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          {puede('aceptar') && <Boton texto="Aceptar la solicitud" cargando={ocupado} alPresionar={() => hacer('aceptar')} />}
          {puede('iniciar') && <Boton texto="Iniciar la sesión" cargando={ocupado} alPresionar={() => hacer('iniciar')} />}
          {puede('finalizar') && <Boton texto="Finalizar la sesión" cargando={ocupado} alPresionar={() => hacer('finalizar')} />}
          {puede('calificar') && <Boton texto={`Calificar ${soyTutor ? 'al estudiante' : 'al tutor'}`} alPresionar={() => abrir('calificar')} />}
          {puede('reprogramar') && <Boton texto="Proponer otra fecha" variante="fantasma" alPresionar={() => { setNuevaFecha(''); abrir('reprogramar'); }} />}
          {puede('rechazar') && <Boton texto={s.tipo === 'BAJO_DEMANDA' ? 'Pasar' : 'Rechazar'} variante="fantasma" alPresionar={() => abrir('rechazar')} />}
          {puede('cancelar') && <Boton texto={s.estado === 'BUSCANDO_TUTOR' ? 'Cancelar la búsqueda' : 'Cancelar la sesión'} variante="fantasma" alPresionar={() => abrir('cancelar')} />}
          {puede('inasistencia') && <Boton texto={`Reportar que ${soyTutor ? 'el estudiante' : 'el tutor'} no se conectó`} variante="peligro" alPresionar={() => abrir('inasistencia')} />}
          {puede('disputa') && <Boton texto="Reportar un problema" variante="fantasma" alPresionar={() => abrir('disputa')} />}
        </View>

        {s.sugerencias.length > 0 && (
          <View style={e.tarjeta}>
            <Text style={e.h2}>Otros tutores de {s.materia.nombre}</Text>
            {s.sugerencias.map((t) => (
              <Pressable key={t.id} onPress={() => nav.ir({ nombre: 'tutor', id: t.id })} accessibilityRole="button" accessibilityLabel={t.nombre}
                style={[e.fila, { paddingVertical: 6 }]}>
                <Avatar nombre={t.nombre} />
                <View style={{ flex: 1 }}>
                  <Text style={e.negrita}>{t.nombre}</Text>
                  <Text style={e.pequeno}>{dinero(t.tarifaHora)} por hora</Text>
                </View>
                <Estrellas valor={t.calificacion} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={e.tarjeta}>
          <View style={e.entre}>
            <Text style={e.h2}>Pago</Text>
            {s.pago && <Insignia tono={ESTADO_PAGO[s.pago.estado].tono} texto={ESTADO_PAGO[s.pago.estado].texto} />}
          </View>
          {!s.pago ? <Text style={e.tenue}>Esta sesión no tuvo cobro.</Text> : (
            <>
              <DatosLista filas={[
                { dt: s.estado === 'BUSCANDO_TUTOR' ? 'Valor retenido (estimado)' : 'Valor de la sesión', dd: dinero(s.pago.monto) },
                { dt: `Comisión (${pctComision} %)`, dd: soyTutor ? `− ${dinero(s.pago.comision)}` : `${dinero(s.pago.comision)}, la paga el tutor` },
                { dt: 'Impuestos', dd: dinero(0) },
                ...(s.pago.reembolso > 0 ? [{ dt: 'Devuelto al estudiante', dd: dinero(s.pago.reembolso) }] : []),
                soyTutor ? { dt: 'Tu ganancia', dd: dinero(s.pago.netoTutor), total: true } : { dt: 'Total pagado', dd: dinero(s.pago.monto - s.pago.reembolso), total: true },
                { dt: 'Medio', dd: s.pago.metodo },
                { dt: 'Referencia', dd: s.pago.referencia },
              ]} />
              {s.pago.estado === 'RETENIDO' && s.pago.liberarEn && (
                <Text style={e.pequeno}>Se entrega al tutor {fechaHora(s.pago.liberarEn).toLowerCase()}, al terminar el periodo de garantía, si no hay disputa.</Text>
              )}
            </>
          )}
        </View>

        {(s.miCalificacion || s.calificacionRecibida) && (
          <View style={e.tarjeta}>
            <Text style={e.h2}>Calificaciones</Text>
            {s.miCalificacion && (
              <View style={{ gap: 2 }}>
                <Text style={e.negrita}>Tu calificación</Text>
                <Estrellas valor={s.miCalificacion.puntaje} />
                {s.miCalificacion.comentario && <Text style={e.tenue}>{s.miCalificacion.comentario}</Text>}
                {s.miCalificacion.moderacion !== 'VISIBLE' && <Insignia tono={MODERACION[s.miCalificacion.moderacion].tono} texto={MODERACION[s.miCalificacion.moderacion].texto} />}
                {!s.miCalificacion.publicada && <Text style={e.pequeno}>Se publica cuando la otra parte califique o pasados {p.PUBLICACION_DIAS} días.</Text>}
              </View>
            )}
            {s.calificacionRecibida && (
              <View style={{ gap: 2 }}>
                <Text style={e.negrita}>Calificación que recibiste</Text>
                <Estrellas valor={s.calificacionRecibida.puntaje} />
                {s.calificacionRecibida.comentario && <Text style={e.tenue}>{s.calificacionRecibida.comentario}</Text>}
                {s.calificacionRecibida.moderacion === 'REPORTADA' && <Text style={e.pequeno}>Reportado: oculto mientras soporte lo revisa.</Text>}
                {puede('reportar') && <Boton texto="Reportar este comentario" variante="fantasma" chico alPresionar={() => abrir('reportar')} />}
              </View>
            )}
          </View>
        )}

        {s.disputa && <CasoDeLaSesion s={s} soyTutor={soyTutor} />}

        <Historial sesionId={s.id} />
      </Pantalla>

      {(ventana === 'cancelar' || ventana === 'rechazar') && (
        <Hoja titulo={ventana === 'cancelar' ? 'Cancelar la sesión' : s.tipo === 'BAJO_DEMANDA' ? 'Pasar la solicitud' : 'Rechazar la solicitud'} cerrar={() => setVentana(null)}>
          <Text style={e.texto}>{ventana === 'cancelar' ? textoCancelar : s.tipo === 'BAJO_DEMANDA' ? 'La solicitud pasa al siguiente tutor de la lista.' : 'El estudiante recibe la devolución completa, la hora vuelve a quedar libre y le sugerimos otros tutores.'}</Text>
          {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          <Boton texto={ventana === 'cancelar' ? 'Sí, cancelar' : s.tipo === 'BAJO_DEMANDA' ? 'Sí, pasar' : 'Sí, rechazar'} variante="peligro" cargando={ocupado} alPresionar={() => hacer(ventana)} />
          <Boton texto="Volver" variante="fantasma" alPresionar={() => setVentana(null)} />
        </Hoja>
      )}
      {ventana === 'calificar' && (
        <Hoja titulo={`Calificar a ${otro}`} cerrar={() => setVentana(null)}>
          <SelectorEstrellas valor={puntaje} cambiar={setPuntaje} />
          <Campo etiqueta="Comentario (opcional)" value={comentario} onChangeText={setComentario} multiline maxLength={400} placeholder="¿Cómo estuvo la sesión?"
            ayuda="No incluyas teléfonos, correos ni palabras ofensivas: el filtro los retiene para revisión." />
          <Text style={e.pequeno}>Las dos calificaciones se publican juntas, cuando ambos califiquen o pasados {p.PUBLICACION_DIAS} días.</Text>
          {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          <Boton texto="Enviar calificación" deshabilitado={puntaje === 0} cargando={ocupado}
            alPresionar={() => hacer('calificar', { puntaje, comentario: comentario.trim() })} />
        </Hoja>
      )}
      {(ventana === 'disputa' || ventana === 'reportar') && (
        <Hoja titulo={ventana === 'disputa' ? 'Reportar un problema' : 'Reportar el comentario'} cerrar={() => setVentana(null)}>
          <Text style={e.tenue}>{ventana === 'disputa'
            ? `Cuéntanos qué pasó. El pago queda congelado mientras el equipo de soporte revisa el caso. Después podrás enviar fotos como pruebas y ${soyTutor ? 'el estudiante' : 'el tutor'} podrá presentar su versión.`
            : 'El comentario se oculta de inmediato y soporte decide si se publica, se oculta o se elimina.'}</Text>
          <Campo etiqueta="Motivo" value={motivo} onChangeText={setMotivo} multiline maxLength={ventana === 'disputa' ? 500 : 300}
            ayuda={ventana === 'disputa' ? `Entre 10 y 500 caracteres. Dentro de las ${p.PLAZO_DISPUTA_H} horas siguientes a la sesión.` : 'Entre 10 y 300 caracteres.'} />
          {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          <Boton texto={ventana === 'disputa' ? 'Abrir disputa' : 'Reportar'} variante="peligro" cargando={ocupado}
            alPresionar={() => hacer(ventana === 'disputa' ? 'disputa' : 'calificacion/reportar', { motivo: motivo.trim() })} />
        </Hoja>
      )}
      {ventana === 'reprogramar' && s.tutor && (
        <Hoja titulo="Proponer otra fecha" cerrar={() => setVentana(null)}>
          <FranjasNuevas tutorId={s.tutor.id} actual={s.inicio} valor={nuevaFecha} cambiar={setNuevaFecha} />
          <Text style={e.pequeno}>{otro} debe aceptar el cambio. Mientras tanto la sesión sigue en la fecha actual y el pago sigue retenido.</Text>
          {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          <Boton texto="Enviar la propuesta" deshabilitado={!nuevaFecha} cargando={ocupado} alPresionar={() => hacer('reprogramar', { inicio: nuevaFecha })} />
        </Hoja>
      )}
      {ventana === 'inasistencia' && (
        <Hoja titulo="Reportar inasistencia" cerrar={() => setVentana(null)}>
          <Text style={e.texto}>{soyTutor
            ? `Pasaron más de ${p.TOLERANCIA_MIN} minutos y el estudiante no entró a la sala. La sesión queda como no realizada y el pago se te entrega al terminar el periodo de garantía, salvo disputa.`
            : `Pasaron más de ${p.TOLERANCIA_MIN} minutos y el tutor no entró a la sala. La sesión queda como no realizada, se te devuelve el pago completo y te sugerimos otros tutores.`}</Text>
          {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          <Boton texto="Sí, reportar" variante="peligro" cargando={ocupado} alPresionar={() => hacer('inasistencia')} />
          <Boton texto="Volver" variante="fantasma" alPresionar={() => setVentana(null)} />
        </Hoja>
      )}
    </>
  );
}
