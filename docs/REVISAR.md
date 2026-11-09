# Lo que falta revisar (31-10-2026)

Lista de todo lo que está pendiente de decidir, hacer o comprobar, reunida de `CLAUDE.md` y del resto de `docs/` el 31-10-2026, a diez días de la salida a la venta (10-11-2026). Cada punto dice quién lo tiene que hacer y dónde está el detalle. Cuando algo se cierre, se tacha aquí y se anota en su documento.

Estado de la rama `ccr-3f4014f5-llwckk` (2-11-2026): igual que `master`. Todo lo hecho hasta hoy está publicado en aulapro.app (suscripción anual, salida a la venta el 10-11-2026, documentos del alumnado a la IA solo como texto, nombres tapados en las fotos, códigos de alumno al azar, sin dos alumnos con el mismo nombre en una clase, puerta de pago, «Descargar mis datos» y bloqueo de licencias en minutos).

El 2-11-2026 la vigilancia vio que la puerta de pago de aulapro.app dejaba salir el código sin sesión con `…js%3F.css` y `…js%23.png` (la función de borde de Netlify se saltaba toda dirección acabada en `.css` o `.png`). Corregido ese mismo día en `web/netlify-edge/puerta.js` (`docs/APP_WEB.md`, «La puerta»).

## 1. Decisiones del dueño

