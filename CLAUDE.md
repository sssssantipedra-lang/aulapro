# AulaPro · memoria del proyecto

Esta memoria la leen todas las sesiones de Claude que trabajan en AulaPro, tanto en la app como en la web. Mantenla al día: si una decisión cambia, cámbiala aquí en el mismo cambio.

AulaPro es una app para docentes de Educación Primaria y Secundaria (currículo LOMLOE) para Windows y Mac (Electron) y Android (Capacitor). Este repositorio contiene la app y su web, https://aulapro.app.

## Mapa

- `src/`, `electron/`, `android/`: la app.
- `web/sitio/`: la web publicada en aulapro.app. HTML, CSS y JavaScript sin compilar, sin frameworks ni dependencias.
- `web/DISENO.md`: decisiones de diseño y de contenido de la web, ronda a ronda.
- `docs/WEB.md`: contexto compartido entre la app y la web: modelo de venta, lo que la web promete y la app tiene que cumplir, descargas y Lemon Squeezy.
- `docs/DESCARGAS.md`: el servidor de descargas (descargas.aulapro.app).

## Publicar

- La app: Actions, "Publicar versión" (`release.yml`). Sube los instaladores a https://descargas.aulapro.app.
- La web: se publica sola cuando llega a `master` un cambio en `web/sitio/` (`web.yml`, Cloudflare Pages, proyecto `aulapro-app`). Necesita el secreto `CLOUDFLARE_API_TOKEN`.
- Día del lanzamiento: rellenar `checkout` (enlace de pago de Lemon Squeezy) y `play` (ficha de Google Play) en `web/sitio/assets/launch.js`. La web entera pasa de "Próximamente" a "a la venta".

## Reglas que no se rompen

1. Lo que la web promete es lo que hace la app (`docs/WEB.md`, sección 3). Si cambia cómo la app trata datos, licencias, IA, copias o actualizaciones, actualiza en el mismo cambio `web/sitio/privacidad.html` y `web/sitio/condiciones.html`, en los tres idiomas.
2. Licencia: una sola para Windows, Mac y Android. Pago único de 9,99 € con impuestos incluidos, hasta 2 dispositivos a la vez, sin caducidad, actualizaciones incluidas y devolución en 14 días sin preguntas. Se vende en la web con Lemon Squeezy.
3. Android se descarga gratis en Google Play y se activa con esa licencia. Dentro de la app nunca hay un botón ni un enlace que lleve a pagar; solo se puede escribir "Consigue tu licencia en aulapro.app", como texto sin enlace.
4. Ningún formulario de la web envía nada si no se marca la casilla "He leído y acepto la política de privacidad".
5. Textos: tú con vocabulario formal. Docentes, profesorado, maestros y maestras; nunca "profes". Sin rayas largas: comas y puntos. Castellano, català e inglés.
6. No se publican nunca el DNI del dueño ni su Gmail. El contacto público es contacto@aulapro.app.
