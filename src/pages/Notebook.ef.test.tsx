// @vitest-environment jsdom
/**
 * Cuaderno de Educación Física: una clase de EF sin categorías ofrece sus tres
 * componentes de partida (motriz, cognitivo, social y relacional), y el título
 * del bloque de anotaciones se puede renombrar.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Notebook } from './Notebook';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, GradeCategory, Student } from '../types';

afterEach(cleanup);

const clase = (id: string, name: string, subject: string) => ({ id, name, subject, subjects: [subject], room: '', color: '#0284c7' }) as Class;
const alumno = { id: 's1', class_id: 'c1', name: 'Alumno 1', email: '', photo: null, alerts: [], notes: '' } as Student;

function pinta(c: Class, gradeCategories: GradeCategory[] = [], extra: Record<string, unknown> = {}) {
  const props = {
    classes: [c], students: [{ ...alumno, class_id: c.id }], gradeCategories, gradeItems: [], grades: {}, classMarks: [], marksConfigs: {},
    onSaveMarksConfig: vi.fn(), onAddCategory: vi.fn(), onUpdateCategory: vi.fn(), onDeleteCategory: vi.fn(),
    onAddItem: vi.fn(), onUpdateItem: vi.fn(), onDeleteItem: vi.fn(), onSetGrade: vi.fn(),
    lawDocument: null, onLawDocumentChange: vi.fn(), onNav: vi.fn(), evaluations: [], aiData: {} as never, chat: [], onChatChange: vi.fn(),
    ...extra,
  };
  render(<I18nProvider><ToastProvider><Notebook {...(props as never)} /></ToastProvider></I18nProvider>);
  return props;
}

describe('Cuaderno · Educación Física', () => {
  it('ofrece los tres componentes y los crea con su peso', async () => {
    const user = userEvent.setup();
    const p = pinta(clase('c1', '4º A', 'Educación Física'));
    await user.click(screen.getByRole('button', { name: /Usar los 3 componentes de Educación Física/ }));
    expect(p.onAddCategory.mock.calls.map(c => [c[0].name, c[0].weight, c[0].subject])).toEqual([
      ['Componente motriz', 40, 'Educación Física'],
      ['Componente cognitivo', 30, 'Educación Física'],
      ['Componente social y relacional', 30, 'Educación Física'],
    ]);
  });

  it('en otras asignaturas, solo la configuración de siempre', () => {
    pinta(clase('c1', '4º A', 'Matemáticas'));
    expect(screen.queryByRole('button', { name: /componentes de Educación Física/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Usar configuración típica/ })).toBeTruthy();
  });

  it('cada componente se renombra y se reajusta desde su propia ficha', async () => {
    const user = userEvent.setup();
    const cats: GradeCategory[] = [{ id: 'k1', class_id: 'c1', name: 'Componente motriz', weight: 100, subject: 'Educación Física' }];
    const p = pinta(clase('c1', '4º A', 'Educación Física'), cats);
    await user.click(screen.getByTitle('Editar categoría'));
    const nombre = screen.getByLabelText('Nombre', { selector: '#notebook-f1' });
    await user.clear(nombre);
    await user.type(nombre, 'Habilidades motrices');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(p.onUpdateCategory).toHaveBeenCalledWith(expect.objectContaining({ id: 'k1', name: 'Habilidades motrices', weight: 100 }));
  });
});
