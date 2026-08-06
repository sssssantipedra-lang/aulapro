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
}

const I18nContext = createContext<Ctx>({ lang: 'es', setLang: () => {}, t: k => k });

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
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  return useContext(I18nContext);
}

/** Cuántos textos hay traducidos, para poder medir la cobertura. */
export const TRANSLATED_KEYS = Object.keys(EN).length;
