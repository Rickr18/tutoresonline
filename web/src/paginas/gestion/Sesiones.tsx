import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Checkbox, Flex, Input, Select, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, consulta, type EstadoSesion, type SesionListaEquipo } from '../../api';
import { Cabecera, cuando } from '../../comunes';
import { Alerta, Insignia, mensajeDe } from '../../ui';
import { dinero, duracion, ESTADO_CASO, ESTADO_SESION } from '../../formato';

const columnas: ColumnsType<SesionListaEquipo> = [
  { title: '#', dataIndex: 'id', className: 'nums', render: (v: number) => <Typography.Text type="secondary">{v}</Typography.Text> },
  {
    title: 'Materia', key: 'materia',
    render: (_, s) => <><b>{s.materia.nombre}</b><br /><Typography.Text type="secondary" style={{ fontSize: 13 }}>{s.tipo === 'BAJO_DEMANDA' ? 'Bajo demanda' : 'Programada'} · {duracion(s.duracionMin)}</Typography.Text></>,
  },
  { title: 'Estudiante', key: 'est', render: (_, s) => s.estudiante.nombre },
  { title: 'Tutor', key: 'tut', render: (_, s) => s.tutor?.nombre ?? <Typography.Text type="secondary">Sin asignar</Typography.Text> },
  { title: 'Cuándo', key: 'cuando', render: (_, s) => cuando(s) },
  { title: 'Valor', dataIndex: 'precio', align: 'right', className: 'nums', render: (v: number | null) => dinero(v) },
  { title: 'Estado', key: 'estado', render: (_, s) => <Insignia tono={ESTADO_SESION[s.estado].tono}>{ESTADO_SESION[s.estado].texto}</Insignia> },
  {
    title: 'Caso', key: 'caso',
    render: (_, s) => (s.disputaId && s.estadoDisputa ? <Insignia tono={ESTADO_CASO[s.estadoDisputa].tono}>#{s.disputaId}</Insignia> : <Typography.Text type="secondary">—</Typography.Text>),
  },
];

export default function SesionesEquipo() {
  const ir = useNavigate();
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [conCaso, setConCaso] = useState(false);
  const sesiones = useQuery({
    queryKey: ['gestion', 'sesiones', q, estado],
    queryFn: () => api<SesionListaEquipo[]>(`/gestion/sesiones${consulta({ q, estado })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
  const lista = (sesiones.data ?? []).filter((s) => (!tipo || s.tipo === tipo) && (!conCaso || s.disputaId));

  return (
    <>
      <Cabecera titulo="Sesiones" detalle="Todas las reservas y solicitudes inmediatas. Abre una para ver qué pasó, con la hora exacta de cada paso." />
      <Flex gap={12} wrap align="center" style={{ marginBottom: 16 }}>
        <Input.Search placeholder="Número, estudiante, tutor o materia" allowClear value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar sesión" style={{ maxWidth: 320 }} />
        <Select value={estado} onChange={setEstado} aria-label="Estado" style={{ width: 210 }}
          options={[{ value: '', label: 'Todos los estados' }, ...(Object.keys(ESTADO_SESION) as EstadoSesion[]).map((e) => ({ value: e, label: ESTADO_SESION[e].texto }))]} />
        <Select value={tipo} onChange={setTipo} aria-label="Tipo" style={{ width: 240 }}
          options={[{ value: '', label: 'Programadas y bajo demanda' }, { value: 'PROGRAMADA', label: 'Programadas' }, { value: 'BAJO_DEMANDA', label: 'Bajo demanda' }]} />
        <Checkbox checked={conCaso} onChange={(e) => setConCaso(e.target.checked)}>Solo con caso de soporte</Checkbox>
        <Typography.Text type="secondary">{lista.length} sesiones</Typography.Text>
      </Flex>
      {sesiones.isError && <Alerta>{mensajeDe(sesiones.error)}</Alerta>}
      <Table rowKey="id" columns={columnas} dataSource={lista} loading={sesiones.isPending} size="middle" scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 25, hideOnSinglePage: true }} locale={{ emptyText: 'No hay sesiones con estos filtros' }}
        rowClassName={() => 'fila-clic'}
        onRow={(s) => ({
          onClick: () => ir(`/gestion/sesiones/${s.id}`), tabIndex: 0,
          onKeyDown: (ev) => { if (ev.key === 'Enter') ir(`/gestion/sesiones/${s.id}`); },
        })} />
    </>
  );
}
