import { describe, it, expect } from 'vitest';
import { aplicarReparto, estructuraParaTodos, huecosDelPlan, mesasConEstructura, rolesSinCambiarDeRol } from './repartoMesas';

describe('estructuraParaTodos', () => {
  it('si caben todos, no cambia nada', () => {
    expect(estructuraParaTodos(20, 5, 4)).toEqual({ numGroups: 5, groupSize: 4 });
    expect(estructuraParaTodos(18, 5, 4)).toEqual({ numGroups: 5, groupSize: 4 });
  });
  it('si no caben, añade las mesas justas del mismo tamaño', () => {
    expect(estructuraParaTodos(25, 5, 4)).toEqual({ numGroups: 7, groupSize: 4 });
    expect(estructuraParaTodos(21, 5, 4)).toEqual({ numGroups: 6, groupSize: 4 });
  });
  it('con las 12 mesas llenas, un asiento más por mesa', () => {
    expect(estructuraParaTodos(30, 5, 2)).toEqual({ numGroups: 12, groupSize: 3 });
  });
  it('nunca pasa de 12 mesas de 8', () => {
    expect(estructuraParaTodos(200, 5, 4)).toEqual({ numGroups: 12, groupSize: 8 });
  });
});

describe('huecosDelPlan y aplicarReparto', () => {
  const plan = {
    groupSize: 4,
    groups: [
      { id: 'g1', label: 'Mesa 1', studentIds: ['a', '', 'viejo'] },
      { id: 'g2', label: 'Mesa 2', studentIds: [] },
    ],
  };
  const enClase = new Set(['a', 'b', 'c', 'd', 'e']);

  it('con «dejar a quien ya tiene mesa», libres son los vacíos y los de quien ya no está en la clase', () => {
    const h = huecosDelPlan(plan, enClase, false);
    expect(h[0]).toEqual({ label: 'Mesa 1', sentados: [{ id: 'a', asiento: 0 }], libres: [1, 2, 3] });
    expect(h[1].libres).toEqual([0, 1, 2, 3]);
  });

  it('cada alumno nuevo va a un asiento libre, en orden, sin mover a quien se queda', () => {
    const h = huecosDelPlan(plan, enClase, false);
    const g = aplicarReparto(plan.groups, h, [{ estudiantes: ['b', 'c'], justificacion: 'Equilibrada' }, { estudiantes: ['d', 'e'] }], 4, false);
    expect(g[0].studentIds).toEqual(['a', 'b', 'c']);
    expect(g[0].justificacion).toBe('Equilibrada');
    expect(g[1].studentIds).toEqual(['d', 'e']);
  });

  it('repartiendo a toda la clase, todos los asientos se rehacen y la justificación vieja se va', () => {
    const conJ = [{ ...plan.groups[0], justificacion: 'vieja' }, plan.groups[1]];
    const h = huecosDelPlan({ ...plan, groups: conJ }, enClase, true);
    const g = aplicarReparto(conJ, h, [{ estudiantes: ['c', 'a'] }, { estudiantes: ['b'] }], 4, true);
    expect(g[0].studentIds).toEqual(['c', 'a']);
    expect(g[0].justificacion).toBeUndefined();
  });

  it('las mesas que se añaden llevan su nombre y las que había conservan el suyo', () => {
    const g = mesasConEstructura(plan.groups, 3, 2, n => `Mesa ${n}`, () => 'nueva');
    expect(g.map(x => x.label)).toEqual(['Mesa 1', 'Mesa 2', 'Mesa 3']);
    expect(g[0].studentIds).toEqual(['a', '']);
  });
});

describe('arreglos de la revisión del reparto (24-11-2026)', () => {
  it('sentando solo a los que faltan, una mesa a la que no llega nadie conserva su justificación', () => {
    const groups = [
      { id: 'g1', label: 'Mesa 1', studentIds: ['a', 'b'], justificacion: 'La de antes' },
      { id: 'g2', label: 'Mesa 2', studentIds: ['c'], justificacion: 'Otra' },
    ];
    const h = huecosDelPlan({ groupSize: 2, groups }, new Set(['a', 'b', 'c', 'd']), false);
    const g = aplicarReparto(groups, h, [{ estudiantes: [], justificacion: 'Esta mesa ya está completa' }, { estudiantes: ['d'], justificacion: 'Nueva' }], 2, false);
    expect(g[0].justificacion).toBe('La de antes');
    expect(g[1].justificacion).toBe('Nueva');
  });

  it('al crecer las mesas con la rotación avanzada, cada asiento conserva el rol de esta semana', () => {
    const roles = ['Portavoz', 'Secretario', 'Material', 'Tiempo'];
    // weekOffset 2: el asiento 0 era Material, el 1 Tiempo, el 2 Portavoz y el 3 Secretario
    expect(rolesSinCambiarDeRol(roles, 2)).toEqual(['Material', 'Tiempo', 'Portavoz', 'Secretario']);
    expect(rolesSinCambiarDeRol(roles, 0)).toBe(roles);
  });
});

