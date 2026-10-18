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

- Una sola licencia para Windows y Android, vendida en la web con Lemon Squeezy, que actúa como vendedor registrado (cobra, gestiona el IVA y factura).
- Oferta de lanzamiento hasta el 15 de abril de 2027 incluido: pago único de 6,99 € con impuestos incluidos y licencia de por vida (no caduca e incluye las actualizaciones, también después de esa fecha).
- Desde el 16 de abril de 2027, las licencias nuevas son anuales: 11,99 € al año, con impuestos incluidos. La web y las condiciones ya lo anuncian. Las licencias de por vida vendidas antes se respetan siempre.
- Hasta 2 dispositivos activados a la vez.
- Packs para grupos, con la misma oferta de lanzamiento: 5, 10, 20 y 30 docentes por 24,99 €, 44,99 €, 79,99 € y 99,99 €. Cada pack es UNA sola clave para todo el grupo, con 2 dispositivos por docente (límite de activaciones 10, 20, 40 y 60), como las claves de volumen de Microsoft. Quien compra la comparte con su grupo. Más de 30 docentes: por correo a contacto@aulapro.app, con propuesta a medida. (Se probó "una clave por docente" el 2-10-2026: Lemon Squeezy, con cantidad 3, entrega una sola clave de 2 activaciones y no permite crear claves a mano, así que el usuario eligió una clave por pack.)
- Devolución en 14 días, sin preguntas. Al devolver, la licencia se desactiva.
- Android: la app se descarga gratis en Google Play y se activa con la misma licencia. Google Play lo permite como app "solo de uso".

## 3. Lo que la web promete y la app tiene que cumplir

Estas frases están publicadas en las condiciones de venta y en la política de privacidad. Si la app hace algo distinto, cambia la web en el mismo cambio.

1. Pantalla de licencia en Windows, Mac y Android, donde se introduce la clave recibida por correo.
2. Activación con la API de licencias de Lemon Squeezy (activar y validar). El límite lo pone Lemon Squeezy en cada clave: 2 en la licencia individual, 10, 20, 40 o 60 en los packs. La app no supone que son 2: desde la 1.9.0 sus textos no dan número ("Esta clave ya está activada en todos los dispositivos que permite").
3. Al activar, la app envía a Lemon Squeezy solo la clave y un identificador del dispositivo. Nunca datos del alumnado. El nombre del dispositivo es neutro ("Aula Pro · Windows", "· Mac" o "· Android"), nunca el nombre del equipo. (App 1.8.0.)
4. Hace falta internet solo para activar la primera vez. Después funciona sin conexión, salvo las funciones de IA. Cuando hay conexión, la app comprueba la clave en segundo plano una vez por semana (así una devolución desactiva la licencia), pero sin conexión nunca se bloquea. (App 1.8.0; la privacidad y las condiciones lo dicen así: «sin límite de tiempo».)
   - Estado en la 1.8.0: escritorio (`electron/license.cjs`) y Android (`src/platform/androidLicense.ts`) hechos, con `ENFORCED = false` (aún no se pide clave; quien abre la app queda como fundador), `STORE_ID = '487841'` (desde el 2-10-2026) y `FOUNDER_CUTOFF` sin fecha. `BUY_URL` en escritorio: https://aulapro.app. `STORE_ID` es el número de la tienda de Lemon Squeezy, para que no valgan claves de otras tiendas; va igual en los dos archivos.
