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
    expect(post.mock.calls[0][0].data).toEqual({ license_key: 'ABCD-1234-WXYZ', instance_name: 'AulaPro · Android' });
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

describe('licencia de la cuenta (versión web)', () => {
  it('se activa sin ocupar dispositivos en la tienda y se quita si se devuelve', async () => {
    const s = secrets();
    const lic = createAndroidLicense(s, { enforced: true });
    expect((await lic.state()).required).toBe(true);
    const st = await lic.porCuenta!('CLAVE-ABCD');
    expect(st).toMatchObject({ required: false, status: 'activa', keyHint: '••••ABCD' });
    expect(post).not.toHaveBeenCalled();
    // Otra sesión en el mismo dispositivo: sigue activa sin llamar a la tienda
    const otra = createAndroidLicense(s, { enforced: true });
    expect((await otra.state()).required).toBe(false);
    expect(post).not.toHaveBeenCalled();
    expect((await otra.porCuenta!(null)).required).toBe(true);
  });

  it('un fundador por su correo entra gratis y deja de serlo si sale de la lista', async () => {
    const lic = createAndroidLicense(secrets(), { enforced: true });
    expect(await lic.porCuenta!('fundador')).toMatchObject({ required: false, status: 'fundador' });
    expect((await lic.porCuenta!(null)).required).toBe(true);
  });
});

describe('licencia firmada al abrir (versión web)', () => {
  it('sin firma válida, la de la cuenta se quita y hay que volver a buscarla', async () => {
    const s = secrets();
    await createAndroidLicense(s, { enforced: true }).porCuenta!('CLAVE-ABCD');
    const conFirma = createAndroidLicense(s, { enforced: true, verificar: async r => r.firma === 'buena' });
    expect((await conFirma.state()).required).toBe(true);
    const ok = createAndroidLicense(s, { enforced: true, verificar: async r => r.firma === 'buena' });
    expect((await ok.porCuenta!('CLAVE-ABCD', 'buena')).required).toBe(false);
    expect((await createAndroidLicense(s, { enforced: true, verificar: async r => r.firma === 'buena' }).state()).required).toBe(false);
  });

  it('con la firma caducada (7 días): con conexión se renueva sola; sin conexión no abre, pero la clave no se pierde', async () => {
    const s = secrets();
    s.mem.set('licencia', JSON.stringify({ v: 1, kind: 'licencia', key: 'CLAVE-1', instanceId: 'i1', activatedAt: '2026-11-01', firma: 'caducada' }));
    const verificar = async (r: { firma?: string }) => r.firma === 'nueva';
    // Sin conexión (o con las comprobaciones bloqueadas en el navegador): no hay licencia
    const sinRed = createAndroidLicense(s, { enforced: true, verificar, post: async () => null });
    expect((await sinRed.state()).required).toBe(true);
    expect(JSON.parse(s.mem.get('licencia')!).key).toBe('CLAVE-1');
    // Con conexión, la clave sigue valiendo en la tienda: firma nueva y adentro
    const alValer = vi.fn(async () => {});
    const conRed = createAndroidLicense(s, {
      enforced: true, verificar, alValer,
      post: async () => ({ status: 200, body: { valid: true, license_key: { status: 'active' }, aulapro_firma: 'nueva' } }),
    });
    expect((await conRed.state()).required).toBe(false);
    expect(alValer).toHaveBeenCalled();
  });

  it('con la firma caducada y la suscripción terminada, se bloquea y se avisa', async () => {
    const s = secrets();
    s.mem.set('licencia', JSON.stringify({ v: 1, kind: 'licencia', key: 'CLAVE-1', cuenta: true, activatedAt: '2026-11-01', firma: 'caducada' }));
    const lic = createAndroidLicense(s, {
      enforced: true, verificar: async () => false,
      post: async () => ({ status: 200, body: { valid: false, license_key: { status: 'expired' } } }),
    });
    expect((await lic.state()).required).toBe(true);
    expect(s.mem.get('licencia')).toBeUndefined();
  });

  it('pide la sesión de la app cada vez que hay una licencia válida (al abrir y al activar), y no sin ella', async () => {
    const s = secrets();
    const alValer = vi.fn(async () => {});
    const post = async () => ({ status: 200, body: { activated: true, instance: { id: 'i' }, aulapro_firma: 'f' } });
    const lic = createAndroidLicense(s, { enforced: true, storeId: '', verificar: async r => r.firma === 'f', alValer, post });
    expect((await lic.state()).required).toBe(true);
    expect(alValer).not.toHaveBeenCalled();
    await lic.activate('CLAVE-2');
    expect(alValer).toHaveBeenCalledTimes(1);
    await createAndroidLicense(s, { enforced: true, verificar: async r => r.firma === 'f', alValer, post }).state();
    expect(alValer).toHaveBeenCalledTimes(2);
  });
});
