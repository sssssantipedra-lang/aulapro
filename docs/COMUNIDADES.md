# Comunidades autónomas: Comunitat Valenciana, Cataluña y Madrid

Decisiones tomadas el 2-10-2026 con el dueño.

Estado (2-10-2026):

- Hecho: registro de comunidades y de sus decretos (`src/lib/curriculum/comunidades.ts`), mecanismo de carga con vuelta al estatal (`cargar.ts`), comunidad en el perfil (guardado en escritorio y navegador, selector obligatorio al crear, edición en Perfil), aviso único a los perfiles antiguos e insignia en la barra lateral. La clase se crea eligiendo etapa y curso y marcando sus asignaturas de la lista oficial del currículo (decisión del dueño, 2-10-2026), con «Editar clase» nuevo. La SdA usa el currículo de la comunidad, pregunta la materia que no está clara, guarda la cita del decreto (`SdaContent.normativa`) y la lleva al PDF y al Word; el aviso de que se usó el estatal sale solo en pantalla.
- Comunitat Valenciana, Primaria: hecha, en castellano y en valenciano. Las 9 áreas del artículo 9 con sus competencias y criterios del 96/2026, los saberes básicos del 106/2022 y Educación en Valores entera del 106/2022, todo extraído de los PDF oficiales y comprobado (ver «Comunitat Valenciana» más abajo). Está en `CARGADORES`: un perfil de la Comunitat Valenciana ya trabaja con su decreto en Primaria, en la lengua de la app (en inglés, el castellano).
- Pendiente: la ESO valenciana, Cataluña, Madrid y el calendario.
- El resto de comunidades, y la ESO valenciana, usan el estatal, avisando.

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
- Los alias (`mapeoMaterias.ts`) apuntan a identificadores de materia, no a nombres, y cada comunidad tiene los suyos: «Música» es «Educación Artística» en el estatal y «Música y Danza» en la Comunitat Valenciana. Llevan también las formas en valenciano y catalán. Lo que es ambiguo en una comunidad no empareja ahí: «Educación Artística» en la Comunitat Valenciana (son dos áreas) o «Lengua y Literatura» (puede ser cualquiera de las dos lenguas oficiales). Una prueba impide que un alias pueda caer en dos materias del mismo currículo (decisión del dueño, 3-10-2026).
- El nombre de una asignatura es el que tenía al crearse, aunque la app cambie de idioma: de ese nombre cuelgan el cuaderno, las rúbricas, las dianas y las categorías de nota. El formulario de la clase reconoce cada asignatura oficial por su identificador, así que con la app en valenciano una clase creada en castellano tiene marcada «Matemàtiques» y su asignatura sigue llamándose «Matemáticas» (el dueño lo dejó a criterio de Claude, 3-10-2026).
- Nunca se mezclan decretos de distintas comunidades dentro de una SdA.
- Una SdA guardada conserva el decreto con el que se creó (se guarda la cita en la propia SdA). Cambiar de comunidad en el perfil no reescribe las SdA que ya existen.

### Currículo en la app

- Cada decreto va empaquetado dentro de la app, igual que los estatales. No se descarga. Decidido el 3-10-2026 (el dueño lo dejó a criterio de Claude): los decretos cambian cada pocos años y la app ya se actualiza sola; descargarlos añadiría una conexión y un punto de fallo sin ganar nada. Cuando exista el canal de descarga del calendario, si un decreto cambiara entre dos versiones de la app, la corrección podría llegar por ese canal, con comprobación de huella y de totales.
- Solo se carga el de la comunidad del perfil (importación dinámica).
- Cada decreto lleva su test de totales oficiales, como los estatales (`index.test.ts`).
- Añadir una comunidad implica una versión nueva de la app, con las esperas de Microsoft Store y Google Play.

### Qué se ve

- Insignia con la comunidad en la barra lateral, bajo el nombre del docente, que lleva a Perfil.
- En cada SdA, una línea de fuente con el decreto y su boletín, por ejemplo «Currículo: Decreto 106/2022, de 5 de agosto (DOGV)». La misma cita va al PDF y al Word.
- En la SdA, cada área con el texto literal del decreto lleva la marca «Texto oficial» (`SdaArea.oficial`); las que redactó la IA, ninguna. Solo en pantalla: el PDF y el Word llevan la cita, como el aviso del estatal (decisión del dueño, 3-10-2026).
- La ficha de ejercicios muestra su área en «Mis fichas» y la lleva impresa, en el PDF y en el Word, delante de nombre, fecha y clase (decisión del dueño, 3-10-2026).