5. Cambio de dispositivo: el propio docente lo hace en la app, Configuración › Licencia › «Desactivar en este equipo», y activa la clave en el nuevo. Si ya no tiene el antiguo, escribe a contacto@aulapro.app. (App 1.8.0.)
6. Android y Google Play: dentro de la app no puede haber ningún botón ni enlace que lleve a pagar. Sí se puede escribir "Consigue tu licencia en aulapro.app", como texto sin enlace. Hecho en la app 1.8.0: en Android la pantalla de licencia solo muestra ese texto; en Windows y Mac, enlace a aulapro.app. Pendiente para el lanzamiento: sin licencia, un modo de prueba con datos de ejemplo en vez de una pantalla vacía.
7. Datos del alumnado solo en el equipo. Sin cuentas ni servidores propios.
   - Calendario escolar (11-10-2026): con un perfil de la Comunitat Valenciana, Cataluña o Madrid, la app descarga al abrirse https://aulapro.app/calendario-escolar.json, una vez por sesión, sin enviar nada (ver `docs/COMUNIDADES.md`, «Calendario escolar»). La privacidad lo dice en los tres idiomas, en el apartado 5 de la app.
   - Al abrirse, la app no pide nada a terceros: desde el 6-10-2026 la tipografía (Outfit, licencia OFL) va dentro de la app. Antes se pedía a Google Fonts en cada arranque, lo que pasaba a Google la IP del docente sin que la privacidad lo dijera, y sin conexión la letra cambiaba.
8. IA: con la clave gratuita de Google del docente (API de Gemini). Antes de enviar nada, los nombres se sustituyen por códigos. La clave se guarda cifrada. La política avisa de que, en el uso gratuito, Google puede usar los contenidos para mejorar sus servicios.
   - Módulo de PT y AL (ver `docs/PTAL.md`): la IA recibe además la ficha del alumno, con sus necesidades específicas de apoyo educativo y su diagnóstico, siempre con el nombre cambiado por un código. Decisión del dueño del 4-10-2026. La privacidad lo dice en los tres idiomas y explica que, si no se quiere enviar el diagnóstico, se deja en blanco; las condiciones remiten a la privacidad.
   - Desde el 5-10-2026 la privacidad dice también que, para los informes, la IA recibe lo anotado en las sesiones y en las coordinaciones (sin quiénes estuvieron); que para una ficha adaptada solo recibe nivel, necesidades y objetivos (ni nombre ni diagnóstico), y que los pictogramas y las fotos de la agenda visual no salen del equipo.
   - Perfil de Educación Física (ver `docs/EF.md`), desde el 5-10-2026: al pedir actividades, una sesión o (desde el 6-10-2026) una situación de aprendizaje, la IA recibe el curso, el tema, el material y las instalaciones y, de quien está exento o lesionado ese día, solo lo que no puede hacer, sin nombre ni motivo. El motivo es un dato de salud y no sale del equipo. La privacidad lo dice en los tres idiomas; las condiciones remiten a la privacidad, como con PT y AL.
     - Desde el 6-10-2026, del alumnado con medidas de nivel II o III (Decreto 104/2018 de la Comunitat Valenciana) que marca el docente, la IA recibe ese nivel y lo que necesita, sin nombre ni diagnóstico. La privacidad lo dice en los tres idiomas.
     - Desde el 6-10-2026, «Desde una foto» en Actividades: la foto que adjunta el docente va a Google reducida (1280 px) y sin metadatos, porque se vuelve a hacer en JPEG (`fotoParaIA`), y no se guarda. La privacidad lo dice en los tres idiomas y pide no usar fotos en las que se reconozca al alumnado; la pantalla también.
     - Desde el 17-10-2026, «Desde un manual (PDF)» en Actividades: el PDF que adjunta el docente (hasta 19 MB) va a Google y no se guarda; y en la pizarra de circuitos, la IA recibe una imagen del croquis, solo con los trazos, sola desde la segunda forma dibujada o al pulsar «Reconocer con IA» (y solo con clave de IA). La privacidad lo dice en los tres idiomas y pide no usar documentos con datos del alumnado.
     - Desde el 18-10-2026, en Android los documentos que se guardan quedan en Documentos › AulaPro del dispositivo (público, no en el almacenamiento privado de la app), una carpeta por tipo. La privacidad lo dice en los tres idiomas.
     - Desde el 18-10-2026, «Evaluar por foto»: las fotos del examen o del trabajo de un alumno, y las de la hoja de soluciones si se ponen, van a Google reducidas y sin metadatos, sin el nombre del alumno, y no se guardan. La privacidad lo dice en los tres idiomas y pide tapar el nombre en la foto (`docs/EVALUAR_FOTO.md`).
     - Desde el 18-10-2026, el autoguardado de lo que se genera (`services/borradores.ts`): mientras hay una ficha, una SdA, una rúbrica, una diana, una sesión de EF o una corrección por foto sin guardar, la app deja un borrador en `localStorage` (uno por tipo y por perfil, aparte de los datos del perfil; se borra al guardar; caduca a los 30 días; sin las fotos). No sale del equipo. La privacidad lo dice en los tres idiomas (apartado 5 de «La aplicación»), y la portada, en el punto s5.p6.
   - Las condiciones dicen que los pictogramas de la agenda visual (Mulberry Symbols, CC BY-SA 4.0) se rigen por su propia licencia, no por la de AulaPro.
   - Desde el 6-10-2026 tampoco se envía el nombre del docente: ni en el asistente (antes iba «Docente: nombre · Centro: …») ni en la situación de aprendizaje («para el grupo de nombre»). No hacía falta para responder. El centro, la asignatura y el curso escolar siguen yendo al asistente.