1. ~~**La clave de la IA.**~~ **Decidido el 31-10-2026: se sigue con la clave de Google de cada docente, también la gratuita.** Se estudió una clave central de AulaPro con créditos y se descartó. La privacidad (en los tres idiomas) y la nota de Configuración › IA ya dicen que, desde el Espacio Económico Europeo, Google trata la clave gratuita con las reglas de uso de datos de la de pago. Queda un riesgo: que Google interprete de otro modo la cláusula «solo servicios de pago al ofrecer clientes de la API a usuarios del EEE». Por eso las condiciones se revisan cada trimestre (`docs/MANTENIMIENTO.md`), y conviene mirar si Google contesta en su foro la pregunta sobre apps con la clave de cada usuario (https://discuss.ai.google.dev/t/eea-paid-services-requirement-android-app-using-each-end-users-own-free-gemini-api-project/195065).
2. ~~Si la clave es central: tope de gasto y qué reciben licencias de por vida, fundadores y packs.~~ Ya no aplica.
3. ~~El párrafo de la privacidad sobre el uso gratuito de Google.~~ Corregido el 31-10-2026.
4. **Los packs.** Con la licencia individual a 9,90 €, los packs (24,99 € para 5 docentes y 44,99 € para 10) salen a 5,00 € y 4,50 € por docente: un 50 % y un 55 % de descuento. Antes eran un 28 % y un 36 %. Si se quiere el mismo descuento, rondarían 34,99 € y 62,99 €.
5. **Qué ve quien no renueva una licencia anual** (las primeras vencen hacia el 16-4-2028). Los datos nunca se bloquean; falta decidir qué deja de funcionar (`docs/MANTENIMIENTO.md`).
6. **Claves compartidas (auditoría del 1-11-2026).** `/api/licencia/validate` sin número de activación devuelve una licencia firmada (lo usa la licencia de la cuenta para renovarse sin token de Google). Con eso, quien tenga una clave ajena y sepa programar puede usarla en más de 2 dispositivos sin activarla. Cerrarlo obliga a cambiar cómo se renueva la licencia de la cuenta (con el token de Google o de Microsoft), y no se ha tocado a días de abrir la venta. Decidir si se cierra después del lanzamiento.

## 1 ter. Registro de usuarios y de uso (publicado el 10-11-2026)

Petición del dueño: saber quién usa AulaPro (con su correo) y cuánto. Publicado a las 00:00 del 10-11-2026 con la salida de la app, por decisión del dueño: `CLAUDE.md` («Registro de usuarios y de uso»). Pendiente:

- [ ] **Que el abogado del dueño revise** (ya publicado sin su revisión; si cambia algo, se sube `VERSION_CONDICIONES`) el párrafo nuevo de la privacidad («Registro de usuarios y de uso», versión web, apartado 5, y los cambios de los apartados 1, 2 y 4) y el de las condiciones (apartado 8, «Tu cuenta y tu uso»), en los tres idiomas. Preguntas para él: si el interés legítimo cubre medir el uso y los avisos del servicio; si hace falta una evaluación de ese interés por escrito; si basta con el enlace a la privacidad de la casilla de entrada o conviene una frase en la propia pantalla; y si el plazo de 12 meses es adecuado.
- [x] ~~Fusionar la rama en `master`~~: 10-11-2026 a las 00:00, con `VERSION_CONDICIONES` y «Última actualización» del 10-11-2026.
- [ ] **Encender el registro** (`REGISTRO_USUARIOS=si`) y crear `USUARIOS_INFORME_SECRETO` en Netlify y Cloudflare (lo hace el dueño; si se ponen después de la publicación, hace falta volver a publicar para que las funciones las lean). Comprobar con `node scripts/usuarios.mjs` que aparece la cuenta del dueño tras entrar.
- [ ] **Antes de escribir a los docentes** (p. ej., el aviso de que el acceso gratuito termina el 1-1-2027): elegir un servicio de envío con dirección de aulapro.app (Brevo, Resend o similar), configurar SPF y DKIM (`docs/DNS.md`) y añadirlo a la privacidad («Quién más interviene») antes del primer envío. Nunca desde el Gmail del dueño.
- [ ] **Quien no entró después de encender el registro no está en él**: los docentes de la beta que entren antes de esa fecha se apuntan la primera vez que vuelvan a abrir AulaPro.

## 1 bis. Acceso anticipado gratuito (5-11-2026)

Decidido por el dueño: la app sale el 10-11-2026 sin cobrar y la venta se abre más adelante, sin fecha. Detalle en `CLAUDE.md` («Acceso anticipado gratuito y apertura de la venta»). Pendiente:

- [ ] **Lemon Squeezy:** los tres productos (individual y packs de 5 y 10) en borrador desde su panel, hasta el día de abrir la venta. Los enlaces de pago estuvieron publicados. Solo el dueño.
- [ ] **Probar en la rama de Cloudflare** (`prueba.aulapro-app.pages.dev`) con una cuenta de Google y otra de Microsoft reales: que entra sin pagar y que, con `CONFIG_BETA.abierta: false` en esa rama, se bloquea y sale el botón de compra. La simulación automática usa un Google falso.
- [ ] **El aviso a la lista de espera** de que ya hay acceso anticipado: es un envío externo, con aprobación del dueño. Revisar con su abogado que la finalidad del formulario («información sobre ese lanzamiento») lo cubre.
- [ ] **Día de abrir la venta:** `node scripts/abrir-venta.mjs --aplicar`, pasos en `docs/MANTENIMIENTO.md` («Abrir la venta y bloquear a quien entró gratis»).
- [ ] **Fecha anunciada del fin del acceso gratuito: el 1 de enero de 2027** (decisión del dueño, 9-11-2026; antes, «a partir de enero de 2027»). El servidor no la hace cumplir. **Ese día, abrir la venta** (`node scripts/abrir-venta.mjs --aplicar`), **o antes, cambiar la fecha** en la portada y la app en los tres idiomas (`docs/MANTENIMIENTO.md`), o la web diría algo falso.
- [ ] **Poner `CLAVES_INFORME_SECRETO` en Netlify y Cloudflare** (si aún no está) para leer las altas del acceso anticipado con `node scripts/altas-beta.mjs` (9-11-2026).
- [x] ~~**Precio: 9,90 € o 14,99 €.**~~ Decidido por el dueño el 5-11-2026: **se mantiene la oferta de lanzamiento** (9,90 € el primer año hasta el 15-4-2027; después, 14,99 € al año). La tarjeta de la beta, el aviso de la app, las condiciones y la privacidad lo dicen igual desde la auditoría del mismo día.

## 2. Antes del 10-11: lo que solo puede hacer el dueño

De la lista «Antes de abrir ventas» de `docs/MANTENIMIENTO.md`, más lo que ha salido después.

- [ ] Probar la copia de pruebas en sus dispositivos (ordenador, tableta, móvil) y decir «adelante» para publicar la rama.
- [ ] **Lemon Squeezy:**
  - Variante individual como **suscripción anual** con clave de licencia: 9,90 € el primer año y 14,99 € al renovar, con impuestos incluidos.
  - Cambiar en la descripción del producto el precio que aparezca.
  - Dejar el producto cerrado (borrador) hasta el 10-11 y abrirlo ese día.
- [ ] **Packs** anuales de 5 y 10 docentes (39,59 € y 68,99 €, luego 59,99 € y 99,99 €) creados en Lemon Squeezy, con 10 y 20 activaciones. Pasar sus enlaces de compra para `web/sitio/assets/launch.js`.
- [ ] `LEMONSQUEEZY_API_KEY` en **modo real**, en Netlify y en Cloudflare. Anotar su caducidad.
- [ ] `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_SECRET` y `FUNDADORES` en Netlify y en Cloudflare (Production y Preview), con el mismo valor en los dos. Anotar cuándo caduca el secreto de Microsoft.
- [ ] Espacio KV `LIMITE` enlazado en el proyecto de Cloudflare Pages. Sin él, Cloudflare no limita las peticiones; Netlify sí (`docs/APP_WEB.md`).
- [ ] Pantalla de consentimiento de Google en «En producción» y sin verificaciones pendientes.
- [ ] Prueba completa con dinero real: una compra de 9,90 € a un correo propio y su reembolso.
- [ ] Prueba completa con una cuenta personal de Microsoft: entrar, guardar en OneDrive, recargar.
- [ ] La gestora: el límite de ingresos para el alta de autónomo y qué debe poner el aviso legal (con el NIF).
- [ ] DMARC creado en Cloudflare, empezando con `p=none` (`docs/DNS.md`).
- [ ] Verificación en dos pasos en Cloudflare, GitHub, Google, Microsoft, Netlify y Lemon Squeezy.
- [ ] Una incidencia `vigilancia` de prueba llega al correo.
- [ ] Mirar los minutos gastados de GitHub Actions a final de noviembre (Settings › Billing). Desde el 2-11-2026 la vigilancia va cada hora (unos 720 trabajos al mes) y los flujos de las apps nativas no están en `master`.
- [x] ~~Borrar los artefactos antiguos de Actions (unos 14 GB; el plan gratuito incluye 500 MB) y bajar la retención~~ (2-11-2026: retención en 2 días, puesta por el dueño; 155 artefactos, 15,2 GB, borrados con `borrar-artefactos.yml`, de un solo uso y ya retirado; quedan 0). Comprobar en Settings › Billing que el espacio baja en los días siguientes.
- [ ] Las fechas marcadas «(comprobar)» en `docs/MANTENIMIENTO.md`.
- [ ] (Recomendado, auditoría del 1-11-2026) `LICENCIA_SECRETO` y `LICENCIA_SECRETO_ANTERIOR` con los pasos de `docs/MANTENIMIENTO.md`, «La llave de las licencias».
- [ ] **Aviso de Lemon Squeezy** (bloqueo en minutos, 2-11-2026): seguir «El aviso de Lemon Squeezy» de `docs/MANTENIMIENTO.md` y hacer la prueba del paso 5.
- [ ] (Claves compartidas) Poner `CLAVES_INFORME_SECRETO` (una contraseña larga y al azar) en Netlify y Cloudflare, y dársela al agente de la oficina que lea `GET /api/licencia/sospechosas`. Decidir más adelante si se pone `CLAVES_CORTAR_AL_TOPE=si`.
- [ ] Tras publicar en `master` (y tras el arreglo del 2-11-2026): la vigilancia marca «✔ el código de la app no sale sin suscripción» en aulapro.app. Desde la sesión de la auditoría no se pudo abrir aulapro.app para comprobarlo.

## 3. Antes del 10-11: lo que puede hacer Claude cuando se le pida

- [ ] Quitar las menciones a la «lista de espera» de `web/sitio/privacidad.html` (versión web, apartados 2 a 5) y de `aviso-legal.html` (apartado 2).
- [ ] Dejar preparada la apertura:
  - Los dos interruptores: `checkout` en `launch.js` y `VENTA_ABIERTA` en `src/platform/cuentaWeb.ts`.
  - La prueba `src/pages/LicenseGate.test.tsx`.
  - Los enlaces de los packs.
- [x] El recordatorio semanal de la copia ya existía (`AvisoCopiaWeb`); falta solo probarlo en un iPhone y en un Android reales.

## 4. Probar en dispositivos reales

Probado con pruebas automáticas y en Chromium con ratón, pero **nunca con un dedo, un lápiz o un móvil de verdad**:

- **Tapar el nombre en las fotos** con el dedo: «Evaluar por foto», rúbricas y asistente del cuaderno.
- **Pizarra y herramientas**: el trazo con el dedo y con un lápiz táctil.
- **Horario semanal**: mover los bloques arrastrando desde el asa con el dedo.
- **Sesiones**: reordenarlas arrastrando.
- **Autoguardado** en el móvil al cerrar o cambiar de aplicación.
- **Tamaño de las letras** «Grande».
- **Trabajo compartido**:
  - Guardar y abrir el archivo cifrado en Android.
  - El tiempo de cifrado en un móvil lento (600.000 vueltas).
- **Entrar con Microsoft** con una cuenta real y la copia en OneDrive. Con cuentas de centros, Microsoft puede pedir la aprobación del administrador mientras AulaPro no tenga editor verificado.
- **Safari** (iPhone, iPad, Mac): entrar con Google por redirección y volver a la app.
- **Una sola pestaña** (auditoría del 1-11-2026): abrir AulaPro en dos pestañas del ordenador, y la app instalada más una pestaña en Android y en iPhone o iPad. La segunda debe decir «AulaPro ya está abierta en otra pestaña» y, con «Usar AulaPro aquí», la primera dejar de guardar. Volver de la página de Google o de Microsoft no debe dar ese aviso.
- ~~**La app instalada en el iPhone** (2-11-2026): que ocupa toda la pantalla, que el menú llega abajo con la tarjeta del perfil entera y que no se aleja con los dedos.~~ Comprobado por el dueño en su iPhone el 2-11-2026 (`docs/APP_WEB.md`).
- **Aviso de guardado fallido** con el almacenamiento del navegador lleno (en Chrome se puede simular desde las herramientas de desarrollo, «Application › Storage»).

Lo que solo importa si algún día se vuelve a las apps nativas: el PDF de Android (`PdfPrint`), «Ver carpeta» y el micrófono. Ver la sección de Android en `CLAUDE.md`.

## 5. Legal y cuentas

### Revisión del abogado (3-11-2026)

El abogado del dueño revisó lo que hace la app con los datos y la venta. Hecho el mismo día (rama `ccr-3f4014f5-llwckk`):

- ~~**Corregir con IA.**~~ Apagado: ni «Evaluar por foto» ni «Evaluar trabajo con IA» (`src/lib/correccionIA.ts`, `docs/EVALUAR_FOTO.md`). Para volver a encenderlo, antes hay que cerrar con el abogado lo de la Ley de IA (abajo).
- ~~**Datos de salud a la IA.**~~ Ya no salen ni la categoría NEAE ni diagnósticos, trastornos, discapacidades o medicación escritos en los textos (`quitarDatosDeSalud`, `CLAUDE.md`, «Lo que va a la IA»). Desde el 4-11-2026, además, **la IA no lee el informe del orientador**: el docente anota lo que dice y marca los «Apoyos que necesita en el aula», que es lo único de sus necesidades que recibe la IA (`docs/PTAL.md`).
- ~~**Ampliar con los dedos.**~~ Se amplía y no se aleja (`docs/APP_WEB.md`). Sin comprobar en un iPhone real.

Pendiente:

- [ ] **Aviso legal** (dueño, con la gestoría): nombre, NIF, domicilio y contacto, antes de vender. Choca con la regla de no publicar el DNI del dueño (el NIF de un autónomo es el DNI): decidir si se publica o se hace de otra forma (sociedad). Preguntar a la gestoría si vale su domicilio o una oficina virtual.
- [ ] **Alta de autónomo** (dueño, con la gestoría) antes del primer cobro; tarifa plana.
- [x] ~~**Condiciones**~~ (hecho el 3-11-2026 en los tres idiomas; falta que el abogado lo lea): que AulaPro no garantiza que la cuota gratuita de Gemini siga existiendo ni en las condiciones de hoy; que el docente hace sus copias, sin excluir la responsabilidad cuando el fallo es de la app; los días de margen cuando falla el cobro de la renovación (mirar cuántos reintenta Lemon Squeezy); que Lemon Squeezy cobre no quita las obligaciones del titular. Cancelar la renovación ya deja usar la app hasta el final del año pagado (texto y servidor coinciden).
- [x] ~~**Casilla de aceptación expresa**~~ (hecho el 3-11-2026): sin marcar, para quien paga y para los fundadores, y que el servidor anote la prueba (huella de la cuenta, versión de las condiciones y fecha). Es un dato nuevo: la privacidad lo tiene que decir.
- [x] ~~**Licencias compartidas**~~ (hecho el 3-11-2026): la privacidad explica el interés legítimo, qué se guarda y cuánto, y que se puede oponer; la lista de bloqueadas se borra a los 400 días también en Netlify (antes, allí, no se borraba).
- [x] ~~**Transferencias a EE. UU.**~~ (hecho el 3-11-2026, privacidad, «La versión web», apartado 6). **Comprobar antes de abrir la venta** en https://www.dataprivacyframework.gov que Google, Microsoft, Netlify y Cloudflare siguen en la lista activa, y en la política de Lemon Squeezy que sigue usando cláusulas contractuales tipo. **Formspree se quita al abrir la venta** (decisión del dueño, 3-11-2026: la lista de espera deja de hacer falta): ese día hay que quitar su formulario de la web y sus menciones en la privacidad (apartado 6 de «Esta web» y el de transferencias), en los tres idiomas. Antes: Google, Microsoft, Cloudflare, Netlify y Lemon Squeezy, una a una: qué datos tratan y con qué garantía (Data Privacy Framework u otra).
- [x] ~~**Pictogramas**~~ (comprobado el 3-11-2026): son Mulberry Symbols (CC BY-SA 4.0), no ARASAAC; la atribución sale al pie de cada agenda visual y ficha con pictogramas que se exporta o se proyecta (`ATRIBUCION_MULBERRY`, `lib/pictos.ts`), y en el aviso legal y las condiciones.
- [ ] **Cobro fallido** (dueño): las condiciones dicen que, mientras Lemon Squeezy reintenta el cobro (unas dos semanas, según su ayuda), la suscripción sigue activa y la app funciona. Su ayuda dice que la clave solo caduca cuando caduca la suscripción, pero no se ha probado: hacerlo en modo de prueba con una tarjeta que falle y mirar que la clave sigue `active`. Revisar también en Recovery el plazo de los avisos.
- [ ] **Casilla de aceptación en el servidor real** (dueño, en la copia de pruebas): entrar con una cuenta nueva y ver que la casilla bloquea los botones; Claude puede mirar después en KV o en Blobs que la aceptación quedó anotada.
- [ ] **Capturas de la web**: la demo interactiva (`web/sitio/assets/demo-pantallas.js` y sus imágenes) aún enseña la tarjeta y la pestaña de «Evaluar por foto» (ya no lleva a ninguna parte). Volver a ejecutar `scripts/web/capturar.mjs` y `capturar-portada.mjs`.
- [x] ~~**La ACS de la rama `curriculo-andalucia`**~~ (hecho el 3-11-2026 en esa rama): su contexto para la IA (`acsParaIA`) y los prompts de `acsIA.ts` pasan sus textos por `textoLibreParaIA` y no envían `categorias` (prueba en `acsProgramar.test.ts`).

- **Abogado de protección de datos** (ya no imprescindible: con la clave del docente, AulaPro no es encargado del tratamiento de lo que va a la IA). Sigue siendo recomendable una consulta corta sobre:
  - «Evaluar por foto» y la Ley de IA de la UE: la IA que evalúa resultados de aprendizaje está en la lista de alto riesgo del ámbito educativo. Comprobar también el calendario de obligaciones vigente.
  - La lectura de la cláusula «solo servicios de pago» de Google para una app en la que cada docente pone su propia clave.
- **Verificación de Google** de la aplicación OAuth (Drive): pendiente (`docs/APP_WEB.md`).
- **Las cláusulas nuevas del 1-11-2026** (condiciones de venta y de uso: datos y alumnado, IA, servicios de terceros y limitación de responsabilidad; privacidad: papel de cada uno ante el RGPD, base legal y plazo de los datos de compra): las redactó Claude a partir del código y no sustituyen a un abogado. Ninguna cláusula puede excluir la responsabilidad que la ley no permite excluir (dolo, culpa grave, derechos de consumidores), y así lo dicen.
- **Ley de IA de la UE y «Evaluar por foto»** (además de lo de arriba): si se considera que no es de alto riesgo porque solo prepara una evaluación que decide el docente (artículo 6.3), la ley pide documentar esa valoración y registrar el sistema en la base de datos de la UE (artículos 6.4 y 49.2). Y el artículo 50 (transparencia de lo que genera una IA) puede aplicarse a las fichas y los documentos generados. Confirmar con el abogado qué obliga y desde cuándo.
- **Editor verificado de Microsoft** (Microsoft Cloud Partner Program): sin él, las cuentas de centros pueden necesitar la aprobación de su administrador para OneDrive.
- **Condiciones de Google para Gemini**: confirmar en la página vigente las dos cláusulas sobre el Espacio Económico Europeo (uso de datos en la cuota gratuita y «solo servicios de pago» para apps), en las que se apoya la decisión de usar la clave gratuita del docente. Desde la sesión de Claude no se pudo abrir la página oficial; el dueño las tiene citadas tal cual (31-10-2026).

## 6. Calidad de la IA sin probar con datos reales

- Comprensión lectora y lectura fácil: sin puntuar con una IA real (`docs/FICHAS.md`, punto 2 quater).
- Informe del orientador: probar con un informe real anonimizado, en PDF y en Word (`docs/PTAL.md`).
- Lectura de PDF en el navegador: probar con informes y programaciones reales. Hay que ver que el texto sale en orden y que los escaneados se detectan.

## 7. Pendientes conocidos que no impiden vender

- La pantalla del portátil del vídeo de la portada enseña la versión 2.8.0 (`web/DISENO.md`, sección 47).
- La web todavía llama «Aula Live» y «Sala de alumnos» a lo que en la app es «Pizarra y herramientas» y «Actividades con móviles».
- «Actividades con móviles» no funciona en la versión web: un navegador no puede abrir un servidor en la wifi del aula.
- `docs/COMPARTIR.md` dice que faltan las capturas nuevas de «Trabajo compartido», pero `CLAUDE.md` dice que se rehicieron el 26-10-2026. Hay que comprobarlo y dejar uno de los dos bien.
- Textos de la pantalla antigua de «Trabajo compartido» que siguen en el diccionario (`src/i18n/core.ts` y `ca.ts`).
- «Asistencia» y «Anotar actitud» buscan la clase que toca sin mirar el calendario escolar; «En clase» ya lo mira.
- PT y AL:
  - Faltan el formato oficial de Cataluña y el de Madrid.
  - Faltan los PDF de la normativa valenciana y catalana.
  - Faltan los modelos de informe trimestral (`docs/PTAL.md`, «Pendiente del dueño»).
- Sincronización con Drive y OneDrive: si dos dispositivos cambiaron lo mismo sin conexión, pregunta con cuál quedarse; todavía no junta elemento a elemento.
- Privacidad: un nombre que no está en la lista del alumnado (un familiar, un compañero) escrito a mano no se puede tapar solo. Se podría avisar en pantalla.
- La licencia anual tiene que estar lista antes del 16-4-2027, y la oferta de lanzamiento termina el 15-4-2027 (`docs/WEB.md`, apartado 5).
- Caché de los instaladores y versión en `/descargar`: solo importa si se vuelve a las apps nativas (`docs/WEB.md`).

- [ ] (4-11-2026) Volver a sacar la captura de la portada `web/sitio/assets/portada/rubrica.webp`: aún enseña el bloque «Evaluar trabajo con IA», apagado desde el 3-11-2026. Se hace con `scripts/web/capturar-portada.mjs`. La captura de la sección de IA (`assets/app/rubrica.webp`) ya se recortó sin ese bloque.
