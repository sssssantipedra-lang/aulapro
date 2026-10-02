/**
 * Cuándo se usa el currículo de la comunidad y cuándo el estatal. Con
 * cargadores falsos, porque todavía no hay ninguna comunidad copiada: lo que
 * se prueba es la mecánica que usarán cuando las haya.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  cargarCurriculo, curriculoEstatal, tieneCurriculoPropio, usaEstatalPorFaltaDeDecreto,
  type Cargadores,
} from './cargar';
import { materiasDe, type CurriculumEntry } from './index';
import { NORMAS_ESTATALES, normasDe } from './comunidades';

const MATERIA: CurriculumEntry = { nombre: 'Matemáticas', competencias: [], criterios: {}, saberes: {} };

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
    const madridPrimaria = vi.fn(async () => [MATERIA]);
    const madridEso = vi.fn(async () => [MATERIA]);
    const cargadores: Cargadores = { madrid: { primaria: madridPrimaria, eso: madridEso } };

    const c = await cargarCurriculo('madrid', 'primaria', cargadores);
    expect(c.origen).toBe('autonomico');
    expect(c.materias).toEqual([MATERIA]);
    expect(c.normas).toBe(normasDe('madrid', 'primaria'));
    expect(madridPrimaria).toHaveBeenCalledTimes(1);
    expect(madridEso).not.toHaveBeenCalled();
    expect(usaEstatalPorFaltaDeDecreto(c)).toBe(false);
  });

  it('una comunidad que tiene decreto en una etapa pero no en la otra usa el estatal en la otra', async () => {
    const cargadores: Cargadores = { madrid: { primaria: async () => [MATERIA] } };
    expect(tieneCurriculoPropio('madrid', 'primaria', cargadores)).toBe(true);
    expect(tieneCurriculoPropio('madrid', 'eso', cargadores)).toBe(false);
    expect((await cargarCurriculo('madrid', 'eso', cargadores)).origen).toBe('estatal');
  });

  it('abrirlo dos veces lee el archivo una sola vez', async () => {
    const abrir = vi.fn(async () => [MATERIA]);
    const cargadores: Cargadores = { madrid: { primaria: abrir } };
    await Promise.all([
      cargarCurriculo('madrid', 'primaria', cargadores),
      cargarCurriculo('madrid', 'primaria', cargadores),
    ]);
    await cargarCurriculo('madrid', 'primaria', cargadores);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('si el archivo no se puede abrir, devuelve el estatal y no se rinde: el siguiente intento vuelve a probar', async () => {
    let falla = true;
    const abrir = vi.fn(async () => { if (falla) throw new Error('trozo no encontrado'); return [MATERIA]; });
    const cargadores: Cargadores = { madrid: { primaria: abrir } };

    const primero = await cargarCurriculo('madrid', 'primaria', cargadores);
    expect(primero.origen).toBe('estatal');
    expect(usaEstatalPorFaltaDeDecreto(primero)).toBe(true);

    falla = false;
    const segundo = await cargarCurriculo('madrid', 'primaria', cargadores);
    expect(segundo.origen).toBe('autonomico');
    expect(abrir).toHaveBeenCalledTimes(2);
  });

  it('un cargador de una comunidad sin normas registradas no se usa: no habría nada que citar', async () => {
    const abrir = vi.fn(async () => [MATERIA]);
    const cargadores: Cargadores = { andalucia: { primaria: abrir } };
    expect((await cargarCurriculo('andalucia', 'primaria', cargadores)).origen).toBe('estatal');
    expect(abrir).not.toHaveBeenCalled();
  });
});
