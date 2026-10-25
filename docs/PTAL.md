# Módulo de PT y AL

Para el profesorado especialista de Pedagogía Terapéutica (PT) y de Audición y Lenguaje (AL). En la app desde la 2.1.0. Decisiones del dueño del 4-10-2026. Si una cambia, cámbiala aquí en el mismo cambio.

## Qué tiene que hacer

1. Ayudar a preparar las programaciones y los informes trimestrales a partir de los objetivos de los programas de cada alumno.
2. Un registro diario del trabajo del alumnado y de cómo responde: fácil, sencillo y accesible.
3. Contextualizar lo que propone la app con autores de referencia y con la normativa de inclusión de cada comunidad.

## Quién lo usa

- Solo el profesorado especialista. El perfil dice si es de PT, de AL o de las dos; el módulo aparece en el menú solo entonces.
- No se comparte con el tutor o la tutora por ahora.

## Perfil de PT y AL (5-10-2026)

Quien es de PT o de AL normalmente no es tutor, así que tiene su propia disposición de la app.

- **Tipo de docente.** Al crear el perfil se elige «Docente de aula» o «PT y AL». Con PT y AL se marca PT, AL o las dos (al menos una) y la especialidad del perfil se escribe sola. Se cambia en Configuración → Perfil; al cambiar no se borra nada. En los datos, un perfil es de PT y AL si tiene alguna especialidad (`especialidades`): no hay otro campo.
- **Más adelante:** Educación Física, con la opción de ser tutor a la vez («un 2 en 1»). Junto con la tutoría.
- **Menú** (`NAV_APOYO` en `src/lib/navigation.ts`): lo de apoyo y lo común, sin nada de tutoría.
  - Tu día a día: Inicio, Registro diario, Mi alumnado y Agenda.
  - Herramientas: Agenda visual, Recursos y Aula Live, cuya ruleta y grupos salen del alumnado de apoyo. Van separadas (decisión del dueño, 6-10-2026: no se juntan en un apartado «Materiales»).
  - Más: Reuniones, Formaciones, Registro de cambios y Configuración.
  - Todo va como entradas sueltas: Recursos y Aula Live no llevan las pestañas de Documentos y En clase, que ese menú no tiene.
- **Todo lo de un alumno, en su página** (decisión del dueño, 6-10-2026). Antes eran 7 entradas en «Tu día a día» y lo de un alumno estaba repartido en cinco pantallas, tres de las cuales pedían elegirlo otra vez. Ahora:
  - **Mi alumnado** (`src/pages/apoyo/AlumnadoApoyo.tsx`): dos pestañas, Alumnado (la lista, con cuántos objetivos del trimestre lleva conseguidos y cuántos avisos tiene) y Grupos (sus grupos de apoyo con su horario). Pulsar un alumno abre su página.
  - **Alumno y grupo en un solo paso** (decisión del dueño, 18-10-2026: «ahora por un lado se crea un alumno y un grupo de trabajo, etc.; simplifícalo»). Antes había que crear el alumno, ir a la pestaña Grupos, crear el grupo y marcarlo allí. Ahora «Nuevo alumno» y «Nuevo grupo» están siempre arriba y cada uno crea lo otro sin salir de su ventana:
    - **«Nuevo alumno»** (`EditarAlumno.tsx`) pide lo mínimo: nombre, clase, curso, nivel y el grupo de apoyo, que se marca entre los que hay o se crea ahí mismo con «Crear un grupo nuevo» (nombre, dentro o fuera del aula y horario; el alumno entra en él al guardar y, sin nombre, el grupo no se crea). Necesidades, diagnóstico y notas van plegados («Necesidades, diagnóstico y notas», abiertos al editar un alumno que ya existe): se completan después, desde su página.
    - **«Nuevo grupo»** deja escribir el nombre (y la clase) de un alumno nuevo y «Añadir»: se crea al guardar el grupo; si se quita del grupo antes de guardar, no se crea, y un nombre escrito sin pulsar «Añadir» se añade solo al guardar.
    - El horario se edita con el mismo componente en las dos ventanas (`src/components/apoyo/HorarioEditor.tsx`); `grupoVacio`, `horarioLimpio` y `horarioIncorrecto` están en `src/lib/apoyo.ts`.
  - **La página del alumno** (`src/pages/apoyo/AlumnoApoyo.tsx`, sección `apoyo-alumno`, que en el menú marca «Mi alumnado»): arriba, sus datos y tres botones, «Ficha adaptada» (Recursos, adaptada a él), «Agenda visual» (solo sus agendas; las nuevas, para él) y «Registrar sesión» (el registro de su grupo de ahora o de la siguiente sesión de hoy). Debajo, seis pestañas: Resumen (sus avisos, este trimestre, sus grupos, sus últimas sesiones y la última coordinación), Programa, Sesiones (lo anotado de él en el registro, por trimestre), Coordinaciones, Documentos y Datos (su ficha y sus grupos, que se marcan al momento).
  - Programa, Coordinaciones y Documentos son las pantallas de antes, solo de ese alumno (`ProgramasApoyo.tsx`, `CoordinacionesApoyo.tsx`, `DocumentosApoyo.tsx`), y se cargan al abrir su pestaña: Documentos lleva la librería de Word.
  - Se llega con `requestAlumno(id, pestaña)` de `src/lib/apoyoNav.ts`: desde la lista, desde los avisos y la evolución del Inicio (cada aviso abre la pestaña donde se resuelve) y desde el Registro diario. «← Mi alumnado», la entrada del menú y el botón atrás de Android vuelven a la lista.
