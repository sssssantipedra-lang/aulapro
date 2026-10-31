# Cómo funciona AulaPro (31-10-2026)

Explicación completa de la aplicación: qué piezas tiene, dónde vive cada dato, qué sale hacia fuera y cómo se publica. Está pensada para el dueño, para quien revise el proyecto y para cualquier sesión que trabaje en él. El detalle de cada parte sigue en su documento (`docs/APP_WEB.md`, `docs/PTAL.md`, `docs/FICHAS.md`…) y las decisiones, en `CLAUDE.md`.

## 1. Qué es

AulaPro es una aplicación para docentes de Primaria y Secundaria con el currículo LOMLOE:

- clases y alumnado
- cuaderno de notas y asistencia
- evaluación con rúbricas, dianas, escalas y fotos
- informes, actas, situaciones de aprendizaje y fichas
- pizarra de aula
- herramientas de Educación Física, y de Pedagogía Terapéutica y Audición y Lenguaje

**Desde el 29-10-2026 es una aplicación web**, en https://aulapro.app/app/. Se usa desde el navegador en cualquier ordenador, tableta o móvil, y se puede instalar como una app (PWA). Las versiones de Windows, Mac y Android siguen en el código (`electron/`, `android/`), pero ya no se publican.

La idea central es que **el trabajo del docente vive en su dispositivo**. AulaPro no tiene una base de datos con los datos del profesorado ni del alumnado. Si el docente quiere, hay una copia en su propio Google Drive, su OneDrive o una carpeta de su ordenador.

## 2. Las piezas

```
  Navegador del docente (aulapro.app/app/)
  ├─ La app (React + TypeScript, compilada con Vite)
  ├─ Service worker (web/app/sw.js): la app entera guardada para funcionar sin conexión
  └─ IndexedDB «aulapro»: perfiles, datos y ajustes
        │
        ├──► Google / Microsoft ......... entrar con la cuenta (y el permiso para su Drive u OneDrive)
        ├──► Drive / OneDrive del docente  copia de su trabajo (cada 30 minutos y al salir)
        ├──► Gemini (Google) ............ la IA, con la clave del docente
        └──► Funciones de AulaPro ....... licencia y tokens de Google y Microsoft (no ven el trabajo)
                ├─ Netlify (principal, sirve aulapro.app)
                └─ Cloudflare Pages (respaldo, aulapro-app.pages.dev; y la copia de pruebas)
                        └──► Lemon Squeezy: compras y claves de licencia
```

- **Netlify** sirve la web y la app desde el 29-10-2026. Los operadores españoles bloquean direcciones de Cloudflare durante los partidos de LaLiga, y con Cloudflare la web caía.
- **Cloudflare** lleva el DNS (sin proxy) y una copia de respaldo.
- La app pide la licencia primero a su propio sitio y, si no responde en 6 segundos, al otro (`src/platform/servidores.ts`).

## 3. Cómo arranca

1. **El navegador carga `/app/`.** Si el service worker ya está instalado, la app sale del dispositivo sin pedir nada a internet.
2. **La primera vez**, el service worker guarda primero lo imprescindible para abrir (código, estilos, fuentes: unos 9 MB). Ya funcionando, guarda los dibujos, los pictogramas y el lector de PDF (otros 9 MB y algo más). Así, si el móvil corta la descarga, la app ya abre sin conexión.
3. **El puente de plataforma** (`src/platform/web.ts`) monta en `window.electronAPI` el mismo contrato que tenían las apps de Windows y Android. El resto del código no necesita saber en qué plataforma está. Ofrece:
   - **`store`**: los perfiles y los datos, en IndexedDB (`idbFs` en `src/platform/webFs.ts`), con la misma estructura de archivos que el escritorio (`perfiles.json`, `perfiles/<id>/datos.json`, `perfiles/<id>/copias/`).
   - **`docs`**: los PDF, con el diálogo de imprimir del navegador («Guardar como PDF»).
   - **`license`**: la licencia (apartado 4).
   - **`secrets`**: la clave de la IA, en el navegador.
   - **`update`**: una versión nueva se descarga en segundo plano y se pone al abrir la app la vez siguiente, sin avisos.
4. **`src/main.tsx` monta la app** (`src/App.tsx`). Todo el estado del perfil abierto está en `src/hooks/useAppState.ts`.

## 4. Entrar y la licencia

**Entrar** (`src/pages/EntrarWeb.tsx`, `src/platform/cuentaWeb.ts`):

