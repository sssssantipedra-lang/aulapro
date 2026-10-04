import { describe, it, expect } from 'vitest';
import { reachableSections, hubOf, isCurrent, NAV_GROUPS, navGroupsFor } from './navigation';
import type { Section } from '../types';

const ALL: Section[] = [
  'dashboard', 'classes', 'agenda', 'rubrics', 'diana', 'history', 'notebook', 'profile',
  'sec-classroom', 'share', 'classroom-live', 'attendance', 'reports', 'selfassess', 'audit', 'records',
  'learning-situations', 'resources', 'meetings', 'trainings', 'seating',
];

describe('menú', () => {
  it('no se pierde ninguna pantalla y ninguna sale dos veces', () => {
    const r = reachableSections();
    expect(new Set(r).size).toBe(r.length);
    expect([...r].sort()).toEqual([...ALL].sort());
  });

  it('el menú visible es corto: 8 entradas fuera de «Más»', () => {
    const visible = NAV_GROUPS.filter(g => !g.collapsedByDefault).flatMap(g => g.items);
    expect(visible).toHaveLength(8);
  });

  it('el profesorado de PT y AL tiene su apartado justo después del Inicio; el resto, no', () => {
    expect(navGroupsFor(false)).toBe(NAV_GROUPS);
    const dia = navGroupsFor(true)[0].items;
    expect(dia.map(e => e.id).slice(0, 2)).toEqual(['dashboard', 'apoyo']);
    const r = reachableSections(true);
    expect(new Set(r).size).toBe(r.length);
    expect(r).toContain('apoyo-alumnado');
    expect(reachableSections()).not.toContain('apoyo-alumnado');
    expect(hubOf('apoyo-alumnado')?.id).toBe('apoyo');
  });

  it('cada pantalla agrupada marca su apartado como actual', () => {
    expect(hubOf('records')?.id).toBe('documents');
    expect(hubOf('seating')?.id).toBe('inclass');
    expect(hubOf('notebook')).toBeUndefined();
    const evaluar = NAV_GROUPS.flatMap(g => g.items).find(e => e.id === 'evaluate')!;
    expect(isCurrent(evaluar, 'diana')).toBe(true);
    expect(isCurrent(evaluar, 'reports')).toBe(false);
  });
});