- **Agenda:** el horario de los grupos de apoyo sale en la vista semanal sin apuntarlo dos veces. Pulsando un bloque se abre ese grupo en Mi alumnado, pestaña Grupos, donde se cambia.
- **Inicio** (`src/pages/apoyo/InicioApoyo.tsx`, lógica en `src/lib/inicioApoyo.ts`):
  - Sesiones de hoy, por hora, con «Registrar», que abre el registro de ese grupo y ese día.
  - Avisos de seguimiento:
    - los informes que faltan al final del trimestre (diciembre, desde el 10 de marzo y junio);
    - las sesiones de los últimos 7 días sin registrar, solo desde la primera registrada de cada grupo;
    - un objetivo con 3 «No conseguido» seguidos;
    - un objetivo del trimestre sin trabajar en 3 o más sesiones a las que vino;
    - el alumnado sin objetivos en el trimestre o sin grupo.
  - Evolución del alumnado: por alumno, sus objetivos del trimestre según lo último registrado (conseguido, en proceso, no conseguido, sin trabajar), y al desplegarlo, cada objetivo sesión a sesión.
  - Sin alumnado, tres pasos y «Probar con datos de ejemplo».
- **Datos de ejemplo** (`src/lib/demoApoyo.ts`): 4 alumnos inventados, uno con TEA y discapacidad motora, 4 grupos y sesiones de las dos últimas semanas. Las fechas se calculan desde hoy. Salen en el idioma de la app, con los programas del PAP valenciano en su nombre oficial (textos en `src/i18n/demo.ts`).

### Herramientas (5-10-2026)

- **Gráfica de cada objetivo** (`src/components/apoyo/GraficaObjetivo.tsx`): bajo cada objetivo en el programa de cada alumno, y en la evolución del Inicio. Un punto por sesión a tres alturas (conseguido, en proceso, no conseguido), las 24 últimas, con la fecha al pasar por encima.
- **Coordinaciones** (`src/pages/apoyo/CoordinacionesApoyo.tsx`, pestaña de la página del alumno):
  - De cada alumno: fecha, con quién (tutoría, familia, orientación, equipo docente u otros), quiénes estuvieron, de qué se habló y los acuerdos.
  - «Copiar todas para el PAP» las copia como texto.
  - Las del trimestre llegan a la IA en los informes, y todas en la programación. «Quiénes estuvieron» no se envía, porque puede llevar nombres de personas adultas.
- **Fichas adaptadas con IA**: en Recursos, «Adaptada a» un alumno de apoyo rellena su nivel y lo que se cuenta a la IA (sus necesidades específicas, cómo aprende y sus objetivos del trimestre). No se envían ni su nombre ni su diagnóstico, que para adaptar una ficha no hacen falta. Desde la página del alumno, «Ficha adaptada».
- **Fichas con instrucciones muy visuales** (decisión del dueño, 6-10-2026, con dos fichas de ejemplo para un alumno con TEA de grado 2):
  - Casilla «Instrucciones muy visuales, con pictogramas» al crear la ficha; se marca sola con un alumno en «Adaptada a». En una ficha hecha, «Adaptar» → «Versión visual». Una ficha visual sigue siéndolo en sus versiones de apoyo o lectura fácil.
  - Lo que lleva: letra grande, la consigna general en un recuadro amarillo, tarjetas con dibujo en la explicación y, en cada bloque, qué hay que hacer en una frase, de 2 a 4 pasos numerados con pictograma, verbo y detalle, y un recuadro «Recuerda». Cada ejercicio, el pictograma de su acción y, solo si ayuda, los dibujos que hay que contar o reconocer (intercalados, como en una ficha de recuento) o uno por fila de tabla.
  - La IA elige de dos listas cerradas (`src/lib/pictosFicha.ts`): consignas y dibujos. Lo que no está en el catálogo se cambia por el pictograma de su verbo o se quita. Se le pide que un dibujo sea exactamente lo que nombra (un gato no es un tigre).
  - Todo se edita a mano en el editor (`src/components/fichas/VisualEditor.tsx`) y sale igual en la vista previa, el PDF, el Word (los pictogramas, pasados a PNG) y Aula Live, con la atribución de Mulberry al pie cuando sale alguno suyo.
  - No llega a la IA nada nuevo del alumno: lo visual sale del catálogo de la app.
