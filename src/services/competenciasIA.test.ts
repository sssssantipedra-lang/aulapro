/**
 * La IA marca competencias clave siempre y criterios oficiales solo si la
 * clase tiene currículo oficial; de listas cerradas, y lo que no esté en
 * ellas se descarta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marcarCompetenciasConIA, listaCompetenciasClave } from './competenciasIA';
import { cargarCurriculo } from '../lib/curriculum/cargar';
import { resolverGrupo } from '../lib/curriculum/index';
import type { MateriaDeClase } from '../lib/curriculum/criteriosParaIA';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

async function quinto(): Promise<MateriaDeClase[]> {
  const { materias } = await cargarCurriculo('madrid', 'primaria', 'es');
  const r = resolverGrupo('primaria', 'Matemáticas', 5, undefined, materias)!;
  return [{ asignatura: 'Matemáticas', entry: r.entry, grupo: r.grupo }];
}

const elementos = [{ id: 'a', nombre: 'Calcula el precio' }, { id: 'b', nombre: 'Expone el resultado' }];

describe('marcarCompetenciasConIA', () => {
  beforeEach(() => callGemini.mockReset());

  it('con currículo: competencias clave y criterios oficiales, de listas cerradas', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ criterios: [
      { id: 'a', competenciasClave: ['STEM', 'stem', 'XYZ'], criteriosOficiales: ['Matemáticas|2.1', 'Matemáticas|9.9'] },
      { id: 'b', competenciasClave: ['CPSAA', 'CCL'], criteriosOficiales: ['Matemáticas|6.2'] },
      { id: 'zz', competenciasClave: ['CD'], criteriosOficiales: [] },
    ] }));
    const r = await marcarCompetenciasConIA({ nombre: 'Mercado' }, elementos, await quinto(), 'es');
    expect(r).toEqual({
      a: { clave: ['STEM'], oficiales: [{ materia: 'matematicas', codigo: '2.1' }] },
      b: { clave: ['CCL', 'CPSAA'], oficiales: [{ materia: 'matematicas', codigo: '6.2' }] },
    });
    const schema = callGemini.mock.calls[0][4].responseSchema.properties.criterios.items;
    expect(schema.properties.competenciasClave.items.enum).toEqual(['CCL', 'CP', 'STEM', 'CD', 'CPSAA', 'CC', 'CE', 'CCEC']);
    expect(schema.properties.criteriosOficiales.items.enum).toContain('Matemáticas|2.1');
    expect(schema.required).toEqual(['id', 'competenciasClave', 'criteriosOficiales']);
    expect(callGemini.mock.calls[0][1]).toContain('CCL (Comunicación lingüística)');
  });

  it('sin currículo oficial, solo competencias clave', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ criterios: [{ id: 'a', competenciasClave: ['CE'] }] }));
    const r = await marcarCompetenciasConIA({ nombre: 'Mercado' }, elementos, [], 'es');
    expect(r).toEqual({ a: { clave: ['CE'], oficiales: [] } });
    const items = callGemini.mock.calls[0][4].responseSchema.properties.criterios.items;
    expect(items.properties.criteriosOficiales).toBeUndefined();
    expect(items.required).toEqual(['id', 'competenciasClave']);
    expect(callGemini.mock.calls[0][1]).not.toContain('criteriosOficiales');
  });

  it('la lista para el prompt va en el idioma del docente', () => {
    expect(listaCompetenciasClave('en')).toContain('CE (Entrepreneurship)');
    expect(listaCompetenciasClave('es')).toContain('CE (Emprendedora)');
  });
});
