// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { accesoDe, guardarPrueba, leerPrueba, motivoIaCerrada, setAcceso } from './acceso';
import type { LicenseState } from '../types/electron';

const base: LicenseState = { required: false, status: 'activa', enforced: true, keyHint: '', since: '', buyUrl: '' };

beforeEach(() => { localStorage.clear(); setAcceso({ modo: 'completo', daysLeft: null }); });

describe('acceso según la licencia', () => {
  it('en el navegador no hay licencia: acceso completo', () => {
    expect(accesoDe(null, false).modo).toBe('completo');
  });
  it('fundador o activa: completo; de por vida no tiene días', () => {
    expect(accesoDe({ ...base, status: 'fundador' }, false)).toEqual({ modo: 'completo', daysLeft: null });
    expect(accesoDe(base, false)).toEqual({ modo: 'completo', daysLeft: null });
  });
  it('anual vigente: completo, con los días que quedan', () => {
    expect(accesoDe({ ...base, daysLeft: 9 }, false)).toEqual({ modo: 'completo', daysLeft: 9 });
  });
  it('anual caducada: modo caducada', () => {
    expect(accesoDe({ ...base, status: 'caducada' }, false).modo).toBe('caducada');
  });
  it('sin licencia: pide activar, y solo entra en prueba si el docente lo elige', () => {
    const sin = { ...base, status: 'sin-licencia' as const, required: true };
    expect(accesoDe(sin, false).modo).toBe('completo'); // la pantalla de activación sale antes (required)
    expect(accesoDe(sin, true).modo).toBe('prueba');
  });
  it('mientras no se vende (enforced falso) nunca hay modo de prueba', () => {
    expect(accesoDe({ ...base, status: 'sin-licencia', required: false, enforced: false }, true).modo).toBe('completo');
  });
});

describe('prueba y candado de la IA', () => {
  it('la elección de probar se recuerda', () => {
    expect(leerPrueba()).toBe(false);
    guardarPrueba(true);
    expect(leerPrueba()).toBe(true);
    guardarPrueba(false);
    expect(leerPrueba()).toBe(false);
  });
  it('la IA solo se cierra en prueba y con la anual caducada', () => {
    expect(motivoIaCerrada()).toBeNull();
    setAcceso({ modo: 'prueba', daysLeft: null });
    expect(motivoIaCerrada()).toMatch(/modo de prueba/);
    setAcceso({ modo: 'caducada', daysLeft: 0 });
    expect(motivoIaCerrada()).toMatch(/caducado/);
    setAcceso({ modo: 'completo', daysLeft: 3 });
    expect(motivoIaCerrada()).toBeNull();
  });
});
