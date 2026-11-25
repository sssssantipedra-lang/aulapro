// @vitest-environment jsdom
/**
 * El cuaderno como una hoja de cálculo (22-11-2026): pegar un bloque pasa siempre por la vista previa y solo
 * escribe en las actividades de la evaluación que se ve; el menú de la columna pone una nota a quien no tiene; y
 * las flechas a los lados pasan de actividad. La lógica de leer lo pegado se prueba en `lib/pegarNotas.test.ts`.
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
const alumnos = [1, 2, 3].map(n => ({ id: `s${n}`, class_id: 'c1', name: `Alumno ${n}`, email: '', photo: null, alerts: [], notes: '' }) as Student);
const categorias: GradeCategory[] = [{ id: 'k1', class_id: 'c1', name: 'Pruebas', weight: 100, subject: 'Lengua' }];
const actividades: GradeItem[] = [
  { id: 'i1', class_id: 'c1', category_id: 'k1', name: 'Dictado de otoño', date: '2026-10-20' },
  { id: 'i2', class_id: 'c1', category_id: 'k1', name: 'Examen de invierno', date: '2027-02-03' },
  { id: 'i2b', class_id: 'c1', category_id: 'k1', name: 'Redacción de invierno', date: '2027-02-08' },
];
const notas: GradeMap = { i1: { s1: 4, s2: 6, s3: 5 }, i2: { s1: 8, s2: 6 }, i2b: { s1: 8 } };
const sinBloque: Record<string, MarksBlockConfig> = { 'c1|Lengua': { ...DEFAULT_BLOCK, enabled: false } };

function pinta(extra: Record<string, unknown> = {}) {
  const props = {
    classes: [clase], students: alumnos, gradeCategories: categorias, gradeItems: actividades, grades: notas, classMarks: [], marksConfigs: sinBloque,
    onSaveMarksConfig: vi.fn(), onAddCategory: vi.fn(), onUpdateCategory: vi.fn(), onDeleteCategory: vi.fn(),
    onAddItem: vi.fn(), onUpdateItem: vi.fn(), onDeleteItem: vi.fn(), onSetGrade: vi.fn(), onSetGrades: vi.fn(),
    lawDocument: null, onLawDocumentChange: vi.fn(), onNav: vi.fn(), evaluations: [], aiData: {} as never, chat: [], onChatChange: vi.fn(),
    ...extra,
  };
  render(<I18nProvider><ToastProvider><Notebook {...(props as unknown as ComponentProps<typeof Notebook>)} /></ToastProvider></I18nProvider>);
  return props;
}
/** La celda de un alumno en una actividad de la tabla. */
const celda = (item: string, alumno: string) => document.querySelector<HTMLInputElement>(`input.gb-cell[data-item="${item}"][data-alumno="${alumno}"]`)!;
const pegar = (donde: HTMLElement, texto: string) => fireEvent.paste(donde, { clipboardData: { getData: () => texto } });
const ventana = () => screen.getAllByRole('dialog').filter(d => d.closest('.modal-overlay.open')).pop() as HTMLElement;
/** Sin nombres en la hoja, hay que confirmar el orden antes de poner nada. */
const confirmarOrden = (previa: HTMLElement) => fireEvent.click(within(previa).getByRole('checkbox', { name: /mismo orden que la lista/ }));

