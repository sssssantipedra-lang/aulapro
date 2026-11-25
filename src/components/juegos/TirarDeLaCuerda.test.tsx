// @vitest-environment jsdom
/**
 * «Tirar de la cuerda» (25-11-2026): la portada con el crédito, el nombre con el teclado del juego y con el de
 * verdad, el nivel que propone la clase, la cuenta atrás, los dos teclados a la vez, la respuesta tras un fallo, el
 * ganador, la música tras un gesto y salir con la X (dos toques en mitad de una partida) o con Escape.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { TirarDeLaCuerda } from './TirarDeLaCuerda';
import { I18nProvider } from '../../i18n';
import { MUSICA_CUERDA, nuevaPartida, reducirPartida, type NivelCuerda, type Partida, type Tecla, type TipoCuerda } from '../../lib/juegos/cuerda';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

/** Un audio de mentira: se anota qué se crea, si suena y si se para. */
const audios: { src: string; loop: boolean; volume: number; sonando: boolean; parado: number }[] = [];
class AudioFalso {
  loop = false; volume = 1; private r: (typeof audios)[number];
  constructor(src: string) { this.r = { src, loop: false, volume: 1, sonando: false, parado: 0 }; audios.push(this.r); }
  play() { this.r.loop = this.loop; this.r.volume = this.volume; this.r.sonando = true; return Promise.resolve(); }
  pause() { this.r.sonando = false; this.r.parado++; }
  removeAttribute() {}
  load() {}
}

