import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MenuProps } from 'antd';
import { Alert, Badge, Breadcrumb, Button, Drawer, Dropdown, Empty, Flex, Grid, Layout, List, Menu, Popover, Switch, Tooltip, Typography } from 'antd';
import {
  BellOutlined, BookOutlined, CalendarOutlined, CustomerServiceOutlined, DashboardOutlined, HistoryOutlined, HomeOutlined,
  IdcardOutlined, LogoutOutlined, MenuOutlined, QuestionCircleOutlined, ReadOutlined, SafetyOutlined, ScheduleOutlined,
  SearchOutlined, SlidersOutlined, TeamOutlined, ThunderboltOutlined, UserOutlined, WalletOutlined,
} from '@ant-design/icons';
import { api, type Notificaciones, type Rol } from './api';
import { useSesion } from './sesion';
import { Avatar, MarcaLogo, Pulso, mensajeDe } from './ui';
import { haceCuanto, ROL_TEXTO } from './formato';
import { color } from './tokens';

interface Opcion { a: string; texto: string; icono: ReactNode; fin?: boolean; destacada?: boolean }
interface Grupo { rotulo?: string; opciones: Opcion[] }

const OP = {
  inicio: (a: string): Opcion => ({ a, texto: a === '/admin' ? 'Resumen' : 'Inicio', icono: a === '/admin' ? <DashboardOutlined /> : <HomeOutlined />, fin: a === '/admin' }),
  casos: { a: '/casos', texto: 'Casos', icono: <CustomerServiceOutlined /> },
  sesionesEquipo: { a: '/gestion/sesiones', texto: 'Sesiones', icono: <CalendarOutlined /> },
  moderacion: { a: '/moderacion', texto: 'Moderación', icono: <SafetyOutlined /> },
  manual: { a: '/manual', texto: 'Manual', icono: <ReadOutlined /> },
} satisfies Record<string, Opcion | ((a: string) => Opcion)>;

const MENU: Record<Rol, Grupo[]> = {
  ESTUDIANTE: [{ opciones: [
    { a: '/inicio', texto: 'Inicio', icono: <HomeOutlined /> },
    { a: '/buscar', texto: 'Buscar tutor', icono: <SearchOutlined /> },
    { a: '/ahora', texto: 'Tutor ahora', icono: <ThunderboltOutlined />, destacada: true },
    { a: '/sesiones', texto: 'Mis sesiones', icono: <CalendarOutlined /> },
  ] }],
  TUTOR: [{ opciones: [
    { a: '/panel', texto: 'Inicio', icono: <HomeOutlined /> },
    { a: '/sesiones', texto: 'Sesiones', icono: <CalendarOutlined /> },
    { a: '/agenda', texto: 'Disponibilidad', icono: <ScheduleOutlined /> },
    { a: '/ingresos', texto: 'Ingresos', icono: <WalletOutlined /> },
    { a: '/perfil', texto: 'Perfil', icono: <UserOutlined /> },
  ] }],
  SOPORTE: [
    { rotulo: 'Atención', opciones: [OP.inicio('/inicio'), OP.casos, OP.sesionesEquipo, OP.moderacion] },
    { rotulo: 'Consulta', opciones: [OP.manual] },
  ],
  ADMIN: [
    { rotulo: 'Operación', opciones: [OP.inicio('/admin'), OP.casos, OP.sesionesEquipo, OP.moderacion] },
    { rotulo: 'Personas', opciones: [
      { a: '/admin/verificaciones', texto: 'Verificar', icono: <IdcardOutlined /> },
      { a: '/admin/usuarios', texto: 'Usuarios', icono: <TeamOutlined /> },
    ] },
    { rotulo: 'Negocio', opciones: [
      { a: '/admin/pagos', texto: 'Pagos', icono: <WalletOutlined /> },
      { a: '/admin/materias', texto: 'Materias', icono: <BookOutlined /> },
      { a: '/admin/parametros', texto: 'Parámetros', icono: <SlidersOutlined /> },
    ] },
    { rotulo: 'Control', opciones: [
      { a: '/admin/actividad', texto: 'Actividad', icono: <HistoryOutlined /> },
      OP.manual,
    ] },
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
            <List.Item className={n.leida ? '' : 'nueva'} style={{ cursor: d ? 'pointer' : 'default', background: n.leida ? undefined : color.ambarPapel, paddingInline: 10 }}
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
        <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 19, color: color.marino }} />}
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
          style={{ background: t.enLinea ? color.verde : undefined }} />
        <span className="etiqueta-linea" style={{ color: color.tenue, fontSize: 14 }}>
          {t.enLinea ? <Flex gap={6} align="center"><Pulso />En línea</Flex> : 'Desconectado'}
        </span>
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

const planas = (rol: Rol) => MENU[rol].flatMap((g) => g.opciones);
const coincide = (m: Opcion, ruta: string) => (m.fin ? ruta === m.a : ruta === m.a || ruta.startsWith(`${m.a}/`));

/** La opción del menú que corresponde a la ruta actual: la más específica que coincida. */
function opcionActiva(rol: Rol, ruta: string) {
  return planas(rol).filter((m) => coincide(m, ruta)).sort((a, b) => b.a.length - a.a.length)[0];
}

