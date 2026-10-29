# AulaPro web (aulapro.app/app/)

Decisión del dueño, 29-10-2026: AulaPro pasa a ser una aplicación web para todos los dispositivos (Windows, Mac, Android, iPhone, iPad y Chromebook), instalable desde el navegador, para no depender de Microsoft Store ni de Google Play. La salida a la venta pasa al **15-11-2026**. Los fundadores siguen siendo quienes tenían la app antes del **10-11-2026** (`FOUNDER_CUTOFF` de las apps nativas, sin cambios). Las apps de Windows y Android que ya existen quedan de respaldo en la rama `respaldo-apps-nativas-2.23.0` (y en `master`, que sigue compilándolas) por si la web no va bien.

## Cómo está hecha

La app es la misma: lo que cambia es la pieza que habla con el sistema. Como en Android (`src/platform/android.ts`), la versión web monta en `window.electronAPI` el mismo contrato que Electron (`src/platform/web.ts`). Solo se monta en su compilación (`npm run build:web`, `vite build --mode web`, salida en `dist-web/`): la app de escritorio, la de Android y `npm run dev` siguen como antes. Para probarla en desarrollo: `npx vite --mode web` (la licencia va a Lemon Squeezy por el proxy de `vite.config.ts`).

| Parte | En la web | Código |
|---|---|---|
| Datos | En el navegador (IndexedDB), con la misma estructura de carpetas que el escritorio (`perfiles.json`, `perfiles/<id>/datos.json`, copias). Se pide `navigator.storage.persist()`. | `platform/webFs.ts` (`idbFs`), `platform/profileStore.ts` |
| Copia en una carpeta | Chrome y Edge de ordenador: el docente elige una carpeta (mejor la de OneDrive o Google Drive) y cada cambio se copia ahí, 4 s después. Otro ordenador con la misma carpeta trae el trabajo al abrir. Nunca pisa el trabajo de otro dispositivo: si los dos han cambiado, pregunta. | `platform/espejo.ts` (con pruebas), `platform/carpetaWeb.ts`, `components/CarpetaWeb.tsx` |
| PDF | El diálogo de imprimir del navegador, con «Guardar como PDF». A4 con los márgenes de `electron/main.cjs`, el `@page` de cada documento manda, fondos de color y el título como nombre del archivo. El documento va en un `iframe` sin scripts. | `htmlParaImprimir` e `imprimir` en `platform/web.ts` |
| Licencia | La misma que Android (`createAndroidLicense`, 2 dispositivos; cada navegador cuenta como uno). La tienda se llama por `/api/licencia/<acción>`, una función de Cloudflare Pages que solo pasa la clave, el nombre «AulaPro · Navegador» y el número de activación a Lemon Squeezy. Sin fundadores en la web. | `web/funciones/api/licencia/[accion].js` |
| Clave de la IA | En el navegador (IndexedDB), sin el cifrado del sistema. | `secretos` en `platform/web.ts` |
| Sin conexión | Service worker que guarda la app entera (unos 19 MB, 815 archivos) la primera vez. Sin avisos (decisión del dueño, 29-10-2026): una versión nueva se descarga sola y se pone la próxima vez que se abre la app. | `web/app/sw.js`, `appWeb()` en `vite.config.ts` |
| Instalar | Manifiesto e iconos (`web/app/`, `node scripts/web/iconos-app.mjs`). | `appWeb()` en `vite.config.ts` |
| Word, Excel, copias | Descarga del navegador (`lib/download.ts`). Donde el navegador comparte archivos (Android, iPhone, iPad), «Guardar en mi nube» manda la copia de los datos por el menú de compartir a Google Drive, OneDrive o iCloud. | `compartirArchivo` en `lib/download.ts`, `pages/Profile.tsx` |
| Actividades con móviles | «Próximamente en la versión web»: un navegador no puede abrir un servidor en la wifi del aula. | `pages/ClassroomLive.tsx` |

Nada del trabajo del docente sale hacia un servidor de AulaPro: la web es estática y la función de la licencia solo ve la clave.

## Publicar

`web.yml` compila la app (`npm ci`, `npm run build:web`) y la copia en `web/sitio/app/` después de comprobar y sellar la web; las funciones se copian a `_pages/functions/`, donde las busca wrangler. Un push a `master` publica en https://aulapro.app/app/; uno a otra rama, en la copia de prueba https://prueba.aulapro-app.pages.dev/app/. Cabeceras de caché en `web/sitio/_headers`.

## Comprobado (29-10-2026, Chromium sin pantalla)

Pide la licencia y rechaza una clave mala; se activa; crea el perfil; guarda en IndexedDB; el service worker guarda los 815 archivos; recargada sin conexión, la app abre activada y con los datos de ejemplo intactos (10 clases, 60 alumnos, 150 evaluaciones); el PDF llega al `iframe` con su `@page`, su título y sin scripts, y antes sale el aviso «elige Guardar como PDF». La copia en carpeta y sus conflictos, con pruebas (`espejo.test.ts`). **Fallo corregido el mismo día:** Cloudflare redirige `/app/index.html` a `/app/`, y Chrome no abre una página guardada que viene de una redirección (ERR_FAILED en la segunda visita). La página se guarda como `./` y el service worker limpia cualquier respuesta redirigida (`web/app/sw.js`). Para probarlo, el servidor de pruebas tiene que redirigir igual que Cloudflare. **Sin comprobar:** el diálogo de imprimir real (sobre todo en iPhone e iPad, donde `print()` de un `iframe` puede imprimir la página entera), elegir carpeta con un dedo real, la instalación en Android, iPhone e iPad, y la función de la licencia en Cloudflare.

Al imprimir, Chrome añade por defecto la fecha y la dirección arriba y abajo («Encabezado y pie de página»): se desmarca una vez y Chrome lo recuerda.

## Lo que falta para el 15-11-2026

1. Pruebas del dueño en sus dispositivos (1 al 3 de noviembre) en la copia de prueba.
2. Un recordatorio semanal de «Guardar en mi nube» en Android, iPhone e iPad (el botón ya está).
3. Pasar los datos desde la app de escritorio o de Android: hoy ya se puede con «Descargar mis datos» y «Cargar» (mismo formato), o eligiendo en la web la carpeta de datos de la app de escritorio.
4. La web: «Abrir AulaPro» en lugar de las descargas, privacidad y condiciones en los tres idiomas (datos en el navegador, la carpeta, la función de la licencia), `docs/WEB.md`.
5. Al publicar, `launch.js`.

Después: sincronización con Google Drive y OneDrive con inicio de sesión (diciembre o enero; pedir ya la verificación a Google y a Microsoft) y Actividades con móviles para el navegador.
