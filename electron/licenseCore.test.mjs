import { describe, it, expect } from 'vitest';
import core from './licenseCore.cjs';

const { evaluate, canBeFounder, keyHint, activationError, DAY } = core;
const now = Date.parse('2026-10-01T10:00:00Z');
const machine = 'equipo-a';

describe('licencia: fundadores', () => {
  it('mientras no se venda, cualquier equipo queda como fundador', () => {
    expect(canBeFounder({ enforced: false, founderCutoff: '', profiles: [] })).toBe(true);
  });
  it('ya a la venta, solo quien tenía un perfil de antes de la fecha', () => {
    const antes = [{ createdAt: '2026-09-01T00:00:00Z' }];
    const despues = [{ createdAt: '2026-11-02T00:00:00Z' }];
    expect(canBeFounder({ enforced: true, founderCutoff: '2026-11-01', profiles: antes })).toBe(true);
    expect(canBeFounder({ enforced: true, founderCutoff: '2026-11-01', profiles: despues })).toBe(false);
    expect(canBeFounder({ enforced: true, founderCutoff: '', profiles: antes })).toBe(false);
    expect(canBeFounder({ enforced: true, founderCutoff: '2026-11-01', profiles: [] })).toBe(false);
  });
  it('un fundador nunca ve la pantalla en su equipo', () => {
    const r = evaluate({ kind: 'fundador', machine }, { machine, now, enforced: true });
    expect(r).toMatchObject({ required: false, status: 'fundador' });
  });
});

describe('licencia: copiar a otro ordenador no sirve', () => {
  it('un registro de otro equipo pide clave', () => {
    const r = evaluate({ kind: 'fundador', machine: 'equipo-b' }, { machine, now, enforced: true });
    expect(r).toMatchObject({ required: true, status: 'otro-equipo' });
  });
  it('sin registro pide clave, pero solo cuando ya se vende', () => {
    expect(evaluate(null, { machine, now, enforced: true })).toMatchObject({ required: true, status: 'sin-licencia' });
    expect(evaluate(null, { machine, now, enforced: false })).toMatchObject({ required: false });
  });
});

describe('licencia activada con clave', () => {
  const rec = (days) => ({ kind: 'licencia', machine, key: 'K', lastOkAt: new Date(now - days * DAY).toISOString() });
  it('recién comprobada: pasa sin preguntar', () => {
    expect(evaluate(rec(1), { machine, now, enforced: true })).toEqual({ required: false, status: 'activa', needsCheck: false });
  });
  it('a la semana se comprueba en segundo plano, sin bloquear', () => {
    expect(evaluate(rec(8), { machine, now, enforced: true })).toEqual({ required: false, status: 'activa', needsCheck: true });
  });
  it('tras 30 días sin poder comprobar, pide conexión', () => {
    expect(evaluate(rec(31), { machine, now, enforced: true })).toEqual({ required: true, status: 'caducada', needsCheck: true });
  });
});

describe('licencia: respuestas de la tienda', () => {
  it('traduce cada error a algo que se puede explicar', () => {
    expect(activationError({ activated: true, meta: { store_id: 1 } }, 200, '')).toBeNull();
    expect(activationError({ activated: true, meta: { store_id: 1 } }, 200, '2')).toBe('otra-tienda');
    expect(activationError({ activated: false, error: 'This license key has reached the activation limit.' }, 400, '')).toBe('limite');
    expect(activationError({ activated: false, error: 'license_key not found.' }, 404, '')).toBe('clave-no-valida');
    expect(activationError({ activated: false, error: 'x', license_key: { status: 'disabled' } }, 400, '')).toBe('desactivada');
    expect(activationError({}, 500, '')).toBe('error-tienda');
  });
  it('la clave nunca se enseña entera', () => {
    expect(keyHint('38b1460a-5104-4067-a91d-77b872934d51')).toBe('••••4d51');
  });
});
