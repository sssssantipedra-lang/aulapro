import { describe, it, expect } from 'vitest';
import core from './licenseCore.cjs';

const { evaluate, canBeFounder, keyHint, activationError, expiresAtOf, validationVerdict, DAY } = core;
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
  it('sin conexión no se bloquea nunca: la web promete internet solo para activar', () => {
    expect(evaluate(rec(400), { machine, now, enforced: true })).toEqual({ required: false, status: 'activa', needsCheck: true });
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
  const dias = (n) => new Date(now + n * DAY).toISOString();
  const anual = (expiraEn, lastOk = 1) => ({ kind: 'licencia', machine, key: 'K', lastOkAt: new Date(now - lastOk * DAY).toISOString(), expiresAt: dias(expiraEn) });

  it('de por vida: sin fecha de caducidad, nada cambia', () => {
    const r = evaluate({ kind: 'licencia', machine, key: 'K', lastOkAt: new Date(now).toISOString() }, { machine, now, enforced: true });
    expect(r.expiresAt).toBeUndefined();
    expect(r).toMatchObject({ status: 'activa', required: false });
  });
  it('anual vigente: activa y con los días que le quedan', () => {
    expect(evaluate(anual(200), { machine, now, enforced: true })).toMatchObject({ status: 'activa', required: false, daysLeft: 200, needsCheck: false });
  });
  it('a 14 días de caducar se comprueba en cada arranque, por si ya renovó', () => {
    expect(evaluate(anual(14), { machine, now, enforced: true })).toMatchObject({ status: 'activa', daysLeft: 14, needsCheck: true });
    expect(evaluate(anual(15), { machine, now, enforced: true }).needsCheck).toBe(false);
  });
  it('caducada: no bloquea los datos (required false) y se vuelve a preguntar siempre', () => {
    expect(evaluate(anual(-1), { machine, now, enforced: true })).toMatchObject({ status: 'caducada', required: false, needsCheck: true, daysLeft: 0 });
  });
  it('sin conexión una anual vigente sigue funcionando', () => {
    expect(evaluate(anual(30, 400), { machine, now, enforced: true })).toMatchObject({ status: 'activa', required: false });
  });
  it('la fecha de la tienda se guarda en ISO, y vacía si no hay', () => {
    expect(expiresAtOf({ license_key: { expires_at: '2027-04-16T10:00:00.000000Z' } })).toBe('2027-04-16T10:00:00.000Z');
    expect(expiresAtOf({ license_key: { expires_at: null } })).toBe('');
    expect(expiresAtOf({})).toBe('');
  });
  it('comprobar: solo una anulación quita la licencia, una caducada se conserva', () => {
    expect(validationVerdict({ valid: true, license_key: { status: 'active' } }, 200)).toBe('valida');
    expect(validationVerdict({ valid: false, license_key: { status: 'expired' } }, 200)).toBe('caducada');
    expect(validationVerdict({ valid: false, license_key: { status: 'disabled' } }, 200)).toBe('anulada');
    expect(validationVerdict({ valid: false, error: 'not found' }, 404)).toBe('anulada');
    expect(validationVerdict({}, 503)).toBe('incierta');
  });
});
