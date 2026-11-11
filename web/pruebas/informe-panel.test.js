/**
 * Las cuentas del panel del informe de uso (web/sitio/assets/informe-panel.js, 11-11-2026): quién entra, quién es nuevo,
 * quién repite, el tiempo de uso, la retención por semana de alta y los repartos.
 */
import { describe, expect, it } from 'vitest';
import { cohortes, diasDelPeriodo, metricas, porDiaDeSemana, porTiempoDeUso, reparto, resumen, serieDiaria } from '../sitio/assets/informe-panel.js';

const u = (email, alta, dias, extra = {}) => ({ email, alta, dias, tipo: 'beta', proveedor: 'google', ...extra });
const USUARIOS = [
  u('a@x.es', '2026-11-10', { '2026-11-10': 30, '2026-11-11': 10, '2026-11-18': 50 }),
  u('b@x.es', '2026-11-10', { '2026-11-10': 5 }, { proveedor: 'microsoft' }),
  u('c@x.es', '2026-11-12', { '2026-11-12': 0, '2026-11-13': 200 }, { tipo: 'fundador' }),
  u('d@x.es', '2026-11-19', { '2026-11-19': 700 }),
];
const HOY = '2026-11-19';

describe('el periodo', () => {
  it('los últimos N días hasta hoy, o desde la primera alta con «todo»', () => {
    expect(diasDelPeriodo(USUARIOS, HOY, '7')).toEqual(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']);
    const todo = diasDelPeriodo(USUARIOS, HOY, 'todo');
    expect(todo[0]).toBe('2026-11-10');
    expect(todo.at(-1)).toBe(HOY);
    expect(todo).toHaveLength(10);
  });
});

describe('cada día', () => {
  it('separa a los nuevos de los que vuelven, suma los minutos y lleva los registrados y los activos en 7 días', () => {
    const s = serieDiaria(USUARIOS, diasDelPeriodo(USUARIOS, HOY, 'todo'));
    const dia = d => s.find(x => x.dia === d);
    expect(dia('2026-11-10')).toMatchObject({ nuevos: 2, vuelven: 0, entran: 2, minutos: 35, registrados: 2 });
    expect(dia('2026-11-11')).toMatchObject({ nuevos: 0, vuelven: 1, minutos: 10, registrados: 2 });
    // Un día con 0 minutos también es un día que entró
    expect(dia('2026-11-12')).toMatchObject({ nuevos: 1, vuelven: 0, minutos: 0, registrados: 3 });
    expect(dia('2026-11-18')).toMatchObject({ vuelven: 1, activos7: 2 });   // a (18) y c (13)
    expect(dia('2026-11-19')).toMatchObject({ nuevos: 1, registrados: 4, activos7: 3 });
  });
});

describe('las cifras', () => {
  it('cuenta entran, nuevos, repiten, el tiempo y los días por docente del periodo', () => {
    const r = resumen(USUARIOS, diasDelPeriodo(USUARIOS, HOY, 'todo'), HOY);
    expect(r).toMatchObject({ entran: 4, nuevos: 4, repiten: 2, minutos: 995, diasDeUso: 7 });
    expect(r.diasPorDocente).toBeCloseTo(7 / 4);
    // a volvió el día 11 y c el 13 (en su primera semana); b, no; d se dio de alta hace menos de 7 días
    expect(r.vuelven7).toEqual({ base: 3, vuelven: 2, pct: 67 });
  });

  it('en un periodo corto solo cuenta lo de esos días, y compara con los días anteriores', () => {
    const m = metricas(USUARIOS, HOY, '7');
    expect(m.resumen).toMatchObject({ entran: 3, nuevos: 1, repiten: 2, minutos: 950 });
    expect(m.anterior).toMatchObject({ entran: 3, nuevos: 3 });
    expect(m.registrados).toBe(4);
    expect(metricas(USUARIOS, HOY, 'todo').anterior).toBeNull();
  });
});

describe('los repartos', () => {
  it('el tiempo de uso por tramos, el día de la semana y el tipo de acceso', () => {
    const dias = diasDelPeriodo(USUARIOS, HOY, 'todo');
    expect(porTiempoDeUso(USUARIOS, dias).map(x => x.valor)).toEqual([0, 1, 0, 1, 1, 1]);
    const semana = porDiaDeSemana(serieDiaria(USUARIOS, dias));
    expect(semana.map(x => x.nombre)).toEqual(['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']);
    expect(semana[1].valor).toBe(1);   // los martes 10 (2) y 17 (nadie)
    expect(reparto(USUARIOS, 'tipo', { beta: 'Acceso gratuito' })).toEqual([{ nombre: 'Acceso gratuito', valor: 3 }, { nombre: 'fundador', valor: 1 }]);
  });

  it('la retención agrupa por la semana de alta y no inventa semanas que aún no han llegado', () => {
    const c = cohortes(USUARIOS, HOY);
    expect(c.map(x => [x.semana, x.altas])).toEqual([['2026-11-09', 3], ['2026-11-16', 1]]);
    expect(c[0].celdas[0]).toMatchObject({ activos: 3, pct: 100 });
    expect(c[0].celdas[1]).toMatchObject({ activos: 1, pct: 33 });   // a, el día 18
    expect(c[0].celdas[2]).toBeNull();
    expect(c[1].celdas[1]).toBeNull();
  });
});
