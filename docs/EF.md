# Educación Física

Para el profesorado de Educación Física, con o sin tutoría. Decisiones del dueño del 5-10-2026. Si una cambia, cámbiala aquí en el mismo cambio.

## Perfil

- Al crear el perfil, «Tipo de docente» → «Educación Física». Se cambia en Configuración → Perfil y al cambiar no se borra nada.
- Casilla «También soy tutor o tutora» (el 2 en 1). Su grupo es la clase en la que marque «Soy el tutor o la tutora de este grupo» en Mis Clases.
- En los datos: `tipoDocente: 'ef'` y `tutor` en el perfil; se leen con `tipoDePerfil` (`src/lib/tipoDocente.ts`).

## Menú e Inicio

- El menú de aula entero (clases, cuaderno, asistencia, evaluar con rúbricas y dianas, documentos, en clase) y, después del Inicio, el apartado «Educación Física» (`NAV_EF` en `src/lib/navigation.ts`).
- Inicio sin tutoría: el de siempre, adaptado a EF, con «Observar en la pista» en la clase de ahora y las tarjetas «Exentos y lesiones», «Próximas sesiones» y «Pruebas físicas».
- **Portada con cuatro tarjetas** (decisión del dueño, 17-10-2026: «tiene muchas pestañas»): entrar en «Educación Física» desde el menú abre siempre `EfInicio` (`ef-inicio`, `portada` en `lib/navigation.ts`), con cuatro tarjetas grandes, una por tema, y dentro de cada una todas sus herramientas con una línea de lo que hace cada una:
  - **Con el grupo**: En la pista, Equipos y Cronómetro de circuitos (antes «Circuitos»).
  - **Alumnado**: Exentos y lesiones (con los niveles de respuesta II y III) y Pruebas físicas.
  - **Preparar las clases**: Actividades, Sesiones y Situaciones de aprendizaje.
  - **Circuitos y material**: Pizarra de circuitos y Material e instalaciones.
  Cada tarjeta acaba con un dato (clases con equipos, exentos de hoy, actividades y sesiones tuyas, pizarras y material).
- **Barra de pestañas reducida**: diez pestañas seguidas eran demasiadas. En la portada la barra solo lleva «Resumen»; en una pantalla lleva «Resumen» y las pestañas de su tema, con el nombre del tema junto al del apartado (`grupo` y `grupos` en `NavHub`, `HubTabs`). Si se añade una pantalla a EF, hay que ponerla en un tema, en `navigation.ts` y en una fila de `EfInicio`; la prueba de `EfInicio` comprueba que cada pantalla sale en alguna tarjeta.
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

## Niveles de respuesta II y III

