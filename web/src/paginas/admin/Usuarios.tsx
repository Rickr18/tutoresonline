import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Button, Checkbox, Flex, Form, Input, Modal, Radio, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, consulta, descargar, type Rol, type UsuarioAdmin } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera } from '../../comunes';
import { mensajeDe } from '../../ui';
import { fecha, iniciales } from '../../formato';
import { MARINO } from '../../tema';

const ROL: Record<Rol, string> = { ESTUDIANTE: 'Estudiante', TUTOR: 'Tutor', SOPORTE: 'Soporte', ADMIN: 'Administrador' };
const REGLAS_CLAVE = [
  { required: true, message: 'Escribe una contraseña.' },
  { min: 8, message: 'Mínimo 8 caracteres.' },
  { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: 'Debe tener letras y números.' },
];

/** Contraseña temporal legible: 4 letras + 4 números. */
function claveTemporal() {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const azar = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const l = Array.from({ length: 4 }, () => letras[azar(letras.length)]).join('');
  return `${l[0].toUpperCase()}${l.slice(1)}${String(azar(10000)).padStart(4, '0')}`;
}

function ModalEditar({ u, cerrar }: { u: UsuarioAdmin; cerrar: () => void }) {
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const [form] = Form.useForm<{ nombre: string; email: string; rol: Rol }>();
  const guardar = useMutation({
    mutationFn: (datos: { nombre: string; email: string; rol: Rol }) => api<UsuarioAdmin>(`/admin/usuarios/${u.id}`, datos, 'PATCH'),
    onSuccess: (r) => { cola.invalidateQueries({ queryKey: ['admin'] }); avisar(`Cuenta de ${r.nombre} actualizada`, 'bien'); cerrar(); },
  });
  return (
    <Modal open title={`Editar a ${u.nombre}`} onCancel={cerrar} okText="Guardar cambios" cancelText="Cancelar"
      confirmLoading={guardar.isPending} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ nombre: u.nombre, email: u.email, rol: u.rol }}
        onFinish={(v) => guardar.mutate(v)}>
        <Form.Item name="nombre" label="Nombre completo" rules={[{ required: true, min: 3, max: 80, message: 'Entre 3 y 80 caracteres.' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Correo" rules={[{ required: true, type: 'email', message: 'Escribe un correo válido.' }]}>
          <Input />
        </Form.Item>
        {u.acciones.includes('rol') && (
          <Form.Item name="rol" label="Rol">
            <Radio.Group optionType="button" buttonStyle="solid"
              options={[{ value: 'SOPORTE', label: 'Soporte' }, { value: 'ADMIN', label: 'Administrador' }]} />
          </Form.Item>
        )}
        {guardar.isError && <Alert type="error" showIcon title={mensajeDe(guardar.error)} />}
      </Form>
    </Modal>
  );
}

function ModalClave({ u, cerrar }: { u: UsuarioAdmin; cerrar: () => void }) {
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const [form] = Form.useForm<{ password: string; debeCambiar: boolean }>();
  const restablecer = useMutation({
    mutationFn: (v: { password: string; debeCambiar: boolean }) => api<UsuarioAdmin>(`/admin/usuarios/${u.id}/password`, v),
    onSuccess: (_r, v) => {
      cola.invalidateQueries({ queryKey: ['admin'] });
      avisar(`Contraseña de ${u.nombre} restablecida`, 'bien', `Temporal: ${v.password}. Sus sesiones abiertas se cerraron.`);
      cerrar();
    },
  });
  return (
    <Modal open title={`Restablecer contraseña de ${u.nombre}`} onCancel={cerrar} okText="Restablecer contraseña" cancelText="Cancelar"
      confirmLoading={restablecer.isPending} onOk={() => form.submit()} destroyOnHidden>
      <Typography.Paragraph type="secondary">
        Se cierran todas las sesiones abiertas de {u.email}. Comparte la contraseña temporal por un canal seguro.
      </Typography.Paragraph>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ password: claveTemporal(), debeCambiar: true }}
        onFinish={(v) => restablecer.mutate(v)}>
        <Form.Item label="Contraseña temporal" extra="Mínimo 8 caracteres, con letras y números.">
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="password" noStyle rules={REGLAS_CLAVE}>
              <Input autoComplete="off" style={{ fontFamily: 'ui-monospace, Consolas, monospace' }} />
            </Form.Item>
            <Button onClick={() => form.setFieldValue('password', claveTemporal())}>Generar otra</Button>
          </Space.Compact>
        </Form.Item>
        <Form.Item name="debeCambiar" valuePropName="checked">
          <Checkbox>Pedirle que la cambie al ingresar</Checkbox>
        </Form.Item>
        {restablecer.isError && <Alert type="error" showIcon title={mensajeDe(restablecer.error)} />}
      </Form>
    </Modal>
  );
}

