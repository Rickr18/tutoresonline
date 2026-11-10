/* Caso de soporte visto por el estudiante o el tutor, historial de la sesión y enlaces a salas que dejan constancia. */

import { useState, type ReactNode } from 'react';
import { Image, Linking, Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, subirFoto, urlAdjunto, type Evento, type Mensaje, type Sesion } from './api';
import { Alerta, Boton, Cargando, Insignia, mensajeDe } from './ui';
import { C, e } from './tema';
import { DECISION, ESTADO_CASO, fecha, haceCuanto, horaExacta, ROL_TEXTO, tamanoArchivo } from './formato';

/** Abre la sala de Jitsi y deja constancia en el historial de que la persona entró. */
export async function abrirSala(sesionId: number, cual: 'CLASE' | 'MEDIACION', enlace: string) {
  api(`/sesiones/${sesionId}/sala`, { cual }).catch(() => undefined);
  await Linking.openURL(enlace);
}

/* ---------- Historial ---------- */

const COLOR: Record<string, string> = {
  bien: C.verde, alerta: C.rojo, dinero: '#b07a12', soporte: '#5a4fb0', sala: '#1d4c9a', inicio: C.marino, neutro: '#8a96a8',
};
const GRUPO: Record<string, string> = {
  SESION_CREADA: 'inicio', TUTORES_AVISADOS: 'inicio', ACEPTADA: 'bien', PAGO_COBRADO: 'dinero', PAGO_LIBERADO: 'dinero',
  PAGO_REEMBOLSADO: 'dinero', PAGO_REEMBOLSO_PARCIAL: 'dinero', SIN_REEMBOLSO: 'dinero', SALA_ABIERTA: 'sala',
  SALA_MEDIACION_ABIERTA: 'sala', SALA_MEDIACION_CREADA: 'soporte', INICIADA: 'bien', FINALIZADA: 'bien', CIERRE_AUTOMATICO: 'alerta',
  CALIFICADA: 'neutro', CALIFICACIONES_PUBLICADAS: 'neutro', DISPUTA_ABIERTA: 'alerta', DESCARGO: 'soporte', PRUEBA_ADJUNTA: 'soporte',
  CASO_TOMADO: 'soporte', CASO_ESCALADO: 'alerta', CASO_RESUELTO: 'soporte', CANCELADA: 'alerta', RECHAZADA: 'alerta',
  VENCIDA: 'alerta', NO_REALIZADA: 'alerta', SIN_TUTOR: 'alerta', SOLICITUD_DESCARTADA: 'neutro', RECORDATORIO: 'inicio',
};

