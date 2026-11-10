import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Col, Descriptions, Flex, Form, Input, Row, Space, Steps, Typography } from 'antd';
import { api, type Accion, type Evento, type Mensaje, type Sesion } from '../api';
import { useSesion } from '../sesion';
import { cuando } from '../comunes';
import { Conversacion, EnlaceSala, LineaTiempo } from '../caso';
import { Alerta, Avatar, Campo, Cargando, Estrellas, Insignia, Modal, SelectorEstrellas, mensajeDe } from '../ui';
import { DECISION, dinero, duracion, ESTADO_CASO, ESTADO_PAGO, ESTADO_SESION, fechaHora, haceCuanto } from '../formato';

const PASOS: Record<Sesion['tipo'], string[]> = {
  PROGRAMADA: ['Solicitada', 'Confirmada', 'En curso', 'Finalizada'],
  BAJO_DEMANDA: ['Buscando tutor', 'Tutor asignado', 'En curso', 'Finalizada'],
};
const AVANCE: Partial<Record<Sesion['estado'], number>> = {
  PENDIENTE_ACEPTACION: 0, BUSCANDO_TUTOR: 0, CONFIRMADA: 1, EN_CURSO: 2, FINALIZADA: 4,
};
const CIERRE: Partial<Record<Sesion['estado'], string>> = {
  CANCELADA: 'La sesión fue cancelada.',
  SIN_TUTOR: 'Ningún tutor tomó la solicitud a tiempo. No se hizo ningún cobro.',
  NO_REALIZADA: 'La sesión no se realizó y el pago se devolvió al estudiante.',
};

type Ventana = 'cancelar' | 'rechazar' | 'calificar' | 'disputa' | null;

