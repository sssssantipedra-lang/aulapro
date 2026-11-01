# Auditoría de AulaPro (1-11-2026)

Revisión pedida por el dueño a nueve días de abrir la venta (10-11-2026): seguridad del servidor y de las licencias, fugas de datos hacia la IA, pérdida o corrupción del trabajo del docente, textos de la clave de la IA y textos legales. Se leyó el código de cada pieza citada (no solo la documentación), se comprobó cada riesgo contra el código real y se corrigió lo que tenía arreglo seguro antes del lanzamiento. Las líneas citadas son las del código **antes** de la auditoría (`master` del 1-11-2026); el arreglo está en el mismo archivo salvo que se diga otra cosa.

**Límites de esta revisión.** No es asesoramiento jurídico: los textos legales los redactó Claude a partir del código y conviene que los revise un abogado (`docs/REVISAR.md`, apartado 5). Ningún texto deja una posición «blindada al 100 %»: una cláusula que excluye una responsabilidad que la ley no permite excluir (dolo, culpa grave, derechos de los consumidores) es nula, y por eso las nuevas lo dicen. Desde la sesión no se pudo abrir aulapro.app ni la página de condiciones de Google (la red lo impide), y no hubo dispositivos reales: lo nuevo está probado con pruebas automáticas y, el cerrojo de pestañas, en Chromium.

## Resumen

| Severidad | Hallazgo | Estado |
|---|---|---|
| CRÍTICO | C1. Un fallo al leer los datos abría el cuaderno vacío y lo guardaba encima de los buenos, también en Drive u OneDrive, sin versiones a las que volver | Corregido |
| CRÍTICO | C2. Dos pestañas (o la app instalada y una pestaña) se borraban el trabajo la una a la otra | Corregido |
| ALTO | A1. Si el navegador no podía guardar (sin espacio), no se avisaba | Corregido |
| ALTO | A2. Una actualización podía dejar las pantallas sin abrir sin conexión, en el aula | Corregido |
| ALTO | A3. Nombres del alumnado escritos sin tildes, en mayúsculas o en el nombre de un archivo llegaban a la IA | Corregido |
| ALTO | A4. «Cargar desde archivo» sustituía todo sin confirmación ni copia previa; restaurar podía ser pisado por el guardado | Corregido |
| ALTO | A5. Los documentos dejaban pasar teléfonos fijos, DNI con puntos, nombres en la línea siguiente a su etiqueta y tratamientos como «Dra.» | Corregido |
| MEDIO | M1. La llave de las licencias dependía del secreto de Google: cambiarlo cortaba la app hasta un día | Corregido (hay que activarlo, ver abajo) |
| MEDIO | M2. `/api/google/*` aceptaba cualquier origen y no tenía límite de peticiones | Corregido |
| MEDIO | M3. La puerta de aulapro.app (Netlify) no se comprobaba nunca tras publicar | Corregido (vigilancia) |
| MEDIO | M4. Una clave compartida se puede usar en más de 2 dispositivos sin activarla | **Pendiente de tu decisión** |
| MEDIO | M5. Faltaban en los textos legales la base legal y el plazo de los datos de compra, el papel de cada uno ante el RGPD y unas condiciones de uso | Corregido |
| MEDIO | M6. La privacidad decía que el diagnóstico no va a la IA, pero sí van categorías como «TEA» o «TDAH» | Texto corregido |
| MEDIO | M7. Ley de IA de la UE y «Evaluar por foto» | Para el abogado |
| BAJO | B1 a B7. Erratas, orden de los límites, CSP, secretos en el navegador y detalles informativos | Corregido o explicado |

Pruebas: antes, 211 archivos y 1.957 pruebas; después, 215 y 2.000, todas en verde. También `tsc -b`, `eslint`, `web/comprobar.mjs` y `npm run build:web` (13 bloques públicos y 106 con sesión, como antes).

## CRÍTICO

### C1. Un fallo al leer los datos borraba el cuaderno, también en la nube

