/*
 * Manual de funcionamiento para soporte y administración. Reúne los códigos de los documentos del proyecto
 * (procesos P, requerimientos RF y RNF, reglas RN, actores ACT, entidades EXT) y dice cómo quedó cada uno en el prototipo,
 * con los estados, las transiciones, los códigos de la bitácora y los valores vigentes de los parámetros.
 * Los textos del Corte 1 vienen de manual/corte1.json (lo genera docs/manual/generar.mjs).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Col, Collapse, Descriptions, Flex, Input, Row, Segmented, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { useSesion } from '../../sesion';
import { Cabecera, useParametros } from '../../comunes';
import { Alerta, Cargando } from '../../ui';
import corte1 from '../../manual/corte1.json';
import { AUDITORIA, ESTADO_PROTOTIPO, ESTADOS, EVENTOS, PROCESO, RF, RN, TRANSICIONES, type EstadoPrototipo } from '../../manual/codigos';

type Requerimiento = { id: string; texto: string; actor: string; prioridad: string; criterio: string; modulo: string };
const PRIORIDAD: Record<string, string> = { M: 'Debe tener', S: 'Debería tener', C: 'Podría tener' };
const requerimientos: Requerimiento[] = corte1.modulos.flatMap((m) => m.requerimientos.map((r) => ({ ...r, modulo: `${m.id} ${m.nombre}` })));

/** Convierte "RF-M05-01 a RF-M05-08, RF-M09-02" en la lista de códigos. */
function codigosDe(texto: string) {
  const res: string[] = [];
  for (const parte of texto.split(',').map((p) => p.trim())) {
    const r = parte.match(/^(RF-M\d+)-(\d+) a RF-M\d+-(\d+)$/);
    if (r) for (let i = Number(r[2]); i <= Number(r[3]); i++) res.push(`${r[1]}-${String(i).padStart(2, '0')}`);
    else if (/^RF-M\d+-\d+$/.test(parte)) res.push(parte);
  }
  return res;
}

function Estado({ e }: { e: EstadoPrototipo }) {
  return <Tag color={ESTADO_PROTOTIPO[e].color} style={{ marginInlineEnd: 0 }}>{ESTADO_PROTOTIPO[e].texto}</Tag>;
}
const Codigo = ({ children }: { children: string }) => <Typography.Text code style={{ whiteSpace: 'nowrap' }}>{children}</Typography.Text>;

/** Diagrama Mermaid del documento (BPMN de los procesos, mapa y contexto). Mermaid se carga solo cuando se abre. */
function Diagrama({ codigo, nombre }: { codigo: string; nombre: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', flowchart: { useMaxWidth: true } });
      const { svg } = await mermaid.render(`diagrama-${nombre.replace(/\W/g, '')}-${Date.now()}`, codigo);
      if (!vivo || !caja.current) return;
      caja.current.innerHTML = svg;
      setEstado('listo');
    }).catch(() => vivo && setEstado('error'));
    return () => { vivo = false; };
  }, [codigo, nombre]);
  return (
    <div className="diagrama" role="img" aria-label={`Diagrama: ${nombre}`}>
      {estado === 'cargando' && <Cargando texto="Dibujando el diagrama…" />}
      {estado === 'error' && <Alerta tono="espera">No se pudo dibujar el diagrama.</Alerta>}
      <div ref={caja} style={{ overflowX: 'auto', textAlign: 'center' }} />
    </div>
  );
}

/* ---------- Pestañas ---------- */

