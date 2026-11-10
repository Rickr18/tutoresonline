/* Página de inicio pública (/ sin sesión): qué es la plataforma, cómo funciona, materias y tutores destacados.
   Los datos salen de /api/vitrina y /api/materias, que no piden sesión. */

import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Flex, Row, Skeleton, Statistic, Tag, Typography } from 'antd';
import {
  CalendarOutlined, CheckCircleOutlined, SafetyCertificateOutlined, SearchOutlined, StarOutlined, ThunderboltOutlined, WalletOutlined,
} from '@ant-design/icons';
import { api, type Materia } from '../api';
import { dinero } from '../formato';
import { Avatar, Estrellas } from '../ui';
import { Qr, urlDescarga } from '../qr';
import { EncabezadoPublico, PiePublico } from '../publica';

interface Vitrina {
  tutores: number; materias: number; sesiones: number; calificacion: number | null;
  destacados: { id: number; nombre: string; ciudad: string | null; tarifaHora: number; enLinea: boolean; calificacion: number | null;
    totalCalificaciones: number; materias: string[] }[];
}

const { Title, Paragraph, Text } = Typography;

const PASOS: { icono: ReactNode; titulo: string; texto: string }[] = [
  { icono: <SearchOutlined />, titulo: 'Busca', texto: 'Filtra por materia, precio y calificación. Todos los tutores publicados pasaron la verificación.' },
  { icono: <CalendarOutlined />, titulo: 'Reserva y paga', texto: 'Elige una hora libre de su agenda. El pago queda retenido y el tutor lo recibe 48 horas después de la sesión.' },
  { icono: <StarOutlined />, titulo: 'Aprende y califica', texto: 'Entra a la sala virtual a la hora acordada. Al terminar, los dos se califican y las reseñas se publican juntas.' },
];

function Seccion({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <section className="inicio-seccion">
      <Title level={3} style={{ margin: 0 }}>{titulo}</Title>
      {subtitulo && <Paragraph type="secondary" style={{ margin: '4px 0 18px' }}>{subtitulo}</Paragraph>}
      {children}
    </section>
  );
}

