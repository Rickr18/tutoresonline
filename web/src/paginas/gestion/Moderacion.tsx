/* Moderación de comentarios (RF-M11-05, A1 de P-11) y alertas de reputación de tutores (RF-M08-08). */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Segmented, Space, Table, Typography } from 'antd';
import { api, type ComentarioModeracion, type Moderaciones } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera } from '../../comunes';
import { Alerta, Campo, Cargando, Estrellas, Insignia, Modal, Vacio, mensajeDe } from '../../ui';
import { SafetyOutlined } from '@ant-design/icons';
import { fechaHora, haceCuanto, MODERACION, ROL_TEXTO } from '../../formato';

type Decision = 'APROBAR' | 'OCULTAR' | 'ELIMINAR';
const DECISIONES: Record<Decision, { texto: string; efecto: string }> = {
  APROBAR: { texto: 'Aprobar', efecto: 'Se publica en el perfil.' },
  OCULTAR: { texto: 'Ocultar', efecto: 'No se muestra, pero el puntaje sigue contando.' },
  ELIMINAR: { texto: 'Eliminar', efecto: 'No se muestra y la calificación deja de contar en el promedio.' },
};

function Decidir({ c, cerrar }: { c: ComentarioModeracion; cerrar: () => void }) {
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const [decision, setDecision] = useState<Decision>('APROBAR');
  const [motivo, setMotivo] = useState('');
  const enviar = useMutation({
    mutationFn: () => api<ComentarioModeracion>(`/gestion/moderacion/${c.id}`, { decision, motivo: motivo.trim() }),
    onSuccess: () => {
      cola.invalidateQueries({ queryKey: ['gestion'] });
      avisar('Decisión guardada', 'bien', `${c.autor.nombre} recibe la decisión y el motivo.`);
      cerrar();
    },
  });
  return (
    <Modal titulo="Moderar comentario" cerrar={cerrar} ancho={560}>
      <Form layout="vertical" className="forma" onFinish={() => enviar.mutate()}>
        <blockquote className="cita">{c.comentario}</blockquote>
        <Typography.Text type="secondary">{c.motivo}</Typography.Text>
        <Campo etiqueta="Decisión">
          <Segmented block value={decision} onChange={(v) => setDecision(v as Decision)}
            options={(Object.keys(DECISIONES) as Decision[]).map((d) => ({ value: d, label: DECISIONES[d].texto }))} />
        </Campo>
        <Typography.Text>{DECISIONES[decision].efecto}</Typography.Text>
        <Campo etiqueta="Motivo para el autor" id="moderacion-motivo" ayuda="El autor y quien reportó lo reciben en una notificación.">
          <Input.TextArea id="moderacion-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={5} maxLength={300} autoSize={{ minRows: 2 }} />
        </Campo>
        {enviar.isError && <Alerta>{mensajeDe(enviar.error)}</Alerta>}
        <Button type="primary" htmlType="submit" block loading={enviar.isPending}>Guardar la decisión</Button>
      </Form>
    </Modal>
  );
}

