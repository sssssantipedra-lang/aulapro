// @vitest-environment jsdom
/**
 * Importar notas de un archivo (24-11-2026): el botón «Importar notas» del cuaderno lee un CSV o un Excel, se elige a
 * qué actividad va cada columna (una que existe, una nueva o ninguna) y, en la vista previa de siempre, cada nota va al
 * alumno que se llama así. Nada se escribe hasta aceptar. La lógica se prueba en `lib/importarNotas.test.ts`.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { Notebook } from './Notebook';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { DEFAULT_BLOCK } from '../services/classMarks';
import type { Class, GradeCategory, GradeItem, GradeMap, MarksBlockConfig, Student } from '../types';

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2027, 1, 10, 10)); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const clase = { id: 'c1', name: '5.º A', subject: 'Lengua', subjects: ['Lengua'], room: '', color: '#0284c7' } as Class;
const alumnos = ['Ana Ruiz Mora', 'Marcos Gil Soler', 'Lucía Pérez Navarro'].map((name, k) => ({ id: `s${k}`, class_id: 'c1', name, email: '', photo: null, alerts: [], notes: '' }) as Student);
const categorias: GradeCategory[] = [{ id: 'k1', class_id: 'c1', name: 'Pruebas', weight: 100, subject: 'Lengua' }];
const actividades: GradeItem[] = [{ id: 'i2', class_id: 'c1', category_id: 'k1', name: 'Examen de invierno', date: '2027-02-03' }];
const notas: GradeMap = { i2: { s0: 5 } };
const sinBloque: Record<string, MarksBlockConfig> = { 'c1|Lengua': { ...DEFAULT_BLOCK, enabled: false } };

function pinta() {
  const props = {
    classes: [clase], students: alumnos, gradeCategories: categorias, gradeItems: actividades, grades: notas, classMarks: [], marksConfigs: sinBloque,
    onSaveMarksConfig: vi.fn(), onAddCategory: vi.fn(), onUpdateCategory: vi.fn(), onDeleteCategory: vi.fn(),
    onAddItem: vi.fn(), onUpdateItem: vi.fn(), onDeleteItem: vi.fn(), onSetGrade: vi.fn(), onSetGrades: vi.fn(),
    lawDocument: null, onLawDocumentChange: vi.fn(), onNav: vi.fn(), evaluations: [], aiData: {} as never, chat: [], onChatChange: vi.fn(),
  };
  render(<I18nProvider><ToastProvider><Notebook {...(props as unknown as ComponentProps<typeof Notebook>)} /></ToastProvider></I18nProvider>);
  return props;
}
const ventana = () => screen.getAllByRole('dialog').filter(d => d.closest('.modal-overlay.open')).pop() as HTMLElement;
const subir = (texto: string, nombre = 'notas.csv') => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File([texto], nombre)] } });
};

describe('importar notas de un archivo', () => {
  it('lleva cada columna a su actividad (la que existe y una nueva) y cada nota a su alumno por el nombre', async () => {
    const p = pinta();
    expect(screen.getByRole('button', { name: /Importar notas/ })).toBeTruthy();
    // Listado oficial, por apellido: no está en el orden de la lista del cuaderno
    subir('Alumno;Examen de invierno;Redacción\nGil Soler, Marcos;4;6,5\nPérez Navarro, Lucía;8;7\nRuiz Mora, Ana;9;10\n');
    await waitFor(() => expect(within(ventana()).getByText('Importar notas de un archivo')).toBeTruthy());
    const elegir = ventana();
    expect((within(elegir).getByRole('combobox', { name: /Examen de invierno/ }) as HTMLSelectElement).value).toBe('i2');
    expect((within(elegir).getByRole('combobox', { name: /Redacción/ }) as HTMLSelectElement).value).toBe('nueva');
    expect(p.onSetGrades).not.toHaveBeenCalled();
    fireEvent.click(within(elegir).getByRole('button', { name: 'Ver cómo quedan' }));

    const previa = ventana();
    expect(within(previa).getByText(/Cada columna va a la actividad que has elegido/)).toBeTruthy();
    fireEvent.click(within(previa).getByRole('button', { name: 'Poner 6 notas' }));
    expect(p.onAddItem).toHaveBeenCalledTimes(1);
    const nueva = p.onAddItem.mock.calls[0][0] as GradeItem;
    expect(nueva).toMatchObject({ class_id: 'c1', category_id: 'k1', name: 'Redacción' });
    const [cambios] = p.onSetGrades.mock.calls[0] as [{ itemId: string; studentId: string; value: number }[]];
    const de = (item: string, alumno: string) => cambios.find(c => c.itemId === item && c.studentId === alumno)?.value;
    expect([de('i2', 's0'), de('i2', 's1'), de('i2', 's2')]).toEqual([9, 4, 8]);
    expect([de(nueva.id, 's0'), de(nueva.id, 's1'), de(nueva.id, 's2')]).toEqual([10, 6.5, 7]);
  });

  it('cancelar no cambia nada, y un archivo que no es una hoja se rechaza', async () => {
    const p = pinta();
    subir('Alumno;Examen de invierno\nRuiz Mora, Ana;9\n');
    await waitFor(() => expect(within(ventana()).getByText('Importar notas de un archivo')).toBeTruthy());
    fireEvent.click(within(ventana()).getByRole('button', { name: 'Cancelar' }));
    expect(p.onSetGrades).not.toHaveBeenCalled();
    expect(p.onAddItem).not.toHaveBeenCalled();
    subir('hola', 'notas.pdf');
    await waitFor(() => expect(screen.getByText(/no es una hoja de cálculo/)).toBeTruthy());
  });
});
