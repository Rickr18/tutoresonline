import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, consulta, type Tutor } from '../api';
import { Pantalla, useMaterias } from '../comunes';
import { useNav } from '../nav';
import { Alerta, Avatar, Boton, Cargando, Estrellas, Opciones, Vacio, mensajeDe } from '../ui';
import { C, e } from '../tema';
import { dinero, MODALIDAD } from '../formato';

function TarjetaTutor({ t }: { t: Tutor }) {
  const nav = useNav();
  return (
    <Pressable onPress={() => nav.ir({ nombre: 'tutor', id: t.id })} accessibilityRole="button" accessibilityLabel={t.nombre}
      style={({ pressed }) => [e.tarjeta, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={e.fila}>
        <Avatar nombre={t.nombre} enLinea={t.enLinea} />
        <View style={{ flex: 1 }}>
          <Text style={e.negrita}>{t.nombre}</Text>
          <Text style={e.pequeno}>{t.ciudad} · {MODALIDAD[t.modalidad]}</Text>
        </View>
        <Estrellas valor={t.calificacion} total={t.totalCalificaciones} />
      </View>
      <Text style={e.tenue} numberOfLines={2}>{t.bio}</Text>
      <View style={e.chips}>{t.materias.map((m) => <View key={m.id} style={e.chip}><Text style={e.chipTexto}>{m.nombre}</Text></View>)}</View>
      <View style={[e.entre, { borderTopWidth: 1, borderTopColor: C.linea, paddingTop: 10 }]}>
        <Text><Text style={{ fontWeight: '800', fontSize: 17, color: C.tinta }}>{dinero(t.tarifaHora)}</Text><Text style={e.pequeno}> por hora</Text></Text>
        {t.enLinea ? <Text style={{ color: '#0f6557', fontWeight: '700', fontSize: 13 }}>● En línea</Text> : <Text style={e.pequeno}>{t.sesionesRealizadas} sesiones</Text>}
      </View>
    </Pressable>
  );
}

export default function Buscar() {
  const nav = useNav();
  const materias = useMaterias();
  const [q, setQ] = useState('');
  const [materia, setMateria] = useState<number | ''>('');
  const [enLinea, setEnLinea] = useState(false);
  const [orden, setOrden] = useState('');
  const filtros = { q: q.trim(), materia, enLinea, orden };
  const tutores = useQuery({
    queryKey: ['tutores', filtros],
    queryFn: () => api<Tutor[]>(`/tutores${consulta(filtros)}`),
    placeholderData: keepPreviousData,
  });

  return (
    <Pantalla titulo="Buscar tutor" detalle="Todos los tutores publicados están verificados." refrescando={tutores.isRefetching} alRefrescar={() => tutores.refetch()}>
      <Boton texto="Necesito un tutor ahora" alPresionar={() => nav.cambiarPestana('ahora')} />
      <TextInput style={e.entrada} placeholder="Nombre, materia o tema" placeholderTextColor="#9aa5b5" value={q} onChangeText={setQ}
        accessibilityLabel="Buscar" returnKeyType="search" />
      <Opciones valor={materia} cambiar={setMateria}
        opciones={[{ valor: '' as const, texto: 'Todas las materias' }, ...(materias.data ?? []).map((m) => ({ valor: m.id, texto: m.nombre }))]} />
      <View style={e.entre}>
        <View style={e.fila}>
          <Switch value={enLinea} onValueChange={setEnLinea} trackColor={{ true: C.verde }} accessibilityLabel="Solo en línea ahora" />
          <Text style={e.tenue}>Solo en línea</Text>
        </View>
        <Pressable onPress={() => setOrden(orden ? '' : 'precio')} accessibilityRole="button" hitSlop={6}>
          <Text style={{ color: C.marino, fontWeight: '700' }}>{orden ? 'Menor precio ▾' : 'Mejor calificados ▾'}</Text>
        </Pressable>
      </View>
      {tutores.isPending && <Cargando />}
      {tutores.isError && <Alerta>{mensajeDe(tutores.error)}</Alerta>}
      {tutores.data?.length === 0 && <Vacio titulo="Ningún tutor coincide">Prueba con otra materia o quita algún filtro.</Vacio>}
      {tutores.data && tutores.data.length > 0 && <Text style={e.pequeno}>{tutores.data.length} {tutores.data.length === 1 ? 'tutor' : 'tutores'}</Text>}
      {tutores.data?.map((t) => <TarjetaTutor key={t.id} t={t} />)}
    </Pantalla>
  );
}
