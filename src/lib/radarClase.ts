/**
 * El radar de la clase (18-11-2026, decisión del dueño): las reglas de la ficha
 * del alumno (`lib/resumenAlumno.ts`) aplicadas a todo el alumnado, para ver de
 * un vistazo quién necesita atención y quién va especialmente bien, sin abrir
 * ficha a ficha. Mira siempre las últimas 4 semanas: es «cómo van ahora».
 *
 * Solo entra lo que de verdad pesa (`UMBRAL_RADAR`): una anotación suelta o una
 * actividad sin nota se ven en la ficha, pero no bastan para salir aquí; si no,
 * media clase estaría siempre en la lista.
 */
import type { AttendanceMap, Class, ClassMark, Evaluation, GradeCategory, GradeItem, GradeMap, Student } from '../types';
import { resumenAlumno, type DatoResumen } from './resumenAlumno';

/** Peso mínimo de un dato para que su alumno salga en el radar. */
export const UMBRAL_RADAR = 65;

export interface AlumnoEnRadar {
  student: Student;
  cls: Class;
  /** Lo más importante de ese lado. */
  dato: DatoResumen;
  /** Cuántas cosas tiene en ese lado por encima del umbral. */
  cuantos: number;
}

export interface Radar {
  /** Quién necesita atención, lo más grave primero. */
  atencion: AlumnoEnRadar[];
  /** Quién va especialmente bien, y no está en la otra lista. */
  destacan: AlumnoEnRadar[];
}

export interface DatosParaRadar {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  grades: GradeMap;
  attendance: AttendanceMap;
  classMarks: ClassMark[];
  evaluations: Evaluation[];
  /** Hoy, YYYY-MM-DD. */
  hoy: string;
}

export function radar(d: DatosParaRadar): Radar {
  const atencion: AlumnoEnRadar[] = [], destacan: AlumnoEnRadar[] = [];
  for (const cls of d.classes) {
    const suyos = d.students.filter(s => s.class_id === cls.id);
    const companeros = suyos.map(s => s.id);
    for (const student of suyos) {
      const r = resumenAlumno({ ...d, student, cls, companeros, periodo: 'semanas' });
      const malos = r.atencion.filter(x => x.peso >= UMBRAL_RADAR);
      const buenos = r.positivos.filter(x => x.peso >= UMBRAL_RADAR);
      if (malos.length) atencion.push({ student, cls, dato: malos[0], cuantos: malos.length });
      // Quien necesita atención no sale además como que va bien: un mensaje por alumno
      else if (buenos.length) destacan.push({ student, cls, dato: buenos[0], cuantos: buenos.length });
    }
  }
  const porPeso = (a: AlumnoEnRadar, b: AlumnoEnRadar) => b.dato.peso - a.dato.peso || b.cuantos - a.cuantos;
  return { atencion: atencion.sort(porPeso), destacan: destacan.sort(porPeso) };
}

/** El radar de una sola clase. */
export const radarDeClase = (r: Radar, claseId: string): Radar => ({
  atencion: r.atencion.filter(x => x.cls.id === claseId),
  destacan: r.destacan.filter(x => x.cls.id === claseId),
});
