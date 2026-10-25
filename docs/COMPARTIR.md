# Trabajo compartido: cómo funciona, qué falla y cómo dejarlo bien

Revisión del 25-10-2026, hecha leyendo el código. Lo único probado con equipos reales es lo que contó el dueño: **conectar escribiendo el código funcionó; conectar escaneando el QR no** (el QR llevaba la dirección del canal local, ver el apartado 3, punto 5, ya corregido en la 2.19.2). Nada de lo que sigue se ha reproducido con dos equipos en un laboratorio.

Petición del dueño (25-10-2026): que un P2P funcione de verdad, que un docente escanee el QR del otro y se conecten, y que **elijan quién recibe de quién y qué información recibe cada uno**. Decisión del dueño: si no funciona bien, se quita (apartado 8).

## 1. Cómo funciona hoy

### Archivos

| Qué | Dónde |
|---|---|
| Pantalla | `src/pages/Share.tsx` (QR, código, estado, qué se comparte) |
| Conexión por código (internet) | `src/services/p2p.ts` (clase `PeerLink`, sobre PeerJS) y `src/hooks/useP2PSync.ts` |
| Canal local (misma wifi) | `src/services/lan.ts`, `src/hooks/useLanSync.ts`, `electron/syncserver.cjs` (escritorio) y el puente nativo de Android (`createLan` en `src/platform/android.ts`) |
| Qué viaja y cómo se mezcla | `src/services/sync.ts` (`buildBundle`, `mergeBundle`, lápidas) y `applyBundle` en `src/hooks/useAppState.ts` |
| QR | `src/components/share/SessionQR.tsx` (dibuja) y `QRScanner.tsx` (lee con `jsqr`) |
| Enlace `aulapro://c/CODIGO` | `src/lib/shareNav.ts`, `src/main.tsx` (`appUrlOpen`), filtro de intención en `AndroidManifest.xml` |

### Dos canales a la vez

Al pulsar «Crear código y QR», el anfitrión abre los dos canales:

1. **Por código (PeerJS, internet).** Reserva en el servicio público de PeerJS (`0.peerjs.com`) el identificador `aulapro-v1-` + 6 caracteres. El invitado se conecta a ese identificador y, cuando se dan la mano, los datos van directos entre los dos equipos por WebRTC (cifrado). Solo hay un STUN de Google (el de PeerJS por defecto): **no hay servidor de relevo (TURN)**.
2. **Canal local (sin internet).** El anfitrión abre un servidor HTTP en su equipo (puerto 8100 o el siguiente libre) con otro código distinto. El invitado lo lee y le escribe por HTTP cada 1,5 s. Va **sin cifrar**.

### Qué viaja

Un paquete (`SharedBundle`) con las clases elegidas, su alumnado, y, según las casillas, el cuaderno (categorías, columnas y notas), las rúbricas y dianas y las evaluaciones, más las lápidas (ids borrados). Nunca el perfil ni la clave de la IA.

Al conectar, cada lado manda su paquete entero (`snapshot`) y se mezclan por id sin pisar lo propio (`reconcile`). Después, cada cambio local reenvía el paquete entero (`patch`, con 400 ms de espera) y el otro lo aplica dando prioridad al que llega (`live`). Las clases y los alumnos tienen dueño (`owner`): el dueño manda sobre lo suyo. Un borrado se propaga siempre (lápidas).

## 2. Qué se arregló en la 2.19.2

El QR llevaba solo `http://ip:puerto/share?c=…` cuando había canal local. Ahora lleva `aulapro://c/CODIGO?lan=ip:puerto:codigo`: el invitado prueba primero la red local (3 s como máximo) y, si no responde, sigue por el código. Solo se da por conectado cuando el anfitrión contesta. La cámara del sistema en Android abre la app con el código puesto. Código: `shareUrl` y `lanFromShareUrl` en `p2p.ts`, `join` en `useLanSync.ts`, `onDetected` en `Share.tsx`.

## 3. Lo que sigue mal planteado

**Conexión**

