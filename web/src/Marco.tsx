import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Empty, Flex, Layout, List, Menu, Popover, Switch, Tooltip, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { api, type Notificaciones, type Rol } from './api';
import { useSesion } from './sesion';
import { Avatar, mensajeDe } from './ui';
import { haceCuanto, ROL_TEXTO } from './formato';

const MENU: Record<Rol, { a: string; texto: string; fin?: boolean }[]> = {
  ESTUDIANTE: [
    { a: '/buscar', texto: 'Buscar tutor' },
    { a: '/ahora', texto: 'Tutor ahora' },
    { a: '/sesiones', texto: 'Mis sesiones' },
  ],
  TUTOR: [
    { a: '/panel', texto: 'Inicio' },
    { a: '/sesiones', texto: 'Sesiones' },
    { a: '/agenda', texto: 'Disponibilidad' },
    { a: '/ingresos', texto: 'Ingresos' },
    { a: '/perfil', texto: 'Perfil' },
  ],
  SOPORTE: [
    { a: '/casos', texto: 'Casos' },
    { a: '/gestion/sesiones', texto: 'Sesiones' },
  ],
  ADMIN: [
    { a: '/admin', texto: 'Resumen', fin: true },
    { a: '/casos', texto: 'Casos' },
    { a: '/gestion/sesiones', texto: 'Sesiones' },
    { a: '/admin/verificaciones', texto: 'Verificar' },
    { a: '/admin/usuarios', texto: 'Usuarios' },
    { a: '/admin/pagos', texto: 'Pagos' },
    { a: '/admin/materias', texto: 'Materias' },
    { a: '/admin/actividad', texto: 'Actividad' },
  ],
};

/** Pantalla a la que lleva una notificación según el rol de quien la recibe. */
function useDestino() {
  const { usuario } = useSesion();
  const equipo = usuario?.rol === 'ADMIN' || usuario?.rol === 'SOPORTE';
  return (enlace?: string | null, sesionId?: number | null) =>
    enlace ?? (sesionId ? (equipo ? `/gestion/sesiones/${sesionId}` : `/sesiones/${sesionId}`) : null);
}

function Campana() {
  const destino = useDestino();
  const qc = useQueryClient();
  const ir = useNavigate();
  const [abierta, setAbierta] = useState(false);
  const { data } = useQuery({ queryKey: ['notificaciones'], queryFn: () => api<Notificaciones>('/notificaciones'), refetchInterval: 60_000 });
  const leer = useMutation({
    mutationFn: () => api('/notificaciones/leer', {}),
    onSuccess: () => qc.setQueryData<Notificaciones>(['notificaciones'], (n) => (n ? { ...n, sinLeer: 0 } : n)),
  });

  const alternar = (abrir: boolean) => {
    if (abrir && data?.sinLeer) leer.mutate();
    if (!abrir) qc.invalidateQueries({ queryKey: ['notificaciones'] });
    setAbierta(abrir);
  };

  const lista = (
    <div className="notis" style={{ width: 340, maxHeight: 420, overflowY: 'auto' }}>
      {!data?.lista.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aún no tienes notificaciones." /> : (
        <List size="small" dataSource={data.lista} renderItem={(n) => {
          const d = destino(n.enlace, n.sesionId);
          return (
            <List.Item className={n.leida ? '' : 'nueva'} style={{ cursor: d ? 'pointer' : 'default', background: n.leida ? undefined : '#fff8ec', paddingInline: 10 }}
              onClick={() => { if (d) { setAbierta(false); ir(d); } }}>
              <List.Item.Meta title={n.titulo} description={<>{n.cuerpo}<br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>{haceCuanto(n.fecha)}</Typography.Text></>} />
            </List.Item>
          );
        }} />
      )}
    </div>
  );

  return (
    <Popover open={abierta} onOpenChange={alternar} trigger="click" placement="bottomRight" title="Notificaciones" content={lista}>
      <Badge count={data?.sinLeer ?? 0} size="small" overflowCount={9}>
        <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 19, color: '#fff' }} />}
          aria-label={`Notificaciones${data?.sinLeer ? `, ${data.sinLeer} sin leer` : ''}`} aria-expanded={abierta} />
      </Badge>
    </Popover>
  );
}

