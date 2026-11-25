// @vitest-environment jsdom
/**
 * Proyectar una ficha de ejercicios o una comprensión lectora un ejercicio por pantalla
 * (decisión del dueño, 25-11-2026): portada sencilla, un ejercicio en cada pantalla con su cuenta,
 * «Ver solución» de ese ejercicio, el lápiz que se limpia al pasar y deslizar el dedo.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChallengePresenter } from './ChallengePresenter';
import { I18nProvider } from '../../i18n';
import type { Ficha } from '../../types';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
afterEach(cleanup);
// El lienzo del lápiz mide su tamaño con ResizeObserver, que jsdom no tiene
beforeAll(() => {
  if (typeof ResizeObserver === 'undefined') {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
});

const ficha: Ficha = {
  id: 'f1', at: '2026-10-12T10:00:00Z', date: '2026-10-12', title: 'El viaje del agua',
  request: { tema: 'agua', area: 'Conocimiento del Medio', nivel: '5º', numEjercicios: 3, niveles: false, contextoClase: '' },
  content: {
    estilo: 'cuaderno', formato: 'ficha', titulo: 'El viaje del agua', explicacion: '', instrucciones: '',
    actividades: [
      { titulo: 'Las palabras del ciclo', dificultad: 1, ejercicios: [
        { tipo: 'relacionar', enunciado: 'Une cada fenómeno con lo que ocurre.', izquierda: ['Evaporación'], derecha: ['El agua pasa a vapor'], solucion: '1-A' },
        { tipo: 'verdadero_falso', enunciado: 'Marca V o F.', afirmaciones: ['El Sol evapora el agua.'], solucion: 'V' },
      ] },
      { titulo: 'Pensamos', dificultad: 2, ejercicios: [
        { tipo: 'abierta', enunciado: '¿Por qué llueve?', solucion: '' },
        // Un ejercicio sin escribir no se proyecta
        { tipo: 'abierta', enunciado: '', solucion: '' },
      ] },
    ],
  },
};

const renderIt = (f: Ficha, onClose = () => {}) => render(<I18nProvider><ChallengePresenter ficha={f} onClose={onClose} /></I18nProvider>);
const empezar = () => userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
const siguiente = () => userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
/** La solución se enseña en una franja encima del ejercicio, que solo existe mientras se ve. */
const solucion = () => screen.queryByTestId('cp-solucion');
/** Espera a que se vea una pantalla: su texto a la vista y la anterior ya fuera (la transición espera a que salga). */
const ver = async (texto: string | RegExp) => {
  await screen.findByText(texto);
  await waitFor(() => expect(document.querySelectorAll('.cp-uno-pantalla')).toHaveLength(1));
};
const E1 = 'Une cada fenómeno con lo que ocurre.', E2 = 'Marca V o F.', E3 = '¿Por qué llueve?';

