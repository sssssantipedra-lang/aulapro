// @vitest-environment jsdom
/**
 * La distribución de la hoja en la vista previa: el selector, las páginas que ocupa y lo que cambia al
 * elegir. El compositor (medir en un marco) se sustituye por una composición de mentira.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Composicion } from '../../services/compositor';

const comp = vi.hoisted(() => ({ componerHoja: vi.fn() }));
vi.mock('../../services/compositor', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/compositor')>()), componerHoja: comp.componerHoja }));

import { FichaPreview } from './FichaPreview';
import { I18nProvider } from '../../i18n';
import type { FichaContent } from '../../services/resources';
import type { Ficha } from '../../types';

const ficha = (extra: Partial<FichaContent> = {}): Ficha => ({
  id: 'p1', at: new Date().toISOString(), date: '2026-10-15', title: 'Vista',
  request: { tema: 'Las rebajas', area: 'Matemáticas', nivel: '6º Primaria', numEjercicios: 3, niveles: false, contextoClase: '' },
  content: {
    titulo: 'Rebajas', explicacion: 'Repaso.', instrucciones: 'Resuelve.', estilo: 'cuaderno',
    actividades: [{ titulo: 'Calculamos', dificultad: 1, ejercicios: [{ tipo: 'problema', enunciado: 'Un libro cuesta 12 €.', solucion: '9 €' }] }],
    ...extra,
  },
});

const m = (paginas: number) => ({ paginas, huecos: Array.from({ length: paginas }, () => 50) });
const composicion = (densidad: Composicion['densidad'], paginas = 2): Composicion => ({
  densidad,
  medidas: { apretada: m(paginas - 1 || 1), compacta: m(paginas), normal: m(paginas), holgada: m(paginas + 1) },
});

const montar = (f: Ficha, onDensidad = vi.fn()) =>
  render(<I18nProvider><FichaPreview ficha={f} lang="es" selected={null} onSelect={() => {}} onDensidad={onDensidad} /></I18nProvider>);

beforeEach(() => { comp.componerHoja.mockReset(); });
afterEach(cleanup);

describe('«Distribución de la hoja»', () => {
  it('una hoja «Cuaderno» trae el selector, con «Automática» por defecto y las cuatro densidades', async () => {
    comp.componerHoja.mockResolvedValue(composicion('compacta'));
    montar(ficha());
    const sel = screen.getByRole('combobox', { name: /Distribución de la hoja/ }) as HTMLSelectElement;
    expect(sel.value).toBe('auto');
    expect([...sel.options].map(o => o.value)).toEqual(['auto', 'apretada', 'compacta', 'normal', 'holgada']);
    // cuando llega la medida, la automática dice cuál ha elegido y se ve cuántas páginas ocupa
    await waitFor(() => expect(screen.getByRole('option', { name: /Automática · Compacta/ })).toBeTruthy());
    expect(screen.getByText('La hoja ocupa 2 páginas')).toBeTruthy();
  });

  it('con una sola página, en singular', async () => {
    comp.componerHoja.mockResolvedValue(composicion('normal', 1));
    montar(ficha());
    await waitFor(() => expect(screen.getByText('La hoja ocupa 1 página')).toBeTruthy());
  });

  it('elegir una densidad la fija en la ficha; «Automática» la quita', async () => {
    const user = userEvent.setup();
    comp.componerHoja.mockResolvedValue(composicion('normal'));
    const onDensidad = vi.fn();
    const { rerender } = montar(ficha(), onDensidad);
    await user.selectOptions(screen.getByRole('combobox', { name: /Distribución de la hoja/ }), 'holgada');
    expect(onDensidad).toHaveBeenLastCalledWith('holgada');
    rerender(<I18nProvider><FichaPreview ficha={ficha({ densidad: 'holgada' })} lang="es" selected={null} onSelect={() => {}} onDensidad={onDensidad} /></I18nProvider>);
    const sel = screen.getByRole('combobox', { name: /Distribución de la hoja/ }) as HTMLSelectElement;
    expect(sel.value).toBe('holgada');
    await user.selectOptions(sel, 'auto');
    expect(onDensidad).toHaveBeenLastCalledWith(undefined);
  });

  it('la hoja de la vista previa lleva la densidad elegida', async () => {
    comp.componerHoja.mockResolvedValue(composicion('compacta'));
    montar(ficha({ densidad: 'holgada' }));
    await waitFor(() => expect(comp.componerHoja).toHaveBeenCalled());
    const frame = document.querySelector('iframe')!;
    await waitFor(() => expect(frame.contentDocument?.querySelector('.ficha-doc')?.className).toContain('d-holgada'));
  });

  it('lo que se mide es la hoja tal como se imprime y con la densidad normal', async () => {
    comp.componerHoja.mockResolvedValue(composicion('normal'));
    montar(ficha({ densidad: 'holgada' }));
    await waitFor(() => expect(comp.componerHoja).toHaveBeenCalled());
    const html = comp.componerHoja.mock.calls[0][0] as string;
    expect(html).not.toMatch(/class="[^"]*\bd-holgada/);
    expect(html).toContain('th-cuaderno');
  });

  it('los demás diseños y las tarjetas no tienen selector ni se miden', async () => {
    montar(ficha({ estilo: 'clasico' }));
    expect(screen.queryByRole('combobox', { name: /Distribución de la hoja/ })).toBeNull();
    cleanup();
    montar(ficha({ formato: 'tarjetas', tarjetas: [{ pregunta: 'a', respuesta: 'b' }] }));
    expect(screen.queryByRole('combobox', { name: /Distribución de la hoja/ })).toBeNull();
    await new Promise(r => setTimeout(r, 600));
    expect(comp.componerHoja).not.toHaveBeenCalled();
  });

  it('sin la función de cambiar, no se pinta el selector (vista de solo lectura)', () => {
    comp.componerHoja.mockResolvedValue(composicion('normal'));
    render(<I18nProvider><FichaPreview ficha={ficha()} lang="es" selected={null} onSelect={() => {}} /></I18nProvider>);
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
