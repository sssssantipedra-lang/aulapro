// @vitest-environment jsdom
/**
 * Pizarra de circuitos: se pone material del banco, se cuenta, se gira, se
 * duplica como en Canva y se guarda; y lo que se dibuja a mano se reconoce:
 * con una forma, por su aspecto; desde dos, la IA las procesa sola.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfPizarra } from './EfPizarra';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { EF_VACIO } from '../../lib/ef';
import type { EfData } from '../../types/ef';

const callGemini = vi.hoisted(() => vi.fn());
const apiKey = vi.hoisted(() => ({ hay: true }));
vi.mock('../../services/gemini', async importOriginal => {
  const real = await importOriginal<typeof import('../../services/gemini')>();
  return { ...real, callGemini, hasApiKey: () => apiKey.hay };
});
// En jsdom no hay lienzo: la imagen del croquis se da hecha
vi.mock('../../lib/svgPng', () => ({
  svgAPng: async () => new Blob(['x'], { type: 'image/png' }),
  blobABase64: async () => 'QUJD',
}));

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

beforeEach(() => { localStorage.clear(); ultimo = EF_VACIO; callGemini.mockReset(); apiKey.hay = true; });
afterEach(() => cleanup());

/** jsdom no calcula la matriz de la pantalla (ni tiene DOMMatrix): se da la identidad. */
function preparaLienzo() {
  const svg = screen.getByRole('img', { name: /Pizarra del circuito/ }) as unknown as SVGSVGElement;
  Object.defineProperty(svg, 'getScreenCTM', { value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) });
  Object.defineProperty(svg, 'setPointerCapture', { value: () => undefined });
  return svg;
}
function trazar(svg: Element, puntos: [number, number][], init: PointerEventInit = {}) {
  const [primero, ...resto] = puntos;
  fireEvent.pointerDown(svg, { clientX: primero[0], clientY: primero[1], pointerId: 1, ...init });
  for (const p of resto) fireEvent.pointerMove(svg, { clientX: p[0], clientY: p[1], pointerId: 1, ...init });
  fireEvent.pointerUp(svg, { pointerId: 1, ...init });
}
const piezas = (n: number) => screen.getByRole('img', { name: `Pizarra del circuito: ${n} piezas` });
const banco = () => within(screen.getByRole('complementary', { name: 'Banco de material' }));
const triangulo: [number, number][] = [[100, 200], [120, 160], [140, 120], [160, 160], [180, 200], [140, 200], [100, 200]];
const circulo = (cx: number, cy: number, r: number): [number, number][] =>
  Array.from({ length: 21 }, (_, i) => [cx + r * Math.cos(i / 20 * 2 * Math.PI), cy + r * Math.sin(i / 20 * 2 * Math.PI)]);

describe('Pizarra de circuitos', () => {
  it('el banco pone material en la pizarra y lo cuenta', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('Aún no hay material en la pizarra.')).toBeTruthy();
    await user.click(banco().getByRole('button', { name: /^Cono/ }));
    await user.click(banco().getByRole('button', { name: /^Cono/ }));
    await user.click(banco().getByRole('button', { name: /^Aro/ }));
    await user.click(banco().getByRole('button', { name: /^Estación/ }));
    const lista = screen.getByRole('complementary', { name: 'Material del circuito' });
    expect(within(lista).getByText('2')).toBeTruthy();
    expect(within(lista).getByText(/Cono/)).toBeTruthy();
    expect(within(lista).getByText('1 estaciones')).toBeTruthy();
    expect(piezas(4)).toBeTruthy();
  });

  it('la pieza elegida se gira, se duplica y se quita; deshacer vuelve atrás', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(banco().getByRole('button', { name: /^Banco sueco/ }));
    const sel = screen.getByRole('group', { name: 'Pieza elegida' });
    await user.click(within(sel).getByRole('button', { name: /Girar a la derecha/ }));
    await user.click(within(sel).getByRole('button', { name: /^Duplicar/ }));
    expect(piezas(2)).toBeTruthy();
    await user.click(within(screen.getByRole('group', { name: 'Pieza elegida' })).getByRole('button', { name: /Quitar/ }));
    expect(piezas(1)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Deshacer/ }));
    expect(piezas(2)).toBeTruthy();
  });

  it('guarda la pizarra con su nombre', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(banco().getByRole('button', { name: /^Colchoneta/ }));
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(ultimo.pizarras).toHaveLength(0);
    await user.type(screen.getByLabelText('Nombre de la pizarra'), 'Circuito de fuerza');
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(ultimo.pizarras[0]).toMatchObject({ nombre: 'Circuito de fuerza' });
    expect(ultimo.pizarras[0].elementos[0].material).toBe('colchoneta');
  });
});

