// @vitest-environment jsdom
/**
 * El cuaderno por evaluaciones (20-11-2026): enseña y cuenta las actividades de la evaluación elegida,
 * «Curso» da la nota de cada evaluación y la final, y una actividad nueva cae en la evaluación que se ve.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Notebook } from './Notebook';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { DEFAULT_BLOCK } from '../services/classMarks';
import type { Class, GradeCategory, GradeItem, GradeMap, MarksBlockConfig, Student } from '../types';

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2027, 1, 10, 10)); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const clase = { id: 'c1', name: '5.º A', subject: 'Lengua', subjects: ['Lengua'], room: '', color: '#0284c7' } as Class;
const otra = { id: 'c2', name: '6.º B', subject: 'Lengua', subjects: ['Lengua'], room: '', color: '#0284c7' } as Class;
const alumnos = [1, 2].map(n => ({ id: `s${n}`, class_id: 'c1', name: `Alumno ${n}`, email: '', photo: null, alerts: [], notes: '' }) as Student);
const categorias: GradeCategory[] = [{ id: 'k1', class_id: 'c1', name: 'Pruebas', weight: 100, subject: 'Lengua' }];
const actividades: GradeItem[] = [
  { id: 'i1', class_id: 'c1', category_id: 'k1', name: 'Dictado de otoño', date: '2026-10-20', weight: 70 },
  { id: 'i1b', class_id: 'c1', category_id: 'k1', name: 'Lectura de otoño', date: '2026-11-20', weight: 30 },
  { id: 'i2', class_id: 'c1', category_id: 'k1', name: 'Examen de invierno', date: '2027-02-03' },
  { id: 'i2b', class_id: 'c1', category_id: 'k1', name: 'Redacción de invierno', date: '2027-02-08' },
];
const notas: GradeMap = { i1: { s1: 4, s2: 6 }, i1b: { s1: 4, s2: 6 }, i2: { s1: 8, s2: 6 }, i2b: { s1: 8 } };
const sinBloque: Record<string, MarksBlockConfig> = { 'c1|Lengua': { ...DEFAULT_BLOCK, enabled: false } };

function pinta(extra: Record<string, unknown> = {}) {
  const props = {
    classes: [clase, otra], students: alumnos, gradeCategories: categorias, gradeItems: actividades, grades: notas, classMarks: [], marksConfigs: sinBloque,
    onSaveMarksConfig: vi.fn(), onAddCategory: vi.fn(), onUpdateCategory: vi.fn(), onDeleteCategory: vi.fn(),
    onAddItem: vi.fn(), onUpdateItem: vi.fn(), onDeleteItem: vi.fn(), onSetGrade: vi.fn(),
    lawDocument: null, onLawDocumentChange: vi.fn(), onNav: vi.fn(), evaluations: [], aiData: {} as never, chat: [], onChatChange: vi.fn(),
    ...extra,
  };
  render(<I18nProvider><ToastProvider><Notebook {...(props as unknown as ComponentProps<typeof Notebook>)} /></ToastProvider></I18nProvider>);
  return props;
}
const fila = (nombre: string, tabla: HTMLElement) => within(tabla).getByText(nombre).closest('tr') as HTMLElement;
const tablaDeNotas = () => screen.getAllByRole('table').filter(t => t.classList.contains('gb-table')).pop() as HTMLElement;

describe('Cuaderno por evaluaciones', () => {
  it('se abre en la evaluación de hoy y enseña solo sus actividades, con su nota', () => {
    pinta();
    expect(screen.getByRole('button', { name: '2ª evaluación (la de hoy)' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Examen de invierno')).toBeTruthy();
    expect(screen.queryByText('Dictado de otoño')).toBeNull();
    // Alumno 1: 8 y 8 en el segundo trimestre; el 4 del primero no cuenta aquí
    expect(within(fila('Alumno 1', tablaDeNotas())).getByText('8,0')).toBeTruthy();
  });

  it('en la 1.ª salen las del primer trimestre', () => {
    pinta();
    fireEvent.click(screen.getByRole('button', { name: '1ª evaluación' }));
    expect(screen.getByText('Dictado de otoño')).toBeTruthy();
    expect(screen.queryByText('Examen de invierno')).toBeNull();
    expect(within(fila('Alumno 1', tablaDeNotas())).getByText('4,0')).toBeTruthy();
  });

  it('una evaluación sin actividades lo dice y ofrece ver todo el curso', () => {
    pinta();
    fireEvent.click(screen.getByRole('button', { name: '3ª evaluación' }));
    expect(screen.getByText('No hay actividades en la 3.ª evaluación.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todo el curso' }));
    expect(screen.getByRole('button', { name: 'Final de curso' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('«Curso» enseña la nota de cada evaluación y la final, de entrada con evaluación continua', () => {
    pinta();
    fireEvent.click(screen.getByRole('button', { name: 'Final de curso' }));
    const tabla = screen.getAllByRole('table')[0];
    // 1.ª: 4; 2.ª: 8; continua: el 4 al 70 y al 30, y dos ochos sin peso (un cuarto cada uno) → (4·70 + 4·30 + 8·25 + 8·25) / 150
    const celdas = within(fila('Alumno 1', tabla)).getAllByRole('cell').map(c => c.textContent);
    expect(celdas).toEqual(['Alumno 1', '4,0', '8,0', '—', '5,3']);
    expect(screen.getByRole('button', { name: 'Evaluación continua' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('con la media de las evaluaciones, la final es la media de las dos que tienen nota', () => {
    const conMedia = { 'c1|Lengua': { ...DEFAULT_BLOCK, enabled: false, final: { modo: 'media' as const, pesos: [1, 1, 1] } } };
    pinta({ marksConfigs: conMedia });
    fireEvent.click(screen.getByRole('button', { name: 'Final de curso' }));
    const celdas = within(fila('Alumno 1', screen.getAllByRole('table')[0])).getAllByRole('cell').map(c => c.textContent);
    expect(celdas).toEqual(['Alumno 1', '4,0', '8,0', '—', '6,0']);
    expect(screen.getByText('La 3ª evaluación aún no tiene notas: la final es provisional y sale de las demás.')).toBeTruthy();
  });

  it('elegir la regla la guarda en la clase y la asignatura sin tocar el resto de su configuración', () => {
    const p = pinta();
    fireEvent.click(screen.getByRole('button', { name: 'Final de curso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Media de las evaluaciones' }));
    expect(p.onSaveMarksConfig).toHaveBeenCalledWith('c1', 'Lengua', expect.objectContaining({ enabled: false, points: 1, final: { modo: 'media', pesos: [1, 1, 1] } }));
  });

  it('«Usar esta regla en todas mis clases» la lleva a las demás', () => {
    const conMedia = { 'c1|Lengua': { ...DEFAULT_BLOCK, enabled: false, final: { modo: 'media' as const, pesos: [20, 30, 50] } } };
    const p = pinta({ marksConfigs: conMedia });
    fireEvent.click(screen.getByRole('button', { name: 'Final de curso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta regla en todas mis clases' }));
    expect(p.onSaveMarksConfig).toHaveBeenCalledTimes(1);
    expect(p.onSaveMarksConfig).toHaveBeenCalledWith('c2', 'Lengua', expect.objectContaining({ final: { modo: 'media', pesos: [20, 30, 50] } }));
  });

  it('una actividad nueva lleva un día de la evaluación que se está viendo', () => {
    const p = pinta();
    fireEvent.click(screen.getByRole('button', { name: '1ª evaluación' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Añadir nota' })[0]);
    expect((document.getElementById('notebook-f5') as HTMLInputElement).value).toBe('2026-12-31');
    expect(screen.getByText('Por su fecha, cuenta en la 1.ª evaluación.')).toBeTruthy();
    fireEvent.change(document.getElementById('notebook-f3') as HTMLInputElement, { target: { value: 'Recuperación' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' }).find(b => b.closest('.modal-overlay.open'))!);
    expect(p.onAddItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Recuperación', date: '2026-12-31', category_id: 'k1' }));
  });

  it('guardar una categoría no borra el peso de las notas de otras evaluaciones', () => {
    const p = pinta();
    // Se está viendo la 2.ª: las notas del primer trimestre (70 y 30) no salen en la ficha y no se tocan
    fireEvent.click(screen.getByTitle('Editar categoría'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' }).find(b => b.closest('.modal-overlay.open'))!);
    expect(p.onUpdateCategory).toHaveBeenCalledWith(expect.objectContaining({ id: 'k1' }));
    expect(p.onUpdateItem).not.toHaveBeenCalled();
  });
});