## Calendario escolar

- Incluye inicio y fin de curso, vacaciones y festivos de la comunidad. Los festivos locales los añade el docente como un evento, porque dependen del municipio.
- En el calendario mensual de la Agenda, el festivo es un día sombreado con su nombre al pulsarlo, y las vacaciones una franja continua. Los eventos del docente siguen con sus puntos de color.
- Los festivos se guardan aparte de los eventos del docente (`calEvents`). Borrar los antiguos nunca toca lo que el docente haya escrito.

### Actualización automática

- Confirmado por el dueño el 3-10-2026: automático.
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
- `src/lib/curriculum/cargar.ts`: `CARGADORES` (de momento, Primaria de la Comunitat Valenciana), `cargarCurriculo`, que nunca falla y vuelve al estatal avisando con `origen`, y `usaEstatalPorFaltaDeDecreto`. Cada cargador devuelve también el idioma que ha servido de verdad (`idioma`), por si falta el archivo del idioma pedido. `conLosMismosSaberesEnCadaCiclo` abre los datos de un decreto que trae una sola lista de saberes por materia.
- `src/components/CommunitySelect.tsx` (selector con «próximamente» y una nota de qué currículo se usará), `CommunityPrompt.tsx` (el aviso único) e insignia en `Sidebar.tsx`.
- `Class.etapa`, `curso`, `opcionMatematicas` y `materiasOficiales` (asignatura → materia oficial, `null` para modo libre). `src/lib/curriculum/materiasDeClase.ts` decide si una asignatura ya tiene materia (elegida o por alias seguro), está en modo libre o hay que preguntar, y con qué opciones. Una elección que ya no existe en el currículo (por cambiar de comunidad) se ignora y se vuelve a preguntar.
- `src/hooks/useCurriculo.ts` y `src/components/curriculum/CurriculumFields.tsx`: lo que comparten el formulario de la clase y el de la SdA.
- `generateSda` abre el currículo con `cargarCurriculo` y devuelve `normativa` (comunidad, origen y cita) solo si alguna área acabó con texto oficial.

Pendiente:

- Evaluación por criterios de cada área (propuesta del 3-10-2026, pendiente de que el dueño la confirme): la nota de una rúbrica va a una sola asignatura del cuaderno, pero una SdA trabaja competencias específicas de varias áreas. La idea es evaluar cada área por sus criterios de evaluación, que se agregan en sus competencias específicas, y que la misma evaluación de una rúbrica alimente los criterios de todas las áreas que toca.
- Datos del resto: `src/lib/curriculum/data/<comunidad>/primaria.<idioma>.json` y `eso.<idioma>.json`, y su entrada en `CARGADORES`. Cada uno sale en su propio archivo al compilar y solo se descarga al pedirlo (el de Primaria valenciana pesa unos 48 KB comprimido).
- La forma de los datos actuales es la del RD estatal. Los decretos autonómicos pueden agrupar los cursos de otra manera o traer campos propios. Se decide con el texto real delante. Hacia fuera, la interfaz de `index.ts` debe seguir siendo la misma.

## Bloqueos y pendientes

- Acceso de red del entorno de Claude: `dogv.gva.es`, `portaljuridic.gencat.cat`, `www.bocm.es` y `www.boe.es`. Más adelante, para el calendario: `ceice.gva.es`, `educacio.gencat.cat` y `www.comunidad.madrid`. Sin esto no se puede transcribir ningún decreto.
- Decretos, tal y como los dio el dueño (2-10-2026). En el registro llevan `verificada: false` hasta comprobar título, número y boletín contra la publicación oficial, y una prueba impide que una comunidad con currículo propio cite una norma sin verificar:
  - Comunitat Valenciana, Primaria: Decret 106/2022, de 5 d'agost (DOGV núm. 9402, de 10 d'agost de 2022), modificado por el Decret 96/2026, de 19 de juny (DOGV núm. 10391, de 25 de juny de 2026). Los dos verificados, en las dos lenguas.
  - Comunitat Valenciana, ESO: Decret 107/2022, de 5 d'agost (DOGV núm. 9403, d'11 d'agost de 2022), modificado por el Decret 66/2024, de 21 de juny (DOGV núm. 9879, de 26 de juny de 2024).
  - Cataluña, Primaria y ESO en uno: Decret 175/2022, de 27 de setembre, d'ordenació dels ensenyaments de l'educació bàsica (DOGC núm. 8762, de 29 de setembre de 2022).
  - Madrid, Primaria: Decreto 61/2022, de 13 de julio (BOCM núm. 169, de 18 de julio de 2022), modificado por el Decreto 59/2024, de 12 de junio (BOCM núm. 140, de 13 de junio de 2024). Verificados con sus PDF.
  - Madrid, ESO: Decreto 65/2022, de 20 de julio (BOCM núm. 176, de 26 de julio de 2022; el dueño lo había dado como núm. 175, de 25 de julio, y el PDF lo desmiente), modificado por el mismo Decreto 59/2024. Verificados con sus PDF.
