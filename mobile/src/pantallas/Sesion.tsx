import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Accion, type Sesion as TSesion } from '../api';
import { cuando, Pantalla } from '../comunes';
import { abrirSala, CasoDeLaSesion, Historial } from '../caso';
import { useSesion } from '../sesion';
import { Alerta, Avatar, Boton, Campo, Cargando, DatosLista, Estrellas, Hoja, Insignia, SelectorEstrellas, mensajeDe } from '../ui';
import { C, e } from '../tema';
import { dinero, duracion, ESTADO_PAGO, ESTADO_SESION, fechaHora } from '../formato';

const PASOS: Record<TSesion['tipo'], string[]> = {
  PROGRAMADA: ['Solicitada', 'Confirmada', 'En curso', 'Finalizada'],
  BAJO_DEMANDA: ['Buscando', 'Asignada', 'En curso', 'Finalizada'],
};
const AVANCE: Partial<Record<TSesion['estado'], number>> = { PENDIENTE_ACEPTACION: 0, BUSCANDO_TUTOR: 0, CONFIRMADA: 1, EN_CURSO: 2, FINALIZADA: 4 };
const CIERRE: Partial<Record<TSesion['estado'], string>> = {
  CANCELADA: 'La sesión fue cancelada.',
  SIN_TUTOR: 'Ningún tutor tomó la solicitud a tiempo. No se hizo ningún cobro.',
  NO_REALIZADA: 'La sesión no se realizó y el pago se devolvió al estudiante.',
};