9. Actividades con móviles (la sala de alumnos; hasta el 11-10-2026 se llamaba «Sala de alumnos»): servidor local; el alumnado entra por la wifi del aula con un código QR. No pasa por internet.
10. Trabajo compartido entre docentes sin pasar por servidores de AulaPro.
11. Copia de seguridad automática cada 10 minutos, en el propio equipo.
12. Actualizaciones: la app comprueba si hay versión nueva sin enviar datos del alumnado. En Windows se actualiza sola; en Mac, a mano.
13. Licencia anual, lista antes del 16 de abril de 2027: la app distingue las licencias de por vida (sin caducidad) de las anuales (en Lemon Squeezy, la clave de una suscripción caduca si no se renueva), comprueba con conexión de vez en cuando que la anual sigue activa y avisa antes de que caduque. Falta que el usuario confirme qué pasa si no se renueva; la propuesta es que los datos no se bloqueen nunca: la app los sigue abriendo y exportando.

## 4. Descargas

- Decisión del 1-10-2026: el usuario no quiere pagar firmas de código. Por eso:
  - **Windows: Microsoft Store, gratis.** Se sube como paquete MSIX (en electron-builder, el objetivo `appx`) y Microsoft lo firma gratis tras certificarlo; un .exe o .msi en la Store tendría que ir firmado por nosotros, así que no. La cuenta de desarrollador individual es gratuita (storedeveloper.microsoft.com, verificación con documento de identidad y selfie). La app es gratuita en la Store y se activa con la licencia de la web: Microsoft no cobra comisión a las apps que no son juegos y usan su propio sistema de pago, y en Windows sí se permite un enlace de compra dentro de la app. Las actualizaciones las hace la Store, así que la versión de la Store no usa el actualizador propio. En la ficha, política de privacidad: https://aulapro.app/privacidad. Cuando la ficha exista, su enlace va en `store` de `assets/launch.js` y los botones de Windows de /descargar y /gracias pasan a la Store (y desaparece el aviso de SmartScreen).
  - **Android: Google Play, gratis** (25 $ de alta, una vez), activada con la misma licencia.
  - **Ficha de Microsoft Store creada el 1-10-2026** (cuenta de desarrollador individual del usuario, nombre reservado "AulaPro"). Datos de identidad para el paquete MSIX (son públicos, van en el manifiesto):
    - Package/Identity/Name: `EdTechLabs.AulaPro`
    - Package/Identity/Publisher: `CN=9A7A9138-5354-4236-8D7F-D57E49D851CB`
    - Package/Properties/PublisherDisplayName: `EdTech Labs`
    - Package Family Name: `EdTechLabs.AulaPro_qwnmvyvzyp38g`
    - Store ID: `9N9WJW9C24DN`, ficha: https://apps.microsoft.com/detail/9N9WJW9C24DN (no funciona hasta que la app esté publicada; entonces va en `store` de `web/sitio/assets/launch.js`).
  - Para la app: en `package.json` → `build`, añadir el objetivo `appx` (x64) a `win.target` y un bloque `appx` con `identityName: "EdTechLabs.AulaPro"`, `publisher: "CN=9A7A9138-5354-4236-8D7F-D57E49D851CB"`, `publisherDisplayName: "EdTech Labs"`, `applicationId: "AulaPro"` y `displayName: "AulaPro"` (debe coincidir con el nombre reservado, sin espacio, aunque `productName` sea "Aula Pro"). Poner los iconos de mosaico propios en `build/appx/` (StoreLogo, Square44x44Logo, Square150x150Logo, Wide310x150Logo); si faltan, electron-builder usa unos genéricos. En `electron/updater.cjs`, no buscar actualizaciones cuando `process.windowsStore` sea `true`: en la versión de la Store actualiza la Store. El .msix/.appx se sube a la Store sin firmar; Microsoft lo firma.
  - **Hecho en la app 1.8.0:** objetivo `appx` con esos datos, mosaicos generados por `npm run icons` en `build/appx/` y el actualizador apagado con `process.windowsStore`. Cada versión adjunta `AulaPro-<versión>-microsoft-store.appx` al release de GitHub (no se sube a descargas.aulapro.app); `store.yml` también lo compila en los pull request y a mano desde Actions.
  - **Mac: pospuesto (2-10-2026).** El usuario no quiere vender una app sin firmar, porque instalarla genera desconfianza, ni pagar Apple Developer (99 $ al año) hasta que haya ganancias. La web no ofrece Mac: la portada lo muestra como «Próximamente» (una ficha que no es enlace), /descargar tiene la tarjeta de Mac en «Próximamente» y sin botón, /gracias no tiene acceso directo a Mac, y las condiciones y la privacidad hablan solo de Windows y Android ("Por ahora no hay versión para Mac"). El .dmg sigue en descargas.aulapro.app y en GitHub para quien ya lo usa. Cuando haya firma: recuperar la tarjeta y el botón, quitar "Por ahora no hay versión para Mac" y volver a "Windows, Mac y Android" en los tres idiomas.