1. Depende del servicio público y gratuito de PeerJS, sin garantía ni control, y de un STUN. Sin relevo, falla en redes con cortafuegos o NAT estrictos, que son las de los centros.
2. `PeerLink.join` no tiene tiempo límite ni mira el estado de la conexión (ICE): si el canal no se abre, el invitado se queda en «Conectando…» sin ningún error.
3. El anfitrión no admite reconexión. `link.conn` no se pone a `null` al cerrarse la conexión, así que un invitado que se cae (pantalla bloqueada en Android) no puede volver a entrar con el mismo código, y la pantalla sigue enseñando un código muerto con «Esperando a que se una…».
4. El canal local, antes de la 2.19.2, daba «Conectado» sin comprobar nada.
5. Eran dos sesiones distintas (el QR llevaba la local y el texto era el código de PeerJS). Ya corregido.
6. El canal local reenvía el paquete entero cada 1,5 s aunque no haya cambios, y el anfitrión lo aplica y apunta una línea en el registro de cambios cada vez (salvo que el registro deduplique; no se ha comprobado). Con más de 2 MB (`MAX_BODY` en `syncserver.cjs`) el servidor corta la petición y falla en silencio.
7. Entra el primero que llegue con el código; no hay confirmación en ninguna de las dos pantallas.

**Modelo de datos**

8. **No hay aceptación.** Lo que llega se mezcla en tus datos al instante, borrados incluidos. Quien recibe no puede ver, elegir ni rechazar nada. Es lo contrario de lo que pide el dueño.
9. **Recibir acaba en enviar.** `applyBundle` añade las clases recibidas al `shareScope` de quien recibe (`useAppState.ts`, hacia la línea 871), así que se las devuelve al otro. «Mandar» y «recibir» solo existen en la pantalla, no en el protocolo.
10. **Fuga de rúbricas.** `buildBundle` manda todas las rúbricas y dianas del docente, no solo las de las clases elegidas (`sync.ts`, líneas 93 y 94), y `shareScope.rubrics` está activado por defecto. Quien solo quería recibir acaba mandando toda su biblioteca de rúbricas.
11. Cada cambio reenvía el paquete entero y no hay fecha de modificación por registro: ante una edición simultánea, gana el último que llega aunque su copia sea vieja.
12. `justAppliedRef` es un booleano que descarta el siguiente envío: si editas en los 400 ms posteriores a recibir algo, tu edición no se manda hasta el cambio siguiente (`useP2PSync.ts`, hacia la línea 104).
13. `applyBundle` fusiona contra el estado del último render; dos mensajes seguidos pueden pisarse. Probable, no comprobado.
14. El registro de cambios apunta «Recibió un cambio de otro docente» con recuentos, a nombre de quien recibe. No dice qué cambió ni quién lo hizo (la web decía que sí; corregido el 25-10-2026).

**Textos de la app que no coinciden (pendientes, son código)**

15. `Share.tsx` dice que los datos viajan «directos y cifrados» y que «por ese servicio no pasan los datos», pero el canal local no va cifrado, y el servicio de encuentro ve las direcciones IP. También «Los cambios de los dos se ven al momento».
16. La misma pantalla dice «Hacen falta internet en los dos equipos»; el canal local no lo necesita.

## 4. Diseño para que funcione de verdad

### Lo que ve el docente

1. Uno enseña su QR y el otro lo escanea (o escribe el código). Los dos ven «Conectar con X» y el mismo número de 4 cifras para confirmar que es la persona correcta. Hasta que los dos aceptan, no viaja nada.
2. Cada lado tiene «Enviar a X»: elige clases y qué contenido (alumnado, notas, rúbricas, evaluaciones).
3. El otro recibe una **oferta** que solo lleva recuentos y nombres de clase («X te quiere enviar 2 clases, 48 alumnos y 120 notas»). Puede aceptar todo, parte o nada, y elegir cómo fusionar: añadir como nuevo, actualizar lo existente o conservar lo mío.
4. «Mantener al día» es un interruptor opcional por clase y por sentido. Así se decide quién recibe de quién, y lo que no se acepta no entra.

### Protocolo y datos

- Mensajes con versión: `hello`, `offer`, `accept`, `chunk`, `ack`, `done`, `bye`. Trozos de menos de 64 KB y barra de progreso.
- `updatedAt` por registro y por celda de nota, para fusionar por fecha y no por «gana el remoto». Las lápidas también llevan fecha.
- La oferta solo incluye las clases elegidas y lo que cuelga de ellas (rúbricas incluidas). Recibir no activa el envío.
- «Conectado» solo cuando llega el `hello` del otro lado, con latido periódico, tiempos límite y reconexión con el mismo código.
- El mismo protocolo sirve para el **envío por archivo** (una oferta guardada que se manda por WhatsApp, correo o Drive y se abre en el otro equipo): es la última salida cuando ninguna red deja conectar.

### Cadena de intentos

1. Conexión directa (STUN).
2. Relevo (TURN).
3. Canal local por la wifi del centro, con la comprobación real y un mensaje claro si la red aísla los equipos («prueba con la zona wifi de un móvil»).
4. Envío por archivo.

