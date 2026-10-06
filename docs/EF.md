# Educación Física

Para el profesorado de Educación Física, con o sin tutoría. Decisiones del dueño del 5-10-2026. Si una cambia, cámbiala aquí en el mismo cambio.

## Perfil

- Al crear el perfil, «Tipo de docente» → «Educación Física». Se cambia en Configuración → Perfil y al cambiar no se borra nada.
- Casilla «También soy tutor o tutora» (el 2 en 1). Su grupo es la clase en la que marque «Soy el tutor o la tutora de este grupo» en Mis Clases.
- En los datos: `tipoDocente: 'ef'` y `tutor` en el perfil; se leen con `tipoDePerfil` (`src/lib/tipoDocente.ts`).

## Menú e Inicio

- El menú de aula entero (clases, cuaderno, asistencia, evaluar con rúbricas y dianas, documentos, en clase) y, después del Inicio, el apartado «Educación Física» (`NAV_EF` en `src/lib/navigation.ts`).
- Inicio sin tutoría: el de siempre, adaptado a EF, con «Observar en la pista» en la clase de ahora y las tarjetas «Exentos y lesiones», «Próximas sesiones» y «Pruebas físicas».
- Pestañas del apartado: En la pista, Exentos y lesiones, Pruebas físicas, Equipos, Circuitos, Sesiones, Actividades y Material (su página se llama «Material e instalaciones»).
- Inicio con tutoría: el de tutoría tal cual.

## En la pista

- Observación rápida desde el móvil: se elige un aspecto y se toca a cada alumno; otro toque lo quita.
- Aspectos: participa, se esfuerza, no participa, juego limpio, mala actitud, sin equipación, sin aseo.
- Son anotaciones del cuaderno (`EF_MARK_TYPES` en `src/services/classMarks.ts`) y cuentan en el bloque «Trabajo diario y actitud». En EF sus partes se llaman «Vestimenta e higiene», «Actitud y juego limpio» y «Participación y esfuerzo».
- La asignatura de EF de una clase se reconoce por el nombre (`esAsignaturaEF`).

## Exentos y lesiones

- Qué no puede hacer (lista y texto libre), desde y hasta cuándo, qué hace mientras tanto, justificante y motivo.
- El motivo es un dato de salud: se queda en el equipo y nunca se envía a la IA.
- A la IA solo le llega la limitación, sin nombre, para que proponga medidas de inclusión basadas en el DUA-A. El texto libre («Otra») también le llega: su ejemplo pide escribirla sin el motivo (6-10-2026).
- Salen en la pista, en el Inicio y al hacer equipos. Los exentos participan en los equipos con su adaptación.

## Pruebas físicas

- De partida:
  - Resistencia: Course Navette y test de Cooper.
  - Velocidad y agilidad: 30 m y 4 × 10 m.
  - Fuerza: salto horizontal, lanzamiento de balón medicinal y dinamometría manual.
  - Flexibilidad: sit and reach.
- El docente puede ocultar estas pruebas y añadir las suyas.
- Por defecto, marcas y evolución de cada alumno respecto a sí mismo.
- Baremos opcionales, de dos fuentes:
  - Los del docente, por curso y, si quiere, por sexo. Se escriben a mano o se pegan desde una hoja de cálculo (`leerTramos`), y se copian de un curso a otro.
  - Uno publicado, solo si su licencia permite incluirlo en una app de pago.
- Estado de los baremos publicados (5-10-2026): la app todavía no trae ninguno. Las tablas candidatas (ALPHA-Fitness y HELENA, Ortega y otros, 2011, BJSM; Tomkinson y otros, 2018, BJSM) están en revistas con licencias que hay que comprobar una a una, y desde el entorno de trabajo no se pudieron consultar. Hasta comprobar que la licencia permite el uso comercial, la app dice «La app todavía no trae baremos publicados; puedes crear el tuyo o pegar el de tu departamento.»
- Con un baremo, la nota de cada marca sale del tramo en el que cae (`notaConBaremo`); «Al cuaderno» pasa esas notas a un instrumento del bloque que elija el docente.

## Equipos y circuitos

