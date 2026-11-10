/* Componentes de interfaz compartidos, construidos sobre Ant Design. Conservan la misma API que usan las páginas. */
import { cloneElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Alert, Avatar as AvatarAntd, Badge, Card, Empty, Flex, Form, Input, Modal as ModalAntd, Progress, Rate, Segmented, Spin, Statistic, Tag, Typography } from 'antd';
import { StarFilled } from '@ant-design/icons';
import { iniciales } from './formato';
import { AMBAR, MARINO } from './tema';

export function Estrellas({ valor, total, grande }: { valor: number | null; total?: number; grande?: boolean }) {
  if (valor === null) return <Typography.Text type="secondary" className="estrellas vacias">Sin calificaciones</Typography.Text>;
  return (
    <span className={`estrellas${grande ? ' grande' : ''}`} aria-label={`${valor.toFixed(1)} de 5`}>
      <StarFilled style={{ color: AMBAR }} aria-hidden />
      <b>{valor.toFixed(1)}</b>
      {total !== undefined && <Typography.Text type="secondary">({total})</Typography.Text>}
    </span>
  );
}

/** Puntaje de 1 a 5. Cada estrella es un radio con nombre "N de 5". */
export function SelectorEstrellas({ valor, cambiar }: { valor: number; cambiar: (n: number) => void }) {
  return (
    <Rate className="selector-estrellas" value={valor} onChange={(n) => n && cambiar(n)} style={{ fontSize: 30, color: AMBAR }}
      aria-label="Puntaje" characterRender={(nodo, { index = 0 }) => {
        // antd pone role="radio" en el div interno de cada estrella: ahí va el nombre accesible.
        const li = nodo as ReactElement<{ children: ReactElement }>;
        return cloneElement(li, {}, cloneElement(li.props.children, { 'aria-label': `${index + 1} de 5` } as object));
      }} />
  );
}

const COLOR_TONO: Record<string, string> = { espera: 'gold', bien: 'green', activo: 'blue', neutro: 'default', mal: 'red' };

export function Insignia({ tono, children }: { tono: string; children: ReactNode }) {
  return <Tag color={COLOR_TONO[tono] ?? 'default'} className={`insignia ${tono}`} style={{ marginInlineEnd: 0 }}>{children}</Tag>;
}

export function Avatar({ nombre, enLinea, grande }: { nombre: string; enLinea?: boolean; grande?: boolean }) {
  const avatar = (
    <AvatarAntd size={grande ? 64 : 36} className="avatar" aria-hidden
      style={{ background: '#e9edf3', color: MARINO, fontWeight: 700, fontSize: grande ? 22 : 14, flex: 'none' }}>
      {iniciales(nombre)}
    </AvatarAntd>
  );
  return enLinea === undefined ? avatar : <Badge dot={enLinea} color="#1c8c7c" offset={[-4, 30]}>{avatar}</Badge>;
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <Flex className="cargando" gap={10} align="center" style={{ padding: 24, color: '#5f6b7c' }}><Spin size="small" />{texto}</Flex>;
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <Empty className="vacio" image={Empty.PRESENTED_IMAGE_SIMPLE} description={
      <><Typography.Text strong>{titulo}</Typography.Text>{children && <><br /><Typography.Text type="secondary">{children}</Typography.Text></>}</>
    } />
  );
}

const TIPO_ALERTA = { mal: 'error', info: 'info', bien: 'success', espera: 'warning' } as const;

export function Alerta({ tono = 'mal', titulo, children }: { tono?: 'mal' | 'info' | 'bien' | 'espera'; titulo?: ReactNode; children?: ReactNode }) {
  return (
    <Alert className={`alerta ${tono}`} type={TIPO_ALERTA[tono]} showIcon role={tono === 'mal' ? 'alert' : 'status'}
      title={titulo ?? children} description={titulo ? children : undefined} />
  );
}

