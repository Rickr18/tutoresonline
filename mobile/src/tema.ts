import { StyleSheet } from 'react-native';
import { color, radio, TONOS as TONOS_BASE } from './tokens';

export { evento } from './tokens';

export const C = {
  marino: color.marino,
  marino2: color.marinoSuave,
  ambar: color.ambar,
  ambarTinta: color.ambarTinta,
  ambarPapel: color.ambarPapel,
  verde: color.verde,
  rojo: color.rojo,
  tinta: color.tinta,
  tenue: color.tenue,
  linea: color.linea,
  fondo: color.fondo,
  papel: color.papel,
  gris: color.gris,
};

export const TONOS: Record<string, { fondo: string; texto: string }> = TONOS_BASE;

export const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  contenido: { padding: 16, paddingBottom: 40, gap: 14 },
  titulo: { fontSize: 24, fontWeight: '800', color: C.tinta, letterSpacing: -0.2 },
  subtitulo: { fontSize: 14, color: C.tenue, marginTop: 2 },
  h2: { fontSize: 17, fontWeight: '700', color: C.tinta },
  texto: { fontSize: 15, color: C.tinta, lineHeight: 21 },
  tenue: { fontSize: 14, color: C.tenue, lineHeight: 20 },
  pequeno: { fontSize: 12.5, color: C.tenue, lineHeight: 18 },
  negrita: { fontWeight: '700', color: C.tinta },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tarjeta: { backgroundColor: C.papel, borderRadius: radio.tarjeta, borderWidth: 1, borderColor: C.linea, padding: 16, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#eef1f6', borderRadius: radio.pildora, paddingHorizontal: 10, paddingVertical: 4 },
  chipTexto: { fontSize: 12.5, color: '#36455c', fontWeight: '500' },
  separador: { height: 1, backgroundColor: C.linea },
  entrada: {
    borderWidth: 1, borderColor: '#cfd6e1', borderRadius: radio.control + 2, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: C.tinta, minHeight: 44,
  },
  etiqueta: { fontSize: 14, fontWeight: '600', color: C.tinta, marginBottom: 6 },
  /** Rótulo en mayúsculas para grupos e indicadores. */
  rotulo: { fontSize: 11.5, fontWeight: '700', color: C.tenue, letterSpacing: 0.7, textTransform: 'uppercase' },
});
