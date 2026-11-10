import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Col, Descriptions, Flex, Form, Input, List, Row, Segmented, Select, Space, Tag, Typography } from 'antd';
import { api, type Sesion, type Tutor } from '../../api';
import { useSesion } from '../../sesion';
import { Alerta, Avatar, Campo, Cargando, Estrellas, FormularioPago, Modal, mensajeDe, type DatosPago } from '../../ui';
import { claveDia, DIAS, dinero, duracion, fecha, fechaLarga, haceCuanto, hora, horaDelDia, MODALIDAD } from '../../formato';

const DURACIONES = [60, 90, 120];

function Reserva({ tutor, inicio, cerrar }: { tutor: Tutor; inicio: string; cerrar: () => void }) {
  const navegar = useNavigate();
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const [materiaId, setMateriaId] = useState(tutor.materias[0]?.id ?? 0);
  const [duracionMin, setDuracionMin] = useState(60);
  const [modalidad, setModalidad] = useState<'VIRTUAL' | 'PRESENCIAL'>(tutor.modalidad === 'PRESENCIAL' ? 'PRESENCIAL' : 'VIRTUAL');
  const [tema, setTema] = useState('');
  const [pago, setPago] = useState<DatosPago>({ metodo: 'TARJETA', numero: '' });
  const total = Math.round((tutor.tarifaHora * duracionMin) / 60);

  const reservar = useMutation({
    mutationFn: () => api<Sesion>('/sesiones', { tutorId: tutor.id, materiaId, inicio, duracionMin, modalidad, tema: tema.trim(), pago }),
    onSuccess: (s) => {
      cola.invalidateQueries({ queryKey: ['sesiones'] });
      cola.invalidateQueries({ queryKey: ['franjas'] });
      avisar('Reserva enviada', 'bien', `${tutor.nombre} tiene 12 horas para aceptarla.`);
      navegar(`/sesiones/${s.id}`);
    },
  });

  return (
    <Modal titulo="Reservar sesión" cerrar={cerrar} ancho={540}>
      <Form layout="vertical" className="forma" onFinish={() => reservar.mutate()}>
        <div>
          <Typography.Text strong>{fechaLarga(inicio)}, {hora(inicio)}</Typography.Text><br />
          <Typography.Text type="secondary">con {tutor.nombre}</Typography.Text>
        </div>
        <Row gutter={14}>
          <Col xs={24} sm={12}>
            <Campo etiqueta="Materia" id="reserva-materia">
              <Select id="reserva-materia" value={materiaId} onChange={setMateriaId} style={{ width: '100%' }}
                options={tutor.materias.map((m) => ({ value: m.id, label: m.nombre }))} />
            </Campo>
          </Col>
          <Col xs={24} sm={12}>
            <Campo etiqueta="Duración">
              <Segmented block value={duracionMin} onChange={(v) => setDuracionMin(Number(v))}
                options={DURACIONES.map((d) => ({ value: d, label: duracion(d) }))} />
            </Campo>
          </Col>
        </Row>
        {tutor.modalidad === 'AMBAS' && (
          <Campo etiqueta="Modalidad">
            <Segmented block value={modalidad} onChange={(v) => setModalidad(v as typeof modalidad)}
              options={(['VIRTUAL', 'PRESENCIAL'] as const).map((m) => ({ value: m, label: MODALIDAD[m] }))} />
          </Campo>
        )}
        <Campo etiqueta="Tema que quieres trabajar" id="reserva-tema">
          <Input.TextArea id="reserva-tema" value={tema} onChange={(e) => setTema(e.target.value)} required minLength={3} maxLength={200} autoSize={{ minRows: 2 }}
            placeholder="Por ejemplo: derivadas por regla de la cadena para el parcial del viernes" />
        </Campo>
        <FormularioPago valor={pago} cambiar={setPago} />
        <Descriptions size="small" column={1} bordered items={[
          { key: 'tarifa', label: `${dinero(tutor.tarifaHora)} por hora × ${duracion(duracionMin)}`, children: dinero(total) },
          { key: 'total', label: <b>Total a pagar</b>, children: <b>{dinero(total)}</b> },
        ]} />
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          El pago queda retenido por la plataforma. Si el tutor no acepta en 12 horas o rechaza la solicitud, se te devuelve completo.
        </Typography.Text>
        {reservar.isError && <Alerta>{mensajeDe(reservar.error)}</Alerta>}
        <Button type="primary" htmlType="submit" block size="large" loading={reservar.isPending}>
          {reservar.isPending ? 'Procesando el pago…' : `Pagar ${dinero(total)} y reservar`}
        </Button>
      </Form>
    </Modal>
  );
}

