/**
 * Para cada currículo autonómico que lleva la app: la clase dice su etapa y su
 * curso, y con eso se abre el archivo de esa etapa y, en cada materia que se
 * da en ese curso, su grupo de cursos tiene competencias, criterios y saberes.
 * Si un curso se quedara sin nada, una SdA de ese curso caería en texto libre
 * sin que nadie lo notara.
 */
import { describe, it, expect } from 'vitest';
import { CARGADORES, cargarCurriculo } from './cargar';
import { competenciasDe, resolverGrupo, type Etapa } from './index';
import { materiasDelCurso } from './materiasDeClase';
import type { ComunidadId } from './comunidades';

const CURSOS: Record<Etapa, number[]> = { primaria: [1, 2, 3, 4, 5, 6], eso: [1, 2, 3, 4] };

const casos = Object.entries(CARGADORES).flatMap(([comunidad, etapas]) =>
  Object.keys(etapas ?? {}).map(etapa => [comunidad as ComunidadId, etapa as Etapa] as const));

describe.each(casos)('%s, %s', (comunidad, etapa) => {
  it('se abre como currículo propio de esa etapa', async () => {
    const c = await cargarCurriculo(comunidad, etapa, 'es');
    expect(c.origen).toBe('autonomico');
    expect(c.etapa).toBe(etapa);
  });

  it.each(CURSOS[etapa])('%iº: cada materia del curso tiene competencias, criterios y saberes', async curso => {
    const { materias } = await cargarCurriculo(comunidad, etapa, 'es');
    const delCurso = materiasDelCurso({ etapa, curso }, materias);
    expect(delCurso.length).toBeGreaterThan(3);
    for (const nombre of delCurso) {
      // Matemáticas de cuarto de ESO: se mira cada opción
      const opciones = etapa === 'eso' && curso === 4 && nombre === 'Matemáticas' ? (['A', 'B'] as const) : [undefined];
      for (const opcion of opciones) {
        const r = resolverGrupo(etapa, nombre, curso, opcion, materias);
        expect(r, `${nombre} ${curso}º ${opcion ?? ''}`).not.toBeNull();
        expect(competenciasDe(r!.entry, r!.grupo).length, nombre).toBeGreaterThan(0);
        expect(r!.entry.criterios[r!.grupo].length, nombre).toBeGreaterThan(0);
        expect(r!.entry.saberes[r!.grupo].flatMap(b => b.epigrafes.flatMap(e => e.items)).length, nombre).toBeGreaterThan(0);
      }
    }
  });
});
