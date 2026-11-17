import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, matchPath, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import es_ES from 'antd/locale/es_ES';
import { temaAntd } from './tema';
import './estilos.css';
import { ErrorApi, type Rol } from './api';
import { ProveedorSesion, useSesion } from './sesion';
import Marco, { Avisos } from './Marco';
import { Cargando } from './ui';
import Acceso from './paginas/Acceso';
import NoEncontrada from './paginas/NoEncontrada';
import Descargar from './paginas/Descargar';
import Recuperar from './paginas/Recuperar';
import { Privacidad, Terminos } from './paginas/Legal';
import Ayuda from './paginas/Ayuda';
import InicioPublico from './paginas/InicioPublico';
import InicioEstudiante from './paginas/estudiante/Inicio';
import InicioSoporte from './paginas/gestion/Inicio';
import Cuenta, { CambioObligatorio } from './paginas/Cuenta';
import Actividad from './paginas/admin/Actividad';
import MateriasAdmin from './paginas/admin/Materias';
import Buscar from './paginas/estudiante/Buscar';
import PerfilTutor from './paginas/estudiante/Tutor';
import Demanda from './paginas/estudiante/Demanda';
import Sesiones from './paginas/Sesiones';
import SesionDetalle from './paginas/SesionDetalle';
import Panel from './paginas/tutor/Panel';
import Perfil from './paginas/tutor/Perfil';
import Disponibilidad from './paginas/tutor/Disponibilidad';
import Ingresos from './paginas/tutor/Ingresos';
import Resumen from './paginas/admin/Resumen';
import Verificaciones from './paginas/admin/Verificaciones';
import Usuarios from './paginas/admin/Usuarios';
import Pagos from './paginas/admin/Pagos';
import Casos from './paginas/gestion/Casos';
import Caso from './paginas/gestion/Caso';
import SesionesEquipo from './paginas/gestion/Sesiones';
import SesionEquipo from './paginas/gestion/Sesion';
import Moderacion from './paginas/gestion/Moderacion';
import Parametros from './paginas/admin/Parametros';
// El manual trae los textos del Corte 1 y Mermaid para los diagramas: se carga solo al abrirlo.
const Manual = lazy(() => import('./paginas/gestion/Manual'));

const consultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (n, e) => !(e instanceof ErrorApi && e.estado >= 400 && e.estado < 500) && n < 2,
    },
  },
});

const INICIO: Record<Rol, string> = { ESTUDIANTE: '/inicio', TUTOR: '/panel', SOPORTE: '/inicio', ADMIN: '/admin' };

/** Rutas privadas de cada rol: sirven para distinguir un 403 (ruta de otro rol) de un 404 (ruta inexistente). El servidor sigue validando los permisos. */
const COMUNES_EQUIPO = ['/casos', '/casos/:id', '/gestion/sesiones', '/gestion/sesiones/:id', '/moderacion', '/manual'];
const RUTAS: Record<Rol, string[]> = {
  ESTUDIANTE: ['/inicio', '/buscar', '/tutores/:id', '/ahora', '/sesiones', '/sesiones/:id', '/cuenta'],
  TUTOR: ['/panel', '/perfil', '/agenda', '/ingresos', '/sesiones', '/sesiones/:id', '/cuenta'],
  SOPORTE: ['/inicio', ...COMUNES_EQUIPO, '/cuenta'],
  ADMIN: ['/admin', '/admin/verificaciones', '/admin/usuarios', '/admin/pagos', '/admin/materias', '/admin/actividad', '/admin/parametros', ...COMUNES_EQUIPO, '/cuenta'],
};
const coincide = (rutas: string[], ruta: string) => rutas.some((r) => matchPath({ path: r, end: true }, ruta));
/** Rutas que no son una pantalla sino un punto de entrada: llevan al inicio del rol. */
const ENTRADAS = ['/', '/ingresar'];

