/**
 * «Primeros pasos» del Inicio: lo mínimo para que la aplicación empiece a ser
 * útil, en el orden en que tiene sentido hacerlo. Cada paso se marca solo en
 * cuanto existe lo que pide, sin que el docente tenga que tachar nada.
 */
import type { AttendanceMap, Class, GradeCategory, ScheduleBlock, Student, Section } from '../types';

export type FirstStepId = 'classes' | 'schedule' | 'notebook' | 'attendance' | 'ai';

export interface FirstStep {
  id: FirstStepId;
  done: boolean;
  /** Se puede dejar sin hacer: no cuenta para dar la guía por terminada. */
  optional?: boolean;
  /** Pantalla a la que lleva el paso. */
  target: Section;
}

export interface FirstStepsInput {
  classes: readonly Class[];
  students: readonly Student[];
  scheduleBlocks: readonly ScheduleBlock[];
  gradeCategories: readonly GradeCategory[];
  attendance: AttendanceMap;
  hasAi: boolean;
}

const anyAttendance = (a: AttendanceMap) =>
  Object.values(a).some(byDate => Object.values(byDate ?? {}).some(day => Object.keys(day ?? {}).length > 0));

export function firstSteps(d: FirstStepsInput): FirstStep[] {
  return [
    { id: 'classes',    target: 'classes',    done: d.classes.length > 0 && d.students.length > 0 },
    { id: 'schedule',   target: 'agenda',     done: d.scheduleBlocks.length > 0 },
    { id: 'notebook',   target: 'notebook',   done: d.gradeCategories.length > 0 },
    { id: 'attendance', target: 'attendance', done: anyAttendance(d.attendance) },
    { id: 'ai',         target: 'profile',    done: d.hasAi, optional: true },
  ];
}

/** Terminada cuando están hechos todos los pasos obligatorios. */
export function firstStepsComplete(steps: readonly FirstStep[]): boolean {
  return steps.every(s => s.done || s.optional);
}
