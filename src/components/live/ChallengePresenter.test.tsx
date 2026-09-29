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
