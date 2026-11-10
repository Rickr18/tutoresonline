import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Flex, Space, Typography } from 'antd';
import { SearchOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { Sesion } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera, FilaSesion, casoAbierto, useSesiones } from '../../comunes';
import { Alerta, Cargando, Kpi, Kpis, Vacio, mensajeDe } from '../../ui';
import { dinero, ESTADO_CASO, haceCuanto } from '../../formato';

function Seccion({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="seccion">
      <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>{titulo}</Typography.Title>
        {extra}
      </Flex>
      {children}
    </section>
  );
}

const porFecha = (a: Sesion, b: Sesion) => Date.parse(a.inicio ?? a.creadoEn) - Date.parse(b.inicio ?? b.creadoEn);

export default function InicioEstudiante() {
  const { usuario } = useSesion();
  const ir = useNavigate();
  const sesiones = useSesiones();
  const lista = sesiones.data ?? [];

  const casos = lista.filter(casoAbierto);
  const porCalificar = lista.filter((s) => s.acciones.includes('calificar'));
  const proximas = lista.filter((s) => s.estado === 'CONFIRMADA' || s.estado === 'EN_CURSO').sort(porFecha);
  const esperando = lista.filter((s) => s.estado === 'PENDIENTE_ACEPTACION' || s.estado === 'BUSCANDO_TUTOR').sort(porFecha);
  const invertido = lista.reduce((n, s) => n + (s.pago ? s.pago.monto - s.pago.reembolso : 0), 0);
  const nada = sesiones.data && !casos.length && !porCalificar.length && !proximas.length && !esperando.length;

  return (
    <>
      <Cabecera titulo={`Hola, ${usuario?.nombre.split(' ')[0] ?? ''}`} detalle="Tus sesiones, lo que tienes pendiente y tus casos de soporte en un solo lugar.">
        <Button icon={<SearchOutlined />} onClick={() => ir('/buscar')}>Buscar tutor</Button>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => ir('/ahora')}>Necesito un tutor ahora</Button>
      </Cabecera>

      {sesiones.isPending && <Cargando />}
      {sesiones.isError && <Alerta>{mensajeDe(sesiones.error)}</Alerta>}

      {casos.length > 0 && (
        <Space orientation="vertical" style={{ width: '100%', marginBottom: 16 }}>
          {casos.map((s) => {
            const d = s.disputa!;
            return (
              <Alerta key={s.id} tono={d.estado === 'ESCALADA' ? 'mal' : 'espera'}>
                <b>Caso de soporte #{d.id} · {s.materia.nombre} con {s.tutor?.nombre} · {d.estado === 'ESCALADA' ? 'en revisión por administración' : ESTADO_CASO[d.estado].texto.toLowerCase()}</b>
                Lo abriste {haceCuanto(d.creadoEn)}. {d.asignado ? `Lo revisa ${d.asignado}, de soporte.` : 'Pronto alguien de soporte lo tomará.'}{' '}
                El pago está congelado hasta que se resuelva. Tu conversación con soporte es privada: el tutor presenta su versión por separado.{' '}
                <Link to={`/sesiones/${s.id}`}>Ver el caso y escribir a soporte</Link>
              </Alerta>
            );
          })}
        </Space>
      )}

      {sesiones.data && (
        <Kpis>
          <Kpi fuerte etiqueta="Próximas sesiones" valor={proximas.length} nota="confirmadas o en curso" />
          <Kpi etiqueta="Esperando tutor" valor={esperando.length} nota="reservas y solicitudes sin respuesta" />
          <Kpi etiqueta="Por calificar" valor={porCalificar.length} nota="sesiones terminadas" />
          <Kpi etiqueta="Casos abiertos" valor={casos.length} nota="con soporte" />
          <Kpi etiqueta="Total invertido" valor={dinero(invertido)} nota="descontando devoluciones" />
        </Kpis>
      )}

      {nada && (
        <div className="seccion">
          <Vacio titulo="No tienes nada pendiente">Busca un tutor por materia o pide ayuda ahora mismo.</Vacio>
        </div>
      )}

      {porCalificar.length > 0 && (
        <Seccion titulo="Califica tus sesiones">
          <Typography.Paragraph type="secondary">Las dos calificaciones se publican juntas, cuando ambos califiquen o pasados 7 días.</Typography.Paragraph>
          <div className="lista">{porCalificar.map((s) => <FilaSesion key={s.id} s={s} />)}</div>
        </Seccion>
      )}

      {proximas.length > 0 && (
        <Seccion titulo="Próximas sesiones" extra={<Link to="/sesiones">Ver todas</Link>}>
          <div className="lista">{proximas.map((s) => <FilaSesion key={s.id} s={s} />)}</div>
        </Seccion>
      )}

      {esperando.length > 0 && (
        <Seccion titulo="Esperando respuesta del tutor">
          <div className="lista">{esperando.map((s) => <FilaSesion key={s.id} s={s} />)}</div>
        </Seccion>
      )}
    </>
  );
}