- **Agenda visual** (`src/pages/apoyo/AgendaVisualApoyo.tsx`):
  - Pictogramas: 323 de Mulberry Symbols (CC BY-SA 4.0), en `public/pictos/mulberry/` con su licencia, por categorías y con buscador, y con su nombre en castellano, català e inglés. Y 18 dibujados para AulaPro (`ap-`, en `public/pictos/aulapro/`, fuente en `scripts/pictos/propios/`) para las consignas de ficha que Mulberry no tiene: rodear, unir, subrayar, tachar, marcar, completar, ordenar, elegir, verdadero o falso, buscar palabras, palotes, tabla, regla y sumar, y, de inicio y fin de una actividad, terminado, pausa, repetir y cambio de actividad. Esos no piden atribución.
  - **Pictogramas hechos con IA** (`ia-`, 18-10-2026, ver la sección siguiente): iniciar y terminar una actividad, plastilina, praxias, calma… Tampoco piden atribución.
  - Fotos del propio docente, reducidas a 480 px y guardadas en el perfil.
  - Se muestra a pantalla completa, tachando cada paso, y se guarda en PDF para imprimir y recortar.
  - La atribución va en Configuración (pie de la cuadrícula) y al pie del PDF si lleva algún pictograma.
  - Al vaciar el curso se quedan las agendas sin alumno, que son plantillas, y sus fotos.
  - La lista se cambia en `scripts/pictos/lista.py` y se regenera con `scripts/pictos/generar.py`. Fuera los que llevan palabras en inglés dibujadas.
  - ARASAAC, Sclera y Soy Visual no se pueden usar: su licencia no permite el uso comercial.
- **Aula Live**: para el perfil de PT y AL, la ruleta y los grupos salen de su alumnado de apoyo.

### Pictogramas hechos con IA (18-10-2026)

Petición del dueño: más pictogramas con el MCP de fal.ai, por ejemplo usar plastilina, el inicio de una actividad y su fin. Y, tras ver la primera prueba: «que salgan bien y que parezcan pictogramas reales».

- **Qué hay.** Categorías nuevas en la agenda visual y en el editor de las fichas: «Inicio y fin» (inicio de la actividad, fin de la actividad, terminado, pausa, repetir, cambio de actividad), «Manipulativo» (plastilina, modelar con plastilina), «Lenguaje y habla» (hinchar las mejillas) y «Calma y convivencia» (manos quietas). 10 nuevos, de 337 a 347. En la lista de `scripts/pictos/ia/lista.mjs` hay 40 pensados, con sus nombres en los tres idiomas: faltan 34 por generar (ver «Lo que falta»).
- **El modelo.** `fal-ai/nano-banana-2` (1:1, 1K, unos 0,08 $ por imagen), con este prompt: `ESTILO` + el concepto de cada fila (`lista.mjs`). Salen en el estilo de ARASAAC o Mulberry: contorno negro grueso, colores planos, un solo concepto, sin texto. Es una decisión del dueño, hecha con un coste mayor por imagen, para que salgan como pictogramas.
- **Lo que no funcionó, para no repetirlo** (probado el mismo día):
  - `fal-ai/flux/schnell`, el de las ilustraciones: da ilustraciones, no pictogramas. Escribió «START» y «repec» en un botón, puso degradados y sombras, hizo una foto de plastilina, no dibujó la acción (las mejillas, los morritos) y una de las manos salió con el dedo corazón levantado. No se usa para pictogramas.
  - `fal-ai/recraft/v4.1/text-to-vector` (SVG de verdad, 0,08 $): el trazo es limpio y uniforme, pero entiende peor lo que se dibuja (la plastilina salió como tres libros, las manos eran formas sueltas) y no se puede traer el SVG a la app sin descargar de `fal.media`. Sirve para iconos abstractos, no para acciones con personas.
  - Con Nano Banana 2 los 6 de la prueba salieron bien a la primera.