export default function InicioPublico() {
  const ir = useNavigate();
  const vitrina = useQuery({ queryKey: ['vitrina'], queryFn: () => api<Vitrina>('/vitrina') });
  const materias = useQuery({ queryKey: ['materias'], queryFn: () => api<Materia[]>('/materias') });
  const v = vitrina.data;
  const areas = [...new Set((materias.data ?? []).map((m) => m.area))];

  return (
    <div className="inicio-publico">
      <div className="inicio-heroe">
        <div className="inicio-ancho">
          <EncabezadoPublico clara />
          <div className="inicio-heroe-texto">
            <Title style={{ color: '#fff', margin: 0 }}>Un tutor para la materia que te está costando.</Title>
            <Paragraph style={{ color: '#c4cfe0', fontSize: 17, margin: '14px 0 26px', maxWidth: 620 }}>
              Reserva una sesión con un tutor verificado o pide ayuda ahora mismo: tu solicitud llega a los tutores en línea y el primero
              que acepta se conecta contigo.
            </Paragraph>
            <Flex gap={12} wrap>
              <Button type="primary" size="large" icon={<SearchOutlined />} onClick={() => ir('/ingresar?registro=1')}>Buscar tutor</Button>
              <Button size="large" ghost onClick={() => ir('/ingresar?registro=1&rol=TUTOR')}>Quiero ser tutor</Button>
            </Flex>
            <Text style={{ color: '#9fb0c9', display: 'block', marginTop: 14 }}>¿Ya tienes cuenta? <Link to="/ingresar" style={{ color: '#f2a33a' }}>Ingresa</Link></Text>
          </div>
        </div>
      </div>

      <div className="inicio-ancho inicio-cuerpo">
        <Card className="inicio-cifras">
          {v ? (
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}><Statistic title="Tutores verificados" value={v.tutores} /></Col>
              <Col xs={12} md={6}><Statistic title="Materias" value={v.materias} /></Col>
              <Col xs={12} md={6}><Statistic title="Sesiones realizadas" value={v.sesiones} /></Col>
              <Col xs={12} md={6}><Statistic title="Calificación promedio" value={v.calificacion ?? '—'} suffix={v.calificacion ? '/ 5' : undefined} /></Col>
            </Row>
          ) : <Skeleton active paragraph={{ rows: 1 }} />}
        </Card>

        <Seccion titulo="Cómo funciona" subtitulo="Tres pasos, con el pago protegido de principio a fin.">
          <Row gutter={[16, 16]}>
            {PASOS.map((p, i) => (
              <Col xs={24} md={8} key={p.titulo}>
                <Card style={{ height: '100%' }}>
                  <Flex vertical gap={8}>
                    <span className="inicio-icono">{p.icono}</span>
                    <Title level={5} style={{ margin: 0 }}>{i + 1}. {p.titulo}</Title>
                    <Text type="secondary">{p.texto}</Text>
                  </Flex>
                </Card>
              </Col>
            ))}
          </Row>
        </Seccion>

        <Card className="inicio-ahora">
          <Flex gap={18} align="center" wrap>
            <span className="inicio-icono grande"><ThunderboltOutlined /></span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Title level={4} style={{ margin: 0 }}>¿Tienes un parcial mañana? Pide un tutor ahora</Title>
              <Text type="secondary">Tu solicitud llega a todos los tutores en línea de la materia. Si nadie acepta en 45 segundos, no se cobra nada.</Text>
            </div>
            <Button type="primary" size="large" onClick={() => ir('/ingresar?registro=1')}>Pedir ayuda</Button>
          </Flex>
        </Card>

        <Seccion titulo="Tutores destacados" subtitulo="Los mejor calificados por los estudiantes.">
          {v ? (
            <Row gutter={[16, 16]}>
              {v.destacados.map((t) => (
                <Col xs={24} sm={12} lg={6} key={t.id}>
                  <Card className="inicio-tutor" style={{ height: '100%' }}>
                    <Flex vertical gap={10}>
                      <Flex gap={10} align="center">
                        <Avatar nombre={t.nombre} enLinea={t.enLinea} />
                        <div style={{ minWidth: 0 }}>
                          <Text strong>{t.nombre}</Text>
                          {t.ciudad && <Text type="secondary" style={{ display: 'block', fontSize: 13 }}>{t.ciudad}</Text>}
                        </div>
                      </Flex>
                      <Estrellas valor={t.calificacion} total={t.totalCalificaciones} />
                      <Flex gap={4} wrap>{t.materias.slice(0, 3).map((m) => <Tag key={m}>{m}</Tag>)}</Flex>
                      <Text><Text strong>{dinero(t.tarifaHora)}</Text> <Text type="secondary">por hora</Text></Text>
                    </Flex>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : <Skeleton active />}
        </Seccion>

        <Seccion titulo="Materias" subtitulo="Si la tuya no está, los tutores pueden pedir que se agregue.">
          <Flex vertical gap={12}>
            {areas.map((a) => (
              <Flex key={a} gap={8} wrap align="center">
                <Text strong style={{ minWidth: 110 }}>{a}</Text>
                {materias.data!.filter((m) => m.area === a).map((m) => <Tag key={m.id} color="blue">{m.nombre}</Tag>)}
              </Flex>
            ))}
          </Flex>
        </Seccion>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <Card title="¿Enseñas bien una materia?" style={{ height: '100%' }}>
              <Flex vertical gap={10}>
                <Text><SafetyCertificateOutlined /> Te verificamos una vez y apareces en las búsquedas.</Text>
                <Text><CalendarOutlined /> Tú defines tu tarifa y tu disponibilidad.</Text>
                <Text><WalletOutlined /> Recibes el 85 % de cada sesión 48 horas después de dictarla.</Text>
                <Text><CheckCircleOutlined /> Si hay un reclamo, soporte escucha tu versión antes de decidir.</Text>
                <Button type="primary" onClick={() => ir('/ingresar?registro=1&rol=TUTOR')}>Registrarme como tutor</Button>
              </Flex>
            </Card>
          </Col>
          <Col xs={24} md={10}>
            <Card title="Lleva la app en tu teléfono" style={{ height: '100%' }}>
              <Flex gap={16} align="center" wrap>
                <Qr texto={urlDescarga()} tamano={120} />
                <Flex vertical gap={6} style={{ flex: 1, minWidth: 160 }}>
                  <Text type="secondary">Escanea el código: en Android descarga el APK y en iPhone abre la app para dejarla en la pantalla de inicio.</Text>
                  <Link to="/descargar">Ver cómo instalarla</Link>
                </Flex>
              </Flex>
            </Card>
          </Col>
        </Row>

        <PiePublico />
      </div>
    </div>
  );
}
