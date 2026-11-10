import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Sesion, type Tutor as TTutor } from '../api';
import { Pantalla } from '../comunes';
import { useNav } from '../nav';
import { useSesion } from '../sesion';
import { Alerta, Avatar, Boton, Campo, Cargando, DatosLista, Estrellas, FormularioPago, Hoja, Opciones, Segmentos, mensajeDe, type DatosPago } from '../ui';
import { C, e } from '../tema';
import { claveDia, DIAS, dinero, duracion, fecha, fechaLarga, haceCuanto, hora, horaDelDia, MODALIDAD } from '../formato';

function Reserva({ tutor, inicio, cerrar }: { tutor: TTutor; inicio: string; cerrar: () => void }) {
  const nav = useNav();
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const [materiaId, setMateriaId] = useState(tutor.materias[0]?.id ?? 0);
  const [duracionMin, setDuracionMin] = useState(60);
  const [modalidad, setModalidad] = useState<'VIRTUAL' | 'PRESENCIAL'>(tutor.modalidad === 'PRESENCIAL' ? 'PRESENCIAL' : 'VIRTUAL');
  const [tema, setTema] = useState('');
  const [pago, setPago] = useState<DatosPago>({ metodo: 'TARJETA', numero: '' });
  const total = Math.round((tutor.tarifaHora * duracionMin) / 60);

  const reservar = useMutation({
    mutationFn: () => api<Sesion>('/sesiones', { tutorId: tutor.id, materiaId, inicio, duracionMin, modalidad, tema: tema.trim(), pago }),
    onSuccess: (s) => {
      cola.invalidateQueries({ queryKey: ['sesiones'] });
      cola.invalidateQueries({ queryKey: ['franjas'] });
      avisar('Reserva enviada', 'bien', `${tutor.nombre} tiene 12 horas para aceptarla.`);
      cerrar();
      nav.reemplazar({ nombre: 'sesion', id: s.id });
    },
  });

  return (
    <Hoja titulo="Reservar sesión" cerrar={cerrar}>
      <View>
        <Text style={e.negrita}>{fechaLarga(inicio)}, {hora(inicio)}</Text>
        <Text style={e.tenue}>con {tutor.nombre}</Text>
      </View>
      <Opciones etiqueta="Materia" valor={materiaId} cambiar={setMateriaId} opciones={tutor.materias.map((m) => ({ valor: m.id, texto: m.nombre }))} />
      <Segmentos etiqueta="Duración" valor={duracionMin} cambiar={setDuracionMin} opciones={[60, 90, 120].map((d) => ({ valor: d, texto: duracion(d) }))} />
      {tutor.modalidad === 'AMBAS' && (
        <Segmentos etiqueta="Modalidad" valor={modalidad} cambiar={setModalidad}
          opciones={[{ valor: 'VIRTUAL', texto: 'Virtual' }, { valor: 'PRESENCIAL', texto: 'Presencial' }]} />
      )}
      <Campo etiqueta="Tema que quieres trabajar" value={tema} onChangeText={setTema} multiline maxLength={200}
        placeholder="Por ejemplo: derivadas por regla de la cadena" />
      <FormularioPago valor={pago} cambiar={setPago} />
      <DatosLista filas={[
        { dt: `${dinero(tutor.tarifaHora)} por hora × ${duracion(duracionMin)}`, dd: dinero(total) },
        { dt: 'Total a pagar', dd: dinero(total), total: true },
      ]} />
      <Text style={e.pequeno}>El pago queda retenido. Si el tutor no acepta en 12 horas o rechaza, se te devuelve completo.</Text>
      {reservar.isError && <Alerta>{mensajeDe(reservar.error)}</Alerta>}
      <Boton texto={`Pagar ${dinero(total)} y reservar`} cargando={reservar.isPending} alPresionar={() => reservar.mutate()} />
    </Hoja>
  );
}

