import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, type Materia, type Sesion } from './api';
import { useSesion } from './sesion';
import { useNav } from './nav';
import { Avatar, Insignia } from './ui';
import { C, e } from './tema';
import { dinero, duracion, ESTADO_SESION, fechaHora } from './formato';

export function useMaterias() {
  return useQuery({ queryKey: ['materias'], queryFn: () => api<Materia[]>('/materias'), staleTime: Infinity });
}

export function useSesiones() {
  return useQuery({ queryKey: ['sesiones'], queryFn: () => api<Sesion[]>('/sesiones') });
}

export function cuando(s: Sesion) {
  return s.inicio ? fechaHora(s.inicio) : `Pedida ${fechaHora(s.creadoEn).toLowerCase()}`;
}

/** Pantalla con desplazamiento, título y gesto de “jalar para actualizar”. */
export function Pantalla({ titulo, detalle, atras, refrescando, alRefrescar, children, accion }: {
  titulo: string; detalle?: string; atras?: boolean; refrescando?: boolean; alRefrescar?: () => void; children: ReactNode; accion?: ReactNode;
}) {
  const nav = useNav();
  return (
    <ScrollView style={e.pantalla} contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled"
      refreshControl={alRefrescar ? <RefreshControl refreshing={!!refrescando} onRefresh={alRefrescar} colors={[C.marino]} /> : undefined}>
      {atras && (
        <Pressable onPress={nav.atras} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start' }}>
          <Text style={{ color: C.marino, fontWeight: '700', fontSize: 15 }}>← Volver</Text>
        </Pressable>
      )}
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
}

export function FilaSesion({ s }: { s: Sesion }) {
  const { usuario } = useSesion();
  const nav = useNav();
  const soyTutor = usuario?.rol === 'TUTOR';
  const otro = soyTutor ? s.estudiante.nombre : s.tutor?.nombre ?? 'Tutor por asignar';
  const est = ESTADO_SESION[s.estado];
  return (
    <Pressable onPress={() => nav.ir({ nombre: 'sesion', id: s.id })} accessibilityRole="button"
      style={({ pressed }) => [e.tarjeta, { padding: 13, flexDirection: 'row', gap: 12, alignItems: 'center', opacity: pressed ? 0.8 : 1 }]}>
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
      </View>
    </Pressable>
  );
}
