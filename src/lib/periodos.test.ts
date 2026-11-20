// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { conVecinos, enRango, evaluacionDe, guardarRango, inicioDeCurso, rangoDe, rangoDePartida, rangosGuardados } from './periodos';

describe('fechas de cada evaluación', () => {
  beforeEach(() => localStorage.clear());

  it('el curso va de septiembre a agosto', () => {
    expect(inicioDeCurso('2026-11-19')).toBe(2026);
    expect(inicioDeCurso('2027-03-02')).toBe(2026);
    expect(inicioDeCurso('2027-09-01')).toBe(2027);
  });

  it('de partida, los trimestres naturales, y el final de curso sin filtro', () => {
    expect(rangoDePartida('1ª evaluación', '2026-11-19')).toEqual({ desde: '2026-09-01', hasta: '2026-12-31' });
    expect(rangoDePartida('2ª evaluación', '2026-11-19')).toEqual({ desde: '2027-01-01', hasta: '2027-03-31' });
    expect(rangoDePartida('3ª evaluación', '2027-05-10')).toEqual({ desde: '2027-04-01', hasta: '2027-08-31' });
    expect(rangoDePartida('Final de curso', '2026-11-19')).toBeNull();
  });

  it('una fecha cuenta si cae en el rango; sin rango o sin fecha, cuenta siempre', () => {
    const r = { desde: '2026-09-01', hasta: '2026-12-04' };
    expect(enRango('2026-12-04', r)).toBe(true);
    expect(enRango('2026-12-05', r)).toBe(false);
    expect(enRango('2026-08-31', r)).toBe(false);
    expect(enRango('2026-12-05', null)).toBe(true);
    expect(enRango(undefined, r)).toBe(true);
  });

  it('las fechas que cambia el docente se recuerdan para ese curso y mandan sobre las de partida', () => {
    guardarRango('1ª evaluación', { desde: '2026-09-08', hasta: '2026-12-04' }, '2026-11-19');
    expect(rangoDe('1ª evaluación', '2026-11-19')).toEqual({ desde: '2026-09-08', hasta: '2026-12-04' });
    expect(rangoDe('2ª evaluación', '2026-11-19')).toEqual({ desde: '2027-01-01', hasta: '2027-03-31' });
    expect(rangoDe('Final de curso', '2026-11-19')).toBeNull();
    // Al curso siguiente vuelven las de partida
    expect(rangosGuardados('2027-10-01')).toEqual({});
  });

  it('al cambiar las fechas de una evaluación, las vecinas se ajustan para no dejar días en medio', () => {
    const r = conVecinos('1ª evaluación', { desde: '2026-09-08', hasta: '2026-12-04' }, '2026-11-19', {});
    expect(r['1ª evaluación']).toEqual({ desde: '2026-09-08', hasta: '2026-12-04' });
    expect(r['2ª evaluación']).toEqual({ desde: '2026-12-05', hasta: '2027-03-31' });
    const r2 = conVecinos('3ª evaluación', { desde: '2027-03-20', hasta: '2027-06-18' }, '2026-11-19', r);
    expect(r2['2ª evaluación']).toEqual({ desde: '2026-12-05', hasta: '2027-03-19' });
    expect(r2['1ª evaluación']).toEqual({ desde: '2026-09-08', hasta: '2026-12-04' });
  });

  it('dice en qué evaluación del curso cae un día', () => {
    expect(evaluacionDe('2026-11-19', {})).toBe('2026-1');
    expect(evaluacionDe('2027-02-02', {})).toBe('2026-2');
    expect(evaluacionDe('2027-06-10', {})).toBe('2026-3');
    expect(evaluacionDe('2026-12-10', { '1ª evaluación': { desde: '2026-09-08', hasta: '2026-12-04' }, '2ª evaluación': { desde: '2026-12-05', hasta: '2027-03-31' } })).toBe('2026-2');
  });

  it('un rango guardado que no vale se ignora', () => {
    localStorage.setItem('aulapro_evaluaciones_fechas', JSON.stringify({ 2026: { '1ª evaluación': { desde: '2026-12-31', hasta: '2026-09-01' }, '2ª evaluación': { desde: 'ayer' } } }));
    expect(rangosGuardados('2026-11-19')).toEqual({});
  });
});
