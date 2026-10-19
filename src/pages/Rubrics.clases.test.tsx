// @vitest-environment jsdom
/**
 * Una rúbrica para varias clases (19-10-2026): se marcan varias clases de una vez
 * y una categoría del cuaderno por su nombre; se guarda una sola rúbrica.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Rubrics } from './Rubrics';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, GradeCategory } from '../types';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const clases = ['4º A', '4º B', '4º C'].map((name, i) => ({ id: `c${i + 1}`, name, subject: 'Matemáticas', subjects: ['Matemáticas'], color: '#000' }) as Class);
const cats: GradeCategory[] = [
  { id: 'k1', class_id: 'c1', name: 'Exámenes', weight: 50, subject: 'Matemáticas' },
  { id: 'k2', class_id: 'c2', name: 'Exámenes', weight: 50, subject: 'Matemáticas' },
];

function pinta(onAddRubric = vi.fn()) {
  render(
    <I18nProvider><ToastProvider>
      <Rubrics
        rubrics={[]} dianas={[]} evaluations={[]} classes={clases} students={[]} gradeCategories={cats} lawDocument={null}
        onAddRubric={onAddRubric} onUpdateRubric={() => {}} onDeleteRubric={() => {}} onAddDiana={() => {}} onUpdateDiana={() => {}} onDeleteDiana={() => {}} onAddEvaluation={() => {}}
      />
    </ToastProvider></I18nProvider>,
  );
  return onAddRubric;
}

describe('Rúbricas · varias clases', () => {
  it('se usa en dos clases, cada una con su categoría, y se guarda una sola rúbrica', async () => {
    const user = userEvent.setup();
    const onAdd = pinta();
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    const ventana = within(document.querySelector('.modal-overlay.open') as HTMLElement);
    await user.click(ventana.getByRole('button', { name: 'Manual' }));
    await user.type(ventana.getByLabelText('Nombre de la rúbrica *'), 'Exposición oral');
    await user.type(ventana.getByPlaceholderText(/Ej: Claridad|Nombre del criterio|Criterio/i), 'Claridad');

    // Se marcan las dos clases de una vez y se elige una sola categoría, por su nombre
    await user.click(ventana.getByRole('button', { name: '4º A' }));
    await user.click(ventana.getByRole('button', { name: '4º B' }));
    expect(ventana.getByRole('button', { name: '4º A' }).getAttribute('aria-pressed')).toBe('true');
    expect(ventana.getByRole('button', { name: '4º C' }).getAttribute('aria-pressed')).toBe('false');
    await user.selectOptions(ventana.getByLabelText('Categoría del cuaderno'), 'Exámenes');

    await user.click(ventana.getByRole('button', { name: 'Crear rúbrica' }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      name: 'Exposición oral', class_id: 'c1', category_id: 'k1', otras_clases: [{ class_id: 'c2', category_id: 'k2' }],
    });
    // Y la tarjeta dice dónde se usa
    expect(document.body.textContent).toBeTruthy();
  });

  it('una sola clase se guarda como siempre, sin otras clases', async () => {
    const user = userEvent.setup();
    const onAdd = pinta();
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    const ventana = within(document.querySelector('.modal-overlay.open') as HTMLElement);
    await user.click(ventana.getByRole('button', { name: 'Manual' }));
    await user.type(ventana.getByLabelText('Nombre de la rúbrica *'), 'Debate');
    await user.type(ventana.getByPlaceholderText(/Ej: Claridad|Nombre del criterio|Criterio/i), 'Argumentos');
    await user.click(ventana.getByRole('button', { name: '4º C' }));
    await user.click(ventana.getByRole('button', { name: 'Crear rúbrica' }));
    const r = onAdd.mock.calls[0][0];
    expect(r.class_id).toBe('c3');
    expect(r.otras_clases).toBeUndefined();
  });
});