- **Con Google**, en una sola ventana se pide la identidad y el permiso `drive.file` (solo los archivos que crea AulaPro). En Safari, en lugar de ventana, se va a la página de Google y se vuelve (`googleDrive.ts`).
- **Con Microsoft**, siempre por redirección, con PKCE (`microsoft.ts`).
- Las funciones `/api/google/*` y `/api/microsoft/*` cambian el código por tokens con el secreto de cliente y no ven nada más.
- La app guarda en el dispositivo el nombre y el correo de la cuenta.

**La licencia:**

- **Comprada con el correo de la cuenta.** La app manda el token de identidad a `/api/licencia/cuenta`. La función comprueba con Google o Microsoft que el token es auténtico, busca en Lemon Squeezy un pedido pagado con ese correo y devuelve su clave **firmada** (Ed25519, `web/funciones/api/_firma.js`; la llave sale del secreto `GOOGLE_CLIENT_SECRET`). Vale en todos los dispositivos de esa cuenta, sin límite. El correo no se guarda en el servidor.
- **Fundadores.** Si el correo está en la variable secreta `FUNDADORES`, entra gratis para siempre.
- **Clave escrita a mano** (otro correo o un pack). Se activa en Lemon Squeezy a través de `/api/licencia/activate`. Vale en 2 navegadores; un pack, en 2 por docente.
- **La firma.** La app solo da por buena una licencia con firma válida (`src/platform/firmaLicencia.ts`). No es imposible saltársela cambiando el código, pero ya no basta con escribir un registro a mano en el navegador.
- **Revisión periódica.** Con conexión, la licencia se vuelve a comprobar una vez por semana, para enterarse de una devolución.
- **Pantalla de licencia** (`src/pages/LicenseGate.tsx`). Sale si no hay licencia. Con la venta cerrada (`VENTA_ABIERTA = false`, hasta el 10-11) no enseña ningún botón de compra. Con la venta abierta, el botón lleva a Lemon Squeezy con el correo ya puesto y la app se activa sola cuando el pago se confirma.
- **Límite de peticiones.** Las funciones de la licencia lo tienen (`_limite.js`) y solo aceptan peticiones del navegador desde los orígenes de AulaPro (`_origenes.js`).

## 5. Los datos

**Perfiles.** Un mismo navegador puede tener varios perfiles (varios docentes). Cada uno tiene su tipo de docente (de aula, Educación Física, PT o AL), su comunidad autónoma y sus datos, separados.

**Qué guarda un perfil** (`src/types/index.ts`):
- clases, alumnado y sus avisos
- categorías y columnas del cuaderno, notas y asistencia
- rúbricas, dianas, escalas y evaluaciones
- informes y actas
- situaciones de aprendizaje, sesiones y fichas
- agenda y horario, distribución del aula
- reuniones y formaciones
- Educación Física (exentos, pruebas, material, pizarras de circuitos)
- el módulo de apoyo (alumnado de PT y AL, programas, registro de sesiones, documentos)

**Guardado automático** (`src/hooks/useGuardadoAutomatico.ts`):
- Cada cambio se escribe en IndexedDB tras una pausa de 700 ms.
- Se escribe al instante al cerrar u ocultar la página y al cambiar de perfil.
- Para no reescribir lo mismo, recuerda una huella SHA-256 de lo último guardado, no una copia.

**Copias de seguridad.** Copias con fecha dentro del propio almacenamiento, y «Descargar mis datos» / «Cargar» para llevar todo a otro sitio. El formato es el mismo que el de las apps de escritorio y Android.

**La copia fuera del navegador** (`src/platform/espejo.ts`):
- En una **carpeta del ordenador** (Chrome y Edge de escritorio): se copia 4 segundos después de cada cambio. Si es la carpeta de OneDrive o de Google Drive del ordenador, su programa la sube a la nube.
- En el **Drive** o el **OneDrive** del docente (`driveFs.ts`, `oneDriveFs.ts`): se sube cada 30 minutos y al salir, con al menos 5 minutos entre subidas, y se borran las versiones antiguas del archivo.
- **Entre dispositivos.** Al abrir, y cada 30 segundos con la app a la vista, mira si la nube tiene algo más nuevo de otro dispositivo.
  - Si aquí no hay nada sin copiar, lo carga.
  - Si llega algo con la app abierta, deja de guardar para no pisarlo y recarga en cuanto el docente no está escribiendo.
  - Si los dos dispositivos cambiaron, pregunta con cuál quedarse.
  - Nunca pisa el trabajo de otro dispositivo sin preguntar.

