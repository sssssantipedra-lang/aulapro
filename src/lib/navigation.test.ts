import { describe, it, expect } from 'vitest';
import { reachableSections, hubOf, hubEnMenu, isCurrent, NAV_GROUPS, NAV_APOYO, NAV_EF, navGroupsFor } from './navigation';
import type { Section } from '../types';

const ALL: Section[] = [
  'dashboard', 'classes', 'agenda', 'rubrics', 'diana', 'history', 'notebook', 'profile',
  'sec-classroom', 'share', 'classroom-live', 'attendance', 'reports', 'selfassess', 'audit', 'records',
  'learning-situations', 'resources', 'meetings', 'trainings', 'seating',
];
const APOYO: Section[] = ['apoyo-registro', 'apoyo-alumnado', 'apoyo-programas', 'apoyo-documentos', 'apoyo-coordinaciones', 'apoyo-agenda-visual'];

describe('menú', () => {
  it('no se pierde ninguna pantalla y ninguna sale dos veces', () => {
    const r = reachableSections();
    expect(new Set(r).size).toBe(r.length);
    expect([...r].sort()).toEqual([...ALL].sort());
    // Las de PT y AL, en su menú
    expect(reachableSections('apoyo')).toEqual(expect.arrayContaining(APOYO));
  });

  it('el menú visible es corto: 8 entradas fuera de «Más»', () => {
    const visible = NAV_GROUPS.filter(g => !g.collapsedByDefault).flatMap(g => g.items);
    expect(visible).toHaveLength(8);
  });

  it('el profesorado de PT y AL tiene su propio menú: el apoyo, lo común y Aula Live', () => {
    expect(navGroupsFor('aula')).toBe(NAV_GROUPS);
    expect(navGroupsFor('apoyo')).toBe(NAV_APOYO);
    const r = reachableSections('apoyo');
    expect(new Set(r).size).toBe(r.length);
    expect(r.slice(0, 6)).toEqual(['dashboard', 'apoyo-registro', 'apoyo-alumnado', 'apoyo-programas', 'apoyo-coordinaciones', 'apoyo-documentos']);
    expect(r).toEqual(expect.arrayContaining(['agenda', 'apoyo-agenda-visual', 'resources', 'sec-classroom', 'meetings', 'trainings', 'audit', 'profile']));
    // Nada de lo de tutoría
    for (const s of ['classes', 'notebook', 'attendance', 'rubrics', 'reports', 'records', 'seating', 'share'] as Section[]) {
      expect(r).not.toContain(s);
    }
    expect(reachableSections()).not.toContain('apoyo-alumnado');
    // Todo va suelto: sin pestañas de apartados que ese menú no tiene
    expect(NAV_APOYO.flatMap(g => g.items).every(e => e.kind === 'link')).toBe(true);
    expect(hubEnMenu('resources', 'apoyo')).toBeUndefined();
    expect(hubEnMenu('resources', 'aula')?.id).toBe('documents');
    expect(hubOf('apoyo-alumnado')).toBeUndefined();
  });

  it('el de EF es el de aula con su apartado después del Inicio; ser tutor no cambia el menú', () => {
    expect(navGroupsFor('ef')).toBe(NAV_EF);
    expect(NAV_EF[0].items.map(e => e.id).slice(0, 2)).toEqual(['dashboard', 'ef']);
    const r = reachableSections('ef');
    expect(new Set(r).size).toBe(r.length);
    expect(r).toEqual(expect.arrayContaining([...reachableSections('aula'), 'ef-pista', 'ef-exentos']));
    expect(reachableSections('aula')).not.toContain('ef-pista');
    expect(hubEnMenu('ef-pista', 'ef')?.id).toBe('ef');
    expect(hubEnMenu('ef-pista', 'aula')).toBeUndefined();
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
