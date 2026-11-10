import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Flex, Progress, Row, Space, Typography } from 'antd';
import { api, type Resumen as TResumen } from '../../api';
import { Cabecera } from '../../comunes';
import { Alerta, Cargando, Kpi, Kpis, mensajeDe } from '../../ui';
import { dinero, ESTADO_SESION } from '../../formato';
import { MARINO } from '../../tema';

function Barras({ filas }: { filas: { texto: string; total: number }[] }) {
  const max = Math.max(1, ...filas.map((f) => f.total));
  return (
    <Flex vertical gap={8} className="barras">
      {filas.map((f) => (
        <Flex key={f.texto} gap={12} align="center">
          <Typography.Text style={{ width: 150, flex: 'none' }} ellipsis>{f.texto}</Typography.Text>
          <Progress percent={(f.total / max) * 100} showInfo={false} strokeColor={MARINO} style={{ flex: 1, margin: 0 }} />
          <Typography.Text strong className="nums" style={{ width: 32, textAlign: 'right' }}>{f.total}</Typography.Text>
        </Flex>
      ))}
    </Flex>
  );
}

export default function Resumen() {
  const r = useQuery({ queryKey: ['admin', 'resumen'], queryFn: () => api<TResumen>('/admin/resumen'), refetchInterval: 15_000 });
  if (r.isPending) return <Cargando />;
  if (r.isError) return <Alerta>{mensajeDe(r.error)}</Alerta>;
  const d = r.data;
  const dias = Array.from({ length: 14 }, (_, i) => {
    const dia = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    return { dia, total: d.porDia.find((x) => x.dia === dia)?.total ?? 0 };
  });
  const maxDia = Math.max(1, ...dias.map((x) => x.total));

  return (
    <>
      <Cabecera titulo="Resumen de la plataforma" detalle="Indicadores en vivo de usuarios, sesiones y dinero que pasa por la plataforma." />
      {(d.tutoresPendientes > 0 || d.disputasAbiertas > 0 || d.disputasEscaladas > 0) && (
        <Space orientation="vertical" style={{ width: '100%', marginBottom: 16 }}>
          {d.tutoresPendientes > 0 && <Alerta tono="espera">{d.tutoresPendientes} {d.tutoresPendientes === 1 ? 'perfil de tutor espera' : 'perfiles de tutor esperan'} verificación. <Link to="/admin/verificaciones">Revisar</Link></Alerta>}
          {d.disputasEscaladas > 0 && <Alerta>{d.disputasEscaladas} {d.disputasEscaladas === 1 ? 'caso escalado espera' : 'casos escalados esperan'} tu decisión. <Link to="/casos">Ver casos</Link></Alerta>}
          {d.disputasAbiertas > 0 && <Alerta tono="info">{d.disputasAbiertas} {d.disputasAbiertas === 1 ? 'caso de soporte abierto' : 'casos de soporte abiertos'}, {d.disputasSinAsignar} sin asignar. <Link to="/casos">Supervisar</Link></Alerta>}
        </Space>
      )}
      <Kpis>
        <Kpi fuerte etiqueta="Comisiones ganadas" valor={dinero(d.comisiones)} nota={`sobre pagos liberados; ${dinero(d.volumenPagado)} cobrados en total`} />
        <Kpi etiqueta="Dinero retenido" valor={dinero(d.retenido)} nota="pendiente de liberar" />
        <Kpi etiqueta="Sesiones finalizadas" valor={d.sesionesFinalizadas} nota={`de ${d.sesionesTotales} creadas`} />
        <Kpi etiqueta="Asignación bajo demanda" valor={d.tasaAsignacion === null ? '—' : `${d.tasaAsignacion} %`} nota="solicitudes que encontraron tutor" />
        <Kpi etiqueta="Estudiantes" valor={d.estudiantes} nota="cuentas registradas" />
        <Kpi etiqueta="Tutores verificados" valor={d.tutoresAprobados} nota={`${d.tutoresEnLinea} en línea ahora`} />
        <Kpi etiqueta="Calificación promedio" valor={d.calificacionPromedio === null ? '—' : d.calificacionPromedio.toFixed(2)} nota="de 5" />
      </Kpis>

      <Row gutter={[16, 16]} className="seccion">
        <Col xs={24} md={12}>
          <Card title="Sesiones por estado" style={{ height: '100%' }}>
            <Barras filas={d.porEstado.map((x) => ({ texto: ESTADO_SESION[x.estado].texto, total: x.total }))} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Materias más pedidas" style={{ height: '100%' }}>
            <Barras filas={d.porMateria.map((x) => ({ texto: x.materia, total: x.total }))} />
          </Card>
        </Col>
      </Row>

      <Card title="Sesiones creadas por día (últimos 14 días)" className="seccion">
        <div className="columnas">
          {dias.map((x) => (
            <div key={x.dia} title={`${x.dia}: ${x.total}`}>
              <b>{x.total || ''}</b>
              <i style={{ height: `${(x.total / maxDia) * 100}%` }} />
              <small>{x.dia.slice(8, 10)}/{x.dia.slice(5, 7)}</small>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