- **Los símbolos sin personas se dibujan a mano en SVG** (`scripts/pictos/propios/`: terminado, pausa, repetir y cambio de actividad, con los 14 de las consignas): el modelo inventa letras y degradados en los símbolos abstractos, y el SVG es exacto y nítido al imprimir.
- **Licencia.** Se entiende que lo que genera Nano Banana 2 se puede usar comercialmente (términos de Google para su API; la imagen lleva la marca de agua invisible SynthID), pero no se ha leído el texto de la licencia en esta sesión. **Pendiente de que el dueño lo confirme** como se hizo con FLUX schnell (el script de las ilustraciones se niega a usar un modelo sin licencia comercial revisada, `MODELOS_PERMITIDOS`); esta ruta no tiene esa guarda, así que no se cambia de modelo sin revisarlo. Sin atribución ni nota en las condiciones más allá de «el resto se han dibujado para AulaPro».
- **Cómo se añaden** (`scripts/pictos/ia/`):
  1. Una fila en `lista.mjs`: `[id, categoría, castellano, català, inglés, concepto en inglés]`. Los conceptos dicen la acción con un niño o una niña y evitan letras, números y cantidades.
  2. Se genera con el conector MCP de fal en una sesión de Claude (`submit_jobs`, 1:1, 1K, 8 a 8) y se mira cada resultado con `inspect_images`, que lo deja como archivo local (este entorno no deja descargar de `fal.media`). Hay que mirarlos uno a uno: se repite el que no se entiende (una acción sin la acción, texto, un gesto inadecuado).
  3. `node scripts/pictos/ia/importar.mjs id=archivo,id=archivo` quita el fondo blanco, recorta, cuadra a 512 px y guarda `public/pictos/aulapro/ia-<id>.webp` (unos 30 KB; el recorte es `scripts/ilustraciones/fondo.mjs`).
  4. Se añade a `scripts/pictos/lista.py` con «!» (`('!plastilina', …)`) y `python3 scripts/pictos/generar.py -` reescribe `src/lib/pictos.ts`. El `-` evita necesitar Mulberry a mano; sin él, la carpeta de Mulberry clonada.
- **En la app.** `urlPicto` da el `.webp` de los `ia-`; `esMulberry` es falso para `ap-` e `ia-` (la atribución no sale por ellos); `pictoComoDato` (`exportAgenda.ts`) incrusta el WebP en el PDF y el Word lo pasa a PNG como las ilustraciones. Las categorías «Inicio y fin», «Lenguaje y habla» y «Calma y convivencia» no se ofrecen a la IA como dibujo dentro de un ejercicio (`FUERA_DE_FICHA`): son para la agenda; el material manipulativo sí.
- **Lo que falta.**
  - La fal.ai se quedó sin saldo durante esta tarea (balance agotado): los 34 de la lista que no están se generan cuando haya crédito (unos 3 $ con los que salgan mal a la primera). Están en la lista con su concepto: levantar la mano, guardar el trabajo, pedir un descanso, puzle, bloques, enhebrar, pinzas, rasgar, arrugar y doblar papel, pintar con los dedos, bandeja de arena, abrochar botones, atar los cordones, cremallera, tarjetas, juego de mesa, instrumentos, espejo, sacar la lengua, hacer morritos, abrir la boca, coger aire por la nariz, soplar la vela, notar la voz en la garganta, micrófono, decir la palabra, contar un cuento, mirar mi boca en el espejo, dar palmadas a las sílabas, respirar hondo, rincón de la calma, abrazo y mirar a los ojos.
  - «Fin de la actividad» salió con una marca verde algo irregular: se puede repetir.
  - Sin ver en la app la agenda visual y el PDF con los nuevos: la sesión que lo hizo no tenía pantalla; sí se probó que cada archivo existe y que el PDF los incrusta (`exportAgenda.test.ts`). El Word los pasa a PNG con la misma función que las ilustraciones WebP, pero no se ha ejecutado con estos.

## El flujo real del curso y lo que falta (25-10-2026)

Lo cuenta el dueño, que conoce el trabajo de un PT: **la tarea se resume en una programación anual individual de cada alumno, hecha a partir del informe sociopsicopedagógico que aporta el orientador del centro**. De ella salen los objetivos de cada alumno, que se evalúan trimestre a trimestre; con la programación y su evaluación trimestral se hace **un informe que se entrega a los tutores y a las familias**. Lo difícil y lo que más tiempo quita son las programaciones y los informes trimestrales de cada alumno. Para saber cómo avanza, se registra cada sesión. Y en las sesiones se **adapta la programación de aula del tutor o la tutora** teniendo en cuenta los objetivos de cada alumno; lo ideal sería que, **a partir del informe psicopedagógico, la app pudiera crear esa programación de aula adaptada**. Objetivo: reducir la carga burocrática.

Resumen de la revisión (qué hay, qué falta). Ver también «Qué tiene que hacer» arriba.

