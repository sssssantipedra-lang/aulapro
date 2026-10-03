import { useMemo } from 'react';
import { useCurriculo } from './useCurriculo';
import { resolverGrupo, type CurriculumEntry } from '../lib/curriculum';
import type { CurriculoActivo } from '../lib/curriculum/cargar';
import { estadoDeMateria } from '../lib/curriculum/materiasDeClase';
import { notasDeMateria, type NotaMateria } from '../lib/curriculum/evaluacionPorCriterios';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { Class, Evaluation } from '../types';

export type EstadoCurriculoClase = 'sin-clase' | 'sin-nivel' | 'cargando' | 'listo';

/**
 * Las asignaturas de la clase que tienen materia oficial, con su entrada del
 * currículo de la comunidad y el grupo de cursos que le toca a la clase. Las
 * que no tienen (Religión, una optativa de centro…) no salen.
 */
export function useMateriasOficiales(
  cls: Class | null, comunidad: ComunidadId | undefined,
): {
  estado: EstadoCurriculoClase;
  materias: { asignatura: string; entry: CurriculumEntry; grupo: string }[];
  /** De dónde salen, para citarlo (en el PDF de las competencias). */
  curriculo: CurriculoActivo | null;
} {
  const curriculo = useCurriculo(comunidad, cls?.etapa);
  return useMemo(() => {
    if (!cls) return { estado: 'sin-clase', materias: [], curriculo: null };
    if (!cls.etapa || !cls.curso) return { estado: 'sin-nivel', materias: [], curriculo: null };
    if (!curriculo) return { estado: 'cargando', materias: [], curriculo: null };
    const ctx = {
      etapa: cls.etapa, curso: cls.curso, opcionMatematicas: cls.opcionMatematicas,
      materiasOficiales: cls.materiasOficiales,
    };
    const materias: { asignatura: string; entry: CurriculumEntry; grupo: string }[] = [];
    for (const asignatura of cls.subjects?.length ? cls.subjects : [cls.subject]) {
      const estado = estadoDeMateria(asignatura, ctx, curriculo.materias);
      if (estado.tipo !== 'oficial') continue;
      const r = resolverGrupo(cls.etapa, estado.materia, cls.curso, cls.opcionMatematicas, curriculo.materias);
      if (r) materias.push({ asignatura, entry: r.entry, grupo: r.grupo });
    }
    return { estado: 'listo', materias, curriculo };
  }, [cls, curriculo]);
}

/** Las notas de cada asignatura de la clase que tiene materia oficial. */
export function useNotasPorCompetencias(
  cls: Class | null, comunidad: ComunidadId | undefined, evaluaciones: Evaluation[],
): { estado: EstadoCurriculoClase; materias: { asignatura: string; notas: NotaMateria }[]; curriculo: CurriculoActivo | null } {
  const { estado, materias, curriculo } = useMateriasOficiales(cls, comunidad);
  return useMemo(() => ({
    estado,
    curriculo,
    materias: materias.map(m => ({ asignatura: m.asignatura, notas: notasDeMateria(m.entry, m.grupo, evaluaciones) })),
  }), [estado, materias, evaluaciones, curriculo]);
}