beforeEach(() => {
  audios.length = 0;
  localStorage.clear();
  vi.stubGlobal('Audio', AudioFalso);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** Un toque de verdad: las teclas actúan al bajar el dedo y los demás botones, con el `click` de después. */
const pulsar = (el: Element) => { fireEvent.pointerDown(el, { pointerId: 1, button: 0 }); fireEvent.click(el, { detail: 1 }); };

function montar(props: Partial<Parameters<typeof TirarDeLaCuerda>[0]> = {}) {
  const onClose = vi.fn();
  const r = render(<I18nProvider><TirarDeLaCuerda onClose={onClose} {...props} /></I18nProvider>);
  return { ...r, onClose };
}

/** De la portada a la partida, con la semilla fija para saber las preguntas. */
function hastaLaPartida(nivel: NivelCuerda, tipo: TipoCuerda) {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.25);
  const m = montar();
  pulsar(screen.getByRole('button', { name: '¡A jugar!' }));
  const niveles = screen.getByRole('radiogroup', { name: 'Nivel' });
  pulsar(within(niveles).getByRole('radio', { name: nombreNivel(nivel) }));
  const ops = screen.getByRole('radiogroup', { name: 'Operación' });
  pulsar(within(ops).getByRole('radio', { name: new RegExp(tipo === 'mezcla' ? 'Mezcla' : tipo, 'i') }));
  pulsar(screen.getByRole('radio', { name: '3' }));
  pulsar(screen.getByRole('button', { name: 'Empezar' }));
  expect(document.querySelector('.cu-cuenta-n')?.textContent).toBe('3');
  // 3, 2, 1, ¡ya!: cada paso, 800 ms
  for (let i = 0; i < 4; i++) act(() => { vi.advanceTimersByTime(810); });
  expect(document.querySelector('.cu-cuenta')).toBeNull();
  const partida = nuevaPartida(nivel, tipo, 3, (0.25 * 2 ** 32) >>> 0);
  return { ...m, partida };
}
const nombreNivel = (n: NivelCuerda) => ({ p12: '1.º y 2.º de Primaria', p34: '3.º y 4.º de Primaria', p56: '5.º y 6.º de Primaria', e12: '1.º y 2.º de ESO', e34: '3.º y 4.º de ESO' })[n];
const teclado = (equipo: 'rojo' | 'azul') =>
  within(screen.getByRole('group', { name: `Teclado de Equipo ${equipo}` }));
function escribir(equipo: 'rojo' | 'azul', respuesta: number) {
  const tk = teclado(equipo);
  for (const c of String(respuesta)) pulsar(c === '-' ? tk.getByRole('button', { name: 'Cambiar el signo' }) : tk.getByRole('button', { name: c }));
}

describe('Tirar de la cuerda', () => {
  it('la portada lleva los dos equipos, «¡A jugar!» y el crédito «Santi Pedra - AulaPro»; la X y Escape salen', () => {
    const { onClose } = montar();
    expect(screen.getByRole('dialog', { name: 'Tirar de la cuerda' })).toBeTruthy();
    expect(screen.getByText('Santi Pedra - AulaPro')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Equipo rojo/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Equipo azul/ })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Google Sites|Consolación/);
    pulsar(screen.getByRole('button', { name: 'Salir' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('el nombre se escribe con el teclado del juego (con Ñ) y con el de verdad; Escape cierra el nombre, no el juego', () => {
    const { onClose } = montar();
    pulsar(screen.getByRole('button', { name: /Equipo rojo/ }));
    const editor = within(screen.getByRole('dialog', { name: 'Nombre del equipo rojo' }));
    pulsar(editor.getByRole('button', { name: 'Ñ' }));
    fireEvent.keyDown(window, { key: 'u' });
    fireEvent.keyDown(window, { key: 'á' });
    expect(editor.getByText('ÑUÁ')).toBeTruthy();
    pulsar(editor.getByRole('button', { name: 'Borrar la última letra' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Nombre del equipo rojo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cambiar el nombre: ÑU' })).toBeTruthy();
  });

  it('propone el nivel de la clase y, en ESO, sus operaciones', () => {
    montar({ clase: { name: '3.º B', etapa: 'eso', curso: 3 } });
    pulsar(screen.getByRole('button', { name: '¡A jugar!' }));
    expect(screen.getByRole('radio', { name: '3.º y 4.º de ESO' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/Propuesto por la clase 3\.º B/)).toBeTruthy();
    const ops = within(screen.getByRole('radiogroup', { name: 'Operación' }));
    expect(ops.getByRole('radio', { name: /Potencias y raíces/ })).toBeTruthy();
    // En ESO también están las cuatro operaciones de siempre, con «·» para multiplicar
    expect(ops.getAllByRole('radio').map(r => r.textContent)).toEqual([
      '+Suma', '−Resta', '·Multiplicación', ':División', '±Números enteros', 'xⁿPotencias y raíces', '%Porcentajes', '🔀Mezcla',
    ]);
  });

  it('en 1.º y 2.º de Primaria solo salen la suma, la resta y la mezcla; una multiplicación recordada cae en la mezcla', () => {
    localStorage.setItem('aulapro_cuerda', JSON.stringify({ nivel: 'p12', tipo: 'multiplicacion', meta: 5 }));
    montar();
    pulsar(screen.getByRole('button', { name: '¡A jugar!' }));
    const ops = within(screen.getByRole('radiogroup', { name: 'Operación' }));
    expect(ops.getAllByRole('radio').map(r => r.textContent)).toEqual(['+Suma', '−Resta', '🔀Mezcla']);
    expect(ops.getByRole('radio', { name: /Mezcla/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: '5' }).getAttribute('aria-checked')).toBe('true');
  });

  it('«Cifras del segundo número» sale solo en 5.º y 6.º, con multiplicación, división o mezcla, y se recuerda', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const { unmount } = montar();
    pulsar(screen.getByRole('button', { name: '¡A jugar!' }));
    const niveles = within(screen.getByRole('radiogroup', { name: 'Nivel' }));
    const ops = () => within(screen.getByRole('radiogroup', { name: 'Operación' }));
    const cifras = () => screen.queryByRole('radiogroup', { name: 'Cifras del segundo número' });
    for (const n of ['1.º y 2.º de Primaria', '3.º y 4.º de Primaria', '1.º y 2.º de ESO', '3.º y 4.º de ESO']) {
      pulsar(niveles.getByRole('radio', { name: n }));
      pulsar(ops().getByRole('radio', { name: /Mezcla/ }));
      expect(cifras(), n).toBeNull();
    }
    pulsar(niveles.getByRole('radio', { name: '5.º y 6.º de Primaria' }));
    for (const [op, sale] of [['Suma', false], ['Resta', false], ['Multiplicación', true], ['División', true], ['Mezcla', true]] as const) {
      pulsar(ops().getByRole('radio', { name: new RegExp(op) }));
      expect(!!cifras(), op).toBe(sale);
    }
    const grupo = within(cifras()!);
    expect(grupo.getByRole('radio', { name: /Una cifra/ }).getAttribute('aria-checked')).toBe('true');
    pulsar(grupo.getByRole('radio', { name: /Dos cifras/ }));
    // El ejemplo de cada opción es de la operación elegida
    const ejemplos = () => within(cifras()!).getAllByRole('radio').map(r => r.querySelector('.cu-signo')?.textContent);
    expect(ejemplos()).toEqual(['12 × 7, 84 : 6', '23 × 14, 312 : 24']);
    pulsar(ops().getByRole('radio', { name: /Multiplicación/ }));
    expect(ejemplos()).toEqual(['12 × 7', '23 × 14']);
    pulsar(ops().getByRole('radio', { name: /División/ }));
    expect(ejemplos()).toEqual(['84 : 6', '312 : 24']);
    pulsar(screen.getByRole('button', { name: 'Empezar' }));
    for (let i = 0; i < 4; i++) act(() => { vi.advanceTimersByTime(810); });
    // La partida es la de dos cifras: divisores de dos cifras en los dos equipos
    const esperada = nuevaPartida('p56', 'division', 3, (0.25 * 2 ** 32) >>> 0, 2);
    expect(esperada.equipos[0].pregunta.texto).toMatch(/^\d+ : \d\d$/);
    expect(screen.getByText(`${esperada.equipos[0].pregunta.texto} = ?`)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('aulapro_cuerda') ?? '{}')).toMatchObject({ nivel: 'p56', tipo: 'division', cifras: 2 });
    unmount();
    // Al volver a abrir el juego se acuerda de las dos cifras
    montar();
    pulsar(screen.getByRole('button', { name: '¡A jugar!' }));
    expect(within(cifras()!).getByRole('radio', { name: /Dos cifras/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('cuenta atrás y, en la partida, los dos teclados a la vez sin pisarse; el acierto tira y el fallo no', () => {
    const { partida } = hastaLaPartida('p34', 'suma');
    const r0 = partida.equipos[0].pregunta.respuesta;
    const r1 = partida.equipos[1].pregunta.respuesta;
    expect(screen.getByText(`${partida.equipos[0].pregunta.texto} = ?`)).toBeTruthy();
    // Una cifra de cada equipo, alternando, como dos dedos a la vez
    const a = String(r0), b = String(r1);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) fireEvent.pointerDown(teclado('rojo').getByRole('button', { name: a[i] }), { pointerId: 11 });
      if (b[i]) fireEvent.pointerDown(teclado('azul').getByRole('button', { name: b[i] }), { pointerId: 12 });
    }
    const respuestas = screen.getAllByLabelText('Respuesta').map(x => x.textContent);
    expect(respuestas).toEqual([a, b]);
    // La cuenta atrás no deja ver las preguntas; ya en la partida, sí
    expect(document.querySelectorAll('.cu-pregunta.oculta')).toHaveLength(0);
    // El rojo acierta; el azul pulsa «Go» con una cifra de más y falla
    pulsar(teclado('rojo').getByRole('button', { name: 'Comprobar' }));
    pulsar(teclado('azul').getByRole('button', { name: '1' }));
    pulsar(teclado('azul').getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByLabelText('1 aciertos')).toBeTruthy();
    expect(screen.getAllByLabelText('0 aciertos')).toHaveLength(1);
    expect(document.querySelector('.cu-tarjeta.azul.mal')).toBeTruthy();
    // Tras fallar, el azul ve la respuesta de lo que ha fallado y su teclado espera un momento
    expect(screen.getByText(`${partida.equipos[1].pregunta.texto} = ${r1}`)).toBeTruthy();
    pulsar(teclado('azul').getByRole('button', { name: '5' }));
    expect(screen.getAllByLabelText('Respuesta')[1].textContent).toBe('?');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(document.querySelector('.cu-tarjeta.azul.mal')).toBeNull();
    pulsar(teclado('azul').getByRole('button', { name: '5' }));
    expect(screen.getAllByLabelText('Respuesta')[1].textContent).toBe('5');
    pulsar(teclado('azul').getByRole('button', { name: 'Borrar' }));
    // Dos toques en «Go» sin nada escrito no cuentan
    pulsar(teclado('rojo').getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByLabelText('1 aciertos')).toBeTruthy();
    expect(screen.getByLabelText(/La cuerda: 1 de 3 hacia Equipo rojo/)).toBeTruthy();
  });

  it('en ESO el teclado lleva el signo menos y gana quien llega a la meta', () => {
    const { partida } = hastaLaPartida('e12', 'enteros');
    expect(teclado('rojo').getByRole('button', { name: 'Cambiar el signo' })).toBeTruthy();
    expect(teclado('azul').getByRole('button', { name: 'Cambiar el signo' })).toBeTruthy();
    let p = partida;
    for (let i = 0; i < 3; i++) {
      const r = p.equipos[1].pregunta.respuesta;
      escribir('azul', r);
      pulsar(teclado('azul').getByRole('button', { name: 'Comprobar' }));
      // La siguiente pregunta sale del mismo reductor: se calcula igual
      const siguiente: typeof p = JSON.parse(JSON.stringify(p));
      p = (() => {
        let q = siguiente;
        for (const c of String(r)) q = reducirTecla(q, c === '-' ? '-' : c);
        return reducirTecla(q, 'go');
      })();
    }
    expect(screen.getByText('¡Victoria de Equipo azul!')).toBeTruthy();
    // «Jugar otra vez» tarda un momento en poder pulsarse: quien seguía tecleando no empieza otra partida
    const otra = screen.getByRole('button', { name: 'Jugar otra vez' }) as HTMLButtonElement;
    expect(otra.disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(otra.disabled).toBe(false);
    // Con la partida acabada, los controles se pueden pulsar y la X sale a la primera
    expect(screen.getByRole('button', { name: 'Quitar la música' })).toBeTruthy();
  });

  it('en mitad de una partida, la X y el inicio piden un segundo toque; con el teclado (o el botón de atrás), a la primera', () => {
    const { onClose } = hastaLaPartida('p34', 'suma');
    pulsar(screen.getByRole('button', { name: 'Salir' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Toca otra vez la X para salir de la partida')).toBeTruthy();
    pulsar(screen.getByRole('button', { name: 'Salir' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    // El botón de atrás pulsa «Salir» por código (`click()`, sin puntero): sale a la primera
    (screen.getByRole('button', { name: 'Salir' }) as HTMLButtonElement).click();
    expect(onClose).toHaveBeenCalledTimes(2);
    pulsar(screen.getByRole('button', { name: 'Volver al inicio del juego' }));
    expect(document.querySelector('.cuerda')?.getAttribute('data-fase')).toBe('juego');
    act(() => { vi.advanceTimersByTime(3100); });
    expect(screen.queryByText('Toca otra vez para volver al inicio')).toBeNull();
    pulsar(screen.getByRole('button', { name: 'Volver al inicio del juego' }));
    pulsar(screen.getByRole('button', { name: 'Volver al inicio del juego' }));
    expect(document.querySelector('.cuerda')?.getAttribute('data-fase')).toBe('inicio');
  });

  it('el porcentaje inverso lleva un solo «=»; en inglés, «×» y «÷»', async () => {
    const { preguntaEnPantalla } = await import('../../lib/juegos/cuerda');
    expect(preguntaEnPantalla('15 % de ? = 30', false)).toBe('15\u00a0% de ?\u00a0=\u00a030');
    expect(preguntaEnPantalla('−4 · (−6 + 2) = ?', true)).toBe('−4 × (−6\u00a0+\u00a02)\u00a0=\u00a0?');
    expect(preguntaEnPantalla('63 : 9 = ?', true)).toBe('63 ÷ 9\u00a0=\u00a0?');
    expect(preguntaEnPantalla('63 : 9 = ?', false)).toBe('63 : 9\u00a0=\u00a0?');
  });

  it('la música suena solo tras un gesto, en bucle y baja; se calla y se recuerda; se para al salir', () => {
    const { unmount } = montar();
    expect(audios).toHaveLength(0);
    pulsar(screen.getByRole('button', { name: '¡A jugar!' }));
    expect(audios).toHaveLength(1);
    expect(audios[0]).toMatchObject({ src: MUSICA_CUERDA, loop: true, sonando: true });
    expect(audios[0].volume).toBeLessThanOrEqual(0.3);
    pulsar(screen.getByRole('button', { name: 'Quitar la música' }));
    expect(audios[0].sonando).toBe(false);
    expect(localStorage.getItem('aulapro_cuerda_silencio')).toBe('1');
    pulsar(screen.getByRole('button', { name: 'Poner la música' }));
    expect(audios[0].sonando).toBe(true);
    // De vuelta en la portada, quitar el silencio también la pone: el gesto ya existió
    pulsar(screen.getByRole('button', { name: 'Volver al inicio del juego' }));
    pulsar(screen.getByRole('button', { name: 'Quitar la música' }));
    pulsar(screen.getByRole('button', { name: 'Poner la música' }));
    expect(audios[0].sonando).toBe(true);
    unmount();
    expect(audios[0].sonando).toBe(false);
  });

  it('con el silencio guardado, no se pide la música', () => {
    localStorage.setItem('aulapro_cuerda_silencio', '1');
    montar();
    pulsar(screen.getByRole('button', { name: '¡A jugar!' }));
    expect(audios).toHaveLength(0);
  });
});

function reducirTecla(p: Partida, tecla: string): Partida {
  return reducirPartida(p, { tipo: 'tecla', equipo: 1, tecla: tecla as Tecla });
}
