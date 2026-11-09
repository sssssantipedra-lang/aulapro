# Mantenimiento: claves, caducidades y cuentas

Creado el 30-10-2026 (petición del dueño: «un documento con las cosas a tener en cuenta, tipo caducidad de API keys»). Es una lista de lo que **se acaba, se rompe en silencio o hay que renovar a mano**. No contiene ninguna clave ni contraseña: solo dice cuáles hay, dónde viven y qué pasa si fallan. Si cambia una cuenta, una clave o una fecha, se cambia aquí en el mismo cambio.

Las filas marcadas con **(comprobar)** son cosas que esta lista no ha podido ver (viven en un panel al que el repositorio no llega): el dueño debe mirar la fecha real y anotarla en la tabla.

## 1. Calendario de fechas

| Fecha | Qué ocurre | Qué hay que hacer |
|---|---|---|
| **Cada mes** | Revisión de 10 minutos (apartado 6) | Mirar el uso de Netlify, las incidencias `vigilancia` y las fechas de este documento |
| **10-11-2026** | Corte de fundadores (`FOUNDER_CUTOFF`) | Revisar que la lista `FUNDADORES` está completa antes de esa fecha; después, solo cambios con motivo |
| **10-11-2026** | Salida a la venta (el mismo día que el corte de fundadores). **Hasta entonces la venta está cerrada** (31-10-2026) | Antes: lista del apartado 5 («Antes de abrir ventas»). Abrir **los dos interruptores a la vez**: `checkout` en `web/sitio/assets/launch.js` y `VENTA_ABIERTA = true` en `src/platform/cuentaWeb.ts` |
| **31-12-2026** | Caduca la clave de revisión de Lemon Squeezy para Google Play (`docs/TIENDAS.md`) | Solo importa si algún día se vuelve a las tiendas. Hoy no se usa |
| **Hacia el 30-4-2027** | Microsoft: si el secreto del registro se creó con 6 meses (30-10-2026 + 6 meses) | **(comprobar)** la fecha de caducidad elegida al crearlo. Renovar un mes antes (apartado 2) |
| **15-4-2027** | Termina la oferta de lanzamiento (9,90 € el primer año) | Pasos en `docs/WEB.md`, apartado 5, punto 9. Una oferta con fecha se cumple Quitar el código de descuento de los enlaces: `CODIGO_LANZAMIENTO` en `src/platform/cuentaWeb.ts` y los de los packs en `launch.js` (códigos LANZAMIENTO, LANZAMIENTO5 y LANZAMIENTO10, 34 %, 34 % y 31 %) |
| **Cada renovación** | Las suscripciones anuales se renuevan a 14,99 € | Lemon Squeezy manda un recordatorio 7 días antes (Settings › Recovery › Renewal reminders, activado el 1-11-2026); la web no promete ningún aviso. Si no se paga, la clave caduca y la app bloquea la cuenta (ver «Cobro fallido» abajo) |
| **31-8-2027** | Renovación automática del dominio (14,20 $) | Tarjeta válida en Cloudflare. La vigilancia avisa 30 días antes de que caduque |
| **30-9-2027** | Caduca el dominio `aulapro.app` si no se renovó | Si la renovación falla, la web, la app y el correo caen a la vez |
| **Hacia el 16-4-2028** | Primeras anuales a renovar | Comprobar qué ve quien no renueva (decisión pendiente: los datos nunca se bloquean) |

## 2. Claves y secretos

Se cambian en tres sitios, y **Netlify y Cloudflare llevan los mismos valores** (la app habla con el que responda primero, `platform/servidores.ts`):

- **Netlify** (proyecto `aulapro-respaldo`): Site configuration › Environment variables.
- **Cloudflare Pages** (proyecto `aulapro-app`): Settings › Variables and Secrets, en **Production y en Preview**.
- **GitHub**: Settings › Secrets and variables › Actions.

**Una variable nueva solo vale desde la siguiente publicación**, en Netlify y en Cloudflare. Tras cambiar una, hay que volver a publicar (Netlify: Deploys › Trigger deploy; Cloudflare: `web.yml`) y probar.

