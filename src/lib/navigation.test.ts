import { describe, it, expect } from 'vitest';
import { reachableSections, hubOf, isCurrent, NAV_GROUPS } from './navigation';
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

  it('cada pantalla agrupada marca su apartado como actual', () => {
    expect(hubOf('records')?.id).toBe('documents');
    expect(hubOf('seating')?.id).toBe('inclass');
    expect(hubOf('notebook')).toBeUndefined();
    const evaluar = NAV_GROUPS.flatMap(g => g.items).find(e => e.id === 'evaluate')!;
    expect(isCurrent(evaluar, 'diana')).toBe(true);
    expect(isCurrent(evaluar, 'reports')).toBe(false);
  });
});
