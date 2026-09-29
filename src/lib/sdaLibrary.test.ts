import { describe, it, expect } from 'vitest';
import { groupSituations, filterSituations, sdaAreas } from './sdaLibrary';
import type { Class, LearningSituation } from '../types';

const cls = (id: string, name: string) => ({ id, name, color: '#123' } as Class);
const sda = (id: string, extra: { class_id?: string; class_name?: string; areas?: string[]; numero?: string; title?: string; at?: string } = {}) =>
  ({
    id, at: extra.at ?? '2026-09-01T00:00:00Z', date: '', title: extra.title ?? id,
    class_id: extra.class_id, class_name: extra.class_name,
    request: { idea: '', numero: extra.numero ?? '', temporalizacion: '', meses: '', areas: extra.areas ?? [], numSesiones: 1, nivel: '', contextoClase: '', metodologia: '' },
    content: {},
  }) as unknown as LearningSituation;

const classes = [cls('a', '3º ESO A'), cls('b', '4º ESO B')];
const labels = { noClass: 'Sin clase', noArea: 'Sin área' };

describe('groupSituations', () => {
  it('por clase: en el orden de Mis Clases, por número de SdA y «Sin clase» al final', () => {
    const g = groupSituations([
      sda('x'), sda('b1', { class_id: 'b' }),
      sda('a10', { class_id: 'a', numero: '10' }), sda('a2', { class_id: 'a', numero: '2' }),
    ], classes, 'class', labels);
    expect(g.map(x => x.label)).toEqual(['3º ESO A', '4º ESO B', 'Sin clase']);
    expect(g[0].items.map(i => i.sda.id)).toEqual(['a2', 'a10']);
  });

  it('una clase borrada se agrupa por el nombre que guardó la SdA', () => {
    const g = groupSituations([sda('v', { class_id: 'zz', class_name: '2º ESO C' })], classes, 'class', labels);
    expect(g[0].label).toBe('2º ESO C');
  });

  it('por área: una SdA de dos áreas sale en las dos, marcada como compartida', () => {
    const g = groupSituations([sda('m', { areas: ['Matemáticas', 'Biología'] }), sda('n')], classes, 'area', labels);
    expect(g.map(x => x.label)).toEqual(['Biología', 'Matemáticas', 'Sin área']);
    expect(g[1].items[0].sharedWith).toEqual(['Biología']);
  });

  it('sin agrupar: todas juntas, la más reciente primero', () => {
    const g = groupSituations([sda('old', { at: '2026-01-01' }), sda('new', { at: '2026-09-01' })], classes, 'none', labels);
    expect(g).toHaveLength(1);
    expect(g[0].items.map(i => i.sda.id)).toEqual(['new', 'old']);
  });
});

describe('filtro y buscador', () => {
  const list = [sda('1', { areas: ['Matemáticas'], title: 'Mercado sostenible' }), sda('2', { areas: ['Lengua'], title: 'Diario de clase' })];
  it('filtra por área y busca sin tildes ni mayúsculas', () => {
    expect(filterSituations(list, 'Lengua', '').map(s => s.id)).toEqual(['2']);
    expect(filterSituations(list, '', 'MERCADO').map(s => s.id)).toEqual(['1']);
    expect(filterSituations(list, '', 'diário').map(s => s.id)).toEqual(['2']);
  });
  it('lista las áreas sin repetir', () => {
    expect(sdaAreas([...list, sda('3', { areas: ['Lengua'] })])).toEqual(['Lengua', 'Matemáticas']);
  });
});
