/* Cliente de la API. Los tipos reflejan lo que responde el servidor. */

export type Rol = 'ESTUDIANTE' | 'TUTOR' | 'SOPORTE' | 'ADMIN';
export type Modalidad = 'VIRTUAL' | 'PRESENCIAL' | 'AMBAS';
export type EstadoSesion =
  | 'PENDIENTE_ACEPTACION' | 'BUSCANDO_TUTOR' | 'CONFIRMADA' | 'EN_CURSO'
  | 'FINALIZADA' | 'SIN_TUTOR' | 'CANCELADA' | 'NO_REALIZADA';
export type EstadoPago = 'RETENIDO' | 'LIBERADO' | 'REEMBOLSADO' | 'REEMBOLSO_PARCIAL' | 'EN_DISPUTA';
export type Verificacion = 'INCOMPLETO' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
export type EstadoCaso = 'ABIERTA' | 'EN_REVISION' | 'ESCALADA' | 'RESUELTA';
export type Decision = 'REEMBOLSO_TOTAL' | 'REEMBOLSO_PARCIAL' | 'LIBERAR';
export type Canal = 'ESTUDIANTE' | 'TUTOR' | 'INTERNO';
export type Accion = 'aceptar' | 'rechazar' | 'cancelar' | 'iniciar' | 'finalizar' | 'calificar' | 'disputa';

export interface Materia { id: number; nombre: string; area: string }
export interface Bloque { diaSemana: number; horaInicio: number; horaFin: number }
export interface Resena { puntaje: number; comentario: string | null; fecha: string; autor: string }

export interface Tutor {
  id: number; nombre: string; bio: string; tarifaHora: number; modalidad: Modalidad; ciudad: string;
  enLinea: boolean; calificacion: number | null; totalCalificaciones: number; sesionesRealizadas: number;
  materias: Materia[];
  verificacion?: Verificacion; motivoRechazo?: string | null; documento?: string | null; estado?: string;
  disponibilidad?: Bloque[]; resenas?: Resena[]; email?: string;
}

export interface Usuario {
  id: number; nombre: string; email: string; rol: Rol; tutor?: Tutor;
  /** Administrador principal: los demás administradores no pueden modificar su cuenta. */
  superior?: boolean;
  /** Un administrador restableció la contraseña y hay que cambiarla antes de seguir. */
  debeCambiarPassword?: boolean;
}

export interface Pago {
  id: number; monto: number; comision: number; netoTutor: number; reembolso: number;
  metodo: string; referencia: string; estado: EstadoPago; liberarEn: string | null;
}

export interface Sesion {
  id: number; tipo: 'PROGRAMADA' | 'BAJO_DEMANDA'; estado: EstadoSesion;
  inicio: string | null; duracionMin: number; modalidad: 'VIRTUAL' | 'PRESENCIAL'; tema: string;
  precio: number | null; expiraEn: string | null; iniciadaEn: string | null; finalizadaEn: string | null;
  creadoEn: string; enlace: string | null;
  materia: { id: number; nombre: string };
  estudiante: { id: number; nombre: string };
  tutor: { id: number; nombre: string } | null;
  pago: Pago | null;
  miCalificacion: { puntaje: number; comentario: string | null; publicada: boolean } | null;
  calificacionRecibida: { puntaje: number; comentario: string | null } | null;
  disputa: {
    id: number; motivo: string; estado: EstadoCaso; decision: Decision | null; resolucion: string | null;
    creadoEn: string; resueltaEn: string | null; asignado: string | null; sala: string | null; salaCreadaEn: string | null;
  } | null;
  acciones: Accion[];
  reembolsoSiCancela: number | null;
  tutoresAvisados?: number;
}

export interface SolicitudDemanda {
  id: number; materia: { id: number; nombre: string }; estudiante: { id: number; nombre: string };
  tema: string; duracionMin: number; expiraEn: string; ganancia: number;
}

export interface Notificacion { id: number; titulo: string; cuerpo: string; sesionId: number | null; enlace: string | null; leida: boolean; fecha: string }
export interface Notificaciones { sinLeer: number; lista: Notificacion[] }

export interface Ingresos {
  disponible: number; porLiberar: number; enDisputa: number;
  movimientos: {
    id: number; monto: number; comision: number; netoTutor: number; estado: EstadoPago; liberarEn: string | null;
    sesionId: number; fecha: string; materia: string; estudiante: string;
  }[];
}

export interface Resumen {
  estudiantes: number; tutoresAprobados: number; tutoresPendientes: number; tutoresEnLinea: number;
  disputasAbiertas: number; disputasEscaladas: number; disputasSinAsignar: number; solicitudesMateria: number; sesionesTotales: number; sesionesFinalizadas: number;
  volumenPagado: number; comisiones: number; retenido: number;
  calificacionPromedio: number | null; tasaAsignacion: number | null;
  porEstado: { estado: EstadoSesion; total: number }[];
  porMateria: { materia: string; total: number }[];
  porDia: { dia: string; total: number }[];
}

