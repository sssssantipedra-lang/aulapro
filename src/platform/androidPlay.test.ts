import { describe, it, expect, vi } from 'vitest';
import { createAndroidPlay, derecho, errorDeCompra, PRODUCTOS, type Compra, type Facturacion } from './androidPlay';

function secrets() {
  const mem = new Map<string, string>();
  return { mem, get: async (n: string) => mem.get(n) ?? '', set: async (n: string, v: string) => { if (v) mem.set(n, v); else mem.delete(n); return true; } };
}
const compra = (id: string, extra: Partial<Compra> = {}): Compra => ({ productIdentifier: id, purchaseState: '1', ...extra });

function facturacion(compras: Compra[] | Error = []): Facturacion & { compras: ReturnType<typeof vi.fn>; comprar: ReturnType<typeof vi.fn> } {
  return {
    disponible: vi.fn().mockResolvedValue(true),
    compras: vi.fn(async () => { if (compras instanceof Error) throw compras; return compras; }),
    precio: vi.fn(async p => (p === 'vida' ? '6,99 €' : '11,99 €')),
    comprar: vi.fn().mockResolvedValue(undefined),
    gestionar: vi.fn().mockResolvedValue(undefined),
  };
}

describe('derecho a usar la app (compras de Google Play)', () => {
  it('la compra única o la suscripción dan derecho; la única gana', () => {
    expect(derecho([compra(PRODUCTOS.anual)])).toBe('anual');
    expect(derecho([compra(PRODUCTOS.anual), compra(PRODUCTOS.vida)])).toBe('vida');
  });
  it('una compra pendiente de pago, revocada o de otro producto no cuenta', () => {
    expect(derecho([compra(PRODUCTOS.vida, { purchaseState: '2' })])).toBeNull();
    expect(derecho([compra(PRODUCTOS.vida, { revocationDate: '2026-12-01' })])).toBeNull();
    expect(derecho([compra('otra_cosa')])).toBeNull();
    expect(derecho([])).toBeNull();
  });
  it('traduce los fallos del plugin', () => {
    expect(errorDeCompra(new Error('User cancelled the purchase'))).toBe('compra-cancelada');
    expect(errorDeCompra(new Error('Purchase is pending'))).toBe('pendiente');
    expect(errorDeCompra(new Error('Item already owned'))).toBe('ya-comprada');
    expect(errorDeCompra(new Error('boom'))).toBe('error-tienda');
  });
});

describe('licencia en Android con Google Play', () => {
  it('mientras no se vende, el dispositivo queda como fundador', async () => {
    const s = secrets();
    const lic = createAndroidPlay(s, facturacion(), { enforced: false });
    expect(await lic.state()).toMatchObject({ required: false, status: 'fundador', buyUrl: '' });
  });

  it('ya a la venta, sin compra pide activar y nunca enseña un enlace de pago', async () => {
    const lic = createAndroidPlay(secrets(), facturacion(), { enforced: true });
    expect(await lic.state()).toMatchObject({ required: true, status: 'sin-licencia', buyUrl: '' });
  });

  it('comprar la de por vida la activa', async () => {
    const f = facturacion();
    const lic = createAndroidPlay(secrets(), f, { enforced: true });
    await lic.state();
    f.compras.mockResolvedValue([compra(PRODUCTOS.vida)]);
    const r = await lic.play.comprar('vida');
    expect(f.comprar).toHaveBeenCalledWith('vida');
    expect(r).toMatchObject({ ok: true, state: { required: false, status: 'activa' } });
  });

  it('abre sin conexión con la copia guardada', async () => {
    const s = secrets();
    const f = facturacion([compra(PRODUCTOS.vida)]);
    await createAndroidPlay(s, f, { enforced: true }).play.restaurar();
    const sinRed = facturacion(new Error('SERVICE_UNAVAILABLE'));
    expect(await createAndroidPlay(s, sinRed, { enforced: true }).state()).toMatchObject({ required: false, status: 'activa' });
  });

  it('cancelar la compra o no tener Google Play se explica', async () => {
    const f = facturacion();
    const lic = createAndroidPlay(secrets(), f, { enforced: true });
    f.comprar.mockRejectedValue(new Error('User cancelled'));
    expect((await lic.play.comprar('anual')).error).toBe('compra-cancelada');
    (f.disponible as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    expect((await lic.play.comprar('anual')).error).toBe('no-disponible');
  });

  it('un pago pendiente no activa nada', async () => {
    const f = facturacion([compra(PRODUCTOS.vida, { purchaseState: '2' })]);
    const lic = createAndroidPlay(secrets(), f, { enforced: true });
    expect(await lic.play.comprar('vida')).toMatchObject({ ok: false, error: 'pendiente', state: { required: true } });
  });

  it('restaurar sin ninguna compra lo dice; sin conexión, también', async () => {
    const f = facturacion([]);
    const lic = createAndroidPlay(secrets(), f, { enforced: true });
    expect((await lic.play.restaurar()).error).toBe('sin-compra');
    f.compras.mockRejectedValue(new Error('x'));
    expect((await lic.play.restaurar()).error).toBe('sin-conexion');
  });

  it('suscripción sin renovar: caducada, sin pedir activación; al renovar vuelve a activa', async () => {
    const s = secrets();
    const f = facturacion([compra(PRODUCTOS.anual)]);
    const lic = createAndroidPlay(s, f, { enforced: true });
    await lic.play.restaurar();
    f.compras.mockResolvedValue([]);
    expect(await lic.recheck()).toMatchObject({ ok: true, state: { required: false, status: 'caducada' } });
    // Al reabrir se conserva
    expect(await createAndroidPlay(s, facturacion(new Error('x')), { enforced: true }).state()).toMatchObject({ required: false, status: 'caducada' });
    f.compras.mockResolvedValue([compra(PRODUCTOS.anual)]);
    expect(await lic.recheck()).toMatchObject({ state: { status: 'activa' } });
  });

  it('una compra reembolsada deja revisar, nunca bloquea los datos', async () => {
    const f = facturacion([compra(PRODUCTOS.vida)]);
    const lic = createAndroidPlay(secrets(), f, { enforced: true });
    await lic.play.restaurar();
    f.compras.mockResolvedValue([]);
    expect(await lic.recheck()).toMatchObject({ state: { required: false, status: 'caducada' } });
  });

  it('los precios los da Google Play', async () => {
    const lic = createAndroidPlay(secrets(), facturacion(), { enforced: true });
    expect(await lic.play.ofertas()).toEqual([{ id: 'vida', precio: '6,99 €' }, { id: 'anual', precio: '11,99 €' }]);
  });
});