**Avisos para no perder el trabajo.** La app recuerda dónde está guardado y ofrece «Guardar en mi nube» o «Elegir una carpeta» (`components/CarpetaWeb.tsx`, `DondeGuardar.tsx`). Sin copia fuera, borrar los datos del navegador borra el trabajo.

**Borradores** (`src/services/borradores.ts`, `useBorrador`). Lo que se genera y no se ha guardado (una ficha, una SdA, una rúbrica, una corrección por foto) se conserva 30 días en `localStorage`. Al volver, se ofrece «Continuar».

## 6. Las pantallas

El menú va por tareas (`src/lib/navigation.ts`):

- **Tu día a día**: Inicio («Tu jornada»), Mis clases, Agenda, Cuaderno, Asistencia.
- **Evaluar**: portada, Rúbricas, Dianas, Escalas de registro, Por foto, Diana competencial, Autoevaluaciones, Historial.
- **Documentos**: portada, Informes, Actas, Situaciones de aprendizaje, Sesiones, Recursos (fichas, comprensión lectora, escape room, tarjetas).
- **En clase**: portada con la clase que toca, Anotar actitud, Distribución de aula, Pizarra y herramientas, Actividades con móviles (esta no funciona en la versión web).
- **Educación Física**, solo en su perfil: En la pista, Equipos, Cronómetro de circuitos, Exentos y lesiones, Pruebas físicas, Actividades, Sesiones, Situaciones de aprendizaje, Pizarra de circuitos, Material e instalaciones.
- **PT y AL**, con su propio menú: Mi alumnado, con la página de cada alumno (ficha, informe del orientador, programas y objetivos, registro de sesiones, coordinaciones, documentos del trimestre y adaptación de la programación).
- **Centro y equipo**: Reuniones, Formaciones, Trabajo compartido.
- **Abajo**: Configuración y Registro de cambios.

Reglas de cálculo que comparten todas las pantallas:

- **Medias del cuaderno**, siempre con `src/lib/ponderacion.ts`. Cada categoría tiene su peso en la nota final y cada nota puede tener su peso dentro de la categoría.
- **Orden del alumnado**, siempre el de lista (`src/lib/alumnado.ts`).
- **Competencias.** Cada criterio de una rúbrica o ítem de una diana puede llevar los criterios oficiales que evalúa. Al evaluar, la nota se apunta en ellos, y de ahí salen las notas por competencia específica y clave (`src/lib/curriculum/evaluacionPorCriterios.ts`). La nota que manda en el cuaderno sigue siendo la del cuaderno.

**Currículo.** Va dentro de la app: el estatal (RD 157/2022 y RD 217/2022) y el propio de la Comunitat Valenciana, Cataluña y Madrid, en Primaria y ESO, copiado de los PDF oficiales (`docs/COMUNIDADES.md`). Se carga cuando lo pide la primera pantalla que lo usa. El calendario escolar de las tres comunidades viene en `calendario-escolar.json`.

## 7. La IA

**Clave.** Hoy la IA usa la clave de Google del propio docente (Gemini), guardada en su navegador. Sin clave, la app funciona entera menos lo que redacta la IA. La decisión sobre una clave central está pendiente (`docs/REVISAR.md`, punto 1).

**Un único punto de salida.** Todas las peticiones (más de 60 en la app) pasan por `callGemini` (`src/services/gemini.ts`). Cada pantalla prepara su prompt, a menudo con un esquema JSON de lo que tiene que devolver, y `callGemini` hace siempre lo mismo:

1. **Quita los nombres.** Cambia cada nombre del alumnado (de las clases y de PT y AL) por un código (`src/services/privacy.ts`):
   - Los códigos son **nuevos y al azar en cada petición**, de cinco cifras con un **dígito de control de Damm**: «[ALU-48213]».
   - Dentro de una petición y su historial, un alumno conserva su código. De una petición a otra cambia, así que no se puede juntar lo de un mismo alumno.
   - Un nombre de pila que comparten varios alumnos («Ana») lleva su propio código.
   - **Quita los correos** de todo lo que envía.
2. **Añade la instrucción de privacidad** (escribir los códigos tal cual y con lenguaje neutro) y la del idioma de salida (castellano, catalán o inglés).
3. **Elige el modelo.** Las tareas pesadas (razonamiento alto o salidas largas) empiezan por `gemini-3.8-flash`; las ligeras, por los Flash-Lite. Si uno falla o se queda sin cupo, pasa al siguiente.
4. **Pide la respuesta por partes.** Si en 30 segundos no llega nada, prueba con otro modelo.
5. **Repara la respuesta.** Arregla letras mal codificadas y, si una respuesta larga en castellano o catalán viene sin ninguna tilde, la pide otra vez.
6. **Devuelve los nombres.** Al volver, cambia los códigos de **esa petición** por los nombres reales. Un código que la IA copie mal o se invente no pasa el dígito de control y no se convierte en ningún alumno.

