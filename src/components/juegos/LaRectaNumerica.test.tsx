// @vitest-environment jsdom
/**
 * «La recta numérica» (26-11-2026): la portada, el tramo que propone la clase, dos dedos arrastrando a la vez cada uno
 * en su recta, el marcador escondido al fijarlo, la revelación con quién gana, el tiempo que se acaba, el teclado y el
 * final con «Jugar otra vez».
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { LaRectaNumerica } from './LaRectaNumerica';
import { I18nProvider } from '../../i18n';
import { nuevaPartidaRecta, fraccionDe } from '../../lib/juegos/recta';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

/** jsdom no tiene PointerEvent: uno que lleva `pointerId` y la posición. */
class PointerEventFalso extends MouseEvent {
  pointerId: number; pointerType: string;
  constructor(tipo: string, init: PointerEventInit = {}) { super(tipo, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'touch'; }
}

const ANCHO = 1000;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('PointerEvent', PointerEventFalso);
  // Cada recta mide 1000 px y empieza en 0: la posición del dedo es la fracción de la recta por mil
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: ANCHO, height: 100, right: ANCHO, bottom: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const pulsar = (el: Element) => { fireEvent.pointerDown(el, { pointerId: 1, button: 0 }); fireEvent.click(el, { detail: 1 }); };
function montar(props: Partial<Parameters<typeof LaRectaNumerica>[0]> = {}) {
  const onClose = vi.fn();
  const r = render(<I18nProvider><LaRectaNumerica onClose={onClose} {...props} /></I18nProvider>);
  return { ...r, onClose };
}
const panel = (nombre: 'Equipo rojo' | 'Equipo azul') => screen.getByRole('region', { name: nombre });
const escena = (nombre: 'Equipo rojo' | 'Equipo azul') => panel(nombre).querySelector('.rn-escena')!;

function hastaLaPartida(tramo: string, variante: string, tiempo = '20 s') {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.4);
  const m = montar();
  pulsar(screen.getByRole('button', { name: '¡A jugar!' }));
  pulsar(within(screen.getByRole('radiogroup', { name: 'Nivel' })).getByRole('radio', { name: tramo }));
  pulsar(within(screen.getByRole('radiogroup', { name: 'Qué números salen' })).getByRole('radio', { name: new RegExp(`${variante}$`) }));
  pulsar(within(screen.getByRole('radiogroup', { name: 'Rondas' })).getByRole('radio', { name: '5' }));
  pulsar(within(screen.getByRole('radiogroup', { name: 'Tiempo para poner el marcador' })).getByRole('radio', { name: tiempo }));
  pulsar(screen.getByRole('button', { name: 'Empezar' }));
  for (let i = 0; i < 4; i++) act(() => { vi.advanceTimersByTime(810); });
  expect(document.querySelector('.cu-cuenta')).toBeNull();
  return m;
}