export default function SesionDetalle() {
  const { id } = useParams();
  const { usuario, avisar } = useSesion();
  const cola = useQueryClient();
  const [ventana, setVentana] = useState<Ventana>(null);
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [motivo, setMotivo] = useState('');
  const soyTutor = usuario?.rol === 'TUTOR';

  const sesion = useQuery({ queryKey: ['sesion', id], queryFn: () => api<Sesion>(`/sesiones/${id}`), refetchInterval: 30_000 });
  const accion = useMutation({
    mutationFn: ({ cual, cuerpo }: { cual: Accion; cuerpo?: object }) => api<Sesion | { ok: true }>(`/sesiones/${id}/${cual}`, cuerpo ?? {}),
    onSuccess: (r, { cual }) => {
      if ('id' in r) cola.setQueryData(['sesion', id], r);
      for (const clave of ['sesion', 'sesiones', 'ingresos', 'demanda']) cola.invalidateQueries({ queryKey: [clave] });
      setVentana(null);
      const hecho: Partial<Record<Accion, string>> = {
        aceptar: 'Sesión confirmada', rechazar: 'Solicitud rechazada', cancelar: 'Sesión cancelada', iniciar: 'Sesión iniciada',
        finalizar: 'Sesión finalizada', calificar: 'Calificación enviada', disputa: 'Disputa abierta',
      };
      avisar(hecho[cual] ?? 'Listo', 'bien');
    },
  });
  const abrir = (v: Ventana) => { accion.reset(); setVentana(v); };

  if (sesion.isPending) return <Cargando />;
  if (sesion.isError) return <Space orientation="vertical"><Alerta>{mensajeDe(sesion.error)}</Alerta><Link to="/sesiones">Volver a las sesiones</Link></Space>;
  const s = sesion.data;
  const e = ESTADO_SESION[s.estado];
  const puede = (a: Accion) => s.acciones.includes(a);
  const avance = AVANCE[s.estado];
  const otro = soyTutor ? s.estudiante.nombre : s.tutor?.nombre ?? 'Tutor por asignar';
  const ocupado = accion.isPending;
  const enCurso = (a: Accion) => ocupado && accion.variables?.cual === a;
  const errorFuera = accion.isError && ventana === null;

  const textoCancelar = soyTutor
    ? 'Al estudiante se le devuelve el pago completo.'
    : s.reembolsoSiCancela === null ? 'Todavía no se ha hecho ningún cobro.'
      : s.reembolsoSiCancela === 100 ? `Se te devuelve el pago completo (${dinero(s.precio)}).`
        : s.reembolsoSiCancela === 50 ? `Faltan menos de 24 horas para la sesión: se te devuelve la mitad (${dinero((s.precio ?? 0) / 2)}).`
          : 'Faltan menos de 2 horas para la sesión: la cancelación no tiene devolución.';

  return (
    <>
      <p style={{ marginBottom: 14 }}><Link to="/sesiones">← Volver a las sesiones</Link></p>
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={15}>
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Card>
              <Space orientation="vertical" size={18} style={{ width: '100%' }}>
                <Flex justify="space-between" align="flex-start" gap={12} wrap>
                  <Flex gap={14} align="center">
                    <Avatar nombre={otro} />
                    <div>
                      <Typography.Title level={3} style={{ margin: 0 }}>{s.materia.nombre}</Typography.Title>
                      <Typography.Text type="secondary">{soyTutor ? 'Estudiante' : 'Tutor'}: {otro}</Typography.Text>
                    </div>
                  </Flex>
                  <Insignia tono={e.tono}>{e.texto}</Insignia>
                </Flex>

                {avance !== undefined
                  ? <Steps className="pasos" size="small" current={avance} status={avance >= 4 ? 'finish' : 'process'} items={PASOS[s.tipo].map((p) => ({ title: p }))} />
                  : <Alerta tono="espera">{CIERRE[s.estado]}</Alerta>}

                <Descriptions size="small" column={1} items={[
                  { key: 'cuando', label: 'Cuándo', children: cuando(s) },
                  { key: 'duracion', label: 'Duración', children: duracion(s.duracionMin) },
                  { key: 'modalidad', label: 'Modalidad', children: `${s.modalidad === 'VIRTUAL' ? 'Virtual' : 'Presencial'}${s.tipo === 'BAJO_DEMANDA' ? ' · Bajo demanda' : ''}` },
                  { key: 'tema', label: 'Tema', children: s.tema },
                  ...(s.iniciadaEn ? [{ key: 'inicio', label: 'Empezó', children: fechaHora(s.iniciadaEn) }] : []),
                  ...(s.finalizadaEn ? [{ key: 'fin', label: 'Terminó', children: fechaHora(s.finalizadaEn) }] : []),
                ]} />

                {s.estado === 'PENDIENTE_ACEPTACION' && s.expiraEn && (
                  <Alerta tono="info">
                    {soyTutor ? `Tienes hasta ${fechaHora(s.expiraEn).toLowerCase()} para responder.` : `El tutor tiene hasta ${fechaHora(s.expiraEn).toLowerCase()} para aceptar. Si no responde, se te devuelve el pago.`}
                  </Alerta>
                )}
                {s.estado === 'BUSCANDO_TUTOR' && <Alerta tono="info">La solicitud sigue abierta. <Link to="/ahora">Ver la búsqueda</Link></Alerta>}
                {s.enlace && (
                  <Alerta tono="bien" titulo="Sala de la sesión">
                    <EnlaceSala sesionId={s.id} cual="CLASE" href={s.enlace}>{s.enlace}</EnlaceSala>
                  </Alerta>
                )}
                {s.estado === 'CONFIRMADA' && s.modalidad === 'PRESENCIAL' && (
                  <Alerta tono="info">Sesión presencial: acuerden el lugar de encuentro antes de la hora.</Alerta>
                )}

                {errorFuera && <Alerta>{mensajeDe(accion.error)}</Alerta>}
                {s.acciones.length > 0 && (
                  <Flex gap={10} wrap className="acciones">
                    {puede('aceptar') && <Button type="primary" disabled={ocupado} loading={enCurso('aceptar')} onClick={() => accion.mutate({ cual: 'aceptar' })}>Aceptar la solicitud</Button>}
                    {puede('iniciar') && <Button type="primary" disabled={ocupado} loading={enCurso('iniciar')} onClick={() => accion.mutate({ cual: 'iniciar' })}>Iniciar la sesión</Button>}
                    {puede('finalizar') && <Button type="primary" disabled={ocupado} loading={enCurso('finalizar')} onClick={() => accion.mutate({ cual: 'finalizar' })}>Finalizar la sesión</Button>}
                    {puede('calificar') && <Button type="primary" onClick={() => abrir('calificar')}>Calificar {soyTutor ? 'al estudiante' : 'al tutor'}</Button>}
                    {puede('rechazar') && <Button onClick={() => abrir('rechazar')}>Rechazar</Button>}
                    {puede('cancelar') && <Button onClick={() => abrir('cancelar')}>Cancelar la sesión</Button>}
                    {puede('disputa') && <Button danger onClick={() => abrir('disputa')}>Reportar un problema</Button>}
                  </Flex>
                )}
              </Space>
            </Card>

            {(s.miCalificacion || s.calificacionRecibida) && (
              <Card title="Calificaciones">
                <Row gutter={[16, 16]}>
                  {s.miCalificacion && (
                    <Col xs={24} sm={12} className="resena">
                      <Typography.Text strong>Tu calificación</Typography.Text>
                      <div><Estrellas valor={s.miCalificacion.puntaje} /></div>
                      {s.miCalificacion.comentario && <Typography.Paragraph style={{ margin: '6px 0 0' }}>{s.miCalificacion.comentario}</Typography.Paragraph>}
                      {!s.miCalificacion.publicada && <Typography.Text type="secondary" style={{ fontSize: 13 }}>Se publica cuando la otra parte califique o pasados 7 días.</Typography.Text>}
                    </Col>
                  )}
                  {s.calificacionRecibida && (
                    <Col xs={24} sm={12} className="resena">
                      <Typography.Text strong>Calificación que recibiste</Typography.Text>
                      <div><Estrellas valor={s.calificacionRecibida.puntaje} /></div>
                      {s.calificacionRecibida.comentario && <Typography.Paragraph style={{ margin: '6px 0 0' }}>{s.calificacionRecibida.comentario}</Typography.Paragraph>}
                    </Col>
                  )}
                </Row>
              </Card>
            )}

            {s.disputa && <CasoDeLaSesion s={s} soyTutor={soyTutor} />}

            <Card title="Historial de la sesión">
              <Historial id={s.id} />
            </Card>
          </Space>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Pago" extra={s.pago && <Insignia tono={ESTADO_PAGO[s.pago.estado].tono}>{ESTADO_PAGO[s.pago.estado].texto}</Insignia>}>
            {!s.pago ? (
              <Typography.Text type="secondary">{s.estado === 'BUSCANDO_TUTOR' ? 'El cobro se hace cuando un tutor acepte.' : 'Esta sesión no tuvo cobro.'}</Typography.Text>
            ) : (
              <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                <Descriptions size="small" column={1} bordered items={[
                  { key: 'valor', label: 'Valor de la sesión', children: dinero(s.pago.monto) },
                  ...(soyTutor ? [{ key: 'comision', label: 'Comisión de la plataforma (15 %)', children: `− ${dinero(s.pago.comision)}` }] : []),
                  ...(s.pago.reembolso > 0 ? [{ key: 'devuelto', label: 'Devuelto al estudiante', children: dinero(s.pago.reembolso) }] : []),
                  soyTutor
                    ? { key: 'total', label: <b>Tu ganancia</b>, children: <b>{dinero(s.pago.netoTutor)}</b> }
                    : { key: 'total', label: <b>Total pagado</b>, children: <b>{dinero(s.pago.monto - s.pago.reembolso)}</b> },
                ]} />
                <Descriptions size="small" column={1} items={[
                  { key: 'medio', label: 'Medio', children: s.pago.metodo },
                  { key: 'ref', label: 'Referencia', children: <Typography.Text copyable>{s.pago.referencia}</Typography.Text> },
                ]} />
                {s.pago.estado === 'RETENIDO' && (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {s.pago.liberarEn
                      ? `El dinero se entrega al tutor ${fechaHora(s.pago.liberarEn).toLowerCase()}, 48 horas después de la sesión, si no hay disputa.`
                      : 'El dinero está retenido por la plataforma y se entrega al tutor 48 horas después de la sesión.'}
                  </Typography.Text>
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {(ventana === 'cancelar' || ventana === 'rechazar') && (
        <Modal titulo={ventana === 'cancelar' ? 'Cancelar la sesión' : 'Rechazar la solicitud'} cerrar={() => setVentana(null)}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ margin: 0 }}>
              {ventana === 'cancelar' ? textoCancelar : 'El estudiante recibe la devolución completa y la hora vuelve a quedar libre en tu agenda.'}
            </Typography.Paragraph>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Flex gap={10} justify="flex-end">
              <Button onClick={() => setVentana(null)}>Volver</Button>
              <Button danger type="primary" loading={ocupado} onClick={() => accion.mutate({ cual: ventana })}>
                {ventana === 'cancelar' ? 'Sí, cancelar' : 'Sí, rechazar'}
              </Button>
            </Flex>
          </Space>
        </Modal>
      )}

      {ventana === 'calificar' && (
        <Modal titulo={`Calificar a ${otro}`} cerrar={() => setVentana(null)}>
          <Form layout="vertical" className="forma" onFinish={() => accion.mutate({ cual: 'calificar', cuerpo: { puntaje, comentario: comentario.trim() } })}>
            <SelectorEstrellas valor={puntaje} cambiar={setPuntaje} />
            <Campo etiqueta="Comentario (opcional)" id="calificacion-comentario">
              <Input.TextArea id="calificacion-comentario" value={comentario} onChange={(ev) => setComentario(ev.target.value)} maxLength={500}
                autoSize={{ minRows: 3 }} placeholder="¿Cómo estuvo la sesión?" />
            </Campo>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>Las dos calificaciones se publican al mismo tiempo, cuando ambos califiquen o pasados 7 días.</Typography.Text>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Button type="primary" htmlType="submit" block loading={ocupado} disabled={puntaje === 0}>Enviar calificación</Button>
          </Form>
        </Modal>
      )}

      {ventana === 'disputa' && (
        <Modal titulo="Reportar un problema" cerrar={() => setVentana(null)}>
          <Form layout="vertical" className="forma" onFinish={() => accion.mutate({ cual: 'disputa', cuerpo: { motivo: motivo.trim() } })}>
            <Typography.Paragraph style={{ margin: 0 }}>Cuéntanos qué pasó con la sesión. El pago queda congelado mientras un administrador revisa el caso.</Typography.Paragraph>
            <Campo etiqueta="Motivo" id="disputa-motivo" ayuda="Entre 10 y 500 caracteres. Solo se puede reportar dentro de las 48 horas siguientes a la sesión.">
              <Input.TextArea id="disputa-motivo" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} required minLength={10} maxLength={500} autoSize={{ minRows: 3 }} />
            </Campo>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Button danger type="primary" htmlType="submit" block loading={ocupado}>Abrir disputa</Button>
          </Form>
        </Modal>
      )}
    </>
  );
}

function Historial({ id }: { id: number }) {
  const historial = useQuery({ queryKey: ['historial', id], queryFn: () => api<Evento[]>(`/sesiones/${id}/historial`) });
  if (historial.isPending) return <Cargando />;
  if (historial.isError) return <Alerta>{mensajeDe(historial.error)}</Alerta>;
  return <LineaTiempo eventos={historial.data} />;
}

/** El caso de soporte visto por el estudiante o el tutor: cada uno conversa con soporte por separado. */
function CasoDeLaSesion({ s, soyTutor }: { s: Sesion; soyTutor: boolean }) {
  const d = s.disputa!;
  const cola = useQueryClient();
  const mensajes = useQuery({ queryKey: ['caso-mensajes', s.id], queryFn: () => api<Mensaje[]>(`/sesiones/${s.id}/disputa/mensajes`) });
  const e = ESTADO_CASO[d.estado];
  const abierto = d.estado !== 'RESUELTA';
  const enviar = (texto: string, adjuntoId: number | null) =>
    api<Mensaje[]>(`/sesiones/${s.id}/disputa/mensajes`, { texto, adjuntoId }).then((lista) => cola.setQueryData(['caso-mensajes', s.id], lista));

  return (
    <Card className="caso-parte" title={`Caso de soporte #${d.id}`}
      extra={<Insignia tono={e.tono}>{d.estado === 'ESCALADA' ? 'En revisión por administración' : e.texto}</Insignia>}>
      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {soyTutor ? `${s.estudiante.nombre} abrió una disputa ${haceCuanto(d.creadoEn)}.` : `Abriste esta disputa ${haceCuanto(d.creadoEn)}.`}
          {' '}{d.asignado ? `La revisa ${d.asignado}, del equipo de soporte.` : 'Pronto alguien de soporte tomará el caso.'}
          {abierto && ' El pago queda congelado hasta que se resuelva.'}
        </Typography.Text>
        <blockquote className="cita">{d.motivo}</blockquote>

        {d.estado === 'RESUELTA' && d.decision && (
          <Alerta tono="bien" titulo={`Decisión: ${DECISION[d.decision].texto}`}>{d.resolucion}</Alerta>
        )}
        {d.sala && (
          <Alerta tono="info" titulo={`Soporte abrió una videollamada de mediación ${haceCuanto(d.salaCreadaEn!)}`}>
            Entran el estudiante, el tutor y la persona de soporte que lleva el caso.{' '}
            <EnlaceSala sesionId={s.id} cual="MEDIACION" href={d.sala}>Entrar a la videollamada</EnlaceSala>
          </Alerta>
        )}

        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>Tu conversación con soporte</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {soyTutor
              ? 'Presenta aquí tu versión y adjunta tus pruebas: capturas del chat de la sala, fotos o documentos. El estudiante no ve esta conversación.'
              : 'Cuéntale a soporte lo que pasó y adjunta tus pruebas: capturas, fotos o documentos. El tutor no ve esta conversación.'}
          </Typography.Text>
        </div>
        {mensajes.isPending && <Cargando />}
        {mensajes.isError && <Alerta>{mensajeDe(mensajes.error)}</Alerta>}
        {mensajes.data && (
          <Conversacion mensajes={mensajes.data} enviar={enviar} puedeEscribir={abierto}
            placeholder={soyTutor ? 'Escribe tu versión de lo que pasó' : 'Escribe a soporte'}
            vacio={soyTutor ? 'Todavía no has presentado tu versión.' : 'Todavía no hay mensajes.'} />
        )}
      </Space>
    </Card>
  );
}
