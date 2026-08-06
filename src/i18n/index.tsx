import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Idiomas de la aplicación.
 *
 * El inglés no es una traducción literal del castellano: usa la terminología
 * internacional que reconoce un docente de un colegio británico o de un centro
 * IB (Units of Inquiry, Learning Outcomes, Formative Assessment…), porque
 * traducir «unidad didáctica» palabra por palabra no significa nada fuera de
 * España. Ver `docs/GLOSARIO-EN.md`.
 */
export type Lang = 'es' | 'en';

export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
];

const STORAGE_KEY = 'aulapro_lang';

/**
 * Diccionario. La clave es el texto en castellano, que es el idioma en el que
 * está escrita la aplicación: así, una cadena sin traducir se muestra en
 * castellano en lugar de enseñar una clave rota al usuario.
 */
const EN: Record<string, string> = {
  /* ── Navegación ── */
  'Principal': 'Main',
  'Inicio': 'Home',
  'Mis Clases': 'My Classes',
  'Agenda': 'Planner',
  'Cuaderno de Notas': 'Gradebook',
  'Asistencia': 'Attendance',
  'Evaluación': 'Assessment',
  'Rúbricas': 'Rubrics',
  'Diana Competencial': 'Learner Profile Tracking',
  'Informes': 'Reports',
  'Actas': 'Grade Sheets',
  'Autoevaluaciones': 'Self-Assessments',
  'Historial': 'Assessment History',
  'Herramientas': 'Tools',
  'Aula Live': 'Live Classroom',
  'Sala de alumnos': 'Student Room',
  'Trabajo compartido': 'Shared Workspace',
  'Registro de cambios': 'Change Log',
  'Mi Perfil': 'My Profile',
  'Cerrar sesión': 'Sign out',
  'Colapsar': 'Collapse',
  'Todo guardado': 'All saved',
  'Guardando…': 'Saving…',
  'Diseñada sobre el currículo educativo español (LOMLOE)':
    'Built on the Spanish national curriculum (LOMLOE)',

  /* ── Bienvenida ── */
  'Bienvenido/a a Aula Pro': 'Welcome to Aula Pro',
  'Nuevo perfil': 'New profile',
  'Tu cuaderno docente, en tu ordenador': 'Your teaching gradebook, on your own computer',
  'Tu nombre': 'Your name',
  'Centro educativo': 'School',
  'Especialidad': 'Subject specialism',
  'Curso escolar': 'Academic year',
  'Empezar a usar Aula Pro': 'Get started',
  'Explorar con datos de ejemplo': 'Explore with sample data',
  'Cargando perfiles…': 'Loading profiles…',
  'Cada perfil guarda su propio trabajo en una carpeta separada de este equipo. Sin cuentas ni contraseñas.':
    'Each profile keeps its own work in a separate folder on this computer. No accounts, no passwords.',
  'Los datos se guardan en este navegador. Sin cuentas ni contraseñas.':
    'Data is stored in this browser. No accounts, no passwords.',
  'Diseñada sobre el currículo educativo español (LOMLOE): competencias clave, criterios de evaluación y niveles de logro.':
    'Built on the Spanish national curriculum (LOMLOE): key competences, assessment criteria and achievement levels.',

  /* ── Inicio ── */
  'Buenos días': 'Good morning',
  'Buenas tardes': 'Good afternoon',
  'Buenas noches': 'Good evening',
  'Clases hoy': 'Classes today',
  'Alumnos': 'Students',
  'Tareas pendientes': 'Open tasks',
  'Evaluaciones': 'Assessments',
  'Rendimiento': 'Performance',
  'Abrir el cuaderno': 'Open the gradebook',
  'Tareas': 'Tasks',
  'Añadir tarea': 'Add task',
  'Ver todos los alumnos': 'View all students',
  'Ver agenda': 'View planner',
  'Ver todo': 'View all',
  'Evaluar': 'Assess',
  'Diana': 'Learner profile',
  'y {n} alumnos más': 'and {n} more students',
  'Anterior': 'Previous',
  'Siguiente': 'Next',
  'Detener el paso automático': 'Pause auto-rotation',
  'Reanudar el paso automático': 'Resume auto-rotation',
  'Sin clases hoy': 'No classes today',
  'sesiones programadas': 'sessions scheduled',
  'en {n} grupo': 'in {n} class',
  'en {n} grupos': 'in {n} classes',
  'por completar': 'to do',
  'Al día ✓': 'All caught up ✓',
  'registradas con rúbrica': 'recorded with a rubric',
  'Ninguna todavía': 'None yet',
  'Empieza creando tu primera clase': 'Start by creating your first class',
  'Añade un grupo (por ejemplo «3º ESO A») con su lista de alumnos. A partir de ahí podrás poner notas en el cuaderno, evaluar con rúbricas y organizar tu agenda.':
    'Add a class group (e.g. "Year 10A") with its student list. From there you can enter grades in the gradebook, assess with rubrics and organise your planner.',
  'Crear mi primera clase': 'Create my first class',
  'Cargar datos de ejemplo': 'Load sample data',
  'Horario de hoy': 'Today’s schedule',
  'Sin clases programadas para hoy.': 'No classes scheduled for today.',
  'Configura tu horario semanal en la Agenda.': 'Set up your weekly timetable in the Planner.',
  'Próximos eventos': 'Upcoming events',
  'Sin eventos próximos. Añádelos desde la Agenda.': 'No upcoming events. Add them from the Planner.',
  'Alertas de alumnos': 'Student alerts',
  'Sin alertas activas': 'No active alerts',
  'Apunta aquí tus recordatorios: corregir, preparar material…': 'Jot down your reminders here: marking, prepping materials…',

  /* ── Cuaderno ── */
  'Calificaciones': 'Grades',
  'Estás evaluando': 'Assessing',
  'Exportar a Excel': 'Export to Excel',
  'Categoría': 'Category',
  'Añadir nota': 'Add column',
  'Media': 'Average',
  'Media del grupo': 'Class average',
  'Alumno': 'Student',
  'Exámenes': 'Tests',
  'Participación': 'Participation',
  'Peso en la media (%)': 'Weight in average (%)',

  /* ── Evaluación ── */
  'Nueva rúbrica': 'New rubric',
  'Editar rúbrica': 'Edit rubric',
  'Nueva diana de evaluación': 'New assessment target',
  'Editar diana': 'Edit assessment target',
  'Criterio': 'Criterion',
  'Niveles de logro': 'Achievement levels',
  'Añadir nivel': 'Add level',
  'El mejor nivel': 'Highest level',
  'Dónde se guarda la nota': 'Where the grade is recorded',
  'Clase': 'Class',
  'Asignatura': 'Subject',
  'Categoría del cuaderno': 'Gradebook category',
  'Sin clase (solo historial)': 'No class (history only)',
  'Solo el historial, no el cuaderno': 'History only, not the gradebook',
  'Guardar evaluación': 'Save assessment',
  'Evaluar alumno': 'Assess student',
  'Duplicar rúbrica': 'Duplicate rubric',
  'Duplicar diana': 'Duplicate assessment target',
  'Insuficiente': 'Below expectations',
  'Suficiente': 'Approaching expectations',
  'Bien': 'Meeting expectations',
  'Excelente': 'Exceeding expectations',

  /* ── Informes y actas ── */
  'Informes competenciales': 'Learning outcome reports',
  'Actas de calificaciones': 'Official grade sheets',
  'Acta de calificaciones': 'Official grade sheet',
  'Generar informe': 'Generate report',
  'Volver a generar': 'Regenerate',
  'Guardar en PDF': 'Save as PDF',
  'Todos en PDF': 'All as PDF',
  'Imprimir': 'Print',
  'Elige un alumno': 'Choose a student',
  'Sin datos suficientes': 'Not enough evidence',
  'Periodo': 'Reporting period',
  'Materia': 'Subject',
  'Grupo': 'Class group',
  'Docente': 'Teacher',
  'Calificación': 'Grade',
  'Nota': 'Score',

  /* ── Mi Perfil ── */
  'Datos personales, IA y copia de seguridad': 'Personal data, AI and backup',
  'Datos personales': 'Personal data',
  'Curso': 'Year',
  'Perfil local · datos en este equipo': 'Local profile · data stored on this computer',
  'Editar datos': 'Edit details',
  'Apellidos': 'Surname',
  'Ej: IES Ejemplo': 'e.g. Greenfield School',
  'Ej: Matemáticas': 'e.g. Mathematics',
  'Guardar cambios': 'Save changes',
  'Preferencias': 'Preferences',
  'Idioma · Language': 'Language',
  'En inglés se usa terminología internacional (Units of Inquiry, Learning Outcomes, Formative Assessment), no una traducción literal. Los datos que tú escribes no se traducen.':
    'English uses international terminology (Units of Inquiry, Learning Outcomes, Formative Assessment), not a literal translation. Anything you type in yourself is never translated.',
  'Color de la interfaz': 'Interface colour',
  'Azul cielo': 'Sky blue',
  'Esmeralda': 'Emerald',
  'Violeta': 'Violet',
  'Rosa': 'Rose',
  'Ámbar': 'Amber',
  'Pizarra': 'Slate',
  'Asistente de IA': 'AI assistant',
  'Datos y copia de seguridad': 'Data & backup',
  'Llevar a otro equipo': 'Move to another computer',
  'Descarga un archivo con todo tu trabajo para pasarlo a otro ordenador o guardarlo aparte.':
    'Download a file with all your work to move it to another computer or keep a copy elsewhere.',
  'Descargar mis datos': 'Download my data',
  'Cargar desde archivo': 'Load from file',

  /* ── Mis Clases ── */
  '{n} clase': '{n} class',
  '{n} clases': '{n} classes',
  '{n} alumno en total': '{n} student in total',
  '{n} alumnos en total': '{n} students in total',
  'Nueva clase': 'New class',
  'Nuevo alumno': 'New student',
  'Buscar alumno…': 'Search students…',
  'Importar CSV': 'Import CSV',
  'MI TUTORÍA': 'FORM TUTOR',
  'Otro docente': 'Another teacher',
  'LISTA DE {owner}': "{owner}’S LIST",
  'La lista de alumnos la mantiene quien comparte la clase. Tus cambios en ella se sustituirán al sincronizar.':
    'The class list is kept by whoever shared the class. Your changes to it will be overwritten when it syncs.',
  'Eliminar clase': 'Delete class',
  'Sin resultados para esa búsqueda': 'No results for that search',
  'Esta clase no tiene alumnos aún': 'This class has no students yet',
  'Ver ficha': 'View profile',
  'Crea una clase para empezar': 'Create a class to get started',
  'Ficha del alumno': 'Student profile',
  'Nombre completo': 'Full name',
  'Notas': 'Notes',
  'Observaciones, adaptaciones, etc.': 'Comments, accommodations, etc.',
  'Alertas': 'Alerts',
  'Sin alertas': 'No alerts',
  'Texto de la alerta': 'Alert text',
  'Aviso': 'Warning',
  'Alerta': 'Alert',
  'Últimas evaluaciones': 'Recent assessments',
  'Nueva evaluación': 'New assessment',
  'Sin evaluaciones registradas': 'No assessments recorded',
  'Ej. 5º A': 'e.g. Year 10A',
  'Ej. A102': 'e.g. Room 12',
  'Soy el tutor o la tutora de este grupo': 'I am the form tutor for this group',
  'Aparecerá marcado en los listados y en los informes.': 'This will be flagged in lists and reports.',
  'Asignaturas que le das': 'Subjects you teach this class',
  'Ej. Matemáticas': 'e.g. Mathematics',
  'Ej. Lengua': 'e.g. English',
  'Quitar': 'Remove',
  'Añadir otra asignatura': 'Add another subject',
  'Si le das varias, no crees una clase por cada una: pon aquí todas y luego elegirás cuál evalúas en el cuaderno, las rúbricas y las dianas.':
    'If you teach it several subjects, don’t create a separate class for each: list them all here and you’ll choose which one to assess in the gradebook, rubrics and learner-profile tracking.',
  'Crear clase': 'Create class',
  'Importar alumnos (CSV)': 'Import students (CSV)',
  'Pega las filas en formato': 'Paste the rows in the format',
  'Nombre,Email': 'Name,Email',
  '(una por línea). La primera fila puede ser una cabecera.': '(one per line). The first row may be a header.',
  'Datos CSV': 'CSV data',
  'Importar': 'Import',
  'El nombre es obligatorio': 'Name is required',
  'Alumno añadido': 'Student added',
  'Alumno actualizado': 'Student updated',
  '¿Eliminar a {name}?': 'Delete {name}?',
  'Alumno eliminado': 'Student deleted',
  'El nombre de la clase es obligatorio': 'Class name is required',
  'Pon al menos una asignatura': 'Add at least one subject',
  'Clase creada con {n} asignaturas': 'Class created with {n} subjects',
  'Clase creada': 'Class created',
  'No se encontraron filas válidas': 'No valid rows found',
  '{n} alumno importado': '{n} student imported',
  '{n} alumnos importados': '{n} students imported',
  '¿Eliminar la clase "{name}"? Se perderán todos sus datos.': 'Delete the class "{name}"? All its data will be lost.',
  'Clase eliminada': 'Class deleted',

  /* ── Agenda ── */
  'Horario semanal y calendario de eventos': 'Weekly timetable and events calendar',
  'Escanear horario': 'Scan timetable',
  'Nuevo bloque': 'New session',
  'Nuevo evento': 'New event',
  'Mensual': 'Monthly',
  'Semanal': 'Weekly',
  'Selecciona un día': 'Select a day',
  'Evento': 'Event',
  'Sin eventos para este día': 'No events for this day',
  'Urgencia': 'Urgency',
  'Escribe el nombre de la asignatura': 'Enter the subject name',
  'La hora de fin debe ser posterior a la de inicio': 'The end time must be later than the start time',
  'Escribe un nombre para el evento': 'Enter a name for the event',
  '✅ {n} sesión añadida al horario': '✅ {n} session added to the timetable',
  '✅ {n} sesiones añadidas al horario': '✅ {n} sessions added to the timetable',
  'Editar bloque': 'Edit session',
  'Día': 'Day',
  'Hora inicio': 'Start time',
  'Hora fin': 'End time',
  'Asignatura': 'Subject',
  'Nombre de la asignatura': 'Subject name',
  'Ej: Aula 301': 'e.g. Room 301',
  'Clase': 'Class',
  'Añadir': 'Add',
  'Editar evento': 'Edit event',
  'Nombre del evento': 'Event name',
  'Hora': 'Time',
  'Tipo': 'Type',
  'Descripción': 'Description',
  'Descripción opcional…': 'Optional description…',
  'Escanear mi horario': 'Scan my timetable',
  'La IA lee tu horario y crea los bloques por ti': 'The AI reads your timetable and creates the sessions for you',
  'Para leer el horario hace falta la clave gratuita de Google que se configura en Mi Perfil.':
    'Reading the timetable needs the free Google key set up in My Profile.',
  'Configurar la IA': 'Set up AI',
  'Se han detectado {n} sesiones.': 'Detected {n} sessions.',
  'Revísalas antes de añadirlas': 'Review them before adding',
  'y desmarca las que no sean tuyas.': 'and untick any that aren’t yours.',
  'Grupo': 'Class',
  'Añadir {n} sesión': 'Add {n} session',
  'Añadir {n} sesiones': 'Add {n} sessions',
  'Probar con otro archivo': 'Try another file',
  'Se añaden a tu horario actual': 'These are added to your current timetable',
  'Leyendo el archivo…': 'Reading the file…',
  'La IA está interpretando tu horario…': 'The AI is reading your timetable…',
  'Elige tu horario': 'Choose your timetable',
  'Vale una foto del papel, una captura, un PDF, un Excel o un CSV.':
    'A photo of the paper copy, a screenshot, a PDF, an Excel file or a CSV all work.',
  'Foto o captura': 'Photo or screenshot',
  'Del horario en papel': 'Of the paper timetable',
  'Excel o CSV': 'Excel or CSV',
  'El del centro': 'The one from your school',
  'Tal cual te lo dieron': 'Exactly as you were given it',
  'El archivo se envía a Google para interpretarlo. Podrás revisar todo antes de que se añada nada.':
    'The file is sent to Google to read it. You’ll be able to review everything before anything is added.',
  'El archivo supera el límite de 19 MB.': 'The file is over the 19 MB limit.',
  'No se pudo leer el archivo. Prueba a guardarlo como CSV o hacerle una foto.':
    'Couldn’t read the file. Try saving it as a CSV or taking a photo of it.',
  'No se ha reconocido ningún horario. Prueba con una foto más nítida o con el archivo en CSV.':
    'No timetable was recognised. Try a sharper photo or the file as a CSV.',
  'No has dejado ninguna sesión marcada': 'You haven’t left any session ticked',

  /* ── Cuaderno de notas ── */
  'Calificaciones con media ponderada y asistente pedagógico': 'Grades with weighted average and a teaching assistant',
  'Consulta IA': 'AI Consultation',
  'Aún no tienes clases': 'You don’t have any classes yet',
  'Para usar el cuaderno de notas, primero crea una clase con sus alumnos.':
    'To use the gradebook, first create a class with its students.',
  'Ir a Mis Clases': 'Go to My Classes',
  'La clase': 'The class',
  'todavía no tiene alumnos.': 'has no students yet.',
  'Añadir alumnos': 'Add students',
  '¿Cómo evalúas en {name}?': 'How do you assess in {name}?',
  'Define las categorías de nota y cuánto pesa cada una en la media. Puedes empezar con la configuración más habitual y ajustarla después.':
    'Define your grading categories and how much each is worth in the average. You can start with the most common setup and adjust it later.',
  'Usar configuración típica (60/30/10)': 'Use the typical setup (60/30/10)',
  'Crear a mi manera': 'Set up my own',
  'Editar categoría': 'Edit category',
  'Los pesos suman {n}% (lo ideal es 100%)': 'Weights add up to {n}% (100% is ideal)',
  'Ya casi está. Añade tu primera columna de notas.': 'Almost there. Add your first grade column.',
  'Por ejemplo: «Examen Tema 1» en Exámenes, o «Cuaderno» en Tareas.':
    'For example: "Unit 1 Test" under Tests, or "Notebook" under Homework.',
  'clic para editar': 'click to edit',
  '¿Eliminar con sus notas?': 'Delete along with its grades?',
  'Categoría eliminada': 'Category deleted',
  '✅ Categoría creada': '✅ Category created',
  '✅ Categoría actualizada': '✅ Category updated',
  'Nueva categoría': 'New category',
  'Ej: Exámenes': 'e.g. Tests',
  'Ej: 60': 'e.g. 60',
  'Añadir nota': 'Add column',
  'Editar nota': 'Edit column',
  'Ej: Examen Tema 3': 'e.g. Unit 3 Test',
  'Columna eliminada': 'Column deleted',
  '✅ Columna de nota añadida': '✅ Grade column added',
  '✅ Actualizada': '✅ Updated',
  'Escribe un nombre para la categoría': 'Enter a name for the category',
  'El peso debe ser un número entre 1 y 100': 'Weight must be a number between 1 and 100',
  'Escribe un nombre (ej: Examen Tema 3)': 'Enter a name (e.g. Unit 3 Test)',
  'Elige una categoría': 'Choose a category',
  'No hay alumnos en esta clase': 'There are no students in this class',
  '✅ Notas exportadas (ábrelas con Excel)': '✅ Grades exported (open with Excel)',
  'Media ponderada': 'Weighted average',
  'Consulta pedagógica': 'Teaching question',
  'Pregunta o contexto': 'Question or context',
  'Escribe tu pregunta pedagógica, describe una situación del aula, pide ideas de actividades…':
    'Write your teaching question, describe a classroom situation, ask for activity ideas…',
  'Adjuntar documento': 'Attach document',
  'Quitar archivo adjunto': 'Remove attached file',
  'Consultando…': 'Asking…',
  'Preguntar a la IA': 'Ask the AI',
  'Respuesta': 'Answer',
  'Generando respuesta…': 'Generating answer…',
  'Normativa de referencia': 'Reference regulations',
  'Adjunta el BOE o el currículo de tu comunidad y la IA lo tendrá en cuenta en todas sus respuestas.':
    'Attach your national or regional curriculum document and the AI will take it into account in every answer.',
  'Adjuntar normativa (PDF…)': 'Attach regulations (PDF…)',
  'Quitar normativa': 'Remove regulations',
  'Últimas consultas': 'Recent questions',
  'Tus últimas 5 consultas aparecerán aquí': 'Your last 5 questions will appear here',
  'Ver esta consulta': 'View this question',
  'El archivo supera el límite de 19 MB': 'The file is over the 19 MB limit',
  '✅ Normativa adjuntada': '✅ Regulations attached',
  'No se pudo leer el archivo': 'Couldn’t read the file',
  'Escribe una pregunta antes de consultar': 'Write a question before asking',
  'Para usar la IA necesitas una clave gratuita de Google (se configura en 2 minutos).':
    'To use the AI you need a free Google key (takes 2 minutes to set up).',
  'Configurar ahora': 'Set up now',
  'Esta asignatura todavía no tiene categorías en el cuaderno. Crea una (Exámenes, Trabajos…) y vuelve aquí; mientras tanto la evaluación se guardará solo en el historial.':
    'This subject doesn’t have any gradebook categories yet. Create one (Tests, Assignments…) and come back here; until then, the assessment will only be saved in the history.',
  'Cada alumno que evalúes aparecerá al momento en el cuaderno, en una columna propia de este instrumento.':
    'Every student you assess will appear instantly in the gradebook, in a column of its own for this instrument.',
  'Si vuelves a evaluar al mismo alumno, su nota anterior se sustituye.':
    'If you assess the same student again, their previous grade is replaced.',

  /* ── Asistencia ── */
  'Presente': 'Present',
  'Falta': 'Absent',
  'Retraso': 'Late',
  'Justificada': 'Excused',
  '✅ Todos presentes': '✅ Everyone present',
  'Todavía no hay días registrados': 'No days recorded yet',
  '✅ Asistencia exportada': '✅ Attendance exported',
  '% asistencia': '% attendance',
  'Pasa lista en unos segundos': 'Take the register in seconds',
  '{n} día registrado': '{n} day recorded',
  '{n} días registrados': '{n} days recorded',
  'en {name}': 'in {name}',
  'Pasar lista': 'Take register',
  'Resumen': 'Summary',
  'Para pasar lista, primero crea una clase con sus alumnos.': 'To take the register, first create a class with its students.',
  'Día anterior': 'Previous day',
  'Día siguiente': 'Next day',
  '{marked}/{total} marcados': '{marked}/{total} marked',
  ' · hoy': ' · today',
  'Hoy': 'Today',
  'Todos presentes': 'Mark all present',
  'Toca para cambiar el estado': 'Tap to change status',
  'Sin marcar': 'Not marked',
  'Toca el nombre para ir cambiando el estado, o usa los botones. Se guarda solo.':
    'Tap the name to cycle through statuses, or use the buttons. It saves automatically.',
  'Todavía no has pasado lista en {name}.': 'You haven’t taken the register in {name} yet.',
  'El porcentaje cuenta como asistencia los retrasos y las faltas justificadas.':
    'The percentage counts lateness and excused absences as attendance.',

  /* ── Rúbricas ── */
  'Editar rúbrica': 'Edit rubric',
  'Genera criterios con IA': 'Generate criteria with AI',
  'Define los criterios manualmente': 'Define the criteria manually',
  'Manual': 'Manual',
  'Nombre del nivel': 'Level name',
  'Quitar nivel': 'Remove level',
  'El último es el más alto y equivale a un 10; el resto reparte proporcionalmente.':
    'The last one is the highest and is worth a 10; the rest are spread proportionally.',
  'Si cambias el número de niveles de una rúbrica ya usada, las evaluaciones anteriores se recalcularán sobre la escala nueva.':
    'If you change the number of levels on a rubric that’s already in use, past assessments will be recalculated on the new scale.',
  'Clase (opcional)': 'Class (optional)',
  'Sin clase específica': 'No specific class',
  'Clase no especificada': 'No class specified',
  'Contexto de la actividad *': 'Activity context *',
  'Ej: Presentación oral sobre la Revolución Francesa, 2º ESO...': 'e.g. Oral presentation on the French Revolution, Year 9...',
  'Número de criterios': 'Number of criteria',
  '{n} criterios': '{n} criteria',
  'Generando...': 'Generating...',
  '✨ Generar rúbrica': '✨ Generate rubric',
  'Vista previa: {name}': 'Preview: {name}',
  'Aplicar y editar': 'Apply and edit',
  'Nombre de la rúbrica *': 'Rubric name *',
  'Ej: Exposición oral': 'e.g. Oral presentation',
  'Nombre del criterio': 'Criterion name',
  'Eliminar criterio': 'Delete criterion',
  'Nivel {n}': 'Level {n}',
  'Descriptor…': 'Descriptor…',
  'Añadir criterio': 'Add criterion',
  'Crear rúbrica': 'Create rubric',
  'La IA no devolvió una rúbrica válida. Vuelve a intentarlo.': 'The AI didn’t return a valid rubric. Try again.',
  'Haz clic en el nivel para cada criterio': 'Click the level for each criterion',
  'Selecciona clase...': 'Select a class...',
  'Selecciona alumno...': 'Select a student...',
  'Criterio': 'Criterion',
  '✨ Evaluar trabajo con IA': '✨ Assess work with AI',
  'Descripción del trabajo': 'Description of the work',
  'Describe brevemente el trabajo del alumno...': 'Briefly describe the student’s work...',
  'Adjuntar archivo': 'Attach file',
  'Evaluando...': 'Assessing...',
  '✨ Evaluar con IA': '✨ Assess with AI',
  '✨ Generar con IA': '✨ Generate with AI',
  'Escribe observaciones sobre el alumno...': 'Write comments about the student...',
  'Puntuación total:': 'Total score:',
  'La IA no devolvió una evaluación válida. Vuelve a intentarlo.': 'The AI didn’t return a valid assessment. Try again.',
  '{n} rúbrica': '{n} rubric',
  '{n} rúbricas': '{n} rubrics',
  '{n} diana': '{n} learner-profile target',
  '{n} dianas': '{n} learner-profile targets',
  '{n} evaluación': '{n} assessment',
  '{n} evaluaciones': '{n} assessments',
  'Dianas': 'Learner Profile',
  'Define criterios con descriptores por nivel y evalúa marcando la casilla que corresponda.':
    'Define criteria with descriptors per level and assess by ticking the matching box.',
  'Sin rúbricas todavía': 'No rubrics yet',
  'Crea tu primera rúbrica manualmente o con ayuda de la IA.': 'Create your first rubric manually or with the AI’s help.',
  '✨ Crear rúbrica': '✨ Create rubric',
  '{n} criterio': '{n} criterion',
  '+{n} más': '+{n} more',
  'Evaluaciones recientes': 'Recent assessments',
  '{n} total': '{n} total',
  'Rúbrica': 'Rubric',
  'Puntuación': 'Score',
  'DIANA': 'TARGET',
  'Eliminar rúbrica': 'Delete rubric',
  '¿Seguro que quieres eliminar esta rúbrica? Las evaluaciones asociadas no se borrarán.':
    'Are you sure you want to delete this rubric? Its associated assessments won’t be deleted.',
  '✅ Rúbrica duplicada, con su propia columna en el cuaderno': '✅ Rubric duplicated, with its own gradebook column',

  /* ── Diana competencial ── */
  'Comunicación': 'Communication',
  'Matemática': 'Mathematics',
  'Digital': 'Digital',
  'Social': 'Social',
  'Aprender a aprender': 'Learning to learn',
  'Emprendimiento': 'Enterprise',
  'Nv.{n}': 'Lv.{n}',
  'Perfil de competencias clave por alumno': 'Key competency profile per student',
  'Reiniciar': 'Reset',
  'Guardado ✓': 'Saved ✓',
  '— Selecciona una clase —': '— Select a class —',
  '— Selecciona un alumno —': '— Select a student —',
  'Selecciona un alumno': 'Select a student',
  'Elige una clase y un alumno para ver su Diana Competencial': 'Choose a class and a student to see their Learner Profile',
  '{n}/{total} competencias evaluadas': '{n}/{total} competencies assessed',
  '{n}/{max} pts': '{n}/{max} pts',
  'Sugerir perfil con IA': 'Suggest profile with AI',
  '{n} evaluación disponible': '{n} assessment available',
  '{n} evaluaciones disponibles': '{n} assessments available',
  'para análisis': 'for analysis',
  'Haz clic sobre un eje, a la altura del nivel que quieras darle': 'Click along an axis, at the height of the level you want to give it',
  'Ajuste por competencia': 'Adjust by competency',
  'Editando: {name}': 'Editing: {name}',
  'Descriptores': 'Descriptors',
  'Analizando perfil competencial...': 'Analysing competency profile...',
  'Sin descriptor. Usa "Sugerir con IA" para generarlo.': 'No descriptor. Use "Suggest with AI" to generate one.',
  'Escribe un descriptor para esta competencia...': 'Write a descriptor for this competency...',
  '{n} competencia pendiente': '{n} competency left',
  '{n} competencias pendientes': '{n} competencies left',
  '✅ Diana guardada': '✅ Learner profile saved',
  'La IA no devolvió un perfil válido. Vuelve a intentarlo.': 'The AI didn’t return a valid profile. Try again.',
  'Diana de evaluación': 'Assessment target',

  /* ── Dianas de evaluación ── */
  'Describe la actividad que quieres evaluar': 'Describe the activity you want to assess',
  'sin clase concreta': 'no specific class',
  'Editar diana': 'Edit target',
  'Nueva diana de evaluación': 'New assessment target',
  'Describe la actividad y la IA propone los ítems': 'Describe the activity and the AI proposes the items',
  'Ajusta los ítems y su peso en la nota': 'Adjust the items and their weight in the grade',
  '✨ Con IA': '✨ With AI',
  'Cada nivel es un anillo de la diana. El último es el más alto y equivale a un 10.':
    'Each level is a ring of the target. The last one is the highest and is worth a 10.',
  'Sin clase concreta': 'No specific class',
  '¿Qué quieres evaluar? *': 'What do you want to assess? *',
  'Ej: Trabajo cooperativo en el proyecto de ecosistemas, 2º ESO': 'e.g. Cooperative work on the ecosystems project, Year 8',
  'Número de ítems': 'Number of items',
  '{n} ítems': '{n} items',
  'Generando diana…': 'Generating target…',
  '✨ Generar diana': '✨ Generate target',
  'Nombre de la diana *': 'Target name *',
  'Ej: Trabajo cooperativo': 'e.g. Cooperative work',
  'Ítems a evaluar': 'Items to assess',
  'Nombre del ítem': 'Item name',
  'Peso del ítem en la nota': 'Item weight in the grade',
  'Peso ×1': 'Weight ×1',
  'Peso ×2': 'Weight ×2',
  'Peso ×3': 'Weight ×3',
  'Quitar ítem': 'Remove item',
  'Añadir ítem': 'Add item',
  'Vista previa': 'Preview',
  'Añade al menos 3 ítems para ver la diana': 'Add at least 3 items to see the target',
  'Crear diana': 'Create target',
  'Haz clic en cada sector para marcar el nivel de logro': 'Click each sector to mark the achievement level',
  'Selecciona clase…': 'Select a class…',
  'Selecciona alumno…': 'Select a student…',
  'Nota calculada': 'Calculated grade',
  '{n}/{total} ítems marcados': '{n}/{total} items marked',
  'Ítems': 'Items',
  'Sin marcar': 'Not marked',
  'Comentarios para el alumno o la familia…': 'Comments for the student or family…',
  'Elige el alumno al que evalúas': 'Choose the student you’re assessing',
  'Marca al menos un ítem en la diana': 'Mark at least one item on the target',
  'Marca el nivel de logro de cada ítem y la nota sobre 10 se calcula sola.':
    'Mark the achievement level of each item and the grade out of 10 is calculated for you.',
  'Nueva diana': 'New target',
  'Sin dianas todavía': 'No targets yet',
  'Una diana es una forma visual y rápida de evaluar: describe la actividad, la IA propone los ítems y tú solo marcas el nivel alcanzado.':
    'A target is a quick, visual way to assess: describe the activity, the AI proposes the items, and you just mark the level reached.',
  '✨ Crear mi primera diana': '✨ Create my first target',
  '{n} evaluación': '{n} assessment',
  'Duplicar diana': 'Duplicate assessment target',
  'Eliminar diana': 'Delete target',
  '¿Seguro que quieres eliminar esta diana? Las evaluaciones ya guardadas se conservan en el Historial.':
    'Are you sure you want to delete this target? Assessments already saved are kept in the History.',
  'Diana eliminada': 'Target deleted',
  '✅ Diana duplicada, con su propia columna en el cuaderno': '✅ Target duplicated, with its own gradebook column',
  '✅ Diana generada — revísala antes de guardar': '✅ Target generated — review it before saving',
  '✅ Diana actualizada': '✅ Target updated',
  '✅ Diana creada': '✅ Target created',
  '✅ Evaluación guardada — nota {grade}': '✅ Assessment saved — grade {grade}',
  'La IA no devolvió una diana válida. Vuelve a intentarlo.': 'The AI didn’t return a valid target. Try again.',
  'Ponle un nombre a la diana': 'Give the target a name',
  'La diana necesita al menos 3 ítems': 'The target needs at least 3 items',

  /* ── Informes ── */
  'no tiene evaluaciones ni notas todavía': 'has no assessments or grades yet',
  'Ya están todos generados para este periodo': 'They’re all already generated for this period',
  '{n} informe generado': '{n} report generated',
  '{n} informes generados': '{n} reports generated',
  'No se pudo generar ningún informe': 'Couldn’t generate any report',
  'No hay informes de este periodo': 'There are no reports for this period',
  'No se pudo generar el PDF: {error}': 'Couldn’t generate the PDF: {error}',
  '✅ Informe guardado en PDF': '✅ Report saved as PDF',
  '✅ {n} informe guardado en PDF': '✅ {n} report saved as PDF',
  '✅ {n} informes guardados en PDF': '✅ {n} reports saved as PDF',
  '✅ Informes descargados': '✅ Reports downloaded',
  'Redactados por la IA con tus propias evaluaciones': 'Written by AI from your own assessments',
  'Los informes se redactan a partir de las evaluaciones y notas de tus alumnos.': 'Reports are written from your students’ assessments and grades.',
  '{n}/{total} generados · {period}': '{n}/{total} generated · {period}',
  'Copia en texto plano, para pegar en otro sitio': 'Plain-text copy, to paste elsewhere',
  'Texto': 'Text',
  'Generando…': 'Generating…',
  'Generar los que faltan': 'Generate the missing ones',
  'Los informes los redacta la IA. Necesitas configurar tu clave gratuita de Google.':
    'Reports are written by AI. You need to set up your free Google key.',
  'Configurar': 'Set up',
  '· generado el {date}': '· generated on {date}',
  'Eliminar informe': 'Delete report',
  'Informe eliminado': 'Report deleted',
  'Redactando el informe…': 'Writing the report…',
  '✅ Informe actualizado': '✅ Report updated',
  'Revísalo siempre antes de entregarlo. La IA se equivoca.': 'Always review it before handing it out. The AI makes mistakes.',
  'La IA redacta el informe a partir de sus evaluaciones, sus notas del cuaderno y su asistencia, centrado en las competencias clave de la LOMLOE que ha desarrollado.':
    'The AI writes the report from their assessments, gradebook marks and attendance, focused on the key competencies they’ve developed.',
  '{name} no tiene todavía evaluaciones ni notas en el cuaderno. Un informe sin datos serían solo frases genéricas, así que es mejor evaluarle antes.':
    '{name} doesn’t have any assessments or gradebook marks yet. A report with no data would just be generic phrases, so it’s best to assess them first.',
  'Ir a Evaluación': 'Go to Assessment',
  'Ir al Cuaderno': 'Go to the Gradebook',
  'Se usarán sus evaluaciones, su media del cuaderno y su asistencia para redactar el informe.':
    'Their assessments, gradebook average and attendance will be used to write the report.',
  'Informe de evaluación competencial': 'Competency assessment report',
  'Informe redactado con asistencia de inteligencia artificial a partir de las evaluaciones, calificaciones y asistencia registradas, y revisado por el docente. Competencias clave según el currículo educativo español (LOMLOE).':
    'Report written with AI assistance from the assessments, grades and attendance on record, and reviewed by the teacher. Key competencies per the Spanish national curriculum (LOMLOE).',
  '1ª evaluación': 'Term 1',
  '2ª evaluación': 'Term 2',
  '3ª evaluación': 'Term 3',
  'Final de curso': 'End of year',

  /* ── Actas ── */
  'Documento oficial listo para imprimir o firmar': 'Official document ready to print or sign',
  '{n}/{total} calificados': '{n}/{total} graded',
  'Datos en CSV': 'Data as CSV',
  'Preparando…': 'Preparing…',
  'Imprimir o guardar en PDF': 'Print or save as PDF',
  'Desglose por categorías': 'Breakdown by category',
  'Calificación en palabras': 'Grade in words',
  'Pie de firma': 'Signature block',
  'Atención:': 'Note:',
  'los pesos de las categorías suman {n}%, no 100%. La nota final se calcula igualmente en proporción, pero revisa el cuaderno antes de firmar el acta.':
    'the category weights add up to {n}%, not 100%. The final grade is still calculated proportionally, but check the gradebook before signing the sheet.',
  'Acta de': 'Grade sheet for',
  'El acta se genera con las notas del cuaderno de una clase.': 'The grade sheet is generated from a class’s gradebook marks.',
  'Nº': 'No.',
  'Alumno/a': 'Student',
  'Nota': 'Grade',
  'Calificación': 'Result',
  'alumnos': 'students',
  'con calificación positiva': 'with a passing grade',
  'negativa': 'failing',
  'sin calificar': 'not graded',
  'Media del grupo': 'Class average',
  'A día {day} de {month} del año {year}': 'On {day} {month} {year}',
  'Fdo.: {name}': 'Signed: {name}',
  'Esta clase no tiene alumnos': 'This class has no students',
  '✅ Acta guardada en PDF': '✅ Grade sheet saved as PDF',
  'No se pudo imprimir: {error}': 'Couldn’t print: {error}',
  '✅ Datos descargados': '✅ Data downloaded',
  'Nota final': 'Final grade',

  /* ── Historial ── */
  'de {n} totales': 'of {n} total',
  'en total': 'in total',
  'Instrumento': 'Instrument',
  'Todas las clases': 'All classes',
  'Todos los alumnos': 'All students',
  'Todos los instrumentos': 'All instruments',
  'Autoevaluaciones de la Sala': 'Student-room self-assessments',
  'Alumno, rúbrica, notas...': 'Student, rubric, notes...',
  'Sin evaluaciones': 'No assessments',
  'Todavía no hay evaluaciones registradas': 'No assessments recorded yet',
  'No hay resultados con los filtros actuales': 'No results with the current filters',
  'Notas:': 'Notes:',
  '{n} resultado': '{n} result',
  '{n} resultados': '{n} results',

  /* ── Autoevaluaciones ── */
  'Aún no': 'Not yet',
  'A veces': 'Sometimes',
  'Casi siempre': 'Usually',
  'Siempre': 'Always',
  'Lo que responden los alumnos desde su móvil': 'What students answer from their phone',
  'Todavía no hay ninguna': 'There aren’t any yet',
  'Cuando abras una sala con una rúbrica o una diana, lo que contesten tus alumnos se guardará aquí automáticamente. Después decides si lo pasas al historial de evaluaciones o lo descartas.':
    'When you open a room with a rubric or a target, what your students answer will be saved here automatically. Afterwards you decide whether to move it to the assessment history or discard it.',
  'Ir a la Sala de alumnos': 'Go to the Student Room',
  '{n} sesión guardada': '{n} session saved',
  '{n} sesiones guardadas': '{n} sessions saved',
  '{n} sin decidir': '{n} undecided',
  'a las {time}': 'at {time}',
  'Esto es lo que dicen los alumnos de sí mismos, no una calificación tuya. Por eso se guarda aparte y nunca entra en el cuaderno: si la pasas al historial, queda marcada como autoevaluación.':
    'This is what students say about themselves, not a grade from you. That’s why it’s kept separate and never goes into the gradebook: if you move it to the history, it’s marked as a self-assessment.',
  'Plegar': 'Collapse',
  'Ver respuestas': 'View answers',
  'EN EL HISTORIAL': 'IN THE HISTORY',
  'SIN DECIDIR': 'UNDECIDED',
  '{n} respuesta': '{n} response',
  '{n} respuestas': '{n} responses',
  ' · media {avg}': ' · average {avg}',
  'Pasar al historial': 'Move to history',
  'Descartar': 'Discard',
  '✅ {n} autoevaluación pasada al historial': '✅ {n} self-assessment moved to the history',
  '✅ {n} autoevaluaciones pasadas al historial': '✅ {n} self-assessments moved to the history',
  'Se borrarán las respuestas de {n} alumno de «{title}».\n\nEsto no se puede deshacer.':
    'The answers of {n} student in "{title}" will be deleted.\n\nThis can’t be undone.',
  'Se borrarán las respuestas de {n} alumnos de «{title}».\n\nEsto no se puede deshacer.':
    'The answers of {n} students in "{title}" will be deleted.\n\nThis can’t be undone.',
  'Autoevaluación descartada': 'Self-assessment discarded',

  /* ── Registro de cambios ── */
  'Creó': 'Created',
  'Cambió': 'Changed',
  'Borró': 'Deleted',
  'Prueba': 'Item',
  'Informe': 'Report',
  'Rúbrica': 'Rubric',
  'Sincronización': 'Sync',
  'Sistema': 'System',
  'Clases': 'Classes',
  'Compartido': 'Shared',
  'Todo': 'All',
  'Todos los docentes': 'All teachers',
  'No hay nada que exportar con estos filtros': 'There’s nothing to export with these filters',
  '✅ Registro descargado': '✅ Log downloaded',
  'Se borrará todo el registro de cambios.\n\nLos datos (notas, alumnos, evaluaciones) NO se tocan: solo desaparece el historial de quién cambió qué. Esta acción no se puede deshacer.':
    'The entire change log will be deleted.\n\nThe data (grades, students, assessments) is NOT touched: only the record of who changed what disappears. This can’t be undone.',
  'Registro vaciado': 'Log cleared',
  'Quién cambió qué, y cuándo': 'Who changed what, and when',
  'Descargar CSV': 'Download CSV',
  'Vaciar': 'Clear',
  'Todavía no hay nada anotado': 'Nothing recorded yet',
  'A partir de ahora, cada nota que pongas, cada alumno que añadas y cada evaluación que guardes dejará constancia aquí: qué era antes, qué es ahora y quién lo hizo.':
    'From now on, every grade you enter, every student you add and every assessment you save will leave a trace here: what it was before, what it is now, and who did it.',
  'Buscar un alumno, una prueba…': 'Search a student, an item…',
  'Ningún cambio coincide con lo que buscas.': 'No change matches your search.',
  '{n} cambio': '{n} change',
  '{n} cambios': '{n} changes',
  '{n} cambio registrado': '{n} change recorded',
  '{n} cambios registrados': '{n} changes recorded',
  'El registro se guarda con tus datos y entra en las copias de seguridad. Se conservan los':
    'The log is saved with your data and included in backups. The most recent',
  'cambios más recientes; a partir de ahí los más antiguos se van descartando. Si compartes trabajo con otro docente, aquí verás también lo que llega de su equipo.':
    'changes are kept; older ones are discarded from there on. If you share work with another teacher, you’ll also see what comes in from their side here.',

  /* ── Trabajo compartido ── */
  'Tu compañero/a puede escanear el QR o escribir el código': 'Your colleague can scan the QR code or type in the code',
  'Copiado': 'Copied',
  'Copiar código': 'Copy code',
  '✅ Código copiado': '✅ Code copied',
  'No se pudo copiar. Dicta el código a tu compañero/a.': 'Couldn’t copy it. Read the code out to your colleague.',
  'Conexión activa con otro docente': 'Active connection with another teacher',
  'Desconectar': 'Disconnect',
  'Conectado con {name}': 'Connected with {name}',
  'tu compañero/a': 'your colleague',
  'Los cambios de los dos se sincronizan automáticamente': 'Both of your changes sync automatically',
  'Clases': 'Classes',
  'Rúbricas y dianas': 'Rubrics and targets',
  'Puedes seguir trabajando con normalidad en cualquier sección: la conexión sigue viva mientras la app esté abierta.':
    'You can keep working as normal in any section: the connection stays alive while the app is open.',
  'Lo que borra uno de los dos también se borra en el otro equipo': 'What either of you deletes is also deleted on the other computer',
  ', así los dos veis siempre los mismos datos.': ', so you both always see the same data.',
  'Trabaja a la vez con otro docente sobre las mismas clases': 'Work at the same time as another teacher on the same classes',
  'Elige qué quieres compartir': 'Choose what you want to share',
  'Todavía no tienes clases que compartir. Crea una en «Mis Clases».': 'You don’t have any classes to share yet. Create one in "My Classes".',
  'Cuaderno de notas': 'Gradebook',
  'Categorías, columnas y calificaciones': 'Categories, columns and grades',
  'Los instrumentos de evaluación': 'The assessment instruments',
  'Evaluaciones': 'Assessments',
  'Los resultados ya guardados': 'The results already saved',
  'Conecta con tu compañero/a': 'Connect with your colleague',
  'Marca antes al menos una clase para poder conectar.': 'Tick at least one class first to be able to connect.',
  'Yo invito': 'I’ll invite',
  'Creo un código de 6 caracteres y se lo digo.': 'I create a 6-character code and tell it to them.',
  'Me han invitado': 'I’ve been invited',
  'Escaneo su QR o escribo el código.': 'I scan their QR code or type in the code.',
  'Creando la sesión…': 'Creating the session…',
  'Esperando a que se una… Deja esta ventana abierta.': 'Waiting for them to join… Leave this window open.',
  'Escribe el código que te han dado': 'Type in the code you were given',
  '6 caracteres. No distingue mayúsculas de minúsculas.': '6 characters. Not case-sensitive.',
  'Conectando…': 'Connecting…',
  'Conectar': 'Connect',
  'Leer el QR con la cámara': 'Read the QR code with the camera',
  'Escanear QR': 'Scan QR',
  'Empezar de nuevo': 'Start over',
  'Cómo funciona': 'How it works',
  'Marcas las clases que quieres compartir.': 'You tick the classes you want to share.',
  'Uno crea la sesión: le sale un código y un QR.': 'One of you creates the session: you get a code and a QR.',
  'El otro escanea el QR o escribe el código.': 'The other scans the QR or types in the code.',
  'Los cambios de los dos se ven al momento.': 'Both of your changes show up instantly.',
  'Privacidad': 'Privacy',
  'Los datos de tus alumnos viajan': 'Your students’ data travels',
  'directos de un equipo a otro': 'directly from one computer to the other',
  ' y cifrados.': ' and encrypted.',
  'El código solo sirve para que los dos ordenadores se encuentren; por ese servicio no pasan los datos.':
    'The code is only used so the two computers can find each other; the data doesn’t pass through that service.',
  'Nunca se comparte tu perfil ni tu clave de la IA.': 'Your profile and AI key are never shared.',
  'Si escaneas el QR, la cámara solo busca el código: no graba ni envía imágenes.':
    'If you scan the QR code, the camera only looks for the code: it doesn’t record or send images.',
  'Compartes datos de alumnos: hazlo solo con docentes del centro que deban acceder a ellos.':
    'You’re sharing student data: only do it with school staff who should have access to it.',
  '¿No conecta?': 'Not connecting?',
  'Hacen falta internet en los dos equipos y que la red del centro no bloquee las conexiones directas. Si no hay manera, usa la copia de seguridad de «Mi Perfil» para pasar los datos.':
    'Both computers need internet, and the school network must not block direct connections. If it just won’t work, use the backup in "My Profile" to move the data across.',

  /* ── Escáner QR de sesión ── */
  'Ese QR no es de una sesión de Aula Pro.': 'That QR code isn’t from an Aula Pro session.',
  'Este equipo no tiene cámara disponible.': 'This computer doesn’t have a camera available.',
  'No se pudo usar la cámara. Permite el acceso en el navegador o escribe el código a mano.':
    'Couldn’t use the camera. Allow access in the browser, or type in the code by hand.',
  'Escribir el código a mano': 'Type in the code by hand',
  'Pidiendo permiso…': 'Requesting permission…',
  'Apunta al código QR de tu compañero/a': 'Point at your colleague’s QR code',

  /* ── Sala de alumnos ── */
  'Autoevaluación': 'Self-assessment',
  'Se puntúan con tus criterios': 'They score themselves with your criteria',
  'Lluvia de ideas': 'Brainstorm',
  'Envían ideas al mural': 'They send ideas to the wall',
  'Votación': 'Poll',
  'Eligen una opción': 'They pick an option',
  'Crea antes una clase con sus alumnos en «Mis Clases».': 'First create a class with its students in "My Classes".',
  'Esa clase todavía no tiene alumnos.': 'That class has no students yet.',
  'Necesitas crear antes una rúbrica o una diana en Evaluación.': 'You need to create a rubric or a target in Assessment first.',
  'Elige arriba la rúbrica o la diana con la que se autoevaluarán.': 'Choose above the rubric or target they’ll self-assess with.',
  'Escribe el tema de la lluvia de ideas.': 'Write the brainstorm topic.',
  'Escribe la pregunta de la votación.': 'Write the poll question.',
  'La votación necesita dos opciones como mínimo.': 'The poll needs at least two options.',
  'Revisa la configuración de la actividad.': 'Check the activity settings.',
  'Configura antes la actividad': 'Set up the activity first',
  '✅ Sala abierta': '✅ Room opened',
  'Sala cerrada': 'Room closed',
  '✅ Nueva actividad enviada a los móviles': '✅ New activity sent to phones',
  'Solo desde la aplicación de escritorio': 'Desktop app only',
  'Para que los alumnos se conecten, Aula Pro tiene que abrir una sala en tu propio ordenador, y eso solo puede hacerlo la aplicación instalada (AulaPro.exe), no la versión de navegador.':
    'For students to connect, Aula Pro needs to open a room on your own computer, and only the installed application (AulaPro.exe) can do that, not the browser version.',
  'Sala abierta · {n} respuesta recibida': 'Room open · {n} response received',
  'Sala abierta · {n} respuestas recibidas': 'Room open · {n} responses received',
  'Actividades desde el móvil, sin instalar nada': 'Activities from a phone, nothing to install',
  'Cerrar sala': 'Close room',
  'Abriendo…': 'Opening…',
  'Abrir sala': 'Open room',
  '{n} alumno numerado': '{n} student numbered',
  '{n} alumnos numerados': '{n} students numbered',
  'por orden alfabético. Entrarán con su número de lista o su nombre.': 'in alphabetical order. They’ll join with their roll number or their name.',
  'Actividad': 'Activity',
  'Enviar a los móviles': 'Send to phones',
  '¿Con qué se autoevalúan?': 'What will they self-assess with?',
  'Elige una rúbrica o diana…': 'Choose a rubric or target…',
  'Necesitas al menos una rúbrica o diana.': 'You need at least one rubric or target.',
  'Crear': 'Create',
  'Instrucción para el alumno (opcional)': 'Instruction for the student (optional)',
  'Ej: Piensa en cómo has trabajado hoy con tu grupo.': 'e.g. Think about how you worked with your group today.',
  'Pregunta': 'Question',
  'Tema': 'Topic',
  'Ej: ¿Qué hemos entendido mejor?': 'e.g. What did we understand best?',
  'Ej: ¿Qué sabemos sobre los ecosistemas?': 'e.g. What do we know about ecosystems?',
  'Aclaración (opcional)': 'Clarification (optional)',
  'Una frase que les oriente': 'A sentence to guide them',
  'Opciones': 'Options',
  'Añadir opción': 'Add option',
  'Para proyectar': 'To project',
  'O escribid en el navegador': 'Or type this into a browser',
  'Código': 'Code',
  'Si no conecta, prueba con {addresses}': 'If it doesn’t connect, try {addresses}',
  'Eliges la clase y la actividad.': 'You choose the class and the activity.',
  'Abres la sala y proyectas el QR.': 'You open the room and project the QR code.',
  'Los alumnos lo escanean con el móvil.': 'Students scan it with their phone.',
  'Entran con su número de lista.': 'They join with their roll number.',
  'Ves sus respuestas aquí en directo.': 'You see their answers here live.',
  'Todos en la misma wifi.': 'Everyone on the same wifi.',
  ' No hace falta internet: los móviles hablan solo con tu ordenador. Si no conectan, puede que la red del centro aísle los dispositivos; entonces comparte datos desde tu móvil y conectaos a esa red.':
    ' No internet needed: phones only talk to your computer. If they can’t connect, the school network may be isolating devices; in that case, share your phone’s data connection and connect to that instead.',
  'Respuestas en directo': 'Live answers',
  'Aún no ha contestado nadie. Las respuestas aparecerán aquí solas.': 'No one has answered yet. Answers will appear here on their own.',
  'Faltan:': 'Missing:',
  ' y {n} más': ' and {n} more',
  'Se guarda solo, aunque cierres la sala. Decides después si lo pasas al historial de evaluaciones.':
    'It saves itself, even if you close the room. You decide afterwards whether to move it to the assessment history.',
  'Ver autoevaluaciones': 'View self-assessments',

  /* ── Comunes ── */
  'Cancelar': 'Cancel',
  'Guardar': 'Save',
  'Eliminar': 'Delete',
  'Editar': 'Edit',
  'Crear': 'Create',
  'Buscar': 'Search',
  'Nombre': 'Name',
  'Aula': 'Room',
  'Color': 'Color',
  'Fecha': 'Date',
  'Observaciones': 'Comments',
  'Cargando…': 'Loading…',
  'Abriendo tu cuaderno…': 'Opening your gradebook…',
};