- En la Comunitat Valenciana el DOGV publica la modificación sin el texto consolidado. El currículo vigente hay que construirlo aplicando la modificación a la matriz, dejar anotado qué se cambió y comprobarlo contra los dos documentos. La cita de la SdA nombra los dos decretos («modificado por»).
- El título en castellano del 66/2024 todavía no está: se completa al comprobarlo en el DOGV. El del 96/2026 ya está, comprobado con su PDF.

## Comunitat Valenciana

### Fuentes

En `docs/Normativa Comunitat Valenciana/` (nombre que eligió el dueño), para poder repetir la extracción en cualquier sesión (desde aquí no se llega al DOGV). Los sube el dueño; los nombres siguen su criterio: «ANEXO», «DECRETO» en castellano y «ANNEX», «DECRET» en valenciano.

- `ANEXO 1-3 106-2022.pdf`: anexos I a III del Decreto 106/2022 en castellano, extraídos del PDF del DOGV núm. 9402, de 10-8-2022 (páginas 41407 y siguientes). 220 páginas. SHA-256 `9950b157a706d3c538881fc7b715dc19fbeb1d474031043b22dacaa140a7b802`.
- `ANNEX 1-3 106-2022.pdf`: los mismos anexos en valenciano (páginas 41194 y siguientes del mismo DOGV). 211 páginas. SHA-256 `d59ca5745fead760d69e1e7238221d45292e4c5e638f438ece66b27198ec512b`.
- `DECRETO 96-2026.pdf`: DOGV núm. 10391, de 25-6-2026, en castellano. 94 páginas. SHA-256 `05e5cdcdf45c521a4ee6eb3ded5ea402dd16be1c62b3f3d243990413be5d5c18`.
- `DECRET 96-2026.pdf`: el mismo DOGV, en valenciano. 99 páginas (la 29 está en blanco en el original). SHA-256 `8fca068aaadd6341fb325196926ee6c9c5889e5b7626d4b226335f5eb0975bdd`.
- Pendiente: la corrección de errores del 106/2022 publicada el 3-11-2022 (los metadatos del DOGV la citan: hay que ver si toca el anexo III); y para la ESO, el 107/2022 y el 66/2024.

### Qué dice cada decreto (Primaria)

- 106/2022: los metadatos del DOGV (XML que dio el dueño) solo traen el articulado, no los anexos. El currículo de las áreas está en el anexo III, que solo está en el PDF.
- 96/2026, artículo 9 nuevo: las áreas son Conocimiento del Medio Natural, Social y Cultural; Educación Plástica y Visual; Música y Danza; Educación Física; Valenciano: Lengua y Literatura; Lengua Castellana y Literatura; Lengua Extranjera; Matemáticas; Religión; y Educación en Valores Cívicos y Éticos, solo en el tercer ciclo. Desaparecen los Proyectos Interdisciplinarios.
- 96/2026, anexo único, puntos 22 a 28: sustituye el apartado 6 (criterios de evaluación) de cada área del anexo III, ahora con criterios para los tres ciclos (el 106/2022 no los tenía para el primero). Las dos lenguas oficiales comparten tabla. Educación en Valores no cambia: sus competencias y criterios siguen siendo los del 106/2022. Los saberes básicos (apartado 4) no los toca.
- Cada tabla de criterios del 96/2026 va precedida del enunciado de su competencia específica, y esos enunciados no coinciden del todo con el apartado 2 del 106/2022:
  - Música y Danza pasa de 5 competencias a 4. La 5 del 106/2022 («Utilizar recursos digitales y audiovisuales aplicados a la búsqueda, la escucha, la edición, la interpretación y la creación de producciones musicales…») no tiene tabla ni criterios en el 96/2026.
  - Cambios de redacción: «Comunidad Valenciana» pasa a «Comunitat Valenciana» (Conocimiento del Medio 7 y 8); «de acuerdo a» pasa a «de acuerdo con» (Plástica 5); «cercano al alumno» pasa a «cercano al alumnado» (lenguas, 9); en Lengua Extranjera 7, «Mediar entre interlocutores» pasa a «Mediar entre el grupo de interlocutores o interlocutoras». En Lengua Extranjera el título de cada competencia («Comprensión oral») va seguido de punto.
