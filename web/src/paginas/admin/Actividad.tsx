import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Input, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, consulta, type EntradaAuditoria } from '../../api';
import { Cabecera } from '../../comunes';
import { BarraFiltros, Insignia, Vacio, mensajeDe, Tabla } from '../../ui';
import { HistoryOutlined } from '@ant-design/icons';
import { fechaHora } from '../../formato';

const ACCION: Record<string, { texto: string; color: string }> = {
  // color: tono de estado (tokens.ts) que se muestra en la insignia.
  CUENTA_CREADA: { texto: 'Cuenta creada', color: 'activo' },
  CUENTA_EDITADA: { texto: 'Cuenta editada', color: 'neutro' },
  PASSWORD_RESTABLECIDA: { texto: 'Contraseña', color: 'espera' },
  CUENTA_SUSPENDIDA: { texto: 'Suspensión', color: 'mal' },
  CUENTA_REACTIVADA: { texto: 'Reactivación', color: 'bien' },
  TUTOR_APROBADO: { texto: 'Tutor aprobado', color: 'bien' },
  TUTOR_RECHAZADO: { texto: 'Tutor rechazado', color: 'mal' },
  PAGO_LIBERADO: { texto: 'Pago', color: 'bien' },
  CASO_RESUELTO: { texto: 'Caso', color: 'activo' },
  MATERIA_CREADA: { texto: 'Materia', color: 'activo' },
  MATERIA_EDITADA: { texto: 'Materia', color: 'neutro' },
  EXPORTACION: { texto: 'Exportación', color: 'neutro' },
  SOLICITUD_APROBADA: { texto: 'Solicitud aprobada', color: 'bien' },
  SOLICITUD_RECHAZADA: { texto: 'Solicitud rechazada', color: 'mal' },
};

const columnas: ColumnsType<EntradaAuditoria> = [
  { title: 'Fecha', dataIndex: 'fecha', width: 150, render: (v: string) => <span className="nums" style={{ whiteSpace: 'nowrap' }}>{fechaHora(v)}</span> },
  {
    title: 'Administrador', key: 'actor', width: 180,
    render: (_, a) => (
      <>
        <Typography.Text strong>{a.actor.nombre}</Typography.Text>
        {a.actor.superior && <><br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>Principal</Typography.Text></>}
      </>
    ),
  },
  {
    title: 'Tipo', dataIndex: 'accion', width: 150,
    render: (v: string) => {
      const t = ACCION[v] ?? { texto: v, color: 'neutro' };
      return <Insignia tono={t.color}>{t.texto}</Insignia>;
    },
  },
  { title: 'Detalle', dataIndex: 'texto' },
];

export default function Actividad() {
  const [q, setQ] = useState('');
  const registro = useQuery({
    queryKey: ['admin', 'auditoria', q],
    queryFn: () => api<EntradaAuditoria[]>(`/admin/auditoria${consulta({ q })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  });

  return (
    <>
      <Cabecera titulo="Actividad" detalle="Lo que hace cada administrador queda registrado aquí con la hora exacta y no se puede borrar." />
      <BarraFiltros contador={registro.data ? `${registro.data.length} registros` : undefined}>
        <Input.Search placeholder="Buscar por administrador o detalle" allowClear value={q} onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 360 }} aria-label="Buscar" />
      </BarraFiltros>
      {registro.isError && <Alert type="error" showIcon title={mensajeDe(registro.error)} style={{ marginBottom: 16 }} />}
      <Tabla rowKey="id" columns={columnas} dataSource={registro.data ?? []} cargando={registro.isPending} size="middle"
        pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Vacio titulo="Sin actividad todavía" icono={<HistoryOutlined />}>Las acciones sobre usuarios, pagos, casos y materias aparecerán aquí.</Vacio> }} />
    </>
  );
}