const DICTS: Record<Lang, Record<string, string>> = { es: {}, en: EN };

/**
 * Traduce una cadena. Función pura, aparte del componente, para poder
 * probarla sin montar React.
 *
 * Si no hay traducción devuelve el original: la aplicación está escrita en
 * castellano, así que lo que falte se lee en castellano en lugar de dejar un
 * hueco o enseñar una clave.
 */
export function translate(
  lang: Lang, key: string, vars?: Record<string, string | number>,
): string {
  let out = DICTS[lang]?.[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Traduce. Si no hay traducción devuelve el original, nunca una clave. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Locale para Intl / toLocaleDateString / toLocaleString, según el idioma activo. */
  locale: string;
}

const LOCALES: Record<Lang, string> = { es: 'es-ES', en: 'en-GB' };

/**
 * Etiquetas de prioridad (Alta/Media/Baja) fuera del diccionario general:
 * «Media» también significa «Average» en el cuaderno de notas, y el
 * diccionario traduce por texto en castellano, no por contexto. Con una
 * clave propia evitamos que una traducción se pise con la otra.
 */
const PRIORITY_LABELS: Record<'high' | 'medium' | 'low', Record<Lang, string>> = {
  high:   { es: 'Alta', en: 'High' },
  medium: { es: 'Media', en: 'Medium' },
  low:    { es: 'Baja', en: 'Low' },
};
export function priorityLabel(p: 'high' | 'medium' | 'low', lang: Lang): string {
  return PRIORITY_LABELS[p][lang];
}

/** Urgencia de un evento de agenda: mismas tres palabras que la prioridad, con sus propias claves. */
const URGENCY_LABELS: Record<'alta' | 'media' | 'baja', Record<Lang, string>> = {
  alta:  { es: 'Alta', en: 'High' },
  media: { es: 'Media', en: 'Medium' },
  baja:  { es: 'Baja', en: 'Low' },
};
export function urgencyLabel(u: 'alta' | 'media' | 'baja', lang: Lang): string {
  return URGENCY_LABELS[u][lang];
}

/** Tipo de evento de agenda. */
const EVENT_TYPE_LABELS: Record<'deadline' | 'meeting' | 'event', Record<Lang, string>> = {
  deadline: { es: 'Entrega', en: 'Deadline' },
  meeting:  { es: 'Reunión', en: 'Meeting' },
  event:    { es: 'Evento', en: 'Event' },
};
export function eventTypeLabel(t: 'deadline' | 'meeting' | 'event', lang: Lang): string {
  return EVENT_TYPE_LABELS[t][lang];
}

/** Nombre de mes o de día de la semana, localizado y con mayúscula inicial. */
export function monthLabel(monthIndex0: number, locale: string): string {
  const s = new Date(2024, monthIndex0, 1).toLocaleDateString(locale, { month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** dayIndex0Mon: 0 = lunes … 6 = domingo (2024-01-01 fue lunes). */
export function weekdayLabel(dayIndex0Mon: number, locale: string, style: 'short' | 'long' = 'long'): string {
  const s = new Date(2024, 0, 1 + dayIndex0Mon).toLocaleDateString(locale, { weekday: style });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const I18nContext = createContext<Ctx>({ lang: 'es', setLang: () => {}, t: k => k, locale: 'es-ES' });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' ? 'en' : 'es';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang: setLangState,
    t: (key, vars) => translate(lang, key, vars),
    locale: LOCALES[lang],
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  return useContext(I18nContext);
}

/** Cuántos textos hay traducidos, para poder medir la cobertura. */
export const TRANSLATED_KEYS = Object.keys(EN).length;