describe('La recta numérica', () => {
  it('portada, salir con la X y con Escape; propone el tramo de la clase con sus números', () => {
    const { onClose } = montar({ clase: { name: '3.º B', etapa: 'eso', curso: 3 } });
    expect(screen.getByRole('dialog', { name: 'La recta numérica' })).toBeTruthy();
    pulsar(screen.getByRole('button', { name: '¡A jugar!' }));
    expect(screen.getByRole('radio', { name: '3.º y 4.º de ESO' }).getAttribute('aria-checked')).toBe('true');
    const nums = within(screen.getByRole('radiogroup', { name: 'Qué números salen' })).getAllByRole('radio').map(r => r.textContent);
    expect(nums.map(x => x?.replace(/^.*?(Fracciones|Raíces|Expresiones|Mezcla)/, '$1'))).toEqual(['Fracciones y decimales', 'Raíces', 'Expresiones y porcentajes', 'Mezcla']);
    // En ESO, más ritmo: 15 s de partida
    expect(screen.getByRole('radio', { name: '15 s' }).getAttribute('aria-checked')).toBe('true');
    pulsar(screen.getByRole('button', { name: 'Salir' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('dos dedos a la vez, cada uno en su recta; al fijarlo se esconde; con los dos fijados se revela y gana el más cerca', () => {
    hastaLaPartida('3.º y 4.º de Primaria', 'Del 0 al 100');
    const p = nuevaPartidaRecta('p34', 'cien', 5, (0.4 * 2 ** 32) >>> 0);
    const valor = p.objetivo.valor;
    expect(within(panel('Equipo rojo')).getByText(String(valor))).toBeTruthy();
    expect(within(panel('Equipo azul')).getByText(String(valor))).toBeTruthy();
    // «¡Aquí!» no vale sin haber puesto el marcador
    expect((within(panel('Equipo rojo')).getByRole('button', { name: '¡Aquí!' }) as HTMLButtonElement).disabled).toBe(true);

    // El rojo apoya en el 10 y el azul en el 90, a la vez; luego los dos se mueven a la vez
    const xDe = (v: number) => fraccionDe(p.objetivo.recta, v) * ANCHO;
    fireEvent.pointerDown(escena('Equipo rojo'), { pointerId: 11, clientX: xDe(10) });
    fireEvent.pointerDown(escena('Equipo azul'), { pointerId: 12, clientX: xDe(90) });
    fireEvent.pointerMove(escena('Equipo rojo'), { pointerId: 11, clientX: xDe(valor) });
    // Un dedo que no es el suyo no mueve la recta del otro
    fireEvent.pointerMove(escena('Equipo azul'), { pointerId: 11, clientX: xDe(0) });
    fireEvent.pointerMove(escena('Equipo azul'), { pointerId: 12, clientX: xDe(valor > 50 ? 5 : 95) });
    fireEvent.pointerUp(escena('Equipo rojo'), { pointerId: 11, clientX: xDe(valor) });
    fireEvent.pointerUp(escena('Equipo azul'), { pointerId: 12, clientX: xDe(valor > 50 ? 5 : 95) });
    expect(panel('Equipo rojo').querySelector('.rn-marcador')).toBeTruthy();
    expect(panel('Equipo azul').querySelector('.rn-marcador')).toBeTruthy();

    pulsar(within(panel('Equipo rojo')).getByRole('button', { name: '¡Aquí!' }));
    // Fijado, el marcador del rojo no se ve (nadie copia) y dice «¡Listo!»
    expect(panel('Equipo rojo').querySelector('.rn-marcador')).toBeNull();
    expect(within(panel('Equipo rojo')).getAllByText('¡Listo!').length).toBeGreaterThan(0);
    pulsar(within(panel('Equipo azul')).getByRole('button', { name: '¡Aquí!' }));

    // Revelado: el número en su sitio, la regla y el punto para el rojo
    expect(panel('Equipo rojo').querySelector('.rn-punto')).toBeTruthy();
    expect(within(panel('Equipo rojo')).getByText('Punto para Equipo rojo')).toBeTruthy();
    expect(within(panel('Equipo azul')).getByText('Punto para Equipo rojo')).toBeTruthy();
    expect(screen.getByLabelText('Equipo rojo: 1 puntos')).toBeTruthy();
    const siguiente = within(panel('Equipo rojo')).getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement;
    expect(siguiente.disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(1700); });
    expect(siguiente.disabled).toBe(false);
    pulsar(siguiente);
    expect(screen.getByText('Ronda 2 de 5')).toBeTruthy();
  });

  it('al acabarse el tiempo se revela con lo que hay: quien no puso su marcador no puntúa', () => {
    hastaLaPartida('1.º y 2.º de Primaria', 'Del 0 al 10', '10 s');
    fireEvent.pointerDown(escena('Equipo azul'), { pointerId: 3, clientX: 100 });
    fireEvent.pointerUp(escena('Equipo azul'), { pointerId: 3, clientX: 100 });
    act(() => { vi.advanceTimersByTime(10_100); });
    expect(within(panel('Equipo rojo')).getByText('Sin marcador')).toBeTruthy();
    expect(within(panel('Equipo azul')).getByText('Punto para Equipo azul')).toBeTruthy();
  });

  it('1.º y 2.º: el número con puntos en marcos de diez y el marcador que se queda en el número entero', () => {
    hastaLaPartida('1.º y 2.º de Primaria', 'Del 0 al 10');
    const p = nuevaPartidaRecta('p12', 'diez', 5, (0.4 * 2 ** 32) >>> 0);
    const llenas = panel('Equipo rojo').querySelectorAll('.rn-celda.llena').length;
    expect(llenas).toBe(p.objetivo.valor);
    // 3,4 de 10 queda en el 3 al soltar
    fireEvent.pointerDown(escena('Equipo rojo'), { pointerId: 5, clientX: 340 });
    fireEvent.pointerUp(escena('Equipo rojo'), { pointerId: 5, clientX: 340 });
    const left = (panel('Equipo rojo').querySelector('.rn-marcador') as HTMLElement).style.left;
    expect(parseFloat(left)).toBeCloseTo(30);
  });

  it('con el teclado: el rojo con D y S, el azul con ← y ↓; a 5 rondas acaba con el ganador', () => {
    hastaLaPartida('5.º y 6.º de Primaria', 'Decimales');
    for (let ronda = 0; ronda < 5; ronda++) {
      for (let i = 0; i < 3; i++) fireEvent.keyDown(window, { key: 'd' });
      fireEvent.keyDown(window, { key: 's' });
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(document.querySelector('.rn-punto')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(1700); });
      fireEvent.keyDown(window, { key: 'Enter' });
      if (document.querySelector('.cu-fin')) break;
    }
    // Empatados al final, se juegan rondas de desempate; si no, ya está el ganador
    for (let k = 0; k < 4 && !document.querySelector('.cu-fin'); k++) {
      fireEvent.keyDown(window, { key: 'd' });
      fireEvent.keyDown(window, { key: 's' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      act(() => { vi.advanceTimersByTime(1700); });
      fireEvent.keyDown(window, { key: 'Enter' });
    }
    expect(document.querySelector('.cu-fin')).toBeTruthy();
    expect(screen.getByText(/¡Victoria de|¡Empate!/)).toBeTruthy();
    const otra = screen.getByRole('button', { name: 'Jugar otra vez' }) as HTMLButtonElement;
    expect(otra.disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(otra.disabled).toBe(false);
  });

  it('en mitad de una partida, la X pide un segundo toque', () => {
    const { onClose } = hastaLaPartida('3.º y 4.º de Primaria', 'Del 0 al 100');
    pulsar(screen.getByRole('button', { name: 'Salir' }));
    expect(onClose).not.toHaveBeenCalled();
    pulsar(screen.getByRole('button', { name: 'Salir' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
