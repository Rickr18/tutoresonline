import { Pressable, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi, type Sesion, type SolicitudDemanda } from '../api';
import { FilaSesion, Pantalla, useSesiones } from '../comunes';
import { useNav } from '../nav';
import { useSesion } from '../sesion';
import { Alerta, Boton, Cargando, Reloj, Vacio, mensajeDe } from '../ui';
import { C, e } from '../tema';
import { dinero, duracion } from '../formato';

function Solicitud({ d }: { d: SolicitudDemanda }) {
  const cola = useQueryClient();
  const nav = useNav();
  const { avisar } = useSesion();
  const responder = useMutation({
    mutationFn: (cual: 'aceptar' | 'rechazar') => api<Sesion | { ok: true }>(`/sesiones/${d.id}/${cual}`, {}),
    onSuccess: (_r, cual) => {
      cola.invalidateQueries({ queryKey: ['demanda'] });
      cola.invalidateQueries({ queryKey: ['sesiones'] });
      if (cual === 'aceptar') { avisar('Sesión asignada', 'bien', `${d.estudiante.nombre} te está esperando.`); nav.ir({ nombre: 'sesion', id: d.id }); }
    },
    onError: (err) => {
      if (err instanceof ErrorApi && err.estado === 409) { avisar(err.message, 'mal'); cola.invalidateQueries({ queryKey: ['demanda'] }); }
    },
  });
  return (
    <View style={[e.tarjeta, { borderLeftWidth: 4, borderLeftColor: C.ambar }]}>
      <View style={e.fila}>
        <Reloj hasta={d.expiraEn} />
        <View style={{ flex: 1 }}>
          <Text style={e.negrita}>{d.materia.nombre} · {duracion(d.duracionMin)}</Text>
          <Text style={e.tenue} numberOfLines={2}>{d.estudiante.nombre}: {d.tema}</Text>
        </View>
      </View>
      <View style={e.entre}>
        <Text><Text style={{ fontWeight: '800', fontSize: 18, color: C.tinta }}>{dinero(d.ganancia)}</Text><Text style={e.pequeno}> tu ganancia</Text></Text>
        <View style={e.fila}>
          <Boton texto="Pasar" variante="fantasma" chico deshabilitado={responder.isPending} alPresionar={() => responder.mutate('rechazar')} />
          <Boton texto="Aceptar" chico cargando={responder.isPending} alPresionar={() => responder.mutate('aceptar')} />
        </View>
      </View>
      {responder.isError && !(responder.error instanceof ErrorApi && responder.error.estado === 409) && <Alerta>{mensajeDe(responder.error)}</Alerta>}
    </View>
  );
}

export default function Panel() {
  const nav = useNav();
  const { usuario, refrescar, avisar } = useSesion();
  const t = usuario?.tutor;
  const aprobado = t?.verificacion === 'APROBADO';
  const sesiones = useSesiones();
  const demanda = useQuery({ queryKey: ['demanda'], queryFn: () => api<SolicitudDemanda[]>('/demanda/abiertas'), enabled: aprobado, refetchInterval: 5000 });
  const enLinea = useMutation({
    mutationFn: (v: boolean) => api('/tutor/en-linea', { enLinea: v }),
    onSuccess: () => refrescar(),
    onError: (err) => avisar(mensajeDe(err), 'mal'),
  });

  const lista = sesiones.data ?? [];
  const porAceptar = lista.filter((s) => s.estado === 'PENDIENTE_ACEPTACION');
  const casos = lista.filter((s) => s.disputa && s.disputa.estado !== 'RESUELTA');
  const proximas = lista.filter((s) => s.estado === 'CONFIRMADA' || s.estado === 'EN_CURSO')
    .sort((a, b) => Date.parse(a.inicio ?? a.creadoEn) - Date.parse(b.inicio ?? b.creadoEn));

  return (
    <Pantalla titulo={`Hola, ${usuario?.nombre.split(' ')[0] ?? ''}`} refrescando={sesiones.isRefetching}
      alRefrescar={() => { sesiones.refetch(); demanda.refetch(); refrescar(); }}>
      {t && !aprobado && (
        <Alerta tono={t.verificacion === 'RECHAZADO' ? 'mal' : 'espera'}
          titulo={t.verificacion === 'PENDIENTE' ? 'Tu perfil está en revisión' : t.verificacion === 'RECHAZADO' ? 'Tu perfil fue rechazado' : 'Completa tu perfil para empezar'}>
          {t.verificacion === 'PENDIENTE' ? 'Cuando un administrador lo apruebe vas a aparecer en las búsquedas.'
            : t.verificacion === 'RECHAZADO' ? `${t.motivoRechazo ?? ''} Corrígelo desde la versión web.`
              : 'Completa tu presentación, tarifa, materias y soporte de estudios desde la versión web.'}
        </Alerta>
      )}

      {aprobado && (
        <View style={[e.tarjeta, { backgroundColor: t?.enLinea ? '#e8f6f3' : C.papel }]}>
          <View style={e.entre}>
            <View style={{ flex: 1 }}>
              <Text style={e.h2}>{t?.enLinea ? 'Estás en línea' : 'Estás desconectado'}</Text>
              <Text style={e.pequeno}>{t?.enLinea ? 'Recibes solicitudes inmediatas de tus materias.' : 'Conéctate para recibir solicitudes inmediatas.'}</Text>
            </View>
            <Switch value={!!t?.enLinea} disabled={enLinea.isPending} onValueChange={(v) => enLinea.mutate(v)} trackColor={{ true: C.verde }} accessibilityLabel="En línea" />
          </View>
        </View>
      )}

      {aprobado && (
        <>
          <Text style={e.h2}>Solicitudes inmediatas</Text>
          {!t?.enLinea ? <Vacio titulo="Sin solicitudes">Activa “En línea” para recibirlas.</Vacio>
            : demanda.isPending ? <Cargando />
              : demanda.data?.length === 0 ? <Vacio titulo="No hay solicitudes abiertas">Cuando un estudiante pida ayuda en tus materias la verás aquí con 45 segundos para aceptar.</Vacio>
                : demanda.data?.map((d) => <Solicitud key={d.id} d={d} />)}
        </>
      )}

      {casos.map((s) => (
        <Pressable key={s.id} onPress={() => nav.ir({ nombre: 'sesion', id: s.id })} accessibilityRole="button">
          <Alerta tono="mal" titulo={`Caso de soporte abierto · ${s.materia.nombre}`}>
            {s.estudiante.nombre} abrió una disputa sobre esta sesión y el pago está congelado. Toca aquí para presentar tu versión y tus pruebas.
          </Alerta>
        </Pressable>
      ))}

      <Text style={e.h2}>Reservas por aceptar</Text>
      {sesiones.isPending ? <Cargando /> : porAceptar.length === 0 ? <Text style={e.tenue}>No tienes reservas esperando respuesta.</Text>
        : porAceptar.map((s) => <FilaSesion key={s.id} s={s} />)}

      <Text style={e.h2}>Próximas sesiones</Text>
      {sesiones.isError && <Alerta>{mensajeDe(sesiones.error)}</Alerta>}
      {sesiones.data && (proximas.length === 0 ? <Text style={e.tenue}>No tienes sesiones confirmadas.</Text> : proximas.map((s) => <FilaSesion key={s.id} s={s} />))}
    </Pantalla>
  );
}
