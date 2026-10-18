// @vitest-environment jsdom
/**
 * El autoguardado: la copia se hace poco después de cada cambio sin guardar,
 * también al salir de la pantalla; al guardar de verdad se borra, y al volver
 * se ofrece lo que quedó (sin ofrecer lo caducado).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useBorrador } from './useBorrador';
import { ESPERA_MS, CADUCA_EN_MS, guardarBorrador, leerBorrador } from '../services/borradores';

function Pantalla() {
  const [texto, setTexto] = useState('');
  const [sinGuardar, setSinGuardar] = useState(false);
  const b = useBorrador<{ texto: string }>('ficha', sinGuardar ? { texto } : null, texto);
  return (
    <div>
      <input aria-label="texto" value={texto} onChange={e => { setTexto(e.target.value); setSinGuardar(true); }} />
      <button onClick={() => setSinGuardar(false)}>guardar</button>
      {b.encontrado && (
        <button onClick={() => { const d = b.continuar(); if (d) { setTexto(d.texto); setSinGuardar(true); } }}>continuar: {b.encontrado.titulo}</button>
      )}
      <button onClick={b.descartar}>descartar</button>
      <span data-testid="hora">{b.guardadoEn ?? ''}</span>
    </div>
  );
}

const cambiar = (v: string) => {
  const input = screen.getByLabelText('texto') as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { set.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })); });
};

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useBorrador', () => {
  it('guarda la copia poco después del último cambio, y no antes', () => {
    render(<Pantalla />);
    cambiar('Las fracciones');
    expect(leerBorrador('ficha')).toBeNull();
    act(() => { vi.advanceTimersByTime(ESPERA_MS + 10); });
    expect(leerBorrador<{ texto: string }>('ficha')?.datos.texto).toBe('Las fracciones');
  });

  it('al guardar de verdad, la copia se borra', () => {
    render(<Pantalla />);
    cambiar('Algo');
    act(() => { vi.advanceTimersByTime(ESPERA_MS + 10); });
    expect(leerBorrador('ficha')).not.toBeNull();
    act(() => { screen.getByText('guardar').click(); });
    expect(leerBorrador('ficha')).toBeNull();
  });

  it('al salir de la pantalla con cambios sin guardar, la copia queda hecha aunque no pasara la espera', () => {
    const r = render(<Pantalla />);
    cambiar('A medias');
    r.unmount();
    expect(leerBorrador<{ texto: string }>('ficha')?.datos.texto).toBe('A medias');
  });

  it('al volver ofrece lo que quedó, se continúa y se puede descartar', () => {
    guardarBorrador('ficha', { texto: 'Quedó a medias' }, 'Quedó a medias');
    render(<Pantalla />);
    act(() => { screen.getByText('continuar: Quedó a medias').click(); });
    expect((screen.getByLabelText('texto') as HTMLInputElement).value).toBe('Quedó a medias');
    expect(screen.queryByText(/continuar:/)).toBeNull();
    cleanup();

    guardarBorrador('ficha', { texto: 'Otra' }, 'Otra');
    render(<Pantalla />);
    act(() => { screen.getByText('descartar').click(); });
    expect(leerBorrador('ficha')).toBeNull();
    expect(screen.queryByText(/continuar:/)).toBeNull();
  });

  it('una copia caducada no se ofrece', () => {
    guardarBorrador('ficha', { texto: 'Vieja' }, 'Vieja');
    vi.setSystemTime(Date.now() + CADUCA_EN_MS + 1000);
    render(<Pantalla />);
    expect(screen.queryByText(/continuar:/)).toBeNull();
    expect(leerBorrador('ficha')).toBeNull();
  });

  it('no se toca lo de otro tipo ni se rompe sin almacenamiento', () => {
    guardarBorrador('sda', { texto: 'De otra pantalla' }, 'x');
    render(<Pantalla />);
    expect(screen.queryByText(/continuar:/)).toBeNull();
    const roto = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('sin espacio'); });
    cambiar('Algo');
    expect(() => act(() => { vi.advanceTimersByTime(ESPERA_MS + 10); })).not.toThrow();
    roto.mockRestore();
  });
});
