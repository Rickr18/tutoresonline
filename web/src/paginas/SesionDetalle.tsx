import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Col, Descriptions, Flex, Form, Input, List, Row, Select, Space, Typography } from 'antd';
import { api, type Accion, type Evento, type Mensaje, type Sesion } from '../api';
import { useSesion } from '../sesion';
import { cuando, useParametros } from '../comunes';
import { Conversacion, EnlaceSala, LineaTiempo } from '../caso';
import { Alerta, Avatar, Campo, Cargando, Estrellas, Insignia, Modal, Reloj, RielSesion, SelectorEstrellas, mensajeDe } from '../ui';
import { DECISION, dinero, duracion, ESTADO_CASO, ESTADO_PAGO, ESTADO_SESION, fechaHora, haceCuanto, MODERACION } from '../formato';

const AVANCE: Partial<Record<Sesion['estado'], number>> = {
  PENDIENTE_ACEPTACION: 0, BUSCANDO_TUTOR: 0, CONFIRMADA: 1, EN_CURSO: 2, FINALIZADA: 4,
};

/** Por qué terminó una sesión que no llegó a realizarse. */
function textoCierre(s: Sesion) {
  if (s.estado === 'SIN_TUTOR') return 'Ningún tutor tomó la solicitud a tiempo. La retención del pago se liberó: no se hizo ningún cobro.';
  if (s.estado === 'NO_REALIZADA') {
    if (s.ausente === 'TUTOR') return 'El tutor no se conectó dentro de la tolerancia. Se devolvió el pago completo al estudiante.';
    if (s.ausente === 'ESTUDIANTE') return 'El estudiante no se conectó dentro de la tolerancia. El pago se entrega al tutor al terminar el periodo de garantía, salvo disputa.';
    return 'La sesión no se inició en el horario reservado y el pago se devolvió al estudiante.';
  }
  return 'La sesión fue cancelada.';
}

type Ventana = 'cancelar' | 'rechazar' | 'calificar' | 'disputa' | 'reprogramar' | 'inasistencia' | 'reportar' | null;