export default function Moderacion() {
  const { usuario } = useSesion();
  const datos = useQuery({ queryKey: ['gestion', 'moderacion'], queryFn: () => api<Moderaciones>('/gestion/moderacion') });
  const [abierto, setAbierto] = useState<ComentarioModeracion | null>(null);
  if (datos.isPending) return <Cargando />;
  if (datos.isError) return <Alerta>{mensajeDe(datos.error)}</Alerta>;
  const d = datos.data;
  const persona = (p: ComentarioModeracion['autor']) => <>{p.nombre} <Typography.Text type="secondary" style={{ fontSize: 12 }}>({ROL_TEXTO[p.rol ?? 'ESTUDIANTE'].toLowerCase()})</Typography.Text></>;

  return (
    <>
      <Cabecera titulo="Moderación"
        detalle={<>Comentarios que retuvo el filtro automático o que reportó quien los recibió. <Link to="/manual?tab=guia">Cómo moderar</Link></>} />
      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        <Card title={`Por revisar (${d.pendientes.length})`} className="moderacion">
          {d.pendientes.length === 0 ? <Vacio icono={<SafetyOutlined />} titulo="No hay comentarios por revisar." /> : (
            <Table rowKey="id" pagination={false} dataSource={d.pendientes} columns={[
              { title: 'Estado', key: 'e', width: 170, render: (_, c) => <Insignia tono={MODERACION[c.moderacion].tono}>{MODERACION[c.moderacion].texto}</Insignia> },
              {
                title: 'Comentario', key: 'c', render: (_, c) => (
                  <Space orientation="vertical" size={4}>
                    <Estrellas valor={c.puntaje} />
                    <span>{c.comentario}</span>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>{c.motivo}</Typography.Text>
                  </Space>
                ),
              },
              { title: 'De', key: 'a', width: 170, render: (_, c) => persona(c.autor) },
              { title: 'Para', key: 'd', width: 170, render: (_, c) => persona(c.destinatario) },
              {
                title: 'Sesión', key: 's', width: 160, render: (_, c) => (
                  <><Link to={`/gestion/sesiones/${c.sesionId}`}>#{c.sesionId}</Link> {c.materia}<br />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{haceCuanto(c.reportadaEn ?? c.creadoEn)}</Typography.Text></>
                ),
              },
              { title: '', key: 'x', width: 110, render: (_, c) => <Button type="primary" onClick={() => setAbierto(c)}>Revisar</Button> },
            ]} />
          )}
        </Card>

        <Card title="Alertas de reputación" extra={<Typography.Text type="secondary">Promedio bajo {String(d.umbral).replace('.', ',')} con {d.minimo} valoraciones o más</Typography.Text>}>
          {d.alertas.length === 0 ? <Vacio icono={<SafetyOutlined />} titulo="Ningún tutor está bajo el umbral." /> : (
            <Table rowKey="id" pagination={false} dataSource={d.alertas} columns={[
              { title: 'Tutor', dataIndex: 'nombre' },
              { title: 'Promedio', dataIndex: 'promedio', render: (v: number) => <Estrellas valor={v} /> },
              { title: 'Valoraciones', dataIndex: 'valoraciones' },
              { title: 'Alerta', dataIndex: 'alertaEn', render: (v: string | null) => (v ? fechaHora(v) : 'Sin enviar') },
            ]} />
          )}
          <Typography.Paragraph type="secondary" style={{ margin: '12px 0 0', fontSize: 13 }}>
            El perfil no se oculta solo (A5 de P-08). Revisa sus sesiones y decide acompañamiento, advertencia o {usuario?.rol === 'ADMIN' ? 'suspensión en Usuarios' : 'escalarlo a administración'}.
          </Typography.Paragraph>
        </Card>

        <Card title="Revisados recientemente">
          {d.revisados.length === 0 ? <Vacio icono={<SafetyOutlined />} titulo="Todavía no hay decisiones." /> : (
            <Table rowKey="id" pagination={{ pageSize: 10, showSizeChanger: false }} dataSource={d.revisados} columns={[
              { title: 'Decisión', key: 'e', width: 130, render: (_, c) => <Insignia tono={MODERACION[c.moderacion].tono}>{MODERACION[c.moderacion].texto}</Insignia> },
              { title: 'Comentario', dataIndex: 'comentario' },
              { title: 'Motivo', dataIndex: 'motivo' },
              { title: 'Por', key: 'p', width: 200, render: (_, c) => <>{c.moderadaPor?.nombre}<br /><Typography.Text type="secondary" style={{ fontSize: 12 }}>{c.moderadaEn && fechaHora(c.moderadaEn)}</Typography.Text></> },
            ]} />
          )}
        </Card>
      </Space>
      {abierto && <Decidir c={abierto} cerrar={() => setAbierto(null)} />}
    </>
  );
}
