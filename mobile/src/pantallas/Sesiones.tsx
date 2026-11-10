import { useState } from 'react';
import type { EstadoSesion } from '../api';
import { FilaSesion, Pantalla, casoAbierto, useSesiones } from '../comunes';
import { useSesion } from '../sesion';
import { Alerta, Cargando, Segmentos, Vacio, mensajeDe } from '../ui';

const ACTIVAS: EstadoSesion[] = ['PENDIENTE_ACEPTACION', 'BUSCANDO_TUTOR', 'CONFIRMADA', 'EN_CURSO'];

export default function Sesiones() {
  const { usuario } = useSesion();
  const sesiones = useSesiones();
  const [vista, setVista] = useState<'activas' | 'historial'>('activas');
  const fechaDe = (s: { inicio: string | null; creadoEn: string }) => Date.parse(s.inicio ?? s.creadoEn);
  // Una sesión terminada con un caso de soporte sin resolver sigue activa: tiene algo pendiente.
  const esActiva = (s: Parameters<typeof casoAbierto>[0]) => ACTIVAS.includes(s.estado) || casoAbierto(s);
  const activas = (sesiones.data ?? []).filter(esActiva).sort((a, b) => fechaDe(a) - fechaDe(b));
  const historial = (sesiones.data ?? []).filter((s) => !esActiva(s)).sort((a, b) => fechaDe(b) - fechaDe(a));
  const lista = vista === 'activas' ? activas : historial;

  return (
    <Pantalla titulo={usuario?.rol === 'TUTOR' ? 'Sesiones' : 'Mis sesiones'} refrescando={sesiones.isRefetching} alRefrescar={() => sesiones.refetch()}>
      <Segmentos valor={vista} cambiar={setVista}
        opciones={[{ valor: 'activas', texto: `Activas (${activas.length})` }, { valor: 'historial', texto: `Historial (${historial.length})` }]} />
      {sesiones.isPending && <Cargando />}
      {sesiones.isError && <Alerta>{mensajeDe(sesiones.error)}</Alerta>}
      {sesiones.data && lista.length === 0 && (
        <Vacio titulo={vista === 'activas' ? 'No tienes sesiones activas' : 'El historial está vacío'}>
          {vista === 'activas' ? 'Las reservas y solicitudes en curso aparecen aquí.' : undefined}
        </Vacio>
      )}
      {lista.map((s) => <FilaSesion key={s.id} s={s} />)}
    </Pantalla>
  );
}
