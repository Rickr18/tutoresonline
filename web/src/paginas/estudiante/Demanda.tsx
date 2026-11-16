import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Result, Segmented, Select, Typography } from 'antd';
import { api, consulta, type Sesion, type Tutor } from '../../api';
import { Cabecera, useMaterias, useParametros } from '../../comunes';
import { Alerta, Campo, FormularioPago, Reloj, mensajeDe, useCuentaAtras, type DatosPago } from '../../ui';
import { dinero, duracion } from '../../formato';

const DURACIONES = [60, 90, 120];
const buscando = (s: Sesion) => s.tipo === 'BAJO_DEMANDA' && s.estado === 'BUSCANDO_TUTOR';

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
    <Card className="busqueda">
      <Result icon={b?.turnoExpiraEn ? <Reloj hasta={b.turnoExpiraEn} total={p.TURNO_DEMANDA_S} gigante /> : undefined}
        title={resta > 0 ? 'Buscando un tutor disponible' : 'Cerrando la búsqueda…'}
        subTitle={<>
          {b ? `Le estamos ofreciendo tu solicitud de ${s.materia.nombre} al tutor ${b.candidato} de ${b.total}, en orden de calificación. ` : `Tu solicitud de ${s.materia.nombre} está en búsqueda. `}
          Cada tutor tiene {p.TURNO_DEMANDA_S} segundos para aceptar; si no, pasa al siguiente.<br />
          La búsqueda termina en {Math.floor(resta / 60)}:{String(resta % 60).padStart(2, '0')} min. Si nadie acepta o cancelas, se libera la retención del pago.
        </>}
        extra={<>
          {cancelar.isError && <Alerta>{mensajeDe(cancelar.error)}</Alerta>}
          <Button loading={cancelar.isPending} onClick={() => cancelar.mutate()}>Cancelar la solicitud</Button>
        </>} />
    </Card>
  );
}

