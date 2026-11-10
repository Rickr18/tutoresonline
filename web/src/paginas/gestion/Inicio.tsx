import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Empty, List, Row, Typography } from 'antd';
import { api, type Caso } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera } from '../../comunes';
import { Alerta, Cargando, Insignia, Kpi, Kpis, mensajeDe } from '../../ui';
import { dinero, ESTADO_CASO, haceCuanto } from '../../formato';

const HORA = 3_600_000;

function ListaCasos({ casos, vacio }: { casos: Caso[]; vacio: string }) {
  const ir = useNavigate();
  if (!casos.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={vacio} />;
  return (
    <List dataSource={casos} renderItem={(c) => {
      const e = ESTADO_CASO[c.estado];
      const atrasado = c.estado === 'ABIERTA' && Date.now() - Date.parse(c.creadoEn) > 12 * HORA;
      return (
        <List.Item className="fila-clic" onClick={() => ir(`/casos/${c.id}`)} style={{ paddingInline: 4 }}
          extra={<Insignia tono={e.tono}>{e.texto}</Insignia>}>
          <List.Item.Meta
            title={<>Caso #{c.id} · {c.materia} <Typography.Text type="secondary" style={{ fontWeight: 400 }}>({dinero(c.monto)})</Typography.Text></>}
            description={<>
              {c.estudiante.nombre} contra {c.tutor.nombre} · {c.tutorRespondio ? 'el tutor ya respondió' : 'el tutor aún no responde'}
              <br />
              <Typography.Text type={atrasado ? 'danger' : 'secondary'} style={{ fontSize: 13 }}>
                Abierto {haceCuanto(c.creadoEn)} · último movimiento {haceCuanto(c.ultimaActividad)}
              </Typography.Text>
            </>} />
        </List.Item>
      );
    }} />
  );
}

export default function InicioSoporte() {
  const { usuario } = useSesion();
  const ir = useNavigate();
  const casos = useQuery({ queryKey: ['gestion', 'casos'], queryFn: () => api<Caso[]>('/gestion/disputas'), refetchInterval: 15_000 });
  const lista = casos.data ?? [];
  const antiguos = (a: Caso, b: Caso) => Date.parse(a.creadoEn) - Date.parse(b.creadoEn);

  const sinAsignar = lista.filter((c) => c.estado === 'ABIERTA').sort(antiguos);
  const mios = lista.filter((c) => c.estado !== 'RESUELTA' && c.asignado?.id === usuario?.id).sort(antiguos);
  const escalados = lista.filter((c) => c.estado === 'ESCALADA');
  const resueltosPorMi = lista.filter((c) => c.estado === 'RESUELTA' && c.resueltaPor?.nombre === usuario?.nombre);
  const vencidos = sinAsignar.filter((c) => Date.now() - Date.parse(c.creadoEn) > 12 * HORA).length;

  return (
    <>
      <Cabecera titulo={`Hola, ${usuario?.nombre.split(' ')[0] ?? ''}`} detalle="Tu bandeja de casos: lo que tienes asignado y lo que espera que alguien lo tome.">
        <Button type="primary" onClick={() => ir('/casos')}>Ver todos los casos</Button>
      </Cabecera>
      {casos.isPending && <Cargando />}
      {casos.isError && <Alerta>{mensajeDe(casos.error)}</Alerta>}
      {vencidos > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Alerta tono="espera">{vencidos} {vencidos === 1 ? 'caso lleva' : 'casos llevan'} más de 12 horas sin que nadie lo tome.</Alerta>
        </div>
      )}
      {casos.data && (
        <>
          <Kpis>
            <Kpi fuerte etiqueta="Mis casos abiertos" valor={mios.length} nota="asignados a ti" />
            <Kpi etiqueta="Sin asignar" valor={sinAsignar.length} nota="esperan a alguien de soporte" />
            <Kpi etiqueta="Escalados" valor={escalados.length} nota="los decide administración" />
            <Kpi etiqueta="Resueltos por ti" valor={resueltosPorMi.length} nota="en total" />
          </Kpis>
          <Row gutter={[16, 16]} className="seccion">
            <Col xs={24} lg={12}>
              <Card title="Mis casos abiertos" style={{ height: '100%' }}>
                <ListaCasos casos={mios} vacio="No tienes casos asignados. Toma uno de la lista de sin asignar." />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Sin asignar, del más antiguo al más reciente" style={{ height: '100%' }}>
                <ListaCasos casos={sinAsignar} vacio="No hay casos esperando. Buen trabajo." />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </>
  );
}
