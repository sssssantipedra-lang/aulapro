/**
 * El cuaderno por evaluaciones y la nota final de curso (20-11-2026, «Trimestres de verdad»).
 *
 * Nada se migra: cada actividad del cuaderno ya tiene fecha, y esa fecha dice en qué evaluación cuenta
 * (`cuentaEn`, `lib/periodos.ts`). Aquí está la cuenta que comparten el cuaderno y el acta:
 *
 * - `cuadernoDe`: el cuaderno de una evaluación, con solo las actividades de sus fechas y el bloque «Trabajo
 *   diario y actitud» calculado con las anotaciones de esas fechas (antes lo hacía el acta por su cuenta).
 * - `notasDeCurso`: la nota de cada evaluación y la final, con la regla que elige el docente por clase y
 *   asignatura: evaluación continua (todas las notas del curso juntas, lo de siempre y lo que sale si no se
 *   elige nada) o media de las evaluaciones, con pesos.
 */
import type { Class, GradeCategory, GradeItem, GradeMap, MarksBlockConfig, Student } from '../types';
import { applyClassMarks, BLOCK_ITEM_PREFIX, isMarksCategory, marksFor, type MarksInput } from '../services/classMarks';
import { CURSO_ENTERO, cuentaEn, EVALUACIONES, rangosGuardados, type RangoDeFechas } from './periodos';
import { mediaPonderada } from './ponderacion';

const asignaturasDe = (c: Class) => (c.subjects?.length ? c.subjects : [c.subject]);

export interface VistaDeCuaderno { gradeCategories: GradeCategory[]; gradeItems: GradeItem[]; grades: GradeMap }

/**
 * El cuaderno tal como cuenta en una evaluación (o en todo el curso, con «Final de curso»). Admite el
 * cuaderno con el bloque de anotaciones ya puesto (el que reparte `App.tsx`): lo quita y lo vuelve a
 * calcular con las anotaciones de esas fechas.
 */
export function cuadernoDe(
  d: MarksInput, periodo: string, hoy: string, guardados: Record<string, RangoDeFechas> = rangosGuardados(hoy),
): VistaDeCuaderno {
  const cuenta = (fecha: string) => cuentaEn(fecha, periodo, hoy, guardados);
  const classMarks = d.classMarks.filter(m => cuenta(m.date));
  const con = applyClassMarks({
    ...d,
    gradeCategories: d.gradeCategories.filter(c => !isMarksCategory(c.id)),
    gradeItems: d.gradeItems.filter(i => !i.id.startsWith(BLOCK_ITEM_PREFIX)),
    classMarks,
  });
  // La columna del bloque ya viene calculada con las anotaciones de la evaluación: no se filtra por su fecha
  const gradeItems = con.gradeItems.filter(i => i.id.startsWith(BLOCK_ITEM_PREFIX) || cuenta(i.date));
  if (!EVALUACIONES.includes(periodo)) return { gradeCategories: con.gradeCategories, gradeItems, grades: con.grades };

  // En una evaluación sin nada (ni una actividad ni una anotación en sus fechas) el bloque no cuenta: todo el
  // alumnado parte de la misma nota, y sin esto la 3.ª evaluación tendría en noviembre un 8,3 para cada uno
  const vacios = new Set<string>();
  for (const cat of con.gradeCategories) {
    if (!isMarksCategory(cat.id)) continue;
    const cls = d.classes.find(c => c.id === cat.class_id);
    if (!cls) continue;
    const principal = asignaturasDe(cls)[0] ?? '';
    const suyas = new Set(con.gradeCategories
      .filter(c => !isMarksCategory(c.id) && c.class_id === cls.id && (c.subject ?? principal) === cat.subject).map(c => c.id));
    const hayActividades = gradeItems.some(i => suyas.has(i.category_id));
    if (!hayActividades && marksFor(classMarks, cls, cat.subject ?? principal).length === 0) vacios.add(cat.id);
  }
  if (vacios.size === 0) return { gradeCategories: con.gradeCategories, gradeItems, grades: con.grades };
  return {
    gradeCategories: con.gradeCategories.filter(c => !vacios.has(c.id)),
    gradeItems: gradeItems.filter(i => !vacios.has(i.category_id)),
    grades: con.grades,
  };
}

/** Cómo sale la nota final de curso de una clase y asignatura. */
export interface ReglaFinal {
  /** `continua`: todas las notas del curso juntas. `media`: la media de las notas de las evaluaciones. */
  modo: 'continua' | 'media';
  /** Lo que pesa cada evaluación en la media (1.ª, 2.ª y 3.ª); iguales de partida. Solo cuenta en `media`. */
  pesos: [number, number, number];
}

export const REGLA_CONTINUA: ReglaFinal = { modo: 'continua', pesos: [1, 1, 1] };

