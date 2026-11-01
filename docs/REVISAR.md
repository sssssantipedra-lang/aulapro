# Lo que falta revisar (31-10-2026)

Lista de todo lo que está pendiente de decidir, hacer o comprobar, reunida de `CLAUDE.md` y del resto de `docs/` el 31-10-2026, a diez días de la salida a la venta (10-11-2026). Cada punto dice quién lo tiene que hacer y dónde está el detalle. Cuando algo se cierre, se tacha aquí y se anota en su documento.

Estado de la rama `ccr-3f4014f5-llwckk`: lleva cambios que **todavía no están en la web real** (aulapro.app). Se pueden probar en https://prueba.aulapro-app.pages.dev/app/ y pasan a la web cuando el dueño dice «adelante». Son estos:

- Pasa a suscripción anual: 9,90 € el primer año (hasta el 15-4-2027) y 14,99 € al renovar; packs 39,59 € y 68,99 € (luego 59,99 € y 99,99 €). Si no se renueva, se bloquea la cuenta.
- La fecha de salida a la venta pasa a ser el 10-11-2026.
- Los documentos del alumnado van a la IA solo como texto.
- En las fotos del trabajo de un alumno, el nombre se tapa antes de enviarlas.
- El diagnóstico de PT y AL deja de ir a la IA.
- Los códigos de alumno son nuevos y al azar en cada petición, con dígito de control.
- Un nombre de pila compartido también se tapa.
- No se pueden guardar dos alumnos con el mismo nombre en la misma clase.
- La privacidad y la nota de Configuración › IA explican que, desde Europa, Google trata la clave gratuita con las reglas de datos de la de pago.

## 1. Decisiones del dueño

1. ~~**La clave de la IA.**~~ **Decidido el 31-10-2026: se sigue con la clave de Google de cada docente, también la gratuita.** Se estudió una clave central de AulaPro con créditos y se descartó. La privacidad (en los tres idiomas) y la nota de Configuración › IA ya dicen que, desde el Espacio Económico Europeo, Google trata la clave gratuita con las reglas de uso de datos de la de pago. Queda un riesgo: que Google interprete de otro modo la cláusula «solo servicios de pago al ofrecer clientes de la API a usuarios del EEE». Por eso las condiciones se revisan cada trimestre (`docs/MANTENIMIENTO.md`), y conviene mirar si Google contesta en su foro la pregunta sobre apps con la clave de cada usuario (https://discuss.ai.google.dev/t/eea-paid-services-requirement-android-app-using-each-end-users-own-free-gemini-api-project/195065).
2. ~~Si la clave es central: tope de gasto y qué reciben licencias de por vida, fundadores y packs.~~ Ya no aplica.
3. ~~El párrafo de la privacidad sobre el uso gratuito de Google.~~ Corregido el 31-10-2026.
4. **Los packs.** Con la licencia individual a 9,90 €, los packs (24,99 € para 5 docentes y 44,99 € para 10) salen a 5,00 € y 4,50 € por docente: un 50 % y un 55 % de descuento. Antes eran un 28 % y un 36 %. Si se quiere el mismo descuento, rondarían 34,99 € y 62,99 €.
5. **Qué ve quien no renueva una licencia anual** (las primeras vencen hacia el 16-4-2028). Los datos nunca se bloquean; falta decidir qué deja de funcionar (`docs/MANTENIMIENTO.md`).
6. **Claves compartidas (auditoría del 1-11-2026).** `/api/licencia/validate` sin número de activación devuelve una licencia firmada (lo usa la licencia de la cuenta para renovarse sin token de Google). Con eso, quien tenga una clave ajena y sepa programar puede usarla en más de 2 dispositivos sin activarla. Cerrarlo obliga a cambiar cómo se renueva la licencia de la cuenta (con el token de Google o de Microsoft), y no se ha tocado a días de abrir la venta. Decidir si se cierra después del lanzamiento.

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
- [ ] Mirar los minutos gastados de GitHub Actions. El repositorio es privado y la vigilancia cada 30 minutos consume unos 1.440 trabajos al mes.
- [ ] Las fechas marcadas «(comprobar)» en `docs/MANTENIMIENTO.md`.
- [ ] (Recomendado, auditoría del 1-11-2026) `LICENCIA_SECRETO` y `LICENCIA_SECRETO_ANTERIOR` con los pasos de `docs/MANTENIMIENTO.md`, «La llave de las licencias».
- [ ] Tras publicar en `master`: la vigilancia marca «✔ el código de la app no sale sin suscripción» en aulapro.app. Desde la sesión de la auditoría no se pudo abrir aulapro.app para comprobarlo.

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
- **Aviso de guardado fallido** con el almacenamiento del navegador lleno (en Chrome se puede simular desde las herramientas de desarrollo, «Application › Storage»).

Lo que solo importa si algún día se vuelve a las apps nativas: el PDF de Android (`PdfPrint`), «Ver carpeta» y el micrófono. Ver la sección de Android en `CLAUDE.md`.

## 5. Legal y cuentas

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
