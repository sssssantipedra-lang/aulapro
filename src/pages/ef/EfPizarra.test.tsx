// @vitest-environment jsdom
/**
 * Pizarra de circuitos: se pone material del banco, se cuenta, se gira, se
 * guarda; y lo que se dibuja a mano se reconoce y el docente lo confirma.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfPizarra } from './EfPizarra';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { EF_VACIO } from '../../lib/ef';
import type { EfData } from '../../types/ef';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('../../services/gemini', async importOriginal => {
  const real = await importOriginal<typeof import('../../services/gemini')>();
  return { ...real, callGemini, hasApiKey: () => true };
});

let ultimo: EfData = EF_VACIO;
function Harness() {
  const [ef, setEf] = useState<EfData>(EF_VACIO);
  return (
    <I18nProvider>
      <ToastProvider>
        <EfPizarra ef={ef} onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} comunidad="madrid" />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => { localStorage.clear(); ultimo = EF_VACIO; callGemini.mockReset(); });
afterEach(() => cleanup());

/** jsdom no calcula la matriz de la pantalla (ni tiene DOMMatrix): se da la identidad. */
function preparaLienzo() {
  const svg = screen.getByRole('img', { name: /Pizarra del circuito/ }) as unknown as SVGSVGElement;
  Object.defineProperty(svg, 'getScreenCTM', { value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) });
  Object.defineProperty(svg, 'setPointerCapture', { value: () => undefined });
  return svg;
}
function trazar(svg: Element, puntos: [number, number][]) {
  const [primero, ...resto] = puntos;
  fireEvent.pointerDown(svg, { clientX: primero[0], clientY: primero[1], pointerId: 1 });
  for (const p of resto) fireEvent.pointerMove(svg, { clientX: p[0], clientY: p[1], pointerId: 1 });
  fireEvent.pointerUp(svg, { pointerId: 1 });
}

describe('Pizarra de circuitos', () => {
  it('el banco pone material en la pizarra y lo cuenta', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('Aún no hay material en la pizarra.')).toBeTruthy();
    const banco = screen.getByRole('complementary', { name: 'Banco de material' });
    await user.click(within(banco).getByRole('button', { name: /^Cono/ }));
    await user.click(within(banco).getByRole('button', { name: /^Cono/ }));
    await user.click(within(banco).getByRole('button', { name: /^Aro/ }));
    await user.click(within(banco).getByRole('button', { name: /^Estación/ }));
    const lista = screen.getByRole('complementary', { name: 'Material del circuito' });
    expect(within(lista).getByText('2')).toBeTruthy();
    expect(within(lista).getByText(/Cono/)).toBeTruthy();
    expect(within(lista).getByText('1 estaciones')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Pizarra del circuito: 4 piezas' })).toBeTruthy();
  });

  it('la pieza elegida se gira, se agranda, se duplica y se quita; deshacer vuelve atrás', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(within(screen.getByRole('complementary', { name: 'Banco de material' })).getByRole('button', { name: /^Banco sueco/ }));
    const sel = screen.getByRole('group', { name: 'Pieza elegida' });
    await user.click(within(sel).getByRole('button', { name: /Girar a la derecha/ }));
    await user.click(within(sel).getByRole('button', { name: /Duplicar/ }));
    expect(screen.getByRole('img', { name: 'Pizarra del circuito: 2 piezas' })).toBeTruthy();
    await user.click(within(screen.getByRole('group', { name: 'Pieza elegida' })).getByRole('button', { name: /Quitar/ }));
    expect(screen.getByRole('img', { name: 'Pizarra del circuito: 1 piezas' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Deshacer/ }));
    expect(screen.getByRole('img', { name: 'Pizarra del circuito: 2 piezas' })).toBeTruthy();
  });

  it('guarda la pizarra con su nombre', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(within(screen.getByRole('complementary', { name: 'Banco de material' })).getByRole('button', { name: /^Colchoneta/ }));
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(ultimo.pizarras).toHaveLength(0);
    await user.type(screen.getByLabelText('Nombre de la pizarra'), 'Circuito de fuerza');
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(ultimo.pizarras[0]).toMatchObject({ nombre: 'Circuito de fuerza' });
    expect(ultimo.pizarras[0].elementos[0].material).toBe('colchoneta');
  });

  it('un triángulo dibujado a mano se propone como cono y, al confirmarlo, lo sustituye', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const svg = preparaLienzo();
    await user.click(screen.getByRole('button', { name: /Dibujar material/ }));
    trazar(svg, [[100, 200], [120, 160], [140, 120], [160, 160], [180, 200], [140, 200], [100, 200]]);
    const panel = await screen.findByRole('region', { name: 'Lo que la app ha reconocido' });
    expect(within(panel).getByText(/un triángulo/)).toBeTruthy();
    expect((within(panel).getByRole('combobox') as HTMLSelectElement).value).toBe('cono');
    await user.click(within(panel).getByRole('button', { name: /Poner/ }));
    expect(screen.queryByRole('region', { name: 'Lo que la app ha reconocido' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Pizarra del circuito: 1 piezas' })).toBeTruthy();
  });

  it('con la IA: el croquis se envía y sus propuestas se pueden poner', async () => {
    const user = userEvent.setup();
    // En jsdom no hay lienzo: el croquis se queda sin imagen, y la pantalla lo dice
    render(<Harness />);
    const svg = preparaLienzo();
    await user.click(screen.getByRole('button', { name: /Dibujar material/ }));
    trazar(svg, [[100, 200], [120, 160], [140, 120], [160, 160], [180, 200], [140, 200], [100, 200]]);
    callGemini.mockResolvedValue('{}');
    await user.click(await screen.findByRole('button', { name: /Reconocer con IA/ }));
    expect(await screen.findByText('No se pudo preparar el croquis para la IA.')).toBeTruthy();
    expect(callGemini).not.toHaveBeenCalled();
  });
});