| Nombre | Dónde | Para qué | Caduca | Si falla |
|---|---|---|---|---|
| `GOOGLE_CLIENT_SECRET` | Netlify y Cloudflare | Entrar con Google, permiso de Drive (`/api/google/*`) y, **mientras no exista `LICENCIA_SECRETO`**, llave que firma las licencias y la de la sesión que abre el código de la app (`_sesion.js`, la puerta de `/app/assets/`) | No caduca solo. Solo cambia si se rota a mano | Sin él, no hay entrada con Google ni Drive. Ver «La llave de las licencias» |
| `LICENCIA_SECRETO` (opcional, desde el 1-11-2026) | Netlify y Cloudflare, Production y Preview | Llave propia de las licencias firmadas y de la sesión (`web/funciones/api/_secretos.js`). Si está, el secreto de Google se puede cambiar sin tocar las licencias | No caduca. Un texto largo al azar (por ejemplo, 64 caracteres de un generador de contraseñas) | Ponerlo o cambiarlo sin seguir los pasos de «La llave de las licencias» deja sin sesión a quien tenga la app abierta (hasta una hora) |
| `LICENCIA_SECRETO_ANTERIOR` (opcional) | Netlify y Cloudflare, Production y Preview | Solo durante un cambio de llave: se siguen aceptando las firmas y las sesiones hechas con él | Quitarlo 8 días después del cambio | Si se olvida, no pasa nada grave: se sigue aceptando la llave vieja |
| `LEMONSQUEEZY_WEBHOOK_SECRET` (desde el 2-11-2026) | Netlify y Cloudflare, Production | El secreto de firma del aviso (webhook) de Lemon Squeezy a `https://aulapro.app/api/licencia/aviso` (`web/funciones/api/_bloqueos.js`). Con él, una licencia desactivada, devuelta o caducada se bloquea en unos 15 minutos. Pasos abajo, en «El aviso de Lemon Squeezy» | No | Sin él, la dirección no existe y el bloqueo llega con la comprobación de cada hora |
| `CLAVES_INFORME_SECRETO` (opcional, desde el 1-11-2026) | Netlify y Cloudflare, Production | Contraseña larga para leer el informe de claves compartidas: `GET /api/licencia/sospechosas` con la cabecera `Authorization: Bearer <valor>` (`web/funciones/api/_vigilancia.js`). Lo lee el agente de la oficina que se encargue. Desde el 9-11-2026 abre también `GET /api/licencia/altas`, el número de altas del acceso anticipado por día (`web/funciones/api/_altas.js`; `CLAVES_INFORME_SECRETO=… node scripts/altas-beta.mjs` pregunta a Netlify y a Cloudflare y suma). Sin ella, esas direcciones no existen | No | Sin ella no hay informes; las claves y las altas se siguen anotando igual |
| `REGISTRO_USUARIOS` (desde el 10-11-2026) | Netlify y Cloudflare, Production | **El interruptor del registro de usuarios y de uso** (`web/funciones/api/_usuarios.js`): con `si`, el servidor guarda el correo, el tipo de acceso y los días y minutos de uso activo de cada docente. **Va encendida desde la publicación del 10-11-2026**: la privacidad ya lo explica. Para pararlo, se borra y se vuelve a publicar | No es secreta, pero va en el panel para poder apagarla sin tocar el código | Sin ella (o con otro valor) no se guarda nada: la privacidad diría algo que no se hace, que es menos grave que lo contrario, pero no debe quedarse así |
| `USUARIOS_INFORME_SECRETO` (desde el 10-11-2026) | Netlify y Cloudflare, Production | Contraseña larga, **distinta de `CLAVES_INFORME_SECRETO`** (esa la lee un agente de la oficina; esta abre los correos de los docentes): `GET /api/licencia/usuarios` y los borrados. La usan la página aulapro.app/informe y `node scripts/usuarios.mjs` (informe, `csv`, `borrar`, `excluir`). Solo la tiene el dueño | No | Sin ella el informe no existe; el registro se sigue llenando igual |
| `CLAVES_CORTAR_AL_TOPE` (opcional) | Netlify y Cloudflare, Production | Con el valor `si`, una clave que pasa de 15 conexiones distintas en una semana deja de recibir la firma esa semana. Sin ella (por defecto), solo se anota. **No activarla sin cambiar antes la privacidad** (revisión del 5-11-2026): la privacidad promete en los tres idiomas «sin decisiones automáticas: una clave anotada la revisa una persona» (apartado 4 de la versión web), y el corte automático lo contradice (art. 22 RGPD: haría falta ofrecer revisión humana) | No | Nada: solo se anota |
| `MICROSOFT_CLIENT_SECRET` | Netlify y Cloudflare | Entrar con Microsoft y OneDrive (`/api/microsoft/*`) | **Sí.** Microsoft admite como máximo 24 meses; la fecha se elige al crearlo (creado el 30-10-2026) **(comprobar)** | Falla Microsoft y OneDrive. Google y las claves siguen bien |
| `LEMONSQUEEZY_API_KEY` | Netlify y Cloudflare | Buscar la compra de una cuenta y activar la licencia sola (`/api/licencia/cuenta`) | **Puede caducar** (las claves de la API de Lemon Squeezy llevan fecha) **(comprobar)** | Ver «Lemon Squeezy» abajo: es el fallo más caro |
| `FUNDADORES` | Netlify y Cloudflare, Production y Preview | Correos que entran gratis | No caduca. Se mantiene a mano | Un correo que falta pierde su acceso gratis al volver a comprobar |
| `CLOUDFLARE_API_TOKEN` | GitHub | Publicar la copia de Cloudflare Pages y **la rama de prueba** (`web.yml`) | Puede llevar fecha, según cómo se creó **(comprobar)** | Dejan de actualizarse `prueba.aulapro-app.pages.dev` y el respaldo. **La web de producción (Netlify) no depende de él** |
| `GITHUB_TOKEN` | Automático | Releases y tareas de GitHub | Lo gestiona GitHub | Nada que hacer |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | GitHub | Subir instaladores a descargas.aulapro.app (`release.yml`, hoy solo en la rama `respaldo-apps-nativas-2.23.0`) | Según el token **(comprobar)** | Solo importa si se vuelve a publicar un instalador. Hoy no se usa |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | GitHub | Firmar la app de Android (`android-play.yml`, hoy solo en la rama `respaldo-apps-nativas-2.23.0`) | La clave de firma suele durar décadas **(comprobar)** | **Si se pierde la clave de firma, no se puede actualizar la app de Google Play.** Guardar una copia fuera de GitHub |
| Clave de Gemini de cada docente | Navegador del docente | La IA | Por cuenta del docente | La app no paga nada. Ver «Modelos de Gemini» |

