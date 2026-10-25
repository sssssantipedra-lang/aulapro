# Trabajo compartido: el archivo cifrado

Desde la 2.20.0 (25-10-2026), «Trabajo compartido» no conecta dos equipos. Es **un archivo cifrado con contraseña** que un docente crea y otro abre. Este documento recoge cómo funciona, por qué se cambió y lo que queda.

## Por qué se quitó la conexión por QR y código

Decisión del dueño (25-10-2026), después de una revisión del código y de pruebas suyas (conectar escribiendo el código funcionó; escaneando el QR, no). Lo que fallaba era de fondo, no un detalle:

- La conexión dependía del servicio público y gratuito de PeerJS y de un STUN de Google, sin servidor de relevo (TURN): en una wifi de centro con cortafuegos o aislamiento de clientes, fallaba. No tenía tiempo límite ni reconexión; el que se caía (pantalla bloqueada en Android) no podía volver con el mismo código.
- No había aceptación: lo que llegaba se mezclaba al instante, borrados incluidos. Quien solo quería recibir acababa enviando lo que había recibido y, además, **toda su biblioteca de rúbricas**.
- Cada cambio reenviaba el paquete entero, sin fecha por registro: ante una edición simultánea ganaba el último que llegaba.
- El canal por la wifi del centro iba por HTTP sin cifrar, y el servicio de encuentro veía las direcciones IP: la pantalla y la privacidad prometían más de lo que había.
- No existía una prueba de extremo a extremo con dos equipos.

Se estudió rehacerlo (ofertas con aceptación, relevo gratuito de Cloudflare, envío por archivo como última salida). Se descartó por el coste de dejarlo bien y de mantenerlo: servidores, pruebas con varias redes y mucho código que sostener. El archivo cifrado cubre el caso real (pasar clases a un compañero) sin nada de eso.

## Cómo funciona

Pantalla: `src/pages/Share.tsx` (menú «Trabajo compartido», `Section` `share`). Sin conexión entre equipos ni servidor.

**Quien envía**

1. Marca las clases y qué comparte: cuaderno de notas, rúbricas y dianas, evaluaciones. El alumnado de las clases va siempre. Ve los recuentos de lo que irá en el archivo.
2. Tiene una contraseña aleatoria propuesta (`ABCD-EFGH-JKMN-PQRS`, 16 símbolos de un alfabeto de 31 sin los que se confunden, unos 79 bits) que puede copiar, cambiar o sustituir por una propia de al menos 10 caracteres.
3. «Crear archivo cifrado» guarda `aulapro-compartido-AAAA-MM-DD.json` como una copia de seguridad (Documentos › AulaPro › Copias de seguridad en Android; diálogo de guardar en el ordenador).
4. Manda el archivo por el medio que quiera y la contraseña **por otro**.

**Quien recibe**

1. «Elegir el archivo recibido», escribe la contraseña y pulsa «Abrir».
2. Ve de quién es, cuándo se creó, los nombres de las clases y los recuentos. **Todavía no ha entrado nada.**
3. Elige cómo mezclar y pulsa «Importar»:
   - «Conservar lo mío»: entra lo que no tiene; si algo ya existe, se queda como estaba.
   - «Actualizar con esto»: entra lo que no tiene; si algo ya existe, se sustituye por lo que llega.
4. **Nunca se borra nada** de lo que ya tenía. Las clases y los alumnos tienen dueño (`owner`): el dueño manda sobre lo suyo en cualquier modo.

Una copia de seguridad normal («Descargar mis datos» en Mi Perfil) es otra cosa: todo el perfil, sin cifrar. Si alguien intenta cargar en Mi Perfil un archivo de Trabajo compartido, la app le dice que se abre en «Trabajo compartido».

## El cifrado (`src/services/copiaCifrada.ts`)

