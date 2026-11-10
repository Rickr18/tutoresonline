import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Col, Flex, Form, Input, Radio, Row, Space, Tabs, Typography } from 'antd';
import { api, type Canal, type CasoDetalle, type Decision } from '../../api';
import { useSesion } from '../../sesion';
import { Conversacion, EnlaceSala, LineaTiempo } from '../../caso';
import { Alerta, Campo, Cargando, Insignia, Modal, mensajeDe } from '../../ui';
import { DECISION, dinero, ESTADO_CASO, fechaHora, haceCuanto, ROL_TEXTO } from '../../formato';
import { FichaSesion } from './piezas';

const CANALES: { canal: Canal; texto: string; ayuda: string }[] = [
  { canal: 'ESTUDIANTE', texto: 'Estudiante', ayuda: 'Solo el estudiante ve esta conversación.' },
  { canal: 'TUTOR', texto: 'Tutor', ayuda: 'Solo el tutor ve esta conversación.' },
  { canal: 'INTERNO', texto: 'Notas internas', ayuda: 'Solo soporte y administración ven estas notas.' },
];

type Ventana = 'sala' | 'escalar' | 'resolver' | null;

export default function Caso() {
  const { id } = useParams();
  const { usuario, avisar } = useSesion();
  const cola = useQueryClient();
  const [canal, setCanal] = useState<Canal>('ESTUDIANTE');
  const [ventana, setVentana] = useState<Ventana>(null);
  const [cuando, setCuando] = useState('');
  const [motivo, setMotivo] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [explicacion, setExplicacion] = useState('');

  const caso = useQuery({ queryKey: ['gestion', 'caso', id], queryFn: () => api<CasoDetalle>(`/gestion/disputas/${id}`), refetchInterval: 15_000 });
  const refrescar = () => cola.invalidateQueries({ queryKey: ['gestion'] });
  const accion = useMutation({
    mutationFn: ({ ruta, cuerpo }: { ruta: string; cuerpo?: object }) => api(`/gestion/disputas/${id}/${ruta}`, cuerpo ?? {}),
    onSuccess: (_r, { ruta }) => {
      refrescar();
      setVentana(null);
      const hecho: Record<string, string> = { tomar: 'Tomaste el caso', sala: 'Sala de mediación creada', escalar: 'Caso escalado a administración', resolver: 'Caso resuelto' };
      avisar(hecho[ruta] ?? 'Listo', 'bien');
    },
  });
  const abrir = (v: Ventana) => { accion.reset(); setVentana(v); };

  if (caso.isPending) return <Cargando />;
  if (caso.isError) return <Alerta>{mensajeDe(caso.error)}</Alerta>;
  const c = caso.data;
  const e = ESTADO_CASO[c.estado];
  const p = c.permisos;
  const monto = c.sesion.pago?.monto ?? 0;
  const parcialEstudiante = Math.round(monto / 2);
  const efectos: Record<Decision, string> = {
    REEMBOLSO_TOTAL: `El estudiante recibe ${dinero(monto)}. El tutor no recibe pago.`,
    REEMBOLSO_PARCIAL: `El estudiante recibe ${dinero(parcialEstudiante)} y el tutor ${dinero((monto - parcialEstudiante) * 0.85)} después de la comisión.`,
    LIBERAR: `El tutor recibe ${dinero(c.sesion.pago?.netoTutor ?? 0)}. El estudiante no recibe devolución.`,
  };
  const delCanal = c.mensajes.filter((m) => m.canal === canal);
  const enviar = (texto: string, adjuntoId: number | null) =>
    api(`/gestion/disputas/${id}/mensajes`, { canal, texto, adjuntoId }).then(refrescar);

  return (
    <>
      <p style={{ marginBottom: 14 }}><Link to="/casos">← Volver a los casos</Link></p>
      <Flex className="cabecera" justify="space-between" align="flex-end" gap={16} wrap>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>Caso #{c.id} · {c.materia}</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
            {c.estudiante.nombre} contra {c.tutor.nombre} · abierto {haceCuanto(c.creadoEn)} ({fechaHora(c.creadoEn)}) ·{' '}
            {c.asignado ? <>responsable: <b>{c.asignado.nombre}</b> ({ROL_TEXTO[c.asignado.rol ?? 'SOPORTE'].toLowerCase()})</> : 'sin responsable'}
          </Typography.Paragraph>
        </div>
        <Space wrap className="acciones">
          <Insignia tono={e.tono}>{e.texto}</Insignia>
          {p.tomar && (
            <Button size="small" style={{ background: '#12233f', color: '#fff', borderColor: '#12233f' }} loading={accion.isPending && accion.variables?.ruta === 'tomar'}
              onClick={() => accion.mutate({ ruta: 'tomar' })}>{c.asignado ? 'Tomar el caso yo' : 'Tomar el caso'}</Button>
          )}
          {p.escribir && <Button size="small" onClick={() => abrir('sala')}>{c.sala ? 'Nueva sala de mediación' : 'Videollamada de mediación'}</Button>}
          {p.escalar && <Button size="small" onClick={() => abrir('escalar')}>Escalar a administración</Button>}
          {p.resolver && <Button size="small" type="primary" onClick={() => { setDecision(null); abrir('resolver'); }}>Resolver</Button>}
        </Space>
      </Flex>

      <Space orientation="vertical" style={{ width: '100%', marginBottom: 16 }}>
        {accion.isError && ventana === null && <Alerta>{mensajeDe(accion.error)}</Alerta>}
        {c.escalada && c.estado === 'ESCALADA' && (
          <Alerta tono="mal" titulo={`Escalado por ${c.escalada.por} ${haceCuanto(c.escalada.fecha)}`}>
            {c.escalada.motivo}
            {usuario?.rol === 'SOPORTE' && ' Un administrador debe resolverlo; puedes seguir conversando con las partes.'}
          </Alerta>
        )}
        {c.estado === 'RESUELTA' && c.decision && (
          <Alerta tono="bien" titulo={`Resuelto por ${c.resueltaPor?.nombre} el ${fechaHora(c.resueltaEn!)}: ${DECISION[c.decision].texto}`}>
            {c.resolucion}
          </Alerta>
        )}
        {c.sala && c.estado !== 'RESUELTA' && (
          <Alerta tono="info" titulo={`Sala de mediación abierta ${haceCuanto(c.salaCreadaEn!)}`}>
            El estudiante y el tutor ya tienen el enlace en su sesión.{' '}
            <EnlaceSala sesionId={c.sesionId} cual="MEDIACION" href={c.sala}>Entrar a la sala</EnlaceSala>
          </Alerta>
        )}
      </Space>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={14}>
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Card title="Reclamo del estudiante">
              <blockquote className="cita">{c.motivo}</blockquote>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {c.tutorRespondio ? 'El tutor ya presentó su versión en su conversación.' : 'El tutor todavía no ha presentado su versión.'}
              </Typography.Text>
            </Card>
            <FichaSesion s={c.sesion} enlaceDetalle />
            <Card title="Qué pasó, minuto a minuto">
              <LineaTiempo eventos={c.sesion.eventos} />
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="conversaciones" style={{ position: 'sticky', top: 16 }}>
            <Tabs activeKey={canal} onChange={(k) => setCanal(k as Canal)} items={CANALES.map((x) => ({
              key: x.canal,
              label: <Flex gap={8} align="center">{x.texto}<Badge count={c.mensajes.filter((m) => m.canal === x.canal).length} showZero color="#e9edf3" style={{ color: '#4a5567' }} /></Flex>,
            }))} />
            <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>{CANALES.find((x) => x.canal === canal)!.ayuda}</Typography.Paragraph>
            <Conversacion key={canal} mensajes={delCanal} enviar={enviar} puedeEscribir={p.escribir} vistaEquipo
              placeholder={canal === 'INTERNO' ? 'Nota para el equipo' : `Escribe al ${canal === 'ESTUDIANTE' ? 'estudiante' : 'tutor'}`}
              vacio={canal === 'INTERNO' ? 'Sin notas internas.' : 'Todavía no hay mensajes con esta parte.'} />
          </Card>
        </Col>
      </Row>

      {ventana === 'sala' && (
        <Modal titulo="Videollamada de mediación" cerrar={() => setVentana(null)}>
          <Form layout="vertical" className="forma" onFinish={() => accion.mutate({ ruta: 'sala', cuerpo: { cuando: cuando.trim() || undefined } })}>
            <Typography.Paragraph style={{ margin: 0 }}>
              Se crea una sala nueva de Jitsi para el estudiante, el tutor y tú. Los dos reciben una notificación y ven el enlace en su sesión.
              Cada vez que alguien la abre queda registrado en el historial.
            </Typography.Paragraph>
            {c.sala && <Alerta tono="espera">Ya hay una sala abierta. Si creas otra, el enlace anterior deja de mostrarse.</Alerta>}
            <Campo etiqueta="Cuándo (opcional)" id="sala-cuando" ayuda="Se incluye en la notificación a las partes.">
              <Input id="sala-cuando" value={cuando} onChange={(ev) => setCuando(ev.target.value)} maxLength={80} placeholder="Por ejemplo: hoy a las 4:00 p. m." />
            </Campo>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Button type="primary" htmlType="submit" block loading={accion.isPending}>Crear sala y avisar</Button>
          </Form>
        </Modal>
      )}

      {ventana === 'escalar' && (
        <Modal titulo="Escalar a administración" cerrar={() => setVentana(null)}>
          <Form layout="vertical" className="forma" onFinish={() => accion.mutate({ ruta: 'escalar', cuerpo: { motivo: motivo.trim() } })}>
            <Typography.Paragraph style={{ margin: 0 }}>
              El caso pasa a los administradores. Tú sigues viéndolo y puedes conversar con las partes, pero la decisión la toma un administrador.
            </Typography.Paragraph>
            <Campo etiqueta="Motivo" id="escalar-motivo">
              <Input.TextArea id="escalar-motivo" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} required minLength={10} maxLength={400} autoSize={{ minRows: 3 }}
                placeholder="Por ejemplo: las versiones se contradicen y el monto supera lo que puedo aprobar." />
            </Campo>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Button danger type="primary" htmlType="submit" block loading={accion.isPending}>Escalar el caso</Button>
          </Form>
        </Modal>
      )}

      {ventana === 'resolver' && (
        <Modal titulo={`Resolver el caso #${c.id}`} cerrar={() => setVentana(null)} ancho={580}>
          <Form layout="vertical" className="forma" onFinish={() => { if (decision) accion.mutate({ ruta: 'resolver', cuerpo: { decision, resolucion: explicacion.trim() } }); }}>
            <Radio.Group className="opciones-decision" value={decision} onChange={(ev) => setDecision(ev.target.value)} aria-label="Decisión"
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.keys(DECISION) as Decision[]).map((d) => (
                <Card key={d} size="small" style={{ borderColor: decision === d ? '#12233f' : undefined, cursor: 'pointer' }} onClick={() => setDecision(d)}>
                  <Radio value={d}>
                    <b>{DECISION[d].texto}</b><br />
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>{efectos[d]}</Typography.Text>
                  </Radio>
                </Card>
              ))}
            </Radio.Group>
            <Campo etiqueta="Explicación para el estudiante y el tutor" id="resolver-explicacion" ayuda="Ambas partes la reciben en una notificación y la ven en la sesión.">
              <Input.TextArea id="resolver-explicacion" value={explicacion} onChange={(ev) => setExplicacion(ev.target.value)} required minLength={10} maxLength={600}
                autoSize={{ minRows: 3 }} placeholder="Qué se revisó y por qué se tomó la decisión." />
            </Campo>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Button type="primary" htmlType="submit" block loading={accion.isPending} disabled={!decision}>Confirmar decisión</Button>
          </Form>
        </Modal>
      )}
    </>
  );
}
