// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  claveDe, conVecinos, cuentaEn, diaDeEjemplo, diaParaNueva, enRango, evaluacionDe, guardarPeriodoElegido, guardarRango, guardarRangos, inicioDeCurso,
  mismaEvaluacion, periodoDeFecha, periodoDeHoy, periodoElegido, rangoDe, rangoDePartida, rangosGuardados,
} from './periodos';

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

describe('una sola noción de evaluación (cuaderno, actas y lo que venga)', () => {
  beforeEach(() => localStorage.clear());
  const HOY = '2026-11-20';

  it('la clave de una evaluación tiene la forma de evaluacionDe, y «Final de curso» no tiene', () => {
    expect(claveDe('2ª evaluación', HOY)).toBe('2026-2');
    expect(claveDe('2ª evaluación', '2027-02-01')).toBe(evaluacionDe('2027-02-01', {}));
    expect(claveDe('Final de curso', HOY)).toBeNull();
  });

  it('la evaluación de hoy sigue a las fechas que cambió el docente', () => {
    expect(periodoDeHoy(HOY)).toBe('1ª evaluación');
    expect(periodoDeHoy('2027-02-10')).toBe('2ª evaluación');
    expect(periodoDeHoy('2027-06-01')).toBe('3ª evaluación');
    guardarRangos(conVecinos('1ª evaluación', { desde: '2026-09-08', hasta: '2026-11-15' }, HOY, {}), HOY);
    expect(periodoDeHoy(HOY)).toBe('2ª evaluación');
  });

  it('una fecha cuenta en su evaluación y en «Final de curso»; sin fecha, en todas', () => {
    expect(cuentaEn('2026-10-05', '1ª evaluación', HOY)).toBe(true);
    expect(cuentaEn('2026-10-05', '2ª evaluación', HOY)).toBe(false);
    expect(cuentaEn('2026-10-05', 'Final de curso', HOY)).toBe(true);
    expect(cuentaEn('', '2ª evaluación', HOY)).toBe(true);
    expect(cuentaEn(undefined, '3ª evaluación', HOY)).toBe(true);
    expect(cuentaEn('pronto', '3ª evaluación', HOY)).toBe(true);
  });

  it('lo de otro curso no cuenta en ninguna evaluación de este, y sí en «Final de curso»', () => {
    expect(periodoDeFecha('2026-03-10', HOY)).toBeNull();
    for (const p of ['1ª evaluación', '2ª evaluación', '3ª evaluación']) expect(cuentaEn('2026-03-10', p, HOY)).toBe(false);
    expect(cuentaEn('2026-03-10', 'Final de curso', HOY)).toBe(true);
  });

  it('un día fuera de todos los rangos cuenta en la evaluación más cercana: nada del curso se queda sin evaluación', () => {
    const r = { '1ª evaluación': { desde: '2026-09-15', hasta: '2026-12-04' }, '3ª evaluación': { desde: '2027-04-01', hasta: '2027-06-20' } };
    expect(periodoDeFecha('2026-09-10', HOY, r)).toBe('1ª evaluación');
    expect(cuentaEn('2026-09-10', '1ª evaluación', HOY, r)).toBe(true);
    expect(periodoDeFecha('2027-06-25', HOY, r)).toBe('3ª evaluación');
    // El hueco entre la 1.ª (acaba el 4 de diciembre) y la 2.ª de partida (empieza el 1 de enero)
    expect(periodoDeFecha('2026-12-10', HOY, r)).toBe('2ª evaluación');
  });

  it('al cambiar las fechas, una actividad pasa a contar donde cae ahora', () => {
    expect(cuentaEn('2026-12-10', '1ª evaluación', HOY)).toBe(true);
    guardarRangos(conVecinos('1ª evaluación', { desde: '2026-09-01', hasta: '2026-12-04' }, HOY, {}), HOY);
    expect(cuentaEn('2026-12-10', '1ª evaluación', HOY)).toBe(false);
    expect(cuentaEn('2026-12-10', '2ª evaluación', HOY)).toBe(true);
  });

  it('dos fechas son de la misma evaluación si caen en la misma del mismo curso', () => {
    expect(mismaEvaluacion('2026-10-01', '2026-12-20')).toBe(true);
    expect(mismaEvaluacion('2026-12-20', '2027-01-10')).toBe(false);
    expect(mismaEvaluacion('2026-10-01', '2027-10-01')).toBe(false);
    expect(mismaEvaluacion('', '2027-01-10')).toBe(true);
  });

  it('de entrada se ve la evaluación de hoy, y lo elegido se recuerda mientras dure esa evaluación', () => {
    expect(periodoElegido(HOY)).toBe('1ª evaluación');
    guardarPeriodoElegido('Final de curso', HOY);
    expect(periodoElegido(HOY)).toBe('Final de curso');
    expect(periodoElegido('2026-12-15')).toBe('Final de curso');
    // Al empezar la evaluación siguiente, la app vuelve a la que toca
    expect(periodoElegido('2027-01-12')).toBe('2ª evaluación');
    localStorage.setItem('aulapro_evaluacion_elegida', '{"periodo":"La cuarta","cuando":"2026-1"}');
    expect(periodoElegido(HOY)).toBe('1ª evaluación');
    localStorage.setItem('aulapro_evaluacion_elegida', 'esto no es JSON');
    expect(periodoElegido(HOY)).toBe('1ª evaluación');
  });

  it('una actividad nueva lleva un día de la evaluación que se está viendo', () => {
    expect(diaParaNueva('1ª evaluación', HOY)).toBe(HOY);
    expect(diaParaNueva('Final de curso', HOY)).toBe(HOY);
    expect(diaParaNueva('2ª evaluación', HOY)).toBe('2027-01-01');
    expect(diaParaNueva('1ª evaluación', '2027-02-03')).toBe('2026-12-31');
    expect(cuentaEn(diaParaNueva('3ª evaluación', HOY), '3ª evaluación', HOY)).toBe(true);
  });
});

