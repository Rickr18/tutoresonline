import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Flex, Form, Input, Steps, Typography } from 'antd';
import { api, type Usuario } from '../api';
import { useSesion } from '../sesion';
import { Alerta, mensajeDe } from '../ui';

type Paso1 = { email: string };
type Paso2 = { codigo: string; nueva: string; repetir: string };

/** Recuperar el acceso sin depender de un administrador: código de 6 dígitos y contraseña nueva. */
export default function Recuperar() {
  const { entrar, avisar } = useSesion();
  const ir = useNavigate();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState<{ mensaje: string; codigoDemo?: string } | null>(null);

  const pedir = useMutation({
    mutationFn: (v: Paso1) => api<{ mensaje: string; codigoDemo?: string }>('/auth/recuperar', { email: v.email.trim() }),
    onSuccess: (r, v) => { setEmail(v.email.trim()); setEnviado(r); },
  });
  const cambiar = useMutation({
    mutationFn: (v: Paso2) => api<{ token: string; usuario: Usuario }>('/auth/restablecer', { email, codigo: v.codigo, nueva: v.nueva }),
    onSuccess: (r) => {
      entrar(r.token, r.usuario);
      avisar('Contraseña actualizada', 'bien', 'Ya entraste con tu contraseña nueva.');
      ir('/', { replace: true });
    },
  });

  return (
    <Flex justify="center" align="center" style={{ minHeight: '100vh', padding: '24px 16px' }}>
      <Card style={{ maxWidth: 460, width: '100%' }}>
        <Link to="/" className="marca" style={{ marginBottom: 18 }}>
          <span className="logo">T</span>
          <span className="nombre">Tutores<em>On-Line</em></span>
        </Link>
        <Typography.Title level={3} style={{ marginTop: 0 }}>Recuperar la contraseña</Typography.Title>
        <Steps size="small" current={enviado ? 1 : 0} style={{ marginBottom: 20 }}
          items={[{ title: 'Pedir el código' }, { title: 'Contraseña nueva' }]} />

        {!enviado ? (
          <Form layout="vertical" requiredMark={false} onFinish={(v: Paso1) => pedir.mutate(v)}>
            <Typography.Paragraph type="secondary">Escribe el correo de tu cuenta y te enviamos un código de 6 dígitos.</Typography.Paragraph>
            <Form.Item name="email" label="Correo electrónico" rules={[{ required: true, type: 'email', message: 'Escribe un correo válido.' }]}>
              <Input size="large" autoComplete="email" />
            </Form.Item>
            {pedir.isError && <div style={{ marginBottom: 16 }}><Alerta>{mensajeDe(pedir.error)}</Alerta></div>}
            <Button type="primary" htmlType="submit" size="large" block loading={pedir.isPending}>Enviar código</Button>
          </Form>
        ) : (
          <Form layout="vertical" requiredMark={false} onFinish={(v: Paso2) => cambiar.mutate(v)}>
            <Alert type="info" showIcon title={enviado.mensaje} style={{ marginBottom: 16 }} />
            {enviado.codigoDemo && (
              <Alert type="warning" showIcon style={{ marginBottom: 16 }}
                title={<>Modo demostración: el código que llegaría al correo es <Typography.Text strong copyable className="nums">{enviado.codigoDemo}</Typography.Text></>} />
            )}
            <Form.Item name="codigo" label="Código de 6 dígitos" rules={[{ required: true, pattern: /^\d{6}$/, message: 'Son 6 números.' }]}>
              <Input size="large" inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
            </Form.Item>
            <Form.Item name="nueva" label="Contraseña nueva" extra="Mínimo 8 caracteres, con letras y números." rules={[
              { required: true, message: 'Escribe la contraseña nueva.' },
              { min: 8, message: 'Mínimo 8 caracteres.' },
              { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: 'Debe tener letras y números.' },
            ]}>
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="repetir" label="Repite la contraseña nueva" dependencies={['nueva']} rules={[
              { required: true, message: 'Repite la contraseña nueva.' },
              ({ getFieldValue }) => ({
                validator: (_, v) => (!v || v === getFieldValue('nueva') ? Promise.resolve() : Promise.reject(new Error('Las dos contraseñas no coinciden.'))),
              }),
            ]}>
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
            {cambiar.isError && <div style={{ marginBottom: 16 }}><Alerta>{mensajeDe(cambiar.error)}</Alerta></div>}
            <Button type="primary" htmlType="submit" size="large" block loading={cambiar.isPending}>Cambiar contraseña y entrar</Button>
            <Button type="link" block style={{ marginTop: 8 }} onClick={() => { setEnviado(null); cambiar.reset(); }}>Pedir otro código</Button>
          </Form>
        )}
        <Flex justify="center" style={{ marginTop: 12 }}><Link to="/ingresar">Volver a ingresar</Link></Flex>
      </Card>
    </Flex>
  );
}
