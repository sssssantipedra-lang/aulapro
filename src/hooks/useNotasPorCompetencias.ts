import { useMemo } from 'react';
import { useCurriculo } from './useCurriculo';
import { resolverGrupo } from '../lib/curriculum';
import { estadoDeMateria } from '../lib/curriculum/materiasDeClase';
import { notasDeMateria, type NotaMateria } from '../lib/curriculum/evaluacionPorCriterios';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { Class, Evaluation } from '../types';

/** Las notas de cada asignatura de la clase que tiene materia oficial. */
export function useNotasPorCompetencias(
  cls: Class | null, comunidad: ComunidadId | undefined, evaluaciones: Evaluation[],
): { estado: 'sin-nivel' | 'cargando' | 'listo'; materias: { asignatura: string; notas: NotaMateria }[] } {
  const curriculo = useCurriculo(comunidad, cls?.etapa);
  return useMemo(() => {
    if (!cls?.etapa || !cls.curso) return { estado: 'sin-nivel', materias: [] };
    if (!curriculo) return { estado: 'cargando', materias: [] };
    const ctx = {
      etapa: cls.etapa, curso: cls.curso, opcionMatematicas: cls.opcionMatematicas,
      materiasOficiales: cls.materiasOficiales,
    };
    const materias: { asignatura: string; notas: NotaMateria }[] = [];
    for (const asignatura of cls.subjects?.length ? cls.subjects : [cls.subject]) {
      const estado = estadoDeMateria(asignatura, ctx, curriculo.materias);
      if (estado.tipo !== 'oficial') continue;
      const r = resolverGrupo(cls.etapa, estado.materia, cls.curso, cls.opcionMatematicas, curriculo.materias);
      if (r) materias.push({ asignatura, notas: notasDeMateria(r.entry, r.grupo, evaluaciones) });
    }
    return { estado: 'listo', materias };
  }, [cls, curriculo, evaluaciones]);
}
