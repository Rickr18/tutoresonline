import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AutoComplete, Badge, Button, Flex, Form, Input, Modal, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, type MateriaAdmin, type SolicitudMateria } from '../../api';
import SolicitudesAdmin from './SolicitudesMateria';
import { useSesion } from '../../sesion';
import { Cabecera } from '../../comunes';
import { mensajeDe } from '../../ui';

type Formulario = { nombre: string; area: string };

function ModalMateria({ materia, areas, cerrar, refrescar }: {
  materia: MateriaAdmin | null; areas: string[]; cerrar: () => void; refrescar: () => void;
}) {
  const { avisar } = useSesion();
  const [form] = Form.useForm<Formulario>();
  const guardar = useMutation({
    mutationFn: (f: Formulario) => materia
      ? api<MateriaAdmin>(`/admin/materias/${materia.id}`, f, 'PATCH')
      : api<MateriaAdmin>('/admin/materias', f),
    onSuccess: (m) => { refrescar(); avisar(materia ? `Materia ${m.nombre} actualizada` : `Materia ${m.nombre} creada`, 'bien'); cerrar(); },
  });
  return (
    <Modal open title={materia ? 'Editar materia' : 'Nueva materia'} onCancel={cerrar} cancelText="Cancelar"
      okText={materia ? 'Guardar cambios' : 'Crear materia'} confirmLoading={guardar.isPending} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => guardar.mutate(v)}
        initialValues={materia ? { nombre: materia.nombre, area: materia.area } : undefined}>
        <Form.Item name="nombre" label="Nombre" rules={[{ required: true, min: 3, max: 60, message: 'Entre 3 y 60 caracteres.' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="area" label="Área" extra="Elige un área existente o escribe una nueva."
          rules={[{ required: true, min: 3, max: 40, message: 'Entre 3 y 40 caracteres.' }]}>
          <AutoComplete options={areas.map((a) => ({ value: a }))}
            filterOption={(texto, op) => String(op?.value).toLowerCase().includes(texto.toLowerCase())} />
        </Form.Item>
        {guardar.isError && <Alert type="error" showIcon title={mensajeDe(guardar.error)} />}
      </Form>
    </Modal>
  );
}

export default function Materias() {
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const materias = useQuery({ queryKey: ['admin', 'materias'], queryFn: () => api<MateriaAdmin[]>('/admin/materias') });
  const solicitudes = useQuery({ queryKey: ['admin', 'solicitudes-materia'], queryFn: () => api<SolicitudMateria[]>('/admin/solicitudes-materia'), refetchInterval: 30_000 });
  const pendientes = (solicitudes.data ?? []).filter((s) => s.estado === 'PENDIENTE').length;
  const [pestana, setPestana] = useState<'catalogo' | 'solicitudes'>('catalogo');
  const [editando, setEditando] = useState<MateriaAdmin | null | undefined>(undefined);

  // Las búsquedas y los formularios usan ['materias']; se refrescan junto con la vista del admin.
  const refrescar = () => { cola.invalidateQueries({ queryKey: ['admin'] }); cola.invalidateQueries({ queryKey: ['materias'] }); };
  const alternar = useMutation({
    mutationFn: (m: MateriaAdmin) => api<MateriaAdmin>(`/admin/materias/${m.id}`, { activa: !m.activa }, 'PATCH'),
    onSuccess: (m) => { refrescar(); avisar(m.activa ? `${m.nombre} vuelve a estar disponible` : `${m.nombre} ya no aparece en búsquedas ni reservas`, 'info'); },
  });
  const areas = [...new Set((materias.data ?? []).map((m) => m.area))].sort();

  const columnas: ColumnsType<MateriaAdmin> = [
    { title: 'Materia', dataIndex: 'nombre', render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'Área', dataIndex: 'area', filters: areas.map((a) => ({ text: a, value: a })), onFilter: (v, m) => m.area === v },
    { title: 'Tutores', dataIndex: 'tutores', align: 'right', className: 'nums' },
    { title: 'Sesiones', dataIndex: 'sesiones', align: 'right', className: 'nums' },
    { title: 'Estado', dataIndex: 'activa', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag> },
    {
      title: 'Acciones', key: 'acciones', align: 'right',
      render: (_, m) => (
        <Space size={6}>
          <Button size="small" onClick={() => setEditando(m)}>Editar</Button>
          <Button size="small" danger={m.activa} type={m.activa ? 'default' : 'primary'}
            loading={alternar.isPending && alternar.variables?.id === m.id} onClick={() => alternar.mutate(m)}>
            {m.activa ? 'Desactivar' : 'Activar'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Cabecera titulo="Materias" detalle="Una materia desactivada deja de aparecer en búsquedas, reservas y en el perfil de los tutores. Las sesiones pasadas la conservan.">
        <Button type="primary" onClick={() => setEditando(null)}>Nueva materia</Button>
      </Cabecera>
      {materias.isError && <Alert type="error" showIcon title={mensajeDe(materias.error)} style={{ marginBottom: 16 }} />}
      {alternar.isError && <Alert type="error" showIcon title={mensajeDe(alternar.error)} style={{ marginBottom: 16 }} />}
      {solicitudes.isError && <Alert type="error" showIcon title={mensajeDe(solicitudes.error)} style={{ marginBottom: 16 }} />}
      <Tabs activeKey={pestana} onChange={(k) => setPestana(k as typeof pestana)} items={[
        { key: 'catalogo', label: 'Catálogo' },
        { key: 'solicitudes', label: <Flex gap={8} align="center">Solicitudes de tutores<Badge count={pendientes} /></Flex> },
      ]} />
      {pestana === 'catalogo'
        ? <Table rowKey="id" columns={columnas} dataSource={materias.data ?? []} loading={materias.isPending} size="middle"
          pagination={false} scroll={{ x: 'max-content' }} />
        : <SolicitudesAdmin solicitudes={solicitudes.data ?? []} cargando={solicitudes.isPending} areas={areas} />}
      {editando !== undefined && (
        <ModalMateria materia={editando} areas={areas} cerrar={() => setEditando(undefined)} refrescar={refrescar} />
      )}
    </>
  );
}
