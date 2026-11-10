import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AutoComplete, Button, Card, Form, Input, List, Modal, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api, type SolicitudMateria } from '../../api';
import { useSesion } from '../../sesion';
import { useMaterias } from '../../comunes';
import { Alerta, Insignia, mensajeDe } from '../../ui';
import { haceCuanto } from '../../formato';

const ESTADO: Record<SolicitudMateria['estado'], { texto: string; tono: string }> = {
  PENDIENTE: { texto: 'En revisión', tono: 'espera' },
  APROBADA: { texto: 'Aprobada', tono: 'bien' },
  RECHAZADA: { texto: 'Rechazada', tono: 'mal' },
};

type Pedido = { nombre: string; area: string; motivo: string };

/** El tutor pide una materia que no está en el catálogo; un administrador la aprueba o la rechaza. */
export default function SolicitudesMateria() {
  const cola = useQueryClient();
  const { avisar, refrescar } = useSesion();
  const materias = useMaterias();
  const [abierta, setAbierta] = useState(false);
  const [form] = Form.useForm<Pedido>();
  const solicitudes = useQuery({
    queryKey: ['materias', 'solicitudes'],
    queryFn: () => api<SolicitudMateria[]>('/tutor/solicitudes-materia'),
    refetchInterval: 30_000,
  });
  const pedir = useMutation({
    mutationFn: (v: Pedido) => api<SolicitudMateria>('/tutor/solicitudes-materia', v),
    onSuccess: (s) => {
      cola.invalidateQueries({ queryKey: ['materias'] });
      refrescar().catch(() => undefined);
      setAbierta(false);
      form.resetFields();
      avisar('Solicitud enviada', 'bien', `Un administrador revisará ${s.nombre}. Te avisamos cuando responda.`);
    },
  });
  const areas = [...new Set((materias.data ?? []).map((m) => m.area))].sort();

  return (
    <Card title="Materias que no están en la lista"
      extra={<Button icon={<PlusOutlined />} onClick={() => { pedir.reset(); setAbierta(true); }}>Solicitar materia</Button>}>
      <Typography.Paragraph type="secondary">
        Si enseñas una materia que no aparece en el catálogo, pídela aquí. Cuando un administrador la apruebe, se agrega al catálogo y a tu perfil.
      </Typography.Paragraph>
      {solicitudes.isError && <Alerta>{mensajeDe(solicitudes.error)}</Alerta>}
      {!!solicitudes.data?.length && (
        <List className="solicitudes-materia" size="small" dataSource={solicitudes.data} renderItem={(s) => (
          <List.Item style={{ paddingInline: 0 }} extra={<Insignia tono={ESTADO[s.estado].tono}>{ESTADO[s.estado].texto}</Insignia>}>
            <List.Item.Meta title={`${s.nombre} · ${s.area}`}
              description={<>
                Pedida {haceCuanto(s.creadoEn)}
                {s.respuesta && <><br /><Typography.Text type={s.estado === 'RECHAZADA' ? 'danger' : 'secondary'}>{s.respuesta}</Typography.Text></>}
              </>} />
          </List.Item>
        )} />
      )}

      <Modal open={abierta} title="Solicitar una materia" onCancel={() => setAbierta(false)} okText="Enviar solicitud" cancelText="Cancelar"
        confirmLoading={pedir.isPending} onOk={() => form.submit()} destroyOnHidden>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => pedir.mutate(v)}>
          <Form.Item name="nombre" label="Nombre de la materia" rules={[{ required: true, min: 3, max: 60, message: 'Entre 3 y 60 caracteres.' }]}>
            <Input placeholder="Por ejemplo: Microeconomía" />
          </Form.Item>
          <Form.Item name="area" label="Área" rules={[{ required: true, min: 3, max: 40, message: 'Entre 3 y 40 caracteres.' }]}
            extra="Elige un área existente o escribe una nueva.">
            <AutoComplete options={areas.map((a) => ({ value: a }))}
              filterOption={(t, op) => String(op?.value).toLowerCase().includes(t.toLowerCase())} />
          </Form.Item>
          <Form.Item name="motivo" label="¿Por qué la necesitas?" rules={[{ required: true, min: 10, max: 300, message: 'Entre 10 y 300 caracteres.' }]}>
            <Input.TextArea autoSize={{ minRows: 3 }} placeholder="Tu experiencia con la materia y quién la pide" />
          </Form.Item>
          {pedir.isError && <Alerta>{mensajeDe(pedir.error)}</Alerta>}
        </Form>
      </Modal>
    </Card>
  );
}
