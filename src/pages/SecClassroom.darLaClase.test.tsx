// @vitest-environment jsdom
/**
 * «Dar la clase» con las 24 ventanas de la pizarra ocupadas (25-11-2026): antes abría la pizarra sin el plan y sin
 * avisar. Ahora no se cierra nada del docente: la pizarra dice que no caben más ventanas y el plan entra solo en
 * cuanto se cierra una.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import SecClassroom from './SecClassroom';
import { I18nProvider } from '../i18n';
import { encargarClase, leerPlanDeVentana, tomarEncargo, type PlanDeClase } from '../lib/darLaClase';
import { MAX_VENTANAS } from '../lib/pizarraAula';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const clases = [{ id: 'c1', name: '1º A', nombres: ['Ana', 'Biel'] }];
const ACTUAL_KEY = 'aulapro_pizarra_actual';

const plan: PlanDeClase = {
  sesion: { origen: { tipo: 'sesion', id: 's1' }, titulo: 'Voleibol', ef: true, claseId: 'c1' },
  tareas: [{ id: 's0-1', texto: 'Calentamiento', hecha: false, momento: 0 }],
};

/** La pizarra llena: 24 notas, todas minimizadas salvo la primera. */
function llenarPizarra() {
  const ventanas = Array.from({ length: MAX_VENTANAS }, (_, i) => ({
    id: i === 0 ? 'note' : `note-${i + 1}`, tipo: 'note', rect: { x: 20 + i, y: 80, width: 200, height: 120 }, ...(i > 0 ? { min: true } : {}),
  }));
  localStorage.setItem(ACTUAL_KEY, JSON.stringify(ventanas));
}
const guardadas = () => JSON.parse(localStorage.getItem(ACTUAL_KEY) ?? '[]') as { id: string; tipo: string }[];

beforeEach(() => {
  localStorage.clear();
  tomarEncargo();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('«Dar la clase» con la pizarra llena', () => {
  it('avisa, no cierra nada y pone el plan en cuanto se cierra una ventana', async () => {
    llenarPizarra();
    encargarClase({ claseId: 'c1', plan });
    render(<I18nProvider><SecClassroom clases={clases} claseInicial="c1" /></I18nProvider>);

    expect(await screen.findByText('No caben más ventanas en la pizarra')).toBeTruthy();
    expect(screen.getByText(/Cierra una y se abrirá «Plan del día» con la sesión/)).toBeTruthy();
    // No se ha cerrado nada del docente ni se ha abierto el plan
    expect(guardadas()).toHaveLength(MAX_VENTANAS);
    expect(guardadas().some(v => v.tipo === 'agenda')).toBe(false);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })); });

    expect(screen.queryByText('No caben más ventanas en la pizarra')).toBeNull();
    const agenda = guardadas().find(v => v.tipo === 'agenda');
    expect(agenda).toBeTruthy();
    expect(guardadas()).toHaveLength(MAX_VENTANAS);
    expect(leerPlanDeVentana(agenda!.id).sesion?.titulo).toBe('Voleibol');
    expect(leerPlanDeVentana(agenda!.id).tareas.map(t => t.texto)).toEqual(['Calentamiento']);
  });

  it('el aviso se puede descartar: el plan ya no se pone al cerrar una ventana', async () => {
    llenarPizarra();
    encargarClase({ claseId: 'c1', plan });
    render(<I18nProvider><SecClassroom clases={clases} claseInicial="c1" /></I18nProvider>);

    fireEvent.click(await screen.findByRole('button', { name: 'Descartar la sugerencia' }));
    expect(screen.queryByText('No caben más ventanas en la pizarra')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })); });
    expect(guardadas()).toHaveLength(MAX_VENTANAS - 1);
    expect(guardadas().some(v => v.tipo === 'agenda')).toBe(false);
  });

  it('al cargar una escena con sitio, el plan que esperaba entra y el aviso se va', async () => {
    llenarPizarra();
    localStorage.setItem('aulapro_pizarra_escenas', JSON.stringify([{
      id: 'sc1', nombre: 'Entrada', fondo: 'blanco',
      ventanas: [
        { id: 'timer', tipo: 'timer', rect: { x: 20, y: 80, width: 260, height: 200 } },
        { id: 'note', tipo: 'note', rect: { x: 320, y: 80, width: 200, height: 120 } },
        { id: 'note-2', tipo: 'note', rect: { x: 560, y: 80, width: 200, height: 120 } },
      ],
    }]));
    encargarClase({ claseId: 'c1', plan });
    render(<I18nProvider><SecClassroom clases={clases} claseInicial="c1" /></I18nProvider>);
    expect(await screen.findByText('No caben más ventanas en la pizarra')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar y recuperar la disposición de la pizarra' }));
    await act(async () => { fireEvent.click(screen.getByText('Entrada')); });

    expect(screen.queryByText('No caben más ventanas en la pizarra')).toBeNull();
    expect(guardadas().map(v => v.tipo).sort()).toEqual(['agenda', 'note', 'note', 'timer']);
    const agenda = guardadas().find(v => v.tipo === 'agenda');
    expect(leerPlanDeVentana(agenda!.id).sesion?.titulo).toBe('Voleibol');
  });

  it('el aviso no tapa la barra de dibujar: va debajo de ella', async () => {
    llenarPizarra();
    encargarClase({ claseId: 'c1', plan });
    const { container } = render(<I18nProvider><SecClassroom clases={clases} claseInicial="c1" /></I18nProvider>);
    await screen.findByText('No caben más ventanas en la pizarra');
    // jsdom no mide: se fingen las barras (la de arriba acaba en 56 px y la de dibujar, en 110 px)
    const original = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const caja = (bottom: number, height: number) => ({ top: bottom - height, bottom, height, left: 0, right: 100, width: 100, x: 0, y: bottom - height, toJSON() {} }) as DOMRect;
      if (this.classList.contains('pz-top')) return caja(56, 42);
      if (this.classList.contains('pz-dibujo')) return caja(110, 44);
      if (this.classList.contains('pz-raiz')) return caja(800, 800);
      return original.call(this);
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Dibujar sobre la pantalla' })); });
    const aviso = container.querySelector('.pz-espera-plan') as HTMLElement;
    expect(aviso.style.top).toBe('120px');
  });

  it('con sitio, el plan entra al momento y no hay aviso', async () => {
    encargarClase({ claseId: 'c1', plan });
    render(<I18nProvider><SecClassroom clases={clases} claseInicial="c1" /></I18nProvider>);
    await act(async () => {});
    expect(screen.queryByText('No caben más ventanas en la pizarra')).toBeNull();
    expect(guardadas().some(v => v.tipo === 'agenda')).toBe(true);
  });
});
