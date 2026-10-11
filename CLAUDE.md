# AulaPro · memoria del proyecto

Esta memoria la leen todas las sesiones de Claude que trabajan en AulaPro, tanto en la app como en la web. Mantenla al día: si una decisión cambia, cámbiala aquí en el mismo cambio.

AulaPro es una app para docentes de Educación Primaria y Secundaria (currículo LOMLOE) para Windows y Mac (Electron) y Android (Capacitor). Se vende para Windows y Android; Mac queda para más adelante, cuando se pueda pagar la firma de Apple (decisión del 2-10-2026: una app sin firmar genera desconfianza al instalarla). Este repositorio contiene la app y su web, https://aulapro.app.

## Mapa

- `src/`, `electron/`, `android/`: la app.
- `web/sitio/`: la web publicada en aulapro.app. HTML, CSS y JavaScript sin compilar, sin frameworks ni dependencias.
- `web/DISENO.md`: decisiones de diseño y de contenido de la web, ronda a ronda.
- `docs/WEB.md`: contexto compartido entre la app y la web: modelo de venta, lo que la web promete y la app tiene que cumplir, descargas y Lemon Squeezy.
- `docs/DESCARGAS.md`: el servidor de descargas (descargas.aulapro.app).
- `docs/COMUNIDADES.md`: el currículo y el calendario de cada comunidad autónoma (Comunitat Valenciana, Cataluña y Madrid primero). Desde la 2.0.0 la app lleva el currículo de las tres, en Primaria y ESO; el resto de comunidades usan el estatal (RD 157/2022 y RD 217/2022). El calendario escolar de las tres está en la Agenda desde el 11-10-2026 (`web/sitio/calendario-escolar.json`).
- `docs/PTAL.md`: el módulo de Pedagogía Terapéutica y Audición y Lenguaje: decisiones, normativa de inclusión de cada comunidad, autores de referencia y lo que falta.
- `docs/EF.md`: el perfil de Educación Física (con tutoría o sin ella): decisiones, herramientas y lo que falta.
- `docs/Normativa Comunitat Valenciana/`, `docs/Normativa Comunidad de Madrid/` y `docs/Normativa Cataluña/`: los PDF oficiales de los que se copia el currículo de cada comunidad, y en su carpeta `Inclusión`, la normativa y los modelos de inclusión (los valencianos y el catalán los sube el dueño; los de Madrid salen del BOCM). `scripts/curriculo/`: cómo se extrae.
- Logo oficial: `public/favicon.svg` (con "AULAPRO" debajo) y `public/favicon-mini.svg` (sin texto, para tamaños pequeños). `npm run icons` saca de ahí los iconos de la app. La web usa el pequeño: copia en `web/sitio/assets/icono.svg` y dibujado dentro de cada página (marca de la cabecera). Si cambia el logo, cambia también la web.

## Memoria (revisión del 6-10-2026)

Para que la app gaste poco sin cambiar lo que hace, no se cargan al abrirla:

- El currículo estatal (`src/lib/curriculum/index.ts`, unos 650 KB de JSON) se abre con la primera pantalla que lo usa. Lo que se importa al arrancar (bienvenida, perfil, barra lateral) no puede depender de `index.ts` ni de `cargar.ts`: para saber qué etapas tienen decreto propio está `propios.ts`.
- El manual de la ayuda (`src/services/appHelpManual.ts`) se pide al abrir el panel; PeerJS, al conectar en «Trabajo compartido»; `electron-updater`, solo en el instalador de Windows.
- Las ventanas emergentes (`.modal-overlay`) llevan el desenfoque solo mientras están abiertas: cerradas siguen montadas, y con él la tarjeta gráfica reservaba unos 30 MB.
- El guardado automático recuerda una huella SHA-256 de lo guardado, no una copia del curso.

## Aspecto de la app (revisión del 11-10-2026)

