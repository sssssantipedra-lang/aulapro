// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppState } from './useAppState';
import { cursoNuevoDe, planDePartida, type PlanDeCurso } from '../lib/cursoNuevo';

/** El estado con los datos de ejemplo del docente de aula. */
function conEjemplo() {
  const h = renderHook(() => useAppState());
  act(() => h.result.current.loadDemoData('es'));
  return h;
}

describe('empezar curso nuevo', () => {
  it('deja en el perfil lo que dice la cuenta de lib/cursoNuevo, ni más ni menos', async () => {
    const { result } = conEjemplo();
    const antes = result.current.datosDelCurso;
    const plan: PlanDeCurso = { ...planDePartida(antes.classes), destinos: { ...planDePartida(antes.classes).destinos, c1: 'sube', p5: 'sube', c2: 'se-va' } };
    const esperado = cursoNuevoDe(antes, plan);

    await act(async () => { await result.current.startNewSchoolYear(plan, '2027-2028'); });

    const st = result.current;
    expect(st.classes).toEqual(esperado.classes);
    expect(st.classes.find(c => c.id === 'c1')?.name).toBe('2º ESO A');
    expect(st.classes.find(c => c.id === 'p5')).toMatchObject({ name: '6º Primaria A', curso: 6 });
    expect(st.classes.some(c => c.id === 'c2')).toBe(false);
    expect([...st.students].map(s => s.id).sort()).toEqual(esperado.students.map(s => s.id).sort());
    expect(st.students.length).toBe(12);
    expect(st.scheduleBlocks).toEqual(esperado.blocks);
    expect(st.gradeCategories).toEqual(esperado.gradeCategories);
    expect(st.gradeCategories.length).toBeGreaterThan(0);
    expect(st.marksConfigs).toEqual(esperado.marksConfigs);
    expect(st.rubrics).toEqual(esperado.rubrics);
    expect(st.dianas).toEqual(esperado.dianas);
    // Lo del curso que acaba empieza limpio
    expect(st.gradeItems).toEqual([]);
    expect(st.grades).toEqual({});
    expect(st.evaluations).toEqual([]);
    expect(st.classMarks).toEqual([]);
    expect(st.attendance).toEqual({});
    // Los eventos de ejemplo son de los próximos días: no han pasado, así que siguen
    expect(st.calEvents).toEqual(esperado.events);
    expect(st.calEvents.length).toBe(antes.events.length);
    expect(st.dianaProfiles).toEqual({});
  });

  it('el registro de cambios empieza con una sola línea que lo dice, y no queda nada que deshacer', async () => {
    const { result } = conEjemplo();
    act(() => result.current.deleteRubric(result.current.rubrics[0].id));
    expect(result.current.borradoPendiente).not.toBeNull();
    await act(async () => { await result.current.startNewSchoolYear(planDePartida(result.current.classes), '2027-2028'); });
    expect(result.current.borradoPendiente).toBeNull();
    expect(result.current.auditLog).toHaveLength(1);
    expect(result.current.auditLog[0].what).toBe('Empezó el curso 2027-2028');
  });

  it('con todas las clases vacías se conservan las clases, el horario y el cuaderno, sin alumnado', async () => {
    const { result } = conEjemplo();
    const antes = result.current.datosDelCurso;
    await act(async () => { await result.current.startNewSchoolYear(planDePartida(antes.classes), ''); });
    expect(result.current.classes).toEqual(antes.classes);
    expect(result.current.students).toEqual([]);
    expect(result.current.scheduleBlocks).toEqual(antes.blocks);
    expect(result.current.gradeCategories).toEqual(antes.gradeCategories);
  });
});
