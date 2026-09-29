import { describe, it, expect } from 'vitest';
import { firstSteps, firstStepsComplete } from './firstSteps';
import type { Class, Student, ScheduleBlock, GradeCategory } from '../types';

const empty = { classes: [], students: [], scheduleBlocks: [], gradeCategories: [], attendance: {}, hasAi: false };
const cls = { id: 'c1', name: '3º A' } as Class;
const st = { id: 's1', class_id: 'c1' } as Student;

describe('firstSteps', () => {
  it('sin nada, ningún paso está hecho', () => {
    const steps = firstSteps(empty);
    expect(steps.map(s => s.done)).toEqual([false, false, false, false, false]);
    expect(firstStepsComplete(steps)).toBe(false);
  });

  it('una clase sin alumnos todavía no cuenta', () => {
    expect(firstSteps({ ...empty, classes: [cls] })[0].done).toBe(false);
    expect(firstSteps({ ...empty, classes: [cls], students: [st] })[0].done).toBe(true);
  });

  it('la asistencia cuenta en cuanto hay un alumno marcado un día', () => {
    expect(firstSteps({ ...empty, attendance: { c1: {} } })[3].done).toBe(false);
    expect(firstSteps({ ...empty, attendance: { c1: { '2026-09-29': { s1: 'present' } } } })[3].done).toBe(true);
  });

  it('la IA es opcional: sin ella la guía se da por terminada', () => {
    const steps = firstSteps({
      classes: [cls], students: [st],
      scheduleBlocks: [{ id: 'b' } as ScheduleBlock],
      gradeCategories: [{ id: 'g' } as GradeCategory],
      attendance: { c1: { '2026-09-29': { s1: 'absent' } } },
      hasAi: false,
    });
    expect(steps[4]).toMatchObject({ id: 'ai', done: false, optional: true });
    expect(firstStepsComplete(steps)).toBe(true);
  });
});
