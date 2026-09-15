/**
 * `repararGrupos` es la pieza que evita que un alumno desaparezca del aula o
 * aparezca sentado en dos mesas a la vez si la IA repite, omite o inventa un
 * id — por eso se prueba a fondo por separado, sin red.
 *
 * `generateBalancedGroups` se prueba mockeando `callGemini`, igual que
 * `learningSituations.curriculum.test.ts`: lo que importa es qué prompt se
 * construye y qué hace con la respuesta, no la llamada HTTP en sí.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repararGrupos, generateBalancedGroups, type StudentForGrouping } from './classGroups';

describe('repararGrupos', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('deja pasar una respuesta ya correcta tal cual', () => {
    const r = repararGrupos(
      [{ estudiantes: ['a', 'b'] }, { estudiantes: ['c', 'd'] }],
      ids, 2, 2,
    );
    expect(r.grupos.map(g => g.estudiantes)).toEqual([['a', 'b'], ['c', 'd']]);
    expect(r.sinAsignar).toEqual([]);
  });

  it('descarta un id repetido entre mesas, sin duplicar al alumno', () => {
    const r = repararGrupos(
      [{ estudiantes: ['a', 'b'] }, { estudiantes: ['b', 'c'] }], // "b" en las dos
      ids, 2, 2,
    );
    const todos = r.grupos.flatMap(g => g.estudiantes);
    expect(todos.filter(id => id === 'b')).toHaveLength(1);
  });

  it('descarta un id inventado que no está en la lista real', () => {
    // Con groupSize 3 caben los 4 ids reales sin que "zzz" empuje a nadie
    // fuera: así se aísla el descarte del inventado del relleno de huérfanos,
    // que es un comportamiento distinto (ver el test de abajo).
    const r = repararGrupos(
      [{ estudiantes: ['a', 'zzz', 'b'] }, { estudiantes: ['c', 'd'] }],
      ids, 2, 3,
    );
    expect(r.grupos[0].estudiantes).toEqual(['a', 'b']);
    expect(r.grupos.flatMap(g => g.estudiantes)).not.toContain('zzz');
  });

  it('reparte a quien la IA se dejó fuera en el primer hueco libre', () => {
    const r = repararGrupos(
      [{ estudiantes: ['a'] }, { estudiantes: ['c', 'd'] }], // falta "b"
      ids, 2, 2,
    );
    expect(r.grupos[0].estudiantes).toEqual(['a', 'b']);
    expect(r.sinAsignar).toEqual([]);
  });

  it('nunca deja un grupo con más alumnos de los que caben en la mesa', () => {
    const r = repararGrupos(
      [{ estudiantes: ['a', 'b', 'c'] }, { estudiantes: ['d'] }], // 3 en una mesa de 2
      ids, 2, 2,
    );
    expect(r.grupos[0].estudiantes.length).toBeLessThanOrEqual(2);
    // "c" no cupo en la primera: debe reaparecer en la segunda, no perderse.
    expect(r.grupos.flatMap(g => g.estudiantes)).toContain('c');
  });

  it('con más alumnos que asientos, los que sobran van a sinAsignar, no se pierden', () => {
    const r = repararGrupos([{ estudiantes: ['a', 'b'] }], ['a', 'b', 'c'], 1, 2);
    expect(r.grupos[0].estudiantes).toEqual(['a', 'b']);
    expect(r.sinAsignar).toEqual(['c']);
  });

  it('conserva la justificación de cada grupo', () => {
    const r = repararGrupos(
      [{ estudiantes: ['a', 'b'], justificacion: 'Equilibrado en nivel' }],
      ['a', 'b'], 1, 2,
    );
    expect(r.grupos[0].justificacion).toBe('Equilibrado en nivel');
  });

  it('una mesa sin datos de la IA queda vacía, no revienta', () => {
    const r = repararGrupos([{}, { estudiantes: ['a', 'b'] }], ['a', 'b'], 2, 2);
    expect(r.grupos[0].estudiantes).toEqual([]);
  });
});

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

function alumno(id: string, overrides: Partial<StudentForGrouping> = {}): StudentForGrouping {
  return { id, name: `Alumno ${id}`, media: 7, asistenciaPct: 90, avisos: [], notas: '', ...overrides };
}

describe('generateBalancedGroups', () => {
  // Sin esto, `mock.calls[0]` de un test iría apuntando a la llamada de un
  // test anterior en vez de a la suya propia: los mocks de vitest no se
  // limpian solos entre `it()`.
  beforeEach(() => callGemini.mockClear());

  it('manda un enum cerrado con los ids reales, no una lista abierta', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ grupos: [{ estudiantes: ['s1', 's2'], justificacion: 'j' }] }));

    await generateBalancedGroups(
      { students: [alumno('s1'), alumno('s2')], numGroups: 1, groupSize: 2 }, 'es',
    );

    const schema = callGemini.mock.calls[0][4].responseSchema;
    expect(schema.properties.grupos.items.properties.estudiantes.items.enum).toEqual(['s1', 's2']);
  });

  it('incluye las notas del docente en el prompt cuando las hay', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ grupos: [] }));
    await generateBalancedGroups(
      { students: [alumno('s1')], numGroups: 1, groupSize: 2, notasDocente: 'Marco y Lucía no deben ir juntos' },
      'es',
    );
    const userPrompt = callGemini.mock.calls[0][1] as string;
    expect(userPrompt).toContain('Marco y Lucía no deben ir juntos');
  });

  it('sin notas del docente, no menciona la sección en el prompt', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ grupos: [] }));
    await generateBalancedGroups({ students: [alumno('s1')], numGroups: 1, groupSize: 2 }, 'es');
    const userPrompt = callGemini.mock.calls[0][1] as string;
    expect(userPrompt).not.toContain('ASPECTOS A TENER EN CUENTA');
  });

  it('repara la respuesta antes de devolverla (no confía en la IA a ciegas)', async () => {
    // "zzz" no existe: si esto no se reparase, se colaría un id inventado.
    callGemini.mockResolvedValueOnce(JSON.stringify({ grupos: [{ estudiantes: ['s1', 'zzz'], justificacion: 'j' }] }));
    const r = await generateBalancedGroups({ students: [alumno('s1')], numGroups: 1, groupSize: 2 }, 'es');
    expect(r!.grupos[0].estudiantes).toEqual(['s1']);
  });

  it('sin alumnos, no llama a la IA', async () => {
    const r = await generateBalancedGroups({ students: [], numGroups: 1, groupSize: 2 }, 'es');
    expect(r).toEqual({ grupos: [], sinAsignar: [] });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('si la IA no responde, devuelve null en vez de reventar', async () => {
    callGemini.mockResolvedValueOnce(null);
    const r = await generateBalancedGroups({ students: [alumno('s1')], numGroups: 1, groupSize: 2 }, 'es');
    expect(r).toBeNull();
  });
});
