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
- Oferta de lanzamiento hasta el 15 de abril de 2027 incluido: pago único de 6,99 € con impuestos incluidos y licencia de por vida (no caduca e incluye las actualizaciones, también después de esa fecha).
- Desde el 16 de abril de 2027, las licencias nuevas son anuales: 11,99 € al año, con impuestos incluidos. La web y las condiciones ya lo anuncian. Las licencias de por vida vendidas antes se respetan siempre.
- Hasta 2 dispositivos activados a la vez.
- Packs para grupos, con la misma oferta de lanzamiento: 5, 10, 20 y 30 licencias por 22,99 €, 39,99 €, 69,99 € y 89,99 €. Una licencia (una clave) para cada docente, con sus 2 dispositivos, igual que la individual; quien compra reparte las claves. Más de 30 docentes: por correo a contacto@aulapro.app, con propuesta a medida.
- Devolución en 14 días, sin preguntas. Al devolver, la licencia se desactiva.
- Android: la app se descarga gratis en Google Play y se activa con la misma licencia. Google Play lo permite como app "solo de uso".

## 3. Lo que la web promete y la app tiene que cumplir

Estas frases están publicadas en las condiciones de venta y en la política de privacidad. Si la app hace algo distinto, cambia la web en el mismo cambio.

1. Pantalla de licencia en Windows, Mac y Android, donde se introduce la clave recibida por correo.
2. Activación con la API de licencias de Lemon Squeezy (activar y validar), con un límite de 2 dispositivos por clave. Las claves de los packs son iguales que las individuales.
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
13. Licencia anual, lista antes del 16 de abril de 2027: la app distingue las licencias de por vida (sin caducidad) de las anuales (en Lemon Squeezy, la clave de una suscripción caduca si no se renueva), comprueba con conexión de vez en cuando que la anual sigue activa y avisa antes de que caduque. Falta que el usuario confirme qué pasa si no se renueva; la propuesta es que los datos no se bloqueen nunca: la app los sigue abriendo y exportando.

## 4. Descargas

- Enlaces estables que usa la web (`assets/launch.js`):
  - https://descargas.aulapro.app/AulaPro-instalador-windows.exe
  - https://descargas.aulapro.app/AulaPro-mac.dmg
- Android para el público: Google Play. El APK directo queda para personas de prueba.
- Caché: ver `docs/DESCARGAS.md`, apartado "Caché de Cloudflare". El 1 de octubre los instaladores de nombre fijo todavía respondían con `max-age=14400`: falta crear la Cache Rule que se describe allí.
- Pendiente para mostrar la versión en `/descargar`: que `version.json` responda con `Access-Control-Allow-Origin: https://aulapro.app` (regla CORS del bucket de R2). Cuando esté, poner `version: 'https://descargas.aulapro.app/version.json'` en `assets/launch.js`.
- Antes de vender: firmar el instalador de Windows (hoy no lleva firma y Windows avisa al instalar) y notarizar la app de Mac con Apple Developer (99 $ al año). Mientras tanto, `/descargar` explica cómo saltar esos avisos.

## 5. Lemon Squeezy: ajustes del producto

1. Precios con impuestos incluidos, para que el cliente pague exactamente 6,99 €.
2. Producto "AulaPro", variante "Licencia de por vida (oferta de lanzamiento)", pago único de 6,99 €.
3. Claves de licencia activadas, límite de 2 activaciones, sin caducidad.
4. Tras el pago, redirigir a https://aulapro.app/gracias
5. Botón del recibo por correo: https://aulapro.app/descargar
6. Descripción: "AulaPro, la app con IA para docentes de Primaria y Secundaria. Oferta de lanzamiento hasta el 15 de abril de 2027: pago único de 6,99 € y licencia de por vida para Windows, Mac y Android, en hasta 2 dispositivos a la vez, con las actualizaciones incluidas. Devolución en 14 días sin preguntas."
7. Packs de 5, 10, 20 y 30 licencias (22,99 €, 39,99 €, 69,99 € y 89,99 €): cada comprador tiene que recibir una clave por docente, cada una con 2 activaciones y sin caducidad. Según su documentación, Lemon Squeezy genera una clave por compra, así que falta comprobar en modo prueba cómo conseguir varias: comprar 3 unidades de la licencia y mirar cuántas claves llegan. Si llega una sola, hay que decidir otra forma de entregarlas. Los enlaces de pago de los packs van en `packs` de `web/sitio/assets/launch.js`.
8. Probar primero en modo prueba.
9. Fin de la oferta, al acabar el 15 de abril de 2027: archivar las variantes de por vida (individual y packs) y crear la licencia anual (suscripción de 11,99 € al año, claves de licencia, 2 activaciones). Poner su enlace en `checkout` de `web/sitio/assets/launch.js` y cambiar los textos de precio de la web y las condiciones de venta, en los tres idiomas. La app tiene que tener lista la licencia anual (apartado 3, punto 13). Los packs anuales, si los hay, se deciden entonces.

## 6. Páginas legales

- Política de privacidad, web y app: https://aulapro.app/privacidad. Es la dirección que hay que dar a Google Play.
- Condiciones de venta: https://aulapro.app/condiciones (devoluciones en `#devoluciones`).
- Aviso legal: https://aulapro.app/aviso-legal. Publica nombre, dirección y correo de contacto; el DNI no. Al darse de alta como autónomo, hay que añadir el NIF.
- Las páginas legales y `/gracias` están ocultas a los buscadores (`noindex`).