function InterruptorEnLinea() {
  const { usuario, refrescar, avisar } = useSesion();
  const cambiar = useMutation({
    mutationFn: (enLinea: boolean) => api('/tutor/en-linea', { enLinea }),
    onSuccess: () => refrescar(),
    onError: (e) => avisar(mensajeDe(e), 'mal'),
  });
  const t = usuario?.tutor;
  if (!t || t.verificacion !== 'APROBADO') return null;
  return (
    <Tooltip title="Mientras estés en línea recibes solicitudes bajo demanda">
      <Flex gap={8} align="center" className="interruptor">
        <Switch checked={t.enLinea} loading={cambiar.isPending} onChange={(v) => cambiar.mutate(v)} aria-label="En línea"
          style={{ background: t.enLinea ? '#1c8c7c' : undefined }} />
        <span className="rotulo" style={{ color: '#c4cfe0', fontSize: 14 }}>{t.enLinea ? 'En línea' : 'Desconectado'}</span>
      </Flex>
    </Tooltip>
  );
}

const TIPO_AVISO = { info: 'info', bien: 'success', mal: 'error' } as const;

export function Avisos() {
  const { avisos, cerrarAviso } = useSesion();
  const ir = useNavigate();
  const destino = useDestino();
  return (
    <div className="avisos" aria-live="polite">
      {avisos.map((a) => {
        const d = destino(a.enlace, a.sesionId);
        return (
          <Alert key={a.id} className={`aviso ${a.tono}`} type={TIPO_AVISO[a.tono]} showIcon title={a.titulo} description={a.cuerpo}
            closable={{ onClose: () => cerrarAviso(a.id), 'aria-label': 'Cerrar aviso' }}
            style={{ cursor: d ? 'pointer' : 'default', boxShadow: '0 8px 24px rgba(12, 24, 48, .18)' }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('.ant-alert-close-icon')) return;
              cerrarAviso(a.id);
              if (d) ir(d);
            }} />
        );
      })}
    </div>
  );
}

/** La opción del menú que corresponde a la ruta actual: la más específica que coincida. */
function claveActiva(rol: Rol, ruta: string) {
  const op = MENU[rol]
    .filter((m) => (m.fin ? ruta === m.a : ruta === m.a || ruta.startsWith(`${m.a}/`)))
    .sort((a, b) => b.a.length - a.a.length)[0];
  return op ? [op.a] : [];
}

export default function Marco() {
  const { usuario, salir, enVivo } = useSesion();
  const { pathname } = useLocation();
  if (!usuario) return null;
  const rol = ROL_TEXTO[usuario.rol];
  return (
    <Layout className="marco" style={{ minHeight: '100vh', background: 'transparent' }}>
      <Layout.Header className="barra">
        <div className="barra-interior">
          <NavLink to="/" className="marca" aria-label="TutoresOn-Line, inicio">
            <span className="logo">T</span>
            <span className="nombre">Tutores<em>On-Line</em></span>
          </NavLink>
          <Menu className="menu" mode="horizontal" theme="dark" selectedKeys={claveActiva(usuario.rol, pathname)} aria-label="Principal"
            style={{ flex: 1, minWidth: 0, background: 'transparent', borderBottom: 0 }}
            items={MENU[usuario.rol].map((m) => ({ key: m.a, label: <NavLink to={m.a} end={m.fin}>{m.texto}</NavLink> }))} />
          <Flex className="barra-derecha" gap={12} align="center">
            <InterruptorEnLinea />
            <Campana />
            <NavLink to="/cuenta" className="quien" title={`Mi cuenta · ${enVivo ? 'conectado en tiempo real' : 'reconectando…'}`}>
              <Avatar nombre={usuario.nombre} enLinea={enVivo} />
              <span className="datos"><b>{usuario.nombre}</b><small>{usuario.superior ? 'Administrador principal' : rol}</small></span>
            </NavLink>
            <Button ghost size="small" onClick={salir}>Salir</Button>
          </Flex>
        </div>
      </Layout.Header>
      <Layout.Content className="contenido"><Outlet /></Layout.Content>
    </Layout>
  );
}