export default function Demanda() {
  const cola = useQueryClient();
  const p = useParametros();
  const ir = useNavigate();
  const materias = useMaterias();
  const [materia, setMateria] = useState('');
  const [faltaMateria, setFaltaMateria] = useState(false);
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
    mutationFn: () => api<Sesion>('/sesiones/demanda', { materiaId: Number(materia), duracionMin, tema: tema.trim(), pago }),
    onSuccess: (s) => { setUltima(s); cola.invalidateQueries({ queryKey: ['sesiones'] }); },
  });
  const enviar = () => {
    if (!materia) { setFaltaMateria(true); return; }
    pedir.mutate();
  };

  const actual = ultima ? sesiones.data?.find((s) => s.id === ultima.id) ?? ultima : null;
  const abierta = sesiones.data?.find(buscando) ?? (actual && buscando(actual) ? actual : null);
  const tarifas = (enLinea.data ?? []).map((t) => t.tarifaHora);
  const costo = (tarifa: number) => dinero(Math.round((tarifa * duracionMin) / 60));

  let cuerpo;
  if (abierta) {
    cuerpo = <Buscando s={abierta} alCancelar={() => setUltima(null)} />;
  } else if (actual && ['CONFIRMADA', 'EN_CURSO', 'FINALIZADA'].includes(actual.estado)) {
    cuerpo = (
      <Card className="busqueda">
        <Result status="success" title={`${actual.tutor?.nombre} aceptó tu solicitud`}
          subTitle={`El valor de la sesión es ${dinero(actual.precio)} por ${duracion(actual.duracionMin)} de ${actual.materia.nombre}; la retención se ajustó a esa tarifa. El pago queda retenido hasta ${p.GARANTIA_H} horas después de la sesión.`}
          extra={[
            <Button key="ir" type="primary" onClick={() => ir(`/sesiones/${actual.id}`)}>Ir a la sesión</Button>,
            <Button key="otra" onClick={() => setUltima(null)}>Pedir otra</Button>,
          ]} />
      </Card>
    );
  } else if (actual?.estado === 'SIN_TUTOR') {
    cuerpo = (
      <Card className="busqueda">
        <Result status="warning" title="Ningún tutor tomó la solicitud"
          subTitle={`Ningún tutor de ${actual.materia.nombre} aceptó a tiempo. Se liberó la retención: no se hizo ningún cobro. Puedes reservar una sesión programada.`}
          extra={[
            <Button key="otra" type="primary" onClick={() => setUltima(null)}>Intentar de nuevo</Button>,
            <Button key="buscar" onClick={() => ir(`/buscar?materia=${actual.materia.id}`)}>Reservar con un tutor</Button>,
          ]} />
      </Card>
    );
  } else {
    const ayudaMateria = faltaMateria && !materia ? 'Elige una materia.'
      : materia !== '' && enLinea.data ? (enLinea.data.length === 0
        ? 'Ahora mismo no hay tutores en línea para esta materia. Puedes enviar la solicitud, pero es probable que nadie la tome.'
        : `${enLinea.data.length} ${enLinea.data.length === 1 ? 'tutor en línea' : 'tutores en línea'} para esta materia.`) : undefined;
    cuerpo = (
      <Card>
        <Form layout="vertical" className="forma" onFinish={enviar}>
          <Campo etiqueta="Materia" id="demanda-materia" ayuda={ayudaMateria}>
            <Select id="demanda-materia" value={materia || undefined} placeholder="Elige una materia" status={faltaMateria && !materia ? 'error' : undefined}
              onChange={(v) => { setMateria(v); setFaltaMateria(false); }} style={{ width: '100%' }} showSearch={{ optionFilterProp: 'label' }}
              options={(materias.data ?? []).map((m) => ({ value: String(m.id), label: m.nombre }))} />
          </Campo>
          <Campo etiqueta="Duración">
            <Segmented block value={duracionMin} onChange={(v) => setDuracionMin(Number(v))}
              options={DURACIONES.map((d) => ({ value: d, label: duracion(d) }))} />
          </Campo>
          <Campo etiqueta="¿Con qué necesitas ayuda?" id="demanda-tema" ayuda="Al menos 20 caracteres, para que el tutor sepa si puede ayudarte.">
            <Input.TextArea id="demanda-tema" value={tema} onChange={(e) => setTema(e.target.value)} required minLength={20} maxLength={200} showCount autoSize={{ minRows: 2 }}
              placeholder="Por ejemplo: no entiendo cómo plantear este ejercicio de integrales por partes" />
          </Campo>
          <FormularioPago valor={pago} cambiar={setPago} />
          <Alert type="info" showIcon title="Cómo funciona" description={<>
            Antes de buscar se retiene el valor estimado de la sesión. La solicitud se ofrece a los tutores en línea de la materia, uno por uno
            y en orden de calificación: cada uno tiene {p.TURNO_DEMANDA_S} segundos y la búsqueda dura máximo {p.BUSQUEDA_DEMANDA_MIN} minutos. Cuando un tutor acepta,
            se abre la sala virtual y la retención se ajusta a su tarifa
            {tarifas.length > 0 && (Math.min(...tarifas) === Math.max(...tarifas)
              ? `: ${costo(tarifas[0])} por ${duracion(duracionMin)}`
              : `: entre ${costo(Math.min(...tarifas))} y ${costo(Math.max(...tarifas))} por ${duracion(duracionMin)}`)}.
          </>} />
          {pedir.isError && <Alerta>{mensajeDe(pedir.error)}</Alerta>}
          <Button type="primary" htmlType="submit" block size="large" loading={pedir.isPending}>{pedir.isPending ? 'Enviando…' : 'Buscar tutor ahora'}</Button>
        </Form>
      </Card>
    );
  }

  return (
    <div className="centro">
      <Cabecera titulo="Tutor ahora" detalle={<Typography.Text type="secondary">Para cuando la duda no puede esperar a una reserva.</Typography.Text>} />
      {cuerpo}
    </div>
  );
}
