# Comunidades autónomas: Comunitat Valenciana, Cataluña y Madrid

Decisiones tomadas el 2-10-2026 con el dueño.

Estado (2-10-2026):

- Hecho: registro de comunidades y de sus decretos (`src/lib/curriculum/comunidades.ts`), mecanismo de carga con vuelta al estatal (`cargar.ts`), comunidad en el perfil (guardado en escritorio y navegador, selector obligatorio al crear, edición en Perfil), aviso único a los perfiles antiguos e insignia en la barra lateral.
- Pendiente: etapa, curso y materia oficial en la clase; la SdA con la cita de la normativa y el aviso de estatal; los datos de cada decreto; el calendario.
- Ninguna comunidad tiene todavía su currículo copiado: `CARGADORES` está vacío y todas usan el estatal, avisando.

Hoy la app lleva solo las enseñanzas mínimas estatales (RD 157/2022 de Primaria y RD 217/2022 de la ESO), copiadas al pie de la letra en `src/lib/curriculum/data/`. Este documento recoge cómo pasa a llevar el decreto de cada comunidad.

## Cómo se trabaja

- Nada de esto entra en la versión que activa la venta. Esa versión cambia la licencia y tiene que ser lo más estable posible. Esta línea de trabajo va en ramas aparte y sale como actualización después.
- La web (`web/sitio/`) se publica sola cuando llega un cambio a `master`. Mientras esta línea no se haya fusionado, tampoco cambia la web.
- Orden: primero la estructura y la Comunitat Valenciana completa (Primaria y ESO), después Cataluña y Madrid. Con la estructura validada con una comunidad, las otras dos son solo datos.
- Etapas: solo Primaria y ESO. Infantil y Bachillerato quedan fuera, cada uno es un módulo aparte.
- Alcance en esta fase: situaciones de aprendizaje (SdA) y calendario. Rúbricas, dianas, cuaderno e informes con criterios oficiales de la comunidad, más adelante.

## Decisiones

### Dónde se elige la comunidad

- En el perfil del docente. Una vez fijada, todo parte de esa decisión. No hay selector de comunidad en cada SdA.
- Perfil nuevo: obligatoria. La lista incluye «Fuera de España / no aplica», que usa el currículo estatal.
- Perfiles ya creados, sin comunidad: un aviso al abrir el perfil pide elegirla, una sola vez. Mientras no la elijan, se usa el estatal.
- La lista trae las 19 (17 comunidades y Ceuta y Melilla). Las que aún no tienen su decreto copiado se muestran como «próximamente» y usan el estatal con un aviso claro.
- Por comprobar en la fuente: si Ceuta y Melilla (gestión del Ministerio) usan el estatal tal cual o una orden propia. Hasta comprobarlo, se tratan como el resto de comunidades sin decreto copiado.

### Qué se adapta a la comunidad

- Sí: el currículo oficial en las SdA y el calendario escolar.
- No por ahora: el idioma de la app por defecto, ni el vocabulario de los documentos exportados. Se pueden retomar.

### Idioma del texto oficial

- Se muestra el texto oficial literal, en el idioma en que la comunidad lo publica. Nunca se traduce el texto legal.
- Cataluña: catalán, aunque la app esté en castellano.
- Comunitat Valenciana: si el DOGV publica versión en castellano y en valenciano, se guardan las dos y se usa la del idioma de la app.
- La SdA que redacta la IA sigue el idioma de la app, como hasta ahora.

### Clase

- La clase guarda etapa, curso y la materia oficial de cada asignatura. Se piden una vez, al crear o editar la clase. En las clases ya creadas, la primera vez que se genere una SdA.
- Si el nombre de una asignatura no encaja con ninguna materia del decreto de la comunidad, la app muestra un desplegable con las materias oficiales de esa comunidad y ese curso. Lo que elija el docente se recuerda para esa clase. El desplegable lleva también una salida «Ninguna, modo libre» (añadido por el diseño, no estaba en la decisión).
- Nunca se mezclan decretos de distintas comunidades dentro de una SdA.
- Una SdA guardada conserva el decreto con el que se creó (se guarda la cita en la propia SdA). Cambiar de comunidad en el perfil no reescribe las SdA que ya existen.

### Currículo en la app

- Cada decreto va empaquetado dentro de la app, igual que los estatales. No se descarga.
- Solo se carga el de la comunidad del perfil (importación dinámica).
- Cada decreto lleva su test de totales oficiales, como los estatales (`index.test.ts`).
- Añadir una comunidad implica una versión nueva de la app, con las esperas de Microsoft Store y Google Play.

### Qué se ve

- Insignia con la comunidad en la barra lateral, bajo el nombre del docente, que lleva a Perfil.
- En cada SdA, una línea de fuente con el decreto y su boletín, por ejemplo «Currículo: Decreto 106/2022, de 5 de agosto (DOGV)». La misma cita va al PDF y al Word.

## Calendario escolar

- Incluye inicio y fin de curso, vacaciones y festivos de la comunidad. Los festivos locales los añade el docente como un evento, porque dependen del municipio.
- En el calendario mensual de la Agenda, el festivo es un día sombreado con su nombre al pulsarlo, y las vacaciones una franja continua. Los eventos del docente siguen con sus puntos de color.
- Los festivos se guardan aparte de los eventos del docente (`calEvents`). Borrar los antiguos nunca toca lo que el docente haya escrito.

### Actualización automática