describe('pegar un bloque de una hoja de cálculo', () => {
  it('no escribe nada hasta aplicar la vista previa, y casa por posición hacia abajo y a la derecha', () => {
    const p = pinta();
    pegar(celda('i2', 's2'), '7,5\t9\r\n6.25\tNP\r\n');
    expect(p.onSetGrades).not.toHaveBeenCalled();
    expect(p.onSetGrade).not.toHaveBeenCalled();
    const previa = ventana();
    expect(within(previa).getByText(/la primera fila va a Alumno 2/)).toBeTruthy();
    // «NP» se señala y no entra
    expect(within(previa).getByText('NP').className).toContain('pn-mal');
    // Sin nombres, se coloca por orden de lista: hasta confirmarlo no se puede poner nada
    expect(within(previa).getByText(/Tu hoja no trae los nombres/)).toBeTruthy();
    expect((within(previa).getByRole('button', { name: 'Poner 3 notas' }) as HTMLButtonElement).disabled).toBe(true);
    confirmarOrden(previa);
    fireEvent.click(within(previa).getByRole('button', { name: 'Poner 3 notas' }));
    expect(p.onSetGrades).toHaveBeenCalledWith([
      { itemId: 'i2', studentId: 's2', value: 7.5 },
      { itemId: 'i2b', studentId: 's2', value: 9 },
      { itemId: 'i2', studentId: 's3', value: 6.25 },
    ], 'pegar');
  });

  it('solo llega a las actividades de la evaluación que se ve, y dice lo que sobra', () => {
    const p = pinta();
    // Desde la última columna de la 2.ª evaluación: la segunda columna pegada no tiene dónde ir
    pegar(celda('i2b', 's1'), '1\t2\n3\t4\n5\t6\n7\t8');
    const previa = ventana();
    expect(within(previa).getByText(/Sobra 1 columna/)).toBeTruthy();
    expect(within(previa).getByText(/Sobra 1 fila/)).toBeTruthy();
    confirmarOrden(previa);
    fireEvent.click(within(previa).getByRole('button', { name: 'Poner 3 notas' }));
    const [cambios] = p.onSetGrades.mock.calls[0] as [{ itemId: string }[]];
    expect(new Set(cambios.map(c => c.itemId))).toEqual(new Set(['i2b']));
  });

  it('con la vista previa abierta el foco sale de la celda: lo que se teclee no cae en el cuaderno de debajo', () => {
    pinta();
    const origen = celda('i2', 's1');
    origen.focus();
    expect(document.activeElement).toBe(origen);
    pegar(origen, '1\n2');
    // Antes el foco seguía en la celda: un Intro para aceptar o una cifra cambiaban notas por detrás de la ventana
    expect(document.activeElement).not.toBe(origen);
    expect(ventana().contains(document.activeElement)).toBe(true);
    // Y al cancelar vuelve a la celda donde se pegó
    fireEvent.click(within(ventana()).getByRole('button', { name: 'Cancelar' }));
    expect(document.activeElement).toBe(origen);
  });

  it('cancelar no cambia nada, y una sola celda se pega como siempre', () => {
    const p = pinta();
    pegar(celda('i2', 's1'), '1\n2');
    fireEvent.click(within(ventana()).getByRole('button', { name: 'Cancelar' }));
    expect(p.onSetGrades).not.toHaveBeenCalled();
    expect(document.querySelector('.pn-previa')).toBeNull();
    pegar(celda('i2', 's1'), '9\r\n');
    expect(document.querySelector('.pn-previa')).toBeNull();
  });
});

