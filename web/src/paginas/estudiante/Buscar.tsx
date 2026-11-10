import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Card, Checkbox, Col, Flex, Input, Row, Select, Tag, Typography } from 'antd';
import { api, consulta, type Tutor } from '../../api';
import { Cabecera, useMaterias } from '../../comunes';
import { Alerta, Avatar, Campo, Cargando, Estrellas, Vacio, mensajeDe } from '../../ui';
import { dinero, MODALIDAD } from '../../formato';

const INICIAL = { q: '', materia: '', modalidad: '', precioMax: '', orden: '', enLinea: false, calificacionMin: '' };

export function TarjetaTutor({ t }: { t: Tutor }) {
  return (
    <Link to={`/tutores/${t.id}`} className="tutor-tarjeta" style={{ display: 'block', height: '100%' }}>
      <Card hoverable style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12, height: '100%' } }}>
        <Flex gap={12} align="center">
          <Avatar nombre={t.nombre} enLinea={t.enLinea} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong style={{ display: 'block' }}>{t.nombre}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>{t.ciudad} · {MODALIDAD[t.modalidad]}</Typography.Text>
          </div>
          <Estrellas valor={t.calificacion} total={t.totalCalificaciones} />
        </Flex>
        <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ margin: 0 }}>{t.bio}</Typography.Paragraph>
        <Flex gap={6} wrap>{t.materias.map((m) => <Tag key={m.id} style={{ marginInlineEnd: 0 }}>{m.nombre}</Tag>)}</Flex>
        <Flex justify="space-between" align="center" style={{ marginTop: 'auto' }}>
          <span><b>{dinero(t.tarifaHora)}</b> <Typography.Text type="secondary">por hora</Typography.Text></span>
          {t.enLinea
            ? <Typography.Text style={{ color: '#1c8c7c', fontWeight: 600 }}>● En línea</Typography.Text>
            : <Typography.Text type="secondary" style={{ fontSize: 13 }}>{t.sesionesRealizadas} sesiones</Typography.Text>}
        </Flex>
      </Card>
    </Link>
  );
}

export default function Buscar() {
  const ir = useNavigate();
  const [f, setF] = useState(INICIAL);
  const materias = useMaterias();
  const tutores = useQuery({
    queryKey: ['tutores', f],
    queryFn: () => api<Tutor[]>(`/tutores${consulta(f)}`),
    placeholderData: keepPreviousData,
  });
  const poner = (campo: keyof typeof INICIAL, valor: string | boolean) => setF((a) => ({ ...a, [campo]: valor }));
  const conFiltros = JSON.stringify(f) !== JSON.stringify(INICIAL);

  return (
    <>
      <Cabecera titulo="Buscar tutor" detalle="Todos los tutores publicados pasaron por la verificación de la plataforma.">
        <Button type="primary" onClick={() => ir('/ahora')}>Necesito un tutor ahora</Button>
      </Cabecera>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={8}>
            <Campo etiqueta="Buscar" id="filtro-q">
              <Input.Search id="filtro-q" allowClear placeholder="Nombre, materia o tema" value={f.q} onChange={(e) => poner('q', e.target.value)} />
            </Campo>
          </Col>
          <Col xs={12} lg={4}>
            <Campo etiqueta="Materia" id="filtro-materia">
              <Select id="filtro-materia" value={f.materia} onChange={(v) => poner('materia', v)} style={{ width: '100%' }} showSearch={{ optionFilterProp: 'label' }}
                options={[{ value: '', label: 'Todas' }, ...(materias.data ?? []).map((m) => ({ value: String(m.id), label: m.nombre }))]} />
            </Campo>
          </Col>
          <Col xs={12} lg={4}>
            <Campo etiqueta="Modalidad" id="filtro-modalidad">
              <Select id="filtro-modalidad" value={f.modalidad} onChange={(v) => poner('modalidad', v)} style={{ width: '100%' }}
                options={[{ value: '', label: 'Cualquiera' }, { value: 'VIRTUAL', label: 'Virtual' }, { value: 'PRESENCIAL', label: 'Presencial' }]} />
            </Campo>
          </Col>
          <Col xs={12} lg={4}>
            <Campo etiqueta="Precio máximo" id="filtro-precio">
              <Select id="filtro-precio" value={f.precioMax} onChange={(v) => poner('precioMax', v)} style={{ width: '100%' }}
                options={[{ value: '', label: 'Sin límite' }, ...[25000, 30000, 35000, 40000].map((p) => ({ value: String(p), label: `${dinero(p)} por hora` }))]} />
            </Campo>
          </Col>
          <Col xs={12} lg={4}>
            <Campo etiqueta="Ordenar por" id="filtro-orden">
              <Select id="filtro-orden" value={f.orden} onChange={(v) => poner('orden', v)} style={{ width: '100%' }}
                options={[{ value: '', label: 'Mejor calificados' }, { value: 'precio', label: 'Menor precio' }]} />
            </Campo>
          </Col>
        </Row>
        <Flex gap={16} align="center" wrap style={{ marginTop: 12 }}>
          <Checkbox checked={f.enLinea} onChange={(e) => poner('enLinea', e.target.checked)}>Solo en línea ahora</Checkbox>
          <Checkbox checked={f.calificacionMin === '4.5'} onChange={(e) => poner('calificacionMin', e.target.checked ? '4.5' : '')}>Calificación de 4,5 o más</Checkbox>
          {conFiltros && <Button type="link" onClick={() => setF(INICIAL)} style={{ padding: 0 }}>Quitar filtros</Button>}
          {tutores.data && <Typography.Text style={{ marginLeft: 'auto' }}>{tutores.data.length} {tutores.data.length === 1 ? 'tutor' : 'tutores'}</Typography.Text>}
        </Flex>
      </Card>

      {tutores.isPending && <Cargando />}
      {tutores.isError && <Alerta>{mensajeDe(tutores.error)}</Alerta>}
      {tutores.data?.length === 0 && (
        <Vacio titulo="Ningún tutor coincide con la búsqueda">Prueba con otra materia o quita algún filtro.</Vacio>
      )}
      <Row gutter={[16, 16]}>
        {tutores.data?.map((t) => <Col key={t.id} xs={24} md={12} xl={8}><TarjetaTutor t={t} /></Col>)}
      </Row>
    </>
  );
}