describe('las fechas de los datos de ejemplo del cuaderno', () => {
  beforeEach(() => localStorage.clear());

  it('a mitad de trimestre se quedan como están', () => {
    expect(diaDeEjemplo('2026-10-27', '2026-11-20')).toBe('2026-10-27');
    expect(diaDeEjemplo('2026-11-20', '2026-11-20')).toBe('2026-11-20');
  });

  it('al empezar un trimestre no se van a la evaluación anterior: caen en la de hoy', () => {
    expect(diaDeEjemplo('2026-12-11', '2027-01-04')).toBe('2027-01-01');
    expect(diaDeEjemplo('2027-01-02', '2027-01-04')).toBe('2027-01-02');
    expect(diaDeEjemplo('2027-03-09', '2027-04-02')).toBe('2027-04-01');
    for (const dia of ['2026-12-11', '2027-01-02']) expect(cuentaEn(diaDeEjemplo(dia, '2027-01-04'), '2ª evaluación', '2027-01-04')).toBe(true);
  });

  it('en septiembre no se quedan en el curso anterior', () => {
    expect(diaDeEjemplo('2027-08-13', '2027-09-06')).toBe('2027-09-01');
    expect(cuentaEn(diaDeEjemplo('2027-08-13', '2027-09-06'), '1ª evaluación', '2027-09-06')).toBe(true);
  });

  it('sigue las fechas que cambió el docente, y lo de hoy en adelante no se toca', () => {
    guardarRango('2ª evaluación', { desde: '2026-12-05', hasta: '2027-03-31' }, '2027-01-04');
    expect(diaDeEjemplo('2026-12-11', '2027-01-04')).toBe('2026-12-11');
    expect(diaDeEjemplo('2026-11-30', '2027-01-04')).toBe('2026-12-05');
    expect(diaDeEjemplo('2027-01-12', '2027-01-04')).toBe('2027-01-12');
  });

  it('si hoy cae antes del primer día de su evaluación, no se fechan en el futuro', () => {
    guardarRango('1ª evaluación', { desde: '2026-09-10', hasta: '2026-12-31' }, '2026-09-05');
    expect(diaDeEjemplo('2026-08-20', '2026-09-05')).toBe('2026-09-05');
  });
});