describe('el menú de la columna', () => {
  it('pone una nota a quien no tiene, sin tocar las que ya están', () => {
    const p = pinta();
    fireEvent.click(screen.getByRole('button', { name: /Examen de invierno/ }));
    const menu = ventana();
    expect(within(menu).getByText(/Sin nota: Alumno 3\./)).toBeTruthy();
    const casilla = within(menu).getByPlaceholderText('Nota');
    fireEvent.change(casilla, { target: { value: '12' } });
    fireEvent.click(within(menu).getByRole('button', { name: 'Poner a 1 alumno' }));
    expect(p.onSetGrades).not.toHaveBeenCalled();
    expect(within(menu).getByText('Escribe una nota de 0 a 10.')).toBeTruthy();
    fireEvent.change(casilla, { target: { value: '5,5' } });
    fireEvent.click(within(menu).getByRole('button', { name: 'Poner a 1 alumno' }));
    expect(p.onSetGrades).toHaveBeenCalledWith([{ itemId: 'i2', studentId: 's3', value: 5.5 }], 'rellenar');
  });

  it('sigue llevando a editar la actividad y abre la lista de «Calificar esta actividad»', () => {
    const p = pinta();
    fireEvent.click(screen.getByRole('button', { name: /Redacción de invierno/ }));
    fireEvent.click(within(ventana()).getByRole('button', { name: /Editar o eliminar esta actividad/ }));
    expect(within(ventana()).getByText('Editar nota')).toBeTruthy();
    fireEvent.click(within(ventana()).getByRole('button', { name: 'Cerrar' }));

    fireEvent.click(screen.getByRole('button', { name: /Redacción de invierno/ }));
    fireEvent.click(within(ventana()).getByRole('button', { name: /Calificar esta actividad/ }));
    const lista = ventana();
    expect(within(lista).getByText('de 3 con nota')).toBeTruthy();
    const casillas = lista.querySelectorAll<HTMLInputElement>('input.pn-cal-nota');
    expect(casillas).toHaveLength(3);
    // El foco va al primer alumno sin nota, y la casilla pide «Siguiente» al teclado
    expect(document.activeElement).toBe(casillas[1]);
    expect(casillas[1].getAttribute('enterkeyhint')).toBe('next');
    expect(casillas[2].getAttribute('enterkeyhint')).toBe('done');
    fireEvent.change(casillas[1], { target: { value: '7' } });
    fireEvent.keyDown(casillas[1], { key: 'Enter' });
    expect(document.activeElement).toBe(casillas[2]);
    fireEvent.blur(casillas[1]);
    expect(p.onSetGrade).toHaveBeenCalledWith('i2b', 's2', 7);
    // Lo que no es una nota se queda señalado y no se guarda
    fireEvent.change(casillas[2], { target: { value: 'NP' } });
    fireEvent.blur(casillas[2]);
    expect(p.onSetGrade).toHaveBeenCalledTimes(1);
    expect(within(lista).getByText('No es una nota de 0 a 10: no se ha guardado.')).toBeTruthy();
  });
});

describe('la lista de «Calificar esta actividad» no pierde lo escrito al cerrarse', () => {
  function abreLista() {
    fireEvent.click(screen.getByRole('button', { name: /Redacción de invierno/ }));
    fireEvent.click(within(ventana()).getByRole('button', { name: /Calificar esta actividad/ }));
    return ventana().querySelectorAll<HTMLInputElement>('input.pn-cal-nota');
  }

  it('el botón de atrás del móvil la cierra tocando el fondo, sin que la casilla pierda el foco: la nota se guarda', () => {
    const p = pinta();
    const casillas = abreLista();
    fireEvent.change(casillas[1], { target: { value: '6,5' } });
    // Así la cierra `cerrarLoAbierto` (lib/loAbierto.ts): un clic en el fondo, sin blur
    fireEvent.click(document.querySelector('.pn-cal-fondo')!);
    expect(document.querySelector('.pn-cal')).toBeNull();
    expect(p.onSetGrade).toHaveBeenCalledTimes(1);
    expect(p.onSetGrade).toHaveBeenCalledWith('i2b', 's2', 6.5);
  });

  it('«Hecho» sin salir de la casilla (como en el iPhone) también guarda, y una sola vez si la casilla ya había guardado', () => {
    const p = pinta();
    let casillas = abreLista();
    fireEvent.change(casillas[2], { target: { value: '9' } });
    fireEvent.click(within(ventana()).getByRole('button', { name: 'Hecho' }));
    expect(p.onSetGrade).toHaveBeenCalledTimes(1);
    expect(p.onSetGrade).toHaveBeenCalledWith('i2b', 's3', 9);
    // Con el foco fuera antes de cerrar (lo normal en un ordenador), no se guarda dos veces
    casillas = abreLista();
    fireEvent.change(casillas[1], { target: { value: '4' } });
    fireEvent.blur(casillas[1]);
    fireEvent.click(within(ventana()).getByRole('button', { name: 'Hecho' }));
    expect(p.onSetGrade).toHaveBeenCalledTimes(2);
    expect(p.onSetGrade).toHaveBeenLastCalledWith('i2b', 's2', 4);
  });

  it('lo que no es una nota, o lo deshecho con Escape, no se guarda al cerrar', () => {
    const p = pinta();
    const casillas = abreLista();
    fireEvent.change(casillas[1], { target: { value: 'NP' } });
    fireEvent.change(casillas[2], { target: { value: '3' } });
    fireEvent.keyDown(casillas[2], { key: 'Escape' });
    fireEvent.click(within(ventana()).getByRole('button', { name: 'Hecho' }));
    expect(p.onSetGrade).not.toHaveBeenCalled();
  });

  it('al pasar a otra actividad con el desplegable, lo escrito va a la actividad en la que se escribió', () => {
    const p = pinta();
    const casillas = abreLista();
    fireEvent.change(casillas[1], { target: { value: '7' } });
    fireEvent.change(within(ventana()).getByRole('combobox', { name: 'Actividad' }), { target: { value: 'i2' } });
    expect(p.onSetGrade).toHaveBeenCalledTimes(1);
    expect(p.onSetGrade).toHaveBeenCalledWith('i2b', 's2', 7);
  });
});

