// @vitest-environment jsdom
/**
 * El aviso que sale tras cada borrado (20-11-2026): dice qué se ha borrado, lleva «Deshacer» y se retira solo a los diez segundos.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AvisoDeshacer } from './AvisoDeshacer';
import { ToastProvider } from './ToastProvider';
import { I18nProvider } from '../../i18n';
import { DURACION_DESHACER_MS, type Borrado } from '../../lib/deshacer';

type Pendiente = { id: number; borrados: Borrado[] } | null;
const CLASE: Pendiente = { id: 1, borrados: [{ tipo: 'clase', nombre: '3.º A' }] };

function pintar(pendiente: Pendiente = CLASE, onDeshacer = vi.fn(() => true), onOlvidar = vi.fn()) {
  const arbol = (p: Pendiente) => (
    <I18nProvider><ToastProvider><AvisoDeshacer pendiente={p} onDeshacer={onDeshacer} onOlvidar={onOlvidar} /></ToastProvider></I18nProvider>
  );
  const r = render(arbol(pendiente));
  return { onDeshacer, onOlvidar, cambiar: (p: Pendiente) => r.rerender(arbol(p)) };
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('el aviso con «Deshacer»', () => {
  it('sin nada borrado no se ve', () => {
    pintar(null);
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });

  it('dice qué se ha borrado y lleva el botón', () => {
    pintar();
    expect(screen.getByText('Has eliminado la clase «3.º A» y todo lo suyo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeTruthy();
    // Se anuncia a quien usa lector de pantalla
    expect(document.querySelector('.deshacer[role=status]')?.textContent).toContain('3.º A');
  });

  it('«Deshacer» repone lo borrado y lo confirma', () => {
    const { onDeshacer, onOlvidar } = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(onDeshacer).toHaveBeenCalledTimes(1);
    expect(onOlvidar).not.toHaveBeenCalled();
    expect(screen.getByText('Recuperado: está todo como antes')).toBeTruthy();
  });

  it('si ya no se puede deshacer, no dice que se ha recuperado', () => {
    pintar(CLASE, vi.fn(() => false));
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.queryByText('Recuperado: está todo como antes')).toBeNull();
  });

  it('se retira solo a los diez segundos, no antes', () => {
    const { onOlvidar } = pintar();
    act(() => { vi.advanceTimersByTime(DURACION_DESHACER_MS - 100); });
    expect(onOlvidar).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onOlvidar).toHaveBeenCalledTimes(1);
  });

  it('la X lo cierra', () => {
    const { onOlvidar } = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onOlvidar).toHaveBeenCalledTimes(1);
  });

  it('con el ratón encima el tiempo se para, y sigue al apartarlo', () => {
    const { onOlvidar } = pintar();
    const caja = document.querySelector('.deshacer')!;
    act(() => { vi.advanceTimersByTime(6000); });
    fireEvent.pointerEnter(caja, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(onOlvidar).not.toHaveBeenCalled();
    fireEvent.pointerLeave(caja, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(3900); });
    expect(onOlvidar).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onOlvidar).toHaveBeenCalledTimes(1);
  });

  it('con el foco dentro (teclado) también se para', () => {
    const { onOlvidar } = pintar();
    const boton = screen.getByRole('button', { name: 'Deshacer' });
    act(() => { boton.focus(); });
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(onOlvidar).not.toHaveBeenCalled();
    act(() => { boton.blur(); });
    act(() => { vi.advanceTimersByTime(DURACION_DESHACER_MS + 100); });
    expect(onOlvidar).toHaveBeenCalledTimes(1);
  });

  it('un borrado nuevo sustituye al anterior y empieza a contar de cero', () => {
    const { onOlvidar, cambiar } = pintar();
    act(() => { vi.advanceTimersByTime(8000); });
    cambiar({ id: 2, borrados: [{ tipo: 'ficha', nombre: 'Fracciones' }] });
    expect(screen.getByText('Has eliminado la ficha «Fracciones».')).toBeTruthy();
    expect(screen.queryByText(/3\.º A/)).toBeNull();
    act(() => { vi.advanceTimersByTime(8000); });
    expect(onOlvidar).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2100); });
    expect(onOlvidar).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Z deshace, salvo que se esté escribiendo en un campo', () => {
    const { onDeshacer } = pintar();
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    fireEvent.keyDown(campo, { key: 'z', ctrlKey: true });
    expect(onDeshacer).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(onDeshacer).toHaveBeenCalledTimes(1);
    campo.remove();
  });

  it('sin aviso a la vista, Ctrl+Z no hace nada', () => {
    const { onDeshacer } = pintar(null);
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(onDeshacer).not.toHaveBeenCalled();
  });

  it('en inglés y en catalán', () => {
    localStorage.setItem('aulapro_lang', 'en');
    pintar();
    expect(screen.getByText('You deleted the class «3.º A» and everything in it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    cleanup();
    localStorage.setItem('aulapro_lang', 'ca');
    pintar();
    expect(screen.getByText('Has eliminat la classe «3.º A» i tot el que tenia.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desfés' })).toBeTruthy();
  });
});
