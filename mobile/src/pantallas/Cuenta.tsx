import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormularioClave } from './Clave';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { almacen, api, type Notificaciones } from '../api';
import { Pantalla } from '../comunes';
import { useNav } from '../nav';
import { useSesion } from '../sesion';
import { Avatar, Boton, Cargando, Estrellas, Hoja, Insignia } from '../ui';
import { C, e } from '../tema';
import { dinero, haceCuanto, MODALIDAD, VERIFICACION } from '../formato';

export default function Cuenta() {
  const { usuario, salir, enVivo } = useSesion();
  const nav = useNav();
  const [cambiando, setCambiando] = useState(false);
  const cola = useQueryClient();
  const notis = useQuery({ queryKey: ['notificaciones'], queryFn: () => api<Notificaciones>('/notificaciones') });
  const leer = useMutation({
    mutationFn: () => api('/notificaciones/leer', {}),
    onSuccess: () => cola.invalidateQueries({ queryKey: ['notificaciones'] }),
  });
  if (!usuario) return null;
  const t = usuario.tutor;
  const v = t ? VERIFICACION[t.verificacion ?? 'INCOMPLETO'] : null;

  return (
    <Pantalla titulo="Mi cuenta" refrescando={notis.isRefetching} alRefrescar={() => notis.refetch()}>
      <View style={e.tarjeta}>
        <View style={e.fila}>
          <Avatar nombre={usuario.nombre} grande />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[e.h2, { fontSize: 19 }]}>{usuario.nombre}</Text>
            <Text style={e.tenue}>{usuario.email}</Text>
            <Text style={e.pequeno}>{usuario.rol === 'TUTOR' ? 'Tutor' : 'Estudiante'} · {enVivo ? 'conectado en tiempo real' : 'sin conexión en tiempo real'}</Text>
          </View>
        </View>
        {t && v && (
          <>
            <View style={e.separador} />
            <View style={e.entre}><Text style={e.tenue}>Verificación</Text><Insignia tono={v.tono} texto={v.texto} /></View>
            <View style={e.entre}><Text style={e.tenue}>Tarifa</Text><Text style={e.negrita}>{t.tarifaHora ? `${dinero(t.tarifaHora)} por hora` : '—'}</Text></View>
            <View style={e.entre}><Text style={e.tenue}>Modalidad</Text><Text style={e.negrita}>{MODALIDAD[t.modalidad]}</Text></View>
            <View style={e.entre}><Text style={e.tenue}>Calificación</Text><Estrellas valor={t.calificacion} total={t.totalCalificaciones} /></View>
            <Text style={e.pequeno}>El perfil y la disponibilidad semanal se editan desde la versión web.</Text>
          </>
        )}
      </View>

      <View style={e.entre}>
        <Text style={e.h2}>Notificaciones{notis.data?.sinLeer ? ` (${notis.data.sinLeer})` : ''}</Text>
        {!!notis.data?.sinLeer && (
          <Pressable onPress={() => leer.mutate()} hitSlop={8} accessibilityRole="button"><Text style={{ color: C.marino, fontWeight: '700' }}>Marcar leídas</Text></Pressable>
        )}
      </View>
      {notis.isPending && <Cargando />}
      {notis.data?.lista.length === 0 && <Text style={e.tenue}>Aún no tienes notificaciones.</Text>}
      {!!notis.data?.lista.length && (
        <View style={[e.tarjeta, { padding: 0, gap: 0 }]}>
          {notis.data.lista.slice(0, 20).map((n, i) => (
            <Pressable key={n.id} disabled={!n.sesionId} onPress={() => n.sesionId && nav.ir({ nombre: 'sesion', id: n.sesionId })}
              style={[{ padding: 13, gap: 2 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.linea }, !n.leida && { backgroundColor: '#fff8ec' }]}>
              <Text style={e.negrita}>{n.titulo}</Text>
              <Text style={e.tenue}>{n.cuerpo}</Text>
              <Text style={e.pequeno}>{haceCuanto(n.fecha)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={e.pequeno}>Servidor: {almacen.servidor()}</Text>
      <Boton texto="Cambiar contraseña" variante="oscuro" alPresionar={() => setCambiando(true)} />
      <Boton texto="Cerrar sesión" variante="fantasma" alPresionar={salir} />
      {cambiando && (
        <Hoja titulo="Cambiar contraseña" cerrar={() => setCambiando(false)}>
          <FormularioClave alTerminar={() => setCambiando(false)} />
        </Hoja>
      )}
    </Pantalla>
  );
}