| Paso del curso | Estado |
|---|---|
| Informe sociopsicopedagógico del orientador | **Hecho (2.18.24).** Se sube (PDF o Word) o se pega, la IA propone la ficha, el docente revisa y guarda. Ver «El informe del orientador». |
| Programación anual individual | Está (`programacion`, un documento por alumno) y se redacta con la IA; **desde la 2.18.24 también con las fortalezas y orientaciones del informe**, porque `alumnoParaIA` las incluye. |
| Objetivos por trimestre | Están (`ProgramaApoyo.objetivos`, `proponerObjetivos`), con criterios oficiales del curso de su nivel. **Desde la 2.18.24, con un clic desde el informe**: la IA sugiere los programas y propone sus objetivos. |
| Registro de cada sesión | Está y es cómodo. Alimenta las gráficas, los avisos y los informes. |
| Evaluación trimestral | **Hecho (2.18.24).** Pestaña «Evaluación» del alumno: el cierre del trimestre. Ver «El cierre del trimestre». |
| Informe trimestral a tutor y a familia | Están los dos y el seguimiento del PAP (Comunitat Valenciana), en PDF y Word. **Desde la 2.18.24 también de todo el alumnado de una vez** (Mi alumnado › «Documentos del trimestre»). Ver «Documentos de todo el alumnado». |
| Programación de aula adaptada | **No está.** `adaptarTema` propone, en cada sesión, cómo trabajar el tema del día con cada alumno, pero no hay forma de dar la programación del tutor (PDF, Word o una situación de aprendizaje) ni de obtener una adaptación curricular del alumno (ACI o ACIS, y el equivalente de Cataluña y Madrid). |
| Cataluña y Madrid | Los modelos de documento (PI, adaptación curricular por área) esperan a que el dueño suba los PDF (ver «Normativa»). |

Lo que se propone construir, por orden de ahorro de trabajo (**el dueño eligió empezar por 1, 2 y 3, hechos en la 2.18.24, y después el 4, hecho también en la 2.18.24**):
1. **Informe sociopsicopedagógico.** Subirlo (PDF o Word) o pegarlo; la IA lo lee una vez y rellena la ficha del alumno (nivel de competencia, necesidades en términos educativos, fortalezas, orientaciones), que el docente revisa. El informe en sí no se guarda en la IA ni se reenvía a ella en cada documento: se guardan sus conclusiones. Es el dato más sensible del módulo (artículo 9 del RGPD): mismas reglas que el diagnóstico, nombre cambiado por un código, y `privacidad.html` lo dice en los tres idiomas (regla 1 de `CLAUDE.md`).
2. **Programación anual y objetivos a partir de ese informe**, sin volver a escribirlos: la programación y la propuesta de objetivos usan sus conclusiones.
3. **Cierre de trimestre** por alumno: una tabla con cada objetivo, el resultado que sugiere el registro y el comentario, que el docente confirma; los no conseguidos pasan al trimestre siguiente. Informes y PAP salen de ahí.
4. **Generar los documentos de todo el alumnado de una vez** (el informe a familias y al tutor del trimestre y el seguimiento del PAP), con una revisión alumno a alumno antes de exportar.
5. **Adaptación de la programación de aula**: dar la del tutor (PDF, Word o una SdA hecha en la app) y obtener, para cada alumno, la adaptación de esa programación a sus objetivos (ACI o ACIS). Cuando el dueño suba los modelos, con el formato de cada comunidad.

### El informe del orientador (2.18.24, 25-10-2026)

- **Dónde:** pestaña «Datos» de la página del alumno, tarjeta «Informe del orientador» (`src/pages/apoyo/InformeOrientacionApoyo.tsx`, servicio `src/services/informeOrientacion.ts`).
- **Cómo:** se sube un PDF, un Word (.docx) o un texto, o se pega su contenido. La IA lo lee una vez (`analizarInforme`) y propone: necesidades específicas de apoyo educativo (de la lista cerrada), diagnóstico, necesidades en términos educativos, nivel de competencia curricular, fortalezas, orientaciones y los programas (ámbitos) que hace necesarios (de los de su comunidad). **El docente lo revisa y lo edita antes de guardar**; guardar sustituye esos campos de la ficha.
- **Qué se guarda:** solo las conclusiones (`AlumnoApoyo.informe`: fecha, nombre del archivo, fortalezas, orientaciones y ámbitos sugeridos). **El informe no se guarda en la app.** Las fortalezas y orientaciones llegan a la IA en todo lo que se prepara del alumno (objetivos, adaptación de cada sesión, programación, informes y PAP) a través de `alumnoParaIA`.
- **Privacidad:** es el dato más sensible del módulo. Un Word o un texto pegado llegan a la IA con el nombre cambiado por un código; **un PDF se envía como archivo, tal cual** (con el nombre que lleve), y la ventana lo avisa y propone pegar el texto. `privacidad.html` y `docs/WEB.md` lo dicen (regla 1).
- **De ahí, los programas:** «Crear sus programas y objetivos desde el informe» crea un programa por cada ámbito sugerido y la IA propone sus objetivos (`proponerObjetivos`, de 4 a 6, por trimestres y con criterios del curso de su nivel). Se revisan en la pestaña «Programa».
- **Sin comprobar con informes reales**: la calidad de lo que extrae depende de cómo esté escrito cada informe de orientación; conviene probarlo con uno anonimizado.