describe('Proyectar una ficha de ejercicios', () => {
  it('la portada es sencilla: el título, cuántos ejercicios y empezar, sin la imagen ni el temporizador', () => {
    const { container } = renderIt(ficha);
    expect(screen.getByRole('heading', { name: 'El viaje del agua' })).toBeTruthy();
    expect(screen.getByText('3 ejercicios')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeTruthy();
    expect(container.querySelector('img, .theme-art')).toBeNull();
    expect(screen.queryByText(/Tiempo/)).toBeNull();
    expect(screen.queryByText(/Sin tiempo/)).toBeNull();
  });

  it('un ejercicio por pantalla, con su bloque, su nivel y «Ejercicio N de M»', async () => {
    renderIt(ficha);
    await empezar();
    expect(await screen.findByText('Une cada fenómeno con lo que ocurre.')).toBeTruthy();
    expect(screen.queryByText('Marca V o F.')).toBeNull();
    expect(screen.getByText('Ejercicio 1 de 3')).toBeTruthy();
    expect(screen.getByText(/Actividad 1 · Las palabras del ciclo/)).toBeTruthy();
    expect(screen.getByText(/Para empezar/)).toBeTruthy();
    await siguiente();
    expect(await screen.findByText('Marca V o F.')).toBeTruthy();
    expect(screen.getByText('Ejercicio 2 de 3')).toBeTruthy();
    await siguiente();
    expect(await screen.findByText('¿Por qué llueve?')).toBeTruthy();
    expect(screen.getByText('Ejercicio 3 de 3')).toBeTruthy();
    expect(screen.getByText(/Actividad 2 · Pensamos/)).toBeTruthy();
    // Tras el último, el final con el trofeo
    await siguiente();
    expect(await screen.findByText('¡Misión cumplida!')).toBeTruthy();
  });

  it('las flechas del teclado pasan de ejercicio', async () => {
    renderIt(ficha);
    await empezar();
    await ver(E1);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(await screen.findByText('Ejercicio 2 de 3')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(await screen.findByText('Ejercicio 1 de 3')).toBeTruthy();
  });

  it('«Ver solución» enseña solo la del ejercicio que se ve y se oculta al pasar a otro', async () => {
    renderIt(ficha);
    await empezar();
    await ver(E1);
    // No hay ojo global de soluciones arriba
    expect(screen.queryByTitle(/Ver soluciones/)).toBeNull();
    expect(solucion()).toBeNull();
    // La solución no ocupa sitio en el ejercicio mientras no se enseña: no encoge su letra
    expect(document.body.textContent).not.toContain('1-A');
    await userEvent.click(screen.getByRole('button', { name: /Ver solución/ }));
    expect(solucion()?.textContent).toContain('1-A');
    // Solo hay una solución en pantalla: la de este ejercicio
    expect(screen.getAllByTestId('cp-solucion')).toHaveLength(1);
    await siguiente();
    await ver(E2);
    expect(solucion()).toBeNull();
    expect(screen.getByRole('button', { name: /Ver solución/ }).getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: /Ver solución/ }));
    expect(solucion()?.textContent).toContain('V');
  });

  it('la tecla S enseña y oculta la solución del ejercicio que se ve', async () => {
    renderIt(ficha);
    await empezar();
    await ver(E1);
    fireEvent.keyDown(window, { key: 's' });
    expect(solucion()).toBeTruthy();
    fireEvent.keyDown(window, { key: 'S' });
    expect(solucion()).toBeNull();
  });

  it('Ctrl+S y Ctrl+F son del navegador: no enseñan la solución ni cambian nada', async () => {
    renderIt(ficha);
    await empezar();
    await ver(E1);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    expect(solucion()).toBeNull();
    expect(screen.getByText('Ejercicio 1 de 3')).toBeTruthy();
  });

  it('el recuadro lleva la marca de la hoja: en «Cuaderno», letras con cálculos y nada si el bloque tiene un solo ejercicio', async () => {
    const f: Ficha = { ...ficha, content: { ...ficha.content, actividades: [
      { titulo: 'Cuentas', ejercicios: [
        { tipo: 'calculos', enunciado: 'Calcula.', lineas: ['2 + 2'], solucion: '' },
        { tipo: 'abierta', enunciado: 'Explica cómo.', solucion: '' },
      ] },
      { titulo: 'Solo', ejercicios: [{ tipo: 'abierta', enunciado: 'Uno solo.', solucion: '' }] },
    ] } };
    const { container } = renderIt(f);
    await empezar();
    await ver('Calcula.');
    expect(container.querySelector('.cp-ex-n')?.textContent).toBe('A');
    await siguiente();
    await ver('Explica cómo.');
    expect(container.querySelector('.cp-ex-n')?.textContent).toBe('B');
    await siguiente();
    await ver('Uno solo.');
    expect(container.querySelector('.cp-ex-n')).toBeNull();
  });

  it('«Borrar todo lo escrito» con el borrador puesto vuelve al lápiz', async () => {
    const { container } = renderIt(ficha);
    await empezar();
    await ver(E1);
    await userEvent.click(screen.getByRole('button', { name: 'Lápiz' }));
    const lienzo = container.querySelector('[data-testid="pizarra-lienzo"]') as HTMLCanvasElement;
    act(() => {
      lienzo.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
      lienzo.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 40, clientY: 30 }));
      lienzo.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 40, clientY: 30 }));
    });
    await userEvent.click(screen.getByRole('button', { name: 'Borrador' }));
    expect(screen.getByRole('button', { name: 'Borrador' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Borrar todo lo escrito' }));
    expect(screen.getByRole('button', { name: 'Borrador' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Lápiz' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('una ficha sin ningún ejercicio escrito lo dice en la portada y no lleva al final', () => {
    const f: Ficha = { ...ficha, content: { ...ficha.content, actividades: [{ titulo: 'A', ejercicios: [{ tipo: 'abierta', enunciado: '', solucion: '' }] }] } };
    renderIt(f);
    expect(screen.getByText('Esta ficha aún no tiene ejercicios escritos.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Empezar' })).toBeNull();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.queryByText('¡Misión cumplida!')).toBeNull();
  });

  it('mientras se proyecta, la página de debajo no se desplaza', () => {
    const { unmount } = renderIt(ficha);
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('un ejercicio sin solución no tiene «Ver solución»', async () => {
    renderIt(ficha);
    await empezar();
    await siguiente(); await siguiente();
    await ver(E3);
    expect(screen.queryByRole('button', { name: /Ver solución/ })).toBeNull();
  });

  it('lo escrito con el lápiz se borra al pasar de ejercicio, y el lápiz se apaga', async () => {
    const { container } = renderIt(ficha);
    await empezar();
    await ver(E1);
    const lapiz = screen.getByRole('button', { name: 'Lápiz' });
    await userEvent.click(lapiz);
    expect(lapiz.getAttribute('aria-pressed')).toBe('true');
    const lienzo = container.querySelector('[data-testid="pizarra-lienzo"]') as HTMLCanvasElement;
    expect(lienzo.style.pointerEvents).toBe('auto');
    // Un trazo
    act(() => {
      lienzo.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
      lienzo.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 40, clientY: 30 }));
      lienzo.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 40, clientY: 30 }));
    });
    const borrar = screen.getByRole('button', { name: 'Borrar todo lo escrito' }) as HTMLButtonElement;
    expect(borrar.disabled).toBe(false);
    await siguiente();
    await ver(E2);
    const nuevo = container.querySelector('[data-testid="pizarra-lienzo"]') as HTMLCanvasElement;
    expect(nuevo).not.toBe(lienzo);
    expect(nuevo.style.pointerEvents).toBe('none');
    expect((screen.getByRole('button', { name: 'Borrar todo lo escrito' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Lápiz' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('deslizar el dedo a la izquierda pasa al siguiente y a la derecha, al anterior; un toque no', async () => {
    const { container } = renderIt(ficha);
    await empezar();
    await ver(E1);
    const deslizar = (desde: number, hasta: number) => {
      const zona = container.querySelector('.cp-uno-caja')!;
      fireEvent.pointerDown(zona, { pointerType: 'touch', pointerId: 1, clientX: desde, clientY: 300 });
      fireEvent.pointerUp(zona, { pointerType: 'touch', pointerId: 1, clientX: hasta, clientY: 305 });
    };
    deslizar(600, 598);
    expect(screen.getByText('Ejercicio 1 de 3')).toBeTruthy();
    deslizar(600, 380);
    await ver(E2);
    expect(screen.getByText('Ejercicio 2 de 3')).toBeTruthy();
    deslizar(380, 640);
    await ver(E1);
    expect(screen.getByText('Ejercicio 1 de 3')).toBeTruthy();
  });

  it('con el lápiz encendido, deslizar no pasa de ejercicio', async () => {
    const { container } = renderIt(ficha);
    await empezar();
    await ver(E1);
    await userEvent.click(screen.getByRole('button', { name: 'Lápiz' }));
    const zona = container.querySelector('.cp-uno-caja')!;
    fireEvent.pointerDown(zona, { pointerType: 'touch', pointerId: 1, clientX: 600, clientY: 300 });
    fireEvent.pointerUp(zona, { pointerType: 'touch', pointerId: 1, clientX: 300, clientY: 300 });
    expect(screen.getByText('Ejercicio 1 de 3')).toBeTruthy();
  });

  it('deslizar desde el botón de un lado pasa una sola vez, aunque el dedo acabe sobre él', async () => {
    renderIt(ficha);
    await empezar();
    await ver(E1);
    const sig = screen.getByRole('button', { name: 'Siguiente' });
    fireEvent.pointerDown(sig, { pointerType: 'touch', pointerId: 1, clientX: 1000, clientY: 300 });
    fireEvent.pointerUp(sig, { pointerType: 'touch', pointerId: 1, clientX: 900, clientY: 300 });
    fireEvent.click(sig);
    await ver(E2);
    expect(screen.getByText('Ejercicio 2 de 3')).toBeTruthy();
  });

  it('deslizar sobre una tabla no pasa de ejercicio', async () => {
    const conTabla: Ficha = { ...ficha, content: { ...ficha.content, actividades: [{ titulo: 'Tabla', ejercicios: [
      { tipo: 'tabla_rellenar', enunciado: 'Completa la tabla.', columnas: ['A', 'B'], filas: [['1', '']], solucion: '' },
      { tipo: 'abierta', enunciado: 'Otro', solucion: '' },
    ] }] } };
    const { container } = renderIt(conTabla);
    await empezar();
    await ver('Completa la tabla.');
    const celda = container.querySelector('.cp-table td')!;
    fireEvent.pointerDown(celda, { pointerType: 'touch', pointerId: 1, clientX: 600, clientY: 300 });
    fireEvent.pointerUp(celda, { pointerType: 'touch', pointerId: 1, clientX: 300, clientY: 300 });
    expect(screen.getByText('Ejercicio 1 de 2')).toBeTruthy();
  });

  it('Esc sale de la proyección', async () => {
    const onClose = vi.fn();
    renderIt(ficha, onClose);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('los asteriscos se quitan de los enunciados', async () => {
    const f: Ficha = { ...ficha, content: { ...ficha.content, actividades: [{ titulo: 'A', ejercicios: [{ tipo: 'abierta', enunciado: '**Explica** el ciclo.', solucion: '' }] }] } };
    const { container } = renderIt(f);
    await empezar();
    expect(await screen.findByText('Explica el ciclo.')).toBeTruthy();
    expect(container.textContent).not.toContain('**');
  });
});

describe('Proyectar una comprensión lectora', () => {
  const lectura: Ficha = {
    id: 'l1', at: '2026-10-17T10:00:00Z', date: '2026-10-17', title: 'El dragón',
    request: { tema: 'dragón', area: 'Lengua', nivel: '3º', numEjercicios: 2, niveles: false, contextoClase: '' },
    content: {
      estilo: 'cuaderno', formato: 'ficha', titulo: 'El dragón sin fuego', explicacion: '', instrucciones: '', variante: 'lectura_facil',
      lectura: { genero: 'cuento', parrafos: ['Había un **dragón** solo.', 'Un día llegó un amigo.'], dibujos: [{ ilustracion: 'cue-dragon', parrafo: 0 }], pista: 'Fíjate en el dragón.' },
      actividades: [{ titulo: 'Buscamos', ejercicios: [
        { tipo: 'en_texto', enunciado: 'Rodea en el texto quién llegó.', solucion: 'Un amigo' },
        { tipo: 'abierta', enunciado: '¿Cómo se sentía el dragón?', solucion: 'Solo' },
      ] }],
    },
  };

  it('la portada cuenta el texto y los ejercicios; después, el texto con sus dibujos y sus negritas, en lectura fácil', async () => {
    const { container } = renderIt(lectura);
    expect(screen.getByText('Un texto y 2 ejercicios')).toBeTruthy();
    await empezar();
    expect(await screen.findByText('Fíjate en el dragón.', { exact: false })).toBeTruthy();
    expect(container.querySelector('.cp-uno.facil')).toBeTruthy();
    expect(container.querySelector('.cp-lectura-texto b')?.textContent).toBe('dragón');
    expect(container.querySelector('.cp-lectura-img')).toBeTruthy();
    expect(container.textContent).not.toContain('**');
    expect(screen.getByTitle('El texto')).toBeTruthy();
    await siguiente();
    expect(await screen.findByText(/Rodea en el texto quién llegó/)).toBeTruthy();
    expect(screen.getByText(/Actividad 1 · Buscamos/)).toBeTruthy();
    expect(screen.getByText('Ejercicio 1 de 2')).toBeTruthy();
  });

  it('con un solo ejercicio, la portada lo dice en singular', () => {
    renderIt({ ...lectura, content: { ...lectura.content, actividades: [{ titulo: 'Buscamos', ejercicios: [lectura.content.actividades![0].ejercicios[0]] }] } });
    expect(screen.getByText('Un texto y 1 ejercicio')).toBeTruthy();
  });

  it('un ejercicio «Rodea en el texto» lleva el texto en su pantalla, para rodear con el lápiz', async () => {
    const { container } = renderIt(lectura);
    await empezar();
    await siguiente();
    await ver(/Rodea en el texto quién llegó/);
    expect(container.querySelector('.cp-ex .cp-lectura-texto')).toBeTruthy();
    expect(screen.getByText('Un día llegó un amigo.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ver el texto/ })).toBeNull();
  });

  it('en los demás ejercicios, «Ver el texto» lo enseña en lugar del ejercicio, sin tocarlo, y al pasar se vuelve a ocultar', async () => {
    const { container } = renderIt(lectura);
    await empezar();
    await siguiente(); await siguiente();
    await ver('¿Cómo se sentía el dragón?');
    const texto = () => container.querySelector('.cp-uno-caja:not(.oculta) .cp-lectura-texto');
    expect(texto()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Ver el texto/ }));
    expect(texto()).toBeTruthy();
    // El ejercicio sigue montado debajo, con su lienzo: lo escrito en él no se mueve
    expect(container.querySelector('.cp-uno-caja.oculta .cp-ex')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="pizarra-lienzo"]')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /Volver al ejercicio/ }));
    expect(texto()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Ver el texto/ }));
    // «Ver solución» vuelve al ejercicio, que es de quien es la solución
    await userEvent.click(screen.getByRole('button', { name: /Ver solución/ }));
    expect(texto()).toBeNull();
    expect(solucion()?.textContent).toContain('Solo');
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await ver('¿Cómo se sentía el dragón?');
    expect(texto()).toBeNull();
  });
});