- Equipos equilibrados (`hacerEquipos` en `src/lib/ef.ts`):
  - Por el nivel de 1 a 3 que marca el docente (sin nivel cuenta como 2).
  - Mezclando chicos y chicas en la proporción de la clase.
  - Separando las parejas que no conviene juntar.
  - Cómo: reparto en serpiente y después intercambios de dos en dos mientras alguno mejore. Tamaños con un alumno de diferencia como mucho. Cada vez sale un reparto distinto.
  - Quien falta hoy según la asistencia se queda fuera si se marca «Sin quien falta hoy».
  - Los exentos juegan en su equipo y se ve su limitación y qué hace.
  - Los equipos llevan el color del peto y se guardan por clase (`ef.equipos`) hasta que se hacen otros. Se retocan tocando a dos alumnos, o con «Mover aquí».
  - «Proyectar» los enseña a pantalla completa sin niveles ni limitaciones.
- Cronómetro de circuitos (`fasesCircuito`):
  - Estaciones, trabajo, descanso, rondas y descanso entre rondas, con 10 segundos para colocarse.
  - A pantalla completa, con tres pitidos cortos en los últimos segundos y uno largo al cambiar de fase.
  - El color de fondo acompaña al rótulo (trabajo, descanso), nunca va solo.
  - Pausa, fase anterior y siguiente, sonido; con teclado, espacio y flechas.
  - Mientras corre pide que la pantalla no se apague (Wake Lock), si el dispositivo lo permite.

## Actividades y sesiones

- Banco de actividades (pestaña «Actividades»):
  - Tipos: juegos motrices, deportes (juegos modificados), días de lluvia, medio natural, calentamiento y vuelta a la calma.
  - Origen: el banco de partida, las del docente y las que guarda de la IA.
  - El banco de partida está en `src/lib/bancoEF.ts`: 29 actividades escritas para AulaPro, de uso común en las clases de EF y contadas con nuestras palabras (no se copian de ningún libro), en castellano, catalán e inglés. No se editan: «Copiar y adaptar» crea una del docente.
  - Cada actividad tiene en qué consiste, organización, material, variantes y «Para que participe todo el grupo (DUA-A)».
  - «Proponer con IA»: tres actividades de un tipo, para una clase y un tema, con el inventario y, si se marca, con las limitaciones de hoy de esa clase.
- Modalidades de juegos y deportes (decisión del dueño, 6-10-2026), cada una con su lógica y su preparación (`MODALIDADES_EF` en `src/lib/ef.ts`): invasión, red y pared (el «pared» del dueño, con red y muro), lucha, blanco y diana, cooperación, juegos tradicionales y populares, y medio natural y urbano.
  - Las actividades y las sesiones llevan su modalidad (`modalidad`), y Actividades filtra por ella y enseña su lógica y su preparación.
  - El banco de partida tiene al menos dos de cada modalidad; para lucha, blanco y diana, cooperación, tradicionales y urbano se añadieron seis (lucha de equilibrio, caídas y la tortuga, diana de aros, acrosport por tríos, la comba con canciones y ruta urbana con plano).
  - La IA recibe la lógica y la preparación de la modalidad al proponer actividades, al preparar una sesión (calentamiento específico; del banco, solo las de esa modalidad) y en la SdA de EF (la elige el docente o la IA, `modalidadDeportiva`).
- Sesiones (pestaña «Sesiones»):
  - Calentamiento, parte principal, vuelta a la calma, material, inclusión (DUA-A) y plan B, con su clase, día e instalación, y de 1 a 3 criterios de evaluación oficiales de la clase (se cambian con el buscador de criterios).
  - «Preparar con IA»: clase, día, instalación, minutos (del horario si la clase tiene tramo ese día) y qué se trabaja. La IA usa el currículo de la clase y su comunidad, el material que no está para reponer, las instalaciones cubiertas para el plan B y, si se marca, el banco. La sesión se revisa antes de guardarla.
  - PDF para imprimirla (Windows y Android).
- La IA (`src/services/efIA.ts`): marco con el currículo LOMLOE de la comunidad, el DUA-A, la normativa de inclusión y los autores de referencia:
  - Parlebas y Lavega (juegos y praxiología motriz).
  - Blázquez, Devís y Peiró (iniciación deportiva).
  - Fernández-Río (aprendizaje cooperativo).
  - López-Pastor (evaluación formativa).
  - Granero-Gallegos y Baena-Extremera (medio natural).
