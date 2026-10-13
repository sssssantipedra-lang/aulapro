import { describe, it, expect } from 'vitest';
import { agruparPorEtapa } from './etapas';

describe('agruparPorEtapa', () => {
  it('agrupa en Primaria, ESO y otras, por curso y después por nombre', () => {
    const grupos = agruparPorEtapa([
      { name: '2º ESO A', etapa: 'eso', curso: 2 },
      { name: '1º ESO B', etapa: 'eso', curso: 1 },
      { name: '5º A', etapa: 'primaria', curso: 5 },
      { name: 'Taller', etapa: undefined, curso: undefined },
    ]);
    expect(grupos.map(g => [g.id, g.clases.map(c => c.name)])).toEqual([
      ['primaria', ['5º A']],
      ['eso', ['1º ESO B', '2º ESO A']],
      ['otras', ['Taller']],
    ]);
  });

  it('los números del nombre se ordenan como números: «Grupo 2» antes que «Grupo 10»', () => {
    const [otras] = agruparPorEtapa([
      { name: 'Grupo 10', etapa: undefined, curso: undefined },
      { name: 'Grupo 2', etapa: undefined, curso: undefined },
    ]);
    expect(otras.clases.map(c => c.name)).toEqual(['Grupo 2', 'Grupo 10']);
  });
});
