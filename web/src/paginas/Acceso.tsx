import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Qr, urlDescarga } from '../qr';
import { api, type Usuario } from '../api';
import { useSesion } from '../sesion';
import { Button, Flex, Form, Input, Segmented, Tabs, Typography } from 'antd';
import { Alerta, Campo, mensajeDe } from '../ui';

const DEMOS = [
  { rol: 'Estudiante', email: 'ana@demo.co' },
  { rol: 'Tutor', email: 'carlos@demo.co' },
  { rol: 'Soporte', email: 'soporte@tutores.co' },
  { rol: 'Administrador', email: 'rick@tutores.co' },
];

export default function Acceso() {
  const { entrar } = useSesion();
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<'ESTUDIANTE' | 'TUTOR'>('ESTUDIANTE');

  const enviar = useMutation({
    mutationFn: (datos: { email: string; password: string }) =>
      api<{ token: string; usuario: Usuario }>(
        modo === 'entrar' ? '/auth/login' : '/auth/registro',
        modo === 'entrar' ? datos : { ...datos, nombre, rol },
      ),
    onSuccess: (r) => entrar(r.token, r.usuario),
  });

  const cambiarModo = (m: typeof modo) => { setModo(m); enviar.reset(); };

  return (
    <div className="acceso">
      <section className="acceso-marca">
        <div className="marca clara">
          <span className="logo">T</span>
          <span className="nombre">Tutores<em>On-Line</em></span>
        </div>
        <h1>Un tutor para la materia que te está costando.</h1>
        <p>Reserva una sesión con un tutor verificado o pide ayuda ahora mismo: el primer tutor disponible que acepte se conecta contigo.</p>
        <ul>
          <li><b>Reserva programada</b><span>Eliges tutor, día y hora según su disponibilidad.</span></li>
          <li><b>Tutor ahora</b><span>Tu solicitud llega a los tutores en línea y uno la toma en segundos.</span></li>
          <li><b>Pago protegido</b><span>El dinero se retiene y se entrega al tutor 48 horas después de la sesión.</span></li>
        </ul>
        <Link to="/descargar" className="acceso-qr">
          <Qr texto={urlDescarga()} tamano={96} />
          <span><b>Instala la app</b>Escanea con el teléfono: APK en Android y web en la pantalla de inicio en iPhone.</span>
        </Link>
      </section>

      <section className="acceso-forma">
        <Tabs activeKey={modo} onChange={(k) => cambiarModo(k as typeof modo)}
          items={[{ key: 'entrar', label: 'Ingresar' }, { key: 'registro', label: 'Crear cuenta' }]} />

        <Form layout="vertical" className="forma" onFinish={() => enviar.mutate({ email, password })}>
          {modo === 'registro' && (
            <>
              <Segmented block value={rol} onChange={(v) => setRol(v as typeof rol)}
                options={[{ value: 'ESTUDIANTE', label: 'Soy estudiante' }, { value: 'TUTOR', label: 'Soy tutor' }]} />
              <Campo etiqueta="Nombre completo" id="acceso-nombre">
                <Input id="acceso-nombre" size="large" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required minLength={3} maxLength={80} />
              </Campo>
            </>
          )}
          <Campo etiqueta="Correo electrónico" id="acceso-email">
            <Input id="acceso-email" size="large" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Campo>
          <Campo etiqueta="Contraseña" id="acceso-clave" ayuda={modo === 'registro' ? 'Mínimo 8 caracteres, con letras y números.' : undefined}>
            <Input.Password id="acceso-clave" size="large" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={modo === 'registro' ? 8 : 1}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
          </Campo>
          {enviar.isError && <Alerta>{mensajeDe(enviar.error)}</Alerta>}
          <Button type="primary" htmlType="submit" size="large" block loading={enviar.isPending}>
            {modo === 'entrar' ? 'Ingresar' : 'Crear cuenta'}
          </Button>
          {modo === 'registro' && rol === 'TUTOR' && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>Después de registrarte completas tu perfil y un administrador lo verifica antes de publicarlo.</Typography.Text>
          )}
        </Form>

        {modo === 'entrar' && (
          <div className="demos">
            <Typography.Text type="secondary">Cuentas de demostración (contraseña <Typography.Text code>Demo1234</Typography.Text>)</Typography.Text>
            <Flex gap={8} wrap>
              {DEMOS.map((d) => (
                <Button key={d.email} size="small" disabled={enviar.isPending}
                  onClick={() => { setEmail(d.email); setPassword('Demo1234'); enviar.mutate({ email: d.email, password: 'Demo1234' }); }}>
                  {d.rol}
                </Button>
              ))}
            </Flex>
          </div>
        )}

        <Typography.Text type="secondary" className="descarga-movil">¿Estás en el teléfono? <Link to="/descargar">Instala la app</Link></Typography.Text>
      </section>
    </div>
  );
}
