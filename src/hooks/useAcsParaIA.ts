/**
 * El texto de unas adaptaciones curriculares significativas para la IA (`lib/acsContexto.ts`), con el texto oficial de
 * cada criterio: carga el currículo de Primaria o de ESO solo si alguna lo necesita.
 */
import { useMemo } from 'react';
import { useCurriculo } from './useCurriculo';
import { useNombreCurso } from './useNombreCurso';
import { materiasDeCurriculo } from '../lib/curriculum/materiasDeNivel';
import { acsVariasParaIA } from '../lib/acsContexto';
import { modeloAcs } from '../lib/acsModelos';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { AcsApoyo } from '../types/apoyo';

export function useAcsParaIA(
  lista: readonly AcsApoyo[], comunidad: ComunidadId | undefined, nombres: readonly string[] = [],
  etiqueta?: (a: AcsApoyo) => string,
): string {
  const nombreCurso = useNombreCurso();
  const prim = useCurriculo(comunidad, lista.some(a => a.nivel.etapa === 'primaria') ? 'primaria' : undefined);
  const eso = useCurriculo(comunidad, lista.some(a => a.nivel.etapa === 'eso') ? 'eso' : undefined);
  return useMemo(() => {
    if (lista.length === 0) return '';
    const materiaDe = (a: AcsApoyo) => {
      const c = a.nivel.etapa === 'primaria' ? prim : eso;
      return c ? materiasDeCurriculo(c, a.nivel).find(m => m.entry.nombre === a.area) : undefined;
    };
    return acsVariasParaIA(lista, modeloAcs(comunidad), materiaDe, nombreCurso, nombres, etiqueta);
  }, [lista, comunidad, nombres, etiqueta, prim, eso, nombreCurso]);
}
