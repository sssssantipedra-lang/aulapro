/**
 * La Diana competencial guardada de un alumno, por evaluación (20-11-2026). Hasta ahora había una por
 * alumno, de todo el curso; la del segundo trimestre pisaba la del primero. Ahora cada evaluación guarda la
 * suya y la de «Curso» sigue donde estaba, así que no hay nada que migrar: las Dianas guardadas antes son
 * las de todo el curso.
 */
import type { DianaGuardada, DianaProfile } from '../types';
import { CURSO_ENTERO, EVALUACIONES, claveDe } from './periodos';

/** Si tiene algo que enseñar: algún nivel puesto o algún descriptor escrito. */
function conContenido(d: DianaGuardada | undefined | null): d is DianaGuardada {
  if (!d) return false;
  return Object.values(d.scores ?? {}).some(v => typeof v === 'number' && v > 0)
    || Object.values(d.descriptors ?? {}).some(x => typeof x === 'string' && x.trim() !== '');
}

/** La Diana guardada de `periodo` (una evaluación o «Final de curso») en el curso de `hoy`; `null` si no hay. */
export function dianaGuardada(perfil: DianaProfile | undefined, periodo: string, hoy: string): DianaGuardada | null {
  if (!perfil) return null;
  const clave = claveDe(periodo, hoy);
  const d = clave ? perfil.porEvaluacion?.[clave] : perfil;
  return conContenido(d) ? { scores: d.scores ?? {}, descriptors: d.descriptors ?? {}, updated: d.updated ?? '' } : null;
}

/** El perfil con la Diana de `periodo` guardada; las de las demás evaluaciones y la del curso no se tocan. */
export function conDianaGuardada(perfil: DianaProfile | undefined, periodo: string, hoy: string, diana: DianaGuardada): DianaProfile {
  const clave = claveDe(periodo, hoy);
  if (!clave) return { ...diana, ...(perfil?.porEvaluacion ? { porEvaluacion: perfil.porEvaluacion } : {}) };
  return {
    scores: perfil?.scores ?? {}, descriptors: perfil?.descriptors ?? {}, updated: perfil?.updated ?? '',
    porEvaluacion: { ...perfil?.porEvaluacion, [clave]: diana },
  };
}

/**
 * Las demás Dianas guardadas del alumno en este curso, en el orden del selector: para decir, cuando la de
 * esta evaluación está sin guardar, que lo guardado no se ha perdido y dónde está.
 */
export function otrasDianasGuardadas(perfil: DianaProfile | undefined, periodo: string, hoy: string): { periodo: string; updated: string }[] {
  return [...EVALUACIONES, CURSO_ENTERO]
    .filter(p => p !== periodo)
    .map(p => ({ periodo: p, diana: dianaGuardada(perfil, p, hoy) }))
    .filter((x): x is { periodo: string; diana: DianaGuardada } => x.diana !== null)
    .map(x => ({ periodo: x.periodo, updated: x.diana.updated }));
}