### El cierre del trimestre (2.18.24, 25-10-2026)

- **Dónde:** pestaña «Evaluación» de la página del alumno (`src/pages/apoyo/CierreTrimestreApoyo.tsx`; lógica en `src/lib/apoyo.ts`: `filasDeCierre`, `cerrarTrimestre`, `trimestreCerrado`).
- **Qué hace:** por trimestre, cada objetivo con lo que dice el registro (cuántas veces conseguido, en proceso o no) y la valoración que sugiere (lo último registrado). El docente la confirma o la cambia (conseguido, en proceso, no conseguido o sin trabajar), añade un comentario y marca si se sigue trabajando el trimestre siguiente (se propone con lo que no está conseguido). Guardar escribe `ApoyoData.evaluaciones` y añade el trimestre siguiente a los objetivos que se siguen; nunca quita trimestres.
- **Qué cambia en los documentos:** con el trimestre cerrado, la valoración del especialista manda sobre el registro en los informes a familia y tutor y en el PAP (`datosParaIA`: «VALORACIÓN FINAL DEL ESPECIALISTA»), y los objetivos que quedan abiertos al acabar el curso salen de ella. Sin cerrar, funciona como antes y «Documentos» avisa y lleva al cierre.

### Documentos de todo el alumnado (2.18.24, 25-10-2026)

- **Dónde:** Mi alumnado › «Documentos del trimestre» (`src/pages/apoyo/InformesLoteApoyo.tsx`; lógica en `src/services/apoyoLote.ts`).
- **Qué hace:** se elige el documento (programación, informe a la familia, informe al tutor o al equipo, seguimiento del PAP), el trimestre y el alumnado; cada alumno indica si el trimestre está cerrado y si ya tiene el documento. Se prepara **de uno en uno** con la IA, guardando cada documento al acabar (si se corta, no se pierde lo hecho) y con «Parar al acabar este». Quien no tiene programas no se puede elegir. Al acabar, un enlace por alumno abre su pestaña «Documentos» para revisarlo, retocarlo y exportarlo.
- **Qué no hace:** no envía nada a nadie ni exporta solo; los documentos quedan como borradores de la app. Si ya tenían el documento, avisa y lo sustituye (el PAP conserva las columnas de los otros trimestres).
- Las materias del nivel de cada alumno se abren sin pantalla (`src/lib/curriculum/materiasDeNivel.ts`).

## Alumnado y grupos de apoyo

- El especialista crea sus grupos de apoyo («Lectoescritura, lunes 9:00») con alumnado de distintas clases.
- Es un alumnado aparte del de «Mis clases»: el especialista no tiene esas clases.
- De cada alumno se guarda:
  - el nombre y la clase de origen (texto, por ejemplo «2º B»);
  - la etapa y el curso en que está matriculado;
  - el nivel de competencia curricular (etapa y curso de referencia);
  - el diagnóstico;
  - sus necesidades específicas de apoyo educativo, todas las que tenga (decisión del 5-10-2026, desde la 2.2.0; hasta la 2.1.0 era una sola). Se marcan de una lista en dos grupos: las necesidades educativas especiales por lo que las origina (discapacidad intelectual, motora, auditiva o visual, TEA, trastorno grave de conducta o de la comunicación y del lenguaje, pluridiscapacidad) y el resto de las de la LOE, artículo 71.2, con el TDAH y las dificultades específicas de aprendizaje por separado. Se puede añadir otra a mano;
  - las necesidades, dichas en términos educativos;
  - las notas del docente.

## Programas personalizados

Es el plan individual de cada alumno: por ámbito, objetivos por trimestre.

- En la Comunitat Valenciana, los ámbitos son las medidas del apartado D del PAP (Documento 7) que lleva el profesorado de PT y AL, con sus nombres literales y en castellano o en valenciano según el idioma de la app:
  - Programa personalizado para la adquisición y uso funcional de la comunicación, el lenguaje y el habla.
  - Programa personalizado para el aprendizaje de la lectura y la escritura.
  - Programa personalizado para el aprendizaje de las matemáticas.
  - Programa personalitzat para el desarrollo de la autonomía personal (así, con «personalitzat», en la versión castellana del modelo).
  - Programa específico de conducta o plan terapéutico.
  - Adaptación curricular individual significativa (ACIS).
  - Se dejan fuera las medidas que no son de PT ni de AL: el programa de aprendizaje motor y movilidad, la accesibilidad personalizada, el enriquecimiento para altas capacidades, el acompañamiento ante violencia y desprotección y el itinerario de FP.