function Pasos({ s }: { s: TSesion }) {
  const avance = AVANCE[s.estado];
  if (avance === undefined) return <Alerta tono="espera">{CIERRE[s.estado]}</Alerta>;
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

type Ventana = 'cancelar' | 'rechazar' | 'calificar' | 'disputa' | null;

export default function Sesion({ id }: { id: number }) {
  const { usuario, avisar } = useSesion();
  const cola = useQueryClient();
  const [ventana, setVentana] = useState<Ventana>(null);
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [motivo, setMotivo] = useState('');
  const soyTutor = usuario?.rol === 'TUTOR';

  const sesion = useQuery({ queryKey: ['sesion', id], queryFn: () => api<TSesion>(`/sesiones/${id}`), refetchInterval: 30_000 });
  const accion = useMutation({
    mutationFn: ({ cual, cuerpo }: { cual: Accion; cuerpo?: object }) => api<TSesion | { ok: true }>(`/sesiones/${id}/${cual}`, cuerpo ?? {}),
    onSuccess: (r, { cual }) => {
      if ('id' in r) cola.setQueryData(['sesion', id], r);
      for (const k of ['sesion', 'sesiones', 'ingresos', 'demanda']) cola.invalidateQueries({ queryKey: [k] });
      setVentana(null);
      const hecho: Record<Accion, string> = {
        aceptar: 'Sesión confirmada', rechazar: 'Solicitud rechazada', cancelar: 'Sesión cancelada', iniciar: 'Sesión iniciada',
        finalizar: 'Sesión finalizada', calificar: 'Calificación enviada', disputa: 'Disputa abierta',
      };
      avisar(hecho[cual], 'bien');
    },
  });
  const abrir = (v: Ventana) => { accion.reset(); setVentana(v); };

  if (sesion.isPending) return <Pantalla titulo="Sesión" atras><Cargando /></Pantalla>;
  if (sesion.isError) return <Pantalla titulo="Sesión" atras><Alerta>{mensajeDe(sesion.error)}</Alerta></Pantalla>;
  const s = sesion.data;
  const est = ESTADO_SESION[s.estado];
  const puede = (a: Accion) => s.acciones.includes(a);
  const otro = soyTutor ? s.estudiante.nombre : s.tutor?.nombre ?? 'Tutor por asignar';
  const ocupado = accion.isPending;

  const textoCancelar = soyTutor ? 'Al estudiante se le devuelve el pago completo.'
    : s.reembolsoSiCancela === null ? 'Todavía no se ha hecho ningún cobro.'
      : s.reembolsoSiCancela === 100 ? `Se te devuelve el pago completo (${dinero(s.precio)}).`
        : s.reembolsoSiCancela === 50 ? `Faltan menos de 24 horas: se te devuelve la mitad (${dinero((s.precio ?? 0) / 2)}).`
          : 'Faltan menos de 2 horas: la cancelación no tiene devolución.';

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
          {s.enlace && (
            <Pressable onPress={() => abrirSala(s.id, 'CLASE', s.enlace!)} accessibilityRole="link">
              <Alerta tono="bien" titulo="Sala de la sesión (toca para entrar)">{s.enlace}</Alerta>
            </Pressable>
          )}
          {accion.isError && ventana === null && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          {puede('aceptar') && <Boton texto="Aceptar la solicitud" cargando={ocupado} alPresionar={() => accion.mutate({ cual: 'aceptar' })} />}
          {puede('iniciar') && <Boton texto="Iniciar la sesión" cargando={ocupado} alPresionar={() => accion.mutate({ cual: 'iniciar' })} />}
          {puede('finalizar') && <Boton texto="Finalizar la sesión" cargando={ocupado} alPresionar={() => accion.mutate({ cual: 'finalizar' })} />}
          {puede('calificar') && <Boton texto={`Calificar ${soyTutor ? 'al estudiante' : 'al tutor'}`} alPresionar={() => abrir('calificar')} />}
          {puede('rechazar') && <Boton texto="Rechazar" variante="fantasma" alPresionar={() => abrir('rechazar')} />}
          {puede('cancelar') && <Boton texto="Cancelar la sesión" variante="fantasma" alPresionar={() => abrir('cancelar')} />}
          {puede('disputa') && <Boton texto="Reportar un problema" variante="fantasma" alPresionar={() => abrir('disputa')} />}
        </View>

        <View style={e.tarjeta}>
          <View style={e.entre}>
            <Text style={e.h2}>Pago</Text>
            {s.pago && <Insignia tono={ESTADO_PAGO[s.pago.estado].tono} texto={ESTADO_PAGO[s.pago.estado].texto} />}
          </View>
          {!s.pago ? <Text style={e.tenue}>{s.estado === 'BUSCANDO_TUTOR' ? 'El cobro se hace cuando un tutor acepte.' : 'Esta sesión no tuvo cobro.'}</Text> : (
            <>
              <DatosLista filas={[
                { dt: 'Valor de la sesión', dd: dinero(s.pago.monto) },
                ...(soyTutor ? [{ dt: 'Comisión (15 %)', dd: `− ${dinero(s.pago.comision)}` }] : []),
                ...(s.pago.reembolso > 0 ? [{ dt: 'Devuelto al estudiante', dd: dinero(s.pago.reembolso) }] : []),
                soyTutor ? { dt: 'Tu ganancia', dd: dinero(s.pago.netoTutor), total: true } : { dt: 'Total pagado', dd: dinero(s.pago.monto - s.pago.reembolso), total: true },
                { dt: 'Medio', dd: s.pago.metodo },
                { dt: 'Referencia', dd: s.pago.referencia },
              ]} />
              {s.pago.estado === 'RETENIDO' && s.pago.liberarEn && (
                <Text style={e.pequeno}>Se entrega al tutor {fechaHora(s.pago.liberarEn).toLowerCase()}, 48 horas después de la sesión, si no hay disputa.</Text>
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
                {!s.miCalificacion.publicada && <Text style={e.pequeno}>Se publica cuando la otra parte califique o pasados 7 días.</Text>}
              </View>
            )}
            {s.calificacionRecibida && (
              <View style={{ gap: 2 }}>
                <Text style={e.negrita}>Calificación que recibiste</Text>
                <Estrellas valor={s.calificacionRecibida.puntaje} />
                {s.calificacionRecibida.comentario && <Text style={e.tenue}>{s.calificacionRecibida.comentario}</Text>}
              </View>
            )}
          </View>
        )}

        {s.disputa && <CasoDeLaSesion s={s} soyTutor={soyTutor} />}

        <Historial sesionId={s.id} />
      </Pantalla>

      {(ventana === 'cancelar' || ventana === 'rechazar') && (
        <Hoja titulo={ventana === 'cancelar' ? 'Cancelar la sesión' : 'Rechazar la solicitud'} cerrar={() => setVentana(null)}>
          <Text style={e.texto}>{ventana === 'cancelar' ? textoCancelar : 'El estudiante recibe la devolución completa y la hora vuelve a quedar libre.'}</Text>
          {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          <Boton texto={ventana === 'cancelar' ? 'Sí, cancelar' : 'Sí, rechazar'} variante="peligro" cargando={ocupado} alPresionar={() => accion.mutate({ cual: ventana })} />
          <Boton texto="Volver" variante="fantasma" alPresionar={() => setVentana(null)} />
        </Hoja>
      )}
      {ventana === 'calificar' && (
        <Hoja titulo={`Calificar a ${otro}`} cerrar={() => setVentana(null)}>
          <SelectorEstrellas valor={puntaje} cambiar={setPuntaje} />
          <Campo etiqueta="Comentario (opcional)" value={comentario} onChangeText={setComentario} multiline maxLength={500} placeholder="¿Cómo estuvo la sesión?" />
          <Text style={e.pequeno}>Las dos calificaciones se publican juntas, cuando ambos califiquen o pasados 7 días.</Text>
          {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          <Boton texto="Enviar calificación" deshabilitado={puntaje === 0} cargando={ocupado}
            alPresionar={() => accion.mutate({ cual: 'calificar', cuerpo: { puntaje, comentario: comentario.trim() } })} />
        </Hoja>
      )}
      {ventana === 'disputa' && (
        <Hoja titulo="Reportar un problema" cerrar={() => setVentana(null)}>
          <Text style={e.tenue}>Cuéntanos qué pasó. El pago queda congelado mientras el equipo de soporte revisa el caso. Después podrás enviar fotos como pruebas y el tutor podrá presentar su versión.</Text>
          <Campo etiqueta="Motivo" value={motivo} onChangeText={setMotivo} multiline maxLength={500} ayuda="Entre 10 y 500 caracteres." />
          {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          <Boton texto="Abrir disputa" variante="peligro" cargando={ocupado} alPresionar={() => accion.mutate({ cual: 'disputa', cuerpo: { motivo: motivo.trim() } })} />
        </Hoja>
      )}
    </>
  );
}
