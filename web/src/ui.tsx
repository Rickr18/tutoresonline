/* Componentes de interfaz compartidos, construidos sobre Ant Design. Conservan la misma API que usan las páginas. */
import { cloneElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Alert, Avatar as AvatarAntd, Card, Empty, Flex, Form, Input, Modal as ModalAntd, Progress, Rate, Segmented, Spin, Statistic, Tag, Typography } from 'antd';
import { StarFilled, InboxOutlined } from '@ant-design/icons';
import { iniciales } from './formato';
import { AMBAR, MARINO } from './tema';
import { color, TONOS, type Tono } from './tokens';

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

/** Píldora de estado con el fondo y el texto del tono (tokens.ts). */
export function Insignia({ tono, children }: { tono: string; children: ReactNode }) {
  const t = TONOS[(tono in TONOS ? tono : 'neutro') as Tono];
  return (
    <Tag className={`insignia ${tono}`} variant="filled"
      style={{ marginInlineEnd: 0, background: t.fondo, color: t.texto, borderRadius: 999, fontWeight: 600, paddingInline: 10 }}>
      {children}
    </Tag>
  );
}

/** Punto verde con halo que late despacio: el tutor está en línea. Con movimiento reducido no se anima. */
export function Pulso({ tamano = 8 }: { tamano?: number }) {
  return <span className="pulso" role="img" aria-label="En línea" style={{ width: tamano, height: tamano }} />;
}

export function Avatar({ nombre, enLinea, grande }: { nombre: string; enLinea?: boolean; grande?: boolean }) {
  const avatar = (
    <AvatarAntd size={grande ? 64 : 36} className="avatar" aria-hidden
      style={{ background: color.gris, color: MARINO, fontWeight: 700, fontSize: grande ? 22 : 14, flex: 'none' }}>
      {iniciales(nombre)}
    </AvatarAntd>
  );
  if (!enLinea) return avatar;
  return <span className="avatar-linea">{avatar}<span className="avatar-pulso"><Pulso tamano={grande ? 14 : 10} /></span></span>;
}

/** Marca con la "T" ámbar. Un solo componente para el marco, el acceso y las páginas públicas. */
export function MarcaLogo({ clara }: { clara?: boolean }) {
  return (
    <span className={`marca-logo${clara ? ' clara' : ''}`}>
      <span className="logo">T</span>
      <span className="nombre">Tutores<em>On-Line</em></span>
    </span>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <Flex className="cargando" gap={10} align="center" style={{ padding: 24, color: color.tenue }}><Spin size="small" />{texto}</Flex>;
}

export function Vacio({ titulo, children, icono }: { titulo: string; children?: ReactNode; icono?: ReactNode }) {
  return (
    <Empty className="vacio" image={<span className="vacio-icono" aria-hidden>{icono ?? <InboxOutlined />}</span>} description={
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
      <Statistic title={<span className="rotulo" style={fuerte ? { color: '#c4cfe0' } : undefined}>{etiqueta}</span>} value={0} formatter={() => valor}
        styles={{ content: { fontWeight: 700, color: fuerte ? '#fff' : MARINO } }} />
      {nota && <Typography.Text style={{ fontSize: 12, color: fuerte ? '#a9b6cb' : color.tenue }}>{nota}</Typography.Text>}
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

const PASOS_RIEL: Record<'PROGRAMADA' | 'BAJO_DEMANDA', string[]> = {
  PROGRAMADA: ['Solicitada', 'Confirmada', 'En curso', 'Finalizada'],
  BAJO_DEMANDA: ['Buscando tutor', 'Tutor asignado', 'En curso', 'Finalizada'],
};
const AVANCE_RIEL: Record<string, number> = { PENDIENTE_ACEPTACION: 0, BUSCANDO_TUTOR: 0, CONFIRMADA: 1, EN_CURSO: 2, FINALIZADA: 3 };

/** Los cuatro pasos de una sesión unidos por una línea. `compacto` deja solo los puntos (fila de sesión). Sin avance (cancelada, sin tutor…) no dibuja nada. */
export function RielSesion({ tipo, estado, compacto }: { tipo: 'PROGRAMADA' | 'BAJO_DEMANDA'; estado: string; compacto?: boolean }) {
  const actual = AVANCE_RIEL[estado];
  if (actual === undefined) return null;
  return (
    <ol className={`riel${compacto ? ' compacto' : ''}`} aria-label={`Avance: ${PASOS_RIEL[tipo][actual]}`}>
      {PASOS_RIEL[tipo].map((p, i) => (
        <li key={p} className={i < actual || estado === 'FINALIZADA' ? 'hecho' : i === actual ? 'actual' : ''} aria-current={i === actual ? 'step' : undefined}>
          <span className="punto" aria-hidden />
          {!compacto && <span className="paso">{p}</span>}
        </li>
      ))}
    </ol>
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
        strokeColor={seg <= 10 ? color.rojo : AMBAR} format={() => <b style={{ color: MARINO }}>{seg}</b>} />
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
