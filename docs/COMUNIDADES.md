# Comunidades autónomas: Comunitat Valenciana, Cataluña y Madrid

Decisiones tomadas el 2-10-2026 con el dueño.

Estado (2-10-2026):

- Hecho: registro de comunidades y de sus decretos (`src/lib/curriculum/comunidades.ts`), mecanismo de carga con vuelta al estatal (`cargar.ts`), comunidad en el perfil (guardado en escritorio y navegador, selector obligatorio al crear, edición en Perfil), aviso único a los perfiles antiguos e insignia en la barra lateral. La clase se crea eligiendo etapa y curso y marcando sus asignaturas de la lista oficial del currículo (decisión del dueño, 2-10-2026), con «Editar clase» nuevo. La SdA usa el currículo de la comunidad, pregunta la materia que no está clara, guarda la cita del decreto (`SdaContent.normativa`) y la lleva al PDF y al Word; el aviso de que se usó el estatal sale solo en pantalla.
- Comunitat Valenciana, Primaria: extraídos y verificados los 507 criterios del Decreto 96/2026 (ver «Comunitat Valenciana» más abajo). Falta el anexo III del 106/2022 (competencias, saberes y criterios de Educación en Valores).
- Pendiente: el resto de datos de cada decreto; el calendario.
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

- Al crear o editar una clase se eligen etapa y curso (obligatorios) y se marcan las asignaturas de la lista oficial de ese curso, con el nombre que les da el currículo de la comunidad del perfil (decisión del dueño, 2-10-2026: hay pocos usuarios, así que no hace falta conservar el modo antiguo de escribirlas a mano).
- Las que no están en la lista (Religión, Tutoría…) se añaden aparte y quedan en modo libre (`materiasOficiales[asignatura] = null`).
- Cada asignatura oficial guarda el identificador de su materia (`CurriculumEntry.id`), no solo el nombre: así sigue valiendo si el docente cambia el idioma de la app y el currículo se abre en el otro idioma. En el estatal el identificador es el nombre; en la Comunitat Valenciana tendrá que ser el mismo en los dos archivos de idioma.
- Las clases anteriores, con asignaturas escritas a mano, siguen funcionando: al editarlas se piden etapa y curso, se conserva lo que se sabía de cada asignatura (alias seguro como «Mates») y el resto queda en modo libre. En la SdA, un área sin materia clara pregunta cuál es y se recuerda en la clase.
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
- `Class.etapa`, `curso`, `opcionMatematicas` y `materiasOficiales` (asignatura → materia oficial, `null` para modo libre). `src/lib/curriculum/materiasDeClase.ts` decide si una asignatura ya tiene materia (elegida o por alias seguro), está en modo libre o hay que preguntar, y con qué opciones. Una elección que ya no existe en el currículo (por cambiar de comunidad) se ignora y se vuelve a preguntar.
- `src/hooks/useCurriculo.ts` y `src/components/curriculum/CurriculumFields.tsx`: lo que comparten el formulario de la clase y el de la SdA.
- `generateSda` abre el currículo con `cargarCurriculo` y devuelve `normativa` (comunidad, origen y cita) solo si alguna área acabó con texto oficial.

Pendiente:

- Datos en `src/lib/curriculum/data/<comunidad>/primaria.json` y `eso.json`, y su entrada en `CARGADORES`.
- `mapeoMaterias.ts` por comunidad: las áreas cambian de nombre y a veces de número, y de ahí sale el desplegable.
- La forma de los datos actuales es la del RD estatal. Los decretos autonómicos pueden agrupar los cursos de otra manera o traer campos propios. Se decide con el texto real delante. Hacia fuera, la interfaz de `index.ts` debe seguir siendo la misma.

## Bloqueos y pendientes

- Acceso de red del entorno de Claude: `dogv.gva.es`, `portaljuridic.gencat.cat`, `www.bocm.es` y `www.boe.es`. Más adelante, para el calendario: `ceice.gva.es`, `educacio.gencat.cat` y `www.comunidad.madrid`. Sin esto no se puede transcribir ningún decreto.
- Decretos, tal y como los dio el dueño (2-10-2026). En el registro llevan `verificada: false` hasta comprobar título, número y boletín contra la publicación oficial, y una prueba impide que una comunidad con currículo propio cite una norma sin verificar:
  - Comunitat Valenciana, Primaria: Decret 106/2022, de 5 d'agost (DOGV núm. 9402, de 10 d'agost de 2022), modificado por el Decret 96/2026, de 19 de juny (DOGV núm. 10391, de 25 de juny de 2026).
  - Comunitat Valenciana, ESO: Decret 107/2022, de 5 d'agost (DOGV núm. 9403, d'11 d'agost de 2022), modificado por el Decret 66/2024, de 21 de juny (DOGV núm. 9879, de 26 de juny de 2024).
  - Cataluña, Primaria y ESO en uno: Decret 175/2022, de 27 de setembre, d'ordenació dels ensenyaments de l'educació bàsica (DOGC núm. 8762, de 29 de setembre de 2022).
  - Madrid, Primaria: Decreto 61/2022, de 13 de julio (BOCM núm. 169, de 18 de julio de 2022).
  - Madrid, ESO: Decreto 65/2022, de 20 de julio (BOCM núm. 175, de 25 de julio de 2022).