**Qué se prepara antes de llamar a la IA:**

- **Textos libres sobre el alumnado** (avisos, anotaciones, observaciones, notas de PT y AL, notas de reuniones): se les quitan teléfonos, DNI, fechas de nacimiento y números de expediente (`quitarDatosDeContacto`).
- **Documentos del alumnado** (informe del orientador, programación del tutor, un trabajo adjunto a una rúbrica o al asistente): nunca salen como archivo.
  - Un PDF (con `pdfjs-dist`), un Word o un texto se leen en el navegador (`src/lib/documentoParaIA.ts`).
  - Se les quita lo que identifica (`quitarIdentificadores`).
  - En el informe y la programación, el docente ve el texto antes de enviarlo y puede quitar lo que sobre.
  - Un PDF escaneado no se envía: se pide pegar el texto.
- **Fotos del trabajo de un alumno** («Evaluar por foto», rúbricas, asistente): pasan por «Tapa el nombre» (`components/TaparNombre.tsx`). Lo tapado se pinta de negro en la imagen en el dispositivo, y sin tapar o marcar que no hay nombre no se envía. Las fotos salen reducidas y sin ubicación.
- **El diagnóstico de PT y AL**: no se envía nunca.
- **La nota de «Evaluar por foto»**: la IA propone los puntos de cada pregunta, pero la nota la calcula el código y la revisa el docente.

**El código corrige a la IA.** En fichas, situaciones de aprendizaje, informes y documentos, lo que la IA no puede hacer bien lo hace el código:

- cuentas, recuentos y soluciones
- dibujos de fracciones
- criterios oficiales, que salen de listas cerradas
- valoraciones de competencias calculadas de las notas

Además, la propia IA revisa las fichas como lo haría un docente (`docs/FICHAS.md`).

## 8. Documentos, PDF y Word

- **PDF.** Cada documento se monta en HTML con su `@page` (tamaño y márgenes) y se imprime con el diálogo del navegador. La vista previa (`DocPreview`) lo pinta hoja a hoja tal como saldrá (`src/lib/paginaDoc.ts`, `src/lib/paginacion.ts`).
- **Fichas.** El compositor mide la hoja como se imprime y elige la densidad que ocupa menos páginas, sin tocar nunca el tamaño de la letra (`src/services/compositor.ts`).
- **Word.** Se genera con la librería `docx` en el propio navegador.

## 9. Trabajo compartido

Se comparte con un **archivo cifrado con contraseña** (AES-256-GCM, con la clave sacada de la contraseña con PBKDF2-SHA256 de 600.000 vueltas; `src/services/copiaCifrada.ts`):

- Quien envía elige qué clases, contenido, situaciones de aprendizaje y fichas van en el archivo.
- Quien recibe ve qué trae y elige «Conservar lo mío» o «Actualizar con esto». Nunca se borra nada de lo que ya tenía.
- No hay conexión entre equipos ni servidor.
- La seguridad está en la contraseña, que se pasa por otro medio (`docs/COMPARTIR.md`).

## 10. Seguridad de la página

- **Content-Security-Policy** en `/app/`, en `web/sitio/_headers` y en `netlify.toml` (los dos iguales). Solo admite código de la app y del inicio de sesión de Google, y conexiones a la propia web y sus copias, Google (Drive y Gemini) y Microsoft (OneDrive). Un servicio nuevo que llame la app hay que añadirlo a `connect-src`.
- **Funciones.** Solo aceptan peticiones del navegador desde los orígenes de AulaPro y tienen un límite de peticiones. Los contadores guardan una huella, no la IP ni la clave.
- **Ni analítica, ni anuncios, ni informes de errores.** Todo lo que sale de la app está en `web/sitio/privacidad.html`, en los tres idiomas. La regla 1 de `CLAUDE.md` obliga a cambiar la privacidad y las condiciones en el mismo cambio que cambie cómo se tratan los datos.

## 11. El servidor: funciones y secretos

Las funciones están en `web/funciones/api/` (formato de Cloudflare) y su copia en `web/netlify/` (formato de Netlify). Si cambia una, cambia la otra.

