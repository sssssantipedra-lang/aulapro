# La web de AulaPro y lo que promete

Contexto compartido entre la app y la web. Actualizado el 1 de octubre de 2026.

## 1. La web

- Dirección: https://aulapro.app (también www.aulapro.app y aulapro-app.pages.dev). Dominio comprado en Cloudflare.
- Código: `web/sitio/`. HTML, CSS y JavaScript sin compilar; se puede abrir con cualquier servidor local (`python -m http.server --directory web/sitio`).
- Publicación: `.github/workflows/web.yml`, al llegar a `master` un cambio en `web/sitio/`. Proyecto de Cloudflare Pages `aulapro-app`.
- Páginas: inicio, `/demo` (demo interactiva hecha con capturas reales), `/descargar`, `/gracias` (tras la compra; oculta a Google), `/condiciones`, `/privacidad` y `/aviso-legal`. Todo en castellano, català e inglés.
- Textos en castellano: en el propio HTML. Català e inglés: `assets/i18n.js` (web) y `assets/demo-i18n.js` (demo). Las páginas legales y de descargas llevan los tres idiomas en el mismo archivo.
- Correo público: contacto@aulapro.app (reenvío de Cloudflare al correo del dueño).
- Lista de espera: formulario de Formspree. Ningún formulario envía nada sin la casilla de privacidad marcada.
- Interruptor de lanzamiento: `assets/launch.js`. Con `checkout` vacío la web dice "Próximamente", muestra la lista de espera y la página de descargas invita a apuntarse. Al rellenar `checkout` y `play`, los botones pasan a "Comprar", desaparece la lista de espera y se abren las descargas.
- Diseño y decisiones de contenido: `web/DISENO.md`.

## 2. Modelo de venta

- Una sola licencia para Windows, Mac y Android, vendida en la web con Lemon Squeezy, que actúa como vendedor registrado (cobra, gestiona el IVA y factura).
- Pago único de 9,99 € con impuestos incluidos. Sin suscripción.
- Hasta 2 dispositivos activados a la vez. La licencia no caduca e incluye las actualizaciones.
- Devolución en 14 días, sin preguntas. Al devolver, la licencia se desactiva.
- Android: la app se descarga gratis en Google Play y se activa con la misma licencia. Google Play lo permite como app "solo de uso".

## 3. Lo que la web promete y la app tiene que cumplir

Estas frases están publicadas en las condiciones de venta y en la política de privacidad. Si la app hace algo distinto, cambia la web en el mismo cambio.

1. Pantalla de licencia en Windows, Mac y Android, donde se introduce la clave recibida por correo.
2. Activación con la API de licencias de Lemon Squeezy (activar y validar), con un límite de 2 dispositivos.
3. Al activar, la app envía a Lemon Squeezy solo la clave y un identificador del dispositivo. Nunca datos del alumnado.
4. Hace falta internet solo para activar la primera vez. Después funciona sin conexión, salvo las funciones de IA.
5. Cambio de dispositivo: hoy se hace escribiendo a contacto@aulapro.app. Un botón "Desactivar este dispositivo" en la app sería una buena mejora.
6. Android y Google Play: dentro de la app no puede haber ningún botón ni enlace que lleve a pagar. Sí se puede escribir "Consigue tu licencia en aulapro.app", como texto sin enlace. Recomendado: sin licencia, un modo de prueba con datos de ejemplo en vez de una pantalla vacía.
7. Datos del alumnado solo en el equipo. Sin cuentas ni servidores propios.
8. IA: con la clave gratuita de Google del docente (API de Gemini). Antes de enviar nada, los nombres se sustituyen por códigos. La clave se guarda cifrada. La política avisa de que, en el uso gratuito, Google puede usar los contenidos para mejorar sus servicios.
9. Sala de alumnos: servidor local; el alumnado entra por la wifi del aula con un código QR. No pasa por internet.
10. Trabajo compartido entre docentes sin pasar por servidores de AulaPro.
11. Copia de seguridad automática cada 10 minutos, en el propio equipo.
12. Actualizaciones: la app comprueba si hay versión nueva sin enviar datos del alumnado. En Windows se actualiza sola; en Mac, a mano.

## 4. Descargas

- Enlaces estables que usa la web (`assets/launch.js`):
  - https://descargas.aulapro.app/AulaPro-instalador-windows.exe
  - https://descargas.aulapro.app/AulaPro-mac.dmg
- Android para el público: Google Play. El APK directo queda para personas de prueba.
- Caché: ver `docs/DESCARGAS.md`, apartado "Caché de Cloudflare". El 1 de octubre los instaladores de nombre fijo todavía respondían con `max-age=14400`: falta crear la Cache Rule que se describe allí.
- Pendiente para mostrar la versión en `/descargar`: que `version.json` responda con `Access-Control-Allow-Origin: https://aulapro.app` (regla CORS del bucket de R2). Cuando esté, poner `version: 'https://descargas.aulapro.app/version.json'` en `assets/launch.js`.
- Antes de vender: firmar el instalador de Windows (hoy no lleva firma y Windows avisa al instalar) y notarizar la app de Mac con Apple Developer (99 $ al año). Mientras tanto, `/descargar` explica cómo saltar esos avisos.

## 5. Lemon Squeezy: ajustes del producto

1. Precios con impuestos incluidos, para que el cliente pague exactamente 9,99 €.
2. Producto "AulaPro", pago único de 9,99 €.
3. Claves de licencia activadas, límite de 2 activaciones, sin caducidad.
4. Tras el pago, redirigir a https://aulapro.app/gracias
5. Botón del recibo por correo: https://aulapro.app/descargar
6. Descripción: "AulaPro, la app con IA para docentes de Primaria y Secundaria. Pago único: una licencia para Windows, Mac y Android, en hasta 2 dispositivos a la vez. Sin suscripción y con las actualizaciones incluidas. Devolución en 14 días sin preguntas."
7. Probar primero en modo prueba.

## 6. Páginas legales

- Política de privacidad, web y app: https://aulapro.app/privacidad. Es la dirección que hay que dar a Google Play.
- Condiciones de venta: https://aulapro.app/condiciones (devoluciones en `#devoluciones`).
- Aviso legal: https://aulapro.app/aviso-legal. Publica nombre, dirección y correo de contacto; el DNI no. Al darse de alta como autónomo, hay que añadir el NIF.
- Las páginas legales y `/gracias` están ocultas a los buscadores (`noindex`).
