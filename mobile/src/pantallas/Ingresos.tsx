import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, type Ingresos as TIngresos } from '../api';
import { Pantalla } from '../comunes';
import { useNav } from '../nav';
import { Alerta, Cargando, Insignia, Vacio, mensajeDe } from '../ui';
import { C, e } from '../tema';
import { dinero, ESTADO_PAGO, fecha } from '../formato';

function Kpi({ etiqueta, valor, detalle, fuerte }: { etiqueta: string; valor: string; detalle: string; fuerte?: boolean }) {
  return (
    <View style={[e.tarjeta, { flex: 1, minWidth: 140, gap: 2 }, fuerte && { backgroundColor: C.marino, borderColor: C.marino }]}>
      <Text style={[e.pequeno, fuerte && { color: '#b9c5d9' }]}>{etiqueta}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: fuerte ? '#fff' : C.tinta }}>{valor}</Text>
      <Text style={[e.pequeno, fuerte && { color: '#b9c5d9' }]}>{detalle}</Text>
    </View>
  );
}

export default function Ingresos() {
  const nav = useNav();
  const ingresos = useQuery({ queryKey: ['ingresos'], queryFn: () => api<TIngresos>('/tutor/ingresos') });
  const d = ingresos.data;
  return (
    <Pantalla titulo="Ingresos" detalle="Cada pago se retiene 48 horas tras la sesión y luego se libera, menos la comisión del 15 %."
      refrescando={ingresos.isRefetching} alRefrescar={() => ingresos.refetch()}>
      {ingresos.isPending && <Cargando />}
      {ingresos.isError && <Alerta>{mensajeDe(ingresos.error)}</Alerta>}
      {d && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Kpi etiqueta="Disponible" valor={dinero(d.disponible)} detalle="pagos liberados" fuerte />
            <Kpi etiqueta="Por liberar" valor={dinero(d.porLiberar)} detalle="retenidos" />
            <Kpi etiqueta="En disputa" valor={dinero(d.enDisputa)} detalle="congelados" />
          </View>
          <Text style={e.h2}>Movimientos</Text>
          {d.movimientos.length === 0 ? <Vacio titulo="Todavía no tienes movimientos" /> : (
            <View style={[e.tarjeta, { padding: 0, gap: 0 }]}>
              {d.movimientos.map((m, i) => {
                const est = ESTADO_PAGO[m.estado];
                return (
                  <Pressable key={m.id} onPress={() => nav.ir({ nombre: 'sesion', id: m.sesionId })} accessibilityRole="button"
                    style={[{ padding: 13, gap: 4 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.linea }]}>
                    <View style={e.entre}>
                      <Text style={[e.negrita, { flexShrink: 1 }]}>{m.materia}</Text>
                      <Text style={e.negrita}>{dinero(m.netoTutor)}</Text>
                    </View>
                    <View style={e.entre}>
                      <Text style={e.pequeno}>{fecha(m.fecha)} · {m.estudiante} · bruto {dinero(m.monto)}</Text>
                      <Insignia tono={est.tono} texto={est.texto} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </Pantalla>
  );
}