- **Dónde:** `src/platform/profileStore.ts:58` (`readJson` se tragaba cualquier error y devolvía `{}`) y `:81` (`loadData` lo usaba); `src/hooks/useAppState.ts:225` (abría el perfil con lo que llegara); `src/platform/webFs.ts:26` (la conexión de IndexedDB, una vez perdida, no se volvía a abrir); `src/platform/profileStore.ts:144` (las copias automáticas no distinguían un perfil vacío); `src/platform/driveFs.ts:133` y `src/platform/oneDriveFs.ts:86` (cada subida borraba todas las versiones menos la última).
- **Qué podía pasar:** Safari corta a veces la conexión con IndexedDB con la app en segundo plano. Desde ahí, cada lectura fallaba; `datos.json` se leía como vacío, la app abría el cuaderno vacío y, a los 0,7 s, el guardado automático lo escribía encima del bueno. La copia a la nube lo subía y borraba las versiones antiguas, y las copias automáticas (12, cada 10 minutos) se iban sustituyendo por copias vacías en dos horas. Resultado: el cuaderno perdido en el navegador, en las copias y en Drive u OneDrive, sin vuelta atrás.
- **Arreglo:** `loadData` y `listProfiles` lanzan `DatosIlegibles` (solo «no hay archivo» es un perfil vacío) y la app enseña `components/DatosIlegibles.tsx` sin abrir nada ni guardar (volver a intentarlo, o restaurar la última copia si el archivo está dañado). `webFs.ts` olvida la conexión cerrada y repite la operación una vez con otra. `lib/contenidoPerfil.ts` sabe si un perfil está vacío: las copias automáticas no copian uno vacío y `espejo.ts` no sube un perfil vacío encima de uno con datos ni carga uno vacío de la nube encima del de aquí (pregunta, con un aviso propio). En Drive y OneDrive se conservan las tres últimas versiones (`VERSIONES_GUARDADAS`). Pruebas en `profileStore.test.ts`, `espejo.test.ts` y `nube.test.ts`.

### C2. Dos pestañas se borraban el trabajo

- **Dónde:** no había ninguna coordinación entre pestañas (ni `BroadcastChannel`, ni Web Locks, ni el evento `storage` en `src/`).
- **Qué podía pasar:** cada pestaña guarda su copia entera del curso. Con AulaPro abierta dos veces (la app instalada y una pestaña, o un marcador abierto dos veces), una hora de notas en la segunda desaparecía en cuanto se tocaba cualquier cosa en la primera, y se subía así a la nube. Sin aviso.
- **Arreglo:** `src/platform/unaPestana.ts` (Web Locks, en todos los navegadores actuales): la segunda pestaña enseña «AulaPro ya está abierta en otra pestaña o ventana» con «Usar AulaPro aquí»; la que pierde la app deja de guardar al instante (`lib/guardadoBloqueado.ts`, `espejo.detener`) y lo dice. Probado en Chromium de punta a punta (segunda pestaña bloqueada, «Usar aquí», aviso en la primera, recarga sin aviso). **Falta probarlo** con la app instalada en iPhone, iPad y Android.

## ALTO

### A1. El guardado fallaba en silencio

- **Dónde:** `src/hooks/useGuardadoAutomatico.ts:66` y `:80` (el error de `guardar` no se capturaba).
- **Qué podía pasar:** con el almacenamiento lleno (fotos, iPhone con poco espacio), nada se guardaba y el docente seguía trabajando sin saberlo.
- **Arreglo:** se captura, `components/AvisoSinGuardar.tsx` lo dice (con el motivo si es falta de espacio) y ofrece «Descargar una copia» con todo lo que hay en pantalla; se reintenta cada 30 s. Pruebas en `useGuardadoAutomatico.test.tsx`.

### A2. Una actualización podía dejar las pantallas sin abrir sin conexión

- **Dónde:** `web/app/sw.js:47` y `:101`: sin sesión (cookie caducada tras días sin abrir) la instalación de una versión nueva se daba por buena sin el código de las pantallas, y al activarse borraba la versión anterior, que sí lo tenía.
- **Qué podía pasar:** el docente abre la app en el aula sin wifi, se pone la versión nueva y el cuaderno, las fichas o la evaluación no cargan.
- **Arreglo:** cada versión entera deja una marca (`./.privado-guardado`); una versión nueva no se instala a medias si la anterior estaba entera: espera a que la app renueve la sesión. Prueba nueva: `web/pruebas/sw.test.js`.

### A3. Nombres que se escapaban del enmascarado