/** Migas de pan: la opción del menú y, si la ruta es un detalle, su nombre. */
function migas(rol: Rol, ruta: string) {
  if (ruta === '/cuenta') return [{ title: 'Mi cuenta' }];
  if (ruta.startsWith('/tutores/')) return [{ title: <Link to="/buscar">Buscar tutor</Link> }, { title: 'Perfil del tutor' }];
  const op = opcionActiva(rol, ruta);
  if (!op) return [];
  const detalle = ruta.slice(op.a.length).replace(/^\//, '');
  if (!detalle) return [{ title: op.texto }];
  return [{ title: <Link to={op.a}>{op.texto}</Link> }, { title: op.a === '/casos' ? `Caso #${detalle}` : `Sesión #${detalle}` }];
}

const PLEGADO = 'tutoresonline.menu';
const leerPlegado = () => { try { return localStorage.getItem(PLEGADO) === '1'; } catch { return false; } };
const guardarPlegado = (v: boolean) => { try { localStorage.setItem(PLEGADO, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };

function Lateral({ rol, ruta, plegado, alIr }: { rol: Rol; ruta: string; plegado: boolean; alIr?: () => void }) {
  const activa = opcionActiva(rol, ruta);
  const items = MENU[rol].flatMap((g, i): NonNullable<MenuProps['items']> => {
    const hijos = g.opciones.map((m) => ({
      key: m.a, icon: m.icono, className: m.destacada ? 'opcion-destacada' : undefined,
      label: <NavLink to={m.a} end={m.fin} onClick={alIr}>{m.texto}</NavLink>,
    }));
    return g.rotulo ? [{ type: 'group' as const, key: `g${i}`, label: plegado ? '' : g.rotulo, children: hijos }] : hijos;
  });
  return (
    <Menu className="menu" mode="inline" theme="dark" inlineCollapsed={plegado} selectedKeys={activa ? [activa.a] : []} aria-label="Principal"
      style={{ background: 'transparent', borderInlineEnd: 0 }} items={items} />
  );
}

function Pie() {
  const version = useQuery({ queryKey: ['version'], queryFn: () => api<{ ultima: string | null }>('/version'), staleTime: Infinity, retry: false });
  return (
    <Layout.Footer className="pie-marco">
      <Flex gap="4px 16px" wrap justify="space-between" align="center">
        <span>TutoresOn-Line · {new Date().getFullYear()}{version.data?.ultima ? ` · App Android v${version.data.ultima}` : ''}</span>
        <Flex gap={16} wrap>
          <Link to="/ayuda">Ayuda</Link>
          <Link to="/terminos">Términos y condiciones</Link>
          <Link to="/privacidad">Política de privacidad</Link>
        </Flex>
      </Flex>
    </Layout.Footer>
  );
}

export default function Marco() {
  const { usuario, salir, enVivo } = useSesion();
  const { pathname } = useLocation();
  const ir = useNavigate();
  const pantallas = Grid.useBreakpoint();
  const [plegadoManual, setPlegadoManual] = useState(leerPlegado);
  const [abierto, setAbierto] = useState(false);
  if (!usuario) return null;
  const rol = ROL_TEXTO[usuario.rol];
  const escritorio = !!pantallas.md;
  // Por debajo de 1200 px (xl) el menú se pliega solo; el botón lo abre o lo cierra a mano.
  const plegado = escritorio && (pantallas.xl ? plegadoManual : true);
  const alternar = () => {
    if (!escritorio) { setAbierto(true); return; }
    setPlegadoManual(!plegado);
    guardarPlegado(!plegado);
  };
  const cuenta = [
    { key: 'cuenta', icon: <UserOutlined />, label: 'Mi cuenta', onClick: () => ir('/cuenta') },
    { key: 'ayuda', icon: <QuestionCircleOutlined />, label: 'Ayuda', onClick: () => ir('/ayuda') },
    { type: 'divider' as const },
    { key: 'salir', icon: <LogoutOutlined />, label: 'Cerrar sesión', danger: true, onClick: () => salir() },
  ];

  return (
    <Layout className="marco" style={{ minHeight: '100vh', background: 'transparent' }}>
      {escritorio ? (
        <Layout.Sider className="lateral" width={232} collapsedWidth={72} collapsed={plegado} trigger={null} theme="dark">
          <NavLink to="/" className="marca" aria-label="TutoresOn-Line, inicio"><MarcaLogo clara /></NavLink>
          <Lateral rol={usuario.rol} ruta={pathname} plegado={plegado} />
        </Layout.Sider>
      ) : (
        <Drawer open={abierto} onClose={() => setAbierto(false)} placement="left" size={260} className="lateral-movil" closable={false}>
          <NavLink to="/" className="marca" aria-label="TutoresOn-Line, inicio" onClick={() => setAbierto(false)}><MarcaLogo clara /></NavLink>
          <Lateral rol={usuario.rol} ruta={pathname} plegado={false} alIr={() => setAbierto(false)} />
        </Drawer>
      )}
      <Layout style={{ background: 'transparent', minWidth: 0 }}>
        <Layout.Header className="barra">
          <Flex align="center" gap={12} style={{ minWidth: 0 }}>
            <Button type="text" icon={<MenuOutlined />} onClick={alternar}
              aria-label={escritorio ? (plegado ? 'Expandir el menú' : 'Plegar el menú') : 'Abrir el menú'} />
            <Breadcrumb className="migas" items={migas(usuario.rol, pathname)} />
          </Flex>
          <Flex className="barra-derecha" gap={12} align="center">
            <InterruptorEnLinea />
            <Campana />
            <Dropdown menu={{ items: cuenta }} trigger={['click']} placement="bottomRight">
              <button type="button" className="quien" aria-label="Menú de la cuenta" title={enVivo ? 'Conectado en tiempo real' : 'Reconectando…'}>
                <Avatar nombre={usuario.nombre} />
                <span className="datos"><b>{usuario.nombre}</b><small>{usuario.superior ? 'Administrador principal' : rol}</small></span>
              </button>
            </Dropdown>
          </Flex>
        </Layout.Header>
        <Layout.Content className="contenido"><Outlet /></Layout.Content>
        {escritorio && <Pie />}
      </Layout>
    </Layout>
  );
}
