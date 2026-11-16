import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, consulta, type Sesion, type Tutor } from '../api';
import { Pantalla, useMaterias, useParametros } from '../comunes';
import { useNav } from '../nav';
import { Alerta, Boton, Campo, FormularioPago, Opciones, Reloj, Segmentos, mensajeDe, useCuentaAtras, type DatosPago } from '../ui';
import { C, e } from '../tema';
import { dinero, duracion } from '../formato';

const buscando = (s: Sesion) => s.tipo === 'BAJO_DEMANDA' && s.estado === 'BUSCANDO_TUTOR';

function Sello({ bien }: { bien: boolean }) {
  return (
    <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: bien ? '#dff3ef' : '#fbe6e3', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 32, fontWeight: '900', color: bien ? C.verde : C.rojo }}>{bien ? '✓' : '!'}</Text>
    </View>
  );
}

/** Búsqueda por turnos (P-06): cada tutor tiene su turno y la búsqueda completa tiene un límite. */
function Buscando({ s, alCancelar }: { s: Sesion; alCancelar: () => void }) {
  const cola = useQueryClient();
  const p = useParametros();
  const resta = useCuentaAtras(s.expiraEn);
  const b = s.busqueda;
  const cancelar = useMutation({
    mutationFn: () => api<Sesion>(`/sesiones/${s.id}/cancelar`, {}),
    onSuccess: () => { alCancelar(); cola.invalidateQueries({ queryKey: ['sesiones'] }); },
  });
  return (
    <View style={[e.tarjeta, { alignItems: 'center', paddingVertical: 28, gap: 14 }]}>
      {b?.turnoExpiraEn && <Reloj hasta={b.turnoExpiraEn} grande />}
      <Text style={[e.h2, { fontSize: 20, textAlign: 'center' }]}>{resta > 0 ? 'Buscando un tutor disponible' : 'Cerrando la búsqueda…'}</Text>
      <Text style={[e.tenue, { textAlign: 'center' }]}>
        {b ? `Le estamos ofreciendo tu solicitud de ${s.materia.nombre} al tutor ${b.candidato} de ${b.total}, en orden de calificación. ` : `Tu solicitud de ${s.materia.nombre} está en búsqueda. `}
        Cada tutor tiene {p.TURNO_DEMANDA_S} segundos. La búsqueda termina en {Math.floor(resta / 60)}:{String(resta % 60).padStart(2, '0')} min; si nadie acepta o cancelas, se libera la retención del pago.
      </Text>
      {cancelar.isError && <Alerta>{mensajeDe(cancelar.error)}</Alerta>}
      <Boton texto="Cancelar la solicitud" variante="fantasma" cargando={cancelar.isPending} alPresionar={() => cancelar.mutate()} />
    </View>
  );
}

