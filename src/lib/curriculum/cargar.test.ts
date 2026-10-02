/**
 * Cuándo se usa el currículo de la comunidad y cuándo el estatal. Con
 * cargadores falsos, porque todavía no hay ninguna comunidad copiada: lo que
 * se prueba es la mecánica que usarán cuando las haya.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  cargarCurriculo, curriculoEstatal, tieneCurriculoPropio, usaEstatalPorFaltaDeDecreto,
  type Cargador, type Cargadores,
} from './cargar';
import { materiasDe, type CurriculumEntry } from './index';
import { NORMAS_ESTATALES, normasDe } from './comunidades';

const MATERIA: CurriculumEntry = { id: 'Matemáticas', nombre: 'Matemáticas', competencias: [], criterios: {}, saberes: {} };

describe('sin decreto propio', () => {
  it('con los cargadores reales (vacíos todavía), cualquier comunidad usa el estatal', async () => {
    for (const id of ['madrid', 'cataluna', 'comunitat-valenciana', 'andalucia', 'fuera'] as const) {
      const c = await cargarCurriculo(id, 'primaria');
      expect(c.origen).toBe('estatal');
      expect(c.materias).toBe(materiasDe('primaria'));
      expect(c.normas).toBe(NORMAS_ESTATALES.primaria);
    }
  });

  it('el estatal se tiene sin esperar a nada', () => {
    const c = curriculoEstatal('madrid', 'eso');
    expect(c.origen).toBe('estatal');
    expect(c.materias).toBe(materiasDe('eso'));
  });

  it('avisa de que se usa el estatal para cualquier comunidad, salvo «Fuera de España»', () => {
    expect(usaEstatalPorFaltaDeDecreto(curriculoEstatal('madrid', 'eso'))).toBe(true);
    expect(usaEstatalPorFaltaDeDecreto(curriculoEstatal('fuera', 'eso'))).toBe(false);
  });
});

describe('con decreto propio', () => {
  it('abre solo el archivo de esa comunidad y etapa, con sus normas', async () => {
    const madridPrimaria = vi.fn<Cargador>(async () => [MATERIA]);
    const madridEso = vi.fn<Cargador>(async () => [MATERIA]);
    const cargadores: Cargadores = { madrid: { primaria: madridPrimaria, eso: madridEso } };

    const c = await cargarCurriculo('madrid', 'primaria', 'es', cargadores);
    expect(c.origen).toBe('autonomico');
    expect(c.materias).toEqual([MATERIA]);
    expect(c.normas).toBe(normasDe('madrid', 'primaria'));
    expect(c.idioma).toBe('es');
    expect(madridPrimaria).toHaveBeenCalledTimes(1);
    expect(madridEso).not.toHaveBeenCalled();
    expect(usaEstatalPorFaltaDeDecreto(c)).toBe(false);
  });

  it('una comunidad que tiene decreto en una etapa pero no en la otra usa el estatal en la otra', async () => {
    const cargadores: Cargadores = { madrid: { primaria: async () => [MATERIA] } };
    expect(tieneCurriculoPropio('madrid', 'primaria', cargadores)).toBe(true);
    expect(tieneCurriculoPropio('madrid', 'eso', cargadores)).toBe(false);
    expect((await cargarCurriculo('madrid', 'eso', 'es', cargadores)).origen).toBe('estatal');
  });

  it('abrirlo dos veces lee el archivo una sola vez', async () => {
    const abrir = vi.fn<Cargador>(async () => [MATERIA]);
    const cargadores: Cargadores = { madrid: { primaria: abrir } };
    await Promise.all([
      cargarCurriculo('madrid', 'primaria', 'es', cargadores),
      cargarCurriculo('madrid', 'primaria', 'es', cargadores),
    ]);
    await cargarCurriculo('madrid', 'primaria', 'es', cargadores);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('si el archivo no se puede abrir, devuelve el estatal y no se rinde: el siguiente intento vuelve a probar', async () => {
    let falla = true;
    const abrir = vi.fn<Cargador>(async () => { if (falla) throw new Error('trozo no encontrado'); return [MATERIA]; });
    const cargadores: Cargadores = { madrid: { primaria: abrir } };

    const primero = await cargarCurriculo('madrid', 'primaria', 'es', cargadores);
    expect(primero.origen).toBe('estatal');
    expect(usaEstatalPorFaltaDeDecreto(primero)).toBe(true);

    falla = false;
    const segundo = await cargarCurriculo('madrid', 'primaria', 'es', cargadores);
    expect(segundo.origen).toBe('autonomico');
    expect(abrir).toHaveBeenCalledTimes(2);
  });

  it('un cargador de una comunidad sin normas registradas no se usa: no habría nada que citar', async () => {
    const abrir = vi.fn<Cargador>(async () => [MATERIA]);
    const cargadores: Cargadores = { andalucia: { primaria: abrir } };
    expect((await cargarCurriculo('andalucia', 'primaria', 'es', cargadores)).origen).toBe('estatal');
    expect(abrir).not.toHaveBeenCalled();
  });

  it('pide el idioma de la app si la comunidad publica en los dos, y lo recuerda por separado', async () => {
    const abrir = vi.fn(async (idioma: string) => [{ ...MATERIA, nombre: idioma }]);
    const cargadores: Cargadores = { 'comunitat-valenciana': { primaria: abrir } };

    const ca = await cargarCurriculo('comunitat-valenciana', 'primaria', 'ca', cargadores);
    const es = await cargarCurriculo('comunitat-valenciana', 'primaria', 'es', cargadores);
    const en = await cargarCurriculo('comunitat-valenciana', 'primaria', 'en', cargadores);

    expect([ca.idioma, es.idioma, en.idioma]).toEqual(['ca', 'es', 'es']);
    expect(ca.materias[0].nombre).toBe('ca');
    expect(es.materias[0].nombre).toBe('es');
    // El inglés reutiliza el castellano: no se abre un tercer archivo
    expect(abrir.mock.calls.map(c => c[0])).toEqual(['ca', 'es']);
  });

  it('con una sola lengua oficial se abre siempre esa, aunque la app esté en otro idioma', async () => {
    const abrir = vi.fn<Cargador>(async () => [MATERIA]);
    const cargadores: Cargadores = { cataluna: { primaria: abrir } };
    const c = await cargarCurriculo('cataluna', 'primaria', 'es', cargadores);
    expect(c.idioma).toBe('ca');
    expect(abrir).toHaveBeenCalledWith('ca');
  });
});
