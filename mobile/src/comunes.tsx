import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, type Materia, type Parametros, type Sesion } from './api';
import { useSesion } from './sesion';
import { useNav } from './nav';
import { Avatar, Insignia, RielSesion } from './ui';
import { Ionicons } from '@expo/vector-icons';
import { C, e } from './tema';
import { dinero, duracion, ESTADO_SESION, fechaHora } from './formato';

export function useMaterias() {
  return useQuery({ queryKey: ['materias'], queryFn: () => api<Materia[]>('/materias'), staleTime: Infinity });
}

/** Valores iniciales del Corte 1, mientras llegan los vigentes del servidor (copia de web/src/comunes.tsx). */
const PARAMETROS_INICIALES: Parametros = {
  COMISION_PCT: 15, PLAZO_RESERVA_H: 12, TURNO_DEMANDA_S: 45, BUSQUEDA_DEMANDA_MIN: 5, GARANTIA_H: 48, PLAZO_DISPUTA_H: 48,
  REEMBOLSO_TOTAL_H: 24, REEMBOLSO_PARCIAL_H: 2, REEMBOLSO_PARCIAL_PCT: 50, PUBLICACION_DIAS: 7, TOLERANCIA_MIN: 15,
  RECORDATORIO_1_H: 24, RECORDATORIO_2_MIN: 15, UMBRAL_REPUTACION: 3, MIN_VALORACIONES: 10,
};

/** Parámetros del negocio vigentes (RF-M11-07): comisión, plazos y umbrales que muestran las pantallas. */
export function useParametros(): Parametros {
  const q = useQuery({ queryKey: ['parametros'], queryFn: () => api<Parametros>('/parametros'), staleTime: 60_000 });
  return { ...PARAMETROS_INICIALES, ...q.data };
}

export function useSesiones() {
  return useQuery({ queryKey: ['sesiones'], queryFn: () => api<Sesion[]>('/sesiones') });
}

export function cuando(s: Sesion) {
  return s.inicio ? fechaHora(s.inicio) : `Pedida ${fechaHora(s.creadoEn).toLowerCase()}`;
}

/** Pantalla con desplazamiento, título y gesto de “jalar para actualizar”. Con `atras` lleva una cabecera fija para volver. */
export function Pantalla({ titulo, detalle, atras, refrescando, alRefrescar, children, accion }: {
  titulo: string; detalle?: string; atras?: boolean; refrescando?: boolean; alRefrescar?: () => void; children: ReactNode; accion?: ReactNode;
}) {
  const nav = useNav();
  const cuerpo = (
    <ScrollView style={e.pantalla} contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled"
      refreshControl={alRefrescar ? <RefreshControl refreshing={!!refrescando} onRefresh={alRefrescar} colors={[C.marino]} /> : undefined}>
      <View style={[e.entre, { alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={e.titulo}>{titulo}</Text>
          {detalle ? <Text style={e.subtitulo}>{detalle}</Text> : null}
        </View>
        {accion}
      </View>
      {children}
    </ScrollView>
  );
  if (!atras) return cuerpo;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: C.papel, borderBottomWidth: 1, borderBottomColor: C.linea, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Pressable onPress={nav.atras} accessibilityRole="button" accessibilityLabel="← Volver" hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' }}>
          <Ionicons name="arrow-back" size={20} color={C.marino} />
          <Text style={{ color: C.marino, fontWeight: '700', fontSize: 15 }}>Volver</Text>
        </Pressable>
      </View>
      {cuerpo}
    </View>
  );
}

/** La sesión tiene una disputa sin resolver: el pago está congelado y hay conversación con soporte. */
export const casoAbierto = (s: Sesion) => !!s.disputa && s.disputa.estado !== 'RESUELTA';

export function FilaSesion({ s }: { s: Sesion }) {
  const { usuario } = useSesion();
  const nav = useNav();
  const soyTutor = usuario?.rol === 'TUTOR';
  const otro = soyTutor ? s.estudiante.nombre : s.tutor?.nombre ?? 'Tutor por asignar';
  const est = ESTADO_SESION[s.estado];
  const pideAccion = s.acciones.some((a) => ['aceptar', 'iniciar', 'calificar', 'responder-reprogramacion'].includes(a));
  return (
    <Pressable onPress={() => nav.ir({ nombre: 'sesion', id: s.id })} accessibilityRole="button"
      style={({ pressed }) => [e.tarjeta, { padding: 13, flexDirection: 'row', gap: 12, alignItems: 'center', opacity: pressed ? 0.8 : 1 }, pideAccion && { borderLeftWidth: 4, borderLeftColor: C.ambar }]}>
      <Avatar nombre={otro} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={e.entre}>
          <Text style={[e.negrita, { flexShrink: 1 }]} numberOfLines={1}>{s.materia.nombre}</Text>
          <Text style={e.negrita}>{dinero(soyTutor ? s.pago?.netoTutor ?? null : s.precio)}</Text>
        </View>
        <Text style={e.pequeno} numberOfLines={1}>{otro} · {s.tema}</Text>
        <View style={e.entre}>
          <Text style={e.pequeno}>{cuando(s)} · {duracion(s.duracionMin)}{s.tipo === 'BAJO_DEMANDA' ? ' · Ahora' : ''}</Text>
          <Insignia tono={est.tono} texto={est.texto} />
        </View>
        <RielSesion tipo={s.tipo} estado={s.estado} compacto />
        {casoAbierto(s) && <Insignia tono="mal" texto="Caso de soporte abierto" />}
      </View>
    </Pressable>
  );
}