- En la Comunitat Valenciana el DOGV publica la modificación sin el texto consolidado. El currículo vigente hay que construirlo aplicando la modificación a la matriz, dejar anotado qué se cambió y comprobarlo contra los dos documentos. La cita de la SdA nombra los dos decretos («modificado por»).
- El título en castellano del 66/2024 todavía no está: se completa al comprobarlo en el DOGV. El del 96/2026 ya está, comprobado con su PDF.

## Comunitat Valenciana

### Fuentes

En `docs/decretos/comunitat-valenciana/`, para poder repetir la extracción en cualquier sesión (desde aquí no se llega al DOGV):

- `decreto-96-2026.es.pdf`: DOGV núm. 10391, de 25-6-2026, en castellano. SHA-256 `05e5cdcdf45c521a4ee6eb3ded5ea402dd16be1c62b3f3d243990413be5d5c18`.
- Pendiente: los anexos I a III del 106/2022, en castellano y en valenciano; la versión en valenciano del 96/2026; la corrección de errores del 106/2022 publicada el 3-11-2022 (los metadatos del DOGV la citan: hay que ver si toca el anexo III); y para la ESO, el 107/2022 y el 66/2024.

### Qué dice cada decreto (Primaria)

- 106/2022: los metadatos del DOGV (XML que dio el dueño) solo traen el articulado, no los anexos. El currículo de las áreas está en el anexo III, que solo está en el PDF.
- 96/2026, artículo 9 nuevo: las áreas son Conocimiento del Medio Natural, Social y Cultural; Educación Plástica y Visual; Música y Danza; Educación Física; Valenciano: Lengua y Literatura; Lengua Castellana y Literatura; Lengua Extranjera; Matemáticas; Religión; y Educación en Valores Cívicos y Éticos, solo en el tercer ciclo. Desaparecen los Proyectos Interdisciplinarios.
- 96/2026, anexo único, puntos 22 a 28: sustituye el apartado 6 (criterios de evaluación) de cada área del anexo III, ahora con criterios para los tres ciclos (el 106/2022 no los tenía para el primero). Las dos lenguas oficiales comparten tabla. Educación en Valores no cambia: sus criterios siguen siendo los del 106/2022. Las competencias específicas y los saberes básicos tampoco cambian.

### Cómo se extrajeron los criterios del 96/2026

- Script: `scripts/curriculo/criterios_dogv_tablas.py`, sobre las páginas 18 a 59. Resultado: `scripts/curriculo/comunitat-valenciana/criterios-96-2026.es.json`.
- Las tablas están impresas de lado y la extracción de texto normal las desordena. El script endereza las páginas, toma las palabras con sus coordenadas de `pdftotext -bbox-layout` y asigna cada una a su ciclo por la columna en que cae. Algunos separadores de fila están dibujados como curvas: sin tenerlas en cuenta se perdían filas enteras (pasó con los 1.3 al principio).
- Comprobaciones hechas, todas superadas:
  - Los códigos de cada competencia son correlativos en los tres ciclos (1.1, 1.2…) y empiezan por el número de la competencia. 7 áreas, 507 criterios.
  - Cada competencia tiene el mismo número de criterios en los tres ciclos.
  - Los 507 textos se cruzaron con la extracción de texto normal del PDF sin girar, que es un camino independiente: 500 coinciden letra a letra. Los 7 restantes también son correctos: en 6, el texto normal pierde el guion de una palabra compuesta partida al final de línea («colaboración-oposición», «icónico-manipulativas», «afectivo-sexual», «artístico-expresivas», que aparecen con guion en otras líneas del mismo decreto), y en 1 el justificado deja suelta la palabra «resolver».
  - La página 51 (Lengua Extranjera, competencia 7) se comparó a ojo con la imagen: cada criterio en su ciclo y palabra por palabra.
- Literalidad: se conserva lo que pone el decreto aunque parezca una errata. Algunos códigos van sin punto («7.1 Mostrar…», `puntoTrasCodigo: false`) hay frases como «del aula en mediante el uso» en Matemáticas 4.3 de 1er ciclo, y el 6.3 de las lenguas de 3er ciclo acaba sin punto («…a través de la reflexión conjunta»), comprobado en la página 42.

## Pendiente de decidir

- Entrega del currículo: la decisión actual es llevarlo dentro de la app. El dueño ha propuesto servirlo desde Cloudflare para que la app solo descargue el de su comunidad. Propuesta intermedia: base dentro de la app y actualizaciones por el mismo canal del calendario (JSON estático en R2, sin base de datos), con comprobación de huella y de totales antes de usar lo descargado. Pendiente de confirmar. La mecánica de carga (`cargar.ts`) está hecha para que cualquiera de las dos opciones encaje.
