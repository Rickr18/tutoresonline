// Tipos compartidos con la web (copia de web/src/api.ts).
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
export type Accion = 'aceptar' | 'rechazar' | 'cancelar' | 'iniciar' | 'finalizar' | 'calificar' | 'disputa'
  | 'reprogramar' | 'responder-reprogramacion' | 'retirar-reprogramacion' | 'inasistencia' | 'reportar';
/** Estado de moderación de un comentario (RF-M08-07, RF-M11-05). */
export type Moderacion = 'VISIBLE' | 'RETENIDA' | 'REPORTADA' | 'OCULTA' | 'ELIMINADA';

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
  /** Versión de los términos y la política de datos que aceptó al registrarse, y cuándo. */
  terminosVersion?: string; terminosAceptadosEn?: string;
}

export interface Pago {
  id: number; monto: number; comision: number; netoTutor: number; reembolso: number;
  metodo: string; referencia: string; estado: EstadoPago; liberarEn: string | null;
}

export interface Sesion {
  id: number; tipo: 'PROGRAMADA' | 'BAJO_DEMANDA'; estado: EstadoSesion;
  inicio: string | null; duracionMin: number; modalidad: 'VIRTUAL' | 'PRESENCIAL'; tema: string;
  precio: number | null; expiraEn: string | null; iniciadaEn: string | null; finalizadaEn: string | null;
  creadoEn: string; enlace: string | null; cerradaEn: string | null; ausente: 'ESTUDIANTE' | 'TUTOR' | null;
  materia: { id: number; nombre: string };
  estudiante: { id: number; nombre: string };
  tutor: { id: number; nombre: string } | null;
  pago: Pago | null;
  /** Fin del turno del tutor que consulta, si la solicitud inmediata está en su turno. */
  turnoExpiraEn: string | null;
  /** Bajo demanda por turnos: candidato al que se le ofrece ahora, de cuántos, y fin del turno. */
  busqueda: { candidato: number; total: number; turnoExpiraEn: string | null } | null;
  reprogramacion: { inicio: string; fecha: string; mia: boolean; propuestaPor: { id: number; nombre: string } } | null;
  miCalificacion: { puntaje: number; comentario: string | null; publicada: boolean; moderacion: Moderacion } | null;
  calificacionRecibida: { puntaje: number; comentario: string | null; moderacion: Moderacion } | null;
  disputa: {
    id: number; motivo: string; estado: EstadoCaso; decision: Decision | null; resolucion: string | null;
    creadoEn: string; resueltaEn: string | null; asignado: string | null; sala: string | null; salaCreadaEn: string | null;
    autor: { id: number; nombre: string; rol: Rol }; mia: boolean;
  } | null;
  /** Tutores sugeridos cuando la reserva no prosperó (rechazo, vencimiento, sin tutor o inasistencia del tutor). */
  sugerencias: { id: number; nombre: string; tarifaHora: number; calificacion: number | null; enLinea: boolean }[];
  acciones: Accion[];
  reembolsoSiCancela: number | null;
  comentarioRetenido?: string | null;
}

/** Desglose del costo antes de reservar (RF-M05-03). */
export interface Cotizacion {
  tarifaHora: number; duracionMin: number; subtotal: number; comisionPct: number; comision: number; netoTutor: number;
  impuestos: number; impuestosNota: string; total: number;
}

/** Valores vigentes de los parámetros del negocio (RF-M11-07). */
export type Parametros = Record<string, number>;
export interface ParametroAdmin {
  clave: string; nombre: string; unidad: string; regla: string; descripcion: string; min: number; max: number; decimales?: boolean;
  valor: number; valorInicial: number;
  proximo: VersionParametro | null; historial: VersionParametro[];
}
export interface VersionParametro { id: number; clave: string; valor: number; vigenteDesde: string; motivo: string; creadoEn: string; autor: string | null }

export interface ComentarioModeracion {
  id: number; sesionId: number; materia: string; puntaje: number; comentario: string; publicada: boolean;
  moderacion: Moderacion; motivo: string | null; creadoEn: string;
  autor: Persona; destinatario: Persona; reportadaPor: string | null; reportadaEn: string | null;
  moderadaPor: { nombre: string; rol: Rol } | null; moderadaEn: string | null;
}
export interface Moderaciones {
  pendientes: ComentarioModeracion[]; revisados: ComentarioModeracion[]; umbral: number; minimo: number;
  alertas: { id: number; nombre: string; alertaEn: string | null; promedio: number; valoraciones: number }[];
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
  disputasAbiertas: number; disputasEscaladas: number; disputasSinAsignar: number; solicitudesMateria: number;
  comentariosPorModerar: number; alertasReputacion: number; sesionesTotales: number; sesionesFinalizadas: number;
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
  /** Quién abrió el caso: el estudiante o el tutor (RF-M11-03). */
  autor: Persona;
  escalada: { por: string; motivo: string; fecha: string } | null;
  sala: string | null; salaCreadaEn: string | null;
  decision: Decision | null; resolucion: string | null; resueltaEn: string | null;
  resueltaPor: { nombre: string; rol: Rol } | null;
  /** La parte que no abrió el caso ya presentó su versión. */
  contraparteRespondio: boolean; ultimaActividad: string;
}

export interface SesionEquipo extends Omit<Sesion, 'estudiante' | 'tutor'> {
  estudiante: { id: number; nombre: string; email: string | null };
  tutor: { id: number; nombre: string; email: string | null } | null;
  canceladaPor: string | null;
  tiempos: {
    programadoInicio: string | null; programadoFin: string | null; realInicio: string | null; realFin: string | null;
    minutosReales: number | null; retrasoMin: number | null;
  };
  calificaciones: {
    id: number; autor: string; deEstudiante: boolean; puntaje: number; comentario: string; publicada: boolean; fecha: string;
    moderacion: Moderacion; motivoModeracion: string | null;
  }[];
  disputaId: number | null; estadoDisputa: EstadoCaso | null;
  eventos: Evento[];
}

export interface CasoDetalle extends Caso {
  sesion: SesionEquipo;
  mensajes: Mensaje[];
  permisos: { tomar: boolean; escalar: boolean; resolver: boolean; escribir: boolean };
}

export type SesionListaEquipo = Sesion & { disputaId: number | null; estadoDisputa: EstadoCaso | null };