function Guia({ esAdmin }: { esAdmin: boolean }) {
  const p = useParametros();
  return (
    <Row gutter={[20, 20]}>
      <Col xs={24} lg={14}>
        <Space orientation="vertical" size={20} style={{ width: '100%' }}>
          <Card title="Cómo leer los códigos">
            <Descriptions size="small" column={1} bordered items={[
              { key: 'p', label: <Codigo>P-01 … P-11</Codigo>, children: 'Procesos del Corte 1, con flujo principal, alternativos (A1, A2…) y excepciones (E1, E2…). "A1 de P-04" es el flujo alternativo 1 de la reserva.' },
              { key: 'rf', label: <Codigo>RF-M05-07</Codigo>, children: 'Requerimiento funcional 7 del módulo M05. La pestaña Requerimientos dice si funciona en el prototipo.' },
              { key: 'rn', label: <Codigo>RN-06</Codigo>, children: 'Regla de negocio. Varias tienen un parámetro que administración puede cambiar.' },
              { key: 'rnf', label: <Codigo>RNF-02</Codigo>, children: 'Requerimiento no funcional (desempeño, seguridad, disponibilidad).' },
              { key: 'act', label: <><Codigo>ACT-01</Codigo> <Codigo>EXT-01</Codigo></>, children: 'Actores (personas) y entidades externas (pasarela, videollamada, mensajería…).' },
              { key: 'ev', label: <Codigo>DISPUTA_ABIERTA</Codigo>, children: 'Códigos en mayúsculas: estados de la base de datos y tipos de evento de la bitácora.' },
            ]} />
          </Card>
          <Card title="Cómo atender un caso de soporte (P-11)">
            <ol className="pasos-manual">
              <li>En <Link to="/casos">Casos</Link>, toma uno <Codigo>ABIERTA</Codigo>. Pasa a <Codigo>EN_REVISION</Codigo> a tu nombre y las dos partes reciben aviso.</li>
              <li>Lee el motivo y revisa el historial de la sesión: horas de entrada a la sala (<Codigo>SALA_ABIERTA</Codigo>), inicio y fin reales, retraso y calificaciones.</li>
              <li>Escribe a cada parte por su canal. Lo que escribe el estudiante no lo ve el tutor y al revés. Usa la nota interna para el equipo.</li>
              <li>Pide pruebas (JPG, PNG, WEBP o PDF hasta 5 MB). Si las versiones chocan, abre una videollamada de mediación.</li>
              <li>Decide: <Codigo>REEMBOLSO_TOTAL</Codigo>, <Codigo>REEMBOLSO_PARCIAL</Codigo> (50 %) o <Codigo>LIBERAR</Codigo> (pago al tutor), con una explicación para las partes.</li>
              <li>Si no puedes decidir, escálalo con motivo: queda <Codigo>ESCALADA</Codigo> y solo un administrador lo resuelve.</li>
            </ol>
            <Typography.Text type="secondary">
              Mientras el caso está abierto el pago está <Codigo>EN_DISPUTA</Codigo>. El caso se puede abrir desde el estudiante o desde el tutor,
              dentro de las {p.PLAZO_DISPUTA_H} horas siguientes a la sesión (RN-09).
            </Typography.Text>
          </Card>
          <Card title="Cómo moderar comentarios (RF-M11-05)">
            <ol className="pasos-manual">
              <li>En <Link to="/moderacion">Moderación</Link> están los comentarios <Codigo>RETENIDA</Codigo> (los frenó el filtro automático) y <Codigo>REPORTADA</Codigo> (los reportó quien los recibió).</li>
              <li>Mientras esperan, el comentario no se ve en el perfil; el puntaje sí cuenta.</li>
              <li>Decide con un motivo: aprobar (se publica), ocultar (no se ve, el puntaje cuenta) o eliminar (no se ve ni cuenta en el promedio).</li>
              <li>El autor y quien reportó reciben la decisión y el motivo. Queda en la bitácora como <Codigo>COMENTARIO_MODERADO</Codigo>.</li>
            </ol>
          </Card>
        </Space>
      </Col>
      <Col xs={24} lg={10}>
        <Space orientation="vertical" size={20} style={{ width: '100%' }}>
          <Card title="Valores vigentes">
            <Descriptions size="small" column={1} items={[
              { key: 'c', label: 'Comisión (RN-03)', children: `${p.COMISION_PCT} %` },
              { key: 'r', label: 'Respuesta a una reserva (RN-05)', children: `${p.PLAZO_RESERVA_H} horas` },
              { key: 't', label: 'Turno bajo demanda (RN-05)', children: `${p.TURNO_DEMANDA_S} segundos por tutor, ${p.BUSQUEDA_DEMANDA_MIN} minutos en total` },
              { key: 'g', label: 'Garantía del pago (RN-02)', children: `${p.GARANTIA_H} horas` },
              { key: 'd', label: 'Plazo de disputa (RN-09)', children: `${p.PLAZO_DISPUTA_H} horas` },
              { key: 'x', label: 'Cancelación (RN-06)', children: `100 % con más de ${p.REEMBOLSO_TOTAL_H} h, ${p.REEMBOLSO_PARCIAL_PCT} % hasta ${p.REEMBOLSO_PARCIAL_H} h, 0 % después` },
              { key: 'k', label: 'Calificaciones (RN-08)', children: `Juntas o a los ${p.PUBLICACION_DIAS} días` },
              { key: 'i', label: 'Tolerancia de inasistencia', children: `${p.TOLERANCIA_MIN} minutos` },
              { key: 'm', label: 'Recordatorios', children: `${p.RECORDATORIO_1_H} h y ${p.RECORDATORIO_2_MIN} min antes` },
              { key: 'u', label: 'Alerta de reputación', children: `Promedio bajo ${String(p.UMBRAL_REPUTACION).replace('.', ',')} con ${p.MIN_VALORACIONES} valoraciones o más` },
            ]} />
            {esAdmin && <Typography.Paragraph style={{ margin: '12px 0 0' }}>Se cambian en <Link to="/admin/parametros">Parámetros</Link>, con fecha de vigencia.</Typography.Paragraph>}
          </Card>
          <Card title="Lo que el prototipo simula">
            <Typography.Paragraph style={{ margin: 0 }}>
              Los cobros (tarjeta terminada en 0000 = rechazada), el soporte de estudios del tutor y el código para recuperar la contraseña,
              que en modo demostración aparece en pantalla. No hay correo, push ni SMS: las notificaciones van a la campana y en tiempo real.
              En modo demostración el tutor puede iniciar antes de la hora y administración puede liberar un pago antes de la garantía.
            </Typography.Paragraph>
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

function Reglas() {
  const p = useParametros();
  return (
    <Table className="manual-tabla" rowKey="id" pagination={false} size="middle" dataSource={corte1.reglas} columns={[
      { title: 'Código', dataIndex: 'id', width: 90, render: (v: string) => <Codigo>{v}</Codigo> },
      { title: 'Regla (Corte 1)', dataIndex: 'texto' },
      { title: 'Cómo se cumple', key: 'como', render: (_, r) => RN[r.id]?.como },
      {
        title: 'Parámetro vigente', key: 'param', width: 230, render: (_, r) => (RN[r.id]?.parametros ?? []).map((k) => (
          <div key={k}><Codigo>{k}</Codigo> {String(p[k]).replace('.', ',')}</div>
        )),
      },
      { title: 'Requerimientos', dataIndex: 'trazabilidad', width: 150, render: (v: string) => <Typography.Text type="secondary" style={{ fontSize: 13 }}>{v}</Typography.Text> },
    ]} />
  );
}

function TablaEstados({ filas }: { filas: readonly (readonly [string, string])[] }) {
  return (
    <Table size="small" pagination={false} rowKey={(f) => f[0]} dataSource={filas.map((f) => [...f])}
      columns={[{ title: 'Código', key: 'c', width: 220, render: (_, f) => <Codigo>{f[0]}</Codigo> }, { title: 'Significado', key: 's', render: (_, f) => f[1] }]} />
  );
}

function Estados() {
  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <Card title="Transiciones de la sesión (diagrama de estados del Corte 2)">
        <Table size="small" pagination={false} rowKey={(t) => `${t.desde}-${t.evento}`} dataSource={TRANSICIONES} columns={[
          { title: 'Desde', dataIndex: 'desde', width: 200, render: (v: string) => <Codigo>{v}</Codigo> },
          { title: 'Qué pasa', dataIndex: 'evento' },
          { title: 'Hacia', dataIndex: 'hacia', width: 200, render: (v: string) => <Codigo>{v}</Codigo> },
          { title: 'Regla', dataIndex: 'regla', width: 170 },
        ]} />
      </Card>
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={12}><Card title="Sesión"><TablaEstados filas={ESTADOS.sesion} /></Card></Col>
        <Col xs={24} lg={12}><Card title="Pago"><TablaEstados filas={ESTADOS.pago} /></Card></Col>
        <Col xs={24} lg={12}><Card title="Caso de soporte"><TablaEstados filas={ESTADOS.caso} /></Card></Col>
        <Col xs={24} lg={12}><Card title="Comentario"><TablaEstados filas={ESTADOS.comentario} /></Card></Col>
        <Col xs={24} lg={12}><Card title="Verificación del tutor"><TablaEstados filas={ESTADOS.verificacion} /></Card></Col>
      </Row>
    </Space>
  );
}

function Procesos({ elegido, elegir }: { elegido: string; elegir: (id: string) => void }) {
  const pr = corte1.procesos.find((x) => x.id === elegido) ?? corte1.procesos[0];
  const rfs = codigosDe(pr.requerimientos);
  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <Flex gap={12} align="center" wrap>
        <label htmlFor="manual-proceso"><b>Proceso</b></label>
        <Select id="manual-proceso" value={pr.id} onChange={elegir} style={{ minWidth: 320 }}
          options={corte1.procesos.map((x) => ({ value: x.id, label: `${x.id} · ${x.nombre}` }))} />
      </Flex>
      <Alerta tono="info" titulo={`${pr.id} en el prototipo`}>{PROCESO[pr.id]}</Alerta>
      <Card title={`${pr.id} · ${pr.nombre}`}>
        <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered items={[
          { key: 'o', label: 'Objetivo', span: 2, children: pr.objetivo },
          { key: 'a', label: 'Actor iniciador', children: pr.actor },
          { key: 'p', label: 'Participantes', children: pr.participantes },
          { key: 'd', label: 'Disparador', span: 2, children: pr.disparador },
          { key: 'e', label: 'Entradas', children: pr.entradas },
          { key: 's', label: 'Salidas', children: pr.salidas },
          { key: 'r', label: 'Requerimientos', span: 2, children: <Flex gap={6} wrap>{rfs.map((id) => <Tag key={id} color={RF[id] ? ESTADO_PROTOTIPO[RF[id][0]].color : undefined}>{id}</Tag>)}</Flex> },
        ]} />
      </Card>
      <Card title="Diagrama BPMN (Corte 1)"><Diagrama codigo={pr.diagrama} nombre={pr.id} /></Card>
      <Card title="Flujo principal">
        <Table size="small" pagination={false} rowKey="n" dataSource={pr.flujo} columns={[
          { title: '#', dataIndex: 'n', width: 50 }, { title: 'Actor', dataIndex: 'actor', width: 180 }, { title: 'Acción', dataIndex: 'accion' },
        ]} />
      </Card>
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <Card title="Flujos alternativos">
            <Table size="small" pagination={false} rowKey="id" dataSource={pr.alternativos} columns={[
              { title: 'Código', dataIndex: 'id', width: 70, render: (v: string) => <Codigo>{v}</Codigo> },
              { title: 'Si…', dataIndex: 'condicion' }, { title: 'Entonces', dataIndex: 'camino' },
            ]} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Excepciones">
            <Table size="small" pagination={false} rowKey="id" dataSource={pr.excepciones} columns={[
              { title: 'Código', dataIndex: 'id', width: 70, render: (v: string) => <Codigo>{v}</Codigo> },
              { title: 'Excepción', dataIndex: 'excepcion' }, { title: 'Tratamiento', dataIndex: 'tratamiento' },
            ]} />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function Requerimientos() {
  const [q, setQ] = useState('');
  const [modulo, setModulo] = useState<string>('');
  const [estado, setEstado] = useState<string>('');
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return requerimientos.filter((r) => (!modulo || r.modulo.startsWith(modulo)) && (!estado || RF[r.id]?.[0] === estado)
      && (!t || `${r.id} ${r.texto} ${r.criterio} ${RF[r.id]?.[1] ?? ''}`.toLowerCase().includes(t)));
  }, [q, modulo, estado]);
  const cuenta = (e: EstadoPrototipo) => requerimientos.filter((r) => RF[r.id]?.[0] === e).length;
  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Flex gap={12} wrap align="center">
        <Input.Search id="manual-buscar" aria-label="Buscar requerimiento" placeholder="Buscar por código o palabra" allowClear value={q}
          onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 300 }} />
        <Select aria-label="Módulo" value={modulo} onChange={setModulo} style={{ minWidth: 260 }}
          options={[{ value: '', label: 'Todos los módulos' }, ...corte1.modulos.map((m) => ({ value: m.id, label: `${m.id} ${m.nombre}` }))]} />
        <Segmented value={estado} onChange={(v) => setEstado(String(v))} options={[
          { value: '', label: `Todos (${requerimientos.length})` },
          ...(Object.keys(ESTADO_PROTOTIPO) as EstadoPrototipo[]).map((e) => ({ value: e, label: `${ESTADO_PROTOTIPO[e].texto} (${cuenta(e)})` })),
        ]} />
      </Flex>
      <Table className="manual-tabla" rowKey="id" size="middle" dataSource={lista} pagination={{ pageSize: 20, showSizeChanger: false }} columns={[
        { title: 'Código', dataIndex: 'id', width: 110, render: (v: string) => <Codigo>{v}</Codigo> },
        { title: 'Requerimiento (Corte 1)', key: 'texto', render: (_, r) => <>{r.texto}<br /><Typography.Text type="secondary" style={{ fontSize: 13 }}>Criterio: {r.criterio}</Typography.Text></> },
        { title: 'Prioridad', dataIndex: 'prioridad', width: 110, render: (v: string) => <span title={PRIORIDAD[v]}>{v} · {PRIORIDAD[v]}</span> },
        { title: 'En el prototipo', key: 'estado', width: 320, render: (_, r) => RF[r.id] && <><Estado e={RF[r.id][0]} /> <span style={{ fontSize: 13 }}>{RF[r.id][1]}</span></> },
      ]} />
      <Collapse items={[{
        key: 'rnf', label: `Requerimientos no funcionales (${corte1.noFuncionales.length})`, children: (
          <Table size="small" rowKey="id" pagination={false} dataSource={corte1.noFuncionales} columns={[
            { title: 'Código', dataIndex: 'id', width: 90, render: (v: string) => <Codigo>{v}</Codigo> },
            { title: 'Categoría', dataIndex: 'categoria', width: 170 },
            { title: 'Requerimiento', dataIndex: 'texto' }, { title: 'Métrica', dataIndex: 'metrica' },
            { title: 'Prior.', dataIndex: 'prioridad', width: 60 },
          ]} />
        ),
      }]} />
    </Space>
  );
}