export default function SesionDetalle() {
  const { id } = useParams();
  const { usuario, avisar } = useSesion();
  const p = useParametros();
  const cola = useQueryClient();
  const [ventana, setVentana] = useState<Ventana>(null);
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [motivo, setMotivo] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState<string | null>(null);
  const soyTutor = usuario?.rol === 'TUTOR';

  const sesion = useQuery({ queryKey: ['sesion', id], queryFn: () => api<Sesion>(`/sesiones/${id}`), refetchInterval: 30_000 });
  const accion = useMutation({
    mutationFn: ({ ruta, cuerpo }: { ruta: string; cuerpo?: object }) => api<Sesion | { ok: true }>(`/sesiones/${id}/${ruta}`, cuerpo ?? {}),
    onSuccess: (r, { ruta, cuerpo }) => {
      if ('id' in r) cola.setQueryData(['sesion', id], r);
      for (const clave of ['sesion', 'sesiones', 'ingresos', 'demanda', 'historial', 'franjas']) cola.invalidateQueries({ queryKey: [clave] });
      setVentana(null);
      const hecho: Record<string, string> = {
        aceptar: 'Sesión confirmada', rechazar: 'Solicitud rechazada', cancelar: 'Sesión cancelada', iniciar: 'Sesión iniciada',
        finalizar: 'Sesión finalizada', calificar: 'Calificación enviada', disputa: 'Disputa abierta', reprogramar: 'Propuesta enviada',
        inasistencia: 'Inasistencia reportada', 'calificacion/reportar': 'Comentario reportado',
        reprogramacion: (cuerpo as { aceptar?: boolean; retirar?: boolean })?.retirar ? 'Propuesta retirada'
          : (cuerpo as { aceptar?: boolean })?.aceptar ? 'Nueva fecha aceptada' : 'Propuesta rechazada',
      };
      const retenido = 'comentarioRetenido' in r && r.comentarioRetenido;
      avisar(retenido ? 'Calificación enviada. El comentario quedó en revisión.' : hecho[ruta] ?? 'Listo', 'bien');
    },
  });
  const hacer = (ruta: string, cuerpo?: object) => accion.mutate({ ruta, cuerpo });
  const abrir = (v: Ventana) => { accion.reset(); setMotivo(''); setVentana(v); };

  if (sesion.isPending) return <Cargando />;
  if (sesion.isError) return <Space orientation="vertical"><Alerta>{mensajeDe(sesion.error)}</Alerta><Link to="/sesiones">Volver a las sesiones</Link></Space>;
  const s = sesion.data;
  const e = ESTADO_SESION[s.estado];
  const puede = (a: Accion) => s.acciones.includes(a);
  const avance = AVANCE[s.estado];
  const otro = soyTutor ? s.estudiante.nombre : s.tutor?.nombre ?? 'Tutor por asignar';
  const ocupado = accion.isPending;
  const enCurso = (ruta: string) => ocupado && accion.variables?.ruta === ruta;
  const errorFuera = accion.isError && ventana === null;
  const pctComision = s.pago && s.pago.monto ? Math.round((s.pago.comision / s.pago.monto) * 100) : p.COMISION_PCT;

  const textoCancelar = soyTutor
    ? 'Al estudiante se le devuelve el pago completo.'
    : s.estado === 'BUSCANDO_TUTOR' ? 'Se detiene la búsqueda y se libera toda la retención del pago.'
      : s.reembolsoSiCancela === null ? 'Todavía no se ha hecho ningún cobro.'
        : s.reembolsoSiCancela === 100 ? `Se te devuelve el pago completo (${dinero(s.precio)}).`
          : s.reembolsoSiCancela > 0 ? `Faltan menos de ${p.REEMBOLSO_TOTAL_H} horas para la sesión: se te devuelve el ${s.reembolsoSiCancela} % (${dinero(((s.precio ?? 0) * s.reembolsoSiCancela) / 100)}).`
            : `Faltan menos de ${p.REEMBOLSO_PARCIAL_H} horas para la sesión: la cancelación no tiene devolución.`;

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
                  ? <RielSesion tipo={s.tipo} estado={s.estado} />
                  : <Alerta tono="espera">{textoCierre(s)}</Alerta>}

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
                {s.estado === 'BUSCANDO_TUTOR' && s.turnoExpiraEn && (
                  <Flex gap={16} align="center" className="solicitud">
                    <Reloj hasta={s.turnoExpiraEn} total={p.TURNO_DEMANDA_S} />
                    <Typography.Text>Es tu turno para esta solicitud inmediata. Si no respondes, pasa al siguiente tutor.</Typography.Text>
                  </Flex>
                )}
                {s.estado === 'BUSCANDO_TUTOR' && s.busqueda && (
                  <Alerta tono="info">
                    Ofreciendo la solicitud al tutor {s.busqueda.candidato} de {s.busqueda.total}. <Link to="/ahora">Ver la búsqueda</Link>
                  </Alerta>
                )}
                {s.reprogramacion && (
                  <Alerta tono="espera" titulo={s.reprogramacion.mia ? 'Propusiste cambiar la fecha' : `${s.reprogramacion.propuestaPor.nombre} propone cambiar la fecha`}>
                    <Space orientation="vertical" size={10}>
                      <span>Nueva fecha: <b>{fechaHora(s.reprogramacion.inicio)}</b>. Hasta que {s.reprogramacion.mia ? 'la otra parte acepte' : 'aceptes'}, la sesión sigue en la fecha actual y el pago sigue retenido.</span>
                      {puede('responder-reprogramacion') && (
                        <Flex gap={10} wrap>
                          <Button type="primary" loading={enCurso('reprogramacion')} disabled={ocupado} onClick={() => hacer('reprogramacion', { aceptar: true })}>Aceptar la nueva fecha</Button>
                          <Button disabled={ocupado} onClick={() => hacer('reprogramacion', { aceptar: false })}>Mantener la fecha actual</Button>
                        </Flex>
                      )}
                      {puede('retirar-reprogramacion') && <Button disabled={ocupado} onClick={() => hacer('reprogramacion', { retirar: true })}>Retirar la propuesta</Button>}
                    </Space>
                  </Alerta>
                )}
                {s.enlace && (
                  <Alerta tono="bien" titulo="Sala de la sesión">
                    <EnlaceSala sesionId={s.id} cual="CLASE" href={s.enlace}>{s.enlace}</EnlaceSala>
                    {s.estado === 'CONFIRMADA' && <div style={{ fontSize: 13 }}>La sesión empieza sola cuando las dos partes entran a la sala.</div>}
                  </Alerta>
                )}
                {s.estado === 'CONFIRMADA' && s.modalidad === 'PRESENCIAL' && (
                  <Alerta tono="info">Sesión presencial: acuerden el lugar de encuentro antes de la hora.</Alerta>
                )}

                {errorFuera && <Alerta>{mensajeDe(accion.error)}</Alerta>}
                {s.acciones.some((a) => !['responder-reprogramacion', 'retirar-reprogramacion', 'reportar'].includes(a)) && (
                  <Flex gap={10} wrap className="acciones">
                    {puede('aceptar') && <Button type="primary" disabled={ocupado} loading={enCurso('aceptar')} onClick={() => hacer('aceptar')}>Aceptar la solicitud</Button>}
                    {puede('iniciar') && <Button type="primary" disabled={ocupado} loading={enCurso('iniciar')} onClick={() => hacer('iniciar')}>Iniciar la sesión</Button>}
                    {puede('finalizar') && <Button type="primary" disabled={ocupado} loading={enCurso('finalizar')} onClick={() => hacer('finalizar')}>Finalizar la sesión</Button>}
                    {puede('calificar') && <Button type="primary" onClick={() => abrir('calificar')}>Calificar {soyTutor ? 'al estudiante' : 'al tutor'}</Button>}
                    {puede('reprogramar') && <Button onClick={() => { setNuevaFecha(null); abrir('reprogramar'); }}>Proponer otra fecha</Button>}
                    {puede('rechazar') && <Button onClick={() => abrir('rechazar')}>{s.tipo === 'BAJO_DEMANDA' ? 'Pasar' : 'Rechazar'}</Button>}
                    {puede('cancelar') && <Button onClick={() => abrir('cancelar')}>{s.estado === 'BUSCANDO_TUTOR' ? 'Cancelar la búsqueda' : 'Cancelar la sesión'}</Button>}
                    {puede('inasistencia') && <Button danger onClick={() => abrir('inasistencia')}>Reportar que {soyTutor ? 'el estudiante' : 'el tutor'} no se conectó</Button>}
                    {puede('disputa') && <Button danger onClick={() => abrir('disputa')}>Reportar un problema</Button>}
                  </Flex>
                )}
              </Space>
            </Card>

            {s.sugerencias.length > 0 && (
              <Card title={`Otros tutores de ${s.materia.nombre}`}>
                <List className="sugerencias" dataSource={s.sugerencias} renderItem={(t) => (
                  <List.Item actions={[<Link key="ver" to={`/tutores/${t.id}`}>Ver perfil y reservar</Link>]}>
                    <List.Item.Meta avatar={<Avatar nombre={t.nombre} enLinea={t.enLinea} />} title={t.nombre}
                      description={<Flex gap={10} align="center"><Estrellas valor={t.calificacion} /><span>{dinero(t.tarifaHora)} por hora</span></Flex>} />
                  </List.Item>
                )} />
              </Card>
            )}

            {(s.miCalificacion || s.calificacionRecibida) && (
              <Card title="Calificaciones">
                <Row gutter={[16, 16]}>
                  {s.miCalificacion && (
                    <Col xs={24} sm={12} className="resena">
                      <Typography.Text strong>Tu calificación</Typography.Text>
                      <div><Estrellas valor={s.miCalificacion.puntaje} /></div>
                      {s.miCalificacion.comentario && <Typography.Paragraph style={{ margin: '6px 0 0' }}>{s.miCalificacion.comentario}</Typography.Paragraph>}
                      {s.miCalificacion.moderacion !== 'VISIBLE' && (
                        <div><Insignia tono={MODERACION[s.miCalificacion.moderacion].tono}>{MODERACION[s.miCalificacion.moderacion].texto}</Insignia>{' '}
                          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                            {['RETENIDA', 'REPORTADA'].includes(s.miCalificacion.moderacion) ? 'El comentario no se publica mientras soporte lo revisa; el puntaje sí cuenta.' : ''}
                          </Typography.Text>
                        </div>
                      )}
                      {!s.miCalificacion.publicada && <Typography.Text type="secondary" style={{ fontSize: 13 }}>Se publica cuando la otra parte califique o pasados {p.PUBLICACION_DIAS} días.</Typography.Text>}
                    </Col>
                  )}
                  {s.calificacionRecibida && (
                    <Col xs={24} sm={12} className="resena">
                      <Typography.Text strong>Calificación que recibiste</Typography.Text>
                      <div><Estrellas valor={s.calificacionRecibida.puntaje} /></div>
                      {s.calificacionRecibida.comentario && <Typography.Paragraph style={{ margin: '6px 0 0' }}>{s.calificacionRecibida.comentario}</Typography.Paragraph>}
                      {s.calificacionRecibida.moderacion === 'REPORTADA' && <Insignia tono="espera">Reportado: oculto mientras soporte lo revisa</Insignia>}
                      {puede('reportar') && <Button size="small" type="link" style={{ padding: 0 }} onClick={() => abrir('reportar')}>Reportar este comentario</Button>}
                    </Col>
                  )}
                </Row>
              </Card>
            )}

            {s.disputa && <CasoDeLaSesion s={s} />}

            <Card title="Historial de la sesión">
              <Historial id={s.id} />
            </Card>
          </Space>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Pago" extra={s.pago && <Insignia tono={ESTADO_PAGO[s.pago.estado].tono}>{ESTADO_PAGO[s.pago.estado].texto}</Insignia>}>
            {!s.pago ? (
              <Typography.Text type="secondary">Esta sesión no tuvo cobro.</Typography.Text>
            ) : (
              <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                <Descriptions size="small" column={1} bordered items={[
                  { key: 'valor', label: s.estado === 'BUSCANDO_TUTOR' ? 'Valor retenido (estimado)' : 'Valor de la sesión', children: dinero(s.pago.monto) },
                  { key: 'comision', label: `Comisión de la plataforma (${pctComision} %)`, children: soyTutor ? `− ${dinero(s.pago.comision)}` : `${dinero(s.pago.comision)}, la paga el tutor` },
                  { key: 'impuestos', label: 'Impuestos', children: dinero(0) },
                  ...(s.pago.reembolso > 0 ? [{ key: 'devuelto', label: 'Devuelto al estudiante', children: dinero(s.pago.reembolso) }] : []),
                  soyTutor
                    ? { key: 'total', label: <b>Tu ganancia</b>, children: <b>{dinero(s.pago.netoTutor)}</b> }
                    : { key: 'total', label: <b>Total pagado</b>, children: <b>{dinero(s.pago.monto - s.pago.reembolso)}</b> },
                ]} />
                <Descriptions size="small" column={1} items={[
                  { key: 'medio', label: 'Medio', children: s.pago.metodo },
                  { key: 'ref', label: 'Referencia', children: <Typography.Text copyable>{s.pago.referencia}</Typography.Text> },
                ]} />
                {s.estado === 'BUSCANDO_TUTOR' && (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>Se retuvo el valor estimado antes de buscar tutor; al aceptar, se ajusta a la tarifa de quien toma la solicitud.</Typography.Text>
                )}
                {s.pago.estado === 'RETENIDO' && s.estado !== 'BUSCANDO_TUTOR' && (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {s.pago.liberarEn
                      ? `El dinero se entrega al tutor ${fechaHora(s.pago.liberarEn).toLowerCase()}, al terminar el periodo de garantía, si no hay disputa.`
                      : `El dinero está retenido por la plataforma y se entrega al tutor ${p.GARANTIA_H} horas después de la sesión.`}
                  </Typography.Text>
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {(ventana === 'cancelar' || ventana === 'rechazar') && (
        <Modal titulo={ventana === 'cancelar' ? 'Cancelar la sesión' : s.tipo === 'BAJO_DEMANDA' ? 'Pasar la solicitud' : 'Rechazar la solicitud'} cerrar={() => setVentana(null)}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ margin: 0 }}>
              {ventana === 'cancelar' ? textoCancelar
                : s.tipo === 'BAJO_DEMANDA' ? 'La solicitud pasa al siguiente tutor de la lista.'
                  : 'El estudiante recibe la devolución completa, la hora vuelve a quedar libre en tu agenda y le sugerimos otros tutores.'}
            </Typography.Paragraph>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Flex gap={10} justify="flex-end">
              <Button onClick={() => setVentana(null)}>Volver</Button>
              <Button danger type="primary" loading={ocupado} onClick={() => hacer(ventana)}>
                {ventana === 'cancelar' ? 'Sí, cancelar' : s.tipo === 'BAJO_DEMANDA' ? 'Sí, pasar' : 'Sí, rechazar'}
              </Button>
            </Flex>
          </Space>
        </Modal>
      )}

      {ventana === 'reprogramar' && s.tutor && (
        <Modal titulo="Proponer otra fecha" cerrar={() => setVentana(null)}>
          <FranjasNuevas tutorId={s.tutor.id} actual={s.inicio} valor={nuevaFecha} cambiar={setNuevaFecha} />
          <Typography.Paragraph type="secondary" style={{ margin: '12px 0' }}>
            {otro} debe aceptar el cambio. Mientras tanto la sesión sigue en la fecha actual y el pago sigue retenido.
          </Typography.Paragraph>
          {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
          <Button type="primary" block loading={ocupado} disabled={!nuevaFecha} style={{ marginTop: 12 }}
            onClick={() => hacer('reprogramar', { inicio: nuevaFecha })}>Enviar la propuesta</Button>
        </Modal>
      )}

      {ventana === 'inasistencia' && (
        <Modal titulo="Reportar inasistencia" cerrar={() => setVentana(null)}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ margin: 0 }}>
              {soyTutor
                ? `Pasaron más de ${p.TOLERANCIA_MIN} minutos y el estudiante no entró a la sala. La sesión queda como no realizada y el pago se te entrega al terminar el periodo de garantía, salvo que el estudiante abra una disputa.`
                : `Pasaron más de ${p.TOLERANCIA_MIN} minutos y el tutor no entró a la sala. La sesión queda como no realizada, se te devuelve el pago completo y te sugerimos otros tutores.`}
            </Typography.Paragraph>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Flex gap={10} justify="flex-end">
              <Button onClick={() => setVentana(null)}>Volver</Button>
              <Button danger type="primary" loading={ocupado} onClick={() => hacer('inasistencia')}>Sí, reportar</Button>
            </Flex>
          </Space>
        </Modal>
      )}

      {ventana === 'calificar' && (
        <Modal titulo={`Calificar a ${otro}`} cerrar={() => setVentana(null)}>
          <Form layout="vertical" className="forma" onFinish={() => hacer('calificar', { puntaje, comentario: comentario.trim() })}>
            <SelectorEstrellas valor={puntaje} cambiar={setPuntaje} />
            <Campo etiqueta="Comentario (opcional)" id="calificacion-comentario" ayuda="No incluyas teléfonos, correos ni palabras ofensivas: el filtro los retiene para revisión.">
              <Input.TextArea id="calificacion-comentario" value={comentario} onChange={(ev) => setComentario(ev.target.value)} maxLength={400}
                autoSize={{ minRows: 3 }} placeholder="¿Cómo estuvo la sesión?" />
            </Campo>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>Las dos calificaciones se publican al mismo tiempo, cuando ambos califiquen o pasados {p.PUBLICACION_DIAS} días.</Typography.Text>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Button type="primary" htmlType="submit" block loading={ocupado} disabled={puntaje === 0}>Enviar calificación</Button>
          </Form>
        </Modal>
      )}

      {(ventana === 'disputa' || ventana === 'reportar') && (
        <Modal titulo={ventana === 'disputa' ? 'Reportar un problema' : 'Reportar el comentario'} cerrar={() => setVentana(null)}>
          <Form layout="vertical" className="forma"
            onFinish={() => hacer(ventana === 'disputa' ? 'disputa' : 'calificacion/reportar', { motivo: motivo.trim() })}>
            <Typography.Paragraph style={{ margin: 0 }}>
              {ventana === 'disputa'
                ? 'Cuéntanos qué pasó con la sesión. El pago queda congelado mientras soporte revisa el caso.'
                : 'El comentario se oculta de inmediato y soporte decide si se publica, se oculta o se elimina. El autor conocerá la decisión.'}
            </Typography.Paragraph>
            <Campo etiqueta="Motivo" id="disputa-motivo"
              ayuda={ventana === 'disputa' ? `Entre 10 y 500 caracteres. Solo se puede reportar dentro de las ${p.PLAZO_DISPUTA_H} horas siguientes a la sesión.` : 'Entre 10 y 300 caracteres.'}>
              <Input.TextArea id="disputa-motivo" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} required minLength={10}
                maxLength={ventana === 'disputa' ? 500 : 300} autoSize={{ minRows: 3 }} />
            </Campo>
            {accion.isError && <Alerta>{mensajeDe(accion.error)}</Alerta>}
            <Button danger type="primary" htmlType="submit" block loading={ocupado}>{ventana === 'disputa' ? 'Abrir disputa' : 'Reportar'}</Button>
          </Form>
        </Modal>
      )}
    </>
  );
}

