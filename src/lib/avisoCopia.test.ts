// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { debeAvisar, diasDesdeCopia, leerEstadoCopia, marcarUso, posponerAviso, registrarCopia, DIAS_ENTRE_COPIAS, DIAS_POSPONER, DIAS_PRIMER_AVISO } from './avisoCopia';

const DIA = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 30, 10);
const iso = (t: number) => new Date(t).toISOString();

describe('recordatorio de copia de seguridad', () => {
  beforeEach(() => localStorage.clear());

  it('no avisa el primer día ni si aún no se sabe desde cuándo se usa', () => {
    expect(debeAvisar({ ultima: null, desde: null, pospuestoHasta: null }, T0)).toBe(false);
    expect(debeAvisar({ ultima: null, desde: iso(T0), pospuestoHasta: null }, T0 + DIA)).toBe(false);
  });

  it('sin ninguna copia, avisa a los 2 días de uso', () => {
    const e = { ultima: null, desde: iso(T0), pospuestoHasta: null };
    expect(debeAvisar(e, T0 + (DIAS_PRIMER_AVISO * DIA) - 1)).toBe(false);
    expect(debeAvisar(e, T0 + DIAS_PRIMER_AVISO * DIA)).toBe(true);
  });

  it('con una copia hecha, vuelve a avisar pasada una semana, contada desde la copia y no desde el primer uso', () => {
    const e = { ultima: iso(T0 + 10 * DIA), desde: iso(T0), pospuestoHasta: null };
    expect(debeAvisar(e, T0 + 10 * DIA + (DIAS_ENTRE_COPIAS * DIA) - 1)).toBe(false);
    expect(debeAvisar(e, T0 + 10 * DIA + DIAS_ENTRE_COPIAS * DIA)).toBe(true);
  });

  it('«más tarde» calla el aviso 3 días y luego vuelve', () => {
    localStorage.setItem('aulapro_copia_desde', iso(T0));
    posponerAviso(T0 + 5 * DIA);
    const e = leerEstadoCopia();
    expect(debeAvisar(e, T0 + 5 * DIA + 1000)).toBe(false);
    expect(debeAvisar(e, T0 + 5 * DIA + DIAS_POSPONER * DIA)).toBe(true);
  });

  it('hacer una copia apunta la fecha, quita el «más tarde» y calla el aviso', () => {
    marcarUso(T0);
    posponerAviso(T0);
    registrarCopia(T0 + 3 * DIA);
    const e = leerEstadoCopia();
    expect(e.pospuestoHasta).toBeNull();
    expect(debeAvisar(e, T0 + 4 * DIA)).toBe(false);
    expect(debeAvisar(e, T0 + 3 * DIA + 8 * DIA)).toBe(true);
  });

  it('el primer uso se apunta una sola vez', () => {
    marcarUso(T0);
    marcarUso(T0 + 9 * DIA);
    expect(leerEstadoCopia().desde).toBe(iso(T0));
  });

  it('cuenta los días desde la última copia, y nada si no hay', () => {
    expect(diasDesdeCopia(null)).toBeNull();
    expect(diasDesdeCopia('basura')).toBeNull();
    expect(diasDesdeCopia(iso(T0), T0 + 3 * DIA + 5000)).toBe(3);
    expect(diasDesdeCopia(iso(T0 + DIA), T0)).toBe(0);
  });

  it('con fechas rotas guardadas, no falla ni avisa', () => {
    expect(debeAvisar({ ultima: 'x', desde: 'y', pospuestoHasta: 'z' }, T0)).toBe(false);
  });
});
