/*
 * Última versión publicada del APK, para que la app avise cuando hay una nueva.
 * Se lee del último release de GitHub (lo publica .github/workflows/apk.yml con el nombre "TutoresOn-Line 1.4.0 (versionCode 5)"),
 * así el aviso solo aparece cuando el APK ya se puede descargar. Se guarda 30 minutos para no gastar el límite de la API.
 * Variables opcionales:
 *   VERSION_APP_ULTIMA  fija la última versión sin consultar GitHub (pruebas o si GitHub no responde).
 *   VERSION_APP_MINIMA  versión por debajo de la cual la app pide actualizar sin dejar cerrar el aviso.
 *   REPO_GITHUB         repositorio de los releases (por defecto Rickr18/tutoresonline).
 *   URL_APK             enlace de descarga (por defecto el APK del último release).
 */
const REPO = process.env.REPO_GITHUB ?? 'Rickr18/tutoresonline';
const URL_APK = process.env.URL_APK ?? `https://github.com/${REPO}/releases/latest/download/TutoresOn-Line.apk`;
const CADA = 30 * 60_000;

let guardada: { version: string | null; publicada: string | null; en: number } = { version: null, publicada: null, en: 0 };
let consultando: Promise<void> | null = null;

/** "TutoresOn-Line 1.4.0 (versionCode 5)" o la etiqueta "apk-1.4.0-12" / "v1.4.0" → "1.4.0". */
const extraer = (texto: unknown) => String(texto ?? '').match(/(\d+)\.(\d+)\.(\d+)/)?.[0] ?? null;

async function consultarGithub() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'tutoresonline-servidor' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
    const d = await r.json() as { name?: string; tag_name?: string; published_at?: string };
    guardada = { version: extraer(d.name) ?? extraer(d.tag_name), publicada: d.published_at ?? null, en: Date.now() };
  } catch {
    // Sin conexión o sin releases: no se avisa nada, y se reintenta en 5 minutos.
    guardada = { ...guardada, en: Date.now() - CADA + 5 * 60_000 };
  }
}

export async function versionApp() {
  const fija = process.env.VERSION_APP_ULTIMA;
  if (!fija && Date.now() - guardada.en > CADA) {
    consultando ??= consultarGithub().finally(() => { consultando = null; });
    await consultando;
  }
  return {
    ultima: fija ?? guardada.version,
    minima: process.env.VERSION_APP_MINIMA ?? null,
    publicada: fija ? null : guardada.publicada,
    url: URL_APK,
  };
}