### Variables que no son secretas

Están en el código y no caducan, pero hay que mantenerlas a la vez que su registro:

- `MICROSOFT_CLIENT_ID` (`platform/cuentaWeb.ts` y `web/funciones/api/_microsoft.js`): **vacía = Microsoft apagado.**
- ID de cliente de Google (`platform/cuentaWeb.ts`): público.
- `VUELTAS` (`web/funciones/api/google/_comun.js` y `web/funciones/api/_microsoft.js`, con su copia en `web/netlify/` cuando la lleva): todas las direcciones de vuelta. Tienen que coincidir con «URI de redireccionamiento autorizados» de Google Cloud y con «Autenticación» del registro de Microsoft. **Si se añade un dominio (o se cambia el de producción), hay que tocarlo en los tres sitios.**

### Cómo renovar cada una

1. **Microsoft (`MICROSOFT_CLIENT_SECRET`)**: entra.microsoft.com › Registros de aplicaciones › AulaPro › Certificados y secretos. Se pueden tener **dos secretos a la vez**: crear el nuevo, ponerlo en Netlify y Cloudflare (Production y Preview), volver a publicar, probar la entrada con Microsoft y solo entonces borrar el viejo. Apuntar la nueva fecha de caducidad en este documento. El valor solo se ve al crearlo.
2. **Lemon Squeezy (`LEMONSQUEEZY_API_KEY`)**: Settings › API. Crear la nueva, ponerla en Netlify y Cloudflare, publicar, probar «entrar con Google con una cuenta que ya compró», y después borrar la vieja. **Tiene que ser una clave del modo real**, no del modo de prueba (Lemon Squeezy separa las dos).
3. **Cloudflare (`CLOUDFLARE_API_TOKEN`)**: panel de Cloudflare › Mi perfil › API Tokens. Mismos permisos que el anterior (editar Cloudflare Pages del proyecto `aulapro-app`). Cambiarlo en GitHub y lanzar `web.yml` a mano para comprobar.
4. **Google (`GOOGLE_CLIENT_SECRET`)**: solo si se filtra. Ver «La llave de las licencias» antes de tocarlo. Con `LICENCIA_SECRETO` puesto, cambiarlo ya no afecta a las licencias ni a las sesiones.

## 3. Lo que se rompe en silencio

Estos son los fallos que no avisan, en el orden en que más duelen.

### El aviso de Lemon Squeezy (bloqueo en minutos)

Desde el 2-11-2026. Sin esto todo funciona, pero una licencia desactivada o devuelta tarda hasta una hora en cerrarse.

1. Inventar un secreto largo y al azar (por ejemplo, 40 letras y números).
2. En Lemon Squeezy, **Settings › Webhooks › +**: URL `https://aulapro.app/api/licencia/aviso`, **Signing secret** el secreto del paso 1, y marcar estos avisos: `order_refunded`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`, `subscription_payment_success`, `subscription_payment_recovered`, `subscription_payment_refunded`, `license_key_created` y `license_key_updated`. Hacerlo en modo real (y, si se quiere probar antes, otro igual en modo prueba).
3. En Netlify y en Cloudflare (Production): `LEMONSQUEEZY_WEBHOOK_SECRET` = el mismo secreto. `LEMONSQUEEZY_API_KEY` ya tiene que estar (la usa también la búsqueda por correo). Volver a publicar.
4. (Opcional) Un segundo aviso igual a `https://aulapro-app.pages.dev/api/licencia/aviso`, para que la copia de respaldo de Cloudflare tenga también la lista.
5. Probar: desactivar una clave de prueba en Lemon Squeezy, mirar en Netlify (**Logs › Functions › licencia**) la línea «[aviso Lemon Squeezy] license_key_updated · 1 clave bloqueada, 0 desbloqueadas» (si dice «rechazado», el secreto no coincide; nunca lleva la clave, el correo ni el pedido), y comprobar que la app con esa clave se bloquea en 15 minutos como mucho. Reactivarla y ver que vuelve a entrar.

### La llave de las licencias (`LICENCIA_SECRETO` o, si no está, `GOOGLE_CLIENT_SECRET`)

Las licencias se firman con una llave que sale de `LICENCIA_SECRETO` si existe y, si no, **del secreto de Google** (`web/funciones/api/_secretos.js` y `_firma.js`). Netlify y Cloudflare firman igual porque tienen el mismo secreto.

**Pasar a una llave propia o cambiarla sin dejar a nadie fuera (auditoría del 1-11-2026, recomendado antes del 10-11-2026):**

1. Crear un texto largo al azar (64 caracteres de un generador de contraseñas).
2. En Netlify y en Cloudflare (Production y Preview): `LICENCIA_SECRETO` = el texto nuevo, y `LICENCIA_SECRETO_ANTERIOR` = la llave que se usaba hasta ahora (la primera vez, **el mismo valor que `GOOGLE_CLIENT_SECRET`**; en los cambios siguientes, el `LICENCIA_SECRETO` de antes).
3. Publicar los dos sitios y probar: abrir la app con una licencia ya activa (debe abrir sin pedir nada) y activar una clave nueva. Comprobar que `https://aulapro.app/api/licencia/clave` y `https://aulapro-app.pages.dev/api/licencia/clave` devuelven la misma `x` (la vigilancia horaria lo mira también, «Netlify y Cloudflare firman las licencias con la misma llave»; desde el 5-11-2026 el valor se recorta de espacios y saltos de línea, y la llave pública se sirve sin caché).
4. Pasados 8 días (las firmas caducan a los 7), quitar `LICENCIA_SECRETO_ANTERIOR` y volver a publicar.

