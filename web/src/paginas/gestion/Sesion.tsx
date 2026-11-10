import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Flex, List, Row, Space, Typography } from 'antd';
import { api, type SesionEquipo } from '../../api';
import { LineaTiempo } from '../../caso';
import { Alerta, Cargando, Estrellas, Insignia, mensajeDe } from '../../ui';
import { ESTADO_CASO, fechaHora } from '../../formato';
import { FichaSesion } from './piezas';

export default function SesionEquipoDetalle() {
  const { id } = useParams();
  const volver = useNavigate();
  const sesion = useQuery({ queryKey: ['gestion', 'sesion', id], queryFn: () => api<SesionEquipo>(`/gestion/sesiones/${id}`), refetchInterval: 15_000 });

  if (sesion.isPending) return <Cargando />;
  if (sesion.isError) return <Alerta>{mensajeDe(sesion.error)}</Alerta>;
  const s = sesion.data;

  return (
    <>
      <Button type="link" onClick={() => volver(-1)} style={{ padding: 0, marginBottom: 14 }}>← Volver</Button>
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={14}>
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <FichaSesion s={s} />
            {s.disputaId && s.estadoDisputa && (
              <Alerta tono={s.estadoDisputa === 'RESUELTA' ? 'info' : 'espera'}
                titulo={`Esta sesión tiene el caso de soporte #${s.disputaId} (${ESTADO_CASO[s.estadoDisputa].texto.toLowerCase()})`}>
                <Link to={`/casos/${s.disputaId}`}>Abrir el caso</Link>
              </Alerta>
            )}
            <Card title="Calificaciones">
              {s.calificaciones.length === 0 ? <Typography.Text type="secondary">Nadie ha calificado esta sesión.</Typography.Text> : (
                <List itemLayout="vertical" dataSource={s.calificaciones} renderItem={(c) => (
                  <List.Item className="resena" style={{ paddingInline: 0 }}>
                    <Flex justify="space-between" gap={8}>
                      <span><b>{c.autor}</b> <Typography.Text type="secondary" style={{ fontSize: 13 }}>({c.deEstudiante ? 'estudiante' : 'tutor'})</Typography.Text></span>
                      {!c.publicada && <Insignia tono="neutro">Sin publicar</Insignia>}
                    </Flex>
                    <Estrellas valor={c.puntaje} />
                    {c.comentario && <Typography.Paragraph style={{ margin: '6px 0 0' }}>{c.comentario}</Typography.Paragraph>}
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>{fechaHora(c.fecha)}</Typography.Text>
                  </List.Item>
                )} />
              )}
            </Card>
          </Space>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Qué pasó, minuto a minuto">
            <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
              Cada cambio de estado, pago, apertura de la sala y gestión de soporte, con la hora exacta en hora de Colombia.
            </Typography.Paragraph>
            <LineaTiempo eventos={s.eventos} />
          </Card>
        </Col>
      </Row>
    </>
  );
}
