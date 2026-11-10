/* Piezas compartidas de los casos de soporte: historial de la sesión, conversación con pruebas y enlace a salas. */

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Divider, Flex, Image, Input, Tag, Timeline, Typography, Upload } from 'antd';
import { FilePdfOutlined, PaperClipOutlined } from '@ant-design/icons';
import { api, subirAdjunto, urlAdjunto, TIPOS_ADJUNTO, type Evento, type Mensaje } from './api';
import { Alerta, mensajeDe } from './ui';
import { fecha, horaExacta, ROL_TEXTO, tamanoArchivo } from './formato';

/* ---------- Línea de tiempo ---------- */

/** Grupo de cada tipo de evento; define el color del punto en la línea de tiempo. */
const GRUPO: Record<string, string> = {
  SESION_CREADA: 'inicio', TUTORES_AVISADOS: 'inicio', ACEPTADA: 'bien', PAGO_COBRADO: 'dinero', PAGO_LIBERADO: 'dinero',
  PAGO_REEMBOLSADO: 'dinero', PAGO_REEMBOLSO_PARCIAL: 'dinero', SIN_REEMBOLSO: 'dinero', SALA_ABIERTA: 'sala',
  SALA_MEDIACION_ABIERTA: 'sala', SALA_MEDIACION_CREADA: 'soporte', INICIADA: 'bien', FINALIZADA: 'bien', CIERRE_AUTOMATICO: 'alerta',
  CALIFICADA: 'neutro', CALIFICACIONES_PUBLICADAS: 'neutro', DISPUTA_ABIERTA: 'alerta', DESCARGO: 'soporte', PRUEBA_ADJUNTA: 'soporte',
  CASO_TOMADO: 'soporte', CASO_ESCALADO: 'alerta', CASO_RESUELTO: 'soporte', CANCELADA: 'alerta', RECHAZADA: 'alerta',
  VENCIDA: 'alerta', NO_REALIZADA: 'alerta', SIN_TUTOR: 'alerta', SOLICITUD_DESCARTADA: 'neutro', RECORDATORIO: 'inicio',
};
const COLOR_GRUPO: Record<string, string> = {
  inicio: '#1d4c9a', bien: '#1c8c7c', dinero: '#c97b10', sala: '#0e7490', soporte: '#6d28d9', alerta: '#c0392b', neutro: '#8a94a6',
};

export function LineaTiempo({ eventos, vacio = 'Todavía no hay movimientos.' }: { eventos: Evento[]; vacio?: string }) {
  if (!eventos.length) return <Typography.Text type="secondary">{vacio}</Typography.Text>;
  const dias: { dia: string; lista: Evento[] }[] = [];
  for (const e of eventos) {
    const dia = fecha(e.fecha);
    if (dias[dias.length - 1]?.dia !== dia) dias.push({ dia, lista: [] });
    dias[dias.length - 1].lista.push(e);
  }
  return (
    <div className="linea-tiempo">
      {dias.map(({ dia, lista }) => (
        <Fragment key={dia}>
          <Divider titlePlacement="start" plain style={{ margin: '4px 0 14px' }}>{dia}</Divider>
          <Timeline items={lista.map((e) => ({
            key: e.id,
            color: COLOR_GRUPO[GRUPO[e.tipo] ?? 'neutro'],
            content: (
              <div className={`ev-${GRUPO[e.tipo] ?? 'neutro'}${e.interno ? ' interno' : ''}`}>
                <Typography.Text type="secondary" className="nums" style={{ fontSize: 12, marginRight: 8 }}>
                  <time dateTime={e.fecha}>{horaExacta(e.fecha)}</time>
                </Typography.Text>
                {e.texto}
                {e.interno && <Tag color="purple" style={{ marginLeft: 8 }}>Solo equipo</Tag>}
              </div>
            ),
          }))} />
        </Fragment>
      ))}
    </div>
  );
}

/* ---------- Conversación ---------- */