function Bitacora() {
  const columnas = [
    { title: 'Código', dataIndex: 'codigo', width: 260, render: (v: string) => <Codigo>{v}</Codigo> },
    { title: 'Qué significa', dataIndex: 'texto' },
  ];
  return (
    <Row gutter={[20, 20]}>
      <Col xs={24} xl={14}>
        <Card title="Historial de una sesión" extra={<Typography.Text type="secondary">Los internos solo los ve el equipo</Typography.Text>}>
          <Table size="small" pagination={false} rowKey="codigo" dataSource={EVENTOS} columns={[
            ...columnas,
            { title: 'Regla', dataIndex: 'regla', width: 140, render: (v?: string) => v ?? '' },
            { title: '', dataIndex: 'interno', width: 70, render: (v?: boolean) => (v ? <Tag color="purple">Interno</Tag> : null) },
          ]} />
        </Card>
      </Col>
      <Col xs={24} xl={10}>
        <Card title="Bitácora de administración (Actividad)">
          <Table size="small" pagination={false} rowKey="codigo" dataSource={AUDITORIA} columns={columnas} />
        </Card>
      </Col>
    </Row>
  );
}

function Contexto() {
  const [cual, setCual] = useState<'contexto' | 'mapa'>('contexto');
  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <Card title="Diagramas del Corte 1" extra={<Segmented value={cual} onChange={(v) => setCual(v as typeof cual)}
        options={[{ value: 'contexto', label: 'Diagrama de contexto' }, { value: 'mapa', label: 'Mapa de procesos' }]} />}>
        <Diagrama codigo={cual === 'contexto' ? corte1.contexto : corte1.mapa} nombre={cual} />
      </Card>
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <Card title="Actores">
            <Table size="small" pagination={false} rowKey="id" dataSource={corte1.actores} columns={[
              { title: 'Código', dataIndex: 'id', width: 80, render: (v: string) => <Codigo>{v}</Codigo> },
              { title: 'Actor', dataIndex: 'nombre', width: 120 }, { title: 'Descripción', dataIndex: 'descripcion' },
            ]} />
            <Typography.Paragraph type="secondary" style={{ margin: '10px 0 0', fontSize: 13 }}>
              En el prototipo el administrador del Corte 1 se divide en dos roles: soporte (casos y moderación) y administración (todo lo demás).
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Entidades externas">
            <Table size="small" pagination={false} rowKey="id" dataSource={corte1.externas} columns={[
              { title: 'Código', dataIndex: 'id', width: 80, render: (v: string) => <Codigo>{v}</Codigo> },
              { title: 'Entidad', dataIndex: 'nombre', width: 170 }, { title: 'Servicio', dataIndex: 'servicio' },
            ]} />
            <Typography.Paragraph type="secondary" style={{ margin: '10px 0 0', fontSize: 13 }}>
              En el prototipo: EXT-01 simulada, EXT-02 es Jitsi Meet, EXT-04 se reemplaza por la campana y el tiempo real. EXT-03, EXT-05 y EXT-06 no se usan.
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

const PESTANAS = ['guia', 'reglas', 'estados', 'procesos', 'requerimientos', 'bitacora', 'contexto'] as const;

export default function Manual() {
  const { usuario } = useSesion();
  const [params, setParams] = useSearchParams();
  const tab = PESTANAS.includes(params.get('tab') as (typeof PESTANAS)[number]) ? params.get('tab')! : 'guia';
  const proceso = params.get('p') ?? 'P-01';
  const ir = (cambios: Record<string, string>) => setParams((p) => { for (const [k, v] of Object.entries(cambios)) p.set(k, v); return p; }, { replace: true });

  return (
    <>
      <Cabecera titulo="Manual de funcionamiento"
        detalle="Los códigos de los documentos del proyecto (procesos, requerimientos y reglas del Corte 1, estados del Corte 2) y cómo quedó cada uno en la plataforma." />
      <Tabs className="manual" activeKey={tab} onChange={(k) => ir({ tab: k })} items={[
        { key: 'guia', label: 'Guía', children: <Guia esAdmin={usuario?.rol === 'ADMIN'} /> },
        { key: 'reglas', label: 'Reglas (RN)', children: <Reglas /> },
        { key: 'estados', label: 'Estados', children: <Estados /> },
        { key: 'procesos', label: 'Procesos (P)', children: <Procesos elegido={proceso} elegir={(p) => ir({ tab: 'procesos', p })} /> },
        { key: 'requerimientos', label: 'Requerimientos (RF y RNF)', children: <Requerimientos /> },
        { key: 'bitacora', label: 'Códigos de la bitácora', children: <Bitacora /> },
        { key: 'contexto', label: 'Actores y contexto', children: <Contexto /> },
      ]} />
    </>
  );
}