- Decisión del dueño (6-10-2026): las medidas DUA-A tienen en cuenta al alumnado con medidas de nivel II o III de respuesta para la inclusión de la Comunitat Valenciana (Decreto 104/2018, art. 14; Orden 20/2019). El dueño eligió estos niveles, y no los grados del DSM-5 ni los suports catalanes, y que a la IA lleguen el nivel y lo que necesita, sin diagnóstico.
  - Nivel II: medidas generales del grupo-clase, con apoyos ordinarios. Nivel III: respuesta diferenciada, individual o en grupo, con apoyos ordinarios adicionales (refuerzo, adaptaciones de acceso que no impliquen materiales singulares ni personal especializado…). El nivel IV (apoyos especializados) no se marca aquí.
  - El texto de los niveles sale del artículo 14 tal como lo recogen varias fuentes; el DOGV no se pudo abrir desde la sesión (red bloqueada). Pendiente: cotejarlo con el PDF del Decreto 104/2018 (DOGV del 7 de agosto de 2018, https://dogv.gva.es/datos/2018/08/07/pdf/2018_7822.pdf) y guardarlo en `docs/Normativa Comunitat Valenciana/Inclusión/`.
- En «Exentos y lesiones», debajo, «Niveles de respuesta II y III» (`EfApoyos`): alumno, nivel y lo que necesita en EF, con una lista (`NECESIDADES_EF`: anticipar la sesión, rutinas, instrucciones cortas, apoyos visuales, señales visuales, un compañero de referencia, más tiempo, material adaptado, ayuda para desplazarse, pocos estímulos, un sitio para calmarse, normas claras) y otra escrita a mano, sin diagnóstico. Uno por alumno, para todo el curso. Los números son los valencianos, pero cada nivel lleva su descripción para que se entienda en cualquier comunidad.
- La IA: `alumnadoParaIA` une, por alumno y en una línea sin nombre, lo que no puede hacer ese día y su nivel con lo que necesita. Va en «Proponer con IA», «Desde una foto», «Preparar con IA» y la SdA de EF. El marco (`NIVELES_PARA_IA`) dice qué pide cada nivel: en el II, el DUA-A pensado para todo el grupo; en el III, además, una medida concreta para ese alumno, dentro de la misma actividad. La cuenta «con limitación» de la lista de sesiones sigue siendo solo de exentos y lesionados (`limitacionesParaIA`).
- Se van con el alumno, con su clase y al vaciar el curso. La privacidad lo dice en los tres idiomas.

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
- Estado de los baremos publicados (comprobado el 11-10-2026): la app no trae ninguno, porque ninguna de las tablas candidatas permite el uso en una app de pago:
  - Tomkinson y otros (2018), «European normative values for physical fitness in children and adolescents aged 9–17 years», BJSM 52(22), 1445-1456: no es de acceso abierto; los repositorios lo dan como «In Copyright».
  - Ortega y otros (2011), HELENA, «Physical fitness levels among European adolescents», BJSM 45(1), 20-29: no es de acceso abierto, con los derechos de la revista.
  - Ortega y otros (2023), FitBack, «European fitness landscape for children and adolescents», BJSM 57(5), 299-310, la versión actual de los valores de la batería ALPHA-Fitness (6 a 18 años): acceso abierto, pero CC BY-NC 4.0, que prohíbe el uso comercial.
  - El manual de ALPHA-Fitness (Ruiz y otros, 2011): no se encontró ninguna licencia que permita reutilizar sus tablas.
  - La única vía es pedir permiso por escrito a los autores (para FitBack, el grupo PROFITH de la Universidad de Granada) o a la revista. Es tarea del dueño; si llega el permiso, se incluye con la cita y el permiso anotado aquí. Mientras, la app dice «La app todavía no trae baremos publicados; puedes crear el tuyo o pegar el de tu departamento.»
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
  - «Desde una foto» (decisión del dueño, 6-10-2026): el docente elige o hace una foto de un deporte, un juego, un circuito, un esquema o la página de un libro, y la clase. La IA dice lo que ve («Lo que ve la IA») y redacta la actividad para la edad de esa clase (`edadAproximada`: de 1º de Primaria, 6 a 7 años, a 4º de ESO, 15 a 16), con reglas, organización y seguridad, material, variantes, DUA-A, tipo y modalidad (`actividadDesdeFoto` en `src/services/efIA.ts`). Si la foto no muestra una actividad física, lo dice y no inventa ninguna; de un libro no copia el texto. La foto va reducida y sin metadatos (`fotoParaIA` en `src/lib/fotos.ts`) y no se guarda; la pantalla y la privacidad piden no usar fotos en las que se reconozca al alumnado.
  - «Desde un manual (PDF)» (petición del dueño, 17-10-2026): el docente adjunta el PDF de un libro, de su departamento o de un curso (hasta 19 MB, como el asistente del Cuaderno), elige la clase (para la edad) y, si el manual es largo, las páginas que interesan. La IA saca las actividades prácticas (como mucho 25 por vez; más no cabe en una respuesta), las **clasifica por tipo y por modalidad** de las listas cerradas, las redacta con sus palabras (no copia el texto del libro), las adapta a la edad y añade el DUA-A si el manual no lo trae (`actividadesDesdeManual` en `src/services/efIA.ts`). Salen agrupadas por tipo, con una casilla en cada una; las que ya tiene con ese título salen sin marcar. Si la respuesta se corta, se queda con las actividades que llegaron enteras; si el PDF no tiene actividades prácticas, lo dice. El PDF va a Google y no se guarda; la pantalla y la privacidad piden no usar documentos con datos del alumnado. No se lee el PDF en el equipo: Gemini lo recibe tal cual. Un manual escaneado sin texto lo lee por su aspecto; el límite real es el cupo diario del plan gratuito.
- Modalidades de juegos y deportes (decisión del dueño, 6-10-2026), cada una con su lógica y su preparación (`MODALIDADES_EF` en `src/lib/ef.ts`): invasión, red y pared (el «pared» del dueño, con red y muro), lucha, blanco y diana, cooperación, juegos tradicionales y populares, y medio natural y urbano.
  - Las actividades y las sesiones llevan su modalidad (`modalidad`), y Actividades filtra por ella y enseña su lógica y su preparación.
  - El banco de partida tiene al menos dos de cada modalidad; para lucha, blanco y diana, cooperación, tradicionales y urbano se añadieron seis (lucha de equilibrio, caídas y la tortuga, diana de aros, acrosport por tríos, la comba con canciones y ruta urbana con plano).
  - La IA recibe la lógica y la preparación de la modalidad al proponer actividades, al preparar una sesión (calentamiento específico; del banco, solo las de esa modalidad) y en la SdA de EF (la elige el docente o la IA, `modalidadDeportiva`).
- Sesiones (pestaña «Sesiones»):
  - Calentamiento, parte principal, vuelta a la calma, material, inclusión (DUA-A) y plan B, con su clase, día e instalación, y de 1 a 3 criterios de evaluación oficiales de la clase (se cambian con el buscador de criterios).
  - «Preparar con IA»: clase, día, instalación, minutos (del horario si la clase tiene tramo ese día) y qué se trabaja. La IA usa el currículo de la clase y su comunidad, el material que no está para reponer, las instalaciones cubiertas para el plan B y, si se marca, el banco. La sesión se revisa antes de guardarla.
  - PDF para imprimirla (Windows y Android).
  - **Copiar a otras clases** (18-10-2026): «Copiar a otras clases», arriba o dentro de una sesión. Se elige la clase de origen, qué sesiones (de partida, todas) y a qué clases (`CopiarAClases`, `clonarSesionEF`). Cada clase recibe sus copias sin fecha, porque cada clase tiene su horario, salvo que se marque «Conservar también la fecha»; la instalación, los criterios y la modalidad se conservan, y las originales no se tocan.
- La IA (`src/services/efIA.ts`): marco con el currículo LOMLOE de la comunidad, el DUA-A, la normativa de inclusión y los autores de referencia:
  - Parlebas y Lavega (juegos y praxiología motriz).
  - Blázquez, Devís y Peiró (iniciación deportiva).
  - Fernández-Río (aprendizaje cooperativo).
  - López-Pastor (evaluación formativa).
  - Granero-Gallegos y Baena-Extremera (medio natural).
- Qué recibe la IA de quien está exento o lesionado: solo qué no puede hacer, una línea por alumno, sin nombre ni motivo (`limitacionesParaIA`). Contado en la política de privacidad y en las condiciones de la web.
- El marco pide texto sin formato pero con la ortografía completa. Con «texto llano», a secas, 3.5 Flash-Lite escribía sin tildes ni eñes (prueba con la IA real del 6-10-2026).

## Pizarra de circuitos

Petición del dueño (17-10-2026): «una pizarra digital en la que se dibuje un circuito y, según las formas, la app o la IA diferencien qué material es», y «al menos un banco de material en imágenes que el profesor pueda añadir a la pizarra». Pestaña «Pizarra de circuitos» (`ef-pizarra`, `src/pages/ef/EfPizarra.tsx`, lógica en `src/lib/pizarraEF.ts`).

- **Banco de material en imágenes**: cono, seta, aro, pica, valla baja, colchoneta, banco sueco, escalera de agilidad, balón, portería, canasta, cajón, cuerda, red de voleibol, diana de lanzamiento, espaldera y estación (círculo con su número). Son SVG dibujados por el código (`MATERIALES_PIZARRA`), no de fal.ai: pesan nada, se ven nítidos a cualquier tamaño y salen igual en pantalla, en el PNG y en lo que se envía a la IA. Cada pieza lleva su descripción (es, ca, en) y su tamaño de partida. Para añadir una, se añade a la lista (y su tipo `MaterialPizarraId` en `src/types/ef.ts`) y sus textos en `src/i18n/ef.ts`.
- Se toca una pieza para ponerla o se arrastra a su sitio; se mueve, se gira de 15 en 15 grados, se agranda, se duplica y se quita (con teclado: flechas y Supr). Lápiz y flecha en cuatro colores para el recorrido, «Borrar», «Deshacer» (Ctrl+Z), «Descargar imagen» (PNG) y «Material del circuito» (cuántas piezas de cada, sin contar estaciones).
- **Reconocer lo dibujado**: con «Dibujar material», el trazo a mano se analiza en el equipo (solo si es la única forma; desde dos, la IA, ver más abajo) (`analizarTrazo`: esquinas, cierre, circularidad y proporciones) y la app propone qué material es: triángulo → cono; círculo → aro, balón o seta según su tamaño; rectángulo muy alargado → banco; ancho → colchoneta o portería; raya corta → pica. **Una forma sola no basta** (un círculo es un aro, un balón o una seta), así que la app propone una lista y el docente elige y confirma; la pieza ocupa el lugar y el tamaño del dibujo y se gira si hace falta.
- **Reconocer con IA** (`reconocerPizarra`): manda a Gemini una imagen del croquis (solo trazos) y la lista cerrada del banco; devuelve cada pieza con su sitio, su tamaño y su seguridad, y un resumen del circuito. La IA decide con la forma, el tamaño relativo a las demás piezas y lo que el docente escriba junto al dibujo.
- **La IA, en primer lugar** (petición del dueño, 17-10-2026: «la app falla muchísimo, que sea la IA la que procese»): el reconocedor por forma solo acierta en lo evidente, así que desde la segunda forma dibujada con «Dibujar material» la IA procesa sola, tras `ESPERA_IA_MS` (1,2 s) sin dibujar, y **coloca ella las piezas de las que está segura** (seguridad «alta» o «media»), con un aviso y sin pedir confirmación; se deshacen con «Deshacer». Las «baja» quedan como propuesta para que el docente elija. Con una sola forma sigue la propuesta por forma (hace falta confirmar) y el botón «Reconocer con IA»; sin clave de IA, solo la propuesta por forma. Las formas dibujadas mientras la IA piensa esperan a la siguiente vez. La imagen no se guarda; la privacidad dice, en los tres idiomas, que ocurre sola desde la segunda forma y solo con clave de IA.
- **Duplicar, como en Canva** (misma petición): barra flotante junto a la pieza (duplicar, girar, quitar); Ctrl+D, que si se acaba de mover la copia repite esa distancia (así se hace una fila de conos: `ultimaCopia`); Alt y arrastrar (copia y mueve la copia); Ctrl+C y Ctrl+V (cada pegado, algo más lejos); «Copias en fila» (de 1 a 20 de una vez). Elegir varias: Mayús o Ctrl y clic, un recuadro arrastrando por el fondo, Ctrl+A; se mueven, giran, duplican y quitan juntas, y con las flechas del teclado. Una copia que se saldría de la pizarra rebota hacia el otro lado (`copiarElementos`) y la de una estación toma el siguiente número.
- Se guarda en `ef.pizarras` (`PizarraEF`: elementos con posición, giro y escala, y trazos). Es material del docente: se queda al vaciar el curso. Lo guardado se sanea al cargar (`normalizarEF`: material desconocido, coordenadas fuera de la pizarra y colores raros se descartan).

## Situaciones de aprendizaje

- Decisión del dueño (5 y 6-10-2026): un creador de situaciones de aprendizaje en el apartado de EF, hecho como el general de la app y con lo mismo: competencias específicas, criterios y saberes básicos del decreto de la comunidad (la IA elige de la lista real), competencias clave, objetivos de etapa, sesiones por fases, inclusión, evaluación, y después rúbrica, diana y ficha. Es la misma pantalla (`LearningSituations`), en la pestaña «Situaciones de aprendizaje» (`ef-sda`); las SdA se guardan con las demás.
- Si una de las áreas es Educación Física y el perfil es de EF, el formulario añade el bloque «Educación Física» y la petición lleva `ef` (`SdaPeticionEF` en `src/services/learningSituations.ts`):
  - Modalidad del juego o deporte, y modelo pedagógico, elegidos por el docente o por la IA de una lista cerrada (`src/lib/modelosEF.ts`): Aprendizaje cooperativo, Educación Deportiva, Enseñanza comprensiva del deporte, Responsabilidad personal y social, Educación en el medio natural, Juegos motores y educación emocional, e Hibridación de modelos.
  - El material, las instalaciones y las limitaciones de ahora de la clase, sin nombres.
  - Sesiones de EF (calentamiento, parte principal y vuelta a la calma), producto final motor, DUA-A y evaluación formativa y compartida.
- Estudios de autores publicados en abierto (petición del dueño): cada modelo lleva sus referencias, que pone la app, nunca la IA (se le prohíbe citar nada que no esté en las instrucciones y se descarta cualquier campo que no sea del esquema). Las diez referencias se comprobaron el 5-10-2026: REEFD (Fernández-Río y otros, 2016 y 2018; Calderón, Hastie y Martínez de Ojeda, 2011), Retos (Fernández-Río y Méndez-Giménez, 2016; Fernández-Río, 2017; Baena-Extremera y Granero-Gallegos, 2008), Cultura, Ciencia y Deporte (Abad Robles y otros, 2013), Apunts (Niubò-Solé, Lavega-Burgués y Sáenz-López, 2022), el libro de la Universidad de León (López-Pastor y Pérez-Pueyo, 2017) y las pautas DUA 3.0 de CAST (2024). Si se añade una, comprobarla antes.
- **Sesiones en preimpacto, impacto y postimpacto** (petición del dueño, 18-10-2026: «dice cosas generales; quiero actividades reales siguiendo el preimpacto, impacto y postimpacto»): las sesiones de la SdA de EF ya no son un párrafo. Cada una lleva un resumen y los tres momentos de la enseñanza (Mosston y Ashworth), cada uno con su texto y de 1 a 3 actividades reales (`SdaSession.momentos`, `MomentosSesionEF`):
  - **Preimpacto**: antes de la práctica principal. Objetivo, organización del espacio, del material y de los grupos, normas de seguridad, cómo se presenta la tarea y la activación o calentamiento específico.
  - **Impacto**: durante. Las tareas principales, de lo fácil a lo difícil, cómo se organiza y qué decide el alumnado, el feedback del docente y las adaptaciones DUA-A.
  - **Postimpacto**: después. La vuelta a la calma, la puesta en común con preguntas concretas, la autoevaluación o coevaluación con su instrumento y el cierre.
  - Cada **actividad** tiene nombre (un juego o una tarea que exista), minutos, cómo se hace (reglas, cómo se puntúa, progresión), organización y material. La instrucción a la IA prohíbe «se realizará un juego de calentamiento» y le pide decir cuál y cómo, sin repetir la misma actividad de una sesión a otra y con minutos que sumen la duración de la sesión. La duración es un campo del formulario de EF («Duración de cada sesión», 50 por defecto; `SdaPeticionEF.minutos`). Con esto la SdA ocupa más (hasta 32768 tokens de salida).
  - Lo que devuelve la IA se sanea (`sesionesDeLaRespuesta`): una actividad sin nombre o sin explicación se descarta, los minutos tienen que tener sentido y como mucho hay cuatro por momento; una sesión sin ninguna actividad se queda como las de antes (solo su descripción) en vez de enseñar tres cuadros vacíos. Las SdA hechas antes de la 2.11.0 siguen leyéndose como siempre.
  - Se ve en la pantalla (`MomentosDeSesion`), en el PDF y en el Word (`sesionEnTexto`: una línea, un párrafo en Word); «Pasar a Sesiones de EF» pone cada momento en su parte (calentamiento, parte principal y vuelta a la calma) con el material de las actividades (`sesionParaEF`).
- La SdA guarda `ef: { modelos, referencias, modalidad }`; el modelo, la modalidad y las referencias salen en la pantalla, en el PDF y en el Word.
- «Pasar a Sesiones de EF» copia cada sesión de la SdA a la pestaña Sesiones, sin fecha.
- **Copiar a otras clases** (petición del dueño, 18-10-2026: «si doy EF a varias clases de 4º de Primaria, poder exportar la SdA»): cada tarjeta de la biblioteca de SdA, y el documento abierto, tienen «Copiar a otras clases». Se eligen las clases (salen marcadas las del mismo curso, sin la propia y sin las que ya tienen una con ese título) y cada una recibe una copia suya e independiente (`clonarSda` en `src/lib/clonar.ts`; la petición toma la etapa y el curso de la clase de destino). Es lo mismo en cualquier materia, no solo en EF.

## Material e instalaciones

- Inventario del material: cantidad, estado (bien, regular, para reponer; se cambia desde la tabla) y dónde está. Arriba sale lo que hay que reponer.
- Instalaciones, con si son cubiertas (sirven con lluvia) y notas, para el plan B.
- La IA usa el material que no está para reponer y las instalaciones.

## Datos

- Todo va en `ef` del perfil (`src/types/ef.ts`, `src/lib/ef.ts`).
- Al vaciar el curso se queda el material del docente (pruebas, baremos, actividades, sesiones, material, instalaciones, circuitos y pizarras) y se va lo del alumnado (exentos, niveles, sexos, parejas, equipos y marcas).
- Al borrar un alumno se va todo lo suyo de EF, también su nivel de respuesta (`sinAlumnoEF`). Al borrar una clase, lo de todo su alumnado, también el motivo de las lesiones, y sus equipos; sus sesiones se quedan sin clase (`sinClaseEF`, desde el 6-10-2026; antes se quedaba huérfano).
- Datos de ejemplo: `src/lib/demoEF.ts`, con «Profesor» y «Alumno 1» a «Alumno 24». Salen en el idioma de la app (desde el 7-10-2026; textos en `src/i18n/demo.ts`).

## Lo que falta

- Pizarra: probar el reconocimiento con la IA real sobre croquis de docentes (solo se probó con respuestas simuladas), afinar el reconocedor local con ejemplos reales y valorar si los trazos que une una flecha (recorrido) pueden dar el orden de las estaciones para crear el cronómetro del circuito desde la pizarra.
- Manual en PDF: probarlo con manuales reales de varios cientos de páginas (el límite de respuesta es de 25 actividades por lectura) y valorar guardar de qué manual y página sale cada actividad.

- Baremos publicados: comprobadas las licencias el 11-10-2026, ninguna permite el uso comercial (ver «Pruebas físicas»). Queda pedir permiso a los autores, tarea del dueño.
- El cronómetro no suena con la pantalla bloqueada: por eso pide que la pantalla no se apague mientras corre.
