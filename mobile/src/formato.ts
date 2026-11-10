// Copia de web/src/formato.ts: mismas reglas de fecha (hora de Colombia) y dinero en la web y en el móvil.
/* Fechas y dinero. La plataforma trabaja con la hora de Colombia (UTC-5, sin horario de verano). */

import type { Decision, EstadoCaso, EstadoPago, EstadoSesion, Modalidad, Verificacion } from './tipos';

const DESFASE = -5 * 3600_000;
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const local = (iso: string | number) => new Date((typeof iso === 'number' ? iso : Date.parse(iso)) + DESFASE);

export function hora(iso: string) {
  const d = local(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export function horaDelDia(h: number) {
  return `${h % 12 || 12}:00 ${h % 24 < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Clave AAAA-MM-DD del día en Colombia. */
export function claveDia(iso: string | number) {
  return local(iso).toISOString().slice(0, 10);
}

export function fecha(iso: string) {
  const d = local(iso);
  const hoy = claveDia(Date.now());
  const manana = claveDia(Date.now() + 24 * 3600_000);
  const clave = claveDia(iso);
  if (clave === hoy) return 'Hoy';
  if (clave === manana) return 'Mañana';
  return `${DIAS_CORTOS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

export function fechaLarga(iso: string) {
  const d = local(iso);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export function fechaHora(iso: string) {
  return `${fecha(iso)}, ${hora(iso)}`;
}

/** Hora con segundos, para el historial de una sesión. */
export function horaExacta(iso: string) {
  const d = local(iso);
  const h = d.getUTCHours();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${h % 12 || 12}:${dos(d.getUTCMinutes())}:${dos(d.getUTCSeconds())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export function tamanoArchivo(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function haceCuanto(iso: string) {
  const seg = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seg < 60) return 'hace un momento';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  const dias = Math.floor(seg / 86400);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}

export function dinero(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function duracion(min: number) {
  if (min < 60) return `${min} min`;
  return min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function iniciales(nombre: string) {
  return nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export const ESTADO_SESION: Record<EstadoSesion, { texto: string; tono: 'espera' | 'bien' | 'activo' | 'neutro' | 'mal' }> = {
  PENDIENTE_ACEPTACION: { texto: 'Esperando al tutor', tono: 'espera' },
  BUSCANDO_TUTOR: { texto: 'Buscando tutor', tono: 'espera' },
  CONFIRMADA: { texto: 'Confirmada', tono: 'bien' },
  EN_CURSO: { texto: 'En curso', tono: 'activo' },
  FINALIZADA: { texto: 'Finalizada', tono: 'neutro' },
  SIN_TUTOR: { texto: 'Sin tutor', tono: 'mal' },
  CANCELADA: { texto: 'Cancelada', tono: 'mal' },
  NO_REALIZADA: { texto: 'No realizada', tono: 'mal' },
};

export const ESTADO_PAGO: Record<EstadoPago, { texto: string; tono: 'espera' | 'bien' | 'activo' | 'neutro' | 'mal' }> = {
  RETENIDO: { texto: 'Retenido', tono: 'espera' },
  LIBERADO: { texto: 'Liberado', tono: 'bien' },
  REEMBOLSADO: { texto: 'Reembolsado', tono: 'neutro' },
  REEMBOLSO_PARCIAL: { texto: 'Reembolso parcial', tono: 'neutro' },
  EN_DISPUTA: { texto: 'En disputa', tono: 'mal' },
};

export const VERIFICACION: Record<Verificacion, { texto: string; tono: 'espera' | 'bien' | 'neutro' | 'mal' }> = {
  INCOMPLETO: { texto: 'Perfil incompleto', tono: 'neutro' },
  PENDIENTE: { texto: 'En revisión', tono: 'espera' },
  APROBADO: { texto: 'Verificado', tono: 'bien' },
  RECHAZADO: { texto: 'Rechazado', tono: 'mal' },
};

export const MODALIDAD: Record<Modalidad, string> = {
  VIRTUAL: 'Virtual', PRESENCIAL: 'Presencial', AMBAS: 'Virtual y presencial',
};

export const METODO: Record<string, string> = { TARJETA: 'Tarjeta', PSE: 'PSE', NEQUI: 'Nequi' };

export const ESTADO_CASO: Record<EstadoCaso, { texto: string; tono: 'espera' | 'bien' | 'activo' | 'neutro' | 'mal' }> = {
  ABIERTA: { texto: 'Sin asignar', tono: 'espera' },
  EN_REVISION: { texto: 'En revisión', tono: 'activo' },
  ESCALADA: { texto: 'Escalado a administración', tono: 'mal' },
  RESUELTA: { texto: 'Resuelto', tono: 'neutro' },
};

export const DECISION: Record<Decision, { texto: string; corto: string }> = {
  REEMBOLSO_TOTAL: { texto: 'Reembolso total al estudiante', corto: 'Reembolso total' },
  REEMBOLSO_PARCIAL: { texto: 'Reembolso del 50 % al estudiante y 50 % para el tutor', corto: 'Reembolso del 50 %' },
  LIBERAR: { texto: 'Pago completo al tutor', corto: 'Pago al tutor' },
};

export const ROL_TEXTO: Record<string, string> = { ESTUDIANTE: 'Estudiante', TUTOR: 'Tutor', SOPORTE: 'Soporte', ADMIN: 'Administrador' };
