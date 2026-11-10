import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, Flex, Table, Tabs, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, type Caso } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera } from '../../comunes';
import { Alerta, Insignia, mensajeDe } from '../../ui';
import { DECISION, dinero, ESTADO_CASO, haceCuanto, ROL_TEXTO } from '../../formato';

type Vista = 'sin-asignar' | 'mios' | 'escalados' | 'abiertos' | 'resueltos';

const HORA = 3_600_000;
const sub = (texto: React.ReactNode) => <><br /><Typography.Text type="secondary" style={{ fontSize: 13 }}>{texto}</Typography.Text></>;

export default function Casos() {
  const { usuario } = useSesion();
  const ir = useNavigate();
  const esAdmin = usuario?.rol === 'ADMIN';
  const casos = useQuery({ queryKey: ['gestion', 'casos'], queryFn: () => api<Caso[]>('/gestion/disputas'), refetchInterval: 15_000 });
  const lista = casos.data ?? [];

  const filtros: Record<Vista, { texto: string; filtro: (c: Caso) => boolean }> = {
    'sin-asignar': { texto: 'Sin asignar', filtro: (c) => c.estado === 'ABIERTA' },
    mios: { texto: 'Mis casos', filtro: (c) => c.estado !== 'RESUELTA' && c.asignado?.id === usuario?.id },
    escalados: { texto: 'Escalados', filtro: (c) => c.estado === 'ESCALADA' },
    abiertos: { texto: 'Todos los abiertos', filtro: (c) => c.estado !== 'RESUELTA' },
    resueltos: { texto: 'Resueltos', filtro: (c) => c.estado === 'RESUELTA' },
  };
  const inicial: Vista = esAdmin ? 'escalados' : 'sin-asignar';
  const [vista, setVista] = useState<Vista | null>(null);
  const activa: Vista = vista ?? (lista.some(filtros[inicial].filtro) ? inicial : 'abiertos');
  const visibles = lista.filter(filtros[activa].filtro)
    .sort((a, b) => (activa === 'resueltos' ? Date.parse(b.resueltaEn ?? '') - Date.parse(a.resueltaEn ?? '') : Date.parse(a.creadoEn) - Date.parse(b.creadoEn)));
  const vencidos = lista.filter((c) => c.estado === 'ABIERTA' && Date.now() - Date.parse(c.creadoEn) > 12 * HORA).length;

  const columnas: ColumnsType<Caso> = [
    { title: 'Caso', key: 'caso', render: (_, c) => <><b>#{c.id}</b><br /><Insignia tono={ESTADO_CASO[c.estado].tono}>{ESTADO_CASO[c.estado].texto}</Insignia></> },
    { title: 'Sesión', key: 'sesion', render: (_, c) => <>{c.materia}{sub(`Sesión #${c.sesionId}`)}</> },
    { title: 'Partes', key: 'partes', render: (_, c) => <>{c.estudiante.nombre}{sub(`con ${c.tutor.nombre}`)}</> },
    { title: 'Monto', dataIndex: 'monto', align: 'right', className: 'nums', render: (v: number) => dinero(v) },
    {
      title: 'Responsable', key: 'asignado',
      render: (_, c) => (c.asignado ? <>{c.asignado.nombre}{sub(ROL_TEXTO[c.asignado.rol ?? 'SOPORTE'])}</> : <Typography.Text type="secondary">Nadie</Typography.Text>),
    },
    { title: 'Tutor', key: 'tutor', render: (_, c) => (c.tutorRespondio ? <Insignia tono="bien">Respondió</Insignia> : <Insignia tono="neutro">Sin respuesta</Insignia>) },
    {
      title: activa === 'resueltos' ? 'Decisión' : 'Abierto', key: 'tiempo',
      render: (_, c) => (activa === 'resueltos' && c.decision
        ? <>{DECISION[c.decision].corto}{sub(c.resueltaPor?.nombre)}</>
        : <>
          <Typography.Text type={(Date.now() - Date.parse(c.creadoEn)) / HORA > 12 && c.estado === 'ABIERTA' ? 'danger' : undefined}>{haceCuanto(c.creadoEn)}</Typography.Text>
          {sub(`último movimiento ${haceCuanto(c.ultimaActividad)}`)}
        </>),
    },
  ];

  return (
    <>
      <Cabecera titulo="Casos de soporte"
        detalle={esAdmin
          ? 'Supervisas todos los casos. Los escalados por soporte esperan tu decisión.'
          : 'Disputas abiertas por estudiantes. Toma un caso, habla con cada parte por separado y resuélvelo o escálalo a administración.'} />

      {vencidos > 0 && <Alerta tono="espera">{vencidos} {vencidos === 1 ? 'caso lleva' : 'casos llevan'} más de 12 horas sin que nadie lo tome.</Alerta>}

      <Tabs activeKey={activa} onChange={(k) => setVista(k as Vista)} style={{ marginTop: 8 }}
        items={(Object.keys(filtros) as Vista[]).map((v) => ({
          key: v,
          label: <Flex gap={8} align="center">{filtros[v].texto}<Badge count={lista.filter(filtros[v].filtro).length} showZero color="#e9edf3" style={{ color: '#4a5567' }} /></Flex>,
        }))} />

      {casos.isError && <Alerta>{mensajeDe(casos.error)}</Alerta>}
      <Table rowKey="id" columns={columnas} dataSource={visibles} loading={casos.isPending} size="middle" scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }} locale={{ emptyText: 'No hay casos en esta bandeja' }}
        rowClassName={() => 'fila-clic'}
        onRow={(c) => ({
          onClick: () => ir(`/casos/${c.id}`), tabIndex: 0,
          onKeyDown: (ev) => { if (ev.key === 'Enter') ir(`/casos/${c.id}`); },
        })} />
    </>
  );
}