- **Dónde:** `src/services/privacy.ts:93` y `:95` (se buscaban exactamente como en la lista: «Lucia» no tapaba a «Lucía», ni «LUCÍA», ni «Lucía» y «Pérez» en dos líneas, ni `Informe_Lucia_Perez.pdf`); `src/services/learningSituations.ts:645` y `:737` (el nombre del archivo adjunto iba en el texto a la IA).
- **Arreglo:** cada letra admite su variante con o sin tilde, eñe o ce trencada; el nombre de pila también en mayúsculas; entre palabras, espacio, salto de línea, guion o guion bajo. «rosa» en minúscula sigue sin confundirse con «Rosa». El nombre del archivo ya no se manda. Pruebas en `privacy.test.ts`. **Lo que sigue sin poder taparse solo** (y ahora lo dicen la pantalla de la clave, la privacidad y las condiciones): un apodo o un familiar que no esté en la lista del alumnado.

### A4. Cargar o restaurar una copia sin red

- **Dónde:** `src/hooks/useAppState.ts:891` y `src/pages/Profile.tsx:183` (cargar un archivo sustituía todo el trabajo, sin confirmación, sin copia previa y sin comprobar la forma: un archivo raro rompía la app al abrirse); `src/components/DataFolder.tsx:48` y `src/platform/profileStore.ts:158` (restaurar no guardaba antes lo de ahora, y el guardado automático podía escribir lo de memoria encima de la copia restaurada antes de recargar).
- **Arreglo:** `lib/copiaDeDatos.ts` valida la copia (y rechaza una vacía), la pantalla pide confirmación y se guarda antes una copia «antes-de-cargar»; restaurar guarda antes «antes-de-restaurar», pide confirmación y bloquea el guardado hasta recargar. Esas copias van también a Drive u OneDrive. Pruebas en `copiaDeDatos.test.ts` y `profileStore.test.ts`.

### A5. Datos de contacto que pasaban en los documentos

- **Dónde:** `src/lib/documentoParaIA.ts:191` (teléfonos fijos escritos «96 123 45 67» o con 0034), `:193` (DNI «12.345.678-Z», NIE «X-1234567-L»), `:146` (la etiqueta sola en su línea y el nombre debajo, como sale de las tablas de un PDF), `:115` (tratamientos en mayúsculas, sin punto, «Dr.», «Dra.», «Mr.», «Mrs.»).
- **Arreglo:** los cuatro casos, sin tocar cantidades, notas ni fechas corrientes. Pruebas en `documentoParaIA.test.ts`.

## MEDIO

### M1. La llave de las licencias y el secreto de Google

- **Dónde:** `web/funciones/api/_firma.js:14` y `web/funciones/api/_sesion.js:20`: la llave que firma las licencias y la de la sesión salían de `GOOGLE_CLIENT_SECRET`.
- **Riesgo:** si un día hay que cambiar el secreto de Google (filtración, o porque Google lo pide), las sesiones de todos dejan de valer a la vez y la app no carga sus pantallas hasta que cada navegador renueve la licencia (hasta un día); los fundadores tendrían que volver a entrar. Además, una filtración del secreto de Google permitiría fabricar licencias.
- **Arreglo:** `web/funciones/api/_secretos.js`. Si existe `LICENCIA_SECRETO`, se firma con él; con `LICENCIA_SECRETO_ANTERIOR` se aceptan durante un cambio las firmas y sesiones de la llave de antes. **Sin tocar nada, todo sigue igual que hoy.** Para activarlo sin cortar a nadie: pasos en `docs/MANTENIMIENTO.md`, «La llave de las licencias» (recomendado antes del 10-11). Pruebas en `web/pruebas/secretos.test.js`.

### M2. Las funciones de Google, abiertas

- **Dónde:** `web/funciones/api/google/_comun.js:12` (`Access-Control-Allow-Origin: *`), `web/funciones/api/google/[accion].js:6` y `web/netlify/google.mjs:5` (sin límite de peticiones).
- **Riesgo:** cualquiera podía llamarlas sin parar: gasto de invocaciones de Netlify (que se pagan con créditos) y de la cuota del cliente de Google. No exponían el secreto (las respuestas de error no lo llevan).
- **Arreglo:** CORS solo para los orígenes de AulaPro (`corsPara`) y tope por IP (250 cada 10 minutos, como Microsoft).

### M3. La puerta de aulapro.app no se vigilaba

- **Dónde:** `web/app/comprobar-publicada.mjs:53` solo se lanza contra la copia de Cloudflare al publicar; en Netlify la puerta es otra pieza (`web/netlify-edge/puerta.js:14`, que no corre en direcciones terminadas en `.css`, `.png`…), y `docs/APP_WEB.md` la daba como «sin comprobar». Si la función de borde no ve el secreto, deja pasar a todo el mundo sin avisar.
- **Arreglo:** `web/vigilar.mjs` comprueba cada 30 minutos en aulapro.app que el código de las pantallas no sale sin sesión, también con variantes terminadas en `.css` o `.png`, y abre una incidencia si sale. La comprobación de publicación cuenta ahora como fallo cualquier respuesta que sea código, salga con el tipo que salga.