describe('pegar con los nombres de la hoja (24-11-2026)', () => {
  it('cada nota va al alumno que se llama así aunque la hoja venga en otro orden', () => {
    const p = pinta();
    pegar(celda('i2', 's1'), 'Alumno\tExamen\nAlumno 3\t7\nalumno 1\t9,5\nALUMNO 2\t5');
    const previa = ventana();
    expect(within(previa).getByText(/Cada nota va al alumno que se llama así/)).toBeTruthy();
    // Todo coincide: no hay nada que confirmar
    expect(within(previa).queryByRole('checkbox', { name: /He comprobado/ })).toBeNull();
    fireEvent.click(within(previa).getByRole('button', { name: 'Poner 3 notas' }));
    expect(p.onSetGrades).toHaveBeenCalledWith([
      { itemId: 'i2', studentId: 's1', value: 9.5 },
      { itemId: 'i2', studentId: 's2', value: 5 },
      { itemId: 'i2', studentId: 's3', value: 7 },
    ], 'pegar');
  });

  it('una fila que no es de nadie no entra hasta que el docente dice de quién es', () => {
    const p = pinta();
    pegar(celda('i2', 's1'), 'Alumno\tExamen\nAlumno 1\t9\nAlumna Tres\t7');
    const previa = ventana();
    expect(within(previa).getByText(/1 fila de tu hoja no se coloca/)).toBeTruthy();
    expect(within(previa).getByText('Sin colocar')).toBeTruthy();
    const elegir = within(previa).getByRole('combobox', { name: /Alumna Tres/ });
    fireEvent.change(elegir, { target: { value: 's3' } });
    expect(within(previa).getByText('elegido por ti')).toBeTruthy();
    fireEvent.click(within(previa).getByRole('button', { name: 'Poner 2 notas' }));
    expect(p.onSetGrades).toHaveBeenCalledWith([
      { itemId: 'i2', studentId: 's1', value: 9 },
      { itemId: 'i2', studentId: 's3', value: 7 },
    ], 'pegar');
  });
});