- **Clave:** PBKDF2-SHA256, 600.000 vueltas, sal aleatoria de 16 bytes, a partir de la contraseña. Web Crypto, sin librerías.
- **Datos:** AES-256-GCM con un vector de inicio aleatorio de 12 bytes. GCM autentica: una contraseña equivocada o un archivo tocado fallan sin dar datos a medias. Los parámetros de la cabecera van como datos asociados: cambiarlos también hace fallar el descifrado.
- **El archivo** es un JSON con una cabecera en claro (`_app: "AulaPro"`, `_tipo: "compartido"`, `_cifrada: true`, `v`, `kdf`, `iter`, `alg`, `sal`, `iv`) y los datos cifrados en `datos` (base64). Dentro, cifrado: `{ de, creado, paquete }`. En claro no hay ni nombres ni clases.
- **Límites de seguridad al abrir:** se rechazan versiones más nuevas, cabeceras con menos de 100.000 o más de 3.000.000 de vueltas (un archivo hecho para colgar la app) y tamaños de sal o vector erróneos.
- **La contraseña** no se guarda ni se envía a ninguna parte. Si se pierde, el archivo no se puede recuperar. Una generada se acepta con minúsculas, sin guiones o con espacios (se dicta por teléfono); una escrita a mano se usa tal cual.
- La extensión es `.json` y no una propia a propósito: en Android, MediaStore puede añadir una extensión según el tipo de archivo, y `.json` funciona igual en todas partes.

### Lo que NO se puede garantizar: «que solo la app lo lea»

Pidió el dueño que, si era posible, solo la app pudiera leerlo. **No es posible de verdad.** Una clave metida dentro de la app se saca abriendo la app; esconder el formato no es seguridad. Lo que se garantiza es lo que sí se puede: sin la contraseña, el archivo no se puede leer, ni siquiera con él en la mano. Quien tenga el archivo **y** la contraseña podría leerlo con otra herramienta, porque el formato es público (esta página). La pantalla lo dice. La seguridad depende de una buena contraseña comunicada por un medio distinto al del archivo.

## Qué viaja

`buildBundle` en `src/services/paquete.ts`: las clases elegidas y su alumnado; con las casillas, categorías, columnas y notas del cuaderno; las rúbricas y dianas **que se usan en esas clases** (la principal o una de las otras clases en las que se comparte; las que no tienen clase asignada no salen nunca) y las evaluaciones de esas clases. Nunca el perfil ni la clave de la IA.

## Código

| Qué | Dónde |
|---|---|
| Pantalla | `src/pages/Share.tsx` (y su prueba, `Share.test.tsx`, que recorre el flujo entero: crear, abrir con la contraseña buena y con una mala, importar) |
| Cifrado | `src/services/copiaCifrada.ts` |
| Qué entra en el paquete y cómo se mezcla | `src/services/paquete.ts` |
| Importar en los datos del perfil | `importarPaquete` en `src/hooks/useAppState.ts` (apunta una línea en el registro de cambios: «Importó datos de otro docente») |
| Textos en inglés y catalán | `src/i18n/compartir.ts` |

## Lo que se quitó

`src/hooks/useP2PSync.ts`, `useLanSync.ts`, `src/services/p2p.ts`, `lan.ts`, `electron/syncserver.cjs` (y su puente en `main.cjs` y `preload.cjs`), el canal local nativo de Android (`lanStart`, `lanStop` y `lanRespond` en `AulaNativePlugin.java`, `createLan` en `android.ts`), el lector de QR (`QRScanner`) y la dependencia `jsqr`, la dependencia `peerjs`, el enlace `aulapro://` del `AndroidManifest.xml`, el permiso `CAMERA` (y su `uses-feature`) y las lápidas de borrado (`tombstones`) y el alcance guardado (`shareScope`) de los datos del perfil. Los perfiles ya guardados con esos dos campos siguen abriéndose: el campo sobrante se ignora.

`SessionQR` (el QR de «Actividades con móviles») se queda; está ahora en `src/components/live/`.

## Pendiente

- **La demo y las capturas de la web** (`web/sitio/assets/demo/compartido.webp`, `ef-compartido.webp` y sus zonas pulsables en `demo-pantallas.js`) enseñan la pantalla antigua, con el QR. Hay que volver a ejecutar `scripts/web/capturar.mjs` (ver `web/DISENO.md`, sección 46).
- El diccionario de textos conserva las frases de la pantalla antigua (`src/i18n/core.ts` y `ca.ts`, bloque «Trabajo compartido»); varias se comparten con otras pantallas, así que hay que retirarlas una a una.
- Los campos `owner` y `owner_name` de clases y alumnos se siguen usando al importar; el dueño manda sobre lo suyo.
- Sin comprobar en un dispositivo real: guardar y abrir el archivo en Android (MediaStore, selector de archivos) y el tiempo de cifrado en un móvil lento (600.000 vueltas; en un ordenador, menos de un segundo).
- Posible mejora: un aviso de que la contraseña es débil si es escrita a mano, y cifrar también las copias de seguridad normales.
