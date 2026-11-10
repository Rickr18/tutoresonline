import { useMutation } from '@tanstack/react-query';
import { Alert, Avatar, Button, Card, Col, Flex, Form, Input, Row, Tag, Typography } from 'antd';
import { api, type Usuario } from '../api';
import { useSesion } from '../sesion';
import { Cabecera } from '../comunes';
import { mensajeDe } from '../ui';
import { fechaHora, iniciales, ROL_TEXTO } from '../formato';
import { Link } from 'react-router-dom';
import { MARINO } from '../tema';
import { abrirAppMovil, esIphone } from '../qr';

type Claves = { actual: string; nueva: string; repetir: string };

/** Formulario de cambio de la propia contraseña. Al terminar, las demás sesiones abiertas de la cuenta se cierran. */
export function FormularioClave({ alTerminar }: { alTerminar?: () => void }) {
  const { renovar, avisar } = useSesion();
  const [form] = Form.useForm<Claves>();
  const cambiar = useMutation({
    mutationFn: (v: Claves) => api<{ token: string; usuario: Usuario }>('/yo/password', { actual: v.actual, nueva: v.nueva }, 'PUT'),
    onSuccess: (r) => {
      renovar(r.token, r.usuario);
      form.resetFields();
      avisar('Contraseña actualizada', 'bien', 'Las demás sesiones abiertas con tu cuenta se cerraron.');
      alTerminar?.();
    },
  });

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => cambiar.mutate(v)}>
      <Form.Item name="actual" label="Contraseña actual" rules={[{ required: true, message: 'Escribe tu contraseña actual.' }]}>
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Form.Item name="nueva" label="Contraseña nueva" extra="Mínimo 8 caracteres, con letras y números." rules={[
        { required: true, message: 'Escribe la contraseña nueva.' },
        { min: 8, message: 'Mínimo 8 caracteres.' },
        { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: 'Debe tener letras y números.' },
      ]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item name="repetir" label="Repite la contraseña nueva" dependencies={['nueva']} rules={[
        { required: true, message: 'Repite la contraseña nueva.' },
        ({ getFieldValue }) => ({
          validator: (_, v) => (!v || v === getFieldValue('nueva') ? Promise.resolve() : Promise.reject(new Error('Las dos contraseñas no coinciden.'))),
        }),
      ]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      {cambiar.isError && <Alert type="error" showIcon title={mensajeDe(cambiar.error)} style={{ marginBottom: 16 }} />}
      <Button type="primary" htmlType="submit" block loading={cambiar.isPending}>Cambiar contraseña</Button>
    </Form>
  );
}

/** Se muestra en lugar de la aplicación cuando un administrador restableció la contraseña. */
export function CambioObligatorio() {
  const { usuario, salir } = useSesion();
  return (
    <Flex justify="center" align="center" style={{ minHeight: '100vh', padding: '24px 16px' }}>
      <Card style={{ maxWidth: 440, width: '100%' }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>Crea una contraseña nueva</Typography.Title>
        <Typography.Paragraph type="secondary">
          Hola, {usuario?.nombre}. Un administrador restableció tu contraseña. Escribe la temporal que te dieron y elige una nueva para continuar.
        </Typography.Paragraph>
        <FormularioClave />
        <Flex justify="center" style={{ marginTop: 12 }}><Button type="link" onClick={salir}>Salir</Button></Flex>
      </Card>
    </Flex>
  );
}

export default function Cuenta() {
  const { usuario } = useSesion();
  if (!usuario) return null;
  return (
    <>
      <Cabecera titulo="Mi cuenta" />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card>
            <Flex gap={18} align="center">
              <Avatar size={64} style={{ background: '#e9edf3', color: MARINO, fontWeight: 700, fontSize: 22, flex: 'none' }}>{iniciales(usuario.nombre)}</Avatar>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>{usuario.nombre}</Typography.Title>
                <Typography.Text type="secondary">{usuario.email}</Typography.Text>
                <Flex gap={8} align="center" wrap style={{ marginTop: 8 }}>
                  <span>{ROL_TEXTO[usuario.rol]}</span>
                  {usuario.superior && <Tag color="gold">Administrador principal</Tag>}
                </Flex>
                <Typography.Paragraph type="secondary" style={{ margin: '10px 0 0', fontSize: 13 }}>
                  {usuario.terminosAceptadosEn
                    ? <>Aceptaste los términos y la política de datos (versión {usuario.terminosVersion}) el {fechaHora(usuario.terminosAceptadosEn)}. </>
                    : null}
                  <Link to="/terminos" target="_blank">Términos</Link> · <Link to="/privacidad" target="_blank">Privacidad</Link>
                </Typography.Paragraph>
              </div>
            </Flex>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Cambiar contraseña">
            <FormularioClave />
          </Card>
        </Col>
        {esIphone() && (usuario.rol === 'ESTUDIANTE' || usuario.rol === 'TUTOR') && (
          <Col xs={24}>
            <Card title="App móvil">
              <Typography.Paragraph type="secondary">En el iPhone puedes usar la app móvil, con su navegación por pestañas, e instalarla en la pantalla de inicio.</Typography.Paragraph>
              <Button type="primary" onClick={abrirAppMovil}>Usar la app móvil</Button>
            </Card>
          </Col>
        )}
      </Row>
    </>
  );
}
