import { describe, it, expect } from 'vitest';
import { buildSeatingHtml, buildSeatingDocxBlob, roleForSeat } from './exportSeating';
import type { Class, Student, SeatingPlan } from '../types';

function clase(): Class {
  return { id: 'c1', name: '3º ESO A', subject: 'Matemáticas', subjects: ['Matemáticas'], room: '12', color: '#0284c7' };
}

function alumnos(): Student[] {
  return [
    { id: 's1', class_id: 'c1', name: 'Ana García', email: '', photo: null, alerts: [], notes: '' },
    { id: 's2', class_id: 'c1', name: 'Bruno Ruiz', email: '', photo: null, alerts: [], notes: '' },
    { id: 's3', class_id: 'c1', name: 'Clara Soto', email: '', photo: null, alerts: [], notes: '' },
    { id: 's4', class_id: 'c1', name: 'Diego Vega', email: '', photo: null, alerts: [], notes: '' },
  ];
}

function plan(weekOffset = 0): SeatingPlan {
  return {
    class_id: 'c1',
    numGroups: 1,
    groupSize: 4,
    roles: [
      { id: 'r1', name: 'Portavoz', description: 'Habla en nombre del grupo' },
      { id: 'r2', name: 'Secretario/a', description: 'Anota los acuerdos' },
      { id: 'r3', name: 'Material', description: 'Reparte y recoge el material' },
      { id: 'r4', name: 'Tiempo', description: 'Controla el tiempo y el volumen' },
    ],
    groups: [{ id: 'g1', label: 'Mesa 1', studentIds: ['s1', 's2', 's3', 's4'] }],
    weekOffset,
    updatedAt: '2026-09-15T00:00:00.000Z',
  };
}

describe('roleForSeat', () => {
  it('sin rotar, el asiento i tiene el rol i', () => {
    const p = plan(0);
    expect(roleForSeat(p, 0)?.name).toBe('Portavoz');
    expect(roleForSeat(p, 1)?.name).toBe('Secretario/a');
  });

  it('rotado una semana, el asiento 0 tiene el rol que antes era del asiento 1', () => {
    const p = plan(1);
    expect(roleForSeat(p, 0)?.name).toBe('Secretario/a');
  });

  it('da la vuelta completa y vuelve al rol original (módulo groupSize)', () => {
    const p = plan(4); // groupSize = 4
    expect(roleForSeat(p, 0)?.name).toBe('Portavoz');
  });
});

describe('buildSeatingHtml', () => {
  it('lleva el nombre de la clase, cada mesa y el rol actual de cada alumno', () => {
    const html = buildSeatingHtml(clase(), plan(1), alumnos(), 'es');
    expect(html).toContain('3º ESO A');
    expect(html).toContain('Mesa 1');
    expect(html).toContain('Ana García');
    // Con weekOffset=1, a Ana (asiento 0) le toca el rol de Secretario/a.
    expect(html).toContain('Secretario/a');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it('un asiento sin alumno no imprime un nombre vacío ni revienta', () => {
    const p = plan(0);
    p.groups[0].studentIds = ['s1']; // solo un alumno de cuatro asientos
    const html = buildSeatingHtml(clase(), p, alumnos(), 'es');
    expect(html).toContain('Ana García');
    expect(html).not.toContain('NaN');
  });

  it('lista las responsabilidades de cada rol al pie', () => {
    const html = buildSeatingHtml(clase(), plan(0), alumnos(), 'es');
    expect(html).toContain('Habla en nombre del grupo');
    expect(html).toContain('Controla el tiempo y el volumen');
  });
});

describe('buildSeatingDocxBlob', () => {
  it('genera un documento .docx no vacío', async () => {
    const blob = await buildSeatingDocxBlob(clase(), plan(1), alumnos(), 'es');
    expect(blob.size).toBeGreaterThan(0);
  });
});
