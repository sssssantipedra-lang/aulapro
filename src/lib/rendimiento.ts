/**
 * Cómo va cada clase según sus rúbricas: la nota media de cada rúbrica en
 * cada clase, sobre 10. Lo pinta el carrusel de la portada de Evaluar.
 *
 * De cada alumno cuenta solo su última evaluación con esa rúbrica: volver a
 * evaluarle corrige la nota, no le hace pesar el doble en la media.
 */
import { gradeFromLevels, levelsOf, type Class, type Evaluation, type Rubric } from '../types';

export interface RendimientoRubrica {
  id: string;
  nombre: string;
  /** Media sobre 10, con un decimal. */
  media: number;
  /** Alumnos que cuentan en la media. */
  alumnos: number;
}

export interface RendimientoClase {
  classId: string;
  nombre: string;
  color: string;
  rubricas: RendimientoRubrica[];
}

/** La nota sobre 10 de una evaluación con rúbrica: la guardada o, si es antigua, la calculada. */
function notaDe(ev: Evaluation, rubrica: Rubric | undefined): number | null {
  if (typeof ev.grade === 'number') return ev.grade;
  if (!rubrica) return null;
  return gradeFromLevels(ev.scores, rubrica.criteria.map(c => c.id), levelsOf(rubrica));
}

/** Solo las clases con alguna rúbrica evaluada, en el orden de «Mis clases». */
export function rendimientoPorClase(classes: Class[], rubrics: Rubric[], evaluations: Evaluation[]): RendimientoClase[] {
  // La última evaluación de cada alumno con cada rúbrica
  const ultima = new Map<string, Evaluation>();
  for (const ev of evaluations) {
    if (ev.instrument === 'diana') continue;
    const clave = `${ev.class_id}|${ev.rubric_id}|${ev.student_id}`;
    const antes = ultima.get(clave);
    if (!antes || ev.date >= antes.date) ultima.set(clave, ev);
  }

  const orden = new Map(rubrics.map((r, i) => [r.id, i]));
  return classes.flatMap(c => {
    const porRubrica = new Map<string, { nombre: string; notas: number[] }>();
    for (const ev of ultima.values()) {
      if (ev.class_id !== c.id) continue;
      const rubrica = rubrics.find(r => r.id === ev.rubric_id);
      const nota = notaDe(ev, rubrica);
      if (nota === null) continue;
      const g = porRubrica.get(ev.rubric_id) ?? { nombre: rubrica?.name ?? ev.rubric_name, notas: [] };
      g.notas.push(nota);
      porRubrica.set(ev.rubric_id, g);
    }
    if (porRubrica.size === 0) return [];
    const rubricas = [...porRubrica.entries()]
      .map(([id, g]) => ({
        id,
        nombre: g.nombre,
        media: Math.round((g.notas.reduce((a, b) => a + b, 0) / g.notas.length) * 10) / 10,
        alumnos: g.notas.length,
      }))
      // Las borradas, al final
      .sort((a, b) => (orden.get(a.id) ?? Infinity) - (orden.get(b.id) ?? Infinity));
    return [{ classId: c.id, nombre: c.name, color: c.color, rubricas }];
  });
}
