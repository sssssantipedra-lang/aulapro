import { describe, it, expect } from 'vitest';
import { activas, agruparPorSda, archivarSesiones, asociarASda, quitarSesiones, resumenDeClase, sesionesDeSda } from './sesiones';
import type { LearningSituation } from '../types';
import type { SesionEF } from '../types/ef';
import type { SdaContent } from '../services/learningSituations';

const ses = (id: string, extra: Partial<SesionEF> = {}): SesionEF =>
  ({ id, titulo: id, objetivo: '', calentamiento: '', principal: '', calma: '', material: '', inclusion: '', planB: '', ...extra });
const sda = (id: string, numero: string, title: string): LearningSituation =>
  ({ id, at: '', date: '', title, request: { numero } as LearningSituation['request'], content: {} as SdaContent });

describe('sesiones · resumen de una clase', () => {
  const lista = [
    ses('a', { fecha: '2026-10-10' }), ses('b', { fecha: '2026-10-25' }), ses('c', { fecha: '2026-10-22' }),
    ses('d', { completada: true, fecha: '2026-10-01' }), ses('e'), ses('f', { archivada: true, fecha: '2026-10-23' }),
  ];
  it('cuenta lo que se ve, sin las archivadas', () => {
    const r = resumenDeClase(lista, '2026-10-21');
    expect(r).toMatchObject({ total: 5, hechas: 1, atrasadas: 1, archivadas: 1 });
    expect(r.proxima?.id).toBe('c');
  });
  it('sin sesiones con fecha por venir, la primera sin fecha', () => {
    expect(resumenDeClase([ses('x', { fecha: '2026-01-01' }), ses('y')], '2026-10-21').proxima?.id).toBe('y');
    expect(resumenDeClase([], '2026-10-21')).toMatchObject({ total: 0, hechas: 0, proxima: undefined });
  });
  it('activas quita las archivadas', () => { expect(activas(lista).map(s => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']); });
});

describe('sesiones · agrupadas por situación de aprendizaje', () => {
  const sdas = [sda('s2', '2', 'Los juegos del mundo'), sda('s1', '1', 'Expresión corporal')];
  it('las SdA por su número, sus sesiones por su orden, y las sueltas al final', () => {
    const g = agruparPorSda([
      ses('x1', { sdaId: 's2', sdaOrden: 2 }), ses('suelta', { fecha: '2026-10-02' }), ses('y2', { sdaId: 's1', sdaOrden: 2 }),
      ses('y1', { sdaId: 's1', sdaOrden: 1 }), ses('x0', { sdaId: 's2', sdaOrden: 1 }), ses('huerfana', { sdaId: 'borrada', fecha: '2026-10-01' }),
    ], sdas);
    expect(g.map(x => [x.key, x.sesiones.map(s => s.id)])).toEqual([
      ['s1', ['y1', 'y2']], ['s2', ['x0', 'x1']], ['sin-sda', ['huerfana', 'suelta']],
    ]);
  });
  it('una clase sin SdA tiene un solo grupo', () => {
    expect(agruparPorSda([ses('a')], sdas).map(x => x.key)).toEqual(['sin-sda']);
    expect(agruparPorSda([], sdas)).toEqual([]);
  });
});

describe('sesiones · acciones en bloque', () => {
  const base = [ses('a'), ses('b'), ses('c', { sdaId: 's1', sdaOrden: 1 }), ses('d')];
  it('eliminar quita solo las elegidas', () => {
    expect(quitarSesiones(base, new Set(['a', 'd'])).map(s => s.id)).toEqual(['b', 'c']);
  });
  it('archivar y restaurar', () => {
    const a = archivarSesiones(base, new Set(['a', 'b']), true);
    expect(a.filter(s => s.archivada).map(s => s.id)).toEqual(['a', 'b']);
    const r = archivarSesiones(a, new Set(['a']), false);
    expect(r.find(s => s.id === 'a')).not.toHaveProperty('archivada');
    expect(r.find(s => s.id === 'b')?.archivada).toBe(true);
  });
  it('asociar a una SdA las pone a continuación de las que ya tiene, en el orden pedido', () => {
    const r = asociarASda(base, ['d', 'a'], 's1');
    expect(r.filter(s => s.sdaId === 's1').map(s => [s.id, s.sdaOrden])).toEqual([['a', 3], ['c', 1], ['d', 2]]);
  });
  it('quitar la SdA deja la sesión suelta', () => {
    const r = asociarASda(base, ['c'], undefined);
    expect(r.find(s => s.id === 'c')).not.toHaveProperty('sdaId');
    expect(r.find(s => s.id === 'c')).not.toHaveProperty('sdaOrden');
  });
});

describe('sesiones · desde una SdA', () => {
  const contenido = {
    titulo: 'Juegos del mundo', inclusionUniversal: 'DUA', areas: [], ods: '',
    sesiones: [{ fase: 'Activación', titulo: 'Conocemos', descripcion: 'Se presentan los juegos.' }, { fase: 'Producto', titulo: 'Jugamos', descripcion: 'Torneo.' }],
  } as unknown as SdaContent;
  it('crea una sesión por sesión de la SdA, sin fecha, unida a ella y en su orden', () => {
    let n = 0;
    const r = sesionesDeSda({ id: 's1', content: contenido }, { claseId: 'c1', nuevoId: i => `n${i}${n++}`, t: (k, v) => k.replace('{n}', String(v?.n ?? '')).replace('{fase}', String(v?.fase ?? '')).replace('{sda}', String(v?.sda ?? '')) });
    expect(r.map(s => [s.titulo, s.claseId, s.sdaId, s.sdaOrden, s.fecha])).toEqual([
      ['1. Conocemos', 'c1', 's1', 1, undefined], ['2. Jugamos', 'c1', 's1', 2, undefined],
    ]);
    expect(r[0].inclusion).toBe('DUA');
    expect(new Set(r.map(s => s.id)).size).toBe(2);
  });
});
