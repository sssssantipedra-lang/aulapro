import { describe, it, expect } from 'vitest';
import { buildTeacherContext, chatSystemPrompt, type TeacherData } from './aiContext';
import type { Class, Student } from '../types';

function cls(id: string, name: string): Class {
  return { id, name, subject: 'Matemáticas', subjects: ['Matemáticas'], room: 'A1', color: '#000' };
}

function alumno(id: string, classId: string, name: string): Student {
  return { id, class_id: classId, name, email: '', photo: null, alerts: [], notes: '' };
}

/**
 * Un cuaderno pequeño pero completo: dos clases, una con notas y otra sin
 * ellas, para comprobar las dos mitades de la regla —dar la cifra cuando la
 * hay y decir que no la hay cuando no—.
 */
function datos(): TeacherData {
  return {
    profile: { name: 'Ana García', school: 'IES Ejemplo', subject: 'Matemáticas', course: '2026-2027' },
    classes: [cls('c1', '3º ESO A'), cls('c2', '4º ESO B')],
    students: [
      alumno('s1', 'c1', 'Carmen López'),
      alumno('s2', 'c1', 'Elena Castro'),
      alumno('s3', 'c2', 'Marco Ruiz'),
    ],
    gradeCategories: [
      { id: 'g1', class_id: 'c1', name: 'Exámenes', weight: 60 },
      { id: 'g2', class_id: 'c1', name: 'Tareas', weight: 40 },
    ],
    gradeItems: [
      { id: 'i1', class_id: 'c1', category_id: 'g1', name: 'Examen T1', date: '2026-09-01' },
      { id: 'i2', class_id: 'c1', category_id: 'g2', name: 'Cuaderno', date: '2026-09-02' },
    ],
    grades: {
      i1: { s1: 4, s2: 9 },
      i2: { s1: 7, s2: 10 },
    },
    evaluations: [],
    attendance: {
      c1: {
        '2026-09-01': { s1: 'absent', s2: 'present' },
        '2026-09-02': { s1: 'present', s2: 'present' },
      },
    },
    reports: [],
    calEvents: [],
    scheduleBlocks: [],
    tasks: [{ id: 't1', text: 'Corregir exámenes', priority: 'high', done: false }],
    learningSituations: [],
  };
}

describe('buildTeacherContext', () => {
  it('incluye la media ponderada real de cada alumno', () => {
    const ctx = buildTeacherContext(datos());
    // Carmen: 4×60% + 7×40% = 5,2 · Elena: 9×60% + 10×40% = 9,4
    expect(ctx).toContain('Carmen López · media 5,2');
    expect(ctx).toContain('Elena Castro · media 9,4');
  });

  it('dice «sin notas» en vez de callarse cuando el alumno no tiene ninguna', () => {
    const ctx = buildTeacherContext(datos());
    expect(ctx).toContain('Marco Ruiz · media sin notas');
  });

  it('cuenta el retraso y la falta justificada como asistencia, igual que la app', () => {
    const d = datos();
    d.attendance.c1['2026-09-03'] = { s1: 'late', s2: 'justified' };
    const ctx = buildTeacherContext(d);
    // Carmen: 2 de 3 sesiones (una falta) → 67 %
    expect(ctx).toContain('Carmen López · media 5,2 · asistencia 67% (1 faltas de 3 sesiones)');
    expect(ctx).toContain('Elena Castro · media 9,4 · asistencia 100%');
  });

  it('lleva las categorías con su peso y las pruebas registradas', () => {
    const ctx = buildTeacherContext(datos());
    expect(ctx).toContain('Exámenes 60%, Tareas 40%');
    expect(ctx).toContain('«Examen T1» (2026-09-01)');
  });

  it('con classId solo aparece esa clase', () => {
    const ctx = buildTeacherContext(datos(), { classId: 'c1' });
    expect(ctx).toContain('3º ESO A');
    expect(ctx).not.toContain('4º ESO B');
    expect(ctx).not.toContain('Marco Ruiz');
  });

  it('usa el formato de número del idioma activo', () => {
    const ctx = buildTeacherContext(datos(), { locale: 'en-GB' });
    expect(ctx).toContain('media 5.2');
  });

  it('sin clases lo dice claramente, para que la IA no se invente ninguna', () => {
    const vacio: TeacherData = { ...datos(), classes: [], students: [] };
    const ctx = buildTeacherContext(vacio);
    expect(ctx).toContain('NO tiene ninguna clase creada');
  });

  it('arrastra los avisos y las anotaciones del docente sobre un alumno', () => {
    const d = datos();
    d.students[0].alerts = [{ id: 'a1', text: 'Faltas reiteradas', level: 'warn' }];
    d.students[0].notes = 'Trabaja mejor en grupo';
    const ctx = buildTeacherContext(d);
    expect(ctx).toContain('avisos: Faltas reiteradas');
    expect(ctx).toContain('anotación del docente: Trabaja mejor en grupo');
  });
});

describe('chatSystemPrompt', () => {
  it('con datos, prohíbe inventar', () => {
    const p = chatSystemPrompt('es', true);
    expect(p).toContain('NO inventes');
    expect(p).toContain('DATOS REALES DEL CUADERNO');
  });

  it('sin datos, obliga a admitir que no ve el cuaderno', () => {
    const p = chatSystemPrompt('es', false);
    expect(p).toContain('NO tienes los datos');
    expect(p).not.toContain('NO inventes');
  });

  it('en inglés cambia de idioma pero mantiene la regla', () => {
    expect(chatSystemPrompt('en', true)).toContain('NEVER invent');
  });
});
