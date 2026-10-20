import { describe, it, expect } from 'vitest';
import core from './licenseCore.cjs';

const { evaluate, canBeFounder, keyHint, activationError, checkOutcome, DAY, GRACE } = core;
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
    expect(evaluate(rec(1), { machine, now, enforced: true })).toEqual({ required: false, status: 'activa', needsCheck: false, expiresAt: '', daysLeft: null });
  });
  it('a la semana se comprueba en segundo plano, sin bloquear', () => {
    expect(evaluate(rec(8), { machine, now, enforced: true })).toEqual({ required: false, status: 'activa', needsCheck: true, expiresAt: '', daysLeft: null });
  });
  it('sin conexión no se bloquea nunca: la web promete internet solo para activar', () => {
    expect(evaluate(rec(400), { machine, now, enforced: true })).toEqual({ required: false, status: 'activa', needsCheck: true, expiresAt: '', daysLeft: null });
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

describe('licencia anual', () => {
  const anual = (diasHastaCaducar, extra = {}) => ({
    kind: 'licencia', machine, key: 'K', lastOkAt: new Date(now - DAY).toISOString(),
    expiresAt: new Date(now + diasHastaCaducar * DAY).toISOString(), ...extra,
  });
  it('lejos de la fecha: activa, con los días que quedan', () => {
    expect(evaluate(anual(200), { machine, now, enforced: true })).toMatchObject({ status: 'activa', needsCheck: false, daysLeft: 200 });
  });
  it('a un mes de caducar se comprueba en cada arranque, para enterarse pronto de la renovación', () => {
    expect(evaluate(anual(20), { machine, now, enforced: true })).toMatchObject({ status: 'activa', needsCheck: true, daysLeft: 20 });
  });
  it('pasada la fecha, sigue activa unos días de cortesía', () => {
    expect(evaluate(anual(-2), { machine, now, enforced: true })).toMatchObject({ status: 'activa', daysLeft: 0 });
  });
  it('sin renovar tras la cortesía: caducada, pero nunca pide la pantalla de activación', () => {
    const r = evaluate(anual(-(GRACE / DAY) - 1), { machine, now, enforced: true });
    expect(r).toMatchObject({ required: false, status: 'caducada', needsCheck: true, daysLeft: 0 });
  });
  it('si la tienda dijo que caducó, queda caducada aunque la fecha local no haya pasado', () => {
    expect(evaluate(anual(10, { expired: true }), { machine, now, enforced: true })).toMatchObject({ required: false, status: 'caducada' });
  });
  it('las de por vida no caducan nunca, por antiguas que sean', () => {
    const r = evaluate({ kind: 'licencia', machine, key: 'K', lastOkAt: new Date(now - 900 * DAY).toISOString(), expiresAt: '' }, { machine, now, enforced: true });
    expect(r).toMatchObject({ status: 'activa', daysLeft: null });
  });
});

describe('licencia: comprobación con la tienda', () => {
  it('sigue valiendo y trae la fecha de caducidad (vacía si es de por vida)', () => {
    expect(checkOutcome({ valid: true, license_key: { status: 'active', expires_at: '2027-11-10T00:00:00Z' } }, 200)).toEqual({ kind: 'ok', expiresAt: '2027-11-10T00:00:00Z' });
    expect(checkOutcome({ valid: true, license_key: { status: 'active', expires_at: null } }, 200)).toEqual({ kind: 'ok', expiresAt: '' });
  });
  it('suscripción sin renovar: caducada, no anulada (el registro se conserva)', () => {
    expect(checkOutcome({ valid: false, license_key: { status: 'expired', expires_at: '2027-11-10T00:00:00Z' } }, 200).kind).toBe('caducada');
    expect(checkOutcome({ valid: false, error: 'license_key has expired.' }, 400).kind).toBe('caducada');
  });
  it('reembolsada o desactivada: anulada', () => {
    expect(checkOutcome({ valid: false, license_key: { status: 'disabled' } }, 200).kind).toBe('anulada');
    expect(checkOutcome({ valid: false, error: 'license_key not found.' }, 404).kind).toBe('anulada');
  });
  it('si la tienda falla (5xx) no se cambia nada', () => {
    expect(checkOutcome({}, 503).kind).toBe('nada');
  });
  it('activar una clave caducada se explica como caducada', () => {
    expect(activationError({ activated: false, license_key: { status: 'expired' } }, 400, '')).toBe('caducada');
  });
});
