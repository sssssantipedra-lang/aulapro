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