type Nuevo = { nombre: string; email: string; password: string; rol: 'SOPORTE' | 'ADMIN' };

function ModalCrear({ cerrar }: { cerrar: () => void }) {
  const cola = useQueryClient();
  const { usuario, avisar } = useSesion();
  const [form] = Form.useForm<Nuevo>();
  const rol = Form.useWatch('rol', form) ?? 'SOPORTE';
  const crear = useMutation({
    mutationFn: (v: Nuevo) => api<UsuarioAdmin>('/admin/usuarios', v),
    onSuccess: (u) => {
      cola.invalidateQueries({ queryKey: ['admin'] });
      avisar(`Cuenta de ${ROL[u.rol].toLowerCase()} creada`, 'bien', `${u.nombre} ingresa con ${u.email} y debe cambiar la contraseña la primera vez.`);
      cerrar();
    },
  });
  return (
    <Modal open title="Crear cuenta del equipo" onCancel={cerrar} okText="Crear cuenta" cancelText="Cancelar"
      confirmLoading={crear.isPending} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ rol: 'SOPORTE' }} onFinish={(v) => crear.mutate(v)}>
        {usuario?.superior && (
          <Form.Item name="rol">
            <Radio.Group optionType="button" buttonStyle="solid"
              options={[{ value: 'SOPORTE', label: 'Soporte' }, { value: 'ADMIN', label: 'Administrador' }]} />
          </Form.Item>
        )}
        <Typography.Paragraph type="secondary">
          {rol === 'SOPORTE'
            ? 'Soporte atiende los casos: habla con cada parte, abre videollamadas de mediación, resuelve o escala a administración.'
            : 'Administración tiene acceso a casos escalados, pagos, verificaciones, materias y usuarios, pero no puede modificar tu cuenta ni crear otros administradores.'}
        </Typography.Paragraph>
        <Form.Item name="nombre" label="Nombre completo" rules={[{ required: true, min: 3, max: 80, message: 'Entre 3 y 80 caracteres.' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Correo" rules={[{ required: true, type: 'email', message: 'Escribe un correo válido.' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="password" label="Contraseña inicial" rules={REGLAS_CLAVE}
          extra="La persona deberá cambiarla la primera vez que ingrese. Compártela por un canal seguro.">
          <Input autoComplete="off" />
        </Form.Item>
        {crear.isError && <Alert type="error" showIcon title={mensajeDe(crear.error)} />}
      </Form>
    </Modal>
  );
}

export default function Usuarios() {
  const cola = useQueryClient();
  const { usuario, avisar } = useSesion();
  const [q, setQ] = useState('');
  const [rol, setRol] = useState<Rol | ''>('');
  const usuarios = useQuery({
    queryKey: ['admin', 'usuarios', q],
    queryFn: () => api<UsuarioAdmin[]>(`/admin/usuarios${consulta({ q })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const cambiar = useMutation({
    mutationFn: (u: UsuarioAdmin) => api<{ id: number; estado: string }>(`/admin/usuarios/${u.id}/estado`, { estado: u.estado === 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO' }),
    onSuccess: (r, u) => {
      cola.invalidateQueries({ queryKey: ['admin'] });
      avisar(r.estado === 'SUSPENDIDO' ? `${u.nombre} quedó suspendido` : `${u.nombre} quedó activo`, 'info');
    },
  });
  const exportar = useMutation({ mutationFn: () => descargar('/admin/exportar/usuarios.csv', 'usuarios.csv') });
  const lista = (usuarios.data ?? []).filter((u) => !rol || u.rol === rol);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [clave, setClave] = useState<UsuarioAdmin | null>(null);
  const [creando, setCreando] = useState(false);

  const columnas: ColumnsType<UsuarioAdmin> = [
    {
      title: 'Usuario', key: 'usuario',
      render: (_, u) => (
        <Space>
          <Avatar style={{ background: '#e9edf3', color: MARINO, fontWeight: 700 }}>{iniciales(u.nombre)}</Avatar>
          <span><Typography.Text strong>{u.nombre}</Typography.Text><br /><Typography.Text type="secondary">{u.email}</Typography.Text></span>
        </Space>
      ),
    },
    { title: 'Rol', key: 'rol', render: (_, u) => (u.superior ? <Tag color="gold">Principal</Tag> : ROL[u.rol]) },
    { title: 'Registro', dataIndex: 'creadoEn', render: (v: string) => fecha(v), responsive: ['md'] },
    {
      title: 'Estado', key: 'estado',
      render: (_, u) => (
        <Space orientation="vertical" size={0}>
          <Tag color={u.estado === 'ACTIVO' ? 'green' : 'red'}>{u.estado === 'ACTIVO' ? 'Activo' : 'Suspendido'}</Tag>
          {u.debeCambiarPassword && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Clave temporal</Typography.Text>}
        </Space>
      ),
    },
    {
      title: 'Acciones', key: 'acciones', align: 'right',
      render: (_, u) => u.acciones.length === 0
        ? <Typography.Text type="secondary">{u.id === usuario?.id ? 'Tu cuenta' : 'Sin permisos'}</Typography.Text>
        : (
          <Space wrap size={6} style={{ justifyContent: 'flex-end' }}>
            {u.acciones.includes('editar') && <Button size="small" onClick={() => setEditando(u)}>Editar</Button>}
            {u.acciones.includes('password') && <Button size="small" onClick={() => setClave(u)}>Contraseña</Button>}
            {(u.acciones.includes('suspender') || u.acciones.includes('reactivar')) && (
              <Button size="small" danger={u.estado === 'ACTIVO'} type={u.estado === 'ACTIVO' ? 'default' : 'primary'}
                loading={cambiar.isPending && cambiar.variables?.id === u.id} onClick={() => cambiar.mutate(u)}>
                {u.estado === 'ACTIVO' ? 'Suspender' : 'Reactivar'}
              </Button>
            )}
          </Space>
        ),
    },
  ];

  return (
    <>
      <Cabecera titulo="Usuarios" detalle={usuario?.superior
        ? 'Como administrador principal puedes gestionar a todos, incluidos los demás administradores. Nadie más puede modificar tu cuenta.'
        : 'Puedes gestionar estudiantes, tutores y soporte. Las cuentas de administración las gestiona el administrador principal.'}>
        <Button loading={exportar.isPending} onClick={() => exportar.mutate()}>Exportar CSV</Button>
        <Button type="primary" onClick={() => setCreando(true)}>Crear cuenta del equipo</Button>
      </Cabecera>
      <Flex gap={12} wrap align="center" style={{ marginBottom: 16 }}>
        <Input.Search placeholder="Buscar por nombre o correo" allowClear value={q} onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 320 }} aria-label="Buscar" />
        <Select value={rol} onChange={setRol} style={{ width: 200 }} aria-label="Rol" options={[
          { value: '', label: 'Todos los roles' },
          { value: 'ESTUDIANTE', label: 'Estudiantes' },
          { value: 'TUTOR', label: 'Tutores' },
          { value: 'SOPORTE', label: 'Soporte' },
          { value: 'ADMIN', label: 'Administradores' },
        ]} />
        <Typography.Text type="secondary">{lista.length} usuarios</Typography.Text>
      </Flex>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {usuarios.isError && <Alert type="error" showIcon title={mensajeDe(usuarios.error)} />}
        {cambiar.isError && <Alert type="error" showIcon title={mensajeDe(cambiar.error)} />}
        {exportar.isError && <Alert type="error" showIcon title={mensajeDe(exportar.error)} />}
        <Table rowKey="id" columns={columnas} dataSource={lista} loading={usuarios.isPending} size="middle"
          pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Ningún usuario coincide' }} />
      </Space>
      {editando && <ModalEditar u={editando} cerrar={() => setEditando(null)} />}
      {clave && <ModalClave u={clave} cerrar={() => setClave(null)} />}
      {creando && <ModalCrear cerrar={() => setCreando(false)} />}
    </>
  );
}