- Estilo cálido elegido por el dueño: fondo crema (`--surface`), tarjetas blancas y menú lateral claro (`--nav-*` en `src/index.css`). En modo oscuro el menú toma el color oscuro del tema (`--sb-bg`). La bienvenida y la pantalla de licencia siguen oscuras.
- Cada entrada del menú lleva su icono en un cuadradito de color (`COLOR` en `Sidebar.tsx`), siempre con el nombre al lado.
- Menú sin grupos plegables ni «Más»: Tu día a día, Trabajo docente, Centro y equipo; abajo y sin color, Configuración y Registro de cambios (`src/lib/navigation.ts`). Los créditos y la versión están al pie de Configuración.
- Mis clases, con varias clases, se abre en una portada de tarjetas agrupadas en Primaria, ESO y otras (`src/components/clases/ClassCards.tsx`, agrupación en `src/lib/etapas.ts`): alumnos, avisos y media de cada clase. Documentos se abre siempre en su portada de cuatro tarjetas (`src/pages/DocumentosInicio.tsx`). El aviso de la clave de la IA (`AiKeyNotice`) es una franja fina.
- Evaluar se abre siempre en su portada («Resumen», `src/pages/EvaluarInicio.tsx`): dos tarjetas grandes, «Evaluar por rúbricas» y «Evaluar por dianas», y el carrusel «Cómo va cada clase» (nota media de cada rúbrica por clase, `src/lib/rendimiento.ts`). Rúbricas y Dianas son pestañas separadas del apartado.
- Datos de ejemplo del docente de aula (`src/lib/demoData.ts`): 1º a 4º de ESO con Matemáticas y 1º a 6º de Primaria con un área distinta cada uno; cuaderno 40% pruebas, 40% tareas y 20% trabajo diario y actitud; evaluaciones con competencias clave y criterios oficiales de la Comunitat Valenciana.
- El bloque «Trabajo diario y actitud» se muestra y se edita en % de la nota final, como las categorías (40 + 40 + 20 = 100). Se sigue guardando en puntos sobre 10 (`MarksBlockConfig.points`, 20% = 2): la cuenta no cambia y los cuadernos de antes (categorías al 100% y bloque aparte) no avisan.
- Se rediseña por fases, con capturas para el dueño en cada una. Hechas: fase 1 (menú y estilo), fase 2 (Evaluar), fase 3 (selector de clase y Cuaderno) y fase 4 (Mis clases y Documentos). Con más de 6 clases, el selector de clase (`ClassChips`, el mismo en Cuaderno, Asistencia, Informes, Actas…) es un desplegable agrupado en Primaria, ESO y otras, con flechas para pasar de clase.

## Publicar

- La app: Actions, "Publicar versión" (`release.yml`). Sube los instaladores a https://descargas.aulapro.app.
- La web: se publica sola cuando llega a `master` un cambio en `web/sitio/` (`web.yml`, Cloudflare Pages, proyecto `aulapro-app`). Necesita el secreto `CLOUDFLARE_API_TOKEN`. Antes de publicar, `web/versionar.mjs` añade a cada ruta de `assets/` la huella de su contenido (`?v=…`), porque los navegadores guardan esos archivos 4 horas; en el repositorio las rutas van sin huella.
- El calendario escolar: `web/sitio/calendario-escolar.json`, que se publica con la web y la app lleva también de serie. Al cambiarlo, sube la fecha de `actualizado`: las apps solo se quedan con el más nuevo. Cada curso nuevo lo busca en los boletines la tarea «Vigilar el calendario escolar» (`calendario.yml`), que propone un pull request para revisar; Cataluña se añade a mano (ver `docs/COMUNIDADES.md`, «Calendario escolar»).
- Día del lanzamiento: rellenar `checkout` (enlace de pago de Lemon Squeezy), `play` (ficha de Google Play) y `store` (ficha de Microsoft Store) en `web/sitio/assets/launch.js`. La web entera pasa de "Próximamente" a "a la venta".
- 15 de abril de 2027: termina la oferta de lanzamiento. Pasos en `docs/WEB.md`, apartado 5, punto 9. Una oferta anunciada con fecha hay que cumplirla.

## Reglas que no se rompen

1. Lo que la web promete es lo que hace la app (`docs/WEB.md`, sección 3). Si cambia cómo la app trata datos, licencias, IA, copias o actualizaciones, actualiza en el mismo cambio `web/sitio/privacidad.html` y `web/sitio/condiciones.html`, en los tres idiomas.
2. Licencia: una sola para Windows y Android (Mac, «próximamente» en la web), hasta 2 dispositivos a la vez y devolución en 14 días sin preguntas. Oferta de lanzamiento hasta el 15 de abril de 2027 incluido: pago único de 6,99 € con impuestos incluidos, de por vida y con las actualizaciones. Desde el 16 de abril de 2027, las licencias nuevas son anuales, 11,99 € al año; las de por vida ya vendidas se respetan siempre. Packs para grupos (5, 10, 20 y 30 docentes por 24,99 €, 44,99 €, 79,99 € y 99,99 €): una sola clave para todo el grupo, con 2 dispositivos por docente (10, 20, 40 y 60). Se vende en la web con Lemon Squeezy.
3. Android se descarga gratis en Google Play y se activa con esa licencia. Dentro de la app nunca hay un botón ni un enlace que lleve a pagar; solo se puede escribir "Consigue tu licencia en aulapro.app", como texto sin enlace.
4. Ningún formulario de la web envía nada si no se marca la casilla "He leído y acepto la política de privacidad".
5. Textos: tú con vocabulario formal. Docentes, profesorado, maestros y maestras; nunca "profes". Sin rayas largas: comas y puntos. Castellano, català e inglés.
6. No se publican nunca el DNI del dueño ni su Gmail. El contacto público es contacto@aulapro.app.
7. En las capturas, en los datos de ejemplo y en el modo de prueba no salen nombres de personas: el docente es «Profesor» y el alumnado, «Alumno 1», «Alumno 2»… (decisión del 6-10-2026; `web/DISENO.md`, sección 33). En inglés, «Teacher» y «Student 1»; en catalán, «Professor» y «Alumne 1»: los datos de ejemplo salen en el idioma de la app (`src/i18n/demo.ts`). Las pruebas automáticas de privacidad sí usan nombres completos inventados, porque comprueban que se ocultan.
