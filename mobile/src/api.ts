/* Cliente de la API para la app móvil. Misma API que la web; la dirección del servidor es configurable. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export * from './tipos';
import type { Adjunto } from './tipos';

const EMULADOR_ANDROID = 'http://10.0.2.2:3000';
/** Servidor de producción (Render), definido en app.json > expo.extra.servidor. */
const SERVIDOR_PRODUCCION: string | undefined = Constants.expoConfig?.extra?.servidor;
/** Versión web (la PWA de iPhone): habla con el mismo servidor que la sirve. */
export const ES_WEB = Platform.OS === 'web';

/**
 * Servidor por defecto, en este orden:
 * 1. EXPO_PUBLIC_API_URL si se fijó al compilar (pruebas, o la variable API_URL del workflow del APK).
 * 2. En web, el origen de la página.
 * 3. En desarrollo con Expo Go, el computador que sirve el proyecto (la IP de Metro) en el puerto 3000.
 * 4. En el APK de producción, el servidor de Render de app.json.
 */
function servidorPorDefecto() {
  const fijo = process.env.EXPO_PUBLIC_API_URL;
  if (fijo) return fijo.replace(/\/+$/, '');
  if (ES_WEB && typeof location !== 'undefined') return location.origin;
  if (__DEV__ || !SERVIDOR_PRODUCCION) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host && /^[\d.]+$|^localhost$/.test(host)) return `http://${host}:3000`;
    return EMULADOR_ANDROID;
  }
  return SERVIDOR_PRODUCCION.replace(/\/+$/, '');
}

export const SERVIDOR_POR_DEFECTO = servidorPorDefecto();
const ESPERA_MAXIMA_MS = 15000;

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}

const CLAVE_TOKEN = 'tutoresonline.token';
const CLAVE_SERVIDOR = 'tutoresonline.servidor';

let token: string | null = null;
let servidor = SERVIDOR_POR_DEFECTO;
let alExpirar: (() => void) | null = null;

export const almacen = {
  async cargar() {
    const [t, s] = await Promise.all([AsyncStorage.getItem(CLAVE_TOKEN), AsyncStorage.getItem(CLAVE_SERVIDOR)]);
    token = t;
    // Una dirección guardada con el valor del emulador no sirve en un teléfono real,
    // y en web siempre se usa el servidor que sirve la página.
    if (s && s !== EMULADOR_ANDROID && !ES_WEB) servidor = s;
    return { token: t, servidor };
  },
  token: () => token,
  servidor: () => servidor,
  async guardarToken(t: string | null) {
    token = t;
    if (t) await AsyncStorage.setItem(CLAVE_TOKEN, t);
    else await AsyncStorage.removeItem(CLAVE_TOKEN);
  },
  async guardarServidor(s: string) {
    servidor = s.trim().replace(/\/+$/, '') || SERVIDOR_POR_DEFECTO;
    if (servidor === SERVIDOR_POR_DEFECTO) await AsyncStorage.removeItem(CLAVE_SERVIDOR);
    else await AsyncStorage.setItem(CLAVE_SERVIDOR, servidor);
  },
};

export function alPerderSesion(fn: () => void) { alExpirar = fn; }

export async function api<T>(ruta: string, cuerpo?: unknown, metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH'): Promise<T> {
  let res: Response;
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);
  try {
    res = await fetch(`${servidor}/api${ruta}`, {
      signal: control.signal,
      method: metodo ?? (cuerpo === undefined ? 'GET' : 'POST'),
      headers: {
        Accept: 'application/json',
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, `No se pudo conectar con el servidor ${servidor}. Revisa que esté encendido, que el teléfono esté en la misma red y la dirección del servidor.`);
  } finally {
    clearTimeout(limite);
  }
  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && !ruta.startsWith('/auth/')) alExpirar?.();
    throw new ErrorApi(res.status, datos?.error ?? 'Ocurrió un error inesperado.');
  }
  return datos as T;
}

export function consulta(params: Record<string, string | number | boolean | null | undefined>) {
  const partes: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== null && v !== undefined && v !== false) partes.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return partes.length ? `?${partes.join('&')}` : '';
}

/** Dirección de un archivo adjunto, con el token en la URL para poder mostrarlo en <Image> o abrirlo en el navegador. */
export function urlAdjunto(id: number) {
  return `${servidor}/api/adjuntos/${id}?t=${encodeURIComponent(token ?? '')}`;
}

export const MAX_ADJUNTO = 5 * 1024 * 1024;

/** Sube una foto (JPEG en base64) como prueba de un caso. */
export async function subirFoto(base64: string, nombre: string): Promise<Adjunto> {
  if (Math.floor(base64.length * 3 / 4) > MAX_ADJUNTO) throw new ErrorApi(413, 'La foto supera los 5 MB. Prueba con una de menor resolución.');
  // En el teléfono la foto llega como JPEG; en la versión web puede llegar el archivo original (PNG o WEBP).
  const tipo = base64.startsWith('iVBOR') ? 'image/png' : base64.startsWith('UklGR') ? 'image/webp' : 'image/jpeg';
  const extension = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' }[tipo];
  return api<Adjunto>('/adjuntos', { nombre: nombre.replace(/\.[^.]+$/, `.${extension}`), tipo, datos: base64.replace(/^data:[^,]+,/, '') });
}

export function urlTiempoReal() {
  return `${servidor.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token ?? '')}`;
}