- Decisión del dueño (2-10-2026): ante cualquier diferencia entre el 106/2022 y el 96/2026, manda el 96/2026. Las competencias se copian de los enunciados del 96/2026 (Música y Danza con 4) y del 106/2022 solo lo que el 96/2026 no trae: los saberes básicos de todas las áreas y todo Educación en Valores.

### Cómo se extrajeron los criterios del 96/2026

- Script: `scripts/curriculo/criterios_dogv_tablas.py`, sobre las páginas 18 a 59 en castellano y 18 a 64 en valenciano. Resultado: `scripts/curriculo/comunitat-valenciana/criterios-96-2026.es.json` y `.va.json`.
- En valenciano las páginas son verticales con la tabla dibujada de lado (en castellano van marcadas como giradas); el mismo giro las endereza. En las páginas 32 a 35 (Plástica, competencias 3 a 6) la tabla está desplazada a la izquierda: el script mide las columnas en cada página, entre las cuatro líneas verticales de la tabla, en vez de darlas por fijas.
- Valenciano, comprobado: 507 criterios con los mismos códigos que en castellano, competencia a competencia y ciclo a ciclo (solo cambia, en 11 criterios, si el código lleva punto detrás, que es tipografía); los 507 textos aparecen letra a letra en el texto simple del PDF; los guiones que quedan son de pronombres enclíticos («iniciar-se») y compuestos («col·laboració-oposició»): este texto no parte palabras al final de línea.
- El castellano se vuelve a extraer igual que antes con los cambios del script (se comparó byte a byte).
- Las tablas están impresas de lado y la extracción de texto normal las desordena. El script endereza las páginas, toma las palabras con sus coordenadas de `pdftotext -bbox-layout` y asigna cada una a su ciclo por la columna en que cae. Algunos separadores de fila están dibujados como curvas: sin tenerlas en cuenta se perdían filas enteras (pasó con los 1.3 al principio).
- Comprobaciones hechas, todas superadas:
  - Los códigos de cada competencia son correlativos en los tres ciclos (1.1, 1.2…) y empiezan por el número de la competencia. 7 áreas, 507 criterios.
  - Cada competencia tiene el mismo número de criterios en los tres ciclos.
  - Los 507 textos se cruzaron con la extracción de texto normal del PDF sin girar, que es un camino independiente: 500 coinciden letra a letra. Los 7 restantes también son correctos: en 6, el texto normal pierde el guion de una palabra compuesta partida al final de línea («colaboración-oposición», «icónico-manipulativas», «afectivo-sexual», «artístico-expresivas», que aparecen con guion en otras líneas del mismo decreto), y en 1 el justificado deja suelta la palabra «resolver».
  - La página 51 (Lengua Extranjera, competencia 7) se comparó a ojo con la imagen: cada criterio en su ciclo y palabra por palabra.
- Literalidad: se conserva lo que pone el decreto aunque parezca una errata. Algunos códigos van sin punto («7.1 Mostrar…», `puntoTrasCodigo: false`) hay frases como «del aula en mediante el uso» en Matemáticas 4.3 de 1er ciclo, y el 6.3 de las lenguas de 3er ciclo acaba sin punto («…a través de la reflexión conjunta»), comprobado en la página 42.

### Cómo se extrajeron los saberes del 106/2022 (Primaria)