/** Lo que el admin que consulta puede hacer sobre la cuenta (lo decide el servidor según la jerarquía). */
export type AccionUsuario = 'editar' | 'password' | 'suspender' | 'reactivar' | 'rol';
export interface UsuarioAdmin {
  id: number; nombre: string; email: string; rol: Rol; estado: 'ACTIVO' | 'SUSPENDIDO'; creadoEn: string;
  superior: boolean; debeCambiarPassword: boolean; acciones: AccionUsuario[];
}
export interface EntradaAuditoria { id: number; accion: string; texto: string; fecha: string; actor: { id: number; nombre: string; superior: boolean } }
export interface MateriaAdmin extends Materia { activa: boolean; tutores: number; sesiones: number }
/** Pedido de un tutor para agregar una materia al catálogo. */
export interface SolicitudMateria {
  id: number; nombre: string; area: string; motivo: string; estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  respuesta: string | null; creadoEn: string; resueltaEn: string | null; materiaId: number | null;
  tutor?: { id: number; nombre: string; email: string }; resueltaPor?: string;
}
export interface PagoAdmin extends Pago { fecha: string; sesionId: number; estadoSesion: EstadoSesion; estudiante: string; tutor: string | null }
export interface Persona { id: number; nombre: string; rol?: Rol }

export interface Evento {
  id: number; tipo: string; texto: string; fecha: string; interno: boolean;
  actor: { id: number; nombre: string; rol: Rol } | null;
}

export interface Adjunto { id: number; nombre: string; tipo: string; tamano: number }

export interface Mensaje {
  id: number; canal: Canal; texto: string; fecha: string; mio: boolean;
  autor: { id: number; nombre: string; rol: Rol }; adjunto: Adjunto | null;
}

export interface Caso {
  id: number; estado: EstadoCaso; motivo: string; creadoEn: string;
  sesionId: number; materia: string; monto: number | null; estadoPago: EstadoPago | null;
  estudiante: Persona; tutor: Persona; asignado: Persona | null;
  escalada: { por: string; motivo: string; fecha: string } | null;
  sala: string | null; salaCreadaEn: string | null;
  decision: Decision | null; resolucion: string | null; resueltaEn: string | null;
  resueltaPor: { nombre: string; rol: Rol } | null;
  tutorRespondio: boolean; ultimaActividad: string;
}

export interface SesionEquipo extends Omit<Sesion, 'estudiante' | 'tutor'> {
  estudiante: { id: number; nombre: string; email: string | null };
  tutor: { id: number; nombre: string; email: string | null } | null;
  canceladaPor: string | null;
  tiempos: {
    programadoInicio: string | null; programadoFin: string | null; realInicio: string | null; realFin: string | null;
    minutosReales: number | null; retrasoMin: number | null;
  };
  calificaciones: { autor: string; deEstudiante: boolean; puntaje: number; comentario: string; publicada: boolean; fecha: string }[];
  disputaId: number | null; estadoDisputa: EstadoCaso | null;
  eventos: Evento[];
}

export interface CasoDetalle extends Caso {
  sesion: SesionEquipo;
  mensajes: Mensaje[];
  permisos: { tomar: boolean; escalar: boolean; resolver: boolean; escribir: boolean };
}

export type SesionListaEquipo = Sesion & { disputaId: number | null; estadoDisputa: EstadoCaso | null };

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}

const CLAVE = 'tutoresonline.token';

export const tokenGuardado = {
  leer(): string | null { try { return localStorage.getItem(CLAVE); } catch { return null; } },
  guardar(t: string) { try { localStorage.setItem(CLAVE, t); } catch { /* sin almacenamiento */ } },
  borrar() { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } },
};

let alExpirar: (() => void) | null = null;
export function alPerderSesion(fn: () => void) { alExpirar = fn; }

export async function api<T>(ruta: string, cuerpo?: unknown, metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH'): Promise<T> {
  const token = tokenGuardado.leer();
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo ?? (cuerpo === undefined ? 'GET' : 'POST'),
      headers: {
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }
  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && !ruta.startsWith('/auth/')) alExpirar?.();
    throw new ErrorApi(res.status, datos?.error ?? 'Ocurrió un error inesperado.');
  }
  return datos as T;
}

/** Descarga un archivo de la API (un enlace normal no puede enviar el token en la cabecera). */
export async function descargar(ruta: string, nombre: string) {
  const token = tokenGuardado.leer();
  const res = await fetch(`/api${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .catch(() => { throw new ErrorApi(0, 'No hay conexión con el servidor.'); });
  if (!res.ok) {
    const datos = await res.json().catch(() => null);
    throw new ErrorApi(res.status, datos?.error ?? 'No se pudo descargar el archivo.');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function consulta(params: Record<string, string | number | boolean | null | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v !== null && v !== undefined && v !== false) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Dirección para ver o descargar un adjunto (lleva el token porque <img> no envía cabeceras). */
export const urlAdjunto = (id: number) => `/api/adjuntos/${id}?t=${encodeURIComponent(tokenGuardado.leer() ?? '')}`;

export const TIPOS_ADJUNTO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_ADJUNTO = 5 * 1024 * 1024;

/** Sube un archivo como prueba de un caso y devuelve su identificador. */
export async function subirAdjunto(archivo: File): Promise<Adjunto> {
  if (!TIPOS_ADJUNTO.includes(archivo.type)) throw new ErrorApi(400, 'Solo se aceptan imágenes (JPG, PNG, WEBP) y PDF.');
  if (archivo.size > MAX_ADJUNTO) throw new ErrorApi(413, 'El archivo supera los 5 MB.');
  const datos = await new Promise<string>((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => mal(new ErrorApi(0, 'No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
  return api<Adjunto>('/adjuntos', { nombre: archivo.name, tipo: archivo.type, datos });
}
