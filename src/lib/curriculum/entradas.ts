/**
 * Del formato de los archivos de datos al de la app. Aparte de `./index.ts`,
 * que abre el currículo estatal al importarse, para que los autonómicos
 * (`./propios.ts`) la usen sin cargarlo.
 */
import type { CurriculumEntry, RawEntry } from './index';

export function normalizarEntradas(raw: RawEntry[]): CurriculumEntry[] {
  return raw.map(r => ({
    id: r.id ?? r.area ?? r.materia ?? '',
    nombre: r.area ?? r.materia ?? '',
    competencias: r.competencias,
    ...(r.competenciasPorGrupo ? { competenciasPorGrupo: r.competenciasPorGrupo } : {}),
    criterios: r.criterios,
    saberes: r.saberes,
    ...(r.cursos ? { cursos: r.cursos } : {}),
  }));
}
