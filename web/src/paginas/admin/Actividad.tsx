import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Flex, Input, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, consulta, type EntradaAuditoria } from '../../api';
import { Cabecera } from '../../comunes';
import { mensajeDe } from '../../ui';
import { fechaHora } from '../../formato';

const ACCION: Record<string, { texto: string; color: string }> = {
  CUENTA_CREADA: { texto: 'Cuenta creada', color: 'blue' },
  CUENTA_EDITADA: { texto: 'Cuenta editada', color: 'default' },
  PASSWORD_RESTABLECIDA: { texto: 'Contraseña', color: 'gold' },
  CUENTA_SUSPENDIDA: { texto: 'Suspensión', color: 'red' },
  CUENTA_REACTIVADA: { texto: 'Reactivación', color: 'green' },
  TUTOR_APROBADO: { texto: 'Tutor aprobado', color: 'green' },
  TUTOR_RECHAZADO: { texto: 'Tutor rechazado', color: 'red' },
  PAGO_LIBERADO: { texto: 'Pago', color: 'green' },
  CASO_RESUELTO: { texto: 'Caso', color: 'blue' },
  MATERIA_CREADA: { texto: 'Materia', color: 'blue' },
  MATERIA_EDITADA: { texto: 'Materia', color: 'default' },
  EXPORTACION: { texto: 'Exportación', color: 'default' },
  SOLICITUD_APROBADA: { texto: 'Solicitud aprobada', color: 'green' },
  SOLICITUD_RECHAZADA: { texto: 'Solicitud rechazada', color: 'red' },
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
      const t = ACCION[v] ?? { texto: v, color: 'default' };
      return <Tag color={t.color}>{t.texto}</Tag>;
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
      <Flex gap={12} wrap align="center" style={{ marginBottom: 16 }}>
        <Input.Search placeholder="Buscar por administrador o detalle" allowClear value={q} onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 360 }} aria-label="Buscar" />
        {registro.data && <Typography.Text type="secondary">{registro.data.length} registros</Typography.Text>}
      </Flex>
      {registro.isError && <Alert type="error" showIcon title={mensajeDe(registro.error)} style={{ marginBottom: 16 }} />}
      <Table rowKey="id" columns={columnas} dataSource={registro.data ?? []} loading={registro.isPending} size="middle"
        pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Sin actividad todavía. Las acciones sobre usuarios, pagos, casos y materias aparecerán aquí.' }} />
    </>
  );
}
