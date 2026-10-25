import { describe, it, expect } from 'vitest';
import { areasSinCriterio, type SdaContent } from './learningSituations';
import { tablaDianaSda } from './instrumentoEmbebido';

const sda = {
  areas: [
    { area: 'Lengua', materia: 'lengua', oficial: true, criteriosEvaluacion: '1.1 Comprende textos\n1.2 Produce textos' },
    { area: 'Matemáticas', materia: 'mates', oficial: true, criteriosEvaluacion: '2.1 Resuelve problemas' },
  ],
} as unknown as SdaContent;

describe('SdA interdisciplinar', () => {
  it('avisa de las áreas a las que ningún criterio apunta', () => {
    expect(areasSinCriterio(sda, [{ criteriosOficiales: ['Lengua|1.1'] }])).toEqual(['Matemáticas']);
    expect(areasSinCriterio(sda, [{ criteriosOficiales: ['Lengua|1.1', 'Matemáticas|2.1'] }])).toEqual([]);
  });
});

describe('diana de una SdA', () => {
  it('sale dibujada (círculo con ítems numerados), no solo como tabla', () => {
    const html = tablaDianaSda([{ item: 'Exposición', peso: 1, nivel1: 'a', nivel2: 'b', nivel3: 'c', nivel4: 'd', competencias: [] }], 'es');
    expect(html).toContain('<svg');
    expect(html).toContain('Exposición');
  });
});

import { destinosDe, notaDeDestino } from '../lib/objetivos';
import type { Rubric } from '../types';

const rubrica = (extra: Partial<Rubric> = {}): Rubric => ({
  id: 'r1', name: 'SdA', class_id: 'c1', subject: 'Lengua', category_id: 'k1',
  areas: [{ subject: 'Lengua', materia: 'lengua', category_id: 'k1' }, { subject: 'Matemáticas', materia: 'mates', category_id: 'k2' }],
  modo_areas: 'criterio',
  criteria: [
    { id: 'a', name: 'A', descriptors: {}, officialCriteria: [{ materia: 'lengua', codigo: '1.1' }] },
    { id: 'b', name: 'B', descriptors: {}, officialCriteria: [{ materia: 'mates', codigo: '2.1' }] },
  ],
  ...extra,
} as Rubric);

describe('puntuar en varias áreas', () => {
  it('una columna por área; la principal conserva el id de siempre', () => {
    const d = destinosDe(rubrica(), 'c1');
    expect(d.map(x => x.id)).toEqual(['gi-r1', 'gi-r1-c1~matemáticas']);
    expect(d.map(x => x.category_id)).toEqual(['k1', 'k2']);
  });
  it('sin áreas o en otra clase, como siempre', () => {
    expect(destinosDe(rubrica({ areas: undefined }), 'c1')).toHaveLength(1);
    expect(destinosDe(rubrica({ otras_clases: [{ class_id: 'c2', category_id: 'k3' }] }), 'c2').map(x => x.id)).toEqual(['gi-r1-c2']);
  });
  it('por criterios cada área recibe la nota de los suyos; en «misma», la general', () => {
    const [l, m] = destinosDe(rubrica(), 'c1');
    const ev = { scores: { a: 4, b: 2 }, grade: 7.5 };
    expect(notaDeDestino(rubrica(), l, ev)).toBe(10);
    expect(notaDeDestino(rubrica(), m, ev)).toBe(5);
    expect(notaDeDestino(rubrica({ modo_areas: 'misma' }), m, ev)).toBe(7.5);
  });
});

describe('Word de la SdA', () => {
  it('lleva la rúbrica y la diana de anexo', async () => {
    const { buildSdaDocxBlob } = await import('./exportSda');
    const filas = [{ item: 'Exposición', peso: 1, nivel1: 'a', nivel2: 'b', nivel3: 'c', nivel4: 'd', competencias: [] }];
    const solo = await buildSdaDocxBlob({ title: 'T', content: { areas: [], sesiones: [], titulo: 'T' }, request: { areas: [] } } as never, 'es');
    const con = await buildSdaDocxBlob({ title: 'T', content: { areas: [], sesiones: [], titulo: 'T' }, request: { areas: [] } } as never, 'es', { dianaRows: filas, rubricRows: [] });
    expect(con.size).toBeGreaterThan(solo.size);
  });
});