export default function Tutor({ id }: { id: number }) {
  const tutor = useQuery({ queryKey: ['tutor', id], queryFn: () => api<TTutor>(`/tutores/${id}`) });
  const franjas = useQuery({ queryKey: ['franjas', id], queryFn: () => api<string[]>(`/tutores/${id}/franjas`), refetchInterval: 60_000 });
  const [dia, setDia] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const grupos = new Map<string, string[]>();
    for (const f of franjas.data ?? []) grupos.set(claveDia(f), [...(grupos.get(claveDia(f)) ?? []), f]);
    return [...grupos.entries()];
  }, [franjas.data]);
  const diaActivo = porDia.find(([c]) => c === dia) ?? porDia[0];

  if (tutor.isPending) return <Pantalla titulo="Tutor" atras><Cargando /></Pantalla>;
  if (tutor.isError) return <Pantalla titulo="Tutor" atras><Alerta>{mensajeDe(tutor.error)}</Alerta></Pantalla>;
  const t = tutor.data;
  const horario = DIAS.map((nombre, i) => ({ nombre, bloques: (t.disponibilidad ?? []).filter((b) => b.diaSemana === i) })).filter((d) => d.bloques.length);

  return (
    <>
      <Pantalla titulo={t.nombre} atras refrescando={franjas.isRefetching} alRefrescar={() => { tutor.refetch(); franjas.refetch(); }}>
        <View style={e.tarjeta}>
          <View style={e.fila}>
            <Avatar nombre={t.nombre} enLinea={t.enLinea} grande />
            <View style={{ flex: 1, gap: 3 }}>
              <Estrellas valor={t.calificacion} total={t.totalCalificaciones} />
              <Text style={e.pequeno}>{t.sesionesRealizadas} sesiones · {t.ciudad}</Text>
              <Text style={e.pequeno}>{MODALIDAD[t.modalidad]}{t.enLinea ? ' · En línea' : ''}</Text>
            </View>
          </View>
          <Text style={e.texto}>{t.bio}</Text>
          <View style={e.chips}>{t.materias.map((m) => <View key={m.id} style={e.chip}><Text style={e.chipTexto}>{m.nombre}</Text></View>)}</View>
        </View>

        <View style={e.tarjeta}>
          <View style={e.entre}>
            <Text style={e.h2}>Reservar</Text>
            <Text><Text style={{ fontWeight: '800', fontSize: 17, color: C.tinta }}>{dinero(t.tarifaHora)}</Text><Text style={e.pequeno}> por hora</Text></Text>
          </View>
          {franjas.isPending && <Cargando texto="Consultando la agenda…" />}
          {franjas.isError && <Alerta>{mensajeDe(franjas.error)}</Alerta>}
          {franjas.data && porDia.length === 0 && <Text style={e.tenue}>No tiene horas libres en los próximos 7 días.</Text>}
          {diaActivo && (
            <>
              <Opciones valor={diaActivo[0]} cambiar={setDia} opciones={porDia.map(([c, l]) => ({ valor: c, texto: fecha(l[0]) }))} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {diaActivo[1].map((f) => (
                  <Pressable key={f} onPress={() => setElegida(f)} accessibilityRole="button"
                    style={({ pressed }) => ({ width: '31%', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: pressed ? C.ambar : '#cfd6e1', alignItems: 'center', backgroundColor: pressed ? '#fff8ec' : '#fff' })}>
                    <Text style={{ fontWeight: '700', color: C.tinta, fontSize: 14 }}>{hora(f)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={e.pequeno}>Hora de Colombia. Toca una hora para continuar.</Text>
            </>
          )}
        </View>

        {horario.length > 0 && (
          <View style={e.tarjeta}>
            <Text style={e.h2}>Horario habitual</Text>
            {horario.map((d) => (
              <View key={d.nombre} style={e.entre}>
                <Text style={e.texto}>{d.nombre}</Text>
                <Text style={e.tenue}>{d.bloques.map((b) => `${horaDelDia(b.horaInicio)} a ${horaDelDia(b.horaFin)}`).join(' · ')}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={e.tarjeta}>
          <Text style={e.h2}>Reseñas</Text>
          {(t.resenas ?? []).length === 0 ? <Text style={e.tenue}>Aún no tiene reseñas publicadas.</Text> : t.resenas!.slice(0, 8).map((r, i) => (
            <View key={i} style={[{ gap: 2 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.linea, paddingTop: 10 }]}>
              <View style={e.entre}><Text style={e.negrita}>{r.autor}</Text><Text style={e.pequeno}>{haceCuanto(r.fecha)}</Text></View>
              <Estrellas valor={r.puntaje} />
              {r.comentario && <Text style={e.tenue}>{r.comentario}</Text>}
            </View>
          ))}
        </View>
      </Pantalla>
      {elegida && <Reserva tutor={t} inicio={elegida} cerrar={() => setElegida(null)} />}
    </>
  );
}
