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

import type { Lang } from '../i18n';

/**
 * Secciones a las que el asistente puede llevar de un salto. Son los mismos
 * identificadores que usa `Section` en types/index.ts; se validan contra esta
 * lista antes de pintar el botón, para que un identificador inventado por la
 * IA no deje un botón que no lleva a ninguna parte.
 */
export const HELP_TARGETS: Record<string, { es: string; en: string }> = {
  dashboard:             { es: 'Inicio', en: 'Home' },
  classes:               { es: 'Mis Clases', en: 'My Classes' },
  agenda:                { es: 'Agenda', en: 'Planner' },
  notebook:              { es: 'Cuaderno de Notas', en: 'Gradebook' },
  attendance:            { es: 'Asistencia', en: 'Attendance' },
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
  profile:               { es: 'Mi Perfil', en: 'My Profile' },
};

/**
 * El manual. Se escribe en castellano aunque la interfaz esté en inglés: el
 * modelo traduce sin problema al responder, y mantener una sola versión evita
 * que las dos se desincronicen (que es como se cuela la información falsa).
 */
const MANUAL = `
=== QUÉ ES AULA PRO ===
Aplicación de escritorio para el profesorado español (currículo LOMLOE). Todo se
guarda en el ordenador del docente: no hay cuentas, ni servidor, ni nube. Cada
docente tiene su perfil, con su propia carpeta de datos y copia automática cada
10 minutos. Puede haber varios perfiles en el mismo ordenador.

Las funciones de IA usan una clave gratuita de Google Gemini que el docente pega
en Mi Perfil. Sin clave, la aplicación funciona entera menos lo que redacta la IA.

Las notas van sobre 10 y el aprobado está en 5. La aplicación está en español e
inglés (se cambia en la pantalla de bienvenida y en Mi Perfil).

=== CÓMO SE NAVEGA ===
Barra lateral a la izquierda, con cinco grupos: Principal, Evaluación, Recursos,
Mi actividad docente y Herramientas. Cada grupo se pliega y despliega pulsando
su cabecera, y la barra entera se estrecha con la flecha de arriba.

=== PRINCIPAL ===

[dashboard] INICIO
Resumen del día: clases de hoy, número de alumnos, tareas pendientes y
evaluaciones. Muestra el horario de hoy, los próximos eventos, las alertas de
alumnos y el rendimiento por clase. Desde aquí se añaden tareas rápidas.
Si no hay nada creado, ofrece «Crear mi primera clase» y «Cargar datos de
ejemplo» (datos ficticios para trastear sin miedo).

[classes] MIS CLASES
El punto de partida de todo. Se crea una clase con nombre, una o varias
asignaturas, aula y color; se puede marcar como tutoría. Dentro de cada clase se
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
centro —una foto, un PDF o una hoja de cálculo (Excel, CSV)— y la IA lo
transcribe a bloques.

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

[attendance] ASISTENCIA
Pasar lista por clase y día. Cuatro estados: presente, falta, retraso y
justificada. Hay botón de «Todos presentes» para marcar la clase entera de
golpe. El porcentaje de asistencia cuenta el retraso y la falta justificada como
asistencia. Se exporta a CSV.

=== EVALUACIÓN ===

[rubrics] RÚBRICAS
Rúbricas con criterios y niveles de logro (el nivel más alto equivale a un 10 y
el resto reparte proporcionalmente); se pueden crear a mano o con la IA. Aquí se
evalúa a cada alumno. IMPORTANTE: si la rúbrica declara clase y categoría del
cuaderno, la nota entra sola en el cuaderno en una columna propia; si no las
declara, la evaluación se queda solo en el Historial.

[diana] DIANA COMPETENCIAL
Perfil visual de competencias clave de un alumno, en forma de diana. Se elige
clase y alumno.

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

=== RECURSOS ===

[learning-situations] SITUACIONES DE APRENDIZAJE
Diseña una SdA competencial LOMLOE con la IA a partir de una idea, las áreas, el
nivel y el número de sesiones. Se puede adjuntar normativa o programación para
que la tenga en cuenta. Sale con justificación, competencias, criterios, saberes,
medidas de inclusión, sesiones y evaluación. Se exporta a PDF y Word, y desde
ella se generan la rúbrica, la diana y las fichas de trabajo.

[resources] RECURSOS
Fichas de trabajo generadas con la IA a partir de un tema, el área y el nivel:
ejercicios de varios tipos, incluidas sopas de letras y figuras geométricas que
dibuja la propia aplicación. Se exportan a PDF (vertical, para repartir en
clase) y a Word. Las soluciones son solo para el docente: no salen en la ficha
exportada.

=== MI ACTIVIDAD DOCENTE ===

[meetings] REUNIONES y [trainings] FORMACIONES
Funcionan igual. Se apuntan anotaciones en bruto durante un claustro, una
reunión de departamento o un curso —frases sueltas, nombres, acuerdos— y después
la IA redacta el documento final: el ACTA en el caso de las reuniones (puntos
tratados, acuerdos, tareas con responsable y plazo, cierre) y la MEMORIA en el
de las formaciones (contenidos, ideas clave, aplicación en el aula, valoración).
Se puede retocar a mano y exportar a PDF y Word. La IA no añade nada que no esté
en las anotaciones. No van atadas a ninguna clase, y el vaciado de fin de curso
no las borra.

=== HERRAMIENTAS ===

[sec-classroom] AULA LIVE
Herramientas para proyectar en clase: temporizador, sorteo de alumnos (se puede
ir sacando sin repetir) y medidor de ruido con el micrófono, con aviso al pasar
de un nivel.

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

[audit] REGISTRO DE CAMBIOS
Quién cambió qué y cuándo: notas, alumnos, asistencia, evaluaciones… Con filtros
y buscador, y se exporta a CSV. Útil cuando dos docentes comparten trabajo o
para justificar un cambio de nota.

[profile] MI PERFIL
Datos del docente, idioma y tema de color. Aquí se pega la CLAVE API GRATUITA DE
GOOGLE que activa toda la IA, con una guía de dos minutos y un botón de probar
conexión. También: copia de seguridad (exportar e importar un archivo con todo),
ver la carpeta donde se guardan los datos, contraseña opcional para el perfil, y
el VACIADO DE FIN DE CURSO, que borra clases, alumnos, notas, evaluaciones,
asistencia e informes y conserva rúbricas, dianas, reuniones y formaciones
(hace una copia antes).

=== PREGUNTAS FRECUENTES ===
- «¿Dónde se guardan mis datos?»: en una carpeta de este ordenador, una por
  perfil. Se ve y se abre desde Mi Perfil. Nunca salen a ningún servidor.
- «¿Cómo hago copia de seguridad?»: Mi Perfil → exportar. Da un archivo que se
  guarda donde se quiera y se puede volver a importar.
- «No me funciona la IA»: casi siempre es la clave API. Mi Perfil → probar
  conexión. Si dice que se ha alcanzado el límite, es la cuota gratuita de
  Google: esperar un minuto.
- «¿Por qué no puedo guardar en PDF?»: el PDF solo funciona en la aplicación de
  escritorio. Word funciona siempre.
- «¿Se actualiza sola?»: en Windows sí. Al arrancar comprueba si hay versión
  nueva, avisa con una notificación y la descarga en segundo plano; se instala
  al pulsar «Reiniciar y actualizar» o al cerrar la aplicación. En Mac hay que
  descargarla a mano.
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
    if (!target && HELP_TARGETS[id]) target = id;
  }
  return { text: raw.replace(JUMP_RE, '').replace(/[ \t]+\n/g, '\n').trim(), target };
}

/** Instrucciones del asistente de ayuda. */
export function helpSystemPrompt(lang: Lang, section: string): string {
  const idioma = lang === 'en'
    ? 'Answer in clear, friendly English.'
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
        : '2. Sé breve y práctico: la ruta exacta («barra lateral → Mis Clases → Nueva clase») y los pasos en orden. Dos o tres párrafos cortos como mucho, o una lista breve.',
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
