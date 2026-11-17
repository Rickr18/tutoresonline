/* Tokens del sistema de diseño (docs/DESIGN_SYSTEM.md). Copia idéntica en mobile/src/tokens.ts: si cambias uno, copia al otro. */

export const color = {
  marino: '#12233f',
  marinoProfundo: '#0c1830',
  marinoSuave: '#1b3358',
  ambar: '#f2a33a',
  ambarTinta: '#2a1c02',
  ambarPapel: '#fff6e6',
  verde: '#1c8c7c',
  rojo: '#c0392b',
  tinta: '#1a2433',
  tenue: '#5f6b7c',
  linea: '#e2e7ee',
  fondo: '#f4f6f9',
  papel: '#ffffff',
  gris: '#e9edf3',
} as const;

export type Tono = 'espera' | 'bien' | 'activo' | 'neutro' | 'mal' | 'info';

/** Fondo y texto de cada tono de estado; iguales en web, PWA y Android. */
export const TONOS: Record<Tono, { fondo: string; texto: string }> = {
  espera: { fondo: '#fff3dc', texto: '#8a5a06' },
  bien: { fondo: '#dff3ef', texto: '#0f6557' },
  activo: { fondo: '#dfe9fb', texto: '#1d4c9a' },
  neutro: { fondo: '#e9edf3', texto: '#4a5567' },
  mal: { fondo: '#fbe6e3', texto: '#992c20' },
  info: { fondo: '#eef3fb', texto: '#223f73' },
};

/** Color del punto de cada grupo de eventos en la línea de tiempo de una sesión. */
export const evento = {
  inicio: '#1d4c9a', bien: '#1c8c7c', dinero: '#c97b10', sala: '#0e7490', soporte: '#6d28d9', alerta: '#c0392b', neutro: '#8a94a6',
} as const;

export const radio = { control: 8, tarjeta: 12, hoja: 18, pildora: 999 } as const;
export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const corte = { telefono: 760, menuPlegado: 1100 } as const;