- En las demás comunidades, ámbitos de partida que cada docente puede editar:
  - **PT:** lectoescritura; razonamiento lógico-matemático; atención, memoria y funciones ejecutivas; autonomía personal; habilidades sociales y regulación emocional.
  - **AL:** fonética y fonología; morfosintaxis; semántica y vocabulario; pragmática; voz y fluidez; discriminación auditiva; conciencia fonológica; comunicación aumentativa y alternativa.
- Los objetivos de las áreas pueden enlazarse con criterios de evaluación del currículo de su comunidad en el curso de su nivel de competencia: un alumno de 4º con nivel de 2º trabaja criterios de 2º. Los ámbitos sin área (atención, pragmática…) van libres.
- La IA propone los objetivos; el docente los cambia.

## Programación del aula de apoyo

La del aula de apoyo sigue lo que da la clase de referencia en cada sesión, así que no puede cerrarse por unidades.

- Programación anual por ámbitos, con los objetivos de cada alumno.
- En cada sesión, el docente apunta qué trabaja la clase de referencia, y la IA propone cómo adaptarlo a los objetivos de cada alumno. Está en el registro diario: «Cómo adaptarlo a cada alumno, con IA» deja en la ficha de cada alumno que ha venido una «Propuesta para hoy» que se puede retocar, y se guarda con la sesión.

## Registro diario

- Por sesión: fecha, grupo y tema de la clase de referencia.
- Por alumno:
  - cada objetivo trabajado, con conseguido, en proceso o no conseguido;
  - atención, motivación, conducta y autonomía, con tres caras;
  - una nota escrita o dictada.
- En el móvil o la tableta, un alumno por pantalla con botones grandes. En el ordenador, todo el grupo a la vista, una ficha por alumno. Se usan los dos por igual.
- Se guarda solo; una sesión sin nada anotado no se guarda. El trimestre sale de la fecha: de septiembre a diciembre el 1º, de enero a marzo el 2º, de abril en adelante el 3º (sin calendario escolar, que sigue pendiente).
- Dictado: el micrófono explica cómo dictar con el propio sistema (Windows + H, el micrófono del teclado en Android). La app no usa el reconocimiento de voz del navegador, que enviaría el audio a Google y no está en la política de privacidad.

## Documentos

Todos los prepara la IA a partir de los objetivos de los programas y del registro, y el docente los edita.

- **Seguimiento del plan individual.** En la Comunitat Valenciana, el especialista rellena solo el apartado I del PAP:
  - por cada medida de respuesta, el 1º, 2º y 3º trimestre y la propuesta para el curso siguiente (finaliza o continúa);
  - el progreso global del alumnado;
  - la propuesta de nuevas medidas para el curso siguiente.

  El formato del plan individual cambia con la comunidad: PAP en la Comunitat Valenciana, pla de suport individualitzat (PI) en Cataluña y, en Madrid, adaptación curricular por área.
- **Informe trimestral al tutor o al equipo.** Documento aparte, que se adjunta al PAP. Mientras no llegue el modelo del dueño, uno técnico: asistencia a las sesiones, evolución de cada objetivo, respuesta en las sesiones y propuestas para el aula de referencia.
- **Informe trimestral a la familia** (decisión del 4-10-2026), en lenguaje para familias, con cuatro apartados: lo trabajado y cómo avanza; cómo ha respondido (atención, motivación, conducta y autonomía); orientaciones para casa; objetivos del próximo trimestre.
- **Programación** (decisión del 4-10-2026): una por alumno, con el conjunto de sus programas. Lleva sus datos y su horario de apoyo, la justificación con la normativa y los autores, sus necesidades y punto de partida, los objetivos de cada ámbito por trimestre con sus criterios oficiales, la metodología, los recursos, la coordinación y la evaluación.
- Los datos (objetivos, criterios, recuentos del registro, asistencia, horario) los pone la app tal cual; la IA solo redacta, a partir de esos datos, y no puede inventar logros.

## Datos y IA

- El diagnóstico y la categoría NEAE son datos de salud de menores (artículo 9 del RGPD).
- Decisión del dueño (4-10-2026): la IA los recibe, siempre con el nombre cambiado por un código, como el resto.
- Por la regla 1 de `CLAUDE.md`, `web/sitio/privacidad.html` lo dice en los tres idiomas (apartado 2 de la aplicación), con que si no se quiere enviar el diagnóstico se deja en blanco; `web/sitio/condiciones.html` remite a la privacidad en «Requisitos»; y `docs/WEB.md`, sección 3, punto 8. Hecho en el mismo cambio que los programas, la primera pantalla que lo envía.
- La ficha del alumno avisa de lo mismo debajo del diagnóstico.
- Todo se guarda en el equipo del docente, como el resto de la app.

