/**
 * Ayuda sobre la propia aplicación: el manual que lee la IA para responder
 * «¿cómo hago…?».
 *
 * Es distinto del asistente del Cuaderno (`aiContext.ts`), que responde sobre
 * los alumnos y sus notas. Aquí NO se envía ningún dato del docente: solo la
 * pregunta y este manual. Quien pregunta por su clase se va a la otra pantalla.
 *
 * **Al añadir o cambiar una pantalla hay que actualizar este archivo.** Un
 * manual desfasado es peor que no tener ayuda: manda al docente a un botón que
 * ya no existe y le hace perder la confianza en todo lo demás.
 */

import { translate, type Lang } from '../i18n';
import type { Section } from '../types';

/**
 * Secciones a las que el asistente puede llevar de un salto. Son los mismos
 * identificadores que usa `Section` en types/index.ts; se validan contra esta
 * lista antes de pintar el botón, para que un identificador inventado por la
 * IA no deje un botón que no lleva a ninguna parte.
 */
export const HELP_TARGETS: Record<Section, { es: string; en: string }> = {
  dashboard:             { es: 'Inicio', en: 'Home' },
  classes:               { es: 'Mis Clases', en: 'My Classes' },
  agenda:                { es: 'Agenda', en: 'Planner' },
  notebook:              { es: 'Cuaderno de Notas', en: 'Gradebook' },
  attendance:            { es: 'Asistencia', en: 'Attendance' },
  seating:               { es: 'Distribución de aula', en: 'Classroom Layout' },
  'learning-situations': { es: 'Situaciones de aprendizaje', en: 'Learning Situations' },
  rubrics:               { es: 'Rúbricas', en: 'Rubrics' },
  diana:                 { es: 'Diana Competencial', en: 'Learner Profile Tracking' },
  reports:               { es: 'Informes', en: 'Reports' },
  records:               { es: 'Actas', en: 'Grade Sheets' },
  selfassess:            { es: 'Autoevaluaciones', en: 'Self-Assessments' },
  history:               { es: 'Historial', en: 'Assessment History' },
  resources:             { es: 'Recursos', en: 'Resources' },
  meetings:              { es: 'Reuniones', en: 'Meetings' },
  trainings:             { es: 'Formaciones', en: 'Training' },
  'sec-classroom':       { es: 'Aula Live', en: 'Live Classroom' },
  'classroom-live':      { es: 'Sala de alumnos', en: 'Student Room' },
  share:                 { es: 'Trabajo compartido', en: 'Shared Workspace' },
  audit:                 { es: 'Registro de cambios', en: 'Change Log' },
  profile:               { es: 'Configuración', en: 'Settings' },
  'apoyo-alumnado':      { es: 'Alumnado y grupos', en: 'Students and Groups' },
};

/**
 * ¿Es este identificador una pantalla de verdad? Estrecha `string` a
 * `Section`, que es lo que hace falta para leer HELP_TARGETS sin castings:
 * los identificadores que se comprueban vienen de fuera del tipo —de lo que
 * escribe la IA o de la sección abierta— y podrían ser cualquier cosa.
 */
export function isHelpTarget(id: string): id is Section {
  return Object.prototype.hasOwnProperty.call(HELP_TARGETS, id);
}

/** Nombre de la pantalla en el idioma de la interfaz; el propio id si no lo es. */
export function targetLabel(id: string, lang: Lang): string {
  if (!isHelpTarget(id)) return id;
  // En catalán, el nombre en castellano pasa por el diccionario, como el menú
  return lang === 'ca' ? translate('ca', HELP_TARGETS[id].es) : HELP_TARGETS[id][lang];
}

/**
 * El manual. Se escribe en castellano aunque la interfaz esté en inglés: el
 * modelo traduce sin problema al responder, y mantener una sola versión evita
 * que las dos se desincronicen (que es como se cuela la información falsa).
 */
