// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { LecturaEditor } from './LecturaEditor';
import { I18nProvider } from '../../i18n';
import type { FichaLectura } from '../../lib/lectura';

afterEach(cleanup);

const inicial = (): FichaLectura => ({
  genero: 'cuento', parrafos: ['Primero.', 'Segundo.', 'Tercero.'],
  dibujos: [{ ilustracion: 'cue-dragon', parrafo: 0 }, { ilustracion: 'cue-mago', parrafo: 2 }],
  pista: 'Fíjate.', destrezas: ['Vocabulario'],
});

function montar(l = inicial()) {
  const ultimo = { valor: l };
  function Envuelto() {
    const [lec, setLec] = useState(l);
    ultimo.valor = lec;
    return <LecturaEditor lectura={lec} onChange={setLec} t={(k, v) => (v ? k.replace(/\{(\w+)\}/g, (_, n) => String(v[n])) : k)} />;
  }
  render(<I18nProvider><Envuelto /></I18nProvider>);
  return ultimo;
}

describe('el editor del texto de lectura', () => {
  it('muestra el tipo, la pista, lo que se trabaja y cada párrafo con las palabras que lleva el texto', () => {
    montar();
    expect((screen.getByLabelText('Tipo de texto') as HTMLSelectElement).value).toBe('cuento');
    expect(screen.getByDisplayValue('Fíjate.')).toBeTruthy();
    expect(screen.getByDisplayValue('Vocabulario')).toBeTruthy();
    expect(screen.getByDisplayValue('Segundo.')).toBeTruthy();
    expect(screen.getByText(/3 palabras/)).toBeTruthy();
  });

  it('cambia el tipo de texto, la pista y las etiquetas (como mucho dos)', () => {
    const l = montar();
    fireEvent.change(screen.getByLabelText('Tipo de texto'), { target: { value: 'poema' } });
    expect(l.valor.genero).toBe('poema');
    expect(screen.getByText('Estrofas')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Fíjate.'), { target: { value: 'Mira bien.' } });
    expect(l.valor.pista).toBe('Mira bien.');
    fireEvent.change(screen.getByDisplayValue('Vocabulario'), { target: { value: 'Rimas, Orden, Otra' } });
    expect(l.valor.destrezas).toEqual(['Rimas', 'Orden']);
  });

  it('editar un párrafo, añadir uno y eliminar otro', async () => {
    const l = montar();
    fireEvent.change(screen.getByDisplayValue('Segundo.'), { target: { value: 'Segundo cambiado.' } });
    expect(l.valor.parrafos[1]).toBe('Segundo cambiado.');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir párrafo' }));
    expect(l.valor.parrafos).toEqual(['Primero.', 'Segundo cambiado.', 'Tercero.', '']);
    // Eliminar el primero: su dibujo se va y el del tercero pasa al segundo
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    expect(l.valor.parrafos).toEqual(['Segundo cambiado.', 'Tercero.', '']);
    expect(l.valor.dibujos).toEqual([{ ilustracion: 'cue-mago', parrafo: 1 }]);
  });

  it('mover un párrafo se lleva su dibujo', async () => {
    const l = montar();
    await userEvent.click(screen.getAllByRole('button', { name: 'Bajar' })[0]);
    expect(l.valor.parrafos).toEqual(['Segundo.', 'Primero.', 'Tercero.']);
    expect(l.valor.dibujos).toEqual([{ ilustracion: 'cue-dragon', parrafo: 1 }, { ilustracion: 'cue-mago', parrafo: 2 }]);
    await userEvent.click(screen.getAllByRole('button', { name: 'Subir' })[2]);
    expect(l.valor.parrafos).toEqual(['Segundo.', 'Tercero.', 'Primero.']);
    expect(l.valor.dibujos.find(d => d.ilustracion === 'cue-mago')!.parrafo).toBe(1);
  });

  it('no se puede quitar el último párrafo ni mover los de los extremos', () => {
    montar({ ...inicial(), parrafos: ['Único.'], dibujos: [] });
    expect((screen.getByRole('button', { name: 'Eliminar' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Subir' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Bajar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('quitar el dibujo de un párrafo y poner uno nuevo del catálogo en otro', async () => {
    const l = montar();
    await userEvent.click(screen.getAllByRole('button', { name: 'Quitar el dibujo' })[0]);
    expect(l.valor.dibujos).toEqual([{ ilustracion: 'cue-mago', parrafo: 2 }]);
    // El párrafo 1 ya no tiene: se le pone la princesa
    await userEvent.click(screen.getAllByRole('button', { name: 'Poner un dibujo' })[0]);
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar un dibujo' }), 'princesa');
    await userEvent.click(screen.getAllByTitle(/Princesa/i)[0]);
    expect(l.valor.dibujos.some(d => d.ilustracion === 'cue-princesa' && d.parrafo === 0)).toBe(true);
    expect(l.valor.dibujos.filter(d => d.parrafo === 0)).toHaveLength(1);
  });

  it('poner un dibujo que ya está en otro párrafo lo cambia de sitio: un dibujo no se repite', async () => {
    const l = montar();
    await userEvent.click(screen.getAllByRole('button', { name: 'Poner un dibujo' })[0]);
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar un dibujo' }), 'dragón');
    await userEvent.click(screen.getAllByTitle(/Dragón/i)[0]);
    expect(l.valor.dibujos.filter(d => d.ilustracion === 'cue-dragon')).toEqual([{ ilustracion: 'cue-dragon', parrafo: 1 }]);
  });
});
