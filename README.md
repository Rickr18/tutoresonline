# TutoresOn-Line

Plataforma de tutorías académicas que conecta estudiantes con tutores verificados. Permite reservar sesiones programadas según la agenda del tutor y pedir un tutor de inmediato: la solicitud llega a los tutores en línea de la materia y el primero que acepta se queda con la sesión. Incluye pagos retenidos con comisión del 15 %, calificaciones mutuas, disputas y un panel de administración.

Proyecto final de Gestión de Proyectos Tecnológicos. Autor: Rick Rios.

## Estructura

| Carpeta | Contenido |
|---|---|
| `server/` | API REST, WebSocket y tareas programadas (Node.js 22, Express, SQLite con `node:sqlite`) |
| `web/` | Aplicación web para estudiante, tutor y administrador (React, Vite, TanStack Query) |
| `mobile/` | Aplicación móvil para estudiante y tutor (React Native con Expo SDK 58) |
| `pruebas/` | Recorridos automáticos de la web y del móvil con Playwright |
| `.github/workflows/apk.yml` | Compilación del APK de Android en GitHub Actions |
| `Dockerfile`, `render.yaml` | Despliegue de la web y la API en un solo servicio |

## Ejecutar en un computador

Se necesita Node.js 22.13 o superior.

```bash
# 1. Servidor (puerto 3000). Crea la base de datos con datos de demostración la primera vez.
cd server
npm install
npm run dev

# 2. Web (puerto 5173, redirige /api y /ws al servidor)
cd web
npm install
npm run dev

# 3. Móvil (abre Expo; se puede probar con la app Expo Go o en el navegador con la tecla w)
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://IP-DEL-COMPUTADOR:3000 npx expo start
```

En el teléfono la dirección del servidor también se puede cambiar desde la pantalla de ingreso, tocando la línea *Servidor*.

Para servir la web compilada desde el mismo servidor: `cd web && npm run build`, y luego `cd server && npm start`. La web queda en http://localhost:3000.

## Cuentas de demostración

Todas usan la contraseña `Demo1234`.

| Rol | Correo |
|---|---|
| Estudiante | ana@demo.co, luis@demo.co, sofia@demo.co |
| Tutor | carlos@demo.co, valentina@demo.co, laura@demo.co (en línea), andres@demo.co, jorge@demo.co, paola@demo.co |
| Tutor pendiente de verificación | diego@demo.co |
| Soporte (solo web) | soporte@tutores.co |
| Administrador principal (solo web) | rick@tutores.co |

Los datos de demostración traen dos casos de soporte abiertos: Luis contra Andrés (en revisión por Marcela, de soporte) y Sofía contra Jorge (sin asignar).

## Casos de soporte y historial de sesiones

Cuando un estudiante abre una disputa sobre una sesión, se crea un caso de soporte y el pago queda congelado.

| Rol | Qué hace en un caso |
|---|---|
| Estudiante | Explica lo que pasó y adjunta pruebas (fotos o PDF) en su propia conversación con soporte. |
| Tutor | Ve el aviso en su inicio, presenta su versión y sus pruebas. No ve la conversación del estudiante, ni el estudiante la suya. |
| Soporte | Toma el caso, conversa con cada parte por separado, deja notas internas, abre una videollamada de mediación (Jitsi) con las dos partes y resuelve: reembolso total, reembolso del 50 % o pago al tutor. Si no puede decidir, escala el caso. |
| Administrador | Supervisa todos los casos, ve los que llevan más de 12 horas sin responsable, atiende los escalados (solo él puede resolverlos) y puede tomar cualquier caso. |

Cada sesión guarda un historial con la hora exacta de cada paso: reserva, cobro, aceptación, apertura del enlace de la sala por cada persona, inicio y cierre reales, calificaciones, pagos y cada movimiento del caso. Soporte y administración lo ven completo en **Sesiones** (incluidas las notas internas); el estudiante y el tutor ven la parte que les corresponde. La ficha de la sesión compara la hora programada con la real y marca el retraso y los minutos de clase.

Los archivos de prueba se guardan en `server/data/adjuntos` (máximo 5 MB, imágenes JPG, PNG, WEBP o HEIC y PDF) y solo los pueden ver quien los subió, la otra persona de esa conversación y el equipo.

## Variables de entorno del servidor

| Variable | Valor por defecto | Uso |
|---|---|---|
| `PORT` | 3000 | Puerto HTTP |
| `JWT_SECRET` | `solo-para-desarrollo` | Clave para firmar los tokens. Cambiarla en la nube. |
| `MODO_DEMO` | `1` | Permite iniciar una sesión programada antes de su hora. `0` lo desactiva. |
| `DB_PATH` | `server/data/tutoresonline.db` | Archivo de la base de datos |
| `WEB_DIST` | `web/dist` | Carpeta de la web compilada |

## Pruebas

Con el servidor corriendo sobre una base de datos nueva (`rm -rf server/data` antes de arrancarlo):

```bash
node server/pruebas/flujo.mjs          # 84 comprobaciones de la API
node pruebas/e2e-web.mjs               # recorrido web con Playwright (requiere la web compilada)
cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo export --platform web --output-dir /tmp/movil
python3 -m http.server 8090 -d /tmp/movil &
node pruebas/e2e-movil.mjs             # recorrido de la app en tamaño de teléfono
```

## Desplegar la web en Render

1. Subir este repositorio a GitHub.
2. En https://render.com crear una cuenta, elegir **New > Blueprint** y seleccionar el repositorio. Render lee `render.yaml`, construye el `Dockerfile` y crea el servicio `tutoresonline` en el plan gratuito.
3. Al terminar, la web queda en una URL como `https://tutoresonline.onrender.com`. Revisar que `https://.../api/salud` responda `{"ok":true,...}`.

En el plan gratuito el servicio se duerme tras unos minutos sin visitas y la primera carga tarda cerca de un minuto. La base de datos vuelve a los datos de demostración cada vez que el servicio se reinicia.

El mismo `Dockerfile` sirve en cualquier nube con Docker, por ejemplo una instancia EC2:

```bash
docker build -t tutoresonline .
docker run -d -p 80:3000 -e JWT_SECRET=una-clave-larga tutoresonline
```

## Compilar el APK

1. En GitHub, ir a **Settings > Secrets and variables > Actions > Variables** y crear la variable `API_URL` con la URL de Render (sin barra al final).
2. Ir a **Actions > APK Android > Run workflow**. La compilación tarda entre 10 y 20 minutos.
3. El APK queda publicado en **Releases** como `TutoresOn-Line.apk` y también como artefacto del flujo.

Para instalarlo, descargar el archivo en el teléfono Android y permitir la instalación de aplicaciones de origen desconocido.

Alternativa con EAS (servicio de Expo): `cd mobile && npx eas-cli@latest build -p android --profile preview`, con un perfil `preview` de tipo `apk` en `eas.json`.

## Limitaciones del prototipo

Los pagos son simulados (una tarjeta terminada en 0000 se rechaza para mostrar ese caso), el soporte de estudios del tutor guarda solo el nombre del archivo, no se envían correos ni notificaciones push y la sala virtual es un enlace de Jitsi Meet. La arquitectura de producción propuesta usa PostgreSQL, Redis y varias instancias en AWS; está descrita en la propuesta en PDF.
