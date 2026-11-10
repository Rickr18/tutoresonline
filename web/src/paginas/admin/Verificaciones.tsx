import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Col, Descriptions, Flex, Form, Input, Row, Tabs, Tag, Typography } from 'antd';
import { api, type Tutor, type Verificacion } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera } from '../../comunes';
import { Alerta, Avatar, Campo, Cargando, Estrellas, Insignia, Modal, Vacio, mensajeDe } from '../../ui';
import { dinero, MODALIDAD, VERIFICACION } from '../../formato';

const PESTANAS: Verificacion[] = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'INCOMPLETO'];

export default function Verificaciones() {
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const [pestana, setPestana] = useState<Verificacion>('PENDIENTE');
  const [rechazando, setRechazando] = useState<Tutor | null>(null);
  const [motivo, setMotivo] = useState('');

  const todos = useQuery({ queryKey: ['admin', 'tutores'], queryFn: () => api<Tutor[]>('/admin/tutores'), refetchInterval: 15_000 });
  const verificar = useMutation({
    mutationFn: ({ t, aprobar, motivo }: { t: Tutor; aprobar: boolean; motivo?: string }) =>
      api(`/admin/tutores/${t.id}/verificar`, { aprobar, motivo }),
    onSuccess: (_r, { t, aprobar }) => {
      cola.invalidateQueries({ queryKey: ['admin'] });
      setRechazando(null);
      setMotivo('');
      avisar(aprobar ? `${t.nombre} quedó verificado` : `Perfil de ${t.nombre} rechazado`, aprobar ? 'bien' : 'info');
    },
  });

  const lista = (todos.data ?? []).filter((t) => t.verificacion === pestana);
  const cuenta = (v: Verificacion) => (todos.data ?? []).filter((t) => t.verificacion === v).length;

  return (
    <>
      <Cabecera titulo="Verificación de tutores" detalle="Revisa la presentación, las materias y el soporte de estudios antes de publicar un perfil." />
      <Tabs activeKey={pestana} onChange={(k) => setPestana(k as Verificacion)} items={PESTANAS.map((v) => ({
        key: v,
        label: <Flex gap={8} align="center">{VERIFICACION[v].texto}<Badge count={cuenta(v)} showZero color="#e9edf3" style={{ color: '#4a5567' }} /></Flex>,
      }))} />
      {todos.isPending && <Cargando />}
      {todos.isError && <Alerta>{mensajeDe(todos.error)}</Alerta>}
      {verificar.isError && !rechazando && <Alerta>{mensajeDe(verificar.error)}</Alerta>}
      {todos.data && lista.length === 0 && <Vacio titulo={pestana === 'PENDIENTE' ? 'No hay perfiles por revisar' : 'No hay perfiles en este estado'} />}
      <Row gutter={[16, 16]}>
        {lista.map((t) => {
          const v = VERIFICACION[t.verificacion ?? 'INCOMPLETO'];
          return (
            <Col key={t.id} xs={24} md={12} xl={8}>
              <Card className="revision" style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12, height: '100%' } }}>
                <Flex gap={12} align="center">
                  <Avatar nombre={t.nombre} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text strong style={{ display: 'block' }}>{t.nombre}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }} ellipsis>{t.email}</Typography.Text>
                  </div>
                  <Insignia tono={v.tono}>{v.texto}</Insignia>
                </Flex>
                {t.bio ? <Typography.Paragraph style={{ margin: 0, fontSize: 14 }}>{t.bio}</Typography.Paragraph>
                  : <Typography.Text type="secondary">Sin presentación.</Typography.Text>}
                <Flex gap={6} wrap>{t.materias.map((m) => <Tag key={m.id} style={{ marginInlineEnd: 0 }}>{m.nombre}</Tag>)}</Flex>
                <Descriptions size="small" column={1} items={[
                  { key: 'tarifa', label: 'Tarifa', children: t.tarifaHora ? `${dinero(t.tarifaHora)} por hora` : '—' },
                  { key: 'mod', label: 'Modalidad y ciudad', children: `${MODALIDAD[t.modalidad]} · ${t.ciudad || '—'}` },
                  { key: 'doc', label: 'Soporte de estudios', children: t.documento ?? <Typography.Text type="secondary">No adjuntó</Typography.Text> },
                  ...(t.verificacion === 'APROBADO' ? [{ key: 'cal', label: 'Calificación', children: <Estrellas valor={t.calificacion} total={t.totalCalificaciones} /> }] : []),
                ]} />
                {t.verificacion === 'RECHAZADO' && t.motivoRechazo && <Alerta tono="espera" titulo="Motivo del rechazo">{t.motivoRechazo}</Alerta>}
                {t.verificacion === 'PENDIENTE' && (
                  <Flex gap={10} justify="flex-end" style={{ marginTop: 'auto' }}>
                    <Button disabled={verificar.isPending} onClick={() => { verificar.reset(); setRechazando(t); }}>Rechazar</Button>
                    <Button type="primary" loading={verificar.isPending && verificar.variables?.t.id === t.id && verificar.variables.aprobar}
                      disabled={verificar.isPending} onClick={() => verificar.mutate({ t, aprobar: true })}>Aprobar y publicar</Button>
                  </Flex>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {rechazando && (
        <Modal titulo={`Rechazar a ${rechazando.nombre}`} cerrar={() => setRechazando(null)}>
          <Form layout="vertical" className="forma" onFinish={() => verificar.mutate({ t: rechazando, aprobar: false, motivo: motivo.trim() })}>
            <Campo etiqueta="Motivo" id="rechazo-motivo" ayuda="El tutor lo ve en su perfil y puede corregir y reenviar.">
              <Input.TextArea id="rechazo-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={5} maxLength={300} autoSize={{ minRows: 3 }}
                placeholder="Por ejemplo: el soporte no es legible, adjunta el diploma en PDF" />
            </Campo>
            {verificar.isError && <Alerta>{mensajeDe(verificar.error)}</Alerta>}
            <Button danger type="primary" htmlType="submit" block loading={verificar.isPending}>Rechazar perfil</Button>
          </Form>
        </Modal>
      )}
    </>
  );
}
