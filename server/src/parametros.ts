/**
 * Parámetros del negocio que el administrador puede cambiar sin desplegar código (RF-M11-07, RNF-26).
 * Cada cambio se guarda como una versión nueva en la tabla `parametros`, con su fecha de entrada en vigencia;
 * el valor vigente es la última versión cuya fecha ya llegó. Estos son los valores iniciales del Corte 1.
 * Este archivo no importa la base de datos para que db.ts pueda usarlo al sembrar.
 */
export const PARAMETROS = [
  { clave: 'COMISION_PCT', nombre: 'Comisión de la plataforma', unidad: '%', regla: 'RN-03', valor: 15, min: 0, max: 40,
    descripcion: 'Porcentaje del valor de la sesión que se queda la plataforma. Se descuenta de la liquidación del tutor.' },
  { clave: 'PLAZO_RESERVA_H', nombre: 'Plazo para responder una reserva', unidad: 'horas', regla: 'RN-05', valor: 12, min: 1, max: 72,
    descripcion: 'Tiempo que tiene el tutor para aceptar o rechazar una reserva programada. Si vence, se cancela y se devuelve todo.' },
  { clave: 'TURNO_DEMANDA_S', nombre: 'Turno de cada tutor bajo demanda', unidad: 'segundos', regla: 'RN-05', valor: 45, min: 15, max: 300,
    descripcion: 'Tiempo que tiene cada tutor candidato para aceptar una solicitud inmediata antes de que pase al siguiente.' },
  { clave: 'BUSQUEDA_DEMANDA_MIN', nombre: 'Búsqueda máxima bajo demanda', unidad: 'minutos', regla: 'RF-M06-06', valor: 5, min: 1, max: 30,
    descripcion: 'Si en este tiempo ningún tutor acepta, la solicitud queda sin tutor y se libera la retención del pago.' },
  { clave: 'GARANTIA_H', nombre: 'Periodo de garantía del pago', unidad: 'horas', regla: 'RN-02', valor: 48, min: 1, max: 240,
    descripcion: 'Tiempo que el pago queda retenido después de la sesión antes de liberarse al tutor.' },
  { clave: 'PLAZO_DISPUTA_H', nombre: 'Plazo para abrir una disputa', unidad: 'horas', regla: 'RN-09', valor: 48, min: 1, max: 240,
    descripcion: 'Tiempo después de la sesión en que cualquiera de las partes puede abrir un caso de soporte.' },
  { clave: 'REEMBOLSO_TOTAL_H', nombre: 'Antelación para reembolso total', unidad: 'horas', regla: 'RN-06', valor: 24, min: 1, max: 168,
    descripcion: 'Si el estudiante cancela con más de esta antelación, recibe el 100 %.' },
  { clave: 'REEMBOLSO_PARCIAL_H', nombre: 'Antelación mínima para reembolso parcial', unidad: 'horas', regla: 'RN-06', valor: 2, min: 0, max: 72,
    descripcion: 'Entre esta antelación y la del reembolso total, el estudiante recibe el reembolso parcial. Con menos, no hay devolución.' },
  { clave: 'REEMBOLSO_PARCIAL_PCT', nombre: 'Porcentaje del reembolso parcial', unidad: '%', regla: 'RN-06', valor: 50, min: 0, max: 100,
    descripcion: 'Parte del pago que se devuelve al estudiante en el tramo intermedio de la política de cancelación.' },
  { clave: 'PUBLICACION_DIAS', nombre: 'Publicación de calificaciones', unidad: 'días', regla: 'RN-08', valor: 7, min: 1, max: 30,
    descripcion: 'Si solo una parte califica, su calificación se publica al cumplirse este plazo.' },
  { clave: 'TOLERANCIA_MIN', nombre: 'Tolerancia de inasistencia', unidad: 'minutos', regla: 'RF-M07-05', valor: 15, min: 5, max: 60,
    descripcion: 'Después de este tiempo desde la hora pactada, una parte puede reportar que la otra no se conectó.' },
  { clave: 'RECORDATORIO_1_H', nombre: 'Primer recordatorio', unidad: 'horas antes', regla: 'RF-M10-04', valor: 24, min: 1, max: 72,
    descripcion: 'Aviso a las dos partes antes de una sesión confirmada.' },
  { clave: 'RECORDATORIO_2_MIN', nombre: 'Segundo recordatorio', unidad: 'minutos antes', regla: 'RF-M10-04', valor: 15, min: 5, max: 120,
    descripcion: 'Último aviso a las dos partes, con el enlace de la sala.' },
  { clave: 'UMBRAL_REPUTACION', nombre: 'Umbral de reputación', unidad: 'estrellas', regla: 'RF-M08-08', valor: 3, min: 1, max: 5, decimales: true,
    descripcion: 'Si el promedio de un tutor baja de este valor, se alerta al administrador (no se oculta el perfil).' },
  { clave: 'MIN_VALORACIONES', nombre: 'Valoraciones mínimas para la alerta', unidad: 'valoraciones', regla: 'RF-M08-08', valor: 10, min: 1, max: 100,
    descripcion: 'La alerta de reputación solo se evalúa cuando el tutor tiene al menos esta cantidad de calificaciones.' },
] as const satisfies readonly {
  clave: string; nombre: string; unidad: string; regla: string; valor: number; min: number; max: number; descripcion: string; decimales?: boolean;
}[];

export type ClaveParametro = (typeof PARAMETROS)[number]['clave'];
export const DEFINICION = Object.fromEntries(PARAMETROS.map((p) => [p.clave, p])) as Record<ClaveParametro, (typeof PARAMETROS)[number]>;