## Normativa

Se copian literalmente los nombres de los documentos, de las medidas y de sus apartados. Los PDF van en la carpeta `Inclusión` de cada comunidad.

**Comunitat Valenciana.** El dueño sube los PDF; el DOGV no se abre desde el entorno de Claude.
- Decreto 104/2018, de 27 de julio, del Consell, por el que se desarrollan los principios de equidad y de inclusión en el sistema educativo valenciano. Pendiente.
- Orden 20/2019, de 30 de abril, por la que se regula la organización de la respuesta educativa para la inclusión del alumnado en los centros docentes sostenidos con fondos públicos del sistema educativo valenciano. Pendiente.
  - El DOGV núm. 10131, de 16-6-2025, cita las dos como vigentes.
- Decreto 72/2021, de organización de la orientación educativa y profesional. Título exacto por confirmar con el PDF. Pendiente.
- Resolución de instrucciones de inicio del curso 2026-2027, por la organización de PT y AL. Pendiente.
- Documento 7, Plan de actuación personalizado (PAP), de la Conselleria (IA-180463, 18-1-2022). En `docs/Normativa Comunitat Valenciana/Inclusión/DOCUMENTO 7 PAP.pdf`.

**Cataluña.** El dueño sube los PDF.
- Decret 150/2017, de 17 d'octubre, de l'atenció educativa a l'alumnat en el marc d'un sistema educatiu inclusiu: mesures i suports universals, addicionals i intensius, y el pla de suport individualitzat (PI). Pendiente.
- Orientacions per a l'elaboració del pla de suport individualitzat, del Departament d'Educació. Pendiente.
- El apartado de atención educativa inclusiva de los «Documents per a l'organització i la gestió dels centres» del curso 2026-2027. Pendiente.

**Madrid.** Bajados del BOCM.
- Decreto 23/2023, de 22 de marzo, del Consejo de Gobierno, por el que se regula la atención educativa a las diferencias individuales del alumnado en la Comunidad de Madrid (BOCM núm. 71, de 24-3-2023). En `docs/Normativa Comunidad de Madrid/Inclusión/DECRETO 23-2023.pdf`.
  - Medidas ordinarias (artículo 8) y específicas (artículo 9).
  - Para el alumnado con NEE (artículo 12): una adaptación curricular por área, que es significativa si va a ciclos o cursos anteriores, y el apoyo del profesorado de PT y AL según el dictamen de escolarización.
  - El «documento individualizado» del artículo 23.2 es para las dificultades específicas de aprendizaje.
  - El Plan Incluyo es el plan del centro (artículos 32 a 35).
- Orden 2808/2023, de 30 de julio, por la que se regula la escolarización y la atención educativa a las diferencias individuales del alumnado en centros de educación especial y unidades de educación especial en centros ordinarios, así como la escolarización combinada en la Comunidad de Madrid (BOCM núm. 189, de 10-8-2023). En `docs/Normativa Comunidad de Madrid/Inclusión/ORDEN 2808-2023.pdf`. Solo para esas modalidades.
- Falta saber qué documento usa el especialista con el alumnado con NEE en un centro ordinario. Lo dirá el modelo que suba el dueño.

**Resto de comunidades.**
- Ley Orgánica 2/2006, de Educación, modificada por la LOMLOE: título II, capítulo I, alumnado con necesidad específica de apoyo educativo (artículos 71 a 79 bis).
- Real Decreto 157/2022, artículo 16, y Real Decreto 217/2022, artículo 19: atención a las diferencias individuales.

## Autores de referencia

Orientan lo que propone la IA. Lista revisada por el dueño el 4-10-2026.

- **Inclusión:**
  - Diseño Universal para el Aprendizaje (CAST: Meyer, Rose y Gordon; en España, Alba Pastor).
  - Booth y Ainscow (Index for Inclusion).
  - Echeita.
  - Pujolàs (aprendizaje cooperativo).
  - Vygotsky (zona de desarrollo próximo).
- **PT:**
  - Cuetos (lectura y escritura).
  - El apoyo conductual positivo.
- **AL:**
  - Bloom y Lahey (forma, contenido y uso).
  - Acosta y Moreno.
  - Monfort y Juárez.
  - Aguado (trastorno del desarrollo del lenguaje).
- **Comunicación aumentativa y TEA:**
  - Basil y Soro-Camats.
  - Rivière.
  - El modelo TEACCH.

## Pendiente del dueño

- Los PDF de la normativa de la Comunitat Valenciana y de Cataluña.
- Los modelos de documentos, en blanco y sin datos de alumnado:
  - el informe trimestral al tutor o al equipo;
  - el informe trimestral a la familia, si el centro tiene uno;
  - el PI de Cataluña;
  - el documento de Madrid.