/** Horas libres del tutor para proponer la reprogramación. */
function FranjasNuevas({ tutorId, actual, valor, cambiar }: { tutorId: number; actual: string | null; valor: string | null; cambiar: (v: string) => void }) {
  const franjas = useQuery({ queryKey: ['franjas', tutorId], queryFn: () => api<string[]>(`/tutores/${tutorId}/franjas`) });
  if (franjas.isPending) return <Cargando />;
  if (franjas.isError) return <Alerta>{mensajeDe(franjas.error)}</Alerta>;
  const opciones = franjas.data.filter((f) => f !== actual);
  if (!opciones.length) return <Alerta tono="espera">El tutor no tiene horas libres en los próximos 7 días.</Alerta>;
  return (
    <Campo etiqueta="Nueva fecha" id="reprogramar-fecha" ayuda="Horas libres del tutor en los próximos 7 días.">
      <Select id="reprogramar-fecha" style={{ width: '100%' }} value={valor ?? undefined} onChange={cambiar} placeholder="Elige una hora"
        options={opciones.map((f) => ({ value: f, label: fechaHora(f) }))} />
    </Campo>
  );
}

function Historial({ id }: { id: number }) {
  const historial = useQuery({ queryKey: ['historial', id], queryFn: () => api<Evento[]>(`/sesiones/${id}/historial`) });
  if (historial.isPending) return <Cargando />;
  if (historial.isError) return <Alerta>{mensajeDe(historial.error)}</Alerta>;
  return <LineaTiempo eventos={historial.data} />;
}

