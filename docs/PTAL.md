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
  - Pictogramas: 323 de Mulberry Symbols (CC BY-SA 4.0), en `public/pictos/mulberry/` con su licencia, por categorías y con buscador, y con su nombre en castellano, català e inglés. Y 14 dibujados para AulaPro (`ap-`, en `public/pictos/aulapro/`, fuente en `scripts/pictos/propios/`) para las consignas de ficha que Mulberry no tiene: rodear, unir, subrayar, tachar, marcar, completar, ordenar, elegir, verdadero o falso, buscar palabras, palotes, tabla, regla y sumar. Esos no piden atribución.
  - Fotos del propio docente, reducidas a 480 px y guardadas en el perfil.
  - Se muestra a pantalla completa, tachando cada paso, y se guarda en PDF para imprimir y recortar.
  - La atribución va en Configuración (pie de la cuadrícula) y al pie del PDF si lleva algún pictograma.
  - Al vaciar el curso se quedan las agendas sin alumno, que son plantillas, y sus fotos.
  - La lista se cambia en `scripts/pictos/lista.py` y se regenera con `scripts/pictos/generar.py`. Fuera los que llevan palabras en inglés dibujadas.
  - ARASAAC, Sclera y Soy Visual no se pueden usar: su licencia no permite el uso comercial.
- **Aula Live**: para el perfil de PT y AL, la ruleta y los grupos salen de su alumnado de apoyo.

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
