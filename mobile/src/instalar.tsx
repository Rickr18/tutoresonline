/* Solo en la versión web (PWA): instrucciones para instalar la app en el iPhone y enlace a la web completa.
   En Android e iOS nativos estos componentes no dibujan nada. */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ES_WEB } from './api';
import { C, e } from './tema';

const CLAVE_CERRADO = 'tutoresonline.aviso-instalar';

function leer(clave: string) { try { return localStorage.getItem(clave); } catch { return null; } }
function guardar(clave: string, valor: string) { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } }

/** Abierta desde el ícono de la pantalla de inicio (sin barras de Safari). */
export function enModoApp() {
  if (!ES_WEB || typeof window === 'undefined') return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function dispositivo() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { ios, otroNavegador: ios && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua), android: /Android/i.test(ua) };
}

/** Aviso discreto con los pasos para dejar la app en la pantalla de inicio del iPhone. */
export function AvisoInstalar() {
  const [cerrado, setCerrado] = useState(() => !ES_WEB || enModoApp() || leer(CLAVE_CERRADO) === '1');
  if (cerrado) return null;
  const { ios, otroNavegador, android } = dispositivo();
  if (!ios && !android) return null;
  const texto = android
    ? 'En Android también puedes instalar la app nativa (APK) desde la página Descargar.'
    : otroNavegador
      ? 'Para instalarla, abre esta página en Safari y agrégala a la pantalla de inicio.'
      : 'Instálala en tu iPhone: toca Compartir y luego "Agregar a inicio". Se abrirá a pantalla completa, como una app.';
  return (
    <View style={[e.tarjeta, { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }]} accessibilityLabel="Instalar la app">
      <Ionicons name={android ? 'logo-android' : 'share-outline'} size={22} color={C.marino} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 13.5, color: C.tinta, lineHeight: 19 }}>{texto}</Text>
        {android && (
          <Pressable onPress={() => { location.href = '/descargar'; }} accessibilityRole="link">
            <Text style={{ color: C.marino, fontWeight: '700', fontSize: 13.5 }}>Ir a Descargar</Text>
          </Pressable>
        )}
      </View>
      <Pressable onPress={() => { guardar(CLAVE_CERRADO, '1'); setCerrado(true); }} accessibilityRole="button" accessibilityLabel="Cerrar aviso" hitSlop={10}>
        <Ionicons name="close" size={20} color="#7a8699" />
      </Pressable>
    </View>
  );
}

/** Va a la web completa (soporte y administración) y recuerda la preferencia para no volver a /app/. */
export function irAVersionWeb() {
  location.href = '/?web=1';
}

export function EnlaceVersionWeb({ claro }: { claro?: boolean }) {
  if (!ES_WEB) return null;
  return (
    <Pressable onPress={irAVersionWeb} accessibilityRole="link" style={{ alignSelf: 'center', padding: 6 }}>
      <Text style={[e.pequeno, claro && { color: '#c4cfe0' }]}>Versión web completa (soporte y administración)</Text>
    </Pressable>
  );
}
