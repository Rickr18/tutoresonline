import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, alPerderSesion, tokenGuardado, type Usuario } from './api';

interface Aviso { id: number; titulo: string; cuerpo?: string; tono: 'info' | 'bien' | 'mal'; sesionId?: number | null; enlace?: string | null }

interface Contexto {
  usuario: Usuario | null;
  cargando: boolean;
  enVivo: boolean;
  entrar: (token: string, usuario: Usuario) => void;
  /** Guarda el token nuevo que devuelve el cambio de contraseña sin cerrar la sesión. */
  renovar: (token: string, usuario: Usuario) => void;
  salir: () => void;
  refrescar: () => Promise<void>;
  avisar: (titulo: string, tono?: Aviso['tono'], cuerpo?: string) => void;
  avisos: Aviso[];
  cerrarAviso: (id: number) => void;
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
  const [cargando, setCargando] = useState(() => !!tokenGuardado.leer());
  const [enVivo, setEnVivo] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const serie = useRef(0);

  const cerrarAviso = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);

  const mostrar = useCallback((a: Omit<Aviso, 'id'>) => {
    const id = ++serie.current;
    setAvisos((lista) => [...lista.slice(-3), { ...a, id }]);
    setTimeout(() => cerrarAviso(id), 6000);
  }, [cerrarAviso]);

  const avisar = useCallback<Contexto['avisar']>((titulo, tono = 'info', cuerpo) => mostrar({ titulo, tono, cuerpo }), [mostrar]);

  const salir = useCallback(() => {
    tokenGuardado.borrar();
    setUsuario(null);
    qc.clear();
  }, [qc]);

  const refrescar = useCallback(async () => {
    setUsuario(await api<Usuario>('/yo'));
  }, []);

  const entrar = useCallback((token: string, u: Usuario) => {
    tokenGuardado.guardar(token);
    qc.clear();
    setUsuario(u);
  }, [qc]);

  const renovar = useCallback((token: string, u: Usuario) => {
    tokenGuardado.guardar(token);
    setUsuario(u);
  }, []);

  // Recupera la sesión guardada al abrir la página.
  useEffect(() => {
    alPerderSesion(salir);
    if (!tokenGuardado.leer()) return;
    api<Usuario>('/yo').then(setUsuario).catch(() => tokenGuardado.borrar()).finally(() => setCargando(false));
  }, [salir]);

  // Canal en tiempo real: el servidor avisa y la pantalla vuelve a pedir solo lo que cambió.
  const usuarioId = usuario?.id;
  useEffect(() => {
    if (!usuarioId) return;
    let ws: WebSocket | null = null;
    let reintento: ReturnType<typeof setTimeout>;
    let espera = 1000;
    let cerrado = false;

    const refrescarClaves = (...claves: string[]) =>
      qc.invalidateQueries({ predicate: (q) => claves.includes(String(q.queryKey[0])) });

    const conectar = () => {
      const token = tokenGuardado.leer();
      if (!token || cerrado) return;
      const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${protocolo}://${location.host}/ws?token=${encodeURIComponent(token)}`);
      ws.onopen = () => { espera = 1000; setEnVivo(true); };
      ws.onmessage = (m) => {
        let e: { tipo: string; titulo?: string; cuerpo?: string; sesionId?: number | null; enlace?: string | null };
        try { e = JSON.parse(m.data); } catch { return; }
        if (e.tipo === 'notificacion') {
          mostrar({ titulo: e.titulo ?? 'Notificación', cuerpo: e.cuerpo, tono: 'info', sesionId: e.sesionId, enlace: e.enlace });
          refrescarClaves('notificaciones');
        } else if (e.tipo === 'sesion') {
          refrescarClaves('sesiones', 'sesion', 'ingresos', 'franjas', 'demanda', 'historial', 'gestion');
        } else if (e.tipo === 'disputa') {
          refrescarClaves('sesion', 'sesiones', 'historial', 'caso-mensajes', 'gestion');
        } else if (e.tipo === 'demanda') {
          refrescarClaves('demanda');
        } else if (e.tipo === 'perfil') {
          api<Usuario>('/yo').then(setUsuario).catch(() => undefined);
        }
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
    return () => { cerrado = true; clearTimeout(reintento); ws?.close(); setEnVivo(false); };
  }, [usuarioId, qc, mostrar]);

  const valor = useMemo<Contexto>(
    () => ({ usuario, cargando, enVivo, entrar, renovar, salir, refrescar, avisar, avisos, cerrarAviso }),
    [usuario, cargando, enVivo, entrar, renovar, salir, refrescar, avisar, avisos, cerrarAviso],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