### M4. Claves compartidas en más de 2 dispositivos (pendiente)

- **Dónde:** `web/funciones/api/licencia/[accion].js:61` (`conFirma` firma también un `validate` sin número de activación) y `src/platform/androidLicense.ts:171` (la licencia de la cuenta se renueva así, sin activación).
- **Riesgo:** quien tenga una clave ajena y sepa programar puede pedir esa firma, conseguir la sesión y usar la app en más dispositivos de los que permite la clave, sin activarla. Es pérdida de ingresos, no un riesgo para los datos de nadie.
- **Por qué no se ha cambiado:** cerrarlo obliga a que la licencia de la cuenta se renueve siempre con el token de Google o Microsoft. Hecho a días de abrir la venta, podría dejar fuera a compradores legítimos que entraron sin dar permiso de Drive. Propuesta: cerrarlo después del lanzamiento, con pruebas en dispositivos (`docs/REVISAR.md`, apartado 1, punto 6).

### M5. Textos legales incompletos

- **Dónde:** `web/sitio/privacidad.html` (la compra no tenía base legal ni plazo de conservación, que exige el artículo 13 del RGPD; el papel de cada uno ante el RGPD no se decía con esas palabras; `:115`, «En los dos casos» con cuatro opciones) y `web/sitio/condiciones.html` (solo eran de venta; `:71`, un párrafo de datos dentro de «Garantía»).
- **Arreglo, en castellano, catalán e inglés:** el titular no es responsable ni encargado de los datos del alumnado (lo es el centro o, por su cuenta, el docente) y solo lo es de los de la cuenta, la licencia y la compra; no hacen falta nombres reales (alias, iniciales o códigos); la IA es opcional, con la clave del docente, directa a Google y solo propone; la obligación de mantener la copia fuera del navegador; base legal y plazo de los datos de compra, con Lemon Squeezy como vendedor registrado. La página pasa a ser «Condiciones de venta y de uso», con tres apartados nuevos (datos y alumnado, inteligencia artificial, servicios de terceros y disponibilidad) y una limitación de responsabilidad que respeta lo que la ley no deja excluir. La pantalla de entrada de la web dice que al entrar se aceptan las condiciones y la privacidad (así obligan también a los fundadores, que no compran).

### M6. Las categorías de PT y AL

- **Dónde:** `src/services/apoyoIA.ts:76`: a la IA van las necesidades específicas de apoyo educativo marcadas, como «Trastorno del espectro del autismo (TEA)» o «TDAH», con el nombre cambiado por un código. El campo «Diagnóstico» no va (correcto).
- **Arreglo:** la privacidad lo dice ahora tal cual (la categoría puede dejar ver una discapacidad o un trastorno). Que vayan o no es decisión de producto: la IA las necesita para proponer objetivos.

### M7. Ley de IA de la UE (para el abogado)

«Evaluar por foto» propone notas. La IA que evalúa resultados de aprendizaje está en la lista de alto riesgo; si se defiende que no lo es porque solo prepara una evaluación que decide el docente (artículo 6.3), la ley pide documentarlo y registrar el sistema (artículos 6.4 y 49.2). El artículo 50 (marcar lo que genera una IA) puede afectar a fichas y documentos. Los textos ya dicen que la IA solo propone y decide el docente; qué más obliga y desde cuándo, con el abogado (`docs/REVISAR.md`, apartado 5).

## BAJO

