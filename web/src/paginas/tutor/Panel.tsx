import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Flex, Space, Typography } from 'antd';
import { StarFilled } from '@ant-design/icons';
import { api, ErrorApi, type Ingresos, type Sesion, type SolicitudDemanda } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera, FilaSesion, useSesiones } from '../../comunes';
import { Alerta, Cargando, Kpi, Kpis, Reloj, Vacio, mensajeDe } from '../../ui';
import { dinero, duracion } from '../../formato';
import { AMBAR } from '../../tema';

function Solicitud({ d }: { d: SolicitudDemanda }) {
  const cola = useQueryClient();
  const navegar = useNavigate();
  const { avisar } = useSesion();
  const responder = useMutation({
    mutationFn: (cual: 'aceptar' | 'rechazar') => api<Sesion | { ok: true }>(`/sesiones/${d.id}/${cual}`, {}),
    onSuccess: (_r, cual) => {
      cola.invalidateQueries({ queryKey: ['demanda'] });
      cola.invalidateQueries({ queryKey: ['sesiones'] });
      if (cual === 'aceptar') { avisar('Sesión asignada', 'bien', `${d.estudiante.nombre} te está esperando.`); navegar(`/sesiones/${d.id}`); }
    },
    onError: (e) => {
      if (e instanceof ErrorApi && e.estado === 409) {
        avisar(e.message, 'mal');
        cola.invalidateQueries({ queryKey: ['demanda'] });
      }
    },
  });
  return (
    <Card className="solicitud" size="small">
      <Flex gap={16} align="center" wrap>
        <Reloj hasta={d.expiraEn} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <Typography.Text strong>{d.materia.nombre} · {duracion(d.duracionMin)}</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{d.estudiante.nombre}: {d.tema}</Typography.Paragraph>
          {responder.isError && !(responder.error instanceof ErrorApi && responder.error.estado === 409) && <Alerta>{mensajeDe(responder.error)}</Alerta>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <Typography.Text strong style={{ fontSize: 18, display: 'block' }}>{dinero(d.ganancia)}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>tu ganancia</Typography.Text>
        </div>
        <Space>
          <Button disabled={responder.isPending} onClick={() => responder.mutate('rechazar')}>Pasar</Button>
          <Button type="primary" loading={responder.isPending && responder.variables === 'aceptar'} onClick={() => responder.mutate('aceptar')}>Aceptar</Button>
        </Space>
      </Flex>
    </Card>
  );
}

function Seccion({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="seccion">
      <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>{titulo}</Typography.Title>
        {extra}
      </Flex>
      {children}
    </section>
  );
}

export default function Panel() {
  const { usuario } = useSesion();
  const t = usuario?.tutor;
  const aprobado = t?.verificacion === 'APROBADO';
  const sesiones = useSesiones();
  const demanda = useQuery({
    queryKey: ['demanda'],
    queryFn: () => api<SolicitudDemanda[]>('/demanda/abiertas'),
    enabled: aprobado,
    refetchInterval: 5000,
  });
  const ingresos = useQuery({ queryKey: ['ingresos'], queryFn: () => api<Ingresos>('/tutor/ingresos'), enabled: aprobado });

  const lista = sesiones.data ?? [];
  const porAceptar = lista.filter((s) => s.estado === 'PENDIENTE_ACEPTACION');
  const casos = lista.filter((s) => s.disputa && s.disputa.estado !== 'RESUELTA');
  const proximas = lista.filter((s) => s.estado === 'CONFIRMADA' || s.estado === 'EN_CURSO')
    .sort((a, b) => Date.parse(a.inicio ?? a.creadoEn) - Date.parse(b.inicio ?? b.creadoEn));

  return (
    <>
      <Cabecera titulo={`Hola, ${usuario?.nombre.split(' ')[0] ?? ''}`} detalle={aprobado ? (t?.enLinea
        ? 'Estás en línea: las solicitudes de “tutor ahora” de tus materias aparecen aquí.'
        : 'Activa “En línea” arriba para recibir solicitudes inmediatas.') : undefined} />

      {t && !aprobado && (
        <Alerta tono={t.verificacion === 'RECHAZADO' ? 'mal' : 'espera'}>
          {t.verificacion === 'INCOMPLETO' && <><b>Completa tu perfil para empezar</b>Agrega tu descripción, tarifa, materias y el soporte de tus estudios, y envíalo a verificación. <Link to="/perfil">Ir al perfil</Link></>}
          {t.verificacion === 'PENDIENTE' && <><b>Tu perfil está en revisión</b>Un administrador está revisando tus datos. Cuando lo apruebe vas a aparecer en las búsquedas.</>}
          {t.verificacion === 'RECHAZADO' && <><b>Tu perfil fue rechazado</b>{t.motivoRechazo} <Link to="/perfil">Corregir y reenviar</Link></>}
        </Alerta>
      )}

      {aprobado && (
        <Kpis>
          <Kpi fuerte etiqueta="Disponible" valor={dinero(ingresos.data?.disponible ?? null)} nota="pagos ya liberados" />
          <Kpi etiqueta="Por liberar" valor={dinero(ingresos.data?.porLiberar ?? null)} nota="retenido 48 h tras cada sesión" />
          <Kpi etiqueta="Calificación" nota={`${t?.totalCalificaciones ?? 0} reseñas`}
            valor={t?.calificacion == null ? '—' : <>{t.calificacion.toFixed(1)} <StarFilled style={{ color: AMBAR, fontSize: 20 }} /></>} />
          <Kpi etiqueta="Sesiones realizadas" valor={t?.sesionesRealizadas ?? 0} nota="en la plataforma" />
        </Kpis>
      )}

      {aprobado && (
        <Seccion titulo="Solicitudes inmediatas">
          {!t?.enLinea ? <Vacio titulo="Estás desconectado">Activa el interruptor “En línea” para empezar a recibir solicitudes.</Vacio>
            : demanda.isPending ? <Cargando />
              : demanda.data?.length === 0 ? <Vacio titulo="No hay solicitudes abiertas">Cuando un estudiante pida ayuda en una de tus materias, la verás aquí con 45 segundos para aceptar.</Vacio>
                : <div className="lista">{demanda.data?.map((d) => <Solicitud key={d.id} d={d} />)}</div>}
        </Seccion>
      )}

      {casos.length > 0 && (
        <Space orientation="vertical" className="seccion" style={{ width: '100%' }}>
          {casos.map((s) => (
            <Alerta key={s.id}>
              <b>Caso de soporte abierto · {s.materia.nombre}</b>
              {s.estudiante.nombre} abrió una disputa sobre esta sesión y el pago está congelado.{' '}
              <Link to={`/sesiones/${s.id}`}>Presentar mi versión y mis pruebas</Link>
            </Alerta>
          ))}
        </Space>
      )}

      <Seccion titulo="Reservas por aceptar">
        {sesiones.isPending ? <Cargando /> : porAceptar.length === 0
          ? <Typography.Text type="secondary">No tienes reservas esperando respuesta.</Typography.Text>
          : <div className="lista">{porAceptar.map((s) => <FilaSesion key={s.id} s={s} />)}</div>}
      </Seccion>

      <Seccion titulo="Próximas sesiones" extra={<Link to="/sesiones">Ver todas</Link>}>
        {sesiones.isError && <Alerta>{mensajeDe(sesiones.error)}</Alerta>}
        {sesiones.data && (proximas.length === 0
          ? <Typography.Text type="secondary">No tienes sesiones confirmadas.</Typography.Text>
          : <div className="lista">{proximas.map((s) => <FilaSesion key={s.id} s={s} />)}</div>)}
      </Seccion>
    </>
  );
}
