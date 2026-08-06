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