function Rutas() {
  const { usuario, cargando } = useSesion();
  const { pathname } = useLocation();
  // Página pública a la que lleva el QR; no necesita sesión.
  if (pathname === '/descargar') return <Descargar />;
  // Recuperar la contraseña con un código; también es pública.
  if (pathname === '/recuperar') return <Recuperar />;
  // Términos y política de datos: públicas, también las abre la app móvil.
  if (pathname === '/terminos') return <Terminos />;
  if (pathname === '/privacidad') return <Privacidad />;
  if (pathname === '/ayuda') return <Ayuda />;
  if (cargando) return <div className="pantalla-completa"><Cargando texto="Abriendo TutoresOn-Line…" /></div>;
  // Sin sesión: la raíz es la página de inicio pública y /ingresar (y cualquier otra ruta) muestra el acceso.
  if (!usuario) return <Routes><Route path="/" element={<InicioPublico />} /><Route path="*" element={<Acceso />} /></Routes>;
  if (usuario.debeCambiarPassword) return <CambioObligatorio />;

  return (
    <Routes>
      <Route element={<Marco />}>
        {usuario.rol === 'ESTUDIANTE' && <>
          <Route path="/inicio" element={<InicioEstudiante />} />
          <Route path="/buscar" element={<Buscar />} />
          <Route path="/tutores/:id" element={<PerfilTutor />} />
          <Route path="/ahora" element={<Demanda />} />
        </>}
        {usuario.rol === 'TUTOR' && <>
          <Route path="/panel" element={<Panel />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/agenda" element={<Disponibilidad />} />
          <Route path="/ingresos" element={<Ingresos />} />
        </>}
        {(usuario.rol === 'ESTUDIANTE' || usuario.rol === 'TUTOR') && <>
          <Route path="/sesiones" element={<Sesiones />} />
          <Route path="/sesiones/:id" element={<SesionDetalle />} />
        </>}
        {(usuario.rol === 'SOPORTE' || usuario.rol === 'ADMIN') && <>
          {usuario.rol === 'SOPORTE' && <Route path="/inicio" element={<InicioSoporte />} />}
          <Route path="/casos" element={<Casos />} />
          <Route path="/casos/:id" element={<Caso />} />
          <Route path="/gestion/sesiones" element={<SesionesEquipo />} />
          <Route path="/gestion/sesiones/:id" element={<SesionEquipo />} />
          <Route path="/moderacion" element={<Moderacion />} />
          <Route path="/manual" element={<Suspense fallback={<Cargando texto="Abriendo el manual…" />}><Manual /></Suspense>} />
        </>}
        {usuario.rol === 'ADMIN' && <>
          <Route path="/admin" element={<Resumen />} />
          <Route path="/admin/verificaciones" element={<Verificaciones />} />
          <Route path="/admin/usuarios" element={<Usuarios />} />
          <Route path="/admin/pagos" element={<Pagos />} />
          <Route path="/admin/materias" element={<MateriasAdmin />} />
          <Route path="/admin/actividad" element={<Actividad />} />
          <Route path="/admin/parametros" element={<Parametros />} />
        </>}
        <Route path="/cuenta" element={<Cuenta />} />
        <Route path="*" element={<Desconocida rol={usuario.rol} inicio={INICIO[usuario.rol]} />} />
      </Route>
    </Routes>
  );
}

function Desconocida({ rol, inicio }: { rol: Rol; inicio: string }) {
  const { pathname } = useLocation();
  // El administrador no tiene /inicio (es /admin): se trata como alias.
  if (ENTRADAS.includes(pathname) || (rol === 'ADMIN' && pathname === '/inicio')) return <Navigate to={inicio} replace />;
  const deOtroRol = (Object.keys(RUTAS) as Rol[]).some((r) => r !== rol && coincide(RUTAS[r], pathname));
  return <NoEncontrada prohibida={deOtroRol} inicio={inicio} />;
}

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <ConfigProvider locale={es_ES} theme={temaAntd}>
      <QueryClientProvider client={consultas}>
        <BrowserRouter>
          <ProveedorSesion>
            <Rutas />
            <Avisos />
          </ProveedorSesion>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  </StrictMode>,
);