export default function PerfilTutor() {
  const { id } = useParams();
  const tutor = useQuery({ queryKey: ['tutor', id], queryFn: () => api<Tutor>(`/tutores/${id}`) });
  const franjas = useQuery({ queryKey: ['franjas', id], queryFn: () => api<string[]>(`/tutores/${id}/franjas`), refetchInterval: 60_000 });
  const [dia, setDia] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const grupos = new Map<string, string[]>();
    for (const f of franjas.data ?? []) {
      const clave = claveDia(f);
      grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
    }
    return [...grupos.entries()];
  }, [franjas.data]);
  const diaActivo = porDia.find(([clave]) => clave === dia) ?? porDia[0];

  if (tutor.isPending) return <Cargando />;
  if (tutor.isError) return <Space orientation="vertical"><Alerta>{mensajeDe(tutor.error)}</Alerta><Link to="/buscar">Volver a la búsqueda</Link></Space>;
  const t = tutor.data;
  const horario = DIAS.map((nombre, i) => ({ nombre, bloques: (t.disponibilidad ?? []).filter((b) => b.diaSemana === i) }))
    .filter((d) => d.bloques.length > 0);

  return (
    <>
      <p style={{ marginBottom: 14 }}><Link to="/buscar">← Volver a la búsqueda</Link></p>
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={15}>
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Card>
              <Flex gap={18} align="center" wrap style={{ marginBottom: 14 }}>
                <Avatar nombre={t.nombre} enLinea={t.enLinea} grande />
                <div>
                  <Typography.Title level={2} style={{ margin: 0 }}>{t.nombre}</Typography.Title>
                  <Flex gap={14} wrap align="center" style={{ marginTop: 4 }}>
                    <Estrellas valor={t.calificacion} total={t.totalCalificaciones} />
                    <Typography.Text type="secondary">{t.sesionesRealizadas} sesiones realizadas</Typography.Text>
                    <Typography.Text type="secondary">{t.ciudad} · {MODALIDAD[t.modalidad]}</Typography.Text>
                    {t.enLinea && <Typography.Text style={{ color: '#1c8c7c', fontWeight: 600 }}>● En línea</Typography.Text>}
                  </Flex>
                </div>
              </Flex>
              <Typography.Paragraph>{t.bio}</Typography.Paragraph>
              <Flex gap={6} wrap>{t.materias.map((m) => <Tag key={m.id} style={{ marginInlineEnd: 0 }}>{m.nombre}</Tag>)}</Flex>
            </Card>

            <Card title="Horario habitual">
              {horario.length === 0 ? <Typography.Text type="secondary">Este tutor todavía no ha publicado su disponibilidad.</Typography.Text> : (
                <Descriptions size="small" column={1} items={horario.map((d) => ({
                  key: d.nombre, label: d.nombre, children: d.bloques.map((b) => `${horaDelDia(b.horaInicio)} a ${horaDelDia(b.horaFin)}`).join(' · '),
                }))} />
              )}
            </Card>

            <Card title="Reseñas de estudiantes">
              {(t.resenas ?? []).length === 0 ? <Typography.Text type="secondary">Aún no tiene reseñas publicadas.</Typography.Text> : (
                <List itemLayout="vertical" dataSource={t.resenas} renderItem={(r) => (
                  <List.Item className="resena" style={{ paddingInline: 0 }}>
                    <Flex justify="space-between"><b>{r.autor}</b><Typography.Text type="secondary" style={{ fontSize: 13 }}>{haceCuanto(r.fecha)}</Typography.Text></Flex>
                    <Estrellas valor={r.puntaje} />
                    {r.comentario && <Typography.Paragraph style={{ margin: '6px 0 0' }}>{r.comentario}</Typography.Paragraph>}
                  </List.Item>
                )} />
              )}
            </Card>
          </Space>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Reservar" extra={<span><b>{dinero(t.tarifaHora)}</b> <Typography.Text type="secondary">por hora</Typography.Text></span>}
            style={{ position: 'sticky', top: 16 }}>
            <Space orientation="vertical" size={14} style={{ width: '100%' }}>
              {franjas.isPending && <Cargando texto="Consultando la agenda…" />}
              {franjas.isError && <Alerta>{mensajeDe(franjas.error)}</Alerta>}
              {franjas.data && porDia.length === 0 && (
                <Typography.Text type="secondary">No tiene horas libres en los próximos 7 días. Si necesitas ayuda ya, pide un <Link to="/ahora">tutor ahora</Link>.</Typography.Text>
              )}
              {diaActivo && (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <Segmented value={diaActivo[0]} onChange={(v) => setDia(String(v))}
                      options={porDia.map(([clave, lista]) => ({ value: clave, label: fecha(lista[0]) }))} />
                  </div>
                  <Flex className="franjas" gap={8} wrap>
                    {diaActivo[1].map((f) => <Button key={f} onClick={() => setElegida(f)} style={{ minWidth: 82 }}>{hora(f)}</Button>)}
                  </Flex>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>Hora de Colombia. Elige una hora para continuar con el pago.</Typography.Text>
                </>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
      {elegida && <Reserva tutor={t} inicio={elegida} cerrar={() => setElegida(null)} />}
    </>
  );
}