- **B1. Textos de la clave de la IA** (`src/components/ApiKeySettings.tsx:82`, la errata «,.» del paso 2; `:183`, la frase del escudo; `src/i18n/core.ts:2006` y `src/i18n/ca.ts:68`, la frase antigua «Solo se envían tal cual los archivos que adjuntes tú», que seguía en los diccionarios). Corregido en los tres idiomas: documentos y fotos también se limpian en el dispositivo, un apodo o un familiar no se puede tapar solo, y desde el EEE las condiciones de la API de Gemini aplican a la clave gratuita las reglas de la de pago (no usa lo enviado para entrenar sus modelos ni mejorar sus productos). La página oficial de Google no se pudo abrir desde la sesión: se ha mantenido el sentido de la cláusula que ya tenías verificada.
- **B2. Límites de peticiones** (`web/funciones/api/licencia/[accion].js:44` y su copia de Netlify): con la IP ya frenada, cada clave inventada creaba un contador nuevo (coste de KV y Blobs). Ahora se cuenta primero la IP. Y `licencia/cuenta` tiene además un tope por cuenta (150 cada 10 minutos, por encima del sondeo de 6 s de la pantalla de compra).
- **B3. CSP** (`web/sitio/_headers:30` y `netlify.toml:25`): `script-src` sin `'unsafe-inline'` ni `'unsafe-eval'`, así que un texto malicioso (un nombre de alumno, un archivo compartido, una respuesta de la IA) no puede ejecutar código. `style-src 'unsafe-inline'` hace falta para React y su riesgo es bajo. `img-src` y `frame-src` admiten cualquier https por la pizarra. Además se comprobó que todo el HTML que se pinta sin React escapa el texto (`seatingLayout.ts`, `tablaCompetencias.ts`, `exportInstrumento.ts`, `pizarraEF.ts`, `geometryFigures.ts`). Sin cambios.
- **B4. Secretos en el navegador:** la clave de Gemini va en IndexedDB sin cifrar (en la web no hay otra forma; la privacidad lo dice) y los permisos de Google y Microsoft, en IndexedDB y `sessionStorage`. No salen en ningún registro (no hay `console.*` en `src/` ni en las funciones), ni en direcciones (la clave va en la cabecera `x-goog-api-key`), ni en «Descargar mis datos», ni en el archivo de «Trabajo compartido». Una extensión del navegador con permiso sobre aulapro.app podría leerlos, como cualquier dato de la página. Sin cambios.
- **B5. Microsoft** (`web/funciones/api/_microsoft.js:106`) devuelve el primer renglón del error de Microsoft para poder diagnosticar; no lleva el secreto ni el código. Sin cambios.
- **B6. Detalles informativos:** `licencia/cuenta` usa el servicio `tokeninfo` de Google (válido, aunque Google lo recomienda para depurar); solo mira la primera página de pedidos de un correo; un pedido con devolución parcial (`partial_refund`) deja de contar como pagado.
- **B7. Escritorio:** `electron/storage.cjs` conserva el comportamiento antiguo de leer un perfil vacío si falla. Ya no se distribuye; solo importa si se vuelve a las apps nativas.

## Lo que se revisó y está bien

- Un solo camino hacia Gemini (`callGemini`); el enmascarado cubre la instrucción, la pregunta y el historial; los códigos cambian en cada petición, con dígito de control; un código inventado por la IA no se convierte en nadie.
- Los documentos del alumnado nunca salen como archivo; las fotos se rehacen en un lienzo (sin GPS ni datos del móvil, `lib/fotos.ts:50`) y «Tapa el nombre» obliga a tapar o a marcar que no hay nombre.
- El diagnóstico de PT y AL no va a la IA (`apoyoIA.ts`, `alumnoParaIA`).
- Entrar con Google y Microsoft: `state` en la vuelta, PKCE con Microsoft, direcciones de vuelta en lista cerrada (sin redirección abierta), y el token de Microsoft se comprueba de verdad (firma, destinatario, emisor del inquilino, caducidad y dominio verificado).
- La lista `FUNDADORES` no se puede tantear: hace falta un token válido de esa cuenta.
- La IP de los límites la pone el alojamiento (`CF-Connecting-IP`, `context.ip`): no se falsifica con `X-Forwarded-For`.
- «Trabajo compartido»: PBKDF2-SHA256 de 600.000 vueltas, AES-256-GCM con la cabecera autenticada y tope de vueltas para no colgar la app.

## Lo que queda en tus manos

1. Decidir M4 (claves compartidas) para después del lanzamiento.
2. Activar `LICENCIA_SECRETO` con los pasos de `docs/MANTENIMIENTO.md` (recomendado antes del 10-11).
3. Tras pasar esto a `master`, mirar que la vigilancia dice «✔ el código de la app no sale sin suscripción».
4. Probar en dispositivos reales el cerrojo de pestañas y el aviso de guardado (`docs/REVISAR.md`, apartado 4).
5. Llevar al abogado los textos nuevos y la Ley de IA (`docs/REVISAR.md`, apartado 5), y confirmar en la página vigente de Google la cláusula del EEE.
