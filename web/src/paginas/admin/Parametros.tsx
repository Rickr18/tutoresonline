/* Parámetros del negocio versionados (RF-M11-07): cada cambio es una versión nueva con fecha de vigencia y motivo. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, InputNumber, Segmented, Space, Table, Tag, Typography } from 'antd';
import { api, type ParametroAdmin } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera } from '../../comunes';
import { Alerta, Campo, Cargando, Modal, mensajeDe } from '../../ui';
import { fechaHora } from '../../formato';

const numero = (n: number) => String(n).replace('.', ',');

function Cambiar({ p, cerrar }: { p: ParametroAdmin; cerrar: () => void }) {
  const cola = useQueryClient();
  const { avisar } = useSesion();
  const [valor, setValor] = useState<number | null>(p.valor);
  const [cuando, setCuando] = useState<'ahora' | 'fecha'>('ahora');
  // Fecha y hora escritas en hora de Colombia (UTC-5), como el resto de la plataforma.
  const [fecha, setFecha] = useState('');
  const vigencia = fecha ? new Date(`${fecha}:00-05:00`) : null;
  const [motivo, setMotivo] = useState('');
  const guardar = useMutation({
    mutationFn: () => api(`/admin/parametros/${p.clave}`, {
      valor, motivo: motivo.trim(), ...(cuando === 'fecha' && vigencia ? { vigenteDesde: vigencia.toISOString() } : {}),
    }),
    onSuccess: () => {
      for (const k of ['admin', 'parametros']) cola.invalidateQueries({ queryKey: [k] });
      avisar('Parámetro guardado', 'bien', cuando === 'ahora' ? 'Rige desde ya para las operaciones nuevas.' : 'Quedó programado.');
      cerrar();
    },
  });
  return (
    <Modal titulo={p.nombre} cerrar={cerrar} ancho={520}>
      <Form layout="vertical" className="forma" onFinish={() => guardar.mutate()}>
        <Typography.Paragraph style={{ margin: 0 }}>{p.descripcion}</Typography.Paragraph>
        <Campo etiqueta={`Valor nuevo (${p.unidad})`} id="parametro-valor" ayuda={`Entre ${numero(p.min)} y ${numero(p.max)}. Valor del Corte 1: ${numero(p.valorInicial)}.`}>
          <InputNumber id="parametro-valor" min={p.min} max={p.max} step={p.decimales ? 0.1 : 1} precision={p.decimales ? 1 : 0}
            decimalSeparator="," value={valor} onChange={setValor} style={{ width: '100%' }} />
        </Campo>
        <Campo etiqueta="Entra en vigencia">
          <Segmented block value={cuando} onChange={(v) => setCuando(v as typeof cuando)} options={[{ value: 'ahora', label: 'Desde ya' }, { value: 'fecha', label: 'En una fecha' }]} />
        </Campo>
        {cuando === 'fecha' && (
          <Campo etiqueta="Fecha de vigencia (hora de Colombia)" id="parametro-fecha" ayuda={vigencia && !Number.isNaN(vigencia.getTime()) ? `Rige desde el ${fechaHora(vigencia.toISOString()).toLowerCase()}.` : undefined}>
            <Input id="parametro-fecha" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Campo>
        )}
        <Campo etiqueta="Motivo del cambio" id="parametro-motivo">
          <Input.TextArea id="parametro-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={5} maxLength={300} autoSize={{ minRows: 2 }} />
        </Campo>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          El cambio no es retroactivo: los pagos ya cobrados conservan su comisión y las sesiones ya creadas sus plazos.
        </Typography.Text>
        {guardar.isError && <Alerta>{mensajeDe(guardar.error)}</Alerta>}
        <Button type="primary" htmlType="submit" block loading={guardar.isPending} disabled={valor === null || (cuando === 'fecha' && !fecha)}>Guardar</Button>
      </Form>
    </Modal>
  );
}

export default function Parametros() {
  const datos = useQuery({ queryKey: ['admin', 'parametros'], queryFn: () => api<ParametroAdmin[]>('/admin/parametros') });
  const [abierto, setAbierto] = useState<ParametroAdmin | null>(null);
  if (datos.isPending) return <Cargando />;
  if (datos.isError) return <Alerta>{mensajeDe(datos.error)}</Alerta>;
  return (
    <>
      <Cabecera titulo="Parámetros del negocio"
        detalle={<>Comisión, plazos y umbrales que usan las reglas del Corte 1. Cada cambio queda versionado con su fecha de vigencia y en la bitácora. <Link to="/manual?tab=reglas">Ver las reglas</Link></>} />
      <Card className="parametros">
        <Table rowKey="clave" pagination={false} dataSource={datos.data} expandable={{
          expandedRowRender: (p) => (
            <Table size="small" rowKey="id" pagination={false} dataSource={p.historial} columns={[
              { title: 'Vigente desde', dataIndex: 'vigenteDesde', render: (v: string) => fechaHora(v) },
              { title: 'Valor', dataIndex: 'valor', render: (v: number) => `${numero(v)} ${p.unidad}` },
              { title: 'Motivo', dataIndex: 'motivo' },
              { title: 'Por', dataIndex: 'autor' },
            ]} />
          ),
        }} columns={[
          { title: 'Parámetro', key: 'n', render: (_, p) => <Space orientation="vertical" size={0}><b>{p.nombre}</b><Typography.Text type="secondary" style={{ fontSize: 13 }}>{p.descripcion}</Typography.Text></Space> },
          { title: 'Regla', dataIndex: 'regla', width: 110, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
          {
            title: 'Valor vigente', key: 'v', width: 190, render: (_, p) => (
              <Space orientation="vertical" size={2}>
                <b>{numero(p.valor)} {p.unidad}</b>
                {p.valor !== p.valorInicial && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Corte 1: {numero(p.valorInicial)}</Typography.Text>}
                {p.proximo && <Tag color="gold">{numero(p.proximo.valor)} desde {fechaHora(p.proximo.vigenteDesde)}</Tag>}
              </Space>
            ),
          },
          { title: '', key: 'x', width: 100, render: (_, p) => <Button onClick={() => setAbierto(p)}>Cambiar</Button> },
        ]} />
      </Card>
      {abierto && <Cambiar p={abierto} cerrar={() => setAbierto(null)} />}
    </>
  );
}