- Enlaces estables que usa la web (`assets/launch.js`):
  - https://descargas.aulapro.app/AulaPro-instalador-windows.exe
  - https://descargas.aulapro.app/AulaPro-mac.dmg
- Android para el público: Google Play. El APK directo queda para personas de prueba.
- Caché: ver `docs/DESCARGAS.md`, apartado "Caché de Cloudflare". El 1 de octubre los instaladores de nombre fijo todavía respondían con `max-age=14400`: falta crear la Cache Rule que se describe allí.
- Pendiente para mostrar la versión en `/descargar`: que `version.json` responda con `Access-Control-Allow-Origin: https://aulapro.app` (regla CORS del bucket de R2). Cuando esté, poner `version: 'https://descargas.aulapro.app/version.json'` en `assets/launch.js`.
- El instalador .exe directo (sin firma) sigue en descargas.aulapro.app para pruebas y como alternativa mientras no exista la ficha de la Store.

## 4b. Bloqueos de los operadores en España (18-10-2026)

Durante los partidos de LaLiga, los operadores españoles bloquean por orden judicial bloques de direcciones de Cloudflare, y con ellos webs legítimas. El 18-10-2026 el dueño no podía abrir aulapro.app ni www.aulapro.app desde la tablet, el iPhone ni un segundo PC (errores `ERR_QUIC_PROTOCOL_ERROR`, tiempo agotado y `ERR_CONNECTION_ABORTED`), con la misma wifi y sin VPN; solo abría en el PC con VPN. Desde fuera de España la web respondía bien (12 de 12 puntos de comprobación). Consecuencias para la web y la app:

