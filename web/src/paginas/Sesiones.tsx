import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Flex, Tabs } from 'antd';
import type { EstadoSesion } from '../api';
import { useSesion } from '../sesion';
import { Cabecera, FilaSesion, useSesiones } from '../comunes';
import { Alerta, Cargando, Vacio, mensajeDe } from '../ui';

const ACTIVAS: EstadoSesion[] = ['PENDIENTE_ACEPTACION', 'BUSCANDO_TUTOR', 'CONFIRMADA', 'EN_CURSO'];

export default function Sesiones() {
  const { usuario } = useSesion();
  const ir = useNavigate();
  const sesiones = useSesiones();
  const [pestana, setPestana] = useState<'activas' | 'historial'>('activas');
  const soyTutor = usuario?.rol === 'TUTOR';

  const activas = (sesiones.data ?? []).filter((s) => ACTIVAS.includes(s.estado))
    .sort((a, b) => Date.parse(a.inicio ?? a.creadoEn) - Date.parse(b.inicio ?? b.creadoEn));
  const historial = (sesiones.data ?? []).filter((s) => !ACTIVAS.includes(s.estado))
    .sort((a, b) => Date.parse(b.inicio ?? b.creadoEn) - Date.parse(a.inicio ?? a.creadoEn));
  const lista = pestana === 'activas' ? activas : historial;
  const rotulo = (texto: string, n: number) => <Flex gap={8} align="center">{texto}<Badge count={n} showZero color="#e9edf3" style={{ color: '#4a5567' }} /></Flex>;

  return (
    <>
      <Cabecera titulo={soyTutor ? 'Sesiones' : 'Mis sesiones'}>
        {!soyTutor && <Button type="primary" onClick={() => ir('/buscar')}>Reservar una sesión</Button>}
      </Cabecera>
      <Tabs activeKey={pestana} onChange={(k) => setPestana(k as typeof pestana)} items={[
        { key: 'activas', label: rotulo('Activas', activas.length) },
        { key: 'historial', label: rotulo('Historial', historial.length) },
      ]} />
      {sesiones.isPending && <Cargando />}
      {sesiones.isError && <Alerta>{mensajeDe(sesiones.error)}</Alerta>}
      {sesiones.data && lista.length === 0 && (pestana === 'activas'
        ? <Vacio titulo="No tienes sesiones activas">{soyTutor ? 'Las solicitudes que recibas aparecen aquí y en el inicio.' : 'Busca un tutor y reserva, o pide ayuda ahora mismo.'}</Vacio>
        : <Vacio titulo="Todavía no hay sesiones en el historial" />)}
      <div className="lista">{lista.map((s) => <FilaSesion key={s.id} s={s} />)}</div>
    </>
  );
}
