import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, e, TONOS } from './tema';
import { iniciales } from './formato';

type Variante = 'primario' | 'oscuro' | 'fantasma' | 'peligro';
const VARIANTES: Record<Variante, { fondo: string; texto: string; borde: string }> = {
  primario: { fondo: C.ambar, texto: '#2a1c02', borde: C.ambar },
  oscuro: { fondo: C.marino, texto: '#fff', borde: C.marino },
  fantasma: { fondo: '#fff', texto: C.marino, borde: '#cfd6e1' },
  peligro: { fondo: C.rojo, texto: '#fff', borde: C.rojo },
};

export function Boton({ texto, alPresionar, variante = 'primario', deshabilitado, cargando, chico, estilo }: {
  texto: string; alPresionar: () => void; variante?: Variante; deshabilitado?: boolean; cargando?: boolean; chico?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTES[variante];
  const inactivo = deshabilitado || cargando;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={texto} onPress={alPresionar} disabled={inactivo}
      style={({ pressed }) => [{
        backgroundColor: v.fondo, borderColor: v.borde, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
        paddingVertical: chico ? 7 : 12, paddingHorizontal: chico ? 12 : 18, opacity: inactivo ? 0.55 : pressed ? 0.85 : 1,
        flexDirection: 'row', gap: 8,
      }, estilo]}>
      {cargando && <ActivityIndicator size="small" color={v.texto} />}
      <Text style={{ color: v.texto, fontWeight: '700', fontSize: chico ? 13.5 : 15.5 }}>{texto}</Text>
    </Pressable>
  );
}

export function Insignia({ tono, texto }: { tono: string; texto: string }) {
  const t = TONOS[tono] ?? TONOS.neutro;
  return (
    <View style={{ backgroundColor: t.fondo, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: t.texto, fontWeight: '700', fontSize: 12 }}>{texto}</Text>
    </View>
  );
}

export function Avatar({ nombre, enLinea, grande }: { nombre: string; enLinea?: boolean; grande?: boolean }) {
  const lado = grande ? 64 : 40;
  return (
    <View style={{ width: lado, height: lado, borderRadius: lado / 2, backgroundColor: '#dfe6f1', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.marino, fontWeight: '800', fontSize: grande ? 22 : 14 }}>{iniciales(nombre)}</Text>
      {enLinea && (
        <View style={{ position: 'absolute', right: 0, bottom: 0, width: grande ? 15 : 11, height: grande ? 15 : 11, borderRadius: 8, backgroundColor: '#2fbf71', borderWidth: 2, borderColor: '#fff' }} />
      )}
    </View>
  );
}

export function Estrellas({ valor, total }: { valor: number | null; total?: number }) {
  if (valor === null) return <Text style={e.pequeno}>Sin calificaciones</Text>;
  return (
    <Text style={{ fontSize: 14, color: C.tinta }}>
      <Text style={{ color: C.ambar }}>★ </Text>
      <Text style={{ fontWeight: '700' }}>{valor.toFixed(1)}</Text>
      {total !== undefined && <Text style={{ color: C.tenue }}> ({total})</Text>}
    </Text>
  );
}

