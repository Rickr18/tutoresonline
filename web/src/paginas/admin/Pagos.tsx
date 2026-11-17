import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, descargar, type EstadoPago, type PagoAdmin } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera } from '../../comunes';
import { Alerta, BarraFiltros, Insignia, Kpi, Kpis, Vacio, mensajeDe, Tabla } from '../../ui';
import { WalletOutlined } from '@ant-design/icons';
import { dinero, ESTADO_PAGO, fecha, fechaHora } from '../../formato';

const sub = (texto: React.ReactNode) => <><br /><Typography.Text type="secondary" style={{ fontSize: 13 }}>{texto}</Typography.Text></>;

export default function Pagos() {
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const [estado, setEstado] = useState('');
  const pagos = useQuery({ queryKey: ['admin', 'pagos'], queryFn: () => api<PagoAdmin[]>('/admin/pagos'), refetchInterval: 15_000 });
  const liberar = useMutation({
    mutationFn: (p: PagoAdmin) => api(`/admin/pagos/${p.id}/liberar`, {}),
    onSuccess: (_r, p) => { cola.invalidateQueries({ queryKey: ['admin'] }); avisar(`Pago ${p.referencia} liberado al tutor`, 'bien'); },
  });
  const exportar = useMutation({ mutationFn: () => descargar('/admin/exportar/pagos.csv', 'pagos.csv') });
  const lista = (pagos.data ?? []).filter((p) => !estado || p.estado === estado);
  const suma = (f: (p: PagoAdmin) => number) => lista.reduce((n, p) => n + f(p), 0);
  const m = (v: number) => (pagos.isPending ? '—' : dinero(v));

  const columnas: ColumnsType<PagoAdmin> = [
    { title: 'Referencia', key: 'ref', render: (_, p) => <><b className="nums">{p.referencia}</b>{sub(`${p.metodo} · ${fecha(p.fecha)}`)}</> },
    { title: 'Sesión', key: 'sesion', render: (_, p) => <><Link to={`/gestion/sesiones/${p.sesionId}`}>Sesión #{p.sesionId}</Link>{sub(`${p.estudiante} → ${p.tutor ?? 'sin tutor'}`)}</> },
    { title: 'Monto', key: 'monto', align: 'right', className: 'nums', render: (_, p) => <>{dinero(p.monto)}{p.reembolso > 0 && sub(`devuelto ${dinero(p.reembolso)}`)}</> },
    { title: 'Comisión', dataIndex: 'comision', align: 'right', className: 'nums', render: (v: number) => dinero(v) },
    { title: 'Al tutor', dataIndex: 'netoTutor', align: 'right', className: 'nums', render: (v: number) => dinero(v) },
    {
      title: 'Estado', key: 'estado',
      render: (_, p) => <><Insignia tono={ESTADO_PAGO[p.estado].tono}>{ESTADO_PAGO[p.estado].texto}</Insignia>{p.estado === 'RETENIDO' && p.liberarEn && sub(fechaHora(p.liberarEn).toLowerCase())}</>,
    },
    {
      title: 'Acción', key: 'accion', align: 'right',
      render: (_, p) => p.estado === 'RETENIDO' && p.estadoSesion === 'FINALIZADA' && (
        <Button size="small" type="primary" loading={liberar.isPending && liberar.variables?.id === p.id} onClick={() => liberar.mutate(p)}>Liberar</Button>
      ),
    },
  ];

  return (
    <>
      <Cabecera titulo="Pagos" detalle="El dinero queda retenido hasta 48 horas después de la sesión. En la demostración se puede liberar antes.">
        <Button loading={exportar.isPending} onClick={() => exportar.mutate()}>Exportar CSV</Button>
      </Cabecera>
      {exportar.isError && <Alerta>{mensajeDe(exportar.error)}</Alerta>}
      <Kpis>
        <Kpi fuerte etiqueta="Cobrado" valor={m(suma((p) => p.monto))} nota={`${lista.length} pagos`} />
        <Kpi etiqueta="Comisión" valor={m(suma((p) => p.comision))} nota="de la plataforma" />
        <Kpi etiqueta="Retenido" valor={m(lista.filter((p) => p.estado === 'RETENIDO').reduce((n, p) => n + p.monto, 0))} nota="esperando la garantía" />
        <Kpi etiqueta="En disputa" valor={m(lista.filter((p) => p.estado === 'EN_DISPUTA').reduce((n, p) => n + p.monto, 0))} nota="congelado" />
      </Kpis>
      <BarraFiltros contador={`${lista.length} pagos`}>
        <Select value={estado} onChange={setEstado} aria-label="Estado del pago" style={{ width: 220 }}
          options={[{ value: '', label: 'Todos los estados' }, ...(Object.keys(ESTADO_PAGO) as EstadoPago[]).map((e) => ({ value: e, label: ESTADO_PAGO[e].texto }))]} />
      </BarraFiltros>
      {pagos.isError && <Alerta>{mensajeDe(pagos.error)}</Alerta>}
      {liberar.isError && <Alerta>{mensajeDe(liberar.error)}</Alerta>}
      <Tabla rowKey="id" columns={columnas} dataSource={lista} cargando={pagos.isPending} size="middle" scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 25, hideOnSinglePage: true }} locale={{ emptyText: <Vacio titulo="No hay pagos con este estado" icono={<WalletOutlined />} /> }} />
    </>
  );
}