export function Historial({ sesionId }: { sesionId: number }) {
  const [abierto, setAbierto] = useState(false);
  const historial = useQuery({ queryKey: ['historial', sesionId], queryFn: () => api<Evento[]>(`/sesiones/${sesionId}/historial`), enabled: abierto });
  let diaAnterior = '';
  return (
    <View style={e.tarjeta}>
      <Pressable onPress={() => setAbierto(!abierto)} accessibilityRole="button" style={e.entre}>
        <Text style={e.h2}>Historial de la sesión</Text>
        <Text style={{ color: C.marino, fontWeight: '700' }}>{abierto ? 'Ocultar ▲' : 'Ver ▼'}</Text>
      </Pressable>
      {!abierto && <Text style={e.pequeno}>Cada paso de la sesión con su hora exacta: reserva, pago, entrada a la sala, inicio, cierre y casos.</Text>}
      {abierto && historial.isPending && <Cargando />}
      {abierto && historial.isError && <Alerta>{mensajeDe(historial.error)}</Alerta>}
      {abierto && historial.data?.map((ev) => {
        const dia = fecha(ev.fecha);
        const separador = dia !== diaAnterior;
        diaAnterior = dia;
        return (
          <View key={ev.id}>
            {separador && <Text style={[e.pequeno, { fontWeight: '700', marginTop: 4 }]}>{dia}</Text>}
            <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: COLOR[GRUPO[ev.tipo] ?? 'neutro'] }} />
              <View style={{ flex: 1 }}>
                <Text style={[e.pequeno, { fontVariant: ['tabular-nums'] }]}>{horaExacta(ev.fecha)}</Text>
                <Text style={[e.texto, { fontSize: 14 }]}>{ev.texto}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ---------- Conversación ---------- */

function Burbuja({ m }: { m: Mensaje }) {
  const equipo = m.autor.rol === 'SOPORTE' || m.autor.rol === 'ADMIN';
  const nombre = m.mio ? 'Tú' : equipo ? `${m.autor.nombre} · Soporte` : `${m.autor.nombre} · ${ROL_TEXTO[m.autor.rol]}`;
  return (
    <View style={{
      alignSelf: m.mio ? 'flex-end' : 'flex-start', maxWidth: '88%', borderRadius: 12, padding: 10, gap: 4,
      backgroundColor: m.mio ? '#fff3dc' : equipo ? '#eef3fb' : C.gris,
    }}>
      <Text style={e.pequeno}>{nombre} · {fecha(m.fecha)}, {horaExacta(m.fecha)}</Text>
      {!!m.texto && <Text style={[e.texto, { fontSize: 14.5 }]}>{m.texto}</Text>}
      {m.adjunto && (
        <Pressable onPress={() => Linking.openURL(urlAdjunto(m.adjunto!.id))} accessibilityRole="link" accessibilityLabel={`Abrir ${m.adjunto.nombre}`}>
          {m.adjunto.tipo.startsWith('image/')
            ? <Image source={{ uri: urlAdjunto(m.adjunto.id) }} style={{ width: 200, height: 150, borderRadius: 8, backgroundColor: '#dfe6f1' }} resizeMode="cover" />
            : <Text style={{ color: C.marino, fontWeight: '700' }}>PDF</Text>}
          <Text style={e.pequeno}>{m.adjunto.nombre} · {tamanoArchivo(m.adjunto.tamano)}</Text>
        </Pressable>
      )}
    </View>
  );
}

type Foto = { base64: string; uri: string; nombre: string };

function Redactar({ sesionId, placeholder, alEnviar }: { sesionId: number; placeholder: string; alEnviar: (m: Mensaje[]) => void }) {
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<Foto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (camara: boolean) => {
    setError(null);
    try {
      const permiso = camara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) { setError(camara ? 'Sin permiso para usar la cámara.' : 'Sin permiso para ver tus fotos.'); return; }
      const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true };
      const r = camara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
      const a = r.canceled ? null : r.assets[0];
      if (!a?.base64) return;
      const base = (a.fileName ?? `prueba-${sesionId}-${Date.now()}`).replace(/\.[^.]+$/, '');
      setFoto({ base64: a.base64, uri: a.uri, nombre: `${base}.jpg` });
    } catch (err) {
      setError(mensajeDe(err));
    }
  };

  const enviar = async () => {
    if (!texto.trim() && !foto) return;
    setEnviando(true);
    setError(null);
    try {
      const adjunto = foto ? await subirFoto(foto.base64, foto.nombre) : null;
      const lista = await api<Mensaje[]>(`/sesiones/${sesionId}/disputa/mensajes`, { texto: texto.trim(), adjuntoId: adjunto?.id ?? null });
      alEnviar(lista);
      setTexto('');
      setFoto(null);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <TextInput style={[e.entrada, { minHeight: 70, textAlignVertical: 'top' }]} multiline maxLength={2000} value={texto} onChangeText={setTexto}
        placeholder={placeholder} placeholderTextColor="#9aa5b5" accessibilityLabel="Mensaje para soporte" />
      {foto && (
        <View style={[e.fila, { backgroundColor: C.gris, borderRadius: 10, padding: 8 }]}>
          <Image source={{ uri: foto.uri }} style={{ width: 56, height: 56, borderRadius: 6 }} />
          <Text style={[e.pequeno, { flex: 1 }]} numberOfLines={2}>{foto.nombre}</Text>
          <Pressable onPress={() => setFoto(null)} hitSlop={8} accessibilityRole="button"><Text style={{ color: C.rojo, fontWeight: '700' }}>Quitar</Text></Pressable>
        </View>
      )}
      {error && <Alerta>{error}</Alerta>}
      <View style={[e.fila, { flexWrap: 'wrap' }]}>
        <Boton texto="Tomar foto" variante="fantasma" chico alPresionar={() => elegir(true)} />
        <Boton texto="Galería" variante="fantasma" chico alPresionar={() => elegir(false)} />
        <View style={{ flex: 1 }} />
        <Boton texto="Enviar" chico cargando={enviando} deshabilitado={!texto.trim() && !foto} alPresionar={enviar} />
      </View>
      <Text style={e.pequeno}>Puedes adjuntar fotos de hasta 5 MB: capturas del chat de la sala, del cuaderno o del ejercicio.</Text>
    </View>
  );
}

/* ---------- El caso visto por una de las partes ---------- */

export function CasoDeLaSesion({ s, soyTutor }: { s: Sesion; soyTutor: boolean }) {
  const d = s.disputa!;
  const cola = useQueryClient();
  const mensajes = useQuery({ queryKey: ['caso-mensajes', s.id], queryFn: () => api<Mensaje[]>(`/sesiones/${s.id}/disputa/mensajes`) });
  const est = ESTADO_CASO[d.estado];
  const abierto = d.estado !== 'RESUELTA';

  let estadoTexto: ReactNode = d.asignado ? `Lo revisa ${d.asignado}, del equipo de soporte.` : 'Pronto alguien de soporte tomará el caso.';
  if (abierto) estadoTexto = `${estadoTexto} El pago queda congelado hasta que se resuelva.`;

  return (
    <View style={e.tarjeta}>
      <View style={e.entre}>
        <Text style={e.h2}>Caso de soporte #{d.id}</Text>
        <Insignia tono={est.tono} texto={d.estado === 'ESCALADA' ? 'En administración' : est.texto} />
      </View>
      <Text style={e.pequeno}>
        {soyTutor ? `${s.estudiante.nombre} abrió una disputa ${haceCuanto(d.creadoEn)}. ` : `Abriste esta disputa ${haceCuanto(d.creadoEn)}. `}
        {estadoTexto}
      </Text>
      <View style={{ borderLeftWidth: 3, borderLeftColor: C.ambar, paddingLeft: 10 }}>
        <Text style={[e.texto, { fontStyle: 'italic' }]}>{d.motivo}</Text>
      </View>

      {d.estado === 'RESUELTA' && d.decision && (
        <Alerta tono="bien" titulo={`Decisión: ${DECISION[d.decision].texto}`}>{d.resolucion}</Alerta>
      )}
      {d.sala && (
        <View style={{ gap: 8 }}>
          <Alerta tono="info" titulo={`Videollamada de mediación${d.salaCreadaEn ? `, abierta ${haceCuanto(d.salaCreadaEn)}` : ''}`}>
            Entran el estudiante, el tutor y la persona de soporte que lleva el caso.
          </Alerta>
          <Boton texto="Entrar a la videollamada" variante="oscuro" alPresionar={() => abrirSala(s.id, 'MEDIACION', d.sala!)} />
        </View>
      )}

      <Text style={[e.negrita, { marginTop: 4 }]}>Tu conversación con soporte</Text>
      <Text style={e.pequeno}>
        {soyTutor
          ? 'Presenta aquí tu versión y adjunta tus pruebas. El estudiante no ve esta conversación.'
          : 'Cuéntale a soporte lo que pasó y adjunta tus pruebas. El tutor no ve esta conversación.'}
      </Text>
      {mensajes.isPending && <Cargando />}
      {mensajes.isError && <Alerta>{mensajeDe(mensajes.error)}</Alerta>}
      {mensajes.data?.length === 0 && <Text style={e.tenue}>{soyTutor ? 'Todavía no has presentado tu versión.' : 'Todavía no hay mensajes.'}</Text>}
      <View style={{ gap: 8 }}>{mensajes.data?.map((m) => <Burbuja key={m.id} m={m} />)}</View>
      {abierto
        ? <Redactar sesionId={s.id} placeholder={soyTutor ? 'Escribe tu versión de lo que pasó' : 'Escribe a soporte'}
            alEnviar={(lista) => { cola.setQueryData(['caso-mensajes', s.id], lista); cola.invalidateQueries({ queryKey: ['historial', s.id] }); }} />
        : <Text style={e.pequeno}>El caso está cerrado; la conversación queda como registro.</Text>}
    </View>
  );
}
