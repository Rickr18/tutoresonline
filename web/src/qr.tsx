import { QRCode } from 'antd';
import { MARINO } from './tema';

/** APK publicado por el flujo "APK Android" de GitHub Actions (siempre la última versión). */
export const URL_APK: string = import.meta.env.VITE_APK_URL
  || 'https://github.com/Rickr18/tutoresonline/releases/latest/download/TutoresOn-Line.apk';

/** Página a la que lleva el QR: decide qué mostrar según el teléfono. */
export const urlDescarga = () => `${window.location.origin}/descargar`;

/** QR con fondo blanco y margen propio, para que se pueda escanear también sobre fondos oscuros. */
export function Qr({ texto, tamano = 160 }: { texto: string; tamano?: number }) {
  return (
    <QRCode className="qr" value={texto} size={tamano} type="svg" color={MARINO} bgColor="#ffffff" bordered={false}
      errorLevel="M" style={{ background: '#fff', padding: 6, borderRadius: 8, flex: 'none' }} aria-label={`Código QR: ${texto}`} />
  );
}
