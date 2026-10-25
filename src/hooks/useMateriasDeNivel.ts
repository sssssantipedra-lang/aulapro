import { useMemo } from 'react';
import { useCurriculo } from './useCurriculo';
import { materiasDeCurriculo } from '../lib/curriculum/materiasDeNivel';
import type { CurriculoActivo } from '../lib/curriculum/cargar';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import type { EstadoCurriculoClase } from './useNotasPorCompetencias';
import type { CursoDe } from '../types/apoyo';

/**
 * Todas las materias del currículo de la comunidad en un curso: el del nivel
 * de competencia de un alumno de PT o AL, que no tiene clase en la app. Las
 * Matemáticas de 4º de ESO que el decreto separa en A y B se quedan fuera:
 * sin la opción no se sabe cuáles son sus criterios.
 */
export function useMateriasDeNivel(
  comunidad: ComunidadId | undefined, nivel: CursoDe | undefined,
): { estado: EstadoCurriculoClase; materias: MateriaDeClase[]; curriculo: CurriculoActivo | null } {
  const curriculo = useCurriculo(comunidad, nivel?.etapa);
  const etapa = nivel?.etapa;
  const curso = nivel?.curso;
  return useMemo(() => {
    if (!etapa || !curso) return { estado: 'sin-nivel', materias: [], curriculo: null };
    if (!curriculo) return { estado: 'cargando', materias: [], curriculo: null };
    const materias = materiasDeCurriculo(curriculo, { etapa, curso });
    return { estado: 'listo', materias, curriculo };
  }, [etapa, curso, curriculo]);
}
