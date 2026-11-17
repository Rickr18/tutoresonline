import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Card, Checkbox, Drawer, Flex, Input, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, consulta, type EstadoSesion, type SesionListaEquipo } from '../../api';
import { Cabecera, cuando } from '../../comunes';
import { Alerta, Insignia, Kpi, Kpis, mensajeDe, Tabla } from '../../ui';
import { dinero, duracion, ESTADO_CASO, ESTADO_SESION } from '../../formato';
import { DetalleSesionEquipo } from './Sesion';

const sub = (texto: string) => <><br /><Typography.Text type="secondary" style={{ fontSize: 13 }}>{texto}</Typography.Text></>;

const columnas: ColumnsType<SesionListaEquipo> = [
  { title: '#', dataIndex: 'id', className: 'nums', width: 56, render: (v: number) => <Typography.Text type="secondary">{v}</Typography.Text> },
  {
    title: 'Sesión', key: 'materia',
    render: (_, s) => <><b>{s.materia.nombre}</b>{sub(`${s.tipo === 'BAJO_DEMANDA' ? 'Bajo demanda' : 'Programada'} · ${duracion(s.duracionMin)}`)}</>,
  },
  {
    title: 'Personas', key: 'personas',
    render: (_, s) => <>{s.estudiante.nombre}{sub(`con ${s.tutor?.nombre ?? 'tutor sin asignar'}`)}</>,
  },
  { title: 'Cuándo', key: 'cuando', render: (_, s) => cuando(s) },
  { title: 'Valor', dataIndex: 'precio', align: 'right', className: 'nums', render: (v: number | null) => dinero(v) },
  {
    title: 'Estado', key: 'estado',
    render: (_, s) => (
      <Flex gap={6} wrap align="center">
        <Insignia tono={ESTADO_SESION[s.estado].tono}>{ESTADO_SESION[s.estado].texto}</Insignia>
        {s.disputaId && s.estadoDisputa && <Insignia tono={ESTADO_CASO[s.estadoDisputa].tono}>Caso #{s.disputaId}</Insignia>}
      </Flex>
    ),
  },
];

const ESPERANDO: EstadoSesion[] = ['PENDIENTE_ACEPTACION', 'BUSCANDO_TUTOR'];

export default function SesionesEquipo() {
  const ir = useNavigate();
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [conCaso, setConCaso] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const sesiones = useQuery({
    queryKey: ['gestion', 'sesiones', q, estado],
    queryFn: () => api<SesionListaEquipo[]>(`/gestion/sesiones${consulta({ q, estado })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
  const lista = (sesiones.data ?? []).filter((s) => (!tipo || s.tipo === tipo) && (!conCaso || s.disputaId));
  const n = (v: number) => (sesiones.isPending ? '—' : v);
  const enCurso = lista.filter((s) => s.estado === 'EN_CURSO').length;
  const esperando = lista.filter((s) => ESPERANDO.includes(s.estado)).length;
  const casosAbiertos = lista.filter((s) => s.disputaId && s.estadoDisputa !== 'RESUELTA').length;

  return (
    <>
      <Cabecera titulo="Sesiones" detalle="Todas las reservas y solicitudes inmediatas. Abre una para ver qué pasó, con la hora exacta de cada paso." />
      <Kpis>
        <Kpi etiqueta="En curso" valor={n(enCurso)} nota="ahora mismo" fuerte />
        <Kpi etiqueta="Esperando tutor" valor={n(esperando)} nota="reservas y solicitudes" />
        <Kpi etiqueta="Con caso abierto" valor={n(casosAbiertos)} nota="pago congelado" />
        <Kpi etiqueta="Sesiones" valor={n(lista.length)} nota="con estos filtros" />
      </Kpis>
      <Card size="small" style={{ margin: '16px 0' }}>
        <Flex gap={12} wrap align="center">
          <Input.Search placeholder="Número, estudiante, tutor o materia" allowClear value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar sesión" style={{ maxWidth: 320 }} />
          <Select value={estado} onChange={setEstado} aria-label="Estado" style={{ width: 210 }}
            options={[{ value: '', label: 'Todos los estados' }, ...(Object.keys(ESTADO_SESION) as EstadoSesion[]).map((e) => ({ value: e, label: ESTADO_SESION[e].texto }))]} />
          <Select value={tipo} onChange={setTipo} aria-label="Tipo" style={{ width: 240 }}
            options={[{ value: '', label: 'Programadas y bajo demanda' }, { value: 'PROGRAMADA', label: 'Programadas' }, { value: 'BAJO_DEMANDA', label: 'Bajo demanda' }]} />
          <Checkbox checked={conCaso} onChange={(e) => setConCaso(e.target.checked)}>Solo con caso de soporte</Checkbox>
          <Typography.Text type="secondary" style={{ marginLeft: 'auto' }}>{sesiones.isPending ? '' : `${lista.length} sesiones`}</Typography.Text>
        </Flex>
      </Card>
      {sesiones.isError && <Alerta>{mensajeDe(sesiones.error)}</Alerta>}
      <Tabla rowKey="id" columns={columnas} dataSource={lista} cargando={sesiones.isPending} size="middle" scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 25, hideOnSinglePage: true }} locale={{ emptyText: 'No hay sesiones con estos filtros' }}
        rowClassName={() => 'fila-clic'}
        onRow={(s) => ({
          onClick: () => setAbierta(s.id), tabIndex: 0,
          onKeyDown: (ev) => { if (ev.key === 'Enter') setAbierta(s.id); },
        })} />

      <Drawer open={abierta !== null} onClose={() => setAbierta(null)} size={560} title={abierta ? `Sesión #${abierta}` : ''}
        extra={<Button size="small" onClick={() => ir(`/gestion/sesiones/${abierta}`)}>Abrir en página</Button>} destroyOnHidden>
        {abierta !== null && <DetalleSesionEquipo id={abierta} una />}
      </Drawer>
    </>
  );
}
