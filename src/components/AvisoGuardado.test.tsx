// @vitest-environment jsdom
/**
 * El aviso de «Guardado» de Android: dice dónde quedó el archivo y sus botones
 * abren el archivo, la carpeta o el menú de compartir; si el dispositivo no sabe
 * abrirlo, lo cuenta; y se quita solo.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvisoGuardado, TIEMPO_AVISO_MS } from './AvisoGuardado';
import { I18nProvider } from '../i18n';
import { avisarGuardado, type Guardado } from '../lib/guardado';

const g: Guardado = { nombre: 'ficha-fracciones.pdf', carpeta: 'Fichas', uri: 'content://media/external/file/42', mime: 'application/pdf' };
const acciones = () => ({ abrir: vi.fn(async () => {}), abrirCarpeta: vi.fn(async () => {}), compartir: vi.fn(async () => {}) });

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('aviso de guardado en Android', () => {
  it('no sale hasta que se guarda algo', () => {
    render(<I18nProvider><AvisoGuardado acciones={acciones()} /></I18nProvider>);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('dice dónde quedó y sus botones llevan al archivo, a la carpeta y a compartir', async () => {
    const user = userEvent.setup();
    const a = acciones();
    render(<I18nProvider><AvisoGuardado acciones={a} /></I18nProvider>);
    act(() => avisarGuardado(g));
    expect(screen.getByText('ficha-fracciones.pdf')).toBeTruthy();
    expect(screen.getByText('Documentos › AulaPro › Fichas')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Ver carpeta/ }));
    await user.click(screen.getByRole('button', { name: /^Abrir/ }));
    await user.click(screen.getByRole('button', { name: /Compartir/ }));
    expect(a.abrirCarpeta).toHaveBeenCalledWith(g);
    expect(a.abrir).toHaveBeenCalledWith(g);
    expect(a.compartir).toHaveBeenCalledWith(g);
  });

  it('si el dispositivo no sabe abrirlo, lo dice y sigue ahí', async () => {
    const user = userEvent.setup();
    const a = { ...acciones(), abrirCarpeta: vi.fn(async () => { throw new Error('no'); }) };
    render(<I18nProvider><AvisoGuardado acciones={a} /></I18nProvider>);
    act(() => avisarGuardado(g));
    await user.click(screen.getByRole('button', { name: /Ver carpeta/ }));
    expect(screen.getByText(/no sabe abrirlo desde aquí/)).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('se quita solo, y un archivo nuevo vuelve a empezar la cuenta', () => {
    vi.useFakeTimers();
    render(<I18nProvider><AvisoGuardado acciones={acciones()} /></I18nProvider>);
    act(() => avisarGuardado(g));
    act(() => { vi.advanceTimersByTime(TIEMPO_AVISO_MS - 1000); });
    act(() => avisarGuardado({ ...g, nombre: 'acta.pdf', carpeta: 'Actas' }));
    act(() => { vi.advanceTimersByTime(TIEMPO_AVISO_MS - 1000); });
    expect(screen.getByText('acta.pdf')).toBeTruthy();
    expect(screen.getByText('Documentos › AulaPro › Actas')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