export default function Ahora() {
  const nav = useNav();
  const p = useParametros();
  const cola = useQueryClient();
  const materias = useMaterias();
  const [materia, setMateria] = useState<number | ''>('');
  const [duracionMin, setDuracionMin] = useState(60);
  const [tema, setTema] = useState('');
  const [pago, setPago] = useState<DatosPago>({ metodo: 'TARJETA', numero: '' });
  const [ultima, setUltima] = useState<Sesion | null>(null);

  const sesiones = useQuery({
    queryKey: ['sesiones'],
    queryFn: () => api<Sesion[]>('/sesiones'),
    refetchInterval: (q) => (q.state.data?.some(buscando) ? 3000 : false),
  });
  const enLinea = useQuery({
    queryKey: ['tutores', { materia, enLinea: true }],
    queryFn: () => api<Tutor[]>(`/tutores${consulta({ materia, enLinea: true })}`),
    enabled: materia !== '',
    refetchInterval: 20_000,
  });
  const pedir = useMutation({
    mutationFn: () => api<Sesion>('/sesiones/demanda', { materiaId: materia, duracionMin, tema: tema.trim(), pago }),
    onSuccess: (s) => { setUltima(s); cola.invalidateQueries({ queryKey: ['sesiones'] }); },
  });

  const actual = ultima ? sesiones.data?.find((s) => s.id === ultima.id) ?? ultima : null;
  const abierta = sesiones.data?.find(buscando) ?? (actual && buscando(actual) ? actual : null);
  const tarifas = (enLinea.data ?? []).map((t) => t.tarifaHora);
  const costo = (n: number) => dinero(Math.round((n * duracionMin) / 60));

  let cuerpo;
  if (abierta) {
    cuerpo = <Buscando s={abierta} alCancelar={() => setUltima(null)} />;
  } else if (actual && ['CONFIRMADA', 'EN_CURSO', 'FINALIZADA'].includes(actual.estado)) {
    cuerpo = (
      <View style={[e.tarjeta, { alignItems: 'center', paddingVertical: 28, gap: 12 }]}>
        <Sello bien />
        <Text style={[e.h2, { fontSize: 20, textAlign: 'center' }]}>{actual.tutor?.nombre} aceptó tu solicitud</Text>
        <Text style={[e.tenue, { textAlign: 'center' }]}>El valor de la sesión es {dinero(actual.precio)} por {duracion(actual.duracionMin)} de {actual.materia.nombre}; la retención se ajustó a esa tarifa.</Text>
        <Boton texto="Ir a la sesión" alPresionar={() => nav.ir({ nombre: 'sesion', id: actual.id })} />
        <Boton texto="Pedir otra" variante="fantasma" chico alPresionar={() => setUltima(null)} />
      </View>
    );
  } else if (actual?.estado === 'SIN_TUTOR') {
    cuerpo = (
      <View style={[e.tarjeta, { alignItems: 'center', paddingVertical: 28, gap: 12 }]}>
        <Sello bien={false} />
        <Text style={[e.h2, { fontSize: 20, textAlign: 'center' }]}>Ningún tutor tomó la solicitud</Text>
        <Text style={[e.tenue, { textAlign: 'center' }]}>Ningún tutor de {actual.materia.nombre} aceptó a tiempo. Se liberó la retención: no se hizo ningún cobro. Puedes reservar una sesión programada.</Text>
        <Boton texto="Intentar de nuevo" alPresionar={() => setUltima(null)} />
        <Boton texto="Reservar con un tutor" variante="fantasma" chico alPresionar={() => nav.cambiarPestana('buscar')} />
      </View>
    );
  } else {
    cuerpo = (
      <View style={e.tarjeta}>
        <Opciones etiqueta="Materia" valor={materia} cambiar={setMateria}
          opciones={[{ valor: '' as const, texto: 'Elige una' }, ...(materias.data ?? []).map((m) => ({ valor: m.id, texto: m.nombre }))]} />
        {materia !== '' && enLinea.data && (
          <Text style={e.pequeno}>
            {enLinea.data.length === 0 ? 'Ahora mismo no hay tutores en línea para esta materia.'
              : `${enLinea.data.length} ${enLinea.data.length === 1 ? 'tutor en línea' : 'tutores en línea'} · ${Math.min(...tarifas) === Math.max(...tarifas) ? costo(tarifas[0]) : `${costo(Math.min(...tarifas))} a ${costo(Math.max(...tarifas))}`}`}
          </Text>
        )}
        <Segmentos etiqueta="Duración" valor={duracionMin} cambiar={setDuracionMin} opciones={[60, 90, 120].map((d) => ({ valor: d, texto: duracion(d) }))} />
        <Campo etiqueta="¿Con qué necesitas ayuda?" value={tema} onChangeText={setTema} multiline maxLength={200} ayuda={`${tema.trim().length} de 20 caracteres mínimo.`}
          placeholder="Por ejemplo: no entiendo cómo plantear este ejercicio" />
        <FormularioPago valor={pago} cambiar={setPago} />
        <Alerta tono="info" titulo="Cómo funciona">
          Antes de buscar se retiene el valor estimado. La solicitud se ofrece a los tutores en línea de la materia, uno por uno y en orden de calificación: cada uno tiene {p.TURNO_DEMANDA_S} segundos y la búsqueda dura máximo {p.BUSQUEDA_DEMANDA_MIN} minutos. Al aceptar, la retención se ajusta a la tarifa del tutor.
        </Alerta>
        {pedir.isError && <Alerta>{mensajeDe(pedir.error)}</Alerta>}
        <Boton texto="Buscar tutor ahora" cargando={pedir.isPending} deshabilitado={materia === ''} alPresionar={() => pedir.mutate()} />
      </View>
    );
  }

  return <Pantalla titulo="Tutor ahora" detalle="Para cuando la duda no puede esperar a una reserva.">{cuerpo}</Pantalla>;
}