| Función | Qué hace | Secretos |
|---|---|---|
| `/api/licencia/cuenta` | Busca la compra de un correo verificado, o si es fundador | `LEMONSQUEEZY_API_KEY`, `FUNDADORES`, `GOOGLE_CLIENT_SECRET` (firma) |
| `/api/licencia/activate`, `validate`, `deactivate` | Clave escrita a mano, contra Lemon Squeezy | `GOOGLE_CLIENT_SECRET` (firma) |
| `/api/licencia/clave` | La llave pública para comprobar las firmas | `GOOGLE_CLIENT_SECRET` |
| `/api/google/token`, `renovar` | Tokens de Google para Drive | `GOOGLE_CLIENT_SECRET` |
| `/api/microsoft/token`, `renovar` | Tokens de Microsoft para OneDrive | `MICROSOFT_CLIENT_SECRET` |

**Dónde están los secretos.** Viven en Netlify y en Cloudflare, con el mismo valor en los dos. Qué caduca y qué se rompe si falla está en `docs/MANTENIMIENTO.md`. Un cambio de variable solo se aplica al volver a publicar.

## 12. Cómo se publica

- **Ramas.** Se trabaja en una rama.
  - Un push o el flujo `web.yml` lanzado a mano publica la rama en la copia de pruebas, https://prueba.aulapro-app.pages.dev (Cloudflare Pages).
  - Cuando el dueño da el visto bueno, se fusiona en `master`.
  - **Netlify solo construye `master`** y sirve aulapro.app.
- **Construir** (`netlify.toml` y `web.yml`):
  1. `npm run build:web` compila la app en `dist-web` y escribe el service worker con la lista de archivos.
  2. `web/idiomas.mjs` genera las portadas en catalán e inglés (`/ca`, `/en`) a partir de `index.html` y `assets/i18n.js`.
  3. `web/comprobar.mjs` impide publicar una copia rota: páginas, enlaces, idiomas, tamaños.
  4. `web/versionar.mjs` pone la huella de cada archivo de `assets/` (`?v=…`) para que los navegadores no usen versiones viejas.
  5. La app se copia en `web/sitio/app`.
- **Otra copia** se publica en GitHub Pages (`web-pages.yml`).
- **Vigilancia.** `web-vigilancia.yml` vigila cada 30 minutos las portadas, los certificados y el calendario, y abre una incidencia si algo falla.
- **Calendario escolar.** `calendario.yml` busca el de cada curso nuevo en los boletines y propone un cambio para revisar.

## 13. Pruebas y calidad

- **Pruebas automáticas.** Unas 1.930, en más de 200 archivos (`vitest`): lógica de notas y competencias, privacidad (lo que sale hacia Google se mira en el cuerpo real de la petición), licencia y firmas, copia a la nube y conflictos, pantallas con `@testing-library`, y que cada texto de la interfaz esté en catalán e inglés.
- **Comprobaciones en cada cambio** (`.github/workflows/ci.yml`): tipos (`tsc`), lint (`eslint`), pruebas y compilación. Si una falla, llega el aviso «Comprobaciones» por correo.
- **Sin comprobar en dispositivos reales.** Lo que no se ha podido probar en un móvil o una tableta de verdad está anotado en `docs/REVISAR.md`, punto 4.

## 14. Textos e idiomas

- **Tres idiomas.** La interfaz está en castellano, catalán e inglés (`src/i18n/`). El texto en castellano es la clave: lo que no está traducido se ve en castellano, nunca una clave rota.
- **Datos de ejemplo** en el idioma de la app, sin nombres de personas: «Profesor», «Alumno 1».
- **Reglas de escritura** (regla 5 de `CLAUDE.md`): tratamiento de tú con vocabulario formal, «docentes» y «profesorado» (nunca «profes») y sin rayas largas.

## 15. Dónde mirar

| Para… | Mira |
|---|---|
| Decisiones y reglas | `CLAUDE.md` |
| Lo pendiente | `docs/REVISAR.md` |
| Versión web, datos, licencia, nube | `docs/APP_WEB.md` |
| Secretos, fechas, listas de comprobación | `docs/MANTENIMIENTO.md` |
| Lo que la web promete | `docs/WEB.md` y `web/sitio/privacidad.html` |
| Fichas | `docs/FICHAS.md` |
| Currículo y calendario | `docs/COMUNIDADES.md` |
| PT y AL | `docs/PTAL.md` |
| Educación Física | `docs/EF.md` |
| Evaluar por foto | `docs/EVALUAR_FOTO.md` |
| Pizarra | `docs/PIZARRA.md` |
| Trabajo compartido | `docs/COMPARTIR.md` |
| DNS y dominio | `docs/DNS.md` |
