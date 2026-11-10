import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AutoComplete, Button, Form, Input, Modal, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, type SolicitudMateria } from '../../api';
import { useSesion } from '../../sesion';
import { Insignia, mensajeDe } from '../../ui';
import { fecha, haceCuanto } from '../../formato';

const ESTADO: Record<SolicitudMateria['estado'], { texto: string; tono: string }> = {
  PENDIENTE: { texto: 'Pendiente', tono: 'espera' },
  APROBADA: { texto: 'Aprobada', tono: 'bien' },
  RECHAZADA: { texto: 'Rechazada', tono: 'mal' },
};

type Respuesta = { s: SolicitudMateria; tipo: 'aprobar' | 'rechazar' };

/** Bandeja de pedidos de materias de los tutores. Aprobar crea la materia y se la asigna al tutor si tiene cupo. */
export default function SolicitudesAdmin({ solicitudes, cargando, areas }: { solicitudes: SolicitudMateria[]; cargando: boolean; areas: string[] }) {
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const [respondiendo, setRespondiendo] = useState<Respuesta | null>(null);
  const [form] = Form.useForm<{ nombre: string; area: string; motivo: string }>();

  const responder = useMutation({
    mutationFn: ({ s, tipo, datos }: Respuesta & { datos: object }) =>
      api<SolicitudMateria & { asignada?: boolean }>(`/admin/solicitudes-materia/${s.id}/${tipo}`, datos),
    onSuccess: (r, { tipo }) => {
      cola.invalidateQueries({ queryKey: ['admin'] });
      cola.invalidateQueries({ queryKey: ['materias'] });
      setRespondiendo(null);
      avisar(tipo === 'aprobar' ? `${r.nombre} aprobada` : `Solicitud de ${r.nombre} rechazada`, tipo === 'aprobar' ? 'bien' : 'info',
        tipo === 'aprobar' ? (r.asignada ? `Quedó en el catálogo y en el perfil de ${r.tutor?.nombre}.` : 'Quedó en el catálogo; el tutor ya tenía 6 materias.') : undefined);
    },
  });
  const abrir = (s: SolicitudMateria, tipo: Respuesta['tipo']) => {
    responder.reset();
    form.setFieldsValue({ nombre: s.nombre, area: s.area, motivo: '' });
    setRespondiendo({ s, tipo });
  };

  const columnas: ColumnsType<SolicitudMateria> = [
    { title: 'Materia pedida', key: 'materia', render: (_, s) => <><Typography.Text strong>{s.nombre}</Typography.Text><br /><Typography.Text type="secondary">{s.area}</Typography.Text></> },
    { title: 'Tutor', key: 'tutor', render: (_, s) => <>{s.tutor?.nombre}<br /><Typography.Text type="secondary" style={{ fontSize: 13 }}>{s.tutor?.email}</Typography.Text></> },
    { title: 'Motivo', dataIndex: 'motivo', render: (v: string) => <Typography.Paragraph style={{ margin: 0, maxWidth: 360 }} ellipsis={{ rows: 3, expandable: true }}>{v}</Typography.Paragraph> },
    { title: 'Fecha', dataIndex: 'creadoEn', render: (v: string) => <span title={fecha(v)}>{haceCuanto(v)}</span> },
    {
      title: 'Estado', key: 'estado',
      render: (_, s) => <>
        <Insignia tono={ESTADO[s.estado].tono}>{ESTADO[s.estado].texto}</Insignia>
        {s.resueltaPor && <><br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>por {s.resueltaPor}</Typography.Text></>}
        {s.estado === 'RECHAZADA' && s.respuesta && <><br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>{s.respuesta}</Typography.Text></>}
      </>,
    },
    {
      title: 'Acciones', key: 'acciones', align: 'right',
      render: (_, s) => s.estado === 'PENDIENTE' && (
        <Space size={6}>
          <Button size="small" onClick={() => abrir(s, 'rechazar')}>Rechazar</Button>
          <Button size="small" type="primary" onClick={() => abrir(s, 'aprobar')}>Aprobar</Button>
        </Space>
      ),
    },
  ];

  const r = respondiendo;
  return (
    <>
      <Table className="solicitudes-materia" rowKey="id" columns={columnas} dataSource={solicitudes} loading={cargando} size="middle"
        pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Ningún tutor ha pedido materias nuevas.' }} />
      <Modal open={!!r} title={r ? `${r.tipo === 'aprobar' ? 'Aprobar' : 'Rechazar'} la solicitud de ${r.s.tutor?.nombre}` : ''}
        onCancel={() => setRespondiendo(null)} cancelText="Cancelar" okText={r?.tipo === 'aprobar' ? 'Aprobar y agregar al catálogo' : 'Rechazar solicitud'}
        okButtonProps={{ danger: r?.tipo === 'rechazar' }} confirmLoading={responder.isPending} onOk={() => form.submit()} destroyOnHidden>
        {r && (
          <Form form={form} layout="vertical" requiredMark={false}
            onFinish={(v) => responder.mutate({ ...r, datos: r.tipo === 'aprobar' ? { nombre: v.nombre, area: v.area } : { motivo: v.motivo } })}>
            {r.tipo === 'aprobar' ? (
              <>
                <Typography.Paragraph type="secondary">Puedes corregir el nombre o el área antes de agregarla. Si ya existe una materia con ese nombre, se reactiva.</Typography.Paragraph>
                <Form.Item name="nombre" label="Nombre" rules={[{ required: true, min: 3, max: 60, message: 'Entre 3 y 60 caracteres.' }]}><Input /></Form.Item>
                <Form.Item name="area" label="Área" rules={[{ required: true, min: 3, max: 40, message: 'Entre 3 y 40 caracteres.' }]}>
                  <AutoComplete options={areas.map((a) => ({ value: a }))} filterOption={(t, op) => String(op?.value).toLowerCase().includes(t.toLowerCase())} />
                </Form.Item>
              </>
            ) : (
              <Form.Item name="motivo" label="Motivo del rechazo" extra="El tutor lo ve en su perfil."
                rules={[{ required: true, min: 5, max: 300, message: 'Entre 5 y 300 caracteres.' }]}>
                <Input.TextArea autoSize={{ minRows: 3 }} placeholder="Por ejemplo: ya existe como Estadística, agrégala desde tu perfil" />
              </Form.Item>
            )}
            {responder.isError && <Alert type="error" showIcon title={mensajeDe(responder.error)} />}
          </Form>
        )}
      </Modal>
    </>
  );
}
