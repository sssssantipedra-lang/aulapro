// @vitest-environment jsdom
/**
 * El aviso del acceso anticipado gratuito (5-11-2026, petición del dueño): quien entra en la beta tiene que leer que es temporal,
 * que después pasa a ser de pago y que puede descargar su trabajo, y marcar una casilla para seguir. Solo lo ve la licencia de beta.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AvisoAccesoAnticipado } from './AvisoAccesoAnticipado';
import { I18nProvider } from '../i18n';
import { avisoBetaVisto, hayQueEnseñarAvisoBeta, marcarAvisoBetaVisto, VERSION_AVISO_BETA } from '../lib/avisoBeta';

const pintar = (onContinuar = vi.fn()) => { render(<I18nProvider><AvisoAccesoAnticipado onContinuar={onContinuar} /></I18nProvider>); return onContinuar; };

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('el aviso al entrar en el acceso anticipado', () => {
  it('dice las tres cosas: gratis un tiempo, después de pago y el trabajo se puede descargar', () => {
    pintar();
    expect(screen.getByText('Es gratis durante el lanzamiento.')).toBeTruthy();
    expect(screen.getByText('Después pasará a ser de pago.')).toBeTruthy();
    expect(screen.getByText('Tu trabajo es tuyo.')).toBeTruthy();
    expect(screen.getByText(/«Descargar mis datos»/)).toBeTruthy();
    // Lo mismo que la portada (decisión del dueño, 9-11-2026): gratis hasta el 1 de enero de 2027, y después la oferta de lanzamiento
    const texto = document.body.textContent ?? '';
    expect(texto).toContain('hasta el 1 de enero de 2027');
    expect(texto).toMatch(/9,90\s€ el primer año si te suscribes hasta el 15 de abril de 2027/);
    expect(texto).toMatch(/14,99\s€ al año/);
    // Ninguna duración suelta («2 meses»)
    expect(texto).not.toMatch(/\d+ (meses|días)/i);
  });

  it('no deja seguir sin marcar la casilla, y al marcarla y continuar se acuerda', () => {
    const onContinuar = pintar();
    const boton = screen.getByRole('button', { name: 'Entrar en AulaPro' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    fireEvent.click(boton);
    expect(onContinuar).not.toHaveBeenCalled();
    expect(avisoBetaVisto()).toBe(false);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(boton.disabled).toBe(false);
    fireEvent.click(boton);
    expect(onContinuar).toHaveBeenCalledTimes(1);
    expect(avisoBetaVisto()).toBe(true);
  });
});

describe('quién lo ve', () => {
  it('solo quien tiene la licencia de acceso anticipado y no lo ha confirmado', () => {
    expect(hayQueEnseñarAvisoBeta('beta', false)).toBe(true);
    expect(hayQueEnseñarAvisoBeta('beta', true)).toBe(false);
    // Los fundadores y quien paga no lo ven nunca
    for (const estado of ['fundador', 'activa', 'sin-licencia', undefined]) expect(hayQueEnseñarAvisoBeta(estado, false)).toBe(false);
  });

  it('una versión nueva del aviso se vuelve a pedir; la misma, no', () => {
    expect(avisoBetaVisto()).toBe(false);
    marcarAvisoBetaVisto();
    expect(avisoBetaVisto()).toBe(true);
    localStorage.setItem('aulapro_aviso_beta', '2026-01-01');
    expect(avisoBetaVisto()).toBe(false);
    expect(VERSION_AVISO_BETA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