/** Indicador grande con etiqueta y nota. `fuerte` lo resalta con el color de la marca. */
export function Kpi({ etiqueta, valor, nota, fuerte }: { etiqueta: ReactNode; valor: ReactNode; nota?: ReactNode; fuerte?: boolean }) {
  return (
    <Card className={`kpi${fuerte ? ' fuerte' : ''}`} size="small" style={fuerte ? { background: MARINO, borderColor: MARINO } : undefined}>
      {/* formatter muestra el valor tal cual: puede traer íconos (la estrella de la calificación), no solo números. */}
      <Statistic title={<span style={fuerte ? { color: '#c4cfe0' } : undefined}>{etiqueta}</span>} value={0} formatter={() => valor}
        styles={{ content: { fontWeight: 700, color: fuerte ? '#fff' : MARINO } }} />
      {nota && <Typography.Text style={{ fontSize: 12, color: fuerte ? '#a9b6cb' : '#5f6b7c' }}>{nota}</Typography.Text>}
    </Card>
  );
}

/** Rejilla de indicadores que se acomoda al ancho disponible. */
export function Kpis({ children }: { children: ReactNode }) {
  return <div className="kpis">{children}</div>;
}

export function Modal({ titulo, cerrar, children, ancho }: { titulo: string; cerrar: () => void; children: ReactNode; ancho?: number }) {
  return (
    <ModalAntd open title={titulo} onCancel={cerrar} footer={null} width={ancho ?? 480} destroyOnHidden className="modal">
      <div className="modal-cuerpo">{children}</div>
    </ModalAntd>
  );
}

/** Etiqueta, control y ayuda en vertical. `id` une la etiqueta con el control. */
export function Campo({ etiqueta, id, ayuda, children }: { etiqueta: ReactNode; id?: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <Form.Item label={etiqueta} htmlFor={id} extra={ayuda} layout="vertical" className="campo" style={{ marginBottom: 0 }}>
      {children}
    </Form.Item>
  );
}

/** Segundos que faltan para una fecha; se actualiza cada 250 ms. */
export function useCuentaAtras(hasta: string | null) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    if (!hasta) return;
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, [hasta]);
  return hasta ? Math.max(0, Math.ceil((Date.parse(hasta) - ahora) / 1000)) : 0;
}

export function Reloj({ hasta, total = 45, gigante }: { hasta: string; total?: number; gigante?: boolean }) {
  const seg = useCuentaAtras(hasta);
  return (
    <span className={`reloj${gigante ? ' gigante' : ''}${seg <= 10 ? ' urgente' : ''}`} role="timer" aria-label={`${seg} segundos`}>
      <Progress type="circle" size={gigante ? 120 : 60} percent={Math.min(100, (seg / total) * 100)}
        strokeColor={seg <= 10 ? '#c0392b' : AMBAR} format={() => <b style={{ color: MARINO }}>{seg}</b>} />
    </span>
  );
}

export interface DatosPago { metodo: 'TARJETA' | 'PSE' | 'NEQUI'; numero: string }

export function FormularioPago({ valor, cambiar }: { valor: DatosPago; cambiar: (p: DatosPago) => void }) {
  return (
    <fieldset className="pago">
      <legend>Medio de pago</legend>
      <Segmented block value={valor.metodo} onChange={(m) => cambiar({ ...valor, metodo: m as DatosPago['metodo'] })}
        options={[{ value: 'TARJETA', label: 'Tarjeta' }, { value: 'PSE', label: 'PSE' }, { value: 'NEQUI', label: 'Nequi' }]} />
      {valor.metodo === 'TARJETA' ? (
        <Campo etiqueta="Número de la tarjeta" id="numero-tarjeta"
          ayuda="Pago simulado. Usa cualquier número de 16 dígitos; los terminados en 0000 son rechazados.">
          <Input id="numero-tarjeta" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={valor.numero}
            onChange={(e) => cambiar({ ...valor, numero: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })} />
        </Campo>
      ) : (
        <Typography.Text type="secondary">Pago simulado: en producción se abriría la pasarela de {valor.metodo === 'PSE' ? 'PSE' : 'Nequi'}.</Typography.Text>
      )}
    </fieldset>
  );
}

export function mensajeDe(e: unknown) {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
}
