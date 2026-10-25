/**
 * Las materias del currículo de la comunidad en el curso del nivel de competencia de un alumno de PT o AL, sin React:
 * para generar los documentos de todo el alumnado de una vez. `hooks/useMateriasDeNivel.ts` es lo mismo para una pantalla.
 */
import { resolverGrupo } from './index';
import { cargarCurriculo, curriculoEstatal, tieneCurriculoPropio, type CurriculoActivo } from './cargar';
import type { ComunidadId } from './comunidades';
import type { MateriaDeClase } from './criteriosParaIA';
import type { CursoDe } from '../../types/apoyo';

/** Las materias de un currículo ya abierto en un curso. Las Matemáticas de 4.º de ESO A y B quedan fuera: sin la opción no se sabe sus criterios. */
export function materiasDeCurriculo(curriculo: CurriculoActivo, nivel: CursoDe): MateriaDeClase[] {
  return curriculo.materias.flatMap(entry => {
    const r = resolverGrupo(nivel.etapa, entry.nombre, nivel.curso, undefined, curriculo.materias);
    return r ? [{ asignatura: entry.nombre, entry: r.entry, grupo: r.grupo }] : [];
  });
}

/** Abre el currículo de la comunidad y devuelve sus materias en el curso del nivel; vacío sin nivel. */
export async function materiasDeNivel(comunidad: ComunidadId | undefined, nivel: CursoDe | undefined, lang: 'es' | 'en' | 'ca'): Promise<MateriaDeClase[]> {
  if (!nivel) return [];
  const id = comunidad ?? 'fuera';
  const curriculo = tieneCurriculoPropio(id, nivel.etapa) ? await cargarCurriculo(id, nivel.etapa, lang) : curriculoEstatal(id, nivel.etapa);
  return curriculo ? materiasDeCurriculo(curriculo, nivel) : [];
}
