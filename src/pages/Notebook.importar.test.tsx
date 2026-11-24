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

function pinta(extra: { gradeCategories?: GradeCategory[] } = {}) {
  const props = {
    classes: [clase], students: alumnos, gradeCategories: extra.gradeCategories ?? categorias, gradeItems: actividades, grades: notas, classMarks: [], marksConfigs: sinBloque,
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

/** Arrastra un archivo sobre la ventana y lo suelta, como el navegador: con `types` que dice que trae archivos. */
const soltar = (archivos: File[], donde: Element | Window = window) => {
  const dataTransfer = { types: ['Files'], files: archivos, dropEffect: 'none' };
  fireEvent.dragEnter(donde, { dataTransfer });
  fireEvent.dragOver(donde, { dataTransfer });
  fireEvent.drop(donde, { dataTransfer });
};
const csv = 'Alumno;Examen de invierno\nRuiz Mora, Ana;9\n';

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

  it('el botón abre su propia ventana, con la zona para soltar y «Elegir archivo»', () => {
    pinta();
    fireEvent.click(screen.getByRole('button', { name: /Importar notas/ }));
    const v = ventana();
    expect(within(v).getByText('Importar notas de 5.º A')).toBeTruthy();
    expect(within(v).getByRole('button', { name: /Arrastra aquí tu archivo/ })).toBeTruthy();
    expect(within(v).getByRole('button', { name: /Elegir archivo/ })).toBeTruthy();
  });

  it('soltar el archivo en cualquier sitio del cuaderno lo abre, sin la ventana del botón', async () => {
    const p = pinta();
    const dataTransfer = { types: ['Files'], files: [], dropEffect: 'none' };
    fireEvent.dragEnter(window, { dataTransfer });
    expect(screen.getByText('Suelta el archivo para importar las notas de 5.º A')).toBeTruthy();
    soltar([new File([csv], 'notas.csv')], document.querySelector('.gb-cell') ?? window);
    await waitFor(() => expect(within(ventana()).getByText('Importar notas de un archivo')).toBeTruthy());
    expect(screen.queryByText('Suelta el archivo para importar las notas de 5.º A')).toBeNull();
    expect(p.onSetGrades).not.toHaveBeenCalled();
  });

  it('soltarlo sobre la ventana de importar también lo abre', async () => {
    pinta();
    fireEvent.click(screen.getByRole('button', { name: /Importar notas/ }));
    soltar([new File([csv], 'notas.csv')], within(ventana()).getByRole('button', { name: /Arrastra aquí/ }));
    await waitFor(() => expect(within(ventana()).getByText('Importar notas de un archivo')).toBeTruthy());
  });

  it('un texto arrastrado no hace nada, y con otra ventana abierta el archivo no se mezcla con ella', async () => {
    pinta();
    const texto = { types: ['text/plain'], files: [], dropEffect: 'none' };
    fireEvent.dragEnter(window, { dataTransfer: texto });
    expect(screen.queryByText(/Suelta el archivo/)).toBeNull();
    // El menú de una actividad abierto encima
    fireEvent.click(screen.getByRole('button', { name: /Examen de invierno/ }));
    soltar([new File([csv], 'notas.csv')]);
    await waitFor(() => expect(screen.getByText(/Cierra la ventana que tienes abierta/)).toBeTruthy());
    expect(screen.queryByText('Importar notas de un archivo')).toBeNull();
  });

  it('sin categorías no se puede importar, y se dice por qué', async () => {
    pinta({ gradeCategories: [] });
    expect((screen.getByRole('button', { name: /Importar notas/ }) as HTMLButtonElement).disabled).toBe(true);
    soltar([new File([csv], 'notas.csv')]);
    await waitFor(() => expect(screen.getAllByText(/elige antes cómo evalúas en esta clase/).length).toBeGreaterThan(0));
    expect(screen.queryByText('Importar notas de un archivo')).toBeNull();
  });

  it('con varios archivos se abre el primero y se avisa', async () => {
    pinta();
    soltar([new File([csv], 'primero.csv'), new File([csv], 'segundo.csv')]);
    await waitFor(() => expect(screen.getByText(/se abre «primero.csv»/)).toBeTruthy());
    await waitFor(() => expect(within(ventana()).getByText(/«primero.csv»/)).toBeTruthy());
  });
});