- La web, `descargas.aulapro.app` (R2) y lo que la app pide a `aulapro.app` (`calendario-escolar.json`, `version.json`) no se pueden abrir desde España mientras dura un bloqueo. La app tiene que seguir funcionando sin esas respuestas.
- Las descargas van por Microsoft Store y Google Play (no por Cloudflare); los instaladores directos son secundarios.
- Resultado de la prueba: la copia de GitHub Pages (https://sssssantipedra-lang.github.io/aulapro/) abrió en el iPhone y la tablet del dueño, sin VPN. Pero el bloqueo NO está confirmado: a la vez, 8 de 8 sondas en España (dos de Orange) abrían `aulapro.app`, y no se repitió la prueba de `aulapro.app` en esos dispositivos. Antes de mover el dominio hay que comprobar que `aulapro.app` sigue sin abrir en un dispositivo sin VPN mientras la copia sí abre. Mientras tanto las dos copias se mantienen al día (apartado 4c).
- HTTP/3 (QUIC) está desactivado en Cloudflare (Speed > Settings > Protocol Optimization) desde esa fecha; es indiferente para el bloqueo.

## 4c. Que la web no se caiga (18-10-2026)

Decisión del dueño: proteger la web de las caídas «de todas las maneras posibles». Capas:

1. **Dos copias, en proveedores y direcciones distintos, independientes entre sí.** Cloudflare Pages (`web.yml`: `aulapro.app` y `aulapro-app.pages.dev`) y GitHub Pages (`web-pages.yml`: https://sssssantipedra-lang.github.io/aulapro/, direcciones `185.199.108.153` y siguientes). Cada cambio en `web/sitio` publica las dos; si una publicación falla, la otra sigue.
2. **Comprobación antes de publicar** (`web/comprobar.mjs`, en los dos flujos, después de `idiomas.mjs` y antes de `versionar.mjs`): si falta una página, un archivo al que apunta algo, el vídeo, un idioma, el mapa del sitio o el calendario, o si aparece una clave secreta, el flujo se para y la web en línea se queda como estaba. Un cambio roto no puede tirar la web.
3. **Vigilancia cada 30 minutos** (`web-vigilancia.yml` y `web/vigilar.mjs`): mira las tres portadas, `www`, el mapa del sitio, el calendario que descarga la app, el vídeo, los certificados (aviso a 14 días de caducar), la caducidad del dominio (aviso a 30 días), las dos copias de respaldo y la web vista desde sondas en España (Globalping; alarma si la mitad o más no abre). Cada fallo se repite 3 veces antes de contar. Si falla, abre una incidencia con la etiqueta `vigilancia` (GitHub avisa por correo) y la cierra sola al recuperarse. Límite: las sondas son redes de centros de datos y de voluntarios; no sustituyen a probar desde un móvil español sin VPN.
4. **Cambiar de copia en unos 5 minutos** (los DNS están en Cloudflare, Cloudflare Registrar; copia de todos los registros en `docs/DNS.md`):
   - *A GitHub Pages*: en Cloudflare, DNS, Registros, borrar los de `@` y `www` que apuntan a `aulapro-app.pages.dev`; crear para `@` cuatro A (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) y cuatro AAAA (`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`) y para `www` un CNAME a `sssssantipedra-lang.github.io`, todos en «solo DNS» (nube gris). En GitHub, Settings, Pages, Custom domain `aulapro.app` y «Enforce HTTPS»: el certificado tarda entre unos minutos y unas horas. No tocar el correo (MX) ni el TXT de Google Search Console.
   - *De vuelta a Cloudflare Pages*: en Workers y Pages, `aulapro-app`, Custom domains, añadir `aulapro.app` y `www.aulapro.app` (Cloudflare crea los registros con proxy) y quitar el dominio personalizado en GitHub.
5. **Deshacer un cambio malo**: `git revert` del cambio y merge (las dos copias se vuelven a publicar). En Cloudflare Pages también se puede volver a un despliegue anterior desde el panel.
6. **Dominio y cuentas**: comprobado el 18-10-2026 que el dominio está activo, caduca el 30-9-2027 y tiene la renovación automática programada para el 31-8-2027 (hace falta una tarjeta válida en Cloudflare en esa fecha). A cargo del dueño: verificación en dos pasos en Cloudflare, GitHub, Google y Lemon Squeezy.
7. **Conocido**: las normas de GitHub Pages no lo permiten para negocios ni para webs cuyo fin principal sea vender; una página de presentación con enlace a una tienda externa suele tolerarse, pero es zona gris. Por eso GitHub Pages es copia de respaldo y no la copia principal, y antes de lanzar la venta se revisa. `descargas.aulapro.app` (R2, Cloudflare) y lo que la app pide a `aulapro.app` no tienen respaldo; las descargas van por las tiendas.

## 5. Lemon Squeezy: ajustes del producto

1. Precios con impuestos incluidos, para que el cliente pague exactamente 6,99 €.
2. Producto "AulaPro", variante "Licencia de por vida (oferta de lanzamiento)", pago único de 6,99 €.
3. Claves de licencia activadas, límite de 2 activaciones, sin caducidad.
4. Tras el pago, redirigir a https://aulapro.app/gracias
5. Botón del recibo por correo: https://aulapro.app/descargar
6. Descripción: "AulaPro, la app con IA para docentes de Primaria y Secundaria. Oferta de lanzamiento hasta el 15 de abril de 2027: pago único de 6,99 € y licencia de por vida para Windows y Android, en hasta 2 dispositivos a la vez, con las actualizaciones incluidas. Devolución en 14 días sin preguntas."
Ojo, 1-10-2026: al crear la cuenta, Lemon Squeezy recomienda "Managed Payments" de Stripe (su dueño desde 2024). No se eligió porque Stripe no genera ni valida claves de licencia, y la venta depende de ellas; se siguió con "Continue with Lemon Squeezy". Lemon Squeezy sigue funcionando sin fecha de cierre, pero su plan es pasar a sus usuarios a Managed Payments. Si algún día hay que migrar, la web solo cambia sus enlaces de pago; la app necesitaría otro sistema de licencias (por ejemplo Polar, que también es vendedor registrado y genera claves).

7. Packs: en el mismo producto, una variante por pack, todas de pago único, con claves de licencia y sin caducidad: "Pack 5 docentes" 24,99 € (límite 10 activaciones), "Pack 10 docentes" 44,99 € (20), "Pack 20 docentes" 79,99 € (40) y "Pack 30 docentes" 99,99 € (60). La variante de la licencia individual se llama "Licencia individual (oferta de lanzamiento)", 6,99 €, límite 2. No usar `?quantity=`: cobra por unidad pero entrega una sola clave de 2 activaciones (probado el 2-10-2026). Los enlaces de pago de los packs van en `packs` de `web/sitio/assets/launch.js`.
8. Probar primero en modo prueba. Hecho el 2-10-2026: tienda https://aulapro.lemonsqueezy.com (Store ID 487841). En modo prueba, producto 1404415, variante 2192238 a 6,99 €; la compra de prueba llega con la clave en el correo, y la API de licencias responde `activation_limit` 2, sin caducidad. Al pasar al modo real, el producto se copia y su enlace de pago cambia: el de prueba no se publica nunca en la web.
9. Fin de la oferta, al acabar el 15 de abril de 2027: archivar las variantes de por vida (individual y packs) y crear la licencia anual (suscripción de 11,99 € al año, claves de licencia, 2 activaciones). Poner su enlace en `checkout` de `web/sitio/assets/launch.js` y cambiar los textos de precio de la web y las condiciones de venta, en los tres idiomas, y la ficha para Google de la portada (`application/ld+json` en `web/sitio/index.html`: precio 11.99 y sin `priceValidUntil`). La app tiene que tener lista la licencia anual (apartado 3, punto 13). Los packs anuales, si los hay, se deciden entonces.

## 6. Páginas legales

- Política de privacidad, web y app: https://aulapro.app/privacidad. Es la dirección que hay que dar a Google Play.
- Condiciones de venta: https://aulapro.app/condiciones (devoluciones en `#devoluciones`).
- Aviso legal: https://aulapro.app/aviso-legal. Publica nombre, dirección y correo de contacto; el DNI no. Al darse de alta como autónomo, hay que añadir el NIF.
- Las páginas legales y `/gracias` están ocultas a los buscadores (`noindex`).