Sin el paso 2 completo, las sesiones de todo el mundo dejan de valer a la vez y la app no puede cargar sus pantallas hasta que cada navegador renueva su licencia (hasta una hora con conexión).

**Si el secreto se ha filtrado** (revisión del 5-11-2026): no poner el viejo en `LICENCIA_SECRETO_ANTERIOR`, porque con él quien tenga el secreto sigue fabricando firmas y sesiones durante esos 8 días. Poner solo el `LICENCIA_SECRETO` nuevo en los dos sitios, publicar los dos a la vez y asumir el coste: cada app pide firma y sesión nuevas en su siguiente comprobación (una hora con conexión, o al abrir), y quien esté sin conexión en ese momento entra en cuanto la tenga. Consecuencias de la llave en general:

- Si Netlify y Cloudflare **no tienen exactamente el mismo valor**, las licencias firmadas por uno no las acepta la app cuando le toca el otro, y el docente verá la licencia pedirse de nuevo o fallar de forma intermitente.
- Si se **rota el secreto**, cambia la llave. Las licencias de cuenta se vuelven a firmar solas en la siguiente comprobación con conexión; **las claves escritas a mano también se vuelven a comprobar**. Quien esté sin conexión en ese momento no podrá entrar hasta tener red. Hacerlo fuera de horas de clase y de cualquier fecha de venta.
- Cuando se cambie el secreto: tocar los dos sitios, publicar los dos y probar con una cuenta con licencia y con una clave escrita a mano.
- **Desde el 1-11-2026 de este secreto sale también la sesión que abre el código de la app** (`_sesion.js`, «sin pagar, no hay app»: `docs/APP_WEB.md`). Si se rota, las sesiones dejan de valer y la app pide una nueva al abrir (con conexión, sola); si Netlify y Cloudflare tienen valores distintos, la cookie que da uno no la acepta la puerta del otro. **En Netlify, la variable tiene que estar disponible también para las funciones de borde** (la puerta, `web/netlify-edge/puerta.js`); si la puerta no la ve, deja pasar a todo el mundo sin avisar. Las firmas caducan a los 7 días: quien pase más de 7 días sin conexión tiene que conectarse para seguir.

### Lemon Squeezy