/** El caso de soporte visto por el estudiante o el tutor: cada uno conversa con soporte por separado. */
function CasoDeLaSesion({ s }: { s: Sesion }) {
  const d = s.disputa!;
  const cola = useQueryClient();
  const { usuario } = useSesion();
  const mensajes = useQuery({ queryKey: ['caso-mensajes', s.id], queryFn: () => api<Mensaje[]>(`/sesiones/${s.id}/disputa/mensajes`) });
  const e = ESTADO_CASO[d.estado];
  const abierto = d.estado !== 'RESUELTA';
  const otraParte = usuario?.rol === 'TUTOR' ? 'El estudiante' : 'El tutor';
  const enviar = (texto: string, adjuntoId: number | null) =>
    api<Mensaje[]>(`/sesiones/${s.id}/disputa/mensajes`, { texto, adjuntoId }).then((lista) => cola.setQueryData(['caso-mensajes', s.id], lista));

  return (
    <Card className="caso-parte" title={`Caso de soporte #${d.id}`}
      extra={<Insignia tono={e.tono}>{d.estado === 'ESCALADA' ? 'En revisión por administración' : e.texto}</Insignia>}>
      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {d.mia ? `Abriste esta disputa ${haceCuanto(d.creadoEn)}.` : `${d.autor.nombre} abrió una disputa ${haceCuanto(d.creadoEn)}.`}
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
            {d.mia
              ? `Cuéntale a soporte lo que pasó y adjunta tus pruebas: capturas, fotos o documentos. ${otraParte} no ve esta conversación.`
              : `Presenta aquí tu versión y adjunta tus pruebas: capturas del chat de la sala, fotos o documentos. ${otraParte} no ve esta conversación.`}
          </Typography.Text>
        </div>
        {mensajes.isPending && <Cargando />}
        {mensajes.isError && <Alerta>{mensajeDe(mensajes.error)}</Alerta>}
        {mensajes.data && (
          <Conversacion mensajes={mensajes.data} enviar={enviar} puedeEscribir={abierto}
            placeholder={d.mia ? 'Escribe a soporte' : 'Escribe tu versión de lo que pasó'}
            vacio={d.mia ? 'Todavía no hay mensajes.' : 'Todavía no has presentado tu versión.'} />
        )}
      </Space>
    </Card>
  );
}