export function SelectorEstrellas({ valor, cambiar }: { valor: number; cambiar: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => cambiar(n)} accessibilityRole="radio" accessibilityLabel={`${n} de 5`} accessibilityState={{ checked: valor === n }} hitSlop={6}>
          <Text style={{ fontSize: 36, color: n <= valor ? C.ambar : '#d2d9e3' }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={C.marino} />
      <Text style={e.tenue}>{texto}</Text>
    </View>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <View style={{ padding: 26, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#cfd6e1', borderRadius: 14, backgroundColor: '#fafbfc', gap: 6 }}>
      <Text style={[e.h2, { textAlign: 'center' }]}>{titulo}</Text>
      {children ? <Text style={[e.tenue, { textAlign: 'center' }]}>{children}</Text> : null}
    </View>
  );
}

export function Alerta({ tono = 'mal', titulo, children }: { tono?: 'mal' | 'info' | 'bien' | 'espera'; titulo?: string; children?: ReactNode }) {
  const t = TONOS[tono];
  return (
    <View style={{ backgroundColor: t.fondo, borderRadius: 10, padding: 12, gap: 2 }} accessibilityRole={tono === 'mal' ? 'alert' : undefined}>
      {titulo && <Text style={{ color: t.texto, fontWeight: '700', fontSize: 14 }}>{titulo}</Text>}
      {children ? <Text style={{ color: t.texto, fontSize: 14, lineHeight: 20 }}>{children}</Text> : null}
    </View>
  );
}

export function Campo({ etiqueta, ayuda, ...props }: TextInputProps & { etiqueta: string; ayuda?: string }) {
  return (
    <View>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor="#9aa5b5" accessibilityLabel={etiqueta} {...props}
        style={[e.entrada, props.multiline ? { minHeight: 84, textAlignVertical: 'top' } : null]} />
      {ayuda ? <Text style={[e.pequeno, { marginTop: 4 }]}>{ayuda}</Text> : null}
    </View>
  );
}

export function Segmentos<T extends string | number>({ opciones, valor, cambiar, etiqueta }: {
  opciones: { valor: T; texto: string }[]; valor: T; cambiar: (v: T) => void; etiqueta?: string;
}) {
  return (
    <View>
      {etiqueta && <Text style={e.etiqueta}>{etiqueta}</Text>}
      <View style={{ flexDirection: 'row', backgroundColor: C.gris, borderRadius: 11, padding: 3, gap: 3 }} accessibilityRole="radiogroup">
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <Pressable key={String(o.valor)} onPress={() => cambiar(o.valor)} accessibilityRole="radio" accessibilityState={{ checked: activo }}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: activo ? '#fff' : 'transparent' }}>
              <Text style={{ fontWeight: '600', fontSize: 14, color: activo ? C.marino : C.tenue }}>{o.texto}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Lista de opciones con desplazamiento horizontal (sustituye al select de la web). */
export function Opciones<T extends string | number>({ opciones, valor, cambiar, etiqueta }: {
  opciones: { valor: T; texto: string }[]; valor: T; cambiar: (v: T) => void; etiqueta?: string;
}) {
  return (
    <View>
      {etiqueta && <Text style={e.etiqueta}>{etiqueta}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <Pressable key={String(o.valor)} onPress={() => cambiar(o.valor)} accessibilityRole="button" accessibilityState={{ selected: activo }}
              style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: activo ? C.marino : '#cfd6e1', backgroundColor: activo ? C.marino : '#fff' }}>
              <Text style={{ color: activo ? '#fff' : C.tinta, fontWeight: '600', fontSize: 13.5 }}>{o.texto}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function useCuentaAtras(hasta: string | null) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    if (!hasta) return;
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, [hasta]);
  return hasta ? Math.max(0, Math.ceil((Date.parse(hasta) - ahora) / 1000)) : 0;
}

export function Reloj({ hasta, grande }: { hasta: string; grande?: boolean }) {
  const seg = useCuentaAtras(hasta);
  const lado = grande ? 120 : 54;
  const color = seg <= 10 ? C.rojo : C.verde;
  return (
    <View accessibilityRole="timer" accessibilityLabel={`${seg} segundos`}
      style={{ width: lado, height: lado, borderRadius: lado / 2, borderWidth: grande ? 8 : 5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: grande ? 40 : 18, fontWeight: '800', color: C.tinta, fontVariant: ['tabular-nums'] }}>{seg}</Text>
    </View>
  );
}

export interface DatosPago { metodo: 'TARJETA' | 'PSE' | 'NEQUI'; numero: string }

export function FormularioPago({ valor, cambiar }: { valor: DatosPago; cambiar: (p: DatosPago) => void }) {
  return (
    <View style={[e.tarjeta, { padding: 12 }]}>
      <Segmentos etiqueta="Medio de pago" valor={valor.metodo} cambiar={(metodo) => cambiar({ ...valor, metodo })}
        opciones={[{ valor: 'TARJETA', texto: 'Tarjeta' }, { valor: 'PSE', texto: 'PSE' }, { valor: 'NEQUI', texto: 'Nequi' }]} />
      {valor.metodo === 'TARJETA' ? (
        <Campo etiqueta="Número de la tarjeta" keyboardType="number-pad" placeholder="4242 4242 4242 4242" value={valor.numero}
          onChangeText={(t) => cambiar({ ...valor, numero: t.replace(/[^\d ]/g, '').slice(0, 23) })}
          ayuda="Pago simulado. Usa cualquier número de 16 dígitos; los terminados en 0000 son rechazados." />
      ) : (
        <Text style={e.pequeno}>Pago simulado: en producción se abriría la pasarela de {valor.metodo === 'PSE' ? 'PSE' : 'Nequi'}.</Text>
      )}
    </View>
  );
}

export function DatosLista({ filas }: { filas: { dt: string; dd: ReactNode; total?: boolean }[] }) {
  return (
    <View style={{ gap: 8 }}>
      {filas.map((f) => (
        <View key={f.dt} style={[e.entre, { alignItems: 'flex-start' }, f.total && { borderTopWidth: 1, borderTopColor: C.linea, paddingTop: 8 }]}>
          <Text style={[e.tenue, { flexShrink: 1 }]}>{f.dt}</Text>
          {typeof f.dd === 'string' || typeof f.dd === 'number'
            ? <Text style={[e.negrita, { textAlign: 'right', flexShrink: 1, fontSize: f.total ? 16.5 : 14.5 }]}>{f.dd}</Text>
            : f.dd}
        </View>
      ))}
    </View>
  );
}

/** Hoja inferior para formularios (reserva, calificación, cancelación). */
export function Hoja({ titulo, cerrar, children }: { titulo: string; cerrar: () => void; children: ReactNode }) {
  const margen = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={cerrar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(12,24,48,.5)' }} onPress={cerrar} accessibilityLabel="Cerrar" />
        <View style={{ backgroundColor: C.papel, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '88%' }}>
          <View style={[e.entre, { padding: 16, borderBottomWidth: 1, borderBottomColor: C.linea }]}>
            <Text style={e.h2}>{titulo}</Text>
            <Pressable onPress={cerrar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar"><Text style={{ fontSize: 26, color: C.tenue, lineHeight: 28 }}>×</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 16 + margen.bottom }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function mensajeDe(err: unknown) {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}
