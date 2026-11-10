/* Textos con fechas y dinero en hora de Colombia (UTC-5), para el historial y las notificaciones. */

const DESFASE = -5 * 3_600_000;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const local = (v: string | number) => new Date((typeof v === 'number' ? v : Date.parse(v)) + DESFASE);

export const pesos = (n: number) => `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export function horaCo(v: string | number) {
  const d = local(v);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export function fechaHoraCo(v: string | number) {
  const d = local(v);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}, ${horaCo(v)}`;
}

export function duracionTexto(min: number) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  return m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
