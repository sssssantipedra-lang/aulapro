import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { post: (o: unknown) => post(o) } }));
const { createAndroidLicense, activationError, checkOutcome, expiry } = await import('./androidLicense');

function secrets() {
  const mem = new Map<string, string>();
  return { mem, get: async (n: string) => mem.get(n) ?? '', set: async (n: string, v: string) => { if (v) mem.set(n, v); else mem.delete(n); return true; } };
}

beforeEach(() => post.mockReset());

describe('licencia en Android', () => {
  it('mientras no se vende, el dispositivo queda como fundador', async () => {
    const s = secrets();
    const lic = createAndroidLicense(s, { enforced: false });
    expect(await lic.state()).toMatchObject({ required: false, status: 'fundador', buyUrl: '' });
    expect(JSON.parse(s.mem.get('licencia')!).kind).toBe('fundador');
  });

  it('ya a la venta, sin clave pide activar, y nunca enseña un enlace de compra', async () => {
    const lic = createAndroidLicense(secrets(), { enforced: true });
    expect(await lic.state()).toMatchObject({ required: true, status: 'sin-licencia', buyUrl: '' });
  });

  it('activa enviando solo la clave y un nombre neutro', async () => {
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'ins-1' }, meta: { store_id: 7 } } });
    const s = secrets();
    const lic = createAndroidLicense(s, { enforced: true, storeId: '7' });
    const r = await lic.activate('ABCD-1234-WXYZ');
    expect(r).toMatchObject({ ok: true, state: { required: false, status: 'activa', keyHint: '••••WXYZ' } });
    expect(post.mock.calls[0][0].data).toEqual({ license_key: 'ABCD-1234-WXYZ', instance_name: 'Aula Pro · Android' });
    // Al volver a abrir la app sigue activada, sin internet
    post.mockResolvedValue(undefined); // sin red: CapacitorHttp no devuelve respuesta
    expect(await createAndroidLicense(s, { enforced: true, storeId: '7' }).state()).toMatchObject({ required: false, status: 'activa' });
  });

  it('explica los errores: límite de dispositivos y sin conexión', async () => {
    post.mockResolvedValue({ status: 400, data: { activated: false, error: 'This license key has reached the activation limit.' } });
    const lic = createAndroidLicense(secrets(), { enforced: true });
    expect((await lic.activate('K')).error).toBe('limite');
    post.mockResolvedValue(undefined); // sin red: CapacitorHttp no devuelve respuesta
    expect((await lic.activate('K')).error).toBe('sin-conexion');
  });

  it('desactivar libera el dispositivo', async () => {
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'ins-1' } } });
    const lic = createAndroidLicense(secrets(), { enforced: true });
    await lic.activate('ABCD-1234-WXYZ');
    post.mockResolvedValue({ status: 200, data: { deactivated: true } });
    expect(await lic.deactivate()).toMatchObject({ ok: true, state: { required: true, status: 'sin-licencia' } });
    expect(post.mock.calls[1][0].data).toEqual({ license_key: 'ABCD-1234-WXYZ', instance_id: 'ins-1' });
  });

  it('las mismas respuestas de la tienda que en el escritorio', () => {
    expect(activationError({ activated: true, meta: { store_id: 1 } }, 200, '2')).toBe('otra-tienda');
    expect(activationError({ error: 'license_key not found.' }, 404, '')).toBe('clave-no-valida');
    expect(activationError({ error: 'x', license_key: { status: 'disabled' } }, 400, '')).toBe('desactivada');
  });
});

describe('licencia anual en Android', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const en = (dias: number) => new Date(Date.now() + dias * DAY).toISOString();

  it('al activar guarda la fecha de caducidad y la enseña', async () => {
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'i' }, license_key: { expires_at: en(200) } } });
    const lic = createAndroidLicense(secrets(), { enforced: true });
    const r = await lic.activate('ABCD-1234-WXYZ');
    expect(r.state).toMatchObject({ status: 'activa', daysLeft: 200 });
    expect(r.state.expiresAt).not.toBe('');
  });

  it('una de por vida no tiene fecha', async () => {
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'i' }, license_key: { expires_at: null } } });
    const r = await createAndroidLicense(secrets(), { enforced: true }).activate('K');
    expect(r.state).toMatchObject({ status: 'activa', expiresAt: '', daysLeft: null });
  });

  it('sin renovar queda caducada, sigue sin pedir activación y al renovar vuelve a activa', async () => {
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'i' }, license_key: { expires_at: en(100) } } });
    const s = secrets();
    const lic = createAndroidLicense(s, { enforced: true });
    await lic.activate('ABCD-1234-WXYZ');

    post.mockResolvedValue({ status: 200, data: { valid: false, license_key: { status: 'expired', expires_at: en(-5) } } });
    const caducada = await lic.recheck();
    expect(caducada).toMatchObject({ ok: true, state: { required: false, status: 'caducada' } });
    // Al reabrir la app, el registro se conserva
    post.mockResolvedValue(undefined);
    expect(await createAndroidLicense(s, { enforced: true }).state()).toMatchObject({ required: false, status: 'caducada' });

    post.mockResolvedValue({ status: 200, data: { valid: true, license_key: { status: 'active', expires_at: en(365) } } });
    expect(await lic.recheck()).toMatchObject({ ok: true, state: { status: 'activa', daysLeft: 365 } });
  });

  it('volver a comprobar sin internet no cambia nada y lo dice', async () => {
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'i' }, license_key: { expires_at: en(100) } } });
    const lic = createAndroidLicense(secrets(), { enforced: true });
    await lic.activate('K');
    post.mockResolvedValue(undefined);
    expect(await lic.recheck()).toMatchObject({ ok: false, error: 'sin-conexion', state: { status: 'activa' } });
  });

  it('reembolsada: se borra el registro, como antes', async () => {
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'i' } } });
    const lic = createAndroidLicense(secrets(), { enforced: true });
    await lic.activate('K');
    post.mockResolvedValue({ status: 200, data: { valid: false, license_key: { status: 'disabled' } } });
    expect(await lic.recheck()).toMatchObject({ state: { required: true, status: 'sin-licencia' } });
  });

  it('las mismas reglas de fechas que en el escritorio', () => {
    const rec = (d: number, extra = {}) => ({ v: 1 as const, kind: 'licencia' as const, activatedAt: new Date().toISOString(), lastOkAt: new Date().toISOString(), expiresAt: en(d), ...extra });
    const now = Date.now();
    expect(expiry(rec(200), now)).toMatchObject({ status: 'activa', needsCheck: false, daysLeft: 200 });
    expect(expiry(rec(20), now)).toMatchObject({ status: 'activa', needsCheck: true });
    expect(expiry(rec(-2), now)).toMatchObject({ status: 'activa' }); // cortesía
    expect(expiry(rec(-4), now)).toMatchObject({ status: 'caducada' });
    expect(expiry(rec(10, { expired: true }), now)).toMatchObject({ status: 'caducada' });
    expect(checkOutcome({ valid: false, license_key: { status: 'expired' } }, 200).kind).toBe('caducada');
    expect(checkOutcome({}, 503).kind).toBe('nada');
    expect(activationError({ license_key: { status: 'expired' } }, 400, '')).toBe('caducada');
  });
});