- Scripts: `scripts/curriculo/saberes_dogv_tablas.py` lee las tablas de una página y `scripts/curriculo/primaria_cv.py` monta el currículo entero y escribe `src/lib/curriculum/data/comunitat-valenciana/primaria.es.json`. Para revisar, deja lo intermedio (con los grupos G1, G2…, en las dos lenguas) en `scripts/curriculo/comunitat-valenciana/saberes-106-2022.es.json` y `.va.json`. Se ejecuta con `python3 scripts/curriculo/primaria_cv.py` (`--revisar` imprime la estructura y cada decisión sobre guiones).
- Decisión del dueño (2-10-2026): no se recoge para qué ciclo es cada saber. Las X del decreto son «a modo orientativo»; en la app cada bloque lleva todos sus saberes en los tres ciclos.
- Cada área maqueta sus tablas a su manera. Lo que hubo que resolver:
  - En valenciano, detrás de cada línea de texto hay un rectángulo blanco relleno: solo cuentan como bordes las líneas que se ven.
  - Algunas cabeceras ocupan varias filas (en las lenguas, el título va en la del medio) o llevan recuadros dentro que se detectan como tablas aparte.
  - Una tabla que sigue en la página siguiente repite la cabecera, o no: se sigue el mismo subbloque. Una fila partida entre dos páginas no tiene borde inferior; la tabla llega hasta donde llegan sus líneas verticales (así apareció un saber de Lengua Extranjera en valenciano que se perdía).
  - En el bloque 6 de Matemáticas en valenciano, el propio DOGV pone «1.er ciclo» también encima de la columna de texto.
  - Los guiones de final de línea: hay 31 uniones (1 en castellano, 30 en valenciano). Se decide con las palabras del propio anexo, sacadas del PDF con pdfplumber y no con `pdftotext`, que quita ese guion por su cuenta (deja «figurafondo» donde el decreto dice «figura-fondo», como confirma «figura-fons» en valenciano). Resultado: «figura-fondo» y «mesurar-lo» conservan el guion; las otras 29 son palabras partidas («instru-mentals»).
- Comprobaciones, todas superadas (el programa se para si alguna falla):
  - Castellano y valenciano tienen los mismos bloques, subbloques, grupos y número de saberes en cada grupo, en las 7 áreas con tablas y en Educación en Valores.
  - Cada texto que pasa a la app se busca en el texto simple de su PDF (`pdftotext`, camino independiente): saberes, títulos de grupo, Educación en Valores entera y las competencias y criterios del 96/2026. En castellano, 1342 coinciden letra a letra; 19 coinciden con las palabras desordenadas (en las líneas muy justificadas `pdftotext` cambia el orden de algunas palabras o mete la cabecera de la página en medio); 9 se compararon con la imagen de la página porque el texto simple pierde alguna palabra o separa el «G1» de su título, y están bien. En valenciano, 1349, 18 y 3. Los vistos en imagen están en `VISTOS_EN_IMAGEN`.
  - Los criterios del 96/2026 tienen los mismos códigos en las dos lenguas, y el programa se para si no.
  - Las pruebas de `src/lib/curriculum/comunitatValenciana.test.ts` fijan los totales: 9 áreas; competencias 8, 6, 4, 6, 9, 9, 7, 8 y 7; los 507 criterios del 96/2026 más los 18 de Educación en Valores; 722 saberes (contando una vez los de las lenguas oficiales).
- Literalidad: como en los criterios, se conserva el texto aunque parezca una errata. Por ejemplo, «Identificación de los estados del agua .» (el PDF tiene ese hueco antes del punto, página 38), o en valenciano «Formes simples. .», «jocs instrumentals .» y «el desplaçament..» (Música, páginas 56 a 58), comprobados en la imagen.

### Cómo queda en la app (Primaria)

