import { describe, it, expect } from 'vitest';
import { buscarCriterios, catalogoCriterios, competenciasDelInstrumento, promptCriteriosOficiales, refsDesdeIA, type MateriaDeClase } from './criteriosParaIA';
import { cargarCurriculo } from './cargar';
import { resolverGrupo } from './index';

async function quinto(): Promise<MateriaDeClase[]> {
  const { materias } = await cargarCurriculo('madrid', 'primaria', 'es');
  return ['Matemáticas', 'Ciencias de la Naturaleza'].map(n => {
    const r = resolverGrupo('primaria', n, 5, undefined, materias)!;
    return { asignatura: n, entry: r.entry, grupo: r.grupo };
  });
}

describe('criterios oficiales para la IA', () => {
  it('la lista cerrada lleva todos los criterios del curso, como «Materia|código», con su competencia de título', async () => {
    const m = await quinto();
    const { texto, disponibles } = catalogoCriterios(m);
    expect(disponibles).toContain('Matemáticas|2.1');
    expect(disponibles).toContain('Ciencias de la Naturaleza|3.1');
    expect(disponibles).toHaveLength(17 + 17);
    expect(texto).toMatch(/CE2\. Resolver situaciones problematizadas/);
    expect(promptCriteriosOficiales(m, 'es', 'criterion', 'Matemáticas')).toMatch(/al menos 1[\s\S]*La nota va a Matemáticas/);
    expect(promptCriteriosOficiales([], 'es', 'criterion')).toBe('');
  });

  it('solo acepta criterios de la lista, sin repetir', async () => {
    const m = await quinto();
    expect(refsDesdeIA(m, ['Matemáticas|2.1', 'Matemáticas|2.1', 'Matemáticas|99.1', 'Religión|1.1', 7, 'Ciencias de la Naturaleza|3.1']))
      .toEqual([{ materia: 'matematicas', codigo: '2.1' }, { materia: 'ciencias-de-la-naturaleza', codigo: '3.1' }]);
    expect(refsDesdeIA(m, 'no es una lista')).toEqual([]);
  });

  it('la búsqueda encuentra por código, por asignatura y por palabras, y sin escribir no devuelve nada', async () => {
    const m = await quinto();
    expect(buscarCriterios(m, '')).toEqual([]);
    expect(buscarCriterios(m, '2.1').map(r => `${r.materia} ${r.ref.codigo}`)).toEqual(['Matemáticas 2.1', 'Ciencias de la Naturaleza 2.1']);
    expect(buscarCriterios(m, 'matematicas 2').map(r => r.ref.codigo)).toEqual(['2.1', '2.2', '2.3']);
    expect(buscarCriterios(m, 'estrategias resolver').length).toBeGreaterThan(0);
  });

  it('las competencias que trabaja un instrumento salen de sus criterios, sin repetir y en orden', async () => {
    const m = await quinto();
    const ces = competenciasDelInstrumento(m, [
      { materia: 'ciencias-de-la-naturaleza', codigo: '3.1' }, { materia: 'matematicas', codigo: '2.2' },
      { materia: 'matematicas', codigo: '2.1' }, { materia: 'matematicas', codigo: '1.1' },
    ]);
    expect(ces.map(c => `${c.materia} ${c.n}`)).toEqual(['Matemáticas 1', 'Matemáticas 2', 'Ciencias de la Naturaleza 3']);
  });
});