- Una tarea programada vigila los boletines oficiales de cada comunidad. Cuando aparece el calendario del curso siguiente, extrae las fechas, las valida y abre un cambio con el enlace al boletín.
- El dueño aprueba el cambio con un clic. Al aprobarlo se publica, y las apps lo descargan. No se publica nada sin que alguien lo haya visto.
- Comprobaciones automáticas antes de proponer el cambio: las fechas existen y caen dentro del curso, la cantidad de festivos es razonable y la fuente está enlazada.
- Entrega: un JSON estático que se publica con la web, con el flujo ya existente de `web.yml`. La app lo descarga al abrirse, lo guarda en local y sigue funcionando sin conexión con lo último guardado. Lleva además un calendario de serie por si no hay conexión la primera vez.
- Se conservan el curso actual y el siguiente. Los anteriores se borran.
- Si falta el curso en curso, se avisa «El calendario de este curso aún no está disponible» y la Agenda sigue como hoy.

### Consecuencias para la privacidad (regla 1 de `CLAUDE.md`)

- Es una conexión nueva de la app. No envía datos del docente, solo descarga.
- En el mismo cambio hay que actualizar `web/sitio/privacidad.html` en los tres idiomas, y revisar cualquier frase de la web que diga que la app solo se conecta para la licencia y la IA.

### Pendiente de decidir al llegar a esta parte

- Desde dónde vigila la tarea: una Action programada en este repositorio. Hará falta que pueda leer los boletines y, si la extracción usa IA, una clave como secreto del repositorio.

## Estructura técnica

Hecho:

- `TeacherProfile.community` y `communityPromptAt` en `src/services/storage.ts`. El escritorio (`electron/storage.cjs`) guarda `community` al crear el perfil. Se lee siempre con `comunidadDePerfil`, que descarta cualquier valor que no sea de la lista.
- `src/lib/curriculum/comunidades.ts`: las 20 opciones (17 comunidades, Ceuta, Melilla y «Fuera de España»), sus decretos por etapa con matriz y modificaciones, y las funciones para citarlos en el idioma de la app sin traducir.
- `src/lib/curriculum/cargar.ts`: `CARGADORES` (vacío hasta que llegue el primer decreto), `cargarCurriculo`, que nunca falla y vuelve al estatal avisando con `origen`, y `usaEstatalPorFaltaDeDecreto`.
- `src/components/CommunitySelect.tsx` (selector con «próximamente» y una nota de qué currículo se usará), `CommunityPrompt.tsx` (el aviso único) e insignia en `Sidebar.tsx`.

Pendiente:

- Datos en `src/lib/curriculum/data/<comunidad>/primaria.json` y `eso.json`, y su entrada en `CARGADORES`.
- `mapeoMaterias.ts` por comunidad: las áreas cambian de nombre y a veces de número, y de ahí sale el desplegable.
- La forma de los datos actuales es la del RD estatal. Los decretos autonómicos pueden agrupar los cursos de otra manera o traer campos propios. Se decide con el texto real delante. Hacia fuera, la interfaz de `index.ts` debe seguir siendo la misma.
- `Class` con etapa, curso y materia oficial; `LearningSituation.request` con la cita de la normativa usada.

## Bloqueos y pendientes

- Acceso de red del entorno de Claude: `dogv.gva.es`, `portaljuridic.gencat.cat`, `www.bocm.es` y `www.boe.es`. Más adelante, para el calendario: `ceice.gva.es`, `educacio.gencat.cat` y `www.comunidad.madrid`. Sin esto no se puede transcribir ningún decreto.
- Decretos, tal y como los dio el dueño (2-10-2026). En el registro llevan `verificada: false` hasta comprobar título, número y boletín contra la publicación oficial, y una prueba impide que una comunidad con currículo propio cite una norma sin verificar:
  - Comunitat Valenciana, Primaria: Decret 106/2022, de 5 d'agost (DOGV núm. 9402, de 10 d'agost de 2022), modificado por el Decret 96/2026, de 19 de juny (DOGV núm. 10391, de 25 de juny de 2026).
  - Comunitat Valenciana, ESO: Decret 107/2022, de 5 d'agost (DOGV núm. 9403, d'11 d'agost de 2022), modificado por el Decret 66/2024, de 21 de juny (DOGV núm. 9879, de 26 de juny de 2024).
  - Cataluña, Primaria y ESO en uno: Decret 175/2022, de 27 de setembre, d'ordenació dels ensenyaments de l'educació bàsica (DOGC núm. 8762, de 29 de setembre de 2022).
  - Madrid, Primaria: Decreto 61/2022, de 13 de julio (BOCM núm. 169, de 18 de julio de 2022).
  - Madrid, ESO: Decreto 65/2022, de 20 de julio (BOCM núm. 175, de 25 de julio de 2022).
- En la Comunitat Valenciana el DOGV publica la modificación sin el texto consolidado. El currículo vigente hay que construirlo aplicando la modificación a la matriz, dejar anotado qué se cambió y comprobarlo contra los dos documentos. La cita de la SdA nombra los dos decretos («modificado por»).
- Los títulos en castellano de las dos modificaciones valencianas todavía no están: se completan al comprobarlos en el DOGV.

## Pendiente de decidir

- Entrega del currículo: la decisión actual es llevarlo dentro de la app. El dueño ha propuesto servirlo desde Cloudflare para que la app solo descargue el de su comunidad. Propuesta intermedia: base dentro de la app y actualizaciones por el mismo canal del calendario (JSON estático en R2, sin base de datos), con comprobación de huella y de totales antes de usar lo descargado. Pendiente de confirmar. La mecánica de carga (`cargar.ts`) está hecha para que cualquiera de las dos opciones encaje.