describe('duplicar, como en Canva', () => {
  async function conUnCono() {
    const user = userEvent.setup();
    render(<Harness />);
    const svg = preparaLienzo();
    await user.click(banco().getByRole('button', { name: /^Cono/ }));
    return { user, svg };
  }

  it('la barra flotante de la pieza duplica con un clic', async () => {
    const { user } = await conUnCono();
    const barra = screen.getByRole('toolbar', { name: 'Acciones de la pieza' });
    await user.click(within(barra).getByRole('button', { name: 'Duplicar' }));
    expect(piezas(2)).toBeTruthy();
    // Las copias quedan elegidas: se pueden seguir duplicando
    await user.click(within(screen.getByRole('toolbar', { name: 'Acciones de la pieza' })).getByRole('button', { name: 'Duplicar' }));
    expect(piezas(3)).toBeTruthy();
  });

  it('Ctrl+D duplica, y repite la distancia a la que se movió la última copia', async () => {
    const { user, svg } = await conUnCono();
    svg.focus();
    await user.keyboard('{Control>}d{/Control}');
    expect(piezas(2)).toBeTruthy();
    // Se mueve la copia 60 hacia la derecha con las flechas (6 pasos de 10 más los 24 del primer desplazamiento)
    for (let i = 0; i < 6; i++) await user.keyboard('{ArrowRight}');
    await user.keyboard('{Control>}d{/Control}');
    await user.keyboard('{Control>}d{/Control}');
    expect(piezas(4)).toBeTruthy();
    const g = svg.querySelectorAll('g.ef-piz-el');
    const xs = [...g].map(el => Number(/translate\(([-\d.]+)/.exec(el.getAttribute('transform') ?? '')![1])).sort((a, b) => a - b);
    // Original, copia a +24+60, y dos más con la misma distancia de 84
    expect(xs[1] - xs[0]).toBeGreaterThan(70);
    expect(xs[3] - xs[2]).toBeCloseTo(xs[2] - xs[1], 0);
  });

  it('Ctrl+C y Ctrl+V pegan copias cada vez más lejos', async () => {
    const { user, svg } = await conUnCono();
    svg.focus();
    await user.keyboard('{Control>}c{/Control}');
    await user.keyboard('{Control>}v{/Control}');
    await user.keyboard('{Control>}v{/Control}');
    expect(piezas(3)).toBeTruthy();
  });

  it('Alt y arrastrar deja la original y mueve una copia', async () => {
    const { svg } = await conUnCono();
    const pieza = svg.querySelector('g.ef-piz-el')!;
    fireEvent.pointerDown(pieza, { clientX: 500, clientY: 300, pointerId: 1, altKey: true });
    fireEvent.pointerMove(svg, { clientX: 700, clientY: 400, pointerId: 1, altKey: true });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    expect(piezas(2)).toBeTruthy();
    const xs = [...svg.querySelectorAll('g.ef-piz-el')].map(el => Number(/translate\(([-\d.]+)/.exec(el.getAttribute('transform') ?? '')![1]));
    expect(Math.abs(xs[1] - xs[0])).toBeGreaterThanOrEqual(190);
  });

  it('«Copias en fila» hace varias de una vez', async () => {
    const { user } = await conUnCono();
    const panel = screen.getByRole('group', { name: 'Pieza elegida' });
    const n = within(panel).getByLabelText('Número de copias');
    await user.clear(n);
    await user.type(n, '5');
    await user.click(within(panel).getByRole('button', { name: /Copias en fila/ }));
    expect(piezas(6)).toBeTruthy();
  });

  it('un recuadro elige varias piezas y se duplican juntas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const svg = preparaLienzo();
    await user.click(banco().getByRole('button', { name: /^Cono/ }));
    await user.click(banco().getByRole('button', { name: /^Aro/ }));
    await user.click(banco().getByRole('button', { name: /^Balón/ }));
    // Recuadro sobre toda la pizarra
    trazar(svg, [[2, 2], [998, 598]]);
    expect(screen.getByText('3 piezas elegidas')).toBeTruthy();
    await user.click(within(screen.getByRole('group', { name: 'Pieza elegida' })).getByRole('button', { name: /^Duplicar/ }));
    expect(piezas(6)).toBeTruthy();
    expect(screen.getByText('3 piezas elegidas')).toBeTruthy();
    // Un clic en el fondo suelta la elección
    fireEvent.pointerDown(svg, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    expect(screen.queryByRole('group', { name: 'Pieza elegida' })).toBeNull();
  });
});

describe('reconocer lo dibujado', () => {
  it('con una sola forma, la app propone qué es y, al confirmarlo, la sustituye', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const svg = preparaLienzo();
    await user.click(screen.getByRole('button', { name: /Dibujar material/ }));
    trazar(svg, triangulo);
    const panel = await screen.findByRole('region', { name: 'Lo que la app ha reconocido' });
    expect(within(panel).getByText(/un triángulo/)).toBeTruthy();
    expect((within(panel).getByRole('combobox') as HTMLSelectElement).value).toBe('cono');
    await user.click(within(panel).getByRole('button', { name: /Poner/ }));
    expect(screen.queryByRole('region', { name: 'Lo que la app ha reconocido' })).toBeNull();
    expect(piezas(1)).toBeTruthy();
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('desde dos formas la IA las procesa sola y coloca las piezas de las que está segura', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const svg = preparaLienzo();
    callGemini.mockResolvedValue(JSON.stringify({
      resumen: 'Un cono y un aro.',
      objetos: [
        { material: 'cono', x: 0.14, y: 0.3, ancho: 0.08, alto: 0.13, seguridad: 'alta' },
        { material: 'aro', x: 0.4, y: 0.5, ancho: 0.1, alto: 0.15, seguridad: 'media' },
        { material: 'balon', x: 0.7, y: 0.5, ancho: 0.05, alto: 0.08, seguridad: 'baja' },
      ],
    }));
    await user.click(screen.getByRole('button', { name: /Dibujar material/ }));
    trazar(svg, triangulo);
    expect(callGemini).not.toHaveBeenCalled();
    trazar(svg, circulo(400, 300, 50));
    // Nadie ha pulsado «Reconocer con IA»: la IA procesa sola
    await waitFor(() => expect(callGemini).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(callGemini.mock.calls[0][2][0]).toMatchObject({ mimeType: 'image/png', base64: 'QUJD' });
    // Las dos seguras ya están puestas; la dudosa espera a que el docente la confirme
    await waitFor(() => expect(piezas(2)).toBeTruthy());
    const panel = await screen.findByRole('region', { name: 'Lo que la app ha reconocido' });
    expect(within(panel).getByText('Un cono y un aro.')).toBeTruthy();
    expect(within(panel).getByText(/poco segura/)).toBeTruthy();
    expect(within(panel).queryByText(/Has dibujado/)).toBeNull();
    await user.click(within(panel).getByRole('button', { name: /Poner/ }));
    expect(piezas(3)).toBeTruthy();
  });

  it('con la IA segura de todo, los dibujos pasan a ser piezas y no queda nada por confirmar', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const svg = preparaLienzo();
    callGemini.mockResolvedValue(JSON.stringify({
      resumen: 'Dos conos.',
      objetos: [
        { material: 'cono', x: 0.14, y: 0.3, ancho: 0.08, alto: 0.13, seguridad: 'alta' },
        { material: 'cono', x: 0.4, y: 0.5, ancho: 0.08, alto: 0.13, seguridad: 'alta' },
      ],
    }));
    await user.click(screen.getByRole('button', { name: /Dibujar material/ }));
    trazar(svg, triangulo);
    trazar(svg, triangulo.map(([x, y]) => [x + 300, y] as [number, number]));
    await waitFor(() => expect(piezas(2)).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByRole('region', { name: 'Lo que la app ha reconocido' })).toBeNull();
    // Y se puede deshacer
    await user.click(screen.getByRole('button', { name: /Deshacer/ }));
    expect(piezas(0)).toBeTruthy();
  });

  it('sin clave de IA, no la llama sola: se queda con la propuesta de la app', async () => {
    apiKey.hay = false;
    const user = userEvent.setup();
    render(<Harness />);
    const svg = preparaLienzo();
    await user.click(screen.getByRole('button', { name: /Dibujar material/ }));
    trazar(svg, triangulo);
    trazar(svg, circulo(400, 300, 50));
    await new Promise(r => setTimeout(r, 1700));
    expect(callGemini).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Has dibujado/)).toHaveLength(2);
  });
});