export const MANUAL = `
=== QUÉ ES AULA PRO ===
Aplicación de escritorio para el profesorado español (currículo LOMLOE). Todo se
guarda en el ordenador del docente: no hay cuentas, ni servidor, ni nube. Cada
docente tiene su perfil, con su propia carpeta de datos y copia automática cada
10 minutos. Puede haber varios perfiles en el mismo ordenador.

COMUNIDAD AUTÓNOMA: cada perfil tiene la suya (se elige al crearlo y se cambia
en Configuración → Perfil; aparece bajo el nombre del docente en el menú). De
ella sale el currículo oficial de las situaciones de aprendizaje. El selector
tiene dos grupos: «Decreto autonómico actualizado», las comunidades cuyo decreto
lleva Aula Pro (con la etapa entre paréntesis si es solo una), y «Decreto
estatal», las que siguen el currículo estatal: Real Decreto 157/2022 en
Primaria y Real Decreto 217/2022 en la ESO. Al elegir una, debajo se ve de qué
decreto sale cada etapa. «Fuera de España / no aplica» también usa el estatal.
Tienen su decreto autonómico la Comunitat Valenciana, en castellano o en
valenciano según el idioma de la aplicación: en Primaria, el Decreto 106/2022,
modificado por el Decreto 96/2026; en la ESO, el Decreto 107/2022, modificado por
el Decreto 66/2024, con sus materias propias (Valenciano: Lengua y Literatura,
Cultura Clásica, Filosofía, Inteligencia Artificial, Programación y Robótica,
Finanzas y Consumo Responsables, los talleres y laboratorios…), sin opciones A y
B en las Matemáticas de cuarto. Cataluña, en catalán, la lengua del texto que
lleva la aplicación: Primaria y ESO con el Decret 175/2022, con sus áreas y
materias propias (Llengua Catalana i Literatura, Aranès i Literatura a l'Aran,
Economia Bàsica, Emprenedoria, Robòtica i Programació…). Y la Comunidad de
Madrid, en castellano: en Primaria, el Decreto 61/2022, con sus áreas propias
(Ciencias de la Naturaleza y Ciencias Sociales por separado, Segunda Lengua
Extranjera y Tecnología y Robótica, y Educación en Valores solo en quinto); en la
ESO, el Decreto 65/2022, curso a curso, con sus materias propias (Ciencias de la
Computación, Cultura Clásica y Filosofía). Las dos, modificadas por el Decreto
59/2024. El resto de comunidades siguen el estatal.

Las funciones de IA usan una clave gratuita de Google Gemini que el docente pega
en Configuración. Sin clave, la aplicación funciona entera menos lo que redacta la IA.
PRIVACIDAD: los nombres del alumnado NUNCA se envían a Google. Antes de cada
petición a la IA se cambian por códigos y, al llegar la respuesta, la aplicación
vuelve a poner los nombres reales; el docente ve siempre los nombres. Lo único
que se envía tal cual son los archivos que el propio docente adjunta. En la
aplicación de escritorio la clave de Google se guarda cifrada por el sistema.

Las notas van sobre 10 y el aprobado está en 5. La aplicación está en español,
inglés y catalán (se cambia en la pantalla de bienvenida y en Configuración →
Idioma). En catalán, también la IA redacta en catalán (fichas, informes, SdA…).

=== CÓMO SE NAVEGA ===
Barra lateral a la izquierda, organizada por tareas, con tres grupos:
- «Tu día a día»: Inicio, Mis Clases, Agenda, Cuaderno de Notas y Asistencia.
- «Trabajo docente»: tres APARTADOS que reúnen pantallas hermanas. Al entrar
  en uno aparecen PESTAÑAS arriba para pasar de una a otra:
    · Evaluar → Rúbricas, Diana competencial, Autoevaluaciones e Historial.
    · Documentos → Informes, Actas, Situaciones de aprendizaje y Recursos.
    · En clase → Distribución de aula, Aula Live y Sala de alumnos.
  Cada apartado recuerda la última pestaña usada. Al entrar en uno, la barra
  de pestañas parpadea dos veces del color de la app para que se vea dónde
  elegir (no lo hace si el sistema tiene activado «reducir movimiento»).
- «Más» (plegado al principio; se abre pulsando «Más»): Reuniones,
  Formaciones, Trabajo compartido, Registro de cambios y Configuración. A Configuración
  también se llega pulsando el nombre del docente, arriba del todo.
Así, por ejemplo, las Actas están en «Documentos → Actas» y la Distribución de
aula en «En clase → Distribución de aula». Cada grupo se pliega y despliega
pulsando su cabecera, y la barra entera se estrecha con la flecha de arriba. En
ventanas estrechas (portátil pequeño, media pantalla) la barra se queda sola en
iconos; la flecha la abre por encima del contenido y se cierra al elegir una
sección, con Escape o pulsando fuera. Las ventanas emergentes se cierran con
Escape.

=== PANTALLAS (dónde está cada una: ver CÓMO SE NAVEGA) ===

[dashboard] INICIO
Dice «qué toca ahora». Arriba, el saludo con un resumen (clases de hoy, tareas
pendientes, alumnos con avisos). Debajo, una tarjeta grande con la clase de
AHORA (o la siguiente, «Siguiente, a las 11:00») y tres botones: «Pasar lista»,
«Anotar en el aula» (lleva a la Distribución de aula) y «Cuaderno»; a su lado,
«Tu día» con todas las clases de hoy (las pasadas, atenuadas). Si ya no quedan
clases, lo dice y propone ir al Cuaderno. Más abajo, cuatro tarjetas quietas:
Tareas (se marcan y se añaden desde aquí), Próximos eventos, «Necesitan
atención» (alumnos con avisos) y «Cómo van tus clases» (media de cada clase y
cuántos están por debajo de 5).
PRIMEROS PASOS: arriba del Inicio hay una guía con 5 pasos que se marcan solos
al hacerlos: 1) crear la primera clase con su alumnado, 2) añadir el horario
(mejor escaneándolo en la Agenda), 3) decidir cómo se evalúa (categorías del
Cuaderno), 4) pasar lista por primera vez y 5) conectar la IA (opcional). Cada
paso tiene un botón que lleva a la pantalla. Con la flecha de la esquina la
guía se minimiza a una sola línea (progreso, paso siguiente y su botón) y se
vuelve a abrir pulsándola; desaparece sola al completar los pasos obligatorios. Si el perfil está vacío,
la guía ocupa el Inicio y ofrece además «Cargar datos de ejemplo» (datos
ficticios para trastear sin miedo).

[classes] MIS CLASES
El punto de partida de todo. Se crea una clase con nombre, aula y color; se
puede marcar como tutoría. Se eligen ETAPA Y CURSO (Primaria 1º-6º o ESO 1º-4º,
obligatorios) y aparecen las asignaturas de ese curso tal y como las llama el
currículo de la comunidad del perfil: se marcan las que se dan (una o varias).
Las que no están en la lista (Religión, Tutoría…) se añaden aparte con
«Añadir» y se trabajan en modo libre, sin currículo oficial. En 4º de ESO con
Matemáticas se pide la opción A o B. El lápiz junto al nombre de la clase
(«Editar clase») abre el mismo formulario para cambiar cualquier dato.
Dentro de cada clase se
añaden los alumnos uno a uno, o de golpe con el botón «Importar CSV»: se pegan
las filas en formato «Nombre,Email», una por línea (la primera puede ser la
cabecera). De cada alumno se guardan
avisos (por ejemplo «faltas reiteradas») y anotaciones del docente, que luego
aparecen en los informes y en el asistente del cuaderno.
SIN CLASES NO FUNCIONA CASI NADA: ni notas, ni asistencia, ni actas, ni informes.

[agenda] AGENDA
Dos cosas: el horario semanal (bloques de día, hora de inicio y fin, asignatura,
aula y clase) y el calendario de eventos (entregas, reuniones y eventos, con
urgencia alta/media/baja). Tiene «Escanear horario»: se sube el horario del
centro —una foto, un PDF o una hoja de cálculo (Excel, CSV)— y la IA copia
la tabla celda a celda; la propia aplicación calcula el día y la hora de cada
sesión por su posición, así que las celdas vacías o el recreo no descolocan
nada. Antes de añadir, se muestra la semana tal como quedará: pulsando una
sesión se quita si no es tuya. Si ya había horario, se puede marcar
«Sustituir mi horario actual» para que el escaneado lo reemplace en vez de
sumarse. Consejo: una foto recta y nítida, o mejor el Excel del centro, da el
mejor resultado.
Para empezar de cero, el botón «Borrar horario» (arriba, junto a «Nuevo
bloque») quita todas las sesiones del horario semanal tras pedir
confirmación; los eventos del calendario no se tocan.

[notebook] CUADERNO DE NOTAS
Tiene DOS PESTAÑAS arriba:
1. «Calificaciones»: se eligen la clase y la asignatura, se definen las
   categorías con su peso (por ejemplo Exámenes 60%, Tareas 30%, Participación
   10%; deben sumar 100% por asignatura), y dentro de cada categoría se añaden
   pruebas («Examen T1», «Cuaderno»). Se escriben notas de 0 a 10 en la rejilla
   y la media ponderada se calcula sola, con la media del grupo abajo. Se
   exporta a Excel.
2. «✨ Consulta IA»: el asistente pedagógico que SÍ VE LOS DATOS del docente
   (clases, medias, asistencia, evaluaciones, agenda). Ahí es donde se pregunta
   «¿cómo va Marta?», «¿quién va justo en 2ºB?» o «proponme refuerzo». Se puede
   acotar a una clase o desactivar el acceso a los datos.
Bloque «Trabajo diario y actitud»: en cuanto se hace alguna anotación del
aula desde la Distribución de aula, el cuaderno añade este bloque, que vale
1 PUNTO de la nota final (la nota final queda en un 90% la media de las
categorías del docente y un 10% el bloque). Tiene tres partes que ponderan
un 33,33% cada una: Tareas, Comportamiento y Participación. Cada parte es una
nota de 0 a 10: se parte de 10 en Tareas y Comportamiento y de 5 en
Participación (que solo suma), y cada anotación suma o resta 0,5. En la
tabla se ven como columnas de solo lectura (con −/+ de cada alumno) y la
«Nota» del bloque. Todo se ajusta pulsando el botón del bloque junto a las
categorías o su cabecera en la tabla: si cuenta o no en la nota, los puntos
que vale (hasta 5), el peso de cada parte (deben sumar 100%), la nota de
partida de cada parte y lo que suma o resta cada anotación. El bloque no
entra en el aviso de «los pesos suman 100%». Cuenta también en informes,
actas (donde aparece en puntos), el inicio y la IA.

[attendance] ASISTENCIA
Pasar lista por clase y día. Cuatro estados: presente, falta, retraso y
justificada. Hay botón de «Todos presentes» para marcar la clase entera de
golpe. El porcentaje de asistencia cuenta el retraso y la falta justificada como
asistencia. Se exporta a CSV.

[seating] DISTRIBUCIÓN DE AULA
Grupos cooperativos por mesas. Arriba hay UNA SOLA BARRA con: el selector de
clase, la rotación de roles (flechas ↺ y ↻ a los lados de «Roles como se
formaron los grupos» o «Rotada N veces»), un indicador («Todos sentados» o
«N sin mesa»), el botón «Mesas y roles» y el botón «✨ Repartir con IA».
- «Mesas y roles» abre una ventana para decidir cuántas mesas hay y cuántos
  alumnos caben en cada una (por defecto, 5 mesas de 4) y para renombrar los
  roles cooperativos (Portavoz, Secretario/a, Responsable del material,
  Responsable del tiempo) y su responsabilidad.
- «✨ Repartir con IA» abre una ventana donde se escriben, si se quiere,
  aspectos a tener en cuenta («Marco y Lucía no deben ir juntos») y se pulsa
  «Generar grupos con IA». La IA reparte al alumnado real en mesas EQUILIBRADAS
  y MULTINIVEL usando la media ponderada, la asistencia y los avisos de cada
  alumno, sin inventar ninguno. Sustituye la distribución que hubiera.
- Cada mesa se dibuja como un semicírculo con los asientos numerados y, debajo,
  la lista de asientos con el nombre y el rol de cada alumno.
- Sentar a mano: si hay alumnos sin mesa aparece abajo la bandeja
  «Sin mesa asignada». Se ARRASTRA un alumno hasta un asiento (en la lista o en el
  dibujo), o se toca el alumno y después «Sentar aquí». También se puede
  arrastrar a un alumno de un asiento a otro (si estaba ocupado, se
  intercambian) o devolverlo a la bandeja. Para quitar a alguien de su asiento
  se usa la × de su fila. Con todo el alumnado sentado la bandeja desaparece.
- Las flechas de rotación cambian los roles dentro de cada mesa cada semana
  sin cambiar quién se sienta con quién; la otra flecha deshace la rotación.
- ANOTACIONES DEL AULA: cada alumno sentado tiene a la derecha de su fila un
  banderín. Al tocarlo se abre «Anotar a …» con cinco botones de un toque:
  «Sin tarea», «Sin material», «Mal comportamiento», «Buen comportamiento» y
  «Participa» (si la clase tiene varias asignaturas, se elige antes cuál). En
  la fila se ven las anotaciones de hoy (−2, +1) y desde la ventana se puede
  quitar una hecha por error. Cuentan solas en el CUADERNO DE NOTAS, en el
  bloque «Trabajo diario y actitud» (ver Cuaderno de notas): «Sin tarea» en
  Tareas; «Sin material», «Mal/Buen comportamiento» en Comportamiento;
  «Participa» en Participación.
Se exporta a PDF (el plano visual) y a Word (el listado por mesas), con los
botones de arriba a la derecha.

=== EVALUAR Y DOCUMENTOS ===

[rubrics] RÚBRICAS
Rúbricas con criterios y niveles de logro (el nivel más alto equivale a un 10 y
el resto reparte proporcionalmente); se pueden crear a mano o con la IA. Aquí se
evalúa a cada alumno. IMPORTANTE: si la rúbrica declara clase y categoría del
cuaderno, la nota entra sola en el cuaderno en una columna propia; si no las
declara, la evaluación se queda solo en el Historial. Cada criterio de rúbrica
(o ítem de diana) lleva las competencias clave que evalúa (CCL, CP, STEM, CD,
CPSAA, CC, CE, CCEC) y, si la clase tiene currículo oficial, los criterios de
evaluación oficiales, de una o varias asignaturas. Los pone la IA: al generar
la rúbrica o la diana, o con «Marcar con IA» en las hechas a mano, que rellena
solo lo que falte. Se cambian a mano: las competencias clave, pulsando sus
botones; los criterios oficiales, quitándolos o con «Añadir otro criterio» y el
buscador. Arriba se ven las competencias clave y las específicas que trabaja.
Al evaluar, la nota de cada criterio va a sus competencias clave (Diana
competencial) y a sus criterios oficiales. Las rúbricas y dianas que se crean
desde una situación de aprendizaje ya lo traen marcado.

[diana] DIANA COMPETENCIAL
Perfil visual de competencias clave de un alumno, en forma de diana. Se elige
clase y alumno. Debajo, «Competencias específicas»: por asignatura con currículo
oficial, la nota de cada criterio de evaluación (media de las veces que se ha
evaluado), de cada competencia específica (media de sus criterios) y del área
(media de sus competencias). Sale de las evaluaciones con criterios oficiales
marcados y no cambia la nota del cuaderno. La clase necesita etapa y curso.
Es una tabla por asignatura con lo evaluado: el número de cada competencia
(CE1, CE2…) y de cada criterio y un resumen de su texto (al pasar el ratón, o
al tocarlo en el móvil, se lee entero). Debajo, «Faltan por evaluar», solo con
los números. «Exportar PDF» saca en una página las tablas del alumno, solo con
los números y las notas, lo que falta y el decreto del que salen.

[reports] INFORMES
Informes de evaluación competencial redactados por la IA a partir de las
evaluaciones, las notas del cuaderno y la asistencia REALES del alumno, citando
las competencias clave LOMLOE. Se generan por periodo (1ª, 2ª, 3ª evaluación o
final) y en lote. Si un alumno no tiene datos, la IA se niega a inventarlo. Se
exportan a PDF y se pueden editar a mano.

[records] ACTAS
El acta oficial de calificaciones de una clase, con una columna por categoría y
la media, lista para imprimir o firmar. Sale en PDF horizontal. Se genera con
las notas que ya están en el cuaderno.

[selfassess] AUTOEVALUACIONES
Lo que han respondido los alumnos desde el móvil en la Sala de alumnos. El
docente decide si cada sesión pasa al Historial o se descarta: lo que dice un
alumno de sí mismo no es una calificación suya, así que nunca entra en el
cuaderno.

[history] HISTORIAL
Todas las evaluaciones hechas con rúbricas y dianas, con filtros por clase,
alumno e instrumento, y buscador.

=== DOCUMENTOS: SITUACIONES DE APRENDIZAJE Y RECURSOS ===

[learning-situations] SITUACIONES DE APRENDIZAJE
Está en «Documentos → Situaciones de aprendizaje». Tiene tres vistas:
- BIBLIOTECA (al entrar): las SdA guardadas como tarjetas (con el color de la
  clase, título, resumen, áreas, nº de sesiones y fecha), con botones para PDF,
  Word y eliminar. Se abre una pulsando la tarjeta. Botón «Nueva situación de
  aprendizaje». Por defecto van AGRUPADAS POR CLASE (un bloque por clase, en el
  orden de Mis Clases, ordenadas por nº de SdA; las que no tienen clase, al
  final en «Sin clase»). «Agrupar por» permite cambiar a Área (una SdA de
  varias áreas sale en cada una, marcada «Compartida») o a Nada. Debajo hay
  un filtro de ÁREA («Todas» o una concreta) y arriba un BUSCADOR por título o
  idea. Cada bloque se pliega pulsando su cabecera; la app recuerda la
  agrupación y los bloques plegados.
- CREAR: formulario en dos pasos: «La idea» (qué se quiere trabajar) y «Para
  quién» (clase, nivel, etapa y curso del currículo oficial, áreas, nº de
  sesiones y temporalización). Si la clase ya tiene etapa y curso, no se
  preguntan: sale un resumen con el decreto que se usará y «Cambiar en la
  clase». Si no los tiene, se eligen aquí y se guardan en la clase al generar.
  Un área sin materia oficial clara pregunta cuál es, y la respuesta se
  recuerda en la clase. En «Más opciones» (plegado) están el nº de la
  SdA, los meses, cómo es el grupo, la metodología habitual y los documentos de
  apoyo (normativa o programación que la IA resume y tiene en cuenta). «Generar
  situación de aprendizaje» tarda cerca de un minuto.
- DOCUMENTO: la SdA se lee como un documento, con el título editable arriba y
  un ÍNDICE a la izquierda (Resumen, Currículo, Sesiones, Metodología,
  Inclusión, Evaluación, Materiales) que salta a cada apartado. Cada texto se
  edita pulsando el lápiz que aparece al pasar el ratón. «Currículo» empieza por
  la cita del decreto del que salen competencias y saberes (la misma cita va en
  el PDF y el Word); se guarda con la SdA. Las competencias clave
  salen como etiquetas (CCL, STEM…); cada área, en una tarjeta plegable con sus
  competencias específicas, criterios y saberes; las sesiones, en una línea de
  tiempo por fases (Activación, Desarrollo, Consolidación, Producto final); la
  inclusión, en tres niveles. En «Materiales» hay pestañas para generar la
  RÚBRICA (tabla de colores por nivel, «Llevar a Rúbricas»), la DIANA («Llevar
  a Dianas») y una FICHA de ejercicios («Llevar a Recursos»). Arriba: «Ajustar»
  (cambiar los datos y volver a generarla), PDF, Word, «Cartel» (una hoja A4
  para colgar en el aula con el reto, lo que se va a conseguir, el camino por
  fases y las competencias, con el tema visual que elijas) y «Guardar»
  (mientras no se guarda aparece «Sin guardar»).

[resources] RECURSOS
Fichas de trabajo con historia, generadas con la IA a partir de un tema, el
área y el nivel. Se elige «el mundo de la historia» (Misión espacial, Selva,
Detectives, Submarina, Superhéroes, La gran final, Jurásico, Piratas, Magia,
Cocina), «Que elija la IA» o «Clásica» (sin historia). Con historia, un
personaje presenta la misión, cada bloque es un paso de la aventura («Misión
1», «Pista 1»…) y al final se gana una insignia con autoevaluación.
Tipos de ejercicio: respuesta abierta, completar, opción múltiple, problema,
tabla, relacionar, colorear, sopa de letras, verdadero o falso, ordenar,
crucigrama y cómic (la sopa, el crucigrama y las figuras los dibuja la propia
aplicación).
Al crearla se abre el EDITOR: a la izquierda los bloques (título, historia,
explicación, instrucciones, cada misión y sus ejercicios, final); a la derecha
la vista previa A4, igual que se imprime. Cada ejercicio se edita, se sube, se
baja, se borra o se «Rehace» con IA («Más fácil», «Más difícil», «Otro
distinto», cambiar de tipo o una indicación libre). Al hacer clic en la hoja se
selecciona ese bloque. El tema se cambia arriba con un clic sin volver a
generar; «Adaptar la historia a este tema» reescribe solo la historia.
QUÉ QUIERES CREAR: «Ficha» (ejercicios por bloques), «Escape room» (cada
bloque es una sala; las respuestas forman el código del candado que abre la
siguiente, y al final se abre el cofre; el código no se imprime, se ve en el
editor) o «Tarjetas recortables» (pregunta delante y respuesta detrás, se
recortan por la línea discontinua y se doblan por la mitad; incluyen cómo
jugar).
AÑADIR: al final de cada bloque, «Añadir ejercicio con IA» (elige el tipo o
deja que lo elija la IA); en las tarjetas, «4 tarjetas más con IA» o «Añadir
tarjeta» a mano. En un escape room, revisa después el código del candado.
DESDE UNA SdA: en Materiales › Ficha se elige también ficha, escape room o
tarjetas, y se lleva a Recursos para editarla.
PROYECTAR: botón «Proyectar» del editor, o «Reto» en el dock de Aula Live
para elegir una ficha guardada. Se ve a pantalla completa con su tema:
portada con el personaje y la misión (y un temporizador opcional), una
pantalla por bloque y el final con la insignia. En un escape room cada sala
tiene un candado digital: se teclea el código y solo se abre si es el bueno.
Abajo, el mapa de la aventura. Teclas: ← → moverse, S ver soluciones,
F pantalla completa, Esc salir. Las tarjetas se proyectan de una en una y se
giran con un clic o la barra espaciadora.
ADAPTAR (botón arriba en el editor): crea otra versión de la misma ficha, con
la misma historia: «Versión de apoyo», «Versión de ampliación» o «Lectura
fácil» (frases cortas y letra más grande). Se abre como ficha nueva; en la
hoja solo lleva una marca discreta en la esquina (◆ apoyo, ▲ ampliación,
● lectura fácil) y en «Mis fichas» aparece con su etiqueta.
Se exportan a PDF (vertical) y a Word. Las soluciones son solo para el
docente: no salen en la ficha exportada.

=== REUNIONES Y FORMACIONES (grupo «Más») ===

[meetings] REUNIONES y [trainings] FORMACIONES
Funcionan igual. Se apuntan anotaciones en bruto durante un claustro, una
reunión de departamento o un curso —frases sueltas, nombres, acuerdos— y después
la IA redacta el documento final: el ACTA en el caso de las reuniones (puntos
tratados, acuerdos, tareas con responsable y plazo, cierre) y la MEMORIA en el
de las formaciones (contenidos, ideas clave, aplicación en el aula, valoración).
Se puede retocar a mano y exportar a PDF y Word. La IA no añade nada que no esté
en las anotaciones. No van atadas a ninguna clase, y el vaciado de fin de curso
no las borra.
AUTOGUARDADO: mientras el formulario de anotaciones está abierto, se guarda una
copia sola cada minuto (y también al cerrar la ventana); cada copia sustituye a
la anterior y se ve «Autoguardado a las HH:MM» bajo las anotaciones. Si la
ventana o la aplicación se cierran sin guardar, al volver a Reuniones o
Formaciones aparece un aviso con «Recuperar» (reabre lo escrito) o «Descartar».
Al pulsar «Guardar» la copia se borra.

=== EN CLASE Y OTRAS HERRAMIENTAS ===

[sec-classroom] AULA LIVE
Herramientas para proyectar en clase: temporizador, sorteo de alumnos (se puede
ir sacando sin repetir) y medidor de ruido con el micrófono, con aviso al pasar
de un nivel.
Tiene una pizarra para dibujar encima («Lápiz»). La pizarra es BLANCA por
defecto, para que se vea bien en el proyector o el panel; el botón «Fondo
oscuro» / «Fondo blanco» de la barra superior la cambia (se recuerda para la
próxima vez) y lo ya dibujado cambia de color para seguir viéndose.

[classroom-live] SALA DE ALUMNOS
Levanta un servidor en el propio ordenador para que los alumnos entren desde el
móvil escaneando un QR o escribiendo un código, sin instalar nada y sin
necesidad de internet (misma red wifi). Actividades: autoevaluación con una
rúbrica o diana, lluvia de ideas y votación. Las respuestas llegan en directo y
se guardan en Autoevaluaciones.

[share] TRABAJO COMPARTIDO
Conecta a dos docentes que dan clase al mismo grupo para trabajar a la vez sobre
las mismas clases, alumnos, notas, rúbricas y dianas. Se conecta con un código o
un QR y los cambios se sincronizan solos. El dueño de cada lista manda sobre
ella, para que nadie machaque el trabajo del otro.

=== PT Y AL (solo profesorado especialista) ===
Apartado del menú, justo después del Inicio, que solo aparece si en
Configuración → Perfil está marcada «Pedagogía Terapéutica (PT)» o «Audición y
Lenguaje (AL)». Es para quien atiende alumnado de muchas clases que no son
suyas: este alumnado es aparte del de «Mis Clases».

[apoyo-alumnado] ALUMNADO Y GRUPOS
Dos listas. GRUPOS DE APOYO («Nuevo grupo»): uno por cada sesión que se da
(«Lectoescritura, lunes 9:00»; un alumno que se atiende solo es un grupo de
uno), con su nombre, si es dentro o fuera del aula, su horario (una o varias
sesiones a la semana, con día, hora de empezar y de acabar), su alumnado y un
color; si el perfil es de PT y de AL, también de cuál de las dos es. ALUMNADO
(«Nuevo alumno»): nombre y apellidos, clase de origen («2º B»), curso en que
está matriculado, nivel de competencia curricular (el curso cuyo currículo
trabaja; si está por debajo de su curso se marca en la lista), necesidad
específica de apoyo educativo (se elige o se escribe; sugiere las categorías
de la LOE), diagnóstico, necesidades educativas (barreras, fortalezas y qué le
ayuda), notas y sus grupos. El lápiz de cada fila edita; dentro está
«Eliminar». Eliminar un alumno borra sus programas y sus registros; eliminar
un grupo borra sus registros, pero no al alumnado. Todo se guarda en el
equipo y se vacía con el vaciado de fin de curso.

[audit] REGISTRO DE CAMBIOS
Quién cambió qué y cuándo: notas, alumnos, asistencia, evaluaciones… Con filtros
y buscador, y se exporta a CSV. Útil cuando dos docentes comparten trabajo o
para justificar un cambio de nota.

[profile] CONFIGURACIÓN
Se abre desde el grupo «Más» del menú o pulsando tu nombre arriba a la
izquierda. Es una cuadrícula de TARJETAS; cada una se abre al pulsarla y se
vuelve con «← Configuración»:
- PERFIL: nombre, apellidos, centro, especialidad, curso escolar, comunidad
  autónoma y, para el profesorado especialista de apoyo, las casillas
  «Pedagogía Terapéutica (PT)» y «Audición y Lenguaje (AL)»: con alguna marcada
  aparece en el menú el apartado «PT y AL».
- CLAVE DE LA IA: la CLAVE API GRATUITA DE GOOGLE que activa toda la IA, en tres
  pasos: «Abrir AI Studio», crear y copiar la clave («Create API key»), y
  «Pegar mi clave», que la guarda y comprueba que funciona. También explica el
  plan gratuito: las tareas grandes (SdA, fichas, informes, rúbricas, dianas)
  usan Gemini 3.8 Flash, unas 20 al día; el resto, Gemini 3.5 Flash-Lite, unas
  500 al día. Si se gastan las 20, sigue sola con Flash-Lite hasta las 9:00.
- IDIOMA: castellano, inglés o catalán.
- APARIENCIA: color de la interfaz y modo «Automática» (sigue el sistema),
  «Clara» u «Oscura».
- SEGURIDAD: contraseña opcional para abrir el perfil.
- DATOS Y COPIAS: descargar o cargar un archivo con todo (copia de seguridad o
  para llevar a otro equipo), ver la carpeta donde se guardan los datos y el
  VACIADO DE FIN DE CURSO, que borra clases, alumnos, notas, evaluaciones,
  asistencia, informes y el alumnado de PT y AL y conserva rúbricas, dianas, reuniones y formaciones
  (hace una copia antes).
- Licencia (solo en la app de escritorio): el estado de Aula Pro en este
  ordenador. «Docente fundador/a» = la usaba antes de que saliera a la venta y
  en ese ordenador es gratis para siempre. «Licencia activa» = activada con la
  clave comprada en la web; se ve el final de la clave y el botón «Desactivar
  en este equipo» para pasarla a otro ordenador.
Los avisos de «Configurar la IA» de otras pantallas llevan directos a la
tarjeta «Clave de la IA».

=== PREGUNTAS FRECUENTES ===
- «¿Hay Aula Pro para tableta / móvil / Android?»: sí, en pruebas, para
  tabletas y móviles Android. En el móvil el menú se abre con el botón ☰ de la
  barra de arriba (el avatar lleva a Configuración) y las tablas anchas, como
  el cuaderno, se desplazan de lado con el dedo. Funciona igual que en el
  ordenador, con tres diferencias: «Guardar en PDF» abre el diálogo de impresión de Android, donde
  se elige «Guardar como PDF» o una impresora; los Word, CSV y copias se
  comparten (Archivos, Drive, correo…) en vez de descargarse; y en la Sala de
  alumnos es la tableta la que abre la sala (misma wifi; con la sala abierta
  la pantalla no se apaga). Los datos de la tableta y
  los del ordenador van por separado: para pasarlos, «Descargar mis datos» en
  uno y «Cargar desde archivo» en el otro, o «Trabajo compartido».
- «Me pide una clave de licencia» / «He cambiado de ordenador»: la clave llega
  por correo al comprar Aula Pro en la web. Se activa con internet una sola vez
  y después funciona sin conexión. Cada clave vale para un número limitado de
  ordenadores: para pasarla a otro, en el viejo Configuración → Licencia →
  «Desactivar en este equipo». Si dice que se ha alcanzado el máximo y el
  ordenador viejo ya no existe, que escriba a quien le vendió la licencia.
- «¿Dónde se guardan mis datos?»: en una carpeta de este ordenador, una por
  perfil. Se ve y se abre desde Configuración → Datos y copias. Nunca salen a ningún servidor.
- «¿Cómo hago copia de seguridad?»: Configuración → Datos y copias → «Descargar mis datos». Da un archivo que se
  guarda donde se quiera y se puede volver a importar.
- «No me funciona la IA»: casi siempre es la clave API. Revisar en Configuración →
  Clave de la IA que esté pegada (con «Pegar mi clave» se comprueba sola), y probar de nuevo con cualquier función de IA:
  el error que salga (clave inválida, sin permiso, límite alcanzado…) dice
  qué pasa. Si dice que se ha alcanzado el límite, es la cuota gratuita de
  Google: si es por minuto, esperar un minuto; si es el cupo del día, se renueva a las 9:00.
- «¿Por qué no puedo guardar en PDF?»: el PDF solo funciona en la aplicación de
  escritorio. Word funciona siempre.
- «¿Se actualiza sola?»: en Windows sí. Al arrancar comprueba si hay versión
  nueva, avisa con una notificación y la descarga en segundo plano; se instala
  al pulsar «Reiniciar y actualizar» o al cerrar la aplicación. En Mac hay que
  descargarla a mano.
- «¿La IA ve los nombres de mis alumnos?»: no. Se cambian por códigos antes de
  enviar nada a Google y se vuelven a poner al recibir la respuesta. Solo
  viajan tal cual los archivos que el docente adjunte.
- «¿Hay modo oscuro?»: sí, en Configuración → Apariencia (Automática, Clara u
  Oscura).
- «Se me cerró la reunión sin guardar»: al volver a Reuniones (o Formaciones)
  sale un aviso para Recuperar lo escrito; se autoguarda cada minuto.
- «Quiero probar sin meter datos reales»: en la pantalla de bienvenida,
  «Explorar con datos de ejemplo»; o en Inicio, «Cargar datos de ejemplo».
- «Empiezo de cero, ¿por dónde?»: Mis Clases (crear la clase y sus alumnos) →
  Cuaderno de Notas (categorías con sus pesos) → ya se pueden poner notas, pasar
  lista y sacar actas e informes.
`;