describe('la cabecera de lo pegado', () => {
  it('el primer alumno con «NP» no se toma por la cabecera: las notas no se corren una fila', () => {
    const p = pinta();
    pegar(celda('i2', 's1'), 'NP\n7\n9');
    const previa = ventana();
    // La casilla de la cabecera se ofrece, pero sin marcar
    expect((within(previa).getByRole('checkbox', { name: /cabecera/ }) as HTMLInputElement).checked).toBe(false);
    confirmarOrden(previa);
    fireEvent.click(within(previa).getByRole('button', { name: 'Poner 2 notas' }));
    expect(p.onSetGrades).toHaveBeenCalledWith([
      { itemId: 'i2', studentId: 's2', value: 7 },
      { itemId: 'i2', studentId: 's3', value: 9 },
    ], 'pegar');
  });

  it('una primera fila solo de números no se toma sola por cabecera, pero el docente puede decir que lo es (25-11-2026)', () => {
    const p = pinta();
    // La hoja numera las actividades: «1» y «2» encima de las notas de cada alumno
    pegar(celda('i2', 's1'), '1\t2\n7\t8\n9\t6');
    const previa = ventana();
    const casilla = within(previa).getByRole('checkbox', { name: /cabecera/ }) as HTMLInputElement;
    // Se ofrece sin marcar, con lo que hace si se marca
    expect(casilla.checked).toBe(false);
    expect(within(previa).getByText(/Si esa fila numera las actividades/)).toBeTruthy();
    expect(within(previa).getByRole('button', { name: 'Poner 6 notas' })).toBeTruthy();
    fireEvent.click(casilla);
    expect(casilla.checked).toBe(true);
    expect(within(previa).queryByText(/Si esa fila numera las actividades/)).toBeNull();
    // Sus números son ahora los títulos de las columnas, no notas
    expect(within(previa).getByText(/En tu hoja: 1$/)).toBeTruthy();
    expect(within(previa).getByText(/En tu hoja: 2$/)).toBeTruthy();
    confirmarOrden(previa);
    fireEvent.click(within(previa).getByRole('button', { name: 'Poner 3 notas' }));
    expect(p.onSetGrades).toHaveBeenCalledWith([
      // Alumno 1 ya tenía un 8 en «Redacción de invierno»: no cambia
      { itemId: 'i2', studentId: 's1', value: 7 },
      { itemId: 'i2', studentId: 's2', value: 9 },
      { itemId: 'i2b', studentId: 's2', value: 6 },
    ], 'pegar');
  });

  it('con una primera fila con letras no sale la explicación de los números', () => {
    pinta();
    pegar(celda('i2', 's1'), 'NP\n7\n9');
    expect(within(ventana()).queryByText(/Si esa fila numera las actividades/)).toBeNull();
  });

  it('al pegar notas de forma normal no sale la casilla de la cabecera (25-11-2026)', () => {
    // Una columna de notas sin nombres y dos columnas: la primera fila es la de Alumno 1, no una numeración
    for (const texto of ['7\n8\n9', '7\t8\n9\t6', '7,5\n8']) {
      pinta();
      pegar(celda('i2', 's1'), texto);
      expect(within(ventana()).queryByRole('checkbox', { name: /cabecera/ }), texto).toBeNull();
      expect(within(ventana()).queryByText(/Si esa fila numera las actividades/), texto).toBeNull();
      cleanup();
    }
  });

  it('un texto de varias líneas sin notas no trae nada que poner, ni avisos de orden', () => {
    pinta();
    pegar(celda('i2', 's1'), 'hola\nadiós');
    const previa = ventana();
    expect(within(previa).getByText('Lo que has pegado no trae ninguna columna de notas.')).toBeTruthy();
    expect(within(previa).queryByText(/no coinciden con el alumno/)).toBeNull();
    expect((within(previa).getByRole('button', { name: 'No hay nada que poner' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('moverse con las flechas', () => {
  it('a los lados pasan a la actividad vecina del mismo alumno', () => {
    pinta();
    const a = celda('i2', 's2');
    a.focus();
    a.select();
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(celda('i2b', 's2'));
    fireEvent.keyDown(celda('i2b', 's2'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(a);
    // En el borde de la tabla no se sale de ella
    fireEvent.keyDown(a, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(a);
  });

  it('con el cursor en medio de lo escrito, la flecha se queda en la celda', () => {
    pinta();
    const a = celda('i2', 's1');
    a.focus();
    fireEvent.change(a, { target: { value: '8,25' } });
    a.setSelectionRange(1, 1);
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(a);
  });
});