- Qué recibe la IA de quien está exento o lesionado: solo qué no puede hacer, una línea por alumno, sin nombre ni motivo (`limitacionesParaIA`). Contado en la política de privacidad y en las condiciones de la web.
- El marco pide texto sin formato pero con la ortografía completa. Con «texto llano», a secas, 3.5 Flash-Lite escribía sin tildes ni eñes (prueba con la IA real del 6-10-2026).

## Situaciones de aprendizaje

- Decisión del dueño (5 y 6-10-2026): un creador de situaciones de aprendizaje en el apartado de EF, hecho como el general de la app y con lo mismo: competencias específicas, criterios y saberes básicos del decreto de la comunidad (la IA elige de la lista real), competencias clave, objetivos de etapa, sesiones por fases, inclusión, evaluación, y después rúbrica, diana y ficha. Es la misma pantalla (`LearningSituations`), en la pestaña «Situaciones de aprendizaje» (`ef-sda`); las SdA se guardan con las demás.
- Si una de las áreas es Educación Física y el perfil es de EF, el formulario añade el bloque «Educación Física» y la petición lleva `ef` (`SdaPeticionEF` en `src/services/learningSituations.ts`):
  - Modalidad del juego o deporte, y modelo pedagógico, elegidos por el docente o por la IA de una lista cerrada (`src/lib/modelosEF.ts`): Aprendizaje cooperativo, Educación Deportiva, Enseñanza comprensiva del deporte, Responsabilidad personal y social, Educación en el medio natural, Juegos motores y educación emocional, e Hibridación de modelos.
  - El material, las instalaciones y las limitaciones de ahora de la clase, sin nombres.
  - Sesiones de EF (calentamiento, parte principal y vuelta a la calma), producto final motor, DUA-A y evaluación formativa y compartida.
- Estudios de autores publicados en abierto (petición del dueño): cada modelo lleva sus referencias, que pone la app, nunca la IA (se le prohíbe citar nada que no esté en las instrucciones y se descarta cualquier campo que no sea del esquema). Las diez referencias se comprobaron el 5-10-2026: REEFD (Fernández-Río y otros, 2016 y 2018; Calderón, Hastie y Martínez de Ojeda, 2011), Retos (Fernández-Río y Méndez-Giménez, 2016; Fernández-Río, 2017; Baena-Extremera y Granero-Gallegos, 2008), Cultura, Ciencia y Deporte (Abad Robles y otros, 2013), Apunts (Niubò-Solé, Lavega-Burgués y Sáenz-López, 2022), el libro de la Universidad de León (López-Pastor y Pérez-Pueyo, 2017) y las pautas DUA 3.0 de CAST (2024). Si se añade una, comprobarla antes.
- La SdA guarda `ef: { modelos, referencias, modalidad }`; el modelo, la modalidad y las referencias salen en la pantalla, en el PDF y en el Word.
- «Pasar a Sesiones de EF» copia cada sesión de la SdA a la pestaña Sesiones, sin fecha.

## Material e instalaciones

- Inventario del material: cantidad, estado (bien, regular, para reponer; se cambia desde la tabla) y dónde está. Arriba sale lo que hay que reponer.
- Instalaciones, con si son cubiertas (sirven con lluvia) y notas, para el plan B.
- La IA usa el material que no está para reponer y las instalaciones.

## Datos

- Todo va en `ef` del perfil (`src/types/ef.ts`, `src/lib/ef.ts`).
- Al vaciar el curso se queda el material del docente (pruebas, baremos, actividades, sesiones, material, instalaciones y circuitos) y se va lo del alumnado (exentos, niveles, sexos, parejas, equipos y marcas).
- Al borrar un alumno se va todo lo suyo de EF (`sinAlumnoEF`). Al borrar una clase, lo de todo su alumnado, también el motivo de las lesiones, y sus equipos; sus sesiones se quedan sin clase (`sinClaseEF`, desde el 6-10-2026; antes se quedaba huérfano).
- Datos de ejemplo: `src/lib/demoEF.ts`, con «Profesor» y «Alumno 1» a «Alumno 24».

## Lo que falta

- Baremos publicados: comprobar la licencia de ALPHA-Fitness y HELENA, y de Tomkinson y otros (2018), antes de incluir ninguno (ver «Pruebas físicas»).
- Los datos de ejemplo de EF están solo en castellano (como los de PT y AL); el banco de actividades sí está en los tres idiomas.
- El cronómetro no suena con la pantalla bloqueada: por eso pide que la pantalla no se apague mientras corre.
