/**
 * Las áreas en las que puntúa un material de una situación de aprendizaje interdisciplinar (rúbrica o diana)
 * y lo que se guarda según las que elija el docente. La pantalla que las elige es `components/PuntuaEnAreas.tsx`.
 */
import type { AreaTarget, Class, GradeCategory, GradeTarget } from '../types';

/** Un área de la situación de aprendizaje, con la materia oficial de la que salen sus criterios. */
export interface AreaSda { area: string; materia?: string }
export type ModoAreas = 'misma' | 'criterio';

export const mismo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const asignaturasDe = (c?: Class | null): string[] => (c?.subjects?.length ? c.subjects : c ? [c.subject] : []).filter(Boolean);

/** La asignatura de la clase que corresponde a un área de la SdA, si la hay. */
export const asignaturaDeArea = (clase: Class | null | undefined, area: string): string | undefined =>
  asignaturasDe(clase).find(s => mismo(s, area));

/** La categoría del cuaderno con ese nombre en esa asignatura de esa clase. */
export function categoriaDe(gradeCategories: GradeCategory[], clase: Class, asignatura: string, nombre: string): GradeCategory | undefined {
  const subs = asignaturasDe(clase);
  return gradeCategories.find(c => c.class_id === clase.id && (c.subject ?? subs[0] ?? '') === asignatura && mismo(c.name, nombre));
}

/**
 * Lo que se guarda en la rúbrica o la diana según las áreas elegidas: una sola
 * área funciona como siempre; con varias, `areas` y la forma de repartir la nota.
 */
export function destinoDeAreas(
  clase: Class, areas: AreaSda[], elegidas: string[], modo: ModoAreas, nombreCategoria: string, gradeCategories: GradeCategory[],
): Pick<GradeTarget, 'subject' | 'category_id' | 'areas' | 'modo_areas'> {
  const lista: AreaTarget[] = areas
    .filter(a => elegidas.some(e => mismo(e, a.area)))
    .flatMap(a => {
      const subject = asignaturaDeArea(clase, a.area);
      if (!subject) return [];
      return [{ subject, materia: a.materia, category_id: nombreCategoria ? categoriaDe(gradeCategories, clase, subject, nombreCategoria)?.id : undefined }];
    });
  if (lista.length === 0) return {};
  const [primera] = lista;
  return lista.length < 2
    ? { subject: primera.subject, category_id: primera.category_id }
    : { subject: primera.subject, category_id: primera.category_id, areas: lista, modo_areas: modo };
}