/** Marca con la que el modelo propone un salto de pantalla. */
export const JUMP_RE = /\[IR:([a-z-]+)\]/gi;

/**
 * Separa el texto de la respuesta del salto de pantalla que proponga.
 * Se limpia SIEMPRE la marca, salga o no un destino válido, para que nunca
 * quede a la vista un «[IR:algo]» en mitad de una frase.
 */
export function splitJump(raw: string): { text: string; target?: string } {
  let target: string | undefined;
  for (const m of raw.matchAll(JUMP_RE)) {
    const id = m[1].toLowerCase();
    if (!target && isHelpTarget(id)) target = id;
  }
  return { text: raw.replace(JUMP_RE, '').replace(/[ \t]+\n/g, '\n').trim(), target };
}

/** Instrucciones del asistente de ayuda. */
export function helpSystemPrompt(lang: Lang, section: string): string {
  const idioma = lang === 'en'
    ? 'Answer in clear, friendly English.'
    : lang === 'ca'
      ? 'Respon SEMPRE en català, amb un to proper i directe, de tu. El manual és en castellà: tradueix al català els noms de pantalles i botons tal com els veu el docent (per exemple «Configuració», «Les meves classes», «Quadern de notes»).'
      : 'Responde en español de España, con tono cercano y directo, de tú.';

  return [
    lang === 'en'
      ? 'You are the built-in help assistant for Aula Pro, a desktop app for teachers. You explain how to USE THE APP.'
      : 'Eres el asistente de ayuda de Aula Pro, una aplicación de escritorio para docentes. Explicas CÓMO SE USA LA APLICACIÓN.',
    idioma,
    lang === 'en' ? 'RULES:' : 'REGLAS:',
    [
      lang === 'en'
        ? '1. Answer ONLY from the manual below. If something is not in it, say plainly that you are not sure instead of guessing — an invented button sends the teacher on a wild goose chase.'
        : '1. Responde SOLO con lo que dice el manual de abajo. Si algo no está, di con naturalidad que no lo sabes seguro en vez de suponerlo: un botón inventado manda al docente a dar vueltas para nada.',
      lang === 'en'
        ? '2. Be brief and practical: the exact route (“Sidebar → My Classes → New class”) and the steps in order. Two or three short paragraphs at most, or a short list.'
        : '2. Sé breve y práctico: la ruta exacta («barra lateral → Mis Clases → Nueva clase», o «Documentos → Actas» para las pantallas agrupadas) y los pasos en orden. Dos o tres párrafos cortos como mucho, o una lista breve.',
      lang === 'en'
        ? '3. You do NOT see the teacher\'s classes, students or marks. If they ask about their own data (“how is Marta doing?”), point them to the Gradebook’s “Consulta IA” tab, which does.'
        : '3. TÚ NO VES las clases, los alumnos ni las notas de este docente. Si te preguntan por sus datos («¿cómo va Marta?»), mándalos a la pestaña «Consulta IA» del Cuaderno de Notas, que es la que sí los ve.',
      lang === 'en'
        ? '4. When your answer points to one screen, end the message with its marker on its own line: [IR:id] (for example [IR:classes]). Only one, only from the manual’s ids, and never mention the marker in the text.'
        : '4. Cuando tu respuesta lleve a una pantalla concreta, termina el mensaje con su marca en una línea aparte: [IR:id] (por ejemplo [IR:classes]). Solo una, solo de los identificadores del manual, y no menciones nunca la marca en el texto.',
      lang === 'en'
        ? '5. If the question has nothing to do with the app, say so kindly and offer to help with the app instead.'
        : '5. Si la pregunta no tiene nada que ver con la aplicación, dilo con amabilidad y ofrécete a ayudar con la aplicación.',
    ].join('\n'),
    lang === 'en'
      ? `The teacher is currently on the “${section}” screen; take it into account when it helps.`
      : `Ahora mismo el docente está en la pantalla «${section}»; tenlo en cuenta si viene al caso.`,
    lang === 'en' ? '=== MANUAL ===' : '=== MANUAL ===',
    MANUAL,
  ].join('\n\n');
}