function VistaAdjunto({ a }: { a: NonNullable<Mensaje['adjunto']> }) {
  const url = urlAdjunto(a.id);
  if (a.tipo.startsWith('image/')) {
    return (
      <div className="adjunto imagen">
        <Image src={url} alt={a.nombre} width={220} style={{ borderRadius: 8 }} />
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{a.nombre} · {tamanoArchivo(a.tamano)}</Typography.Text>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="adjunto archivo">
      <Tag icon={<FilePdfOutlined />} color="red" style={{ padding: '4px 10px' }}>{a.nombre} · {tamanoArchivo(a.tamano)}</Tag>
    </a>
  );
}

/**
 * Hilo de mensajes con caja para responder. `enviar` recibe el texto y el id del archivo ya subido.
 * Las partes ven al equipo como "Soporte"; el equipo ve el nombre con el rol.
 */
export function Conversacion({ mensajes, enviar, puedeEscribir, placeholder, vacio, vistaEquipo, intro }: {
  mensajes: Mensaje[];
  enviar: (texto: string, adjuntoId: number | null) => Promise<unknown>;
  puedeEscribir: boolean;
  placeholder: string;
  vacio: string;
  vistaEquipo?: boolean;
  intro?: ReactNode;
}) {
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [mensajes.length]);

  const alEnviar = async () => {
    if (!texto.trim() && !archivo) return;
    setEnviando(true);
    setError(null);
    try {
      const adjunto = archivo ? await subirAdjunto(archivo) : null;
      await enviar(texto.trim(), adjunto?.id ?? null);
      setTexto('');
      setArchivo(null);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="conversacion">
      <div className="chat" aria-live="polite">
        {intro}
        {!mensajes.length && <Typography.Text type="secondary" className="chat-vacio">{vacio}</Typography.Text>}
        {mensajes.map((m) => {
          const equipo = m.autor.rol === 'SOPORTE' || m.autor.rol === 'ADMIN';
          const nombre = m.mio ? 'Tú' : vistaEquipo || !equipo ? `${m.autor.nombre} · ${ROL_TEXTO[m.autor.rol]}` : `${m.autor.nombre} · Soporte`;
          return (
            <div key={m.id} className={`burbuja${m.mio ? ' mia' : ''}${equipo && !m.mio ? ' equipo' : ''}${m.canal === 'INTERNO' ? ' interna' : ''}`}>
              <small>{nombre} · {fecha(m.fecha)}, {horaExacta(m.fecha)}</small>
              {m.texto && <p>{m.texto}</p>}
              {m.adjunto && <VistaAdjunto a={m.adjunto} />}
            </div>
          );
        })}
        <div ref={fin} />
      </div>
      {puedeEscribir ? (
        <Flex vertical gap={8} className="redactar">
          <Input.TextArea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} autoSize={{ minRows: 3, maxRows: 8 }} maxLength={2000}
            aria-label="Mensaje" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) alEnviar(); }} />
          {archivo && (
            <Tag closable onClose={() => setArchivo(null)} icon={<PaperClipOutlined />} style={{ alignSelf: 'flex-start' }}>
              {archivo.name} · {tamanoArchivo(archivo.size)}
            </Tag>
          )}
          {error && <Alerta>{error}</Alerta>}
          <Flex justify="space-between" align="center" gap={8}>
            <Upload accept={TIPOS_ADJUNTO.join(',')} maxCount={1} showUploadList={false}
              beforeUpload={(f) => { setArchivo(f); return false; }}>
              <Button size="small" icon={<PaperClipOutlined />}>Adjuntar prueba</Button>
            </Upload>
            <Button type="primary" size="small" loading={enviando} disabled={!texto.trim() && !archivo} onClick={alEnviar}>Enviar</Button>
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Imágenes (JPG, PNG, WEBP) o PDF de hasta 5 MB. Ctrl + Enter para enviar.</Typography.Text>
        </Flex>
      ) : (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>El caso está cerrado; la conversación queda como registro.</Typography.Text>
      )}
    </div>
  );
}

/* ---------- Salas ---------- */

/** Enlace a una sala de Jitsi que deja constancia en el historial de que la persona la abrió. Con `boton` se ve como botón. */
export function EnlaceSala({ sesionId, cual, href, children, boton }: {
  sesionId: number; cual: 'CLASE' | 'MEDIACION'; href: string; children: ReactNode; boton?: 'primario' | 'normal';
}) {
  const registrar = () => { api(`/sesiones/${sesionId}/sala`, { cual }).catch(() => undefined); };
  if (boton) {
    return <Button type={boton === 'primario' ? 'primary' : 'default'} size="small" href={href} target="_blank" rel="noreferrer" onClick={registrar}>{children}</Button>;
  }
  return <a href={href} target="_blank" rel="noreferrer" onClick={registrar}>{children}</a>;
}
