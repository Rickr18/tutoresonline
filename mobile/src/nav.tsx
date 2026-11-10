/* Navegación propia: pestañas por rol y una pila de pantallas encima. Sin dependencias nativas extra. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler } from 'react-native';

export type Pestana = 'buscar' | 'ahora' | 'sesiones' | 'panel' | 'ingresos' | 'cuenta';
export type Ruta = { nombre: 'tutor'; id: number } | { nombre: 'sesion'; id: number };

interface Nav {
  pestana: Pestana;
  pila: Ruta[];
  cambiarPestana: (p: Pestana) => void;
  ir: (r: Ruta) => void;
  atras: () => void;
  reemplazar: (r: Ruta) => void;
}

const Ctx = createContext<Nav | null>(null);
export function useNav() {
  const c = useContext(Ctx);
  if (!c) throw new Error('Falta ProveedorNav');
  return c;
}

export function ProveedorNav({ inicial, children }: { inicial: Pestana; children: ReactNode }) {
  const [pestana, setPestana] = useState<Pestana>(inicial);
  const [pila, setPila] = useState<Ruta[]>([]);

  const cambiarPestana = useCallback((p: Pestana) => { setPestana(p); setPila([]); }, []);
  const ir = useCallback((r: Ruta) => setPila((a) => [...a, r]), []);
  const atras = useCallback(() => setPila((a) => a.slice(0, -1)), []);
  const reemplazar = useCallback((r: Ruta) => setPila((a) => [...a.slice(0, -1), r]), []);

  // Botón atrás de Android: primero cierra pantallas apiladas, luego vuelve a la pestaña inicial.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pila.length) { atras(); return true; }
      if (pestana !== inicial) { setPestana(inicial); return true; }
      return false;
    });
    return () => sub.remove();
  }, [pila.length, pestana, inicial, atras]);

  const valor = useMemo(() => ({ pestana, pila, cambiarPestana, ir, atras, reemplazar }), [pestana, pila, cambiarPestana, ir, atras, reemplazar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
