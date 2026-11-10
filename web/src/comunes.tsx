import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flex, Space, Typography } from 'antd';
import { api, type Materia, type Sesion } from './api';
import { useSesion } from './sesion';
import { Avatar, Insignia } from './ui';
import { dinero, duracion, ESTADO_SESION, fechaHora } from './formato';

export function useMaterias() {
  return useQuery({ queryKey: ['materias'], queryFn: () => api<Materia[]>('/materias'), staleTime: Infinity });
}

export function useSesiones() {
  return useQuery({ queryKey: ['sesiones'], queryFn: () => api<Sesion[]>('/sesiones') });
}

export function Cabecera({ titulo, detalle, children }: { titulo: string; detalle?: ReactNode; children?: ReactNode }) {
  return (
    <Flex className="cabecera" justify="space-between" align="flex-end" gap={16} wrap>
      <div>
        <Typography.Title level={2} style={{ margin: 0 }}>{titulo}</Typography.Title>
        {detalle && <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0', maxWidth: '68ch' }}>{detalle}</Typography.Paragraph>}
      </div>
      {children && <Space wrap className="acciones">{children}</Space>}
    </Flex>
  );
}

/** Cuándo ocurre la sesión; las de bajo demanda no tienen hora hasta que un tutor acepta. */
export function cuando(s: Sesion) {
  return s.inicio ? fechaHora(s.inicio) : `Pedida ${fechaHora(s.creadoEn).toLowerCase()}`;
}

/** La sesión tiene una disputa sin resolver: el pago está congelado y hay conversación con soporte. */
export const casoAbierto = (s: Sesion) => !!s.disputa && s.disputa.estado !== 'RESUELTA';

export function FilaSesion({ s }: { s: Sesion }) {
  const { usuario } = useSesion();
  const soyTutor = usuario?.rol === 'TUTOR';
  const otro = soyTutor ? s.estudiante.nombre : s.tutor?.nombre ?? 'Tutor por asignar';
  const e = ESTADO_SESION[s.estado];
  return (
    <Link to={`/sesiones/${s.id}`} className="fila-sesion">
      <Avatar nombre={otro} />
      <span>
        <b>{s.materia.nombre}</b>
        <span>{otro} · {s.tema}</span>
      </span>
      <span className="cuando">
        <b>{cuando(s)}</b>
        <span>{duracion(s.duracionMin)} · {s.modalidad === 'VIRTUAL' ? 'Virtual' : 'Presencial'}{s.tipo === 'BAJO_DEMANDA' ? ' · Bajo demanda' : ''}</span>
      </span>
      <span className="precio">{dinero(soyTutor ? s.pago?.netoTutor ?? null : s.precio)}</span>
      <span className="estados">
        <Insignia tono={e.tono}>{e.texto}</Insignia>
        {casoAbierto(s) && <Insignia tono="mal">Caso de soporte abierto</Insignia>}
      </span>
    </Link>
  );
}
