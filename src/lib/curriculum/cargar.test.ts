/**
 * Cuándo se usa el currículo de la comunidad y cuándo el estatal. La mecánica
 * se prueba con cargadores falsos; el currículo valenciano real, en
 * `comunitatValenciana.test.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  cargarCurriculo, curriculoEstatal, tieneCurriculoPropio, usaEstatalPorFaltaDeDecreto,
  type Cargador, type Cargadores,
} from './cargar';
import { materiasDe, type CurriculumEntry } from './index';
import { NORMAS_ESTATALES, normasDe } from './comunidades';

const MATERIA: CurriculumEntry = { id: 'Matemáticas', nombre: 'Matemáticas', competencias: [], criterios: {}, saberes: {} };
/** Un cargador que sirve estas materias en el idioma que se le pide. */
const sirve = (materias: CurriculumEntry[]): Cargador => async idioma => ({ idioma, materias });

describe('sin decreto propio', () => {
  it('con los cargadores reales, una comunidad sin su decreto copiado usa el estatal', async () => {
    for (const id of ['cataluna', 'andalucia', 'fuera'] as const) {
      const c = await cargarCurriculo(id, 'primaria');
      expect(c.origen).toBe('estatal');
      expect(c.materias).toBe(materiasDe('primaria'));
      expect(c.normas).toBe(NORMAS_ESTATALES.primaria);
    }
    // La Comunitat Valenciana y Madrid tienen Primaria, pero todavía no la ESO
    for (const id of ['comunitat-valenciana', 'madrid'] as const) {
      const eso = await cargarCurriculo(id, 'eso');
      expect(eso.origen).toBe('estatal');
      expect(eso.normas).toBe(NORMAS_ESTATALES.eso);
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
    const madridPrimaria = vi.fn<Cargador>(sirve([MATERIA]));
    const madridEso = vi.fn<Cargador>(sirve([MATERIA]));
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
    const cargadores: Cargadores = { madrid: { primaria: sirve([MATERIA]) } };
    expect(tieneCurriculoPropio('madrid', 'primaria', cargadores)).toBe(true);
    expect(tieneCurriculoPropio('madrid', 'eso', cargadores)).toBe(false);
    expect((await cargarCurriculo('madrid', 'eso', 'es', cargadores)).origen).toBe('estatal');
  });

  it('abrirlo dos veces lee el archivo una sola vez', async () => {
    const abrir = vi.fn<Cargador>(sirve([MATERIA]));
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
    const abrir = vi.fn<Cargador>(async idioma => { if (falla) throw new Error('trozo no encontrado'); return { idioma, materias: [MATERIA] }; });
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
    const abrir = vi.fn<Cargador>(sirve([MATERIA]));
    const cargadores: Cargadores = { andalucia: { primaria: abrir } };
    expect((await cargarCurriculo('andalucia', 'primaria', 'es', cargadores)).origen).toBe('estatal');
    expect(abrir).not.toHaveBeenCalled();
  });

  it('pide el idioma de la app si la comunidad publica en los dos, y lo recuerda por separado', async () => {
    const abrir = vi.fn<Cargador>(async idioma => ({ idioma, materias: [{ ...MATERIA, nombre: idioma }] }));
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

  it('si falta el archivo del idioma pedido, el cargador sirve el otro y el resultado lo dice', async () => {
    const abrir = vi.fn<Cargador>(async () => ({ idioma: 'es', materias: [MATERIA] }));
    const cargadores: Cargadores = { 'comunitat-valenciana': { primaria: abrir } };
    const c = await cargarCurriculo('comunitat-valenciana', 'primaria', 'ca', cargadores);
    expect(abrir).toHaveBeenCalledWith('ca');
    expect(c.idioma).toBe('es');
    expect(c.origen).toBe('autonomico');
  });

  it('con una sola lengua oficial se abre siempre esa, aunque la app esté en otro idioma', async () => {
    const abrir = vi.fn<Cargador>(sirve([MATERIA]));
    const cargadores: Cargadores = { cataluna: { primaria: abrir } };
    const c = await cargarCurriculo('cataluna', 'primaria', 'es', cargadores);
    expect(c.idioma).toBe('ca');
    expect(abrir).toHaveBeenCalledWith('ca');
  });
});
