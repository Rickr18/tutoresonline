import { StyleSheet } from 'react-native';

export const C = {
  marino: '#12233f',
  marino2: '#1d3a66',
  ambar: '#f2a33a',
  verde: '#1c8c7c',
  rojo: '#c2412f',
  tinta: '#18212f',
  tenue: '#5e6b7e',
  linea: '#e3e8ef',
  fondo: '#f4f6f9',
  papel: '#ffffff',
  gris: '#e9edf3',
};

export const TONOS: Record<string, { fondo: string; texto: string }> = {
  espera: { fondo: '#fff3dc', texto: '#8a5a06' },
  bien: { fondo: '#dff3ef', texto: '#0f6557' },
  activo: { fondo: '#dfe9fb', texto: '#1d4c9a' },
  neutro: { fondo: '#e9edf3', texto: '#4a5567' },
  mal: { fondo: '#fbe6e3', texto: '#992c20' },
  info: { fondo: '#eef3fb', texto: '#223f73' },
};

export const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  contenido: { padding: 16, paddingBottom: 40, gap: 14 },
  titulo: { fontSize: 24, fontWeight: '800', color: C.tinta },
  subtitulo: { fontSize: 14, color: C.tenue, marginTop: 2 },
  h2: { fontSize: 17, fontWeight: '700', color: C.tinta },
  texto: { fontSize: 15, color: C.tinta, lineHeight: 21 },
  tenue: { fontSize: 14, color: C.tenue, lineHeight: 20 },
  pequeno: { fontSize: 12.5, color: C.tenue, lineHeight: 18 },
  negrita: { fontWeight: '700', color: C.tinta },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tarjeta: { backgroundColor: C.papel, borderRadius: 14, borderWidth: 1, borderColor: C.linea, padding: 16, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#eef1f6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipTexto: { fontSize: 12.5, color: '#36455c', fontWeight: '500' },
  separador: { height: 1, backgroundColor: C.linea },
  entrada: {
    borderWidth: 1, borderColor: '#cfd6e1', borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: C.tinta, minHeight: 44,
  },
  etiqueta: { fontSize: 14, fontWeight: '600', color: C.tinta, marginBottom: 6 },
});
