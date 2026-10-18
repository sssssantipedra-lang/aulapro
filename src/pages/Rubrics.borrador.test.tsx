// @vitest-environment jsdom
/**
 * Rúbricas · autoguardado: si la ventana se cierra con una rúbrica a medias,
 * la pantalla ofrece continuarla (también en la sesión siguiente); al
 * guardarla de verdad, el aviso desaparece.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Rubrics } from './Rubrics';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { leerBorrador } from '../services/borradores';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function pinta(onAddRubric = vi.fn(), vista: 'rubrics' | 'dianas' = 'rubrics') {
  const props = {
    rubrics: [], dianas: [], evaluations: [], classes: [], students: [], gradeCategories: [], lawDocument: null,
    onAddRubric, onUpdateRubric: () => {}, onDeleteRubric: () => {}, onAddDiana: () => {}, onUpdateDiana: () => {}, onDeleteDiana: () => {}, onAddEvaluation: () => {},
  };
  const r = render(<I18nProvider><ToastProvider><Rubrics {...props} vista={vista} /></ToastProvider></I18nProvider>);
  return { ...r, onAddRubric };
}

describe('Rúbricas · autoguardado', () => {
  it('cerrar la ventana a medias no pierde nada: se ofrece continuar y se guarda al terminar', async () => {
    const user = userEvent.setup();
    const { onAddRubric } = pinta();
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    await user.click(screen.getByRole('button', { name: 'Manual' }));
    await user.type(screen.getByLabelText('Nombre de la rúbrica *'), 'Exposición oral');
    await user.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);

    // Aviso en la pantalla, sin haber salido de ella
    expect(screen.getByText(/Te quedó una rúbrica sin guardar: «Exposición oral»/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((screen.getByLabelText('Nombre de la rúbrica *') as HTMLInputElement).value).toBe('Exposición oral');
    expect(screen.queryByText(/Te quedó una rúbrica sin guardar/)).toBeNull();

    // Un criterio y a guardar: el borrador se va
    await user.type(screen.getByPlaceholderText(/Nombre del criterio|Criterio/i), 'Claridad');
    const guardar = screen.getByRole('button', { name: 'Crear rúbrica' });
    await user.click(guardar);
    expect(onAddRubric).toHaveBeenCalledOnce();
    expect(leerBorrador('rubrica')).toBeNull();
    expect(screen.queryByText(/Te quedó una rúbrica sin guardar/)).toBeNull();
  });

  it('al volver a la pantalla otro día, el aviso sigue ahí y se puede descartar', async () => {
    const user = userEvent.setup();
    const a = pinta();
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    await user.click(screen.getByRole('button', { name: 'Manual' }));
    await user.type(screen.getByLabelText('Nombre de la rúbrica *'), 'Debate');
    a.unmount();
    expect(leerBorrador<{ manualName: string }>('rubrica')?.datos.manualName).toBe('Debate');

    pinta();
    expect(screen.getByText(/Te quedó una rúbrica sin guardar: «Debate»/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.queryByText(/Te quedó una rúbrica sin guardar/)).toBeNull();
    expect(leerBorrador('rubrica')).toBeNull();
  });
});

describe('Dianas · autoguardado', () => {
  it('cerrar la ventana a medias no pierde la diana: se ofrece continuarla', async () => {
    const user = userEvent.setup();
    pinta(vi.fn(), 'dianas');
    await user.click(screen.getByRole('button', { name: /Nueva diana/ }));
    const ventana = within(document.querySelector('.modal-overlay.open') as HTMLElement);
    await user.click(ventana.getByRole('button', { name: 'Manual' }));
    await user.type(ventana.getByLabelText('Nombre de la diana *'), 'Trabajo en equipo');
    await user.click(ventana.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByText(/Te quedó una diana sin guardar: «Trabajo en equipo»/)).toBeTruthy();
    expect(leerBorrador('diana')).toBeNull(); // aún no ha pasado la espera: se guarda al salir
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((screen.getByLabelText('Nombre de la diana *') as HTMLInputElement).value).toBe('Trabajo en equipo');
  });
});