/** La regla guardada, o la evaluación continua si no hay ninguna o no se entiende. */
export function reglaFinal(cfg: Pick<MarksBlockConfig, 'final'> | undefined | null): ReglaFinal {
  const f = cfg?.final;
  if (!f || f.modo !== 'media') return REGLA_CONTINUA;
  const p = Array.isArray(f.pesos) ? f.pesos : [];
  const pesos = [0, 1, 2].map(k => (typeof p[k] === 'number' && p[k] >= 0 && Number.isFinite(p[k]) ? p[k] : 1)) as [number, number, number];
  return pesos.some(x => x > 0) ? { modo: 'media', pesos } : { modo: 'media', pesos: [1, 1, 1] };
}

/** Lo que pesa cada evaluación, en % y sumando 100. */
export function porcentajesDeEvaluaciones(regla: ReglaFinal): [number, number, number] {
  const total = regla.pesos.reduce((a, b) => a + b, 0) || 1;
  return regla.pesos.map(p => (p / total) * 100) as [number, number, number];
}

/** Una nota como se enseña y se firma: con un decimal. */
export const aUnDecimal = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10);

/**
 * La media de las evaluaciones con sus pesos. Se hace con las notas ya redondeadas a un decimal, las que el
 * docente ve en el cuaderno y firma en cada acta, para que la cuenta se pueda repasar a mano. Una evaluación
 * sin nota todavía no resta: en febrero, la final provisional es la media de la 1.ª y la 2.ª.
 */
export function mediaDeEvaluaciones(notas: readonly (number | null)[], regla: ReglaFinal): number | null {
  let suma = 0, pesos = 0;
  notas.forEach((n, k) => {
    const v = aUnDecimal(n), w = regla.pesos[k] ?? 0;
    if (v === null || w <= 0) return;
    suma += v * w;
    pesos += w;
  });
  return pesos > 0 ? suma / pesos : null;
}

export interface NotasDeCurso {
  /** La nota de la 1.ª, la 2.ª y la 3.ª evaluación; `null` si no tiene notas en ella. */
  evaluaciones: [number | null, number | null, number | null];
  /** Todas las notas del curso juntas, como una sola evaluación. */
  continua: number | null;
  /** La nota final con la regla elegida. */
  final: number | null;
}

/** Las categorías de una clase y asignatura en una vista (las de antes de haber varias asignaturas son de la principal). */
export function categoriasDe(vista: Pick<VistaDeCuaderno, 'gradeCategories'>, cls: Class, subject: string): GradeCategory[] {
  const principal = asignaturasDe(cls)[0] ?? '';
  return vista.gradeCategories.filter(c => c.class_id === cls.id && (c.subject ?? principal) === subject);
}

export interface CuadernoDeCurso {
  /** El cuaderno de cada evaluación (1.ª, 2.ª y 3.ª) y el de todo el curso. */
  vistas: [VistaDeCuaderno, VistaDeCuaderno, VistaDeCuaderno];
  curso: VistaDeCuaderno;
  /** Las notas de cada alumno de la clase. */
  notas: Map<string, NotasDeCurso>;
}

/**
 * Las notas de curso del alumnado de una clase en una asignatura: la de cada evaluación, la de todo el
 * curso junto y la final con `regla`. Solo calcula esa clase, aunque `d` traiga el cuaderno entero.
 */
export function notasDeCurso(
  d: MarksInput, cls: Class, subject: string, regla: ReglaFinal, hoy: string,
  guardados: Record<string, RangoDeFechas> = rangosGuardados(hoy),
): CuadernoDeCurso {
  const alumnado: Student[] = d.students.filter(s => s.class_id === cls.id);
  const suyo: MarksInput = {
    ...d, classes: [cls], students: alumnado,
    gradeCategories: d.gradeCategories.filter(c => c.class_id === cls.id),
    gradeItems: d.gradeItems.filter(i => i.class_id === cls.id),
    classMarks: d.classMarks.filter(m => m.class_id === cls.id),
  };
  const vistas = EVALUACIONES.map(p => cuadernoDe(suyo, p, hoy, guardados)) as [VistaDeCuaderno, VistaDeCuaderno, VistaDeCuaderno];
  const curso = cuadernoDe(suyo, CURSO_ENTERO, hoy, guardados);
  const nota = (v: VistaDeCuaderno, id: string) => mediaPonderada(categoriasDe(v, cls, subject), v.gradeItems, v.grades, id);
  const notas = new Map<string, NotasDeCurso>();
  for (const s of alumnado) {
    const evaluaciones = vistas.map(v => nota(v, s.id)) as NotasDeCurso['evaluaciones'];
    const continua = nota(curso, s.id);
    notas.set(s.id, { evaluaciones, continua, final: regla.modo === 'media' ? mediaDeEvaluaciones(evaluaciones, regla) : continua });
  }
  return { vistas, curso, notas };
}