La wifi de un centro puede tener aislamiento de clientes, redes separadas o un cortafuegos que bloquee el servidor local; una zona wifi del móvil de un docente sortea todo eso sin internet. Windows pide permiso de cortafuegos la primera vez que se abre el servidor y en un equipo del centro sin administrador puede no poder darse.

## 5. Infraestructura gratuita

Investigado el 25-10-2026 con búsquedas; **no se ha podido leer la documentación oficial de Cloudflare**, así que hay que confirmar los puntos marcados antes de montarlo.

| Pieza | Opción | Estado |
|---|---|---|
| STUN | Cloudflare (gratis e ilimitado) o el de Google | Confirmado por fuentes |
| TURN (relevo) | Cloudflare Realtime TURN: 1.000 GB al mes gratis, luego 0,05 $/GB | Confirmado por fuentes. Sin confirmar: si pide tarjeta al activarlo y el tiempo máximo de validez de las credenciales (una fuente dice 48 h) |
| Señalización | Un Worker de Cloudflare con un Durable Object: capa gratuita de 100.000 peticiones al día | Cifras de la capa gratuita sin confirmar del todo |
| Credenciales del TURN | Las genera un Worker pequeño que guarda la clave de Cloudflare como secreto y entrega credenciales de corta duración | Obligatorio: la clave no puede ir dentro de la app |

Riesgos: alguien podría pedir credenciales al Worker y usar tu cuota de relevo; se mitiga con caducidad corta, límite por IP y exigiendo un identificador de sesión válido. El relevo solo ve bytes cifrados, pero **la privacidad dejaría de ser «sin servidores»**: el encuentro lo haría un servicio propio en Cloudflare (la web de privacidad ya cuenta hoy lo del servicio de PeerJS).

Descartado: el TURN gratuito de Metered (Open Relay), por cifras contradictorias sobre su límite; un coturn propio, porque necesita un servidor de pago.

Otra vía sin servidor: intercambiar la señalización con dos QR (uno en cada sentido). Funciona entre equipos que se ven en la red local, pero no entre redes distintas, y en WebView de Android el cifrado de direcciones locales (mDNS) lo complica.

## 6. Pruebas

Hoy solo se prueban las funciones auxiliares (`p2p.test.ts`, `lan.test.ts`, `sync.test.ts`). Falta una prueba de extremo a extremo: dos navegadores de Playwright y un PeerServer local que cubran conexión, oferta y aceptación, corte y reconexión, y edición simultánea. Sin esa prueba, no se puede decir que funciona.

## 7. Plan por fases

1. **Sin decisiones pendientes:** tiempo límite y estado de ICE en `join`, reconexión del anfitrión, «Conectado» solo con `hello`, cortar el envío de todas las rúbricas, no reenviar lo recibido ni el paquete del canal local si no cambió, y corregir los textos del apartado 3.
2. **Flujo de oferta y aceptación** con «mantener al día» opcional (cambio grande en `sync.ts`, los hooks y `Share.tsx`).
3. **Infraestructura gratuita** (Worker de señalización y TURN de Cloudflare) y la privacidad al día.
4. **Prueba de extremo a extremo** y prueba con docentes en un centro real.

## 8. Si se quita

Decisión del dueño: si tras la fase 1 y una prueba real no funciona, se quita. Habría que retirar:

- Código: `src/pages/Share.tsx`, `src/hooks/useP2PSync.ts`, `src/hooks/useLanSync.ts`, `src/services/p2p.ts`, `lan.ts`, `sync.ts` (y sus pruebas), `src/components/share/`, `src/lib/shareNav.ts`, la entrada de menú y de navegación, `applyBundle`, las lápidas (`tombstones`) y los dueños (`owner`) si solo se usan para esto, `electron/syncserver.cjs` y su puente en `preload.cjs` y `main.cjs`, el puente de Android (`createLan` y el plugin nativo), el filtro `aulapro://` del `AndroidManifest.xml`, el `appUrlOpen` de `main.tsx` y la dependencia `peerjs`.
- Textos: el manual de la ayuda (`appHelpManual.ts`) y las traducciones.
- Documentos: `docs/WEB.md` (apartado 3, punto 10), la privacidad (apartado 4 de la app, en los tres idiomas), `web/sitio/index.html` y `assets/i18n.js` (la viñeta de privacidad y la pregunta sobre compartir), la ficha de las tiendas (`docs/TIENDAS.md`: la declaración de la dirección IP y el cifrado en tránsito) y este archivo.
