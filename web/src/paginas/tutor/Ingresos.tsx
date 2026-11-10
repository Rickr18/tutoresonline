import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, type Ingresos as TIngresos } from '../../api';
import { Cabecera } from '../../comunes';
import { Alerta, Cargando, Insignia, Kpi, Kpis, mensajeDe } from '../../ui';
import { dinero, ESTADO_PAGO, fecha, fechaHora } from '../../formato';

type Movimiento = TIngresos['movimientos'][number];

const columnas: ColumnsType<Movimiento> = [
  { title: 'Fecha', dataIndex: 'fecha', render: (v: string) => fecha(v) },
  {
    title: 'Sesión', key: 'sesion',
    render: (_, m) => <><Link to={`/sesiones/${m.sesionId}`}>{m.materia}</Link><br /><Typography.Text type="secondary" style={{ fontSize: 13 }}>{m.estudiante}</Typography.Text></>,
  },
  { title: 'Valor', dataIndex: 'monto', align: 'right', className: 'nums', render: (v: number) => dinero(v) },
  { title: 'Comisión', dataIndex: 'comision', align: 'right', className: 'nums', render: (v: number) => `− ${dinero(v)}` },
  { title: 'Neto', dataIndex: 'netoTutor', align: 'right', className: 'nums', render: (v: number) => <b>{dinero(v)}</b> },
  {
    title: 'Estado', key: 'estado',
    render: (_, m) => {
      const e = ESTADO_PAGO[m.estado];
      return (
        <>
          <Insignia tono={e.tono}>{e.texto}</Insignia>
          {m.estado === 'RETENIDO' && m.liberarEn && <><br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>se libera {fechaHora(m.liberarEn).toLowerCase()}</Typography.Text></>}
        </>
      );
    },
  },
];

export default function Ingresos() {
  const ingresos = useQuery({ queryKey: ['ingresos'], queryFn: () => api<TIngresos>('/tutor/ingresos') });
  const d = ingresos.data;

  return (
    <>
      <Cabecera titulo="Ingresos" detalle="Cada pago queda retenido 48 horas después de la sesión y luego se libera a tu favor, descontada la comisión del 15 %." />
      {ingresos.isPending && <Cargando />}
      {ingresos.isError && <Alerta>{mensajeDe(ingresos.error)}</Alerta>}
      {d && (
        <>
          <Kpis>
            <Kpi fuerte etiqueta="Disponible" valor={dinero(d.disponible)} nota="pagos liberados" />
            <Kpi etiqueta="Por liberar" valor={dinero(d.porLiberar)} nota="retenidos por la plataforma" />
            <Kpi etiqueta="En disputa" valor={dinero(d.enDisputa)} nota="congelados hasta resolver" />
          </Kpis>
          <section className="seccion">
            <Typography.Title level={4}>Movimientos</Typography.Title>
            <Table rowKey="id" columns={columnas} dataSource={d.movimientos} size="middle" scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 20, hideOnSinglePage: true }} locale={{ emptyText: 'Todavía no tienes movimientos' }} />
          </section>
        </>
      )}
    </>
  );
}
