// @vitest-environment jsdom
/**
 * Proyectar un reto: la portada con la misión, el candado digital del escape
 * room (solo se abre con el código bueno), el final y las tarjetas que se giran.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChallengePresenter } from './ChallengePresenter';
import { I18nProvider } from '../../i18n';
import type { Ficha } from '../../types';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
afterEach(cleanup);

const base: Ficha = {
  id: 'f1', at: '2026-09-29T10:00:00Z', date: '2026-09-29', title: 'El tesoro',
  request: { tema: 'decimales', area: 'Matemáticas', nivel: '5º', numEjercicios: 2, niveles: false, contextoClase: '' },
  content: {
    formato: 'escape', estilo: 'piratas', titulo: 'El tesoro del capitán',
    historia: { personaje: 'Capitana Brisa', emoji: '🏴‍☠️', mision: 'Abrid los candados.', cierre: 'Sois libres.', insignia: 'Maestros' },
    explicacion: '', instrucciones: '',
    actividades: [
      { titulo: 'La bodega', ejercicios: [{ tipo: 'completar', enunciado: '0,4 × 10 = __', solucion: '4' }], candado: { codigo: '47', pista: 'Los resultados' } },
    ],
  },
};

const renderIt = (f: Ficha) => render(<I18nProvider><ChallengePresenter ficha={f} onClose={() => {}} /></I18nProvider>);

describe('ChallengePresenter', () => {
  it('portada con la misión y, al empezar, la primera sala', async () => {
    renderIt(base);
    expect(screen.getByText('Abrid los candados.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Empezar a escapar/ }));
    expect(await screen.findByText('0,4 × 10 = __')).toBeTruthy();
    expect(screen.getByText('Los resultados')).toBeTruthy();
  });

  it('el candado solo se abre con el código correcto', async () => {
    renderIt(base);
    await userEvent.click(screen.getByRole('button', { name: /Empezar a escapar/ }));
    const boxes = await screen.findAllByLabelText(/Carácter \d del código/);
    expect(boxes).toHaveLength(3);
    fireEvent.change(boxes[0], { target: { value: '1' } });
    fireEvent.change(boxes[1], { target: { value: '2' } });
    fireEvent.change(boxes[2], { target: { value: '3' } });
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByText(/Código incorrecto/)).toBeTruthy();
  });

  it('con el código bueno se abre y el final muestra la insignia', async () => {
    const f = { ...base, content: { ...base.content, actividades: [{ ...base.content.actividades[0], candado: { codigo: '473', pista: '' } }] } };
    renderIt(f);
    await userEvent.click(screen.getByRole('button', { name: /Empezar a escapar/ }));
    const boxes = await screen.findAllByLabelText(/Carácter \d del código/);
    ['4', '7', '3'].forEach((v, i) => fireEvent.change(boxes[i], { target: { value: v } }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByText(/¡Abierto!/)).toBeTruthy();
    await userEvent.click(screen.getByTitle('Final'));
    expect(await screen.findByText('¡Habéis escapado!')).toBeTruthy();
    expect(screen.getByText('Maestros')).toBeTruthy();
  });

  it('las tarjetas se giran para ver la respuesta y se pasan', async () => {
    const f: Ficha = { ...base, content: { ...base.content, formato: 'tarjetas', actividades: [], tarjetas: [{ pregunta: '¿2+2?', respuesta: 'Cuatro' }, { pregunta: '¿3+3?', respuesta: 'Seis' }] } };
    renderIt(f);
    await userEvent.click(screen.getByRole('button', { name: /Empezar el juego/ }));
    expect(await screen.findByText('¿2+2?')).toBeTruthy();
    const card = screen.getByRole('button', { name: 'Ver la respuesta' });
    await userEvent.click(card);
    expect(card.className).toContain('flipped');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('¿3+3?')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });
});

describe('ChallengePresenter · asteriscos de negrita', () => {
  it('la IA marca **así** donde le parece: en pantalla no salen asteriscos, ni en la misión ni en el enunciado ni en la pista', async () => {
    const f: Ficha = {
      ...base,
      content: {
        ...base.content,
        titulo: 'El **tesoro**',
        historia: { ...base.content.historia!, mision: 'Abrid los **candados**.' },
        actividades: [{
          titulo: 'La **bodega**',
          ejercicios: [{ tipo: 'completar', enunciado: '**Completa**: 0,4 × 10 = __', solucion: '4' }],
          candado: { codigo: '47', pista: 'Los **resultados**' },
        }],
      },
    };
    const { container } = renderIt(f);
    expect(screen.getByText('Abrid los candados.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Empezar a escapar/ }));
    expect(await screen.findByText('Completa: 0,4 × 10 = __')).toBeTruthy();
    expect(screen.getByText('Los resultados')).toBeTruthy();
    expect(container.textContent).not.toContain('**');
  });
});

describe('ChallengePresenter · comprensión lectora', () => {
  const lectura: Ficha = {
    id: 'l1', at: '2026-10-17T10:00:00Z', date: '2026-10-17', title: 'El dragón',
    request: { tema: 'dragón', area: 'Lengua', nivel: '3º', numEjercicios: 2, niveles: false, contextoClase: '' },
    content: {
      estilo: 'cuaderno', formato: 'ficha', titulo: 'El dragón sin fuego', explicacion: '', instrucciones: '', variante: 'lectura_facil',
      lectura: { genero: 'cuento', parrafos: ['Había un **dragón** solo.', 'Un día llegó un amigo.'], dibujos: [{ ilustracion: 'cue-dragon', parrafo: 0 }], pista: 'Fíjate en el dragón.' },
      actividades: [{ titulo: 'Buscamos', ejercicios: [{ tipo: 'abierta', enunciado: '¿Quién llegó?', solucion: 'Un amigo' }] }],
    },
  };

  it('tras la portada hay una pantalla con el texto, con sus dibujos y sus negritas; los bloques vienen después', async () => {
    const { container } = renderIt(lectura);
    await userEvent.click(screen.getByRole('button', { name: /Empezar la misión/ }));
    expect(await screen.findByText('Fíjate en el dragón.', { exact: false })).toBeTruthy();
    expect(container.querySelector('.cp-lectura.facil')).toBeTruthy();
    expect(container.querySelector('.cp-lectura-texto b')?.textContent).toBe('dragón');
    expect(container.querySelector('.cp-lectura-img')).toBeTruthy();
    expect(screen.getByText('Un día llegó un amigo.')).toBeTruthy();
    expect(container.textContent).not.toContain('**');
    // Siguiente: el primer bloque, que sigue siendo el «1»
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText(/Actividad 1 · Buscamos/)).toBeTruthy();
    expect(screen.getByText('¿Quién llegó?')).toBeTruthy();
  });

  it('el mapa tiene su punto para el texto y no cuenta como un bloque', async () => {
    renderIt(lectura);
    await userEvent.click(screen.getByRole('button', { name: /Empezar la misión/ }));
    expect(screen.getByTitle('El texto')).toBeTruthy();
    await userEvent.click(screen.getByTitle(/Actividad 1: Buscamos/));
    expect(await screen.findByText('¿Quién llegó?')).toBeTruthy();
  });

  it('una ficha sin texto sigue igual: de la portada al primer bloque', async () => {
    renderIt(base);
    await userEvent.click(screen.getByRole('button', { name: /Empezar a escapar/ }));
    expect(screen.queryByTitle('El texto')).toBeNull();
  });
});

