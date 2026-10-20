import { describe, it, expect } from 'vitest';
import { agruparSesionesPorCurso } from './sesionesPorCurso';
import type { Class } from '../types';
import type { SesionEF } from '../types/ef';

const cl = (id: string, name: string, etapa?: 'primaria' | 'eso', curso?: number) => ({ id, name, subject: 'EF', room: '', color: '#000', etapa, curso }) as Class;
const ses = (id: string, claseId?: string, fecha?: string) => ({ id, titulo: id, claseId, fecha }) as SesionEF;

describe('sesiones de EF por curso', () => {
  const clases = [cl('a', '1º ESO A', 'eso', 1), cl('b', '4º A', 'primaria', 4), cl('c', '4º B', 'primaria', 4), cl('d', 'Taller')];
  const grupos = agruparSesionesPorCurso(
    [ses('s1', 'a', '2026-11-02'), ses('s2', 'c', '2026-11-03'), ses('s3', 'b', '2026-11-05'), ses('s4', 'b'), ses('s5', 'd'), ses('s6'), ses('s7', 'b', '2026-11-01')],
    clases,
  );

  it('Primaria antes que ESO, y al final lo que no tiene curso ni clase', () => {
    expect(grupos.map(g => g.key)).toEqual(['primaria:4', 'eso:1', 'sin-curso', 'sin-clase']);
  });
  it('un curso reúne a sus clases, por clase y por fecha, con las sin fecha al final', () => {
    const g = grupos[0];
    expect(g.clases.map(c => c.name)).toEqual(['4º A', '4º B']);
    expect(g.sesiones.map(s => s.id)).toEqual(['s7', 's3', 's4', 's2']);
  });
});
