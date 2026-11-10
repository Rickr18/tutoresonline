import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, Flex, Select, Typography } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { api, type Bloque } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera } from '../../comunes';
import { Alerta, mensajeDe } from '../../ui';
import { DIAS, horaDelDia } from '../../formato';

const ORDEN = [1, 2, 3, 4, 5, 6, 0];
const DESDE = Array.from({ length: 24 }, (_, h) => ({ value: h, label: horaDelDia(h) }));
const HASTA = Array.from({ length: 24 }, (_, i) => i + 1).map((h) => ({ value: h, label: h === 24 ? '12:00 a. m. (medianoche)' : horaDelDia(h) }));

export default function Disponibilidad() {
  const { usuario, refrescar, avisar } = useSesion();
  const [bloques, setBloques] = useState<Bloque[]>(usuario?.tutor?.disponibilidad ?? []);
  const [cambios, setCambios] = useState(false);

  const guardar = useMutation({
    mutationFn: () => api('/tutor/disponibilidad', { bloques }, 'PUT'),
    onSuccess: async () => { await refrescar(); setCambios(false); avisar('Disponibilidad guardada', 'bien'); },
  });

  const cambiar = (nuevos: Bloque[]) => { setBloques(nuevos); setCambios(true); };
  const agregar = (dia: number) => {
    const delDia = bloques.filter((b) => b.diaSemana === dia);
    const desde = delDia.length ? Math.min(23, Math.max(...delDia.map((b) => b.horaFin))) : 14;
    cambiar([...bloques, { diaSemana: dia, horaInicio: desde, horaFin: Math.min(24, desde + 3) }]);
  };
  const editar = (i: number, campo: 'horaInicio' | 'horaFin', valor: number) => cambiar(bloques.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)));
  const quitar = (i: number) => cambiar(bloques.filter((_, j) => j !== i));
  const horasSemana = bloques.reduce((n, b) => n + Math.max(0, b.horaFin - b.horaInicio), 0);

  return (
    <div style={{ maxWidth: 820 }}>
      <Cabecera titulo="Disponibilidad semanal" detalle="Los estudiantes solo pueden reservar dentro de estos bloques, en hora de Colombia. Cada reserva empieza en punto.">
        <Button type="primary" disabled={!cambios} loading={guardar.isPending} onClick={() => guardar.mutate()}>Guardar cambios</Button>
      </Cabecera>
      {guardar.isError && <Alerta>{mensajeDe(guardar.error)}</Alerta>}
      <Card className="agenda" style={{ marginTop: 12 }} styles={{ body: { padding: 0 } }}>
        {ORDEN.map((dia, n) => {
          const delDia = bloques.map((b, i) => ({ b, i })).filter(({ b }) => b.diaSemana === dia);
          return (
            <Flex key={dia} className="dia" gap={14} align="center" wrap
              style={{ padding: '12px 18px', borderTop: n ? '1px solid #e2e7ee' : undefined }}>
              <Typography.Text strong style={{ width: 90 }}>{DIAS[dia]}</Typography.Text>
              <Flex vertical gap={8} style={{ flex: 1, minWidth: 260 }}>
                {delDia.length === 0 ? <Typography.Text type="secondary">Sin atención</Typography.Text> : delDia.map(({ b, i }) => (
                  <Flex key={i} className="bloque" gap={8} align="center">
                    <Select aria-label="Desde" value={b.horaInicio} onChange={(v) => editar(i, 'horaInicio', v)} options={DESDE} style={{ width: 130 }} />
                    <Typography.Text type="secondary">a</Typography.Text>
                    <Select aria-label="Hasta" value={b.horaFin} onChange={(v) => editar(i, 'horaFin', v)} options={HASTA} style={{ width: 200 }} />
                    <Button type="text" icon={<CloseOutlined />} aria-label="Quitar bloque" onClick={() => quitar(i)} />
                  </Flex>
                ))}
              </Flex>
              <Button size="small" icon={<PlusOutlined />} onClick={() => agregar(dia)}>Bloque</Button>
            </Flex>
          );
        })}
      </Card>
      <Typography.Paragraph type="secondary" style={{ marginTop: 10, fontSize: 13 }}>
        {horasSemana} horas a la semana. Las reservas ya confirmadas no cambian al editar el horario.
      </Typography.Paragraph>
    </div>
  );
}