- **Si `LEMONSQUEEZY_API_KEY` caduca o es de modo de prueba**: la licencia de una cuenta que ha pagado **no se activa sola**. El docente que acaba de pagar ve otra vez «Comprar AulaPro», puede pagar dos veces y escribirá a contacto@aulapro.app. Las claves escritas a mano (otro correo, packs) **siguen funcionando**, porque la API de licencias no necesita la clave. Se nota por: quejas de «he pagado y no entra».
- **Reembolsos**: dentro de los 14 días, sin preguntas. Una licencia de cuenta devuelta se quita sola al volver a comprobar. Una clave escrita a mano devuelta debe desactivarse en Lemon Squeezy.
- **Los packs son una sola clave con activaciones limitadas** (10 para el de 5 docentes, 20 para el de 10). Quien filtre la clave agota las activaciones, y **solo se arregla desde el panel de Lemon Squeezy** (subir el límite o dar otra clave). El límite de peticiones del servidor no lo impide.
- **Cobro fallido de una renovación** (Settings › Recovery, visto el 1-11-2026): Lemon Squeezy reintenta el cobro 4 veces en 2 semanas (*auto-recovery*, `past_due`); después la suscripción queda impagada (`unpaid`), salen los correos de recuperación y a los **5 días** se cancela y caduca (*Dunning*, «After 5 days cancel the subscription»; **decisión del dueño, 1-11-2026**: 19 días en total bastan para pagar; antes, 60). **La clave sigue activa hasta que la suscripción caduca** (ayuda de Lemon Squeezy, «License keys and subscriptions»), así que quien no paga sigue entrando unos 19 días desde la fecha de renovación: los 14 de reintentos, que pone Lemon Squeezy y no se cambian, y los 5 de gracia. Los correos de recuperación tienen que caber en esos 5 días (los de serie salían los días 15 y 21, ya cancelada): por ejemplo, días 0, 2, 3, 4 («FINAL NOTICE») y 5 («We're sad to see you go»), o quitar alguno. Si se apaga el *dunning*, la suscripción se queda impagada para siempre y su clave no caduca nunca.
- **Modo prueba y modo real son tiendas aparte**: el producto de prueba (1404415) y su enlace de pago no se publican nunca. Al pasar a real, el enlace cambia y se pega en `web/sitio/assets/launch.js` (`checkout` y `packs`).
- **Cobro, impuestos y pagos**: los cobros llegan a la cuenta bancaria que se dio de alta en Lemon Squeezy. Si el banco o el IBAN cambian, hay que cambiarlo allí. Los 9,90 € ya incluyen impuestos.

### Google Cloud (proyecto «AulaPro»)

- **Pantalla de consentimiento en «Prueba»**: si el proyecto está en «Prueba» y no en «En producción», los permisos duraderos **caducan a los 7 días** y solo entran los usuarios de prueba **(comprobar el estado)**. Es la causa más probable de «tengo que volver a entrar con Google cada semana».
- **Verificación de Google**: sigue pendiente (`docs/APP_WEB.md`). Si Google la pide, responde por correo al contacto de la pantalla de consentimiento; mirar esa bandeja.
- **Un permiso duradero sin usar durante 6 meses**, Google lo revoca. El docente vuelve a entrar y ya está; no se pierde nada si la copia estaba subida.
- **Cuenta de Google del dueño**: el proyecto de Google Cloud vive en ella. Verificación en dos pasos puesta y una segunda vía de recuperación.

### Microsoft Entra (registro «AulaPro»)

- El secreto caduca (apartado 2).
- **El permiso duradero caduca a los 90 días sin usar**; la app guarda siempre el último (`renovar` en `microsoft.ts`).
- **Sin editor verificado**, los centros que bloquean el consentimiento no dejan guardar en OneDrive (entrar sí). Se arregla con la verificación de editor de Microsoft (programa de socios) o con la aprobación del administrador del centro. Las cuentas personales no tienen este límite.
- **Sin comprobar con una cuenta real todavía** (`docs/APP_WEB.md`): conviene hacer una prueba completa con una cuenta personal antes de abrir ventas.

### Netlify, Cloudflare y GitHub

- **Netlify construye solo `master`** y gasta créditos en cada publicación y en cada llamada a las funciones. Mirar el uso cada mes. Si se agotan los del plan, el sitio puede pausarse y la app usa entonces el respaldo (Cloudflare Pages), pero la licencia por cuenta y el acceso a Drive dependen de las funciones del que responda. **(comprobar el plan y el uso)**
- **Los certificados HTTPS** los renueva Netlify solo; la vigilancia avisa 14 días antes de que caduquen.
- **El dominio** (Cloudflare Registrar): renovación automática el 31-8-2027. Si la tarjeta falla, avisa por correo, pero el correo de Cloudflare llega a la cuenta del dueño: que esa bandeja se mire.
- **Minutos y espacio de GitHub Actions.** El repositorio es **privado** (confirmado por el dueño el 30-10-2026), así que sus tareas consumen la cuota mensual de minutos del plan (gratuito: 2.000 minutos al mes) y sus artefactos ocupan el espacio incluido (500 MB). En octubre de 2026 los flujos de las apps nativas gastaron el 75 % de los minutos y los artefactos llegaron a unos 14 GB. **Desde el 2-11-2026**: esos flujos (`release.yml`, `store.yml`, `build-mac.yml`, `android.yml`, `android-play.yml`) ya no están en `master` (siguen en la rama `respaldo-apps-nativas-2.23.0`), la vigilancia (`web-vigilancia.yml`) corre cada hora (unas 720 veces al mes, cada una cuenta como mínimo un minuto), se retiró `web-pages.yml` la retención de artefactos y registros está en 2 días (Settings › Actions › General, puesta por el dueño) y los artefactos antiguos se borraron con un flujo de un solo uso (`borrar-artefactos.yml`, retirado después). Quedan `ci.yml`, `web.yml`, `web-vigilancia.yml` y `calendario.yml`. **Mirar el uso cada mes en Settings › Billing.** Si se agota la cuota, las tareas dejan de ejecutarse: **sin la vigilancia no hay aviso de caída y sin `web.yml` no se publican las ramas de prueba**. Un flujo nuevo que suba artefactos lleva `retention-days: 1` o 2.
- **Los avisos de la vigilancia** abren una incidencia con la etiqueta `vigilancia`; GitHub la manda al correo del dueño. Que ese correo no se filtre como spam.
- **Los contadores del límite de peticiones**: en Cloudflare KV se borran solos (20 minutos); en Netlify Blobs se purgan desde la función (`lib-netlify/limite.mjs`). Si el almacén crece sin parar, el purgado no corre: mirar el tamaño del almacén de Blobs de vez en cuando.
- **La lista de licencias bloqueadas y las aceptaciones de las condiciones** (3-11-2026): en Cloudflare KV caducan solas (400 días y seis años); en Netlify Blobs (almacenes `bloqueos-licencia` y `aceptacion-condiciones`) las borra `purgarCaducados` (`lib-netlify/vigilancia.mjs`) al arrancar la función y, de vez en cuando, después. La privacidad promete esos plazos: si el purgado deja de correr, se incumplen. Las aceptaciones son la prueba de que cada cuenta aceptó las condiciones: **no se borran a mano** (salvo que el docente ejerza su derecho de supresión y ya no haga falta probar el contrato).
- **`VERSION_CONDICIONES`** (`src/lib/condiciones.ts`): si las condiciones o la privacidad cambian de forma importante, se sube a la fecha del cambio en el mismo commit, y la app vuelve a pedir la casilla a todo el mundo. Un cambio de redacción menor no la necesita.

### Correo y DNS

- **`ventas@aulapro.app`** (1-11-2026), también Cloudflare Email Routing al mismo Gmail: packs de más de 10 docentes, devoluciones, la página de gracias y el correo de soporte de Lemon Squeezy (las respuestas de los clientes a recibos y avisos de cobro).
- **`contacto@aulapro.app`** es Cloudflare Email Routing: reenvía al Gmail del dueño. Si ese Gmail se cierra o cambia, hay que cambiar el destino. Es el contacto público de la web, de las condiciones y de los packs de más de 10 docentes.
- **DMARC**: pendiente (`docs/DNS.md`). Empezar con `p=none` y mirar quién envía como `@aulapro.app` antes de endurecerlo.
- **No borrar** el TXT `google-site-verification` ni el de verificación de Netlify.

### Modelos de Gemini

- La IA va con la clave de cada docente. La app **no paga nada** y no tiene clave propia.
- Los modelos tienen fecha de retirada. El principal es `gemini-3.8-flash`, con `gemini-3.5-flash-lite` y `gemini-3.1-flash-lite` de apoyo y `gemini-2.5-flash` y `gemini-2.0-flash` como último recurso (`src/services/gemini.ts`, `MAIN_MODEL`, `LITE_MODELS`, `LEGACY_MODELS`). **Cuando Google retire uno, la app cae al siguiente sin avisar, y cuando retire todos, la IA deja de funcionar a todo el mundo.** Cada trimestre, mirar la página de modelos y de retiradas de Google AI y actualizar las listas y sus pruebas (`gemini.models.test.ts`, `gemini.thinking.test.ts`).
- La cuota gratuita de Google AI Studio y sus límites los cambia Google. Si una versión de la cuota rompe el uso normal de un docente, se oirá por el correo de contacto.
- **Las condiciones de la API de Gemini sostienen la decisión de usar la clave gratuita del docente** (31-10-2026, `CLAUDE.md`). Cada trimestre, leer en https://ai.google.dev/gemini-api/terms las dos cláusulas del Espacio Económico Europeo: que la cuota gratuita se trata con las reglas de datos del servicio de pago, y la de «solo servicios de pago al ofrecer clientes de la API a usuarios del EEE». Si cambian, o si Google aclara que una app con la clave de cada usuario tiene que usar claves de pago, hay que avisar al dueño y cambiar la privacidad y la guía de la clave.

## 4. Datos del docente: lo que caduca en su dispositivo

Esto no es del dueño, pero explica las quejas más probables:

- **Safari (iPhone, iPad, Mac)** borra los datos de una página que no se abre en 7 días, salvo si está añadida a la pantalla de inicio. Por eso hay aviso y se recomienda la nube.
- **El almacenamiento del navegador** puede vaciarse si el equipo se queda sin espacio, o con «borrar datos de navegación». Las copias automáticas de cada 10 minutos viven en el mismo navegador: no son una copia de verdad.
- **Drive**: lo que se borra va a la papelera (30 días). Desde el 30-10-2026 cada subida **borra las versiones antiguas del archivo** (queda solo la última): ya no se puede volver atrás con el historial de Drive. La poda en Drive y OneDrive **no está comprobada con una cuenta real**: mirar en «Administrar versiones» que solo queda una.
- **Sube cada 30 minutos y al salir de la app**: con dos dispositivos, lo que uno sube tarda hasta media hora en llegar al otro.
- **La licencia comprada con la cuenta** se vuelve a comprobar cada vez que se entra (cada 10 minutos como mucho en segundo plano). Si se devuelve la compra, se quita.

## 5. Listas de comprobación

### Antes de abrir ventas (10-11-2026)

**Estado de la venta (31-10-2026): cerrada.** La web y la app no enseñan ningún botón de compra, pero **el enlace de pago de Lemon Squeezy sigue siendo válido** para quien lo tenga (estuvo publicado en el código desde el 29-10-2026 y sigue en el historial). Para que de verdad nadie pueda pagar antes de tiempo, hay que cerrarlo también en Lemon Squeezy (pasar el producto a borrador o desactivar su enlace de compra); es algo que solo se hace desde su panel. Al abrir la venta, hacer lo contrario en los tres sitios.

**Acceso anticipado gratuito (beta, desde el 5-11-2026).** La app está abierta a quien entre con su cuenta sin pagar, y la venta, cerrada sin fecha. Mientras dure: los tres productos de Lemon Squeezy (individual y packs) **en borrador**, y nada de pagos, preventas ni donaciones. El servidor lo gobierna `CONFIG_BETA` en `web/funciones/api/_beta.js` (no es una variable del panel: un cambio de variable también exige publicar, y así el cierre va en el mismo despliegue que la apertura de la venta).

**Fecha anunciada: el acceso gratuito va del 10-11-2026 al 1 de enero de 2027** (decisión del dueño, 9-11-2026; las condiciones y la privacidad dicen «previsto para enero de 2027»), y después se aplica la oferta de lanzamiento (9,90 € el primer año hasta el 15-4-2027; después, 14,99 € al año). El servidor no la hace cumplir: el 1 de enero hay que ejecutar `node scripts/abrir-venta.mjs --aplicar` y publicar. Si se acerca y la venta no puede abrirse, hay que cambiar la fecha antes de que pase, en todos los sitios donde sale y en los tres idiomas: la portada (`early.*`, `el.*` y la pregunta `a7` en `web/sitio/assets/i18n.js` e `index.html`), la app (`AvisoAccesoAnticipado.tsx`, `LicenseSettings.tsx`, `EntrarWeb.tsx` y sus traducciones de `src/i18n/web.ts`), el manual del asistente (`appHelpManual.ts`), las condiciones (apartado 3) y la privacidad (versión web, apartado 5). Las pruebas `portada-lanzamiento.test.js` y `AvisoAccesoAnticipado.test.tsx` fallan si no cuadran.

**Abrir la venta y bloquear a quien entró gratis (el día que lo decida el dueño):**

1. `node scripts/abrir-venta.mjs` (sin más, enseña qué cambiaría) y después `node scripts/abrir-venta.mjs --aplicar`. Cambia a la vez `CONFIG_BETA.abierta` a `false`, `VENTA_ABIERTA` a `true`, `ACCESO_ANTICIPADO` a `false`, y rellena `checkout`, los packs y `acceso` en `launch.js`.
2. `npm test` (la prueba `web/pruebas/interruptores.test.js` falla si los tres interruptores no cuadran) y `npx tsc -b`.
3. Los tres productos de Lemon Squeezy, **activos** (antes de fusionar o a la vez: si se fusiona antes, el botón de compra llevaría a un producto cerrado).
4. Pull request y fusión a `master`: Netlify publica. A partir de ahí, quien entró gratis queda bloqueado así: lo que vuelve a abrir su app se bloquea al contestar el servidor (segundos); lo que ya estaba abierto, en unos 15 minutos; sin conexión, cuando caduca su firma (3 días como mucho). Les sale «El acceso anticipado gratuito de AulaPro ha terminado», con el botón de suscribirse con su correo puesto. Su trabajo no se borra.
5. Comprobar con una cuenta de prueba que no es fundadora ni ha pagado: entra, se bloquea y, al pagar, vuelve a entrar. Y que un fundador sigue entrando.
6. Avisar en la web y a la lista de espera (con aprobación del dueño: es un envío externo).

- [ ] Producto de Lemon Squeezy activo de nuevo (si se cerró allí).
- [ ] `checkout` rellenado en `web/sitio/assets/launch.js` y `VENTA_ABIERTA = true` en `src/platform/cuentaWeb.ts` (los dos, a la vez), y la prueba `src/pages/LicenseGate.test.tsx` ajustada.
- [ ] `LEMONSQUEEZY_API_KEY` es de **modo real**, está en Netlify y Cloudflare, y se anotó su caducidad en la tabla.
- [ ] `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_SECRET` y `FUNDADORES` están en Netlify y Cloudflare (Production y Preview), con el mismo valor en los dos.
- [ ] Fecha de caducidad de `MICROSOFT_CLIENT_SECRET` anotada en el calendario.
- [ ] (Recomendado, auditoría del 1-11-2026) `LICENCIA_SECRETO` puesto con los pasos de «La llave de las licencias», para que cambiar algún día el secreto de Google no corte las licencias.
- [ ] KV `LIMITE` enlazado en el proyecto de Cloudflare Pages (Settings › Functions › KV namespace bindings) y el aviso de Lemon Squeezy dado de alta también en la copia de Cloudflare: sin ellos, el respaldo no tiene lista de bloqueadas ni topes (revisión del 5-11-2026).
- [ ] La vigilancia (`web-vigilancia.yml`) dice «✔ Netlify y Cloudflare firman las licencias con la misma llave».
- [ ] La vigilancia (`web-vigilancia.yml`) dice «✔ el código de la app no sale sin suscripción» para aulapro.app. Si falla, la función de borde de Netlify no ve el secreto y la app se entrega a cualquiera.
- [ ] Pantalla de consentimiento de Google en «En producción» y sin avisos de verificación pendientes.
- [ ] Prueba completa con dinero real (una compra de 9,90 € a un correo propio) y reembolso, y una cuenta de Microsoft personal entera (entrar, OneDrive, recargar).
- [ ] Los dos packs (5 y 10) creados en Lemon Squeezy con 10 y 20 activaciones, y sus enlaces en `web/sitio/assets/launch.js` (`packs`) y en `checkout`.
- [ ] Se quitaron las menciones a la «lista de espera» de `web/sitio/privacidad.html` (versión web, apartados 2 a 5) y de `aviso-legal.html` (apartado 2).
- [ ] La gestora aclaró el límite de ingresos para darse de alta como autónomo, y qué debe poner el aviso legal (incluido el NIF).
- [ ] DMARC creado en Cloudflare (`docs/DNS.md`).
- [ ] Verificación en dos pasos en Cloudflare, GitHub, Google, Microsoft, Netlify y Lemon Squeezy.
- [ ] Una incidencia `vigilancia` de prueba llega al correo.

### Cada mes

- [ ] Uso y créditos de Netlify.
- [ ] Incidencias abiertas con la etiqueta `vigilancia`.
- [ ] Minutos de GitHub Actions gastados este mes (Settings › Billing) y que la pestaña Actions no tenga tareas desactivadas.
- [ ] Ventas, reembolsos y mensajes de «he pagado y no entra» (señal del fallo de `LEMONSQUEEZY_API_KEY`).

### Cada trimestre

- [ ] Retiradas de modelos de Gemini (apartado 3).
- [ ] Las dos cláusulas del EEE en las condiciones de la API de Gemini siguen igual (apartado 3, «Modelos de Gemini»).
- [ ] Fechas de este documento al día.
- [ ] Una entrada completa con Google y con Microsoft desde un navegador sin sesión.
- [ ] Entre marzo y septiembre, que la tarea «Vigilar el calendario escolar» (`calendario.yml`, lunes y jueves) no tenga un pull request sin revisar.

### Una vez al año

- [ ] Renovar lo que caduque cada año (claves de API, token de Cloudflare).
- [ ] Dominio: tarjeta válida antes del 31-8.
- [ ] Revisar la privacidad y las condiciones contra el código (regla 1 de `CLAUDE.md`).

## 6. Si algo falla: por dónde empezar

| Síntoma | Primera sospecha | Dónde mirar |
|---|---|---|
| «He pagado y no me deja entrar» | `LEMONSQUEEZY_API_KEY` caducada o de modo de prueba | Panel de Lemon Squeezy › Settings › API y la función `/api/licencia/cuenta` |
| Hay que volver a entrar con Google cada semana | Pantalla de consentimiento en «Prueba» | Google Cloud › Google Auth Platform › Público |
| «Entrar con Microsoft» da error de repente | `MICROSOFT_CLIENT_SECRET` caducado | Entra › Certificados y secretos |
| La licencia se pide de nuevo de forma intermitente | Netlify y Cloudflare con valores distintos de `GOOGLE_CLIENT_SECRET` | Las dos variables, el mismo valor |
| La web de prueba no se actualiza | `CLOUDFLARE_API_TOKEN` caducado | Actions › `web.yml`: el aviso del registro |
| La web no abre en una zona de España durante un partido | Bloqueo a Cloudflare por LaLiga | La web ya va por Netlify sin proxy; mirar que el DNS siga en nube gris (`docs/DNS.md`) |
| La IA falla a todo el mundo | Modelo retirado por Google | `src/services/gemini.ts` |
| No llega correo a contacto@aulapro.app | Destino de Email Routing | Cloudflare › Email › Email Routing |
| La vigilancia no abre incidencias | Tarea desactivada o cuota de minutos de Actions agotada | Actions › «Vigilancia» y Settings › Billing |

## 7. Para quien revise este documento (agentes)

Este documento se revisa periódicamente y se responde al dueño con lo que haya cambiado o falte. Reglas:

- **Solo lectura.** No cambies claves, variables, cuentas ni código. Informa; el dueño decide. Si propones un cambio del propio documento, hazlo como texto o como pull request, nunca a `master` directamente.
- **No pidas ni escribas nunca un valor secreto** (claves, secretos de cliente, contraseñas, tokens, el contenido de `FUNDADORES`). Basta con el nombre, la fecha de caducidad y si está puesto o no. Si ves uno publicado en algún sitio, avisa al dueño de inmediato y sin copiarlo.
- **Contrasta con el código, no con la memoria.** Lo que dice el documento puede haberse quedado atrás.

### Qué comprobar en cada revisión

1. **Fechas.** Recorre el calendario del apartado 1. Marca las que caen en los próximos 60 días y las que ya pasaron sin hacerse (por ejemplo, un secreto con fecha vencida o «(comprobar)» sin resolver desde hace más de un mes).
2. **Que la tabla del apartado 2 coincide con el código.** Esta orden saca todos los nombres de secretos y variables que el repositorio usa; cualquiera que no esté en la tabla es un hueco del documento:

   ```bash
   { grep -rhoE 'secrets\.[A-Z_0-9]+' .github | sed 's/secrets\.//'
     grep -rhoE "env\.(get\(')?[A-Z][A-Z_0-9]{3,}" web --include=*.js --include=*.mjs | sed -E "s/env\.(get\(')?//"
   } | sort -u
   ```

   Conocidos y que no son secretos: `LIMITE` (almacén de contadores de Cloudflare KV, no una clave) y `VIGILAR_BASE` y `VIGILAR_ESPERA_MS` (opciones de la vigilancia). Al 30-10-2026 la salida es exactamente la tabla más esas tres.
3. **Servicios nuevos.** Busca dependencias externas añadidas desde la última revisión (nuevas direcciones en `connect-src` de `netlify.toml`, nuevos flujos en `.github/workflows/`, nuevas funciones en `web/funciones/api/`). Si hay una cuenta o un servicio que no está en este documento, propón dónde anotarlo.
4. **Copias de las funciones.** `web/funciones/` y `web/netlify/` deben decir lo mismo (CLAUDE.md y `docs/APP_WEB.md`): si una cambia y la otra no, un servidor se comporta distinto del otro.
5. **Estado de la vigilancia.** Incidencias con la etiqueta `vigilancia` abiertas o recientes, y que las tareas programadas de GitHub sigan activas y con minutos disponibles (apartado 3).
6. **Modelos de Gemini.** Compara los de `src/services/gemini.ts` con la lista de modelos y de retiradas que publique Google, y avisa de cualquiera retirado o con fecha de retirada. Lee además las cláusulas del Espacio Económico Europeo de https://ai.google.dev/gemini-api/terms (uso de datos de la cuota gratuita y «solo servicios de pago» para clientes de la API) y avisa si han cambiado: la clave gratuita del docente depende de ellas.
7. **Lo marcado «(comprobar)».** Dilo claramente si no puedes verlo desde donde estás: no lo des por bueno.

### Qué contestar

Una lista corta, por urgencia, con este formato para cada punto:

- **Qué:** una frase.
- **Dónde:** archivo y apartado de este documento, o el panel al que hay que ir.
- **Cuándo:** fecha límite, o «ya».
- **Qué haría falta:** la acción concreta para el dueño.

Cierra con una línea que diga lo que **has podido comprobar** y lo que **no**. Si no hay nada nuevo, dilo en una línea: no hace falta repetir el documento.
