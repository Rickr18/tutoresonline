import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flex, Space, Typography } from 'antd';
import { api, type Materia, type Parametros, type Sesion } from './api';
import { useSesion } from './sesion';
import { Avatar, Insignia, RielSesion } from './ui';
import { dinero, duracion, ESTADO_SESION, fechaHora } from './formato';

export function useMaterias() {
  return useQuery({ queryKey: ['materias'], queryFn: () => api<Materia[]>('/materias'), staleTime: Infinity });
}

/** Valores iniciales del Corte 1, mientras llegan los vigentes del servidor. */
const PARAMETROS_INICIALES: Parametros = {
  COMISION_PCT: 15, PLAZO_RESERVA_H: 12, TURNO_DEMANDA_S: 45, BUSQUEDA_DEMANDA_MIN: 5, GARANTIA_H: 48, PLAZO_DISPUTA_H: 48,
  REEMBOLSO_TOTAL_H: 24, REEMBOLSO_PARCIAL_H: 2, REEMBOLSO_PARCIAL_PCT: 50, PUBLICACION_DIAS: 7, TOLERANCIA_MIN: 15,
  RECORDATORIO_1_H: 24, RECORDATORIO_2_MIN: 15, UMBRAL_REPUTACION: 3, MIN_VALORACIONES: 10,
};

/** Parámetros del negocio vigentes (RF-M11-07): comisión, plazos y umbrales que muestran las pantallas. */
export function useParametros(): Parametros {
  const q = useQuery({ queryKey: ['parametros'], queryFn: () => api<Parametros>('/parametros'), staleTime: 60_000 });
  return { ...PARAMETROS_INICIALES, ...q.data };
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

/** Acciones que le piden algo a quien mira la sesión: la fila lleva el margen ámbar. */
const PIDE_ACCION = ['aceptar', 'iniciar', 'calificar', 'responder-reprogramacion'];

/** La sesión tiene una disputa sin resolver: el pago está congelado y hay conversación con soporte. */
export const casoAbierto = (s: Sesion) => !!s.disputa && s.disputa.estado !== 'RESUELTA';

export function FilaSesion({ s }: { s: Sesion }) {
  const { usuario } = useSesion();
  const soyTutor = usuario?.rol === 'TUTOR';
  const otro = soyTutor ? s.estudiante.nombre : s.tutor?.nombre ?? 'Tutor por asignar';
  const e = ESTADO_SESION[s.estado];
  return (
    <Link to={`/sesiones/${s.id}`} className={`fila-sesion${s.acciones.some((a) => PIDE_ACCION.includes(a)) ? " pide-accion" : ""}`}>
      <Avatar nombre={otro} />
      <span>
        <b>{s.materia.nombre}</b>
        <span>{otro} · {s.tema}</span>
        <RielSesion tipo={s.tipo} estado={s.estado} compacto />
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
