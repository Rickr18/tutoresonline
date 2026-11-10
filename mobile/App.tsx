import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api, ErrorApi, ES_WEB, type Notificaciones, type Rol } from './src/api';
import { irAVersionWeb } from './src/instalar';
import { ProveedorSesion, useSesion } from './src/sesion';
import { ProveedorNav, useNav, type Pestana } from './src/nav';
import { Cargando } from './src/ui';
import { C } from './src/tema';
import Acceso from './src/pantallas/Acceso';
import Buscar from './src/pantallas/Buscar';
import Tutor from './src/pantallas/Tutor';
import Ahora from './src/pantallas/Ahora';
import Sesiones from './src/pantallas/Sesiones';
import Sesion from './src/pantallas/Sesion';
import Panel from './src/pantallas/Panel';
import Ingresos from './src/pantallas/Ingresos';
import Cuenta from './src/pantallas/Cuenta';
import { CambioObligatorio } from './src/pantallas/Clave';

const consultas = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: (n, err) => !(err instanceof ErrorApi && err.estado >= 400 && err.estado < 500) && n < 2 },
  },
});

const PESTANAS: Record<Exclude<Rol, 'ADMIN' | 'SOPORTE'>, { clave: Pestana; texto: string; icono: keyof typeof Ionicons.glyphMap }[]> = {
  ESTUDIANTE: [
    { clave: 'buscar', texto: 'Buscar', icono: 'search-outline' },
    { clave: 'ahora', texto: 'Ahora', icono: 'flash-outline' },
    { clave: 'sesiones', texto: 'Sesiones', icono: 'calendar-outline' },
    { clave: 'cuenta', texto: 'Cuenta', icono: 'person-circle-outline' },
  ],
  TUTOR: [
    { clave: 'panel', texto: 'Inicio', icono: 'home-outline' },
    { clave: 'sesiones', texto: 'Sesiones', icono: 'calendar-outline' },
    { clave: 'ingresos', texto: 'Ingresos', icono: 'wallet-outline' },
    { clave: 'cuenta', texto: 'Cuenta', icono: 'person-circle-outline' },
  ],
};

function Aviso() {
  const { aviso, cerrarAviso } = useSesion();
  const nav = useNav();
  const margen = useSafeAreaInsets();
  if (!aviso) return null;
  const fondo = aviso.tono === 'mal' ? C.rojo : aviso.tono === 'bien' ? C.verde : C.marino;
  return (
    <Pressable onPress={() => { cerrarAviso(); if (aviso.sesionId) nav.ir({ nombre: 'sesion', id: aviso.sesionId }); }} accessibilityRole="alert"
      style={{ position: 'absolute', left: 12, right: 12, top: margen.top + 8, backgroundColor: fondo, borderRadius: 12, padding: 14, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{aviso.titulo}</Text>
      {aviso.cuerpo ? <Text style={{ color: '#e6ecf5', fontSize: 14, marginTop: 2 }}>{aviso.cuerpo}</Text> : null}
    </Pressable>
  );
}

function Pestanas({ rol }: { rol: Exclude<Rol, 'ADMIN' | 'SOPORTE'> }) {
  const nav = useNav();
  const margen = useSafeAreaInsets();
  const { data } = useQuery({ queryKey: ['notificaciones'], queryFn: () => api<Notificaciones>('/notificaciones'), refetchInterval: 60_000 });
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.marino, paddingBottom: margen.bottom, paddingTop: 6 }} accessibilityRole="tablist">
      {PESTANAS[rol].map((p) => {
        const activa = nav.pestana === p.clave;
        const globo = p.clave === 'cuenta' && data?.sinLeer ? data.sinLeer : 0;
        return (
          <Pressable key={p.clave} onPress={() => nav.cambiarPestana(p.clave)} accessibilityRole="tab" accessibilityState={{ selected: activa }} accessibilityLabel={p.texto}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 6, gap: 2 }}>
            <Ionicons name={p.icono} size={22} color={activa ? C.ambar : '#9fb0c9'} />
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: activa ? '#fff' : '#9fb0c9' }}>{p.texto}</Text>
            {globo > 0 && (
              <View style={{ position: 'absolute', top: 2, right: '28%', backgroundColor: C.ambar, borderRadius: 9, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: C.marino }}>{globo > 9 ? '9+' : globo}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Contenido() {
  const nav = useNav();
  const tope = nav.pila[nav.pila.length - 1];
  if (tope?.nombre === 'tutor') return <Tutor key={`t${tope.id}`} id={tope.id} />;
  if (tope?.nombre === 'sesion') return <Sesion key={`s${tope.id}`} id={tope.id} />;
  switch (nav.pestana) {
    case 'buscar': return <Buscar />;
    case 'ahora': return <Ahora />;
    case 'sesiones': return <Sesiones />;
    case 'panel': return <Panel />;
    case 'ingresos': return <Ingresos />;
    default: return <Cuenta />;
  }
}

function Raiz() {
  const { usuario, cargando } = useSesion();
  const margen = useSafeAreaInsets();
  const equipo = usuario?.rol === 'ADMIN' || usuario?.rol === 'SOPORTE';
  // En la PWA, el equipo (que comparte la sesión con la web) trabaja desde la versión web completa.
  useEffect(() => { if (ES_WEB && equipo) irAVersionWeb(); }, [equipo]);
  if (cargando) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.fondo }}><Cargando texto="Abriendo TutoresOn-Line…" /></View>;
  if (!usuario || usuario.rol === 'ADMIN' || usuario.rol === 'SOPORTE') {
    return <View style={{ flex: 1, paddingTop: margen.top, backgroundColor: C.marino }}><StatusBar style="light" /><Acceso /></View>;
  }
  if (usuario.debeCambiarPassword) {
    return <View style={{ flex: 1, paddingTop: margen.top, backgroundColor: C.marino }}><StatusBar style="light" /><CambioObligatorio /></View>;
  }
  const rol = usuario.rol;
  return (
    <ProveedorNav key={usuario.id} inicial={rol === 'TUTOR' ? 'panel' : 'buscar'}>
      <View style={{ flex: 1, backgroundColor: C.fondo }}>
        <View style={{ height: margen.top, backgroundColor: C.marino }} />
        <StatusBar style="light" />
        <View style={{ flex: 1 }}><Contenido /></View>
        <Pestanas rol={rol} />
        <Aviso />
      </View>
    </ProveedorNav>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={consultas}>
        <ProveedorSesion>
          <Raiz />
        </ProveedorSesion>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