- Áreas, en el orden y con el nombre del artículo 9 (96/2026): Conocimiento del Medio Natural, Social y Cultural; Educación Plástica y Visual; Música y Danza; Educación Física; Valenciano: Lengua y Literatura; Lengua Castellana y Literatura; Lengua Extranjera; Matemáticas; Educación en Valores Cívicos y Éticos (solo tercer ciclo: sus criterios solo existen ahí). Religión no tiene currículo en el decreto: se añade como «otra asignatura». Las dos lenguas oficiales comparten currículo y criterios, así que son dos áreas con el mismo contenido.
- Competencias: los enunciados que encabezan las tablas del 96/2026 (Música y Danza con 4). Educación en Valores, del 106/2022.
- Saberes: bloque (número y título) y epígrafes con sus saberes. Qué es epígrafe depende del área: el subbloque en Conocimiento del Medio, Música, Plástica y las lenguas oficiales; el grupo en Educación Física (un solo subbloque por bloque, que da el título del bloque) y en Lengua Extranjera; cada tabla en Matemáticas. Los títulos van sin código («1.1», «SB2.1 -», «G3.»), sin las competencias vinculadas («CE1, CE2») y sin punto final. Los títulos de grupo de las áreas en que el epígrafe es el subbloque no pasan a la app (están en lo intermedio).
- Matemáticas no titula sus bloques («4.2. Bloque 1.»): el título sale de la enumeración de sentidos de su apartado 4.1 («numérico y de las operaciones, de la medida, espacial y geométrico, de incertidumbre y probabilidad, de análisis de datos y estadística, y de pensamiento computacional»), como «Sentido numérico y de las operaciones». Los títulos de sus tablas van en mayúsculas en el decreto («NÚMEROS NATURALES») y en la app en minúscula de frase («Números naturales»).
- Cita: «Decreto 106/2022, de 5 de agosto (DOGV núm. 9402, de 10 de agosto de 2022), modificado por Decreto 96/2026, de 19 de junio (DOGV núm. 10391, de 25 de junio de 2026)», y en valenciano «Decret 106/2022, de 5 d'agost (…), modificat per Decret 96/2026, de 19 de juny (…)». Los títulos de los dos decretos están comprobados con sus PDF en las dos lenguas.
- Dos archivos, `primaria.es.json` y `primaria.ca.json` (en la app, el valenciano es «ca»), con los mismos `id` de área: una clase guarda el `id`, así que no pierde sus materias al cambiar el idioma de la app. Los nombres de las áreas en valenciano son los del artículo 9 del 96/2026 en valenciano («Coneixement del Medi Natural, Social i Cultural»…). En inglés se sirve el castellano.

## Comunidad de Madrid

### Fuentes

En `docs/Normativa Comunidad de Madrid/`, descargados del BOCM (desde el entorno de Claude sí se llega):

- `DECRETO 61-2022.pdf`: Primaria. BOCM núm. 169, de 18-7-2022 (BOCM-20220718-1). 112 páginas. SHA-256 `7087c7d8cdd5a172ecb620a8742acb43864b17563984c407b5f4d498e6399343`.
- `DECRETO 65-2022.pdf`: ESO. BOCM núm. 176, de 26-7-2022 (BOCM-20220726-2). 321 páginas. SHA-256 `fba12d2dd0a19cb11cd670a922213aac5acdfb82db774dea187ed481430ffb53`.
- `DECRETO 59-2024.pdf`: modifica los dos (y el 64/2022 de Bachillerato). BOCM núm. 140, de 13-6-2024 (BOCM-20240613-2). SHA-256 `b77c3e24041b2e310c6079d895911c1f9e590c9cf42ede621203568ef43d734a`.
- `CORRECCION ERRORES DECRETO 59-2024.pdf`: BOCM núm. 145, de 19-6-2024 (BOCM-20240619-1). SHA-256 `c51bc48073a3ef6bda28ec94015840aad06d283da7a6f17bd5cac305763197d1`.

### Qué dice cada decreto

- 61/2022, artículo 7: áreas de Primaria en todos los cursos: Ciencias de la Naturaleza, Ciencias Sociales, Educación Artística, Educación Física, Lengua Castellana y Literatura, Lengua Extranjera: Inglés y Matemáticas. En quinto curso, además, Educación en Valores Cívicos y Éticos (solo en quinto, no en todo el tercer ciclo). Los centros pueden añadir Segunda Lengua Extranjera y Tecnología y Robótica. Religión, según el artículo 8.
- 61/2022, anexo II: por área y por ciclo, una tabla de competencias específicas con sus criterios de evaluación y otra de contenidos (bloque, apartado y conocimientos, destrezas y actitudes). A diferencia de la Comunitat Valenciana, los contenidos cambian de un ciclo a otro.
- 65/2022, anexo II: por materia, las competencias específicas en texto corrido y, por curso («1º ESO.»), los criterios de evaluación agrupados por competencia y los contenidos en bloques con letra.
- 59/2024: en Primaria solo cambia el artículo 9.1 (áreas en lengua extranjera). En la ESO cambia articulado y añade un último guion a los contenidos de Geografía e Historia (1º, 2º y 3º, letra B; 4º, letra D). Su corrección de errores solo toca la disposición adicional segunda de la ESO.
- El Decreto 94/2025 (jornada escolar) cita el artículo 28.1 del 61/2022 pero no lo modifica.

## Pendiente de decidir

- Nada por ahora. La entrega del currículo quedó decidida el 3-10-2026 (ver «Currículo en la app»).
