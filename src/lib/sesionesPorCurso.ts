/**
 * Las sesiones de EF agrupadas por curso (petición del dueño, 20-10-2026:
 * «que se pueda agrupar por curso para tenerlo más visual»): primero Primaria
 * y ESO por curso, y al final las clases sin curso y las sesiones sin clase.
 * Dentro de cada curso, por clase (en el orden de «Mis clases») y por fecha.
 */
import type { Class } from '../types';
import type { SesionEF } from '../types/ef';

export interface GrupoCurso {
  /** `primaria:4`, `eso:1`, `sin-curso` o `sin-clase`. */
  key: string;
  etapa?: 'primaria' | 'eso';
  curso?: number;
  /** Las clases que tienen sesiones aquí, para los subtítulos. */
  clases: Class[];
  sesiones: SesionEF[];
}

const porFecha = (a: SesionEF, b: SesionEF) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999');

export function agruparSesionesPorCurso(sesiones: readonly SesionEF[], classes: readonly Class[]): GrupoCurso[] {
  const grupos = new Map<string, GrupoCurso>();
  for (const s of sesiones) {
    const c = classes.find(x => x.id === s.claseId);
    const key = !c ? 'sin-clase' : c.etapa && c.curso ? `${c.etapa}:${c.curso}` : 'sin-curso';
    if (!grupos.has(key)) {
      grupos.set(key, { key, ...(c?.etapa && c.curso ? { etapa: c.etapa as 'primaria' | 'eso', curso: c.curso } : {}), clases: [], sesiones: [] });
    }
    const g = grupos.get(key)!;
    g.sesiones.push(s);
    if (c && !g.clases.includes(c)) g.clases.push(c);
  }
  const orden = (g: GrupoCurso) =>
    g.key === 'sin-clase' ? 1e9 : g.key === 'sin-curso' ? 1e8 : (g.etapa === 'eso' ? 100 : 0) + (g.curso ?? 0);
  const indice = (c: Class) => classes.indexOf(c);
  return [...grupos.values()]
    .map(g => ({
      ...g,
      clases: [...g.clases].sort((a, b) => indice(a) - indice(b)),
      sesiones: [...g.sesiones].sort((a, b) => {
        const ia = classes.findIndex(x => x.id === a.claseId), ib = classes.findIndex(x => x.id === b.claseId);
        return ia - ib || porFecha(a, b);
      }),
    }))
    .sort((a, b) => orden(a) - orden(b));
}
