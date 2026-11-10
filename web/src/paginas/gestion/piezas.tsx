/* Piezas de las pantallas del equipo de soporte y administración. */

import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Descriptions, Flex, Row, Space, Statistic, Typography } from 'antd';
import type { SesionEquipo } from '../../api';
import { EnlaceSala } from '../../caso';
import { Insignia } from '../../ui';
import { dinero, duracion, ESTADO_PAGO, ESTADO_SESION, fechaHora, hora } from '../../formato';

function diferencia(min: number | null) {
  if (min === null) return null;
  if (Math.abs(min) <= 1) return { texto: 'a la hora', tono: 'bien' };
  return min > 0 ? { texto: `${duracion(min)} tarde`, tono: min > 10 ? 'mal' : 'espera' } : { texto: `${duracion(-min)} antes`, tono: 'neutro' };
}

// El contenido de Descriptions es una fila flexible: cada parte va en su propio bloque para que no se pegue.
const conCorreo = (nombre: string, email: string | null) => (
  <div>{nombre}<Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>{email}</Typography.Text></div>
);

/** Datos de la sesión con lo programado frente a lo que pasó de verdad. */
export function FichaSesion({ s, enlaceDetalle }: { s: SesionEquipo; enlaceDetalle?: boolean }) {
  const ir = useNavigate();
  const t = s.tiempos;
  const retraso = diferencia(t.retrasoMin);
  const corta = t.minutosReales !== null && t.minutosReales < s.duracionMin - 5;
  const e = ESTADO_SESION[s.estado];
  return (
    <Card title={`Sesión #${s.id} · ${s.materia.nombre}`} extra={<Insignia tono={e.tono}>{e.texto}</Insignia>}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }} items={[
          { key: 'est', label: 'Estudiante', children: conCorreo(s.estudiante.nombre, s.estudiante.email) },
          { key: 'tut', label: 'Tutor', children: s.tutor ? conCorreo(s.tutor.nombre, s.tutor.email) : 'Sin asignar' },
          { key: 'tipo', label: 'Tipo', children: `${s.tipo === 'BAJO_DEMANDA' ? 'Tutor ahora' : 'Reserva programada'} · ${s.modalidad === 'VIRTUAL' ? 'Virtual' : 'Presencial'}` },
          { key: 'tema', label: 'Tema', children: s.tema },
        ]} />
        <Row gutter={[12, 12]} className="tiempos">
          <Col xs={24} sm={12}>
            <Card size="small" style={{ background: '#f7f9fc', height: '100%' }}>
              <Statistic title="Programada" value={t.programadoInicio ? `${fechaHora(t.programadoInicio)} – ${hora(t.programadoFin!)}` : 'Sin hora fija'}
                styles={{ content: { fontSize: 16, fontWeight: 600 } }} />
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>{duracion(s.duracionMin)} reservada</Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card size="small" style={{ background: '#f7f9fc', height: '100%' }}>
              <Statistic title="Real" value={t.realInicio ? `${fechaHora(t.realInicio)} – ${t.realFin ? hora(t.realFin) : 'en curso'}` : 'No se inició'}
                styles={{ content: { fontSize: 16, fontWeight: 600 } }} />
              <Flex gap={6} wrap align="center">
                {t.minutosReales !== null && <Typography.Text type={corta ? 'danger' : 'secondary'} style={{ fontSize: 13 }}>{duracion(t.minutosReales)} de clase</Typography.Text>}
                {retraso && <Insignia tono={retraso.tono}>Inició {retraso.texto}</Insignia>}
              </Flex>
            </Card>
          </Col>
        </Row>
        {s.pago && (
          <Descriptions size="small" column={{ xs: 1, sm: 2 }} items={[
            { key: 'pago', label: 'Pago', children: <Flex gap={6} wrap align="center">{dinero(s.pago.monto)} · {s.pago.metodo} <Insignia tono={ESTADO_PAGO[s.pago.estado].tono}>{ESTADO_PAGO[s.pago.estado].texto}</Insignia></Flex> },
            { key: 'ref', label: 'Referencia', children: <Typography.Text copyable>{s.pago.referencia}</Typography.Text> },
            ...(s.pago.reembolso > 0 ? [{ key: 'dev', label: 'Devuelto al estudiante', children: dinero(s.pago.reembolso) }] : []),
            { key: 'tutor', label: 'Para el tutor', children: <span>{dinero(s.pago.netoTutor)} <Typography.Text type="secondary">(comisión {dinero(s.pago.comision)})</Typography.Text></span> },
          ]} />
        )}
        {s.canceladaPor && <Typography.Text type="secondary" style={{ fontSize: 13 }}>Cancelada por {s.canceladaPor}.</Typography.Text>}
        {(s.enlace || enlaceDetalle) && (
          <Flex gap={8} wrap>
            {s.enlace && <EnlaceSala sesionId={s.id} cual="CLASE" href={s.enlace} boton="normal">Sala de la clase</EnlaceSala>}
            {enlaceDetalle && <Button size="small" onClick={() => ir(`/gestion/sesiones/${s.id}`)}>Ver la sesión completa</Button>}
          </Flex>
        )}
      </Space>
    </Card>
  );
}
