import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { post: (o: unknown) => post(o) } }));
const { createAndroidLicense, activationError } = await import('./androidLicense');

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
  const dias = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

  it('guarda la fecha de caducidad y cuenta los días', async () => {
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'i' }, license_key: { expires_at: dias(100) } } });
    const lic = createAndroidLicense(secrets(), { enforced: true });
    const r = await lic.activate('ANUAL-1234-WXYZ');
    expect(r.state).toMatchObject({ status: 'activa', daysLeft: 100 });
    expect(r.state.expiresAt).toBeTruthy();
  });

  it('la de por vida no tiene fecha', async () => {
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'i' }, license_key: { expires_at: null } } });
    const r = await createAndroidLicense(secrets(), { enforced: true }).activate('VIDA-1234-WXYZ');
    expect(r.state).toMatchObject({ status: 'activa', expiresAt: '', daysLeft: null });
  });

  it('caducada: no bloquea (required falso) y al renovar vuelve a activa', async () => {
    const s = secrets();
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'i' }, license_key: { expires_at: dias(-2) } } });
    await createAndroidLicense(s, { enforced: true }).activate('ANUAL-1234-WXYZ');
    // Al abrir: caducada y la tienda dice que sigue sin renovar
    post.mockResolvedValue({ status: 200, data: { valid: false, license_key: { status: 'expired', expires_at: dias(-2) } } });
    const lic = createAndroidLicense(s, { enforced: true });
    expect(await lic.state()).toMatchObject({ required: false, status: 'caducada' });
    await new Promise(r => setTimeout(r, 0));
    expect(JSON.parse(s.mem.get('licencia')!).kind).toBe('licencia'); // se conserva
    // Renueva: la tienda da la clave por buena con nueva fecha
    post.mockResolvedValue({ status: 200, data: { valid: true, license_key: { status: 'active', expires_at: dias(365) } } });
    const lic2 = createAndroidLicense(s, { enforced: true });
    await lic2.state();
    await new Promise(r => setTimeout(r, 0));
    expect(await createAndroidLicense(s, { enforced: true }).state()).toMatchObject({ status: 'activa', daysLeft: 365 });
  });

  it('una devolución (disabled) sí quita la licencia', async () => {
    const s = secrets();
    post.mockResolvedValue({ status: 200, data: { activated: true, instance: { id: 'i' }, license_key: { expires_at: dias(5) } } });
    await createAndroidLicense(s, { enforced: true }).activate('ANUAL-1234-WXYZ');
    post.mockResolvedValue({ status: 200, data: { valid: false, license_key: { status: 'disabled' } } });
    const lic = createAndroidLicense(s, { enforced: true });
    await lic.state();
    await new Promise(r => setTimeout(r, 0));
    expect(await createAndroidLicense(s, { enforced: true }).state()).toMatchObject({ required: true, status: 'sin-licencia' });
  });
});
