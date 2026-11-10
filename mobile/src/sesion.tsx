import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { almacen, alPerderSesion, api, urlTiempoReal, type Usuario } from './api';

export interface Aviso { id: number; titulo: string; cuerpo?: string; tono: 'info' | 'bien' | 'mal'; sesionId?: number | null }

interface Contexto {
  usuario: Usuario | null;
  cargando: boolean;
  enVivo: boolean;
  entrar: (token: string, usuario: Usuario) => Promise<void>;
  /** Guarda el token nuevo que devuelve el cambio de contraseña sin cerrar la sesión. */
  renovar: (token: string, usuario: Usuario) => Promise<void>;
  salir: () => void;
  refrescar: () => Promise<void>;
  avisar: (titulo: string, tono?: Aviso['tono'], cuerpo?: string) => void;
  aviso: Aviso | null;
  cerrarAviso: () => void;
}

const Ctx = createContext<Contexto | null>(null);

export function useSesion() {
  const c = useContext(Ctx);
  if (!c) throw new Error('Falta ProveedorSesion');
  return c;
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enVivo, setEnVivo] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const serie = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cerrarAviso = useCallback(() => setAviso(null), []);
  const mostrar = useCallback((a: Omit<Aviso, 'id'>) => {
    const id = ++serie.current;
    setAviso({ ...a, id });
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso((x) => (x?.id === id ? null : x)), 5000);
  }, []);
  const avisar = useCallback<Contexto['avisar']>((titulo, tono = 'info', cuerpo) => mostrar({ titulo, tono, cuerpo }), [mostrar]);

  const salir = useCallback(() => {
    almacen.guardarToken(null);
    setUsuario(null);
    qc.clear();
  }, [qc]);

  const refrescar = useCallback(async () => { setUsuario(await api<Usuario>('/yo')); }, []);

  const entrar = useCallback(async (token: string, u: Usuario) => {
    await almacen.guardarToken(token);
    qc.clear();
    setUsuario(u);
  }, [qc]);

  const renovar = useCallback(async (token: string, u: Usuario) => {
    await almacen.guardarToken(token);
    setUsuario(u);
  }, []);

  // Recupera la sesión guardada en el teléfono.
  useEffect(() => {
    alPerderSesion(salir);
    almacen.cargar()
      .then(({ token }) => (token ? api<Usuario>('/yo').then(setUsuario) : undefined))
      .catch(() => undefined)
      .finally(() => setCargando(false));
  }, [salir]);

  // Canal en tiempo real; se reconecta al volver la app a primer plano.
  const usuarioId = usuario?.id;
  useEffect(() => {
    if (!usuarioId) return;
    let ws: WebSocket | null = null;
    let reintento: ReturnType<typeof setTimeout>;
    let espera = 1000;
    let cerrado = false;
    const refrescarClaves = (...claves: string[]) => qc.invalidateQueries({ predicate: (q) => claves.includes(String(q.queryKey[0])) });

    const conectar = () => {
      if (cerrado || !almacen.token()) return;
      ws = new WebSocket(urlTiempoReal());
      ws.onopen = () => { espera = 1000; setEnVivo(true); };
      ws.onmessage = (m) => {
        let ev: { tipo: string; titulo?: string; cuerpo?: string; sesionId?: number | null };
        try { ev = JSON.parse(String(m.data)); } catch { return; }
        if (ev.tipo === 'notificacion') {
          mostrar({ titulo: ev.titulo ?? 'Notificación', cuerpo: ev.cuerpo, tono: 'info', sesionId: ev.sesionId });
          refrescarClaves('notificaciones');
        } else if (ev.tipo === 'sesion') refrescarClaves('sesiones', 'sesion', 'ingresos', 'franjas', 'demanda', 'historial');
        else if (ev.tipo === 'demanda') refrescarClaves('demanda');
        else if (ev.tipo === 'disputa') refrescarClaves('sesion', 'sesiones', 'historial', 'caso-mensajes');
        else if (ev.tipo === 'perfil') api<Usuario>('/yo').then(setUsuario).catch(() => undefined);
      };
      ws.onclose = () => {
        setEnVivo(false);
        if (cerrado) return;
        reintento = setTimeout(conectar, espera);
        espera = Math.min(espera * 2, 15000);
      };
      ws.onerror = () => ws?.close();
    };
    conectar();
    const estado = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refrescarClaves('sesiones', 'sesion', 'demanda', 'notificaciones', 'ingresos', 'historial', 'caso-mensajes');
        if (!ws || ws.readyState > 1) { clearTimeout(reintento); espera = 1000; conectar(); }
      }
    });
    return () => { cerrado = true; clearTimeout(reintento); ws?.close(); estado.remove(); setEnVivo(false); };
  }, [usuarioId, qc, mostrar]);

  const valor = useMemo<Contexto>(
    () => ({ usuario, cargando, enVivo, entrar, renovar, salir, refrescar, avisar, aviso, cerrarAviso }),
    [usuario, cargando, enVivo, entrar, renovar, salir, refrescar, avisar, aviso, cerrarAviso],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
