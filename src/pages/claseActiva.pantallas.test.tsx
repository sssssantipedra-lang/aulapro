// @vitest-environment jsdom
/**
 * La clase activa dentro de una pantalla (repaso del 20-11-2026): la clase elegida a mano en el cuaderno
 * vale para sus pestañas aunque el horario diga otra, y la ventana de valorar una escala de registro
 * se abre en la clase de ahora si la escala es de varias.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Notebook } from './Notebook';
import { ValorarRegistro } from '../components/ValorarRegistro';
import { ClaseActiva } from '../components/ClaseActiva';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { atenderClasePedida } from '../lib/claseActiva';
import type { Class, EvalDiana, ScheduleBlock, Student } from '../types';

const clase = (id: string, name: string) => ({ id, name, subject: 'Matemáticas', subjects: ['Matemáticas'], room: '', color: '#0284c7', etapa: 'eso', curso: 1 }) as unknown as Class;
const clases = [clase('a', '1º A'), clase('b', '2º B')];
const alumnos = [['s1', 'a', 'Alumno 1'], ['s2', 'b', 'Alumno 2']]
  .map(([id, class_id, name]) => ({ id, class_id, name, email: '', photo: null, alerts: [], notes: '' }) as Student);
// Martes 13-10-2026: «2º B» de 8:30 a 9:25
const horario: ScheduleBlock[] = [{ id: 'h1', class_id: 'b', day: 2, time_start: '08:30', time_end: '09:25', subject: '', room: '', color: '' }];

let perfil = 0;
const conHorario = (hijos: React.ReactNode) => render(
  <I18nProvider><ToastProvider>
    <ClaseActiva perfil={`pantallas${perfil}`} classes={clases} blocks={horario}>{hijos}</ClaseActiva>
  </ToastProvider></I18nProvider>,
);
const elegida = () => screen.getAllByRole('button', { pressed: true }).map(b => b.textContent);

beforeEach(() => {
  perfil += 1;
  localStorage.clear();
  atenderClasePedida();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 13, 9, 0)); // «2º B» está en marcha
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('el cuaderno', () => {
  const props = {
    classes: clases, students: alumnos, gradeCategories: [], gradeItems: [], grades: {}, classMarks: [], marksConfigs: {},
    onSaveMarksConfig: vi.fn(), onAddCategory: vi.fn(), onUpdateCategory: vi.fn(), onDeleteCategory: vi.fn(),
    onAddItem: vi.fn(), onUpdateItem: vi.fn(), onDeleteItem: vi.fn(), onSetGrade: vi.fn(),
    lawDocument: null, onLawDocumentChange: vi.fn(), onNav: vi.fn(), evaluations: [], aiData: {} as never, chat: [], onChatChange: vi.fn(),
    comunidad: 'madrid',
  } as unknown as ComponentProps<typeof Notebook>;

  it('se abre en la clase de ahora y la elegida a mano sigue al cambiar de pestaña y al volver', async () => {
    const user = userEvent.setup();
    conHorario(<Notebook {...props} />);
    expect(elegida()).toEqual([expect.stringContaining('2º B')]);
    await user.click(screen.getByRole('button', { name: '1º A' }));
    expect(elegida()).toEqual(['1º A']);

    await user.click(screen.getByRole('button', { name: 'Por competencias' }));
    // La pestaña se carga aparte: cuando llega, enseña la misma clase y no la del horario
    await screen.findByRole('button', { name: /2º B.*Ahora, según tu horario/ }, { timeout: 10_000 });
    expect(elegida()).toEqual(['1º A']);

    // Lo que se elige en «Por competencias» también vale al volver a «Calificaciones»
    await user.click(screen.getByRole('button', { name: /2º B/ }));
    await user.click(screen.getByRole('button', { name: '1º A' }));
    await user.click(screen.getByRole('button', { name: 'Calificaciones' }));
    expect(elegida()).toEqual(['1º A']);
  }, 20_000);
});

describe('valorar una escala de registro', () => {
  const escala: EvalDiana = {
    id: 'reg1', tipo: 'registro', name: 'Saque', class_id: 'a', otras_clases: [{ class_id: 'b' }],
    items: [{ id: 'i1', name: 'Golpea con la palma', weight: 1 }],
  };
  const ventana = (claseInicial?: string) => conHorario(
    <ValorarRegistro escala={escala} classes={clases} students={alumnos} evaluations={[]} claseInicial={claseInicial} onAddEvaluation={vi.fn()} onClose={vi.fn()} />,
  );
  const claseDeLaVentana = () => (document.getElementById('reg-clase') as HTMLSelectElement).value;

  it('se abre en la clase de ahora, con su alumnado', () => {
    ventana();
    expect(claseDeLaVentana()).toBe('b');
    expect(screen.getByText('Alumno 2')).toBeTruthy();
    expect(screen.queryByText('Alumno 1')).toBeNull();
  });

  it('la clase que pide quien la abre (la de la sesión) manda sobre el horario', () => {
    ventana('a');
    expect(claseDeLaVentana()).toBe('a');
    expect(screen.getByText('Alumno 1')).toBeTruthy();
  });

  it('una escala de una sola clase se abre en la suya aunque ahora toque otra', () => {
    conHorario(<ValorarRegistro escala={{ ...escala, otras_clases: [] }} classes={clases} students={alumnos} evaluations={[]} onAddEvaluation={vi.fn()} onClose={vi.fn()} />);
    expect(claseDeLaVentana()).toBe('a');
  });
});
